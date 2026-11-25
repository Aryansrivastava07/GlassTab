import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareSpeechText, getAudioRecoveryDelay, isUsableVoiceBuffer, voiceAudioMatchesScript } from '../src/utils/voiceSpeech.js';

test('speech removes markup without speaking placeholders', () => {
  const text = prepareSpeechText('**Hello there!** Read [this guide](https://example.com). ```js\nconst x = 1;\n``` 😊');
  assert.equal(text, 'Hello there! Read this guide.');
});

test('headphone recovery waits for microphone release and profile transition', () => {
  assert.equal(getAudioRecoveryDelay(1000, 2200), 3800);
  assert.equal(getAudioRecoveryDelay(1000, 4200), 1800);
  assert.equal(getAudioRecoveryDelay(1000, 6200), 0);
  assert.equal(getAudioRecoveryDelay(0, 4200), 5000);
});

test('silent or truncated generated audio is rejected before playback', () => {
  const valid = { duration: 2, numberOfChannels: 1, getChannelData: () => new Float32Array(48000).fill(0.04) };
  const silent = { duration: 2, numberOfChannels: 1, getChannelData: () => new Float32Array(48000) };
  assert.equal(isUsableVoiceBuffer(valid, 'A clear spoken reply.'), true);
  assert.equal(isUsableVoiceBuffer(silent, 'A clear spoken reply.'), false);
  assert.equal(isUsableVoiceBuffer({ ...valid, duration: 0.1 }, 'A clear spoken reply.'), false);
});

test('voice quality check rejects a stuttered transcript', () => {
  const script = 'Why did the web developer quit? He got stuck in a CSS cascade.';
  assert.equal(voiceAudioMatchesScript(script, 'Why did the web developer quit? He got stuck in a CSS cascade.'), true);
  assert.equal(voiceAudioMatchesScript(script, 'Why why why why'), false);
  assert.equal(voiceAudioMatchesScript(script, ''), false);
});
