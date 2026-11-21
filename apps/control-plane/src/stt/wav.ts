export const SAMPLE_RATE = 16000;
export const MAX_WAV_BYTES = 10 * 1024 * 1024;

export class WavError extends Error {}

type Format = { audioFormat: number; channels: number; sampleRate: number; bits: number };

function readFormat(view: DataView, offset: number): Format {
  return {
    audioFormat: view.getUint16(offset, true),
    channels: view.getUint16(offset + 2, true),
    sampleRate: view.getUint32(offset + 4, true),
    bits: view.getUint16(offset + 14, true),
  };
}

function tag(bytes: Uint8Array, offset: number): string {
  return String.fromCharCode(...bytes.subarray(offset, offset + 4));
}

function checkFormat(format: Format): void {
  if (format.audioFormat !== 1) throw new WavError("WAV must be PCM");
  if (format.channels !== 1) throw new WavError("WAV must be mono");
  if (format.sampleRate !== SAMPLE_RATE) throw new WavError("WAV sample rate must be 16000 Hz");
  if (format.bits !== 16) throw new WavError("WAV must be 16-bit");
}

function toFloat(bytes: Uint8Array, start: number, length: number): Float32Array {
  const view = new DataView(bytes.buffer, bytes.byteOffset + start, length);
  const samples = new Float32Array(length / 2);
  for (let i = 0; i < samples.length; i++) {
    samples[i] = view.getInt16(i * 2, true) / 32768;
  }
  return samples;
}

export function parseWav(bytes: Uint8Array): Float32Array {
  if (bytes.length < 12 || tag(bytes, 0) !== "RIFF" || tag(bytes, 8) !== "WAVE") {
    throw new WavError("Not a RIFF/WAVE file");
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.length);
  let format: Format | undefined;
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const id = tag(bytes, offset);
    const size = view.getUint32(offset + 4, true);
    const body = offset + 8;
    if (id === "fmt " && body + 16 <= bytes.length) {
      format = readFormat(view, body);
    }
    if (id === "data") {
      if (!format) throw new WavError("WAV data chunk before fmt chunk");
      checkFormat(format);
      if (body + size > bytes.length) throw new WavError("WAV data chunk is truncated");
      if (size === 0) throw new WavError("WAV has no audio");
      return toFloat(bytes, body, size - (size % 2));
    }
    offset = body + size + (size % 2);
  }
  throw new WavError(format ? "WAV has no data chunk" : "WAV has no fmt chunk");
}
