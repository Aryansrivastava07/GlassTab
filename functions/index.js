import { defineSecret, defineString } from 'firebase-functions/params';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

const geminiKey = defineSecret('GEMINI_API_KEY');

const usageWorker = defineString('AI_WORKER_URL');

export const geminiLiveToken = onCall({ secrets: [geminiKey] }, async request => {
  if (request.auth?.token.firebase?.sign_in_provider !== 'google.com') {
    throw new HttpsError('unauthenticated', 'Sign in with Google to use shared voice.');
  }
  const tracked = await fetch(usageWorker.value().replace(/\/$/, '') + '/usage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: request.rawRequest.headers.authorization },
    body: JSON.stringify({ feature: 'voice' }),
    signal: AbortSignal.timeout(15000),
  });
  if (!tracked.ok) throw new HttpsError('unavailable', 'Voice usage could not be recorded.');
  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/auth_tokens', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiKey.value() },
    body: JSON.stringify({
      uses: 1,
      newSessionExpireTime: new Date(Date.now() + 60000).toISOString(),
      expireTime: new Date(Date.now() + 30 * 60000).toISOString(),
      bidiGenerateContentSetup: { model: 'models/gemini-3.8-live' },
      fieldMask: 'model',
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (response.status === 429) throw new HttpsError('resource-exhausted', 'Gemini quota reached.');
  if (!response.ok) throw new HttpsError('unavailable', 'Gemini could not issue a voice session.');
  const { name } = await response.json();
  if (!name) throw new HttpsError('internal', 'Gemini returned an empty token.');
  return { token: name };
});
