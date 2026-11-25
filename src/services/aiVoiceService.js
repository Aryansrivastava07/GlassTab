import { getProviderApiKey } from './aiProviderService';
import { prepareSpeechText } from '../utils/voiceSpeech';

const GROQ_AUDIO_URL = 'https://api.groq.com/openai/v1/audio';
export const AI_VOICES = [
  { id: 'autumn', label: 'Autumn' },
  { id: 'diana', label: 'Diana' },
  { id: 'hannah', label: 'Hannah' },
];

async function requestGroq(url, body, signal, isMultipart = false) {
  const key = getProviderApiKey('groqcloud').trim();
  if (!key) throw new Error('Add a GroqCloud API key to use AI voice.');
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) controller.abort();
  const timeout = setTimeout(abort, 45000);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        ...(!isMultipart ? { 'Content-Type': 'application/json' } : {}),
      },
      body: isMultipart ? body : JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      const detail = error?.error?.message || `API error ${response.status}`;
      if (response.status === 401) throw new Error('GroqCloud rejected the voice API key. Check the key in Voice setup.');
      if (response.status === 429) throw new Error(`GroqCloud voice limit reached: ${detail}`);
      throw new Error(`GroqCloud voice request failed: ${detail}`);
    }
    return response;
  } catch (error) {
    if (controller.signal.aborted && !signal?.aborted) throw new Error('The voice request timed out.');
    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}

export async function transcribeVoiceRecording(blob, signal, language = '') {
  const form = new FormData();
  const extension = /wav|wave/.test(blob.type) ? 'wav' : blob.type.includes('mp4') ? 'mp4' : blob.type.includes('ogg') ? 'ogg' : 'webm';
  form.append('file', blob, `voice.${extension}`);
  form.append('model', 'whisper-large-v3-turbo');
  form.append('response_format', 'json');
  if (language) form.append('language', language);
  const response = await requestGroq(`${GROQ_AUDIO_URL}/transcriptions`, form, signal, true);
  const data = await response.json();
  return String(data?.text || '').trim();
}

export async function getVoiceScript(reply, signal) {
  const clean = prepareSpeechText(reply);
  if (clean.length <= 195) return clean;

  let draft = clean.slice(0, 3000);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await requestGroq('https://api.groq.com/openai/v1/chat/completions', {
      model: 'openai/gpt-oss-20b',
      reasoning_effort: 'low',
      temperature: 0.2,
      max_completion_tokens: 768,
      messages: [
        { role: 'system', content: 'Rewrite the answer as one complete, natural English spoken response of at most 190 characters. Preserve the key answer. Return only the spoken words, with no markdown or stage directions.' },
        { role: 'user', content: draft },
      ],
    }, signal);
    const data = await response.json();
    draft = prepareSpeechText(data?.choices?.[0]?.message?.content || '') || clean.slice(0, 3000);
    if (draft && draft.length <= 195) return draft;
  }
  throw new Error('Could not prepare one stable voice clip for this reply. The full answer is available in chat.');
}

export async function generateVoicePhrase(phrase, voice = 'autumn', signal) {
  if (phrase.length > 200) throw new Error('Voice phrase exceeds the GroqCloud limit.');
  const response = await requestGroq(`${GROQ_AUDIO_URL}/speech`, {
    model: 'canopylabs/orpheus-v1-english',
    voice: AI_VOICES.some((item) => item.id === voice) ? voice : 'autumn',
    input: phrase,
    response_format: 'wav',
  }, signal);
  return response.blob();
}
