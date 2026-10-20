import { describe, expect, it } from "vitest";

import { MAX_PROOF_BYTES, detectFileType, validateProofFile } from "@/lib/security/file-type";

const bytes = (...parts: (number[] | string)[]) =>
  new Uint8Array(parts.flatMap((p) => (typeof p === "string" ? [...p].map((c) => c.charCodeAt(0)) : p)));

describe("tipo de archivo por contenido (magic bytes)", () => {
  it.each([
    [bytes([0xff, 0xd8, 0xff, 0xe0], "JFIF"), "image/jpeg"],
    [bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], "IHDR"), "image/png"],
    [bytes("RIFF", [0, 0, 0, 0], "WEBPVP8 "), "image/webp"],
    [bytes("%PDF-1.7\n"), "application/pdf"],
  ])("reconoce %s como %s", (data, mime) => {
    expect(detectFileType(data)?.mime).toBe(mime);
  });

  it.each([
    [bytes("<!DOCTYPE html><script>alert(1)</script>"), "HTML renombrado a .jpg"],
    [bytes('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>'), "SVG con JavaScript"],
    [bytes("GIF89a"), "GIF (no permitido)"],
    [bytes("MZ", [0x90, 0x00]), "ejecutable de Windows"],
    [bytes([0x50, 0x4b, 0x03, 0x04]), "ZIP / documento de Office"],
    [bytes("RIFF", [0, 0, 0, 0], "AVI "), "RIFF que no es WEBP"],
    [bytes(" %PDF-1.7"), "PDF con un espacio antes de la firma"],
  ])("rechaza %s (%s)", (data) => {
    expect(detectFileType(data)).toBeNull();
  });
});

describe("validación del comprobante", () => {
  it("rechaza archivos vacíos y mayores a 5 MB", () => {
    expect(validateProofFile(new Uint8Array(0))).toMatchObject({ ok: false });
    const big = new Uint8Array(MAX_PROOF_BYTES + 1);
    big.set([0xff, 0xd8, 0xff]);
    expect(validateProofFile(big)).toEqual({ ok: false, error: "El archivo supera los 5 MB." });
  });

  it("acepta un JPG dentro del límite y devuelve la extensión segura", () => {
    const jpg = new Uint8Array(1024);
    jpg.set([0xff, 0xd8, 0xff]);
    expect(validateProofFile(jpg)).toEqual({ ok: true, type: { mime: "image/jpeg", ext: "jpg" } });
  });
});
