export function prepareSpeechText(text) {
  return String(text || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/\[(?:warm|cheerful|curious|excited|sad|whisper|dramatic|sarcastic)\]/gi, ' ')
    .replace(/\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*/gu, ' ')
    .replace(/[*_#>`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getAudioRecoveryDelay(releasedAt, now, settleMs = 5000) {
  const elapsed = releasedAt > 0 ? Math.max(0, now - releasedAt) : 0;
  return Math.max(0, settleMs - elapsed);
}

export function isUsableVoiceBuffer(buffer, script) {
  const words = String(script || '').trim().split(/\s+/).filter(Boolean).length;
  if (!buffer || !Number.isFinite(buffer.duration) || buffer.duration < Math.max(0.35, words * 0.08)) return false;
  if (!buffer.numberOfChannels || !buffer.getChannelData) return false;
  const samples = buffer.getChannelData(0);
  if (!samples.length) return false;
  const step = Math.max(1, Math.floor(samples.length / 4096));
  let peak = 0;
  let active = 0;
  let checked = 0;
  for (let index = 0; index < samples.length; index += step) {
    const level = Math.abs(samples[index]);
    peak = Math.max(peak, level);
    if (level > 0.003) active += 1;
    checked += 1;
  }
  return peak > 0.008 && active / checked > 0.01;
}

export function voiceAudioMatchesScript(script, transcript) {
  const words = (value) => String(value || '').toLowerCase().replace(/[’']/g, '')
    .match(/[\p{L}\p{N}]+/gu) || [];
  const expected = words(script);
  const heard = words(transcript);
  if (expected.length < 4) return Boolean(heard.length);
  if (heard.length < expected.length * 0.5 || heard.length > expected.length * 1.7 + 3) return false;
  const remaining = new Map();
  for (const word of expected) remaining.set(word, (remaining.get(word) || 0) + 1);
  let matched = 0;
  for (const word of heard) {
    const count = remaining.get(word) || 0;
    if (count) {
      matched += 1;
      remaining.set(word, count - 1);
    }
  }
  return matched / expected.length >= 0.55;
}
