import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Load the browser module with its key dependency mocked; no network or real keys are used.
const source = (await readFile(new URL('../src/services/aiProviderService.js', import.meta.url), 'utf8'))
  .replace(/^import \{ getGeminiApiKey \} from '.\/aiWidgetService';/, 'const getGeminiApiKey = () => globalThis.mockGeminiKey;');
const guardedSource = source.replace("import { recordAiUsage } from './aiAccess';", 'const recordAiUsage = async feature => globalThis.usageGuard?.(feature);');
const service = await import(`data:text/javascript,${encodeURIComponent(guardedSource)}`);

const saved = new Map();
globalThis.localStorage = {
  getItem: (key) => saved.get(key) || null,
  setItem: (key, value) => saved.set(key, value),
  removeItem: (key) => saved.delete(key),
};
globalThis.mockGeminiKey = 'test-gemini-key';
for (const provider of ['openai', 'grok', 'claude', 'openrouter', 'groqcloud']) saved.set(`landing_ai_api_key_${provider}`, `test-${provider}-key`);

test('history is bounded and excludes error messages', () => {
  const history = Array.from({ length: 20 }, (_, i) => ({ role: i % 2 ? 'model' : 'user', text: 'x'.repeat(1000) }));
  history.push({ role: 'model', text: 'API error', isError: true });
  const result = service.getBoundedHistory(history);
  assert.ok(result.length <= 6);
  assert.ok(result.reduce((sum, item) => sum + item.text.length, 0) <= 3000);
  assert.equal(result[0].role, 'user');
  assert.ok(result.every((item) => !item.text.includes('API error')));
});

for (const provider of ['gemini', 'openai', 'grok', 'claude', 'openrouter', 'groqcloud']) {
  test(`${provider} sends one capped request and reads the reply`, async () => {
    const calls = [];
    globalThis.fetch = async (url, options) => {
      calls.push({ url, options, body: JSON.parse(options.body) });
      const payload = provider === 'gemini'
        ? { candidates: [{ content: { parts: [{ text: 'Hello' }] } }], usageMetadata: { totalTokenCount: 9 } }
        : provider === 'claude'
          ? { content: [{ type: 'text', text: 'Hello' }], usage: { input_tokens: 4, output_tokens: 5 } }
          : provider === 'openrouter' || provider === 'groqcloud'
            ? { choices: [{ message: { content: 'Hello' } }], usage: { total_tokens: 9 } }
          : { output: [{ content: [{ type: 'output_text', text: 'Hello' }] }], usage: { total_tokens: 9 } };
      return new Response(JSON.stringify(payload), { status: 200 });
    };
    const result = await service.sendAiMessage({ provider, userMessage: 'Hi', history: [], character: { systemPrompt: 'Be brief.' } });
    assert.equal(calls.length, 1);
    assert.equal(result.text, 'Hello');
    assert.equal(result.usage.total, 9);
    const body = calls[0].body;
    assert.equal(provider === 'gemini' ? body.generationConfig.maxOutputTokens : provider === 'claude' ? body.max_tokens : provider === 'openrouter' || provider === 'groqcloud' ? body.max_completion_tokens : body.max_output_tokens, 768);
    if (provider === 'openai' || provider === 'grok') assert.equal(body.reasoning.effort, 'none');
    assert.ok(calls[0].url.includes(provider === 'gemini' ? 'generativelanguage.googleapis.com' : provider === 'openai' ? 'api.openai.com' : provider === 'grok' ? 'api.x.ai' : provider === 'claude' ? 'api.anthropic.com' : provider === 'openrouter' ? 'openrouter.ai' : 'api.groq.com'));
  });
}

test('quota error stops after one request', async () => {
  let requests = 0;
  globalThis.fetch = async () => {
    requests += 1;
    return new Response(JSON.stringify({ error: { message: 'Quota exceeded' } }), { status: 429 });
  };
  await assert.rejects(service.sendAiMessage({ provider: 'gemini', userMessage: 'Hi' }), /Rate limit or quota reached/);
  assert.equal(requests, 1);
});

test('xAI invalid key error explains the Cursor mismatch', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ error: { message: 'Invalid API key' } }), { status: 401 });
  await assert.rejects(service.sendAiMessage({ provider: 'grok', userMessage: 'Hi' }), /Cursor key/);
});

