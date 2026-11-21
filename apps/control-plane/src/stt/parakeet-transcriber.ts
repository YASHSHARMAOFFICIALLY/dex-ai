import { existsSync } from "node:fs";
import { join } from "node:path";
import { Worker } from "node:worker_threads";
import { SpeechUnavailableError, type Transcriber } from "./transcriber";

const MODEL_FILES = ["encoder.int8.onnx", "decoder.int8.onnx", "joiner.int8.onnx", "tokens.txt"];

type Reply = { id: number; text?: string; error?: string };
type Pending = { resolve: (text: string) => void; reject: (error: Error) => void };

export function missingModelFiles(modelDir: string): string[] {
  return MODEL_FILES.filter((name) => !existsSync(join(modelDir, name)));
}

export function createParakeetTranscriber(modelDir: string): Transcriber & { close(): void } {
  let worker: Worker | undefined;
  let nextId = 0;
  const pending = new Map<number, Pending>();

  function failAll(error: Error): void {
    for (const entry of pending.values()) entry.reject(error);
    pending.clear();
    worker = undefined;
  }

  function onReply(reply: Reply): void {
    const entry = pending.get(reply.id);
    pending.delete(reply.id);
    if (reply.error !== undefined) entry?.reject(new SpeechUnavailableError(reply.error));
    else entry?.resolve(reply.text ?? "");
  }

  function getWorker(): Worker {
    if (worker) return worker;
    const created = new Worker(new URL("./worker.ts", import.meta.url), { workerData: { modelDir } });
    created.unref();
    created.on("message", onReply);
    created.on("error", (error: Error) => failAll(error));
    created.on("exit", () => failAll(new Error("speech worker exited")));
    worker = created;
    return created;
  }

  function transcribe(samples: Float32Array): Promise<string> {
    const missing = missingModelFiles(modelDir);
    if (missing.length > 0) {
      const reason = `missing model files in ${modelDir}: ${missing.join(", ")}`;
      return Promise.reject(new SpeechUnavailableError(reason));
    }
    const id = nextId++;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      getWorker().postMessage({ id, samples });
    });
  }

  return { transcribe, close: () => void worker?.terminate() };
}
