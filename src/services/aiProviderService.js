import { getGeminiApiKey } from './aiWidgetService';

import { recordAiUsage } from './aiAccess';

export const AI_PROVIDERS = {
  gemini: { label: 'Gemini', model: 'gemini-3.5-flash-lite', keyUrl: 'https://aistudio.google.com/app/apikey' },
  openai: { label: 'OpenAI', model: 'gpt-6-luna', keyUrl: 'https://platform.openai.com/api-keys' },
  grok: { label: 'Grok (xAI)', model: 'grok-4.3', keyUrl: 'https://console.x.ai/' },
  claude: { label: 'Claude', model: 'claude-haiku-5-5', keyUrl: 'https://platform.claude.com/settings/keys' },
  openrouter: { label: 'OpenRouter (free)', model: 'openrouter/free', keyUrl: 'https://openrouter.ai/settings/keys' },
  groqcloud: { label: 'GroqCloud', model: 'openai/gpt-oss-20b', keyUrl: 'https://console.groq.com/keys' },
};

const SETTINGS_KEY = 'landing_ai_provider_settings_v1';
const providerKeyName = (provider) => `landing_ai_api_key_${provider}`;

export const getAiSettings = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    const provider = AI_PROVIDERS[saved.provider] ? saved.provider : 'gemini';
    return { provider, models: saved.models && typeof saved.models === 'object' ? saved.models : {} };
  } catch {
    return { provider: 'gemini', models: {} };
  }
};

export const saveAiSettings = (settings) => {
  const next = { ...getAiSettings(), ...settings };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  return next;
};

export const getProviderApiKey = (provider) => {
  if (provider === 'gemini') return getGeminiApiKey();
  if (!AI_PROVIDERS[provider]) return '';
  try { return localStorage.getItem(providerKeyName(provider)) || ''; } catch { return ''; }
};

export const saveProviderApiKey = (provider, key) => {
  if (!AI_PROVIDERS[provider] || provider === 'gemini') return;
  const clean = (key || '').trim();
  if (clean) localStorage.setItem(providerKeyName(provider), clean);
  else localStorage.removeItem(providerKeyName(provider));
  window.dispatchEvent(new CustomEvent('landing_ai_provider_key_changed', { detail: { provider } }));
};

// The full thread stays local. Only recent text is sent to the model.
export const getBoundedHistory = (history) => {
  const recent = history.filter((msg) => !msg.isError && typeof msg.text === 'string').slice(-6);
  let remaining = 3000;
  const bounded = [];
  for (let i = recent.length - 1; i >= 0 && remaining > 0; i -= 1) {
    const text = recent[i].text.slice(-Math.min(remaining, 1200));
    remaining -= text.length;
    bounded.unshift({ role: recent[i].role === 'user' ? 'user' : 'assistant', text });
  }
  while (bounded[0]?.role === 'assistant') bounded.shift();
  return bounded;
};

const fetchWithTimeout = async (url, options, timeout = 30000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try { return await fetch(url, { ...options, signal: controller.signal }); }
  catch (error) {
    if (error.name === 'AbortError') throw new Error(`AI request timed out after ${timeout / 1000} seconds.`);
    throw error;
  } finally { clearTimeout(timer); }
};

const readJsonResponse = async (res, provider) => {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = data?.error?.message || data?.message || `API error ${res.status}`;
    if (provider === 'grok' && res.status === 401) {
      throw new Error('xAI rejected this key. Gennie needs an xAI API key from console.x.ai; a Cursor key or Grok app subscription cannot authenticate to api.x.ai.');
    }
    if (provider === 'grok' && res.status === 403) {
      throw new Error(`This xAI key or team cannot access the selected model. Check permissions and credits in console.x.ai. ${message}`);
    }
    if (res.status === 429) throw new Error(`Rate limit or quota reached: ${message}`);
    throw new Error(message);
  }
  return data;
};

const responseText = (data) => {
  if (typeof data?.output_text === 'string') return data.output_text;
  return (data?.output || []).flatMap((item) => item.content || [])
    .filter((part) => part.type === 'output_text').map((part) => part.text || '').join('\n');
};

