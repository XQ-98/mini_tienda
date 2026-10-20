/** "Sombrero de paja toquilla Montecristi" → "sombrero-de-paja-toquilla-montecristi" */
export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // quita tildes
    .toLowerCase()
    .replace(/ñ/g, "n")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/, "");
}

export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
