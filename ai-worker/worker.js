const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Cache-Control': 'no-store',
};
const features = new Set(['chat', 'attachment', 'web-search', 'gemini-image', 'voice', 'widget']);

function error(message, status) {
  return Response.json({ error: message }, { status, headers: cors });
}

async function googleUid(request, env) {
  const token = /^Bearer ([^ ]+)$/i.exec(request.headers.get('Authorization') || '')?.[1];
  if (!token || token.length > 16000) return null;
  let claims;
  try {
    claims = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
  } catch { return null; }
  if (claims?.aud !== env.FIREBASE_PROJECT_ID || claims.iss !== 'https://securetoken.google.com/' + env.FIREBASE_PROJECT_ID ||
      claims.firebase?.sign_in_provider !== 'google.com' || !claims.sub || !(claims.exp > Date.now() / 1000)) return null;
  // Google verifies the token before we use its subject for accounting.
  const lookup = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + encodeURIComponent(env.FIREBASE_WEB_API_KEY), {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: token }),
    signal: AbortSignal.timeout(10000),
  });
  if (!lookup.ok) {
    if (lookup.status === 400 || lookup.status === 401) return null;
    throw new Error('Google authentication unavailable');
  }
  const account = (await lookup.json()).users?.[0];
  return account && !account.disabled && account.localId === claims.sub && claims.auth_time >= Number(account.validSince || 0)
    ? account.localId : null;
}

function imageErrorCode(cause) {
  return Number(cause?.internalCode) || Number(String(cause?.message || '').match(/\b(30\d\d|50\d\d)\b/)?.[1]);
}

function imageFailure(cause) {
  const message = String(cause?.message || '');
  const code = imageErrorCode(cause);
  if (code === 3036) return error('The shared Cloudflare image allowance is used up. Try after midnight UTC.', 429);
  if (code === 3040) return error('The image model is busy. Try the same prompt again in a moment.', 503);
  if (code === 3007 || code === 3008) return error('Image generation timed out. Try again in a moment.', 504);
  if (/moderation|safety filter|unsafe content|content policy/i.test(message)) return error('The image model declined this prompt. Edit the description and try again.', 422);
  if ([5016, 5018, 3023, 3041, 5035].includes(code)) return error('Cloudflare denied this project access to the image model. Contact the GlassTab administrator.', 502);
  return error('The image model could not finish this request. You can retry your prompt.', 502);
}

async function renderImage(env, prompt) {
  const generate = () => env.AI.run('@cf/black-forest-labs/flux-1-schnell', { prompt, steps: 4 });
  let result;
  try { result = await generate(); }
  catch (cause) {
    if (imageErrorCode(cause) !== 3040) throw cause;
    await new Promise(resolve => setTimeout(resolve, 750));
    result = await generate();
  }
  if (!result?.image) throw new Error('Empty image response');
  let bytes;
  if (typeof Uint8Array.fromBase64 === 'function') bytes = Uint8Array.fromBase64(result.image);
  else {
    const binary = atob(result.image);
    bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  }
  return new Response(bytes, { headers: { ...cors, 'Content-Type': 'image/jpeg' } });
}

async function groqReply(env, data) {
  const model = 'openai/gpt-oss-20b';
  const messages = [];
  if (typeof data.instruction === 'string' && data.instruction.trim()) {
    messages.push({ role: 'system', content: data.instruction.slice(0, 800) });
  }
  if (Array.isArray(data.history)) {
    for (const item of data.history.slice(-6)) {
      if (['user', 'assistant'].includes(item?.role) && typeof item.text === 'string') {
        messages.push({ role: item.role, content: item.text.slice(-1200) });
      }
    }
  }
  messages.push({ role: 'user', content: data.prompt.trim() });
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST', headers: { Authorization: `Bearer ${env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, max_completion_tokens: 768, reasoning_effort: 'low' }),
    signal: AbortSignal.timeout(30000),
  });
  if (response.status === 429) return error('GroqCloud has reached its shared rate limit. Try again later.', 429);
  if (!response.ok) return error('GroqCloud could not serve this message. Please try again later.', 502);
  const reply = (await response.json()).choices?.[0]?.message?.content;
  if (!reply?.trim()) return error('GroqCloud returned an empty reply. Try asking a shorter question.', 502);
  return Response.json({ text: reply.trim(), modelUsed: model }, { headers: cors });
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const path = new URL(request.url).pathname;
    if (path !== '/usage' && path !== '/image' && path !== '/text') return error('Unknown AI action.', 404);
    if (request.method !== 'POST') return error('Use POST.', 405);
    let stage = 'auth';
    try {
      const uid = await googleUid(request, env);
      if (!uid) return error('Sign in with Google to use GlassTab AI.', 401);
      const data = await request.json().catch(() => null);
      const image = path === '/image';
      const text = path === '/text';
      const limited = image || text;
      const feature = image ? 'free-image' : text ? 'free-text' : data?.feature;
      if (text && !env.GROQ_API_KEY) return error('Shared GroqCloud chat is awaiting setup.', 503);
      if (text && (typeof data?.prompt !== 'string' || !data.prompt.trim() || data.prompt.length > 4000)) {
        return error('Enter a message of up to 4,000 characters.', 400);
      }
      if (image && (typeof data?.prompt !== 'string' || !data.prompt.trim() || data.prompt.length > 2048)) {
        return error('Enter an image prompt of up to 2,048 characters.', 400);
      }
      if (!limited && !features.has(feature)) return error('Unsupported AI feature.', 400);
      const limit = image ? Number(env.DAILY_IMAGE_LIMIT) : text ? Number(env.DAILY_TEXT_LIMIT) : Number.MAX_SAFE_INTEGER;
      if (!Number.isSafeInteger(limit) || limit < 1) return error('Daily quota is awaiting configuration.', 503);
      const day = new Date().toISOString().slice(0, 10);
      stage = 'usage';
      const failureFeature = image ? 'image-failure' : 'text-failure';
      const allowance = limited
        ? "? + COALESCE((SELECT attempts FROM ai_usage WHERE uid = ? AND day = ? AND feature = ?), 0)"
        : '?';
      const reservation = await env.USAGE.prepare(
        'INSERT INTO ai_usage (uid, day, feature, attempts) VALUES (?, ?, ?, 1) ' +
        `ON CONFLICT(uid, day, feature) DO UPDATE SET attempts = attempts + 1 WHERE attempts < ${allowance} RETURNING attempts`
      ).bind(uid, day, feature, limit, ...(limited ? [uid, day, failureFeature] : [])).first();
      if (!reservation) return error(`Your daily free ${image ? 'image' : 'text'} limit has been reached. It resets at midnight UTC.`, 429);
      if (!limited) return new Response(null, { status: 204, headers: cors });
      let result;
      try {
        result = image ? await renderImage(env, data.prompt.trim()) : await groqReply(env, data);
      } catch (cause) {
        result = image ? imageFailure(cause) : error('GroqCloud is temporarily unavailable. Try again later.', 502);
      }
      if (!result.ok) {
        await env.USAGE.prepare(
          'INSERT INTO ai_usage (uid, day, feature, attempts) VALUES (?, ?, ?, 1) ' +
          'ON CONFLICT(uid, day, feature) DO UPDATE SET attempts = attempts + 1 RETURNING attempts'
        ).bind(uid, day, failureFeature).first();
      }
      return result;
    } catch {
      return stage === 'auth'
        ? error('Google session verification is temporarily unavailable. Please try signing in again.', 503)
        : error('GlassTab could not record usage. Please try again in a moment.', 503);
    }
  },
};
