export type Transcriber = {
  transcribe(samples: Float32Array): Promise<string>;
};

export class SpeechUnavailableError extends Error {
  readonly reason: string;

  constructor(reason: string) {
    super(`speech unavailable: ${reason}`);
    this.name = "SpeechUnavailableError";
    this.reason = reason;
  }
}
