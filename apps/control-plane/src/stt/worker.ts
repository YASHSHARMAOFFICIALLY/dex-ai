import { createRequire } from "node:module";
import { join } from "node:path";
import { parentPort, workerData } from "node:worker_threads";

type Recognizer = {
  createStream(): { acceptWaveform(wave: { samples: Float32Array; sampleRate: number }): void };
  decode(stream: unknown): void;
  getResult(stream: unknown): { text: string };
};
type Request = { id: number; samples: Float32Array };

const port = parentPort;
if (!port) throw new Error("worker.ts must run in a worker thread");
const modelDir: string = workerData.modelDir;
let recognizer: Recognizer | undefined;

function createRecognizer(): Recognizer {
  const require = createRequire(import.meta.url);
  const sherpa = require("sherpa-onnx-node");
  return new sherpa.OfflineRecognizer({
    featConfig: { sampleRate: 16000, featureDim: 80 },
    modelConfig: {
      transducer: {
        encoder: join(modelDir, "encoder.int8.onnx"),
        decoder: join(modelDir, "decoder.int8.onnx"),
        joiner: join(modelDir, "joiner.int8.onnx"),
      },
      tokens: join(modelDir, "tokens.txt"),
      modelType: "nemo_transducer",
      numThreads: 2,
      provider: "cpu",
      debug: 0,
    },
  });
}

function recognize(samples: Float32Array): string {
  recognizer ??= createRecognizer();
  const stream = recognizer.createStream();
  stream.acceptWaveform({ sampleRate: 16000, samples });
  recognizer.decode(stream);
  return recognizer.getResult(stream).text.trim();
}

port.on("message", (request: Request) => {
  try {
    port.postMessage({ id: request.id, text: recognize(request.samples) });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    port.postMessage({ id: request.id, error: message });
  }
});
