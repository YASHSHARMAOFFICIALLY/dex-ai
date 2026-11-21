import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app";
import { parseConfig, type Config } from "../config";
import { openDatabase } from "../db/client";
import { runMigrations } from "../db/migrate";
import * as schema from "../db/schema";
import { startServer, type RunningServer } from "../server";
import { createHub } from "../stream/hub";
import { createParakeetTranscriber, missingModelFiles } from "./parakeet-transcriber";
import type { Transcriber } from "./transcriber";
import { parseWav, WavError } from "./wav";

const TOKEN = "t".repeat(40);

function makeWav(options: { rate?: number; channels?: number; bits?: number; samples?: number } = {}) {
  const { rate = 16000, channels = 1, bits = 16, samples = 160 } = options;
  const dataSize = samples * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(rate, 24);
  buffer.writeUInt32LE(rate * channels * (bits / 8), 28);
  buffer.writeUInt16LE(channels * (bits / 8), 32);
  buffer.writeUInt16LE(bits, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);
  buffer.writeInt16LE(16384, 44);
  return buffer;
}

describe("parseWav", () => {
  it("accepts 16 kHz mono 16-bit PCM and scales samples", () => {
    const samples = parseWav(makeWav());
    expect(samples).toHaveLength(160);
    expect(samples[0]).toBeCloseTo(0.5);
  });

  it("rejects a bad header", () => {
    expect(() => parseWav(Buffer.from("not a wav file at all"))).toThrow(WavError);
  });

  it.each([
    ["sample rate", { rate: 44100 }],
    ["channels", { channels: 2 }],
    ["bit depth", { bits: 8 }],
  ])("rejects wrong %s", (_name, options) => {
    expect(() => parseWav(makeWav(options))).toThrow(WavError);
  });

  it("rejects a truncated data chunk", () => {
    expect(() => parseWav(makeWav().subarray(0, 100))).toThrow(WavError);
  });
});

describe("parakeet availability", () => {
  it("reports missing model files with a typed error", async () => {
    const transcriber = createParakeetTranscriber("/nonexistent/dex-model");
    await expect(transcriber.transcribe(new Float32Array(10))).rejects.toMatchObject({
      name: "SpeechUnavailableError",
    });
    expect(missingModelFiles("/nonexistent/dex-model")).toHaveLength(4);
  });
});

let dir: string;
let config: Config;
let running: RunningServer;
let opened: ReturnType<typeof openDatabase>;

async function freePort(): Promise<number> {
  return new Promise((resolve) => {
    const probe = createServer();
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      const port = typeof address === "object" && address ? address.port : 0;
      probe.close(() => resolve(port));
    });
  });
}

async function boot(transcriber?: Transcriber): Promise<void> {
  const hub = createHub();
  const deps = { config, db: opened.db, sqlite: opened.sqlite, hub, transcriber };
  running = await startServer(createApp(deps), config, hub);
}

describe("stt route", () => {
beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), "dex-stt-"));
  config = parseConfig({
    token: TOKEN,
    host: "127.0.0.1",
    port: await freePort(),
    dataDir: dir,
    allowedExtensionOrigins: [],
    uiOrigin: "http://127.0.0.1:5173",
    confidenceThreshold: 0.7,
    parakeetModelDir: join(dir, "models"),
  });
  opened = openDatabase(join(dir, "dex-ai.sqlite"));
  await runMigrations(opened.db, opened.sqlite);
});

afterEach(async () => {
  await running.close();
  opened.close();
  rmSync(dir, { recursive: true, force: true });
});

function post(body: Uint8Array<ArrayBuffer>): Promise<Response> {
  return fetch(`http://127.0.0.1:${config.port}/api/stt/transcribe`, {
    method: "POST",
    headers: { authorization: `Bearer ${TOKEN}`, "content-type": "audio/wav" },
    body: new Blob([body]),
  });
}

async function rowCounts(): Promise<number[]> {
  const tables = [schema.sessions, schema.events, schema.teachingDrafts, schema.traces];
  const counts = await Promise.all(tables.map((table) => opened.db.select().from(table)));
  return counts.map((rows) => rows.length);
}

  it("returns only the transcript from the transcriber and writes nothing", async () => {
    const received: number[] = [];
    await boot({
      transcribe: async (samples) => {
        received.push(samples.length);
        return "hello world";
      },
    });
    const before = await rowCounts();
    const res = await post(new Uint8Array(makeWav({ samples: 320 })));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ text: "hello world" });
    expect(received).toEqual([320]);
    expect(await rowCounts()).toEqual(before);
  });

  it("rejects an invalid header and a wrong sample rate with 400", async () => {
    await boot({ transcribe: async () => "x" });
    const garbage = await post(new Uint8Array(Buffer.from("garbage")));
    expect(garbage.status).toBe(400);
    const wrongRate = await post(new Uint8Array(makeWav({ rate: 8000 })));
    expect(wrongRate.status).toBe(400);
    expect((await wrongRate.json()).fields.audio[0]).toContain("16000");
  });

  it("rejects an oversized body with 413", async () => {
    await boot({ transcribe: async () => "x" });
    const res = await post(new Uint8Array(10 * 1024 * 1024 + 1));
    expect(res.status).toBe(413);
  });

  it("returns 503 speech_unavailable when the model is missing", async () => {
    await boot();
    const res = await post(new Uint8Array(makeWav()));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toBe("speech_unavailable");
    expect(body.reason).toContain("encoder.int8.onnx");
  });
});

const realModelDir = process.env.DEX_PARAKEET_DIR ?? "";
const modelPresent = realModelDir !== "" && missingModelFiles(realModelDir).length === 0;
const skipReason = "skipped: set DEX_PARAKEET_DIR to a Parakeet TDT v3 int8 model directory";

describe("real parakeet", () => {
  it.skipIf(!modelPresent)(`transcribes a silent sample without error (${skipReason})`, async () => {
    const transcriber = createParakeetTranscriber(realModelDir);
    const text = await transcriber.transcribe(new Float32Array(16000));
    expect(typeof text).toBe("string");
    transcriber.close();
  });
});