export const IMAGE_MODEL = 'gemini-3.1-flash-image';
export const GROQ_VISION = 'qwen/qwen3.8-27b';
export const imageModeNotice = (provider) => provider === 'gemini'
  ? 'Gemini image generation requires billing. A 1K image costs about $0.067, plus input and text tokens.'
  : provider === 'groqcloud' ? 'GroqCloud can analyze uploaded images. It has no image generation API.'
  : 'Choose Gemini in provider settings to create an image. Billing is required.';

const imageTypes = ['image/png', 'image/jpeg', 'image/webp'];
const isTextFile = (file) => /\.(txt|md|csv|json)$/i.test(file.name);
export function validateFiles(files, provider, createImage) {
  if (createImage && provider !== 'gemini') throw new Error(imageModeNotice(provider));
  if (files.length > 3 || files.reduce((size, file) => size + file.size, 0) > 3 * 1024 * 1024) {
    throw new Error('Choose up to three files totaling 3 MB or less.');
  }
  for (const file of files) {
    if (isTextFile(file)) {
      if (file.size > 32000) throw new Error('Text attachments must be 32 KB or smaller.');
    } else if (!(imageTypes.includes(file.type) && ['gemini', 'groqcloud'].includes(provider)) &&
      !(file.type === 'application/pdf' && provider === 'gemini' && !createImage)) {
      throw new Error(`${file.name} is unsupported for this action. Attach TXT, MD, CSV or JSON, an image with Gemini or GroqCloud, or a PDF in Gemini chat.`);
    }
  }
}

async function encodeFile(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return { mimeType: file.type, data: btoa(binary) };
}