test('voice turns request a concise spoken reply', async () => {
  let body;
  globalThis.fetch = async (_url, options) => {
    body = JSON.parse(options.body);
    return new Response(JSON.stringify({ choices: [{ message: { content: 'Hi there!' } }] }), { status: 200 });
  };
  await service.sendAiMessage({ provider: 'groqcloud', userMessage: 'Hi', voiceMode: true });
  assert.equal(body.max_completion_tokens, 768);
  assert.equal(body.reasoning_effort, 'low');
  assert.match(body.messages[0].content, /one or two natural short sentences/);
});

test('Groq GPT-OSS 120B retries once when reasoning consumes the voice reply', async () => {
  const bodies = [];
  globalThis.fetch = async (_url, options) => {
    bodies.push(JSON.parse(options.body));
    const content = bodies.length === 1 ? '' : 'Here is your answer.';
    return new Response(JSON.stringify({ choices: [{ finish_reason: bodies.length === 1 ? 'length' : 'stop', message: { content } }] }), { status: 200 });
  };
  const reply = await service.sendAiMessage({ provider: 'groqcloud', model: 'openai/gpt-oss-120b', userMessage: 'Hi', voiceMode: true });
  assert.equal(reply.text, 'Here is your answer.');
  assert.deepEqual(bodies.map((body) => body.max_completion_tokens), [768, 1024]);
  assert.ok(bodies.every((body) => body.reasoning_effort === 'low'));
});

test('image creation uses the dedicated model and returns downloadable bytes without search', async () => {
  globalThis.fetch = async (url, options) => {
    assert.ok(url.includes(service.IMAGE_MODEL));
    const body = JSON.parse(options.body);
    assert.equal(body.tools, undefined);
    assert.equal(body.contents.length, 1);
    assert.deepEqual(body.generationConfig.responseModalities, ['TEXT', 'IMAGE']);
    assert.equal(body.contents[0].parts[1].inlineData.data, 'AQI=');
    return Response.json({ candidates: [{ content: { parts: [
      { text: 'private', thought: true }, { inlineData: { mimeType: 'image/png', data: 'AQI=' } },
    ] } }] });
  };
  const response = await service.sendAiMessage({ userMessage: 'Draw it', useWebSearch: true, createImage: true,
    files: [new File([new Uint8Array([1, 2])], 'reference.png', { type: 'image/png' })] });
  assert.equal(response.text, '');
  assert.deepEqual([...new Uint8Array(await response.image.arrayBuffer())], [1, 2]);
});

test('Groq vision uses an image input model and includes attached text', async () => {
  globalThis.fetch = async (_, options) => {
    const body = JSON.parse(options.body);
    assert.equal(body.model, service.GROQ_VISION);
    assert.match(body.messages.at(-1).content[0].text, /sample/);
    assert.match(body.messages.at(-1).content[1].image_url.url, /^data:image\/png;base64,/);
    return Response.json({ choices: [{ message: { content: 'Description' } }] });
  };
  await service.sendAiMessage({ provider: 'groqcloud', userMessage: 'Describe', files: [
    new File(['sample'], 'context.txt'), new File(['abc'], 'photo.png', { type: 'image/png' }),
  ] });
});

test('unsupported image generation and uploads stop before sending', async () => {
  globalThis.fetch = () => assert.fail('Unexpected provider call');
  await assert.rejects(service.sendAiMessage({ provider: 'groqcloud', userMessage: 'Draw', createImage: true }), /no image generation API/);
  await assert.rejects(service.sendAiMessage({ userMessage: 'Read', files: [new File(['x'], 'unknown.exe')] }), /unsupported/);
  assert.throws(() => service.validateFiles(Array(4).fill({ size: 1 }), 'gemini', false), /three files/);
});

test('a denied usage check stops the provider request', async () => {
  globalThis.fetch = () => assert.fail('Provider contacted before login');
  globalThis.usageGuard = () => { throw new Error('Sign in with Google'); };
  try { await assert.rejects(service.sendAiMessage({ userMessage: 'Hi' }), /Sign in with Google/); }
  finally { delete globalThis.usageGuard; }
});
