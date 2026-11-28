import { auth } from '../firebase';

const endpoint = (import.meta.env.VITE_AI_WORKER_URL || '').replace(/\/$/, '');

export async function googleSession() {
  const user = auth.currentUser;
  if (!user) throw new Error('Sign in with Google to use AI.');
  const session = await user.getIdTokenResult();
  if (session.signInProvider !== 'google.com' || auth.currentUser !== user) throw new Error('Sign in with Google to use AI.');
  return { user, token: session.token };
}

async function request(path, payload) {
  const { user, token } = await googleSession();
  if (!endpoint) throw new Error('GlassTab AI is awaiting setup. Configure VITE_AI_WORKER_URL and rebuild GlassTab.');
  const response = await fetch(endpoint + path, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload), signal: AbortSignal.timeout(path === '/image' ? 120000 : path === '/text' ? 45000 : 15000),
  });
  if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || 'The AI usage service is unavailable.');
  if (auth.currentUser !== user) throw new Error('Your Google session changed. Please try again.');
  return response;
}

export const recordAiUsage = async feature => { await request('/usage', { feature }); };

export async function generateFreeImage(prompt) {
  const response = await request('/image', { prompt });
  return { image: await response.blob(), text: '', modelUsed: 'FLUX.1 Schnell' };
}

export async function sendFreeText(prompt, history, instruction) {
  const response = await request('/text', { prompt, history, instruction });
  return response.json();
}