export const sendAiMessage = async ({ provider = 'gemini', model, character, userMessage, history = [], useWebSearch = false, voiceMode = false, files = [], createImage = false }) => {
  const selected = AI_PROVIDERS[provider];
  if (!selected) throw new Error('Unsupported AI provider.');
  validateFiles(files, provider, createImage);
  const key = getProviderApiKey(provider).trim();
  if (!key) throw new Error('MISSING_API_KEY');
  const binary = await Promise.all(files.filter(file => !isTextFile(file)).map(encodeFile));
  const documents = await Promise.all(files.filter(isTextFile).map(async file => `Attachment ${file.name}\n${await file.text()}`));
  const modelName = createImage ? IMAGE_MODEL : provider === 'groqcloud' && binary.length ? GROQ_VISION : (model || selected.model).trim();
  if (!/^[a-zA-Z0-9._:/-]+$/.test(modelName)) throw new Error('Invalid model ID.');
  const isGroqGptOss = provider === 'groqcloud' && /^openai\/gpt-oss-(20b|120b)$/.test(modelName);
  const messages = [...getBoundedHistory(history), { role: 'user', text: [userMessage.trim(), ...documents].join('\n\n') }];
  const system = `${(character?.systemPrompt || '').slice(0, 800)}${voiceMode ? '\nFor voice chat, reply in English in one or two natural short sentences, under 180 characters. Do not use markdown, emoji, links, code, or stage directions.' : ''}`;
  const maxOutputTokens = voiceMode ? (isGroqGptOss ? 768 : 220) : 768;
  let data;
  let reply;
  let usage;
  let groundingChunks = null;

  await recordAiUsage(createImage ? 'gemini-image' : provider === 'gemini' && useWebSearch ? 'web-search' : files.length ? 'attachment' : 'chat');
  if (provider === 'gemini') {
    const body = {
      contents: messages.map((msg) => ({ role: msg.role === 'assistant' ? 'model' : 'user', parts: [{ text: msg.text }] })),
      generationConfig: { maxOutputTokens, temperature: 0.6 },
    };
    if (modelName === 'gemini-3.5-flash-lite') body.generationConfig.thinkingConfig = { thinkingLevel: 'MINIMAL' };
    if (system) body.systemInstruction = { parts: [{ text: system }] };
    body.contents.at(-1).parts.push(...binary.map(inlineData => ({ inlineData })));
    if (createImage) {
      body.contents = body.contents.slice(-1);
      delete body.systemInstruction;
      body.generationConfig = { responseModalities: ['TEXT', 'IMAGE'], imageConfig: { imageSize: '1K' } };
    }
    if (!createImage && useWebSearch) body.tools = [{ google_search: {} }];
    const res = await fetchWithTimeout(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify(body),
    }, createImage ? 120000 : 30000);
    data = await readJsonResponse(res, provider);
    reply = (data?.candidates?.[0]?.content?.parts || []).map((part) => part.text || '').join('');
    if (createImage) {
      const parts = (data.candidates?.[0]?.content?.parts || []).filter(part => !part.thought);
      const image = parts.find(part => imageTypes.includes(part.inlineData?.mimeType) && part.inlineData.data)?.inlineData;
      const caption = parts.map(part => part.text).filter(Boolean).join('\n');
      if (!image) throw new Error(caption || `Gemini returned no image (${data.promptFeedback?.blockReason || data.candidates?.[0]?.finishReason || 'empty response'}).`);
      const bytes = Uint8Array.from(atob(image.data), c => c.charCodeAt(0));
      return { text: caption, modelUsed: modelName, image: new Blob([bytes], { type: image.mimeType }) };
    }
    groundingChunks = data?.candidates?.[0]?.groundingMetadata?.groundingChunks || null;
    usage = { input: data?.usageMetadata?.promptTokenCount, output: data?.usageMetadata?.candidatesTokenCount, total: data?.usageMetadata?.totalTokenCount };
  } else if (provider === 'claude') {
    const res = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2026-10-21', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model: modelName, max_tokens: maxOutputTokens, system, messages: messages.map((msg) => ({ role: msg.role, content: msg.text })) }),
    });
    data = await readJsonResponse(res, provider);
    reply = (data?.content || []).filter((part) => part.type === 'text').map((part) => part.text).join('\n');
    usage = { input: data?.usage?.input_tokens, output: data?.usage?.output_tokens, total: (data?.usage?.input_tokens || 0) + (data?.usage?.output_tokens || 0) };
  } else if (provider === 'openrouter' || provider === 'groqcloud') {
    const endpoint = provider === 'openrouter' ? 'https://openrouter.ai/api/v1/chat/completions' : 'https://api.groq.com/openai/v1/chat/completions';
    const body = {
      model: modelName,
      messages: [...(system ? [{ role: 'system', content: system }] : []), ...messages.map((msg) => ({ role: msg.role, content: msg.text }))],
      max_completion_tokens: maxOutputTokens,
    };
    if (binary.length) {
      const last = body.messages.at(-1);
      last.content = [{ type: 'text', text: last.content }, ...binary.map(({ mimeType, data }) => ({
        type: 'image_url', image_url: { url: `data:${mimeType};base64,${data}` },
      }))];
    }
    if (isGroqGptOss) body.reasoning_effort = 'low';
    const requestCompletion = async () => {
      const res = await fetchWithTimeout(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify(body),
      });
      return readJsonResponse(res, provider);
    };
    data = await requestCompletion();
    reply = data?.choices?.[0]?.message?.content;
    if (isGroqGptOss && !reply?.trim()) {
      body.max_completion_tokens = 1024;
      data = await requestCompletion();
      reply = data?.choices?.[0]?.message?.content;
    }
    usage = { input: data?.usage?.prompt_tokens, output: data?.usage?.completion_tokens, total: data?.usage?.total_tokens };
  } else {
    const endpoint = provider === 'openai' ? 'https://api.openai.com/v1/responses' : 'https://api.x.ai/v1/responses';
    const body = { model: modelName, instructions: system, input: messages.map((msg) => ({ role: msg.role, content: msg.text })), max_output_tokens: maxOutputTokens, store: false };
    if (provider === 'openai' && modelName === 'gpt-6-luna') body.reasoning = { effort: 'none' };
    if (provider === 'grok' && modelName === 'grok-4.3') body.reasoning = { effort: 'none' };
    if (provider === 'grok' && modelName === 'grok-4.7') body.reasoning = { effort: 'low' };
    const res = await fetchWithTimeout(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
    });
    data = await readJsonResponse(res, provider);
    reply = responseText(data);
    usage = { input: data?.usage?.input_tokens, output: data?.usage?.output_tokens, total: data?.usage?.total_tokens };
  }

  if (!reply?.trim()) throw new Error(`${selected.label} returned no text${isGroqGptOss ? ' after a retry. Try a shorter question or another model.' : '. Try another model.'}`);
  return { text: reply.trim(), modelUsed: modelName, groundingChunks, usage };
};
