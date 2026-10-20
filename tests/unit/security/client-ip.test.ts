import { describe, expect, it } from "vitest";

import { clientIp } from "@/lib/security/client-ip";

const h = (init: Record<string, string>) => new Headers(init);

describe("clientIp", () => {
  it("toma la primera IP de x-forwarded-for", () => {
    expect(clientIp(h({ "x-forwarded-for": "190.152.10.4, 10.0.0.1" }))).toBe("190.152.10.4");
  });

  it("acepta IPv6", () => {
    expect(clientIp(h({ "x-forwarded-for": "2800:370:1::1" }))).toBe("2800:370:1::1");
  });

  it("usa x-real-ip como respaldo", () => {
    expect(clientIp(h({ "x-real-ip": "200.1.2.3" }))).toBe("200.1.2.3");
  });

  it.each(["'; DROP TABLE \"RateLimit\"; --", "<script>", "1".repeat(100), "evil.example"])(
    "descarta valores que no son IP: %j",
    (value) => {
      expect(clientIp(h({ "x-forwarded-for": value }))).toBe("unknown");
    },
  );

  it("sin cabeceras devuelve 'unknown'", () => {
    expect(clientIp(h({}))).toBe("unknown");
  });
});
