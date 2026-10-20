// Modo demo: para la versión pública del portafolio, donde las credenciales
// del admin están en el README. Muestra un aviso, publica las credenciales en
// el login y bloquea lo que podría usarse para abusar del sitio (subir
// archivos, cambiar datos bancarios o de contacto, borrar el catálogo).
// Los datos se reinician cada noche (/api/cron/reset-demo).
export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

export const DEMO_DISABLED_MESSAGE = "Esta acción está deshabilitada en la demo pública.";
