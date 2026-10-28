const SAMPLE_RATE = 16000;
const FRAME = SAMPLE_RATE / 50;
const VOICE_RMS = 0.02;
const MIN_LOUD_FRAMES = 12;
const MIN_ZCR_SPREAD = 0.02;
const MAX_ZCR_MEAN = 0.35;

export function wavHasVoice(buf: Buffer): boolean {
  let at = 12;
  let start = 44;
  let size = buf.length - 44;
  while (at + 8 <= buf.length) {
    const id = buf.toString("ascii", at, at + 4);
    const len = buf.readUInt32LE(at + 4);
    if (id === "data") {
      start = at + 8;
      size = Math.min(len, buf.length - start);
      break;
    }
    at += 8 + len + (len % 2);
  }
  if (size <= 0) return false;

  const samples = Math.floor(size / 2);
  let loud = 0;
  let frames = 0;
  const zcrs: number[] = [];

  for (let i = 0; i + FRAME <= samples; i += FRAME) {
    let sum = 0;
    let crossings = 0;
    let prev = buf.readInt16LE(start + i * 2);
    for (let j = 0; j < FRAME; j++) {
      const raw = buf.readInt16LE(start + (i + j) * 2);
      const v = raw / 32768;
      sum += v * v;
      if ((raw >= 0) !== (prev >= 0)) crossings++;
      prev = raw;
    }
    frames++;
    if (Math.sqrt(sum / FRAME) > VOICE_RMS) {
      loud++;
      zcrs.push(crossings / FRAME);
    }
  }
  if (frames === 0 || loud < MIN_LOUD_FRAMES) return false;

  const mean = zcrs.reduce((a, b) => a + b, 0) / zcrs.length;
  const spread = Math.sqrt(zcrs.reduce((a, z) => a + (z - mean) ** 2, 0) / zcrs.length);
  return spread >= MIN_ZCR_SPREAD && mean <= MAX_ZCR_MEAN;
}
