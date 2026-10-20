# Seguridad

Este documento resume qué amenazas se consideraron, cómo se mitigan y qué test
lo comprueba. Está organizado según el [OWASP Top 10](https://owasp.org/Top10/).

## Cómo correr las pruebas de seguridad

```bash
npm run test:unit          # validaciones, open redirect, IP del cliente
npm run test:integration   # IDOR, rate limiting, login (contra Postgres real)
npm run test:e2e           # ataques desde el navegador contra el build de producción
npm run audit:prod         # vulnerabilidades conocidas en dependencias de producción
```

## Amenazas, mitigaciones y pruebas

| Amenaza | Mitigación | Prueba |
| --- | --- | --- |
| **A01 · Acceso a páginas privadas sin sesión** | `src/proxy.ts` redirige `/cuenta`, `/checkout` y `/admin` al login. Cada página y Server Action vuelve a verificar (`requireUser`, `requireAdmin`). | `e2e/security.spec.ts` › Control de acceso |
| **A01 · Escalada de privilegios (cliente → admin)** | El rol viaja en el JWT firmado; `requireAdmin()` además lo consulta en la BD, así que un rol revocado deja de valer al instante. El registro siempre crea `CUSTOMER`. | `e2e` › un cliente no puede entrar al panel · `integration/auth.test.ts` › role=ADMIN |
| **A01 · IDOR: tocar el carrito de otro** | El ID del carrito nunca llega desde el navegador como parámetro: se resuelve desde la sesión o una cookie `httpOnly`. Toda consulta filtra por `cartId`. Una cookie con el ID del carrito de una cuenta no tiene efecto. | `integration/cart.service.test.ts` › aislamiento entre carritos |
| **A01 · Adivinar IDs de carrito** | 192 bits aleatorios (`crypto.randomBytes`), no IDs secuenciales. | `integration` › IDs aleatorios y únicos |
| **A02 · Contraseñas expuestas** | bcrypt con costo 12. Límite de 72 bytes (límite real de bcrypt). La sesión y las respuestas nunca incluyen el hash. | `integration` › bcrypt costo 12 · `e2e` › la sesión no expone el hash |
| **A03 · Inyección SQL** | Prisma con consultas parametrizadas; el único SQL manual (rate limit) usa plantillas parametrizadas. Además, Zod rechaza formatos inesperados. | `integration/rate-limit.test.ts` › clave como dato · `e2e` › búsqueda con SQL |
| **A03 · XSS** | React escapa todo el texto; no se usa `dangerouslySetInnerHTML`. CSP con `object-src 'none'` y `base-uri 'self'`. | `e2e` › búsqueda con HTML no ejecuta código |
| **A04 · Manipular precio, cantidad o stock** | El precio nunca se envía desde el cliente: siempre se lee de la BD. Cantidades validadas (1–10, enteras) y limitadas al stock. | `e2e` › precio no se puede alterar · cantidades manipuladas en la petición HTTP · `integration` › nunca más que el stock |
| **A05 · Clickjacking, sniffing, downgrade a HTTP** | Cabeceras: `Content-Security-Policy`, `X-Frame-Options: DENY`, `X-Content-Type-Options`, `Strict-Transport-Security`, `Referrer-Policy`, `Permissions-Policy`. Sin `X-Powered-By`. | `e2e` › cabeceras de seguridad |
| **A06 · Dependencias vulnerables** | `npm run audit:prod` en 0. Ver "Riesgos aceptados". | `npm run audit:prod` |
| **A07 · Fuerza bruta** | 5 intentos fallidos por correo cada 15 min. El bloqueo aplica incluso con la contraseña correcta y el contador se reinicia tras un login exitoso. | `integration` › bloquea tras 5 intentos · `e2e` › bloquea la cuenta |
| **A07 · Credential stuffing** | 30 intentos por IP cada 15 min y 5 registros por IP por hora. El contador vive en Postgres (funciona en serverless) y es atómico. | `integration` › 50 peticiones simultáneas cuentan 50 · límite por IP |
| **A07 · Enumeración de usuarios** | Mismo mensaje si el correo no existe o la contraseña es incorrecta. Si el correo no existe, igual se ejecuta bcrypt contra un hash ficticio para que el tiempo de respuesta sea el mismo. | `integration` › mismo error · tarda lo mismo · `e2e` › error de login |
| **A07 · Robo de sesión** | Cookies `httpOnly` (JavaScript no puede leerlas), `SameSite=Lax` y `Secure` en producción. | `e2e` › cookies httpOnly y SameSite |
| **A01/CSRF · Acciones desde otro sitio** | Las Server Actions solo aceptan POST y Next.js compara `Origin` con `Host`. | `e2e` › Server Action desde otro origen rechazada (incluye un control positivo) |
| **Open redirect tras el login** | `safeRedirect()` solo acepta rutas internas y valida la ruta ya normalizada. | `unit/security/safe-redirect.test.ts` (más de 20 vectores) · `e2e` › no redirige fuera del sitio |

### Pedidos y pagos

| Amenaza | Mitigación | Prueba |
| --- | --- | --- |
| **A01 · Ver pedidos o comprobantes ajenos (IDOR)** | Toda consulta de pedidos filtra por el usuario de la sesión. Un pedido o comprobante ajeno responde 404, igual que uno inexistente, para no confirmar que existe. Solo el dueño o un admin (rol leído de la BD) descarga comprobantes. | `e2e/security-orders.spec.ts` › otro cliente no puede ver el pedido ni el comprobante · `integration/orders.test.ts` › solo el dueño puede subir comprobantes |
| **A01 · Cancelar o pagar el pedido de otro** | Las acciones reciben el número de pedido, pero el servicio siempre exige `userId` = sesión. | `integration` › cancela un pedido propio, no uno ajeno · no se puede iniciar el pago de un pedido ajeno |
| **A04 · Pagar menos o falsificar el resultado del pago** | El servidor no confía en los parámetros de retorno: consulta el resultado a Payphone (`Confirm`) y exige que la transacción y el **monto** coincidan con el pago registrado. En modo simulado, el resultado va firmado con HMAC. | `integration/payphone.test.ts` (id falsificado, monto distinto, id de otra transacción) · `e2e` › resultado falsificado · monto alterado en la pasarela |
| **A04 · Vender más de lo que hay (sobreventa)** | El stock se descuenta al confirmar el pago, en una transacción, con `UPDATE … WHERE stock >= cantidad`. Las variantes se bloquean en orden fijo para evitar deadlocks. | `integration` › dos compras simultáneas de la última unidad: solo una se confirma |
| **A04 · Cobrar o descontar dos veces** | La confirmación es idempotente: "reclama" el pago con un `UPDATE` condicional; recargar la página de retorno no vuelve a procesarlo. | `integration` › confirmar dos veces descuenta una sola vez · `e2e` › volver a abrir la URL de retorno |
| **A04 · Totales manipulados** | Precios, envío, IVA y total se calculan en el servidor al crear el pedido, con precios de la BD, y se guardan como copia. | `integration` › copia de precios y cálculo en el servidor |
| **A04 · Factura sin identificación sobre el límite del SRI** | Sobre $50 el servidor exige cédula o RUC, validados con su dígito verificador (módulo 10 / módulo 11). | `unit/ec-id.test.ts` · `integration` › exige cédula o RUC · `e2e` › factura |
| **A03/A05 · Archivos maliciosos** | El tipo se detecta por *magic bytes* (JPG, PNG, WEBP, PDF), no por la extensión ni el MIME del navegador. Máximo 5 MB. El nombre lo genera el servidor (UUID) y la clave se valida contra *path traversal*. Los archivos se guardan fuera de `/public` y se sirven con `nosniff`, CSP `sandbox` y `no-store`. | `unit/security/file-upload.test.ts` · `payphone-mock.test.ts` (claves) · `e2e` › HTML o SVG disfrazados |
| **Abuso automatizado** | Límites por usuario: 10 pedidos cada 10 min, 10 intentos de pago cada 10 min y 10 comprobantes por hora. | Misma implementación probada en `rate-limit.test.ts` |

### Panel de administración

| Amenaza | Mitigación | Prueba |
| --- | --- | --- |
| **A01 · Ejecutar acciones de admin sin serlo** | Cada Server Action y cada consulta del panel llama a `requireAdmin()` (capa de acceso a datos). Ni el proxy ni el layout bastan: un layout no impide que la página se renderice, y las acciones son endpoints POST públicos. | `e2e/security-admin.spec.ts` › un cliente o un visitante no puede ejecutar acciones de admin (se reenvía una petición real del admin con otras cookies; incluye control positivo) |
| **A01 · Rol revocado con sesión vigente** | `requireAdmin()` lee el rol de la base de datos, no del JWT. | `e2e` › si a un admin le quitan el rol, pierde el acceso |
| **A04 · Editar variantes de otro producto** | Al guardar, toda variante enviada con `id` debe pertenecer al producto editado. | `integration/admin.test.ts` › no permite "robar" una variante |
| **A04 · Doble cancelación / doble reposición de stock** | Cambio de estado con `UPDATE … WHERE status = <anterior>` dentro de una transacción; la máquina de estados prohíbe saltos (p. ej. enviar sin cobrar) y marcar "pagado" a mano. | `integration` › dos admins cancelando a la vez · transiciones prohibidas |
| **A03/A05 · Imágenes maliciosas** | Solo JPG, PNG o WEBP detectados por *magic bytes* (nunca SVG), nombre UUID generado por el servidor, máximo 5 MB. | `e2e` › imagen de producto disfrazada (SVG con script) |
| **Path traversal en `/media`** | La ruta solo acepta claves `[a-z0-9_-/]` con extensión de imagen y resuelve dentro de la carpeta de subidas. | `e2e` › la ruta de imágenes públicas no permite leer otros archivos |
| **Abuso del optimizador de imágenes** | `images.localPatterns` y `remotePatterns` limitan qué rutas y dominios puede procesar `/_next/image`. | Configuración en `next.config.ts` |

### SEO y demo pública

| Amenaza | Mitigación | Prueba |
| --- | --- | --- |
| **A03 · XSS a través del JSON-LD** | `JSON.stringify` no es seguro dentro de `<script>`: un nombre como `</script><script>…` cerraría la etiqueta. `serializeJsonLd()` escapa `<`, `>`, `&`, U+2028 y U+2029. | `unit/seo-and-demo.test.ts` · `e2e/seo.spec.ts` › nombre de producto malicioso (creado desde el panel) |
| **Abuso de la demo pública** | Con `NEXT_PUBLIC_DEMO_MODE` el panel bloquea subidas de archivos y cambios de datos bancarios y de contacto (las credenciales de admin son públicas). Los datos se reinician cada noche. | Configuración (`src/lib/demo.ts`) |
| **Reinicio de datos no autorizado** | `/api/cron/reset-demo` exige `Authorization: Bearer <CRON_SECRET>` comparado en tiempo constante; sin secreto (o con uno corto) la ruta queda cerrada, y fuera del modo demo no existe. | `unit/seo-and-demo.test.ts` › secreto del cron |

## Accesibilidad

`tests/e2e/accessibility.spec.ts` audita con axe-core (WCAG 2.1 A y AA) las páginas públicas, el checkout, la cuenta y el panel, y falla ante cualquier violación grave o crítica. Al incorporarlo detectó dos problemas, ya corregidos: botones de paginación sin nombre accesible en celular y pestañas con contraste insuficiente.

## Hallazgos corregidos durante las pruebas

1. **Open redirect.** `safeRedirect("/..//evil.example")` devolvía `//evil.example`.
   Al normalizar la URL, el segmento `..` se elimina y queda una URL
   *protocol-relative*, que el navegador interpreta como `https://evil.example`.
   El test de propiedades ("cualquier resultado es siempre una ruta del mismo
   sitio") lo detectó. Ahora se valida el resultado final y el caso quedó como
   test de regresión.
2. **Numeración de pedidos.** La secuencia arrancaba en #1001 con `RESTART`, pero
   su valor inicial seguía siendo 1: tras un `TRUNCATE … RESTART IDENTITY` o una
   restauración, los pedidos habrían vuelto a numerarse desde #1 y podían
   confundirse con pedidos viejos. Se corrigió con `START WITH 1001`.
3. **Datos de la cuenta visibles tras cerrar sesión.** Next.js 16 conserva hasta
   tres páginas visitadas ocultas en el DOM (`<Activity>`), en vez de
   desmontarlas. Tras un logout con navegación normal, "Mi cuenta" o el checkout
   (con la dirección) seguían en memoria en un dispositivo compartido. El logout
   ahora hace una recarga completa, como recomienda la guía de Next.js.
4. **IDs duplicados en formularios.** Por el mismo motivo, dos formularios
   (p. ej. login y registro) podían convivir en el DOM con `id="email"`, y un
   `<label>` apuntaba al campo oculto. Todos los formularios usan `useId()`.

## Riesgos aceptados y decisiones

- **`'unsafe-inline'` en `script-src`.** Next.js inserta scripts inline. La alternativa (CSP con *nonce*) obliga a renderizar todas las páginas dinámicamente y se pierde el prerenderizado estático del catálogo. El riesgo se reduce porque no hay HTML de usuario sin escapar.
- **Vulnerabilidad en `braces` (GHSA-vfj7-8cjw-p6xm).** Es una denegación de servicio con patrones glob anidados. Solo aparece en herramientas de desarrollo (CLI de shadcn y ESLint), que nunca procesan entradas de usuarios y no se despliegan. No existe versión corregida.
- **El registro indica si un correo ya existe.** Se prioriza la experiencia del cliente; el abuso está limitado a 5 registros por IP por hora.
- **IP del cliente.** Se toma de `x-forwarded-for`, que en Vercel escribe la plataforma. Si se despliega detrás de otro proxy, hay que confirmar que ese proxy sobrescriba la cabecera.
- **Verificación de correo.** Todavía no se envía un correo de confirmación al registrarse; es una mejora prevista.
- **`PAYPHONE_MODE=mock`.** La pasarela simulada permite aprobar pedidos sin pagar. Solo debe usarse en desarrollo, tests o una demo pública claramente marcada. Con `live`, la ruta `/pago-simulado` responde 404 y el servidor confirma contra Payphone.
- **Server Actions sin cabecera `Origin`.** Next.js las acepta con una advertencia. Los navegadores siempre envían `Origin` en un POST, así que la protección CSRF aplica a cualquier ataque lanzado desde una página web.
- **El stock no se reserva al crear el pedido**, sino al pagar (requisito del negocio). Si dos clientes pagan la última unidad, el segundo cobro queda registrado "para revisión" (reponer o reembolsar). Nunca se vende stock inexistente.
- **Pedidos sin pagar no expiran solos.** Quedan "Pendiente de pago" hasta que el cliente o el admin los cancelen. Una tarea programada que los cancele es una mejora posible.
