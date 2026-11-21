import { mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadConfig, parseConfig, resolveHome } from "./config";

let home: string;

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "dex-ai-config-"));
});

afterEach(() => {
  rmSync(home, { recursive: true, force: true });
});

describe("loadConfig", () => {
  it("creates defaults on first run", () => {
    const config = loadConfig(home);
    expect(config.token).toMatch(/^[0-9a-f]{64}$/);
    expect(config.host).toBe("127.0.0.1");
    expect(config.port).toBe(4823);
    expect(config.dataDir).toBe(join(home, "data"));
    expect(config.allowedExtensionOrigins).toEqual([]);
    expect(config.uiOrigin).toBe("http://127.0.0.1:4823");
    expect(config.confidenceThreshold).toBe(0.7);
    expect(config.parakeetModelDir).toBe(join(home, "models", "parakeet-tdt-0.6b-v3-int8"));
  });

  it("writes config.json with mode 0600", () => {
    loadConfig(home);
    const mode = statSync(join(home, "config.json")).mode & 0o777;
    expect(mode).toBe(0o600);
  });

  it("keeps the existing token on reload", () => {
    const first = loadConfig(home);
    const second = loadConfig(home);
    expect(second).toEqual(first);
  });

  it("reads edited origins from disk", () => {
    const first = loadConfig(home);
    const edited = { ...first, allowedExtensionOrigins: ["chrome-extension://abc", "moz-extension://u-1"] };
    writeFileSync(join(home, "config.json"), JSON.stringify(edited));
    expect(loadConfig(home).allowedExtensionOrigins).toEqual(edited.allowedExtensionOrigins);
  });
});

describe("parseConfig", () => {
  it("rejects thresholds outside 0..1 and non-numbers", () => {
    const base = loadConfig(home);
    expect(() => parseConfig({ ...base, confidenceThreshold: 1.5 })).toThrow();
    expect(() => parseConfig({ ...base, confidenceThreshold: "0.7" })).toThrow();
    expect(parseConfig({ ...base, confidenceThreshold: 0.25 }).confidenceThreshold).toBe(0.25);
  });

  it("rejects non-extension origins and non-loopback host", () => {
    const base = loadConfig(home);
    expect(() => parseConfig({ ...base, allowedExtensionOrigins: ["https://evil.com"] })).toThrow();
    expect(() => parseConfig({ ...base, host: "0.0.0.0" })).toThrow();
  });
});

describe("resolveHome", () => {
  it("honors DEX_AI_HOME", () => {
    expect(resolveHome({ DEX_AI_HOME: "/x/y" })).toBe("/x/y");
  });
});
