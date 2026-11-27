import { defineSecret } from 'firebase-functions/params';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

const geminiKey = defineSecret('GEMINI_API_KEY');

export const geminiLiveToken = onCall({ secrets: [geminiKey] }, async request => {
  if (!request.auth || request.auth.token.firebase?.sign_in_provider === 'anonymous') {
    throw new HttpsError('unauthenticated', 'Sign in to use shared voice.');
  }
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
