// Obtiene la IP del cliente para el rate limiting.
//
// En Vercel, x-forwarded-for lo escribe la plataforma (el cliente no puede
// falsificar el primer valor). Si la app se despliega detrás de otro proxy,
// hay que revisar que ese proxy también lo sobrescriba.

const IP_PATTERN = /^[0-9a-fA-F:.]{2,45}$/;

export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const candidate = forwarded || headers.get("x-real-ip")?.trim() || "";
  // Se valida el formato para que un valor arbitrario no termine como clave en la BD.
  return IP_PATTERN.test(candidate) ? candidate : "unknown";
}
