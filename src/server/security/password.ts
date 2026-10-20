import bcrypt from "bcryptjs";

// Costo 12 ≈ 200-300 ms por hash: lento para un atacante con millones de
// intentos, imperceptible para una persona que inicia sesión.
export const BCRYPT_ROUNDS = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// Hash de una contraseña aleatoria que nadie conoce. Cuando el correo no existe
// igual se compara contra este hash, para que la respuesta tarde lo mismo y no
// se pueda averiguar qué correos están registrados midiendo el tiempo.
let dummyHash: Promise<string> | undefined;
export function getDummyHash(): Promise<string> {
  dummyHash ??= bcrypt.hash(crypto.randomUUID(), BCRYPT_ROUNDS);
  return dummyHash;
}
