import { randomBytes } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { z } from "zod";

const HOST = "127.0.0.1";
const PORT = 4823;

const configSchema = z.object({
  token: z.string().min(32),
  host: z.literal(HOST),
  port: z.number().int().min(1).max(65535),
  dataDir: z.string().min(1),
  allowedExtensionOrigins: z.array(z.string().regex(/^(chrome|moz)-extension:\/\/[^/\s]+$/)),
  uiOrigin: z.string().url(),
  confidenceThreshold: z.number().min(0).max(1),
  parakeetModelDir: z.string().min(1),
});

export type Config = z.infer<typeof configSchema>;

export function resolveHome(env: NodeJS.ProcessEnv = process.env): string {
  return env.DEX_AI_HOME ?? join(homedir(), ".config", "dex-ai");
}

export function parseConfig(raw: unknown): Config {
  return configSchema.parse(raw);
}

function createDefaultConfig(home: string): Config {
  return {
    token: randomBytes(32).toString("hex"),
    host: HOST,
    port: PORT,
    dataDir: join(home, "data"),
    allowedExtensionOrigins: [],
    uiOrigin: `http://${HOST}:${PORT}`,
    confidenceThreshold: 0.7,
    parakeetModelDir: join(home, "models", "parakeet-tdt-0.6b-v3-int8"),
  };
}

function writeConfigFile(path: string, config: Config): void {
  writeFileSync(path, JSON.stringify(config, null, 2) + "\n", { mode: 0o600 });
  chmodSync(path, 0o600);
}

export function loadConfig(home: string = resolveHome()): Config {
  const path = join(home, "config.json");
  if (existsSync(path)) {
    const stored = JSON.parse(readFileSync(path, "utf8"));
    return parseConfig(stored);
  }
  mkdirSync(home, { recursive: true, mode: 0o700 });
  const config = createDefaultConfig(home);
  writeConfigFile(path, config);
  return config;
}
