import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import worker from '../ai-worker/worker.js';

const project = 'test-project';
function token(uid, changes = {}) {
  const now = Math.floor(Date.now() / 1000);
  return 'test.' + Buffer.from(JSON.stringify({
    sub: uid, aud: project, iss: 'https://securetoken.google.com/' + project,
    firebase: { sign_in_provider: 'google.com' }, exp: now + 600, auth_time: now, ...changes,
  })).toString('base64url') + '.test';
}

test('verified Google identity owns usage and image reservations', async t => {
  const db = new DatabaseSync(':memory:');
  t.after(() => db.close());
  db.exec(readFileSync(new URL('../ai-worker/schema.sql', import.meta.url), 'utf8'));
  let images = 0;
  const env = {
    FIREBASE_PROJECT_ID: project, DAILY_IMAGE_LIMIT: '3',
    USAGE: { prepare: sql => ({ bind: (...args) => ({ first: () => db.prepare(sql).get(...args) }) }) },
    AI: { run: async () => { images++; return { image: btoa('JPEG') }; } },
  };
  const valid = new Map([['one', token('one')], ['two', token('two')]]);
  let groqStatus = 429;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (url === 'https://api.groq.com/openai/v1/chat/completions') {
      assert.equal(options.headers.Authorization, 'Bearer test-only');
      assert.equal(JSON.parse(options.body).model, 'openai/gpt-oss-20b');
      return Response.json({ choices: [{ message: { content: 'Hello' } }] }, { status: groqStatus });
    }
    const uid = [...valid].find(([, value]) => value === JSON.parse(options.body).idToken)?.[0];
    return uid ? Response.json({ users: [{ localId: uid }] }) : new Response(null, { status: 400 });
  });
  function send(path, bearer, body) {
    return worker.fetch(new Request('https://example.test/' + path, {
      method: 'POST', headers: bearer ? { Authorization: 'Bearer ' + bearer } : {}, body: JSON.stringify(body),
    }), env);
  }
  for (const invalid of [null, token('forged'), token('one', { exp: 0 }), token('one', { aud: 'other-project' }),
    token('one', { firebase: { sign_in_provider: 'password' } })]) {
    assert.equal((await send('image', invalid, { prompt: 'cat' })).status, 401);
  }
  assert.equal(images, 0);
  assert.equal((await send('image', valid.get('one'), { prompt: ' ' })).status, 400);
  for (const feature of ['chat', 'web-search', 'attachment', 'widget', 'voice', 'gemini-image']) {
    assert.equal((await send('usage', valid.get('one'), { uid: 'two', feature })).status, 204);
  }
  const generate = env.AI.run;
  env.AI.run = async () => { throw new Error('3040: capacity temporarily exceeded'); };
  const busy = await send('image', valid.get('one'), { prompt: 'cat' });
  assert.equal(busy.status, 503);
  assert.match((await busy.json()).error, /model is busy/);
  let busyOnce = true;
  env.AI.run = async () => {
    if (busyOnce) { busyOnce = false; throw new Error('3040: capacity temporarily exceeded'); }
    return generate();
  };
  const results = await Promise.all(Array.from({ length: 6 }, () => send('image', valid.get('one'), { prompt: 'cat' })));
  assert.deepEqual(results.map(r => r.status).sort(), [200, 200, 200, 429, 429, 429]);
  assert.equal(await results.find(r => r.ok).text(), 'JPEG');
  assert.equal((await send('image', valid.get('two'), { prompt: 'dog' })).status, 200);
  assert.equal(images, 4);
  assert.equal(db.prepare('SELECT sum(attempts) AS n FROM ai_usage WHERE uid = ?').get('one').n, 11);
  const chat = () => send('text', valid.get('one'), { prompt: 'Hello' });
  assert.equal((await chat()).status, 503);
  env.GROQ_API_KEY = 'test-only';
  env.DAILY_TEXT_LIMIT = '1';
  assert.equal((await chat()).status, 429);
  groqStatus = 200;
  assert.equal((await (await chat()).json()).text, 'Hello');
  assert.equal((await chat()).status, 429);
  assert.equal((await send('text', valid.get('two'), { prompt: 'Hello' })).status, 200);
});
