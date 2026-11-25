import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as speech from '../src/utils/voiceSpeech.js';

const source = (await readFile(new URL('../src/services/aiVoiceService.js', import.meta.url), 'utf8'))
  .replace("import { getProviderApiKey } from './aiProviderService';", 'const getProviderApiKey = () => "test-groq-key";')
  .replace("import { prepareSpeechText } from '../utils/voiceSpeech';", 'const { prepareSpeechText } = globalThis.mockSpeech;');
globalThis.mockSpeech = speech;
const voice = await import(`data:text/javascript,${encodeURIComponent(source)}`);

test('short voice replies stay in one clip without another API call', async () => {
  globalThis.fetch = () => { throw new Error('Unexpected network request'); };
  assert.equal(await voice.getVoiceScript('Hello! How are you?'), 'Hello! How are you?');
});

test('long replies are condensed to one complete voice script', async () => {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, body: JSON.parse(options.body) });
    const content = calls.length === 1 ? 'Still too long. '.repeat(20) : 'Here is the short answer, spoken in one steady voice.';
    return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });
  };
  const script = await voice.getVoiceScript('A detailed answer. '.repeat(30));
  assert.equal(script, 'Here is the short answer, spoken in one steady voice.');
  assert.equal(calls.length, 2);
  assert.ok(calls.every((call) => call.url.endsWith('/chat/completions')));
  assert.ok(script.length <= 200);
});

test('transcription sends recorded audio to Groq Whisper', async () => {
  let call;
  globalThis.fetch = async (url, options) => {
    call = { url, options };
    return new Response(JSON.stringify({ text: 'Hello Ginnie' }), { status: 200 });
  };
  const result = await voice.transcribeVoiceRecording(new Blob(['audio'], { type: 'audio/webm' }));
  assert.equal(result, 'Hello Ginnie');
  assert.equal(call.url, 'https://api.groq.com/openai/v1/audio/transcriptions');
  assert.equal(call.options.body.get('model'), 'whisper-large-v3-turbo');
  assert.equal(call.options.headers.Authorization, 'Bearer test-groq-key');
  assert.equal(call.options.headers['Content-Type'], undefined);
});

test('generated WAV can be transcribed for voice quality checking', async () => {
  let form;
  globalThis.fetch = async (_url, options) => {
    form = options.body;
    return new Response(JSON.stringify({ text: 'Clear speech' }), { status: 200 });
  };
  const result = await voice.transcribeVoiceRecording(new Blob(['wav'], { type: 'audio/wav' }), undefined, 'en');
  assert.equal(result, 'Clear speech');
  assert.equal(form.get('file').name, 'voice.wav');
  assert.equal(form.get('language'), 'en');
});

test('speech sends plain text to a female Orpheus voice', async () => {
  let call;
  globalThis.fetch = async (url, options) => {
    call = { url, options };
    return new Response(new Blob(['wav'], { type: 'audio/wav' }), { status: 200 });
  };
  const result = await voice.generateVoicePhrase('That sounds wonderful!', 'hannah');
  assert.equal(result.type, 'audio/wav');
  assert.equal(call.url, 'https://api.groq.com/openai/v1/audio/speech');
  assert.deepEqual(JSON.parse(call.options.body), {
    model: 'canopylabs/orpheus-v1-english',
    voice: 'hannah',
    input: 'That sounds wonderful!',
    response_format: 'wav',
  });
});
