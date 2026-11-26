import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const encoder = new TextEncoder();
const bytes = new Map([
  ['manifest.json', encoder.encode(JSON.stringify({ manifest_version: 3, name: 'GlassTab - Custom New Tab Dashboard', key: 'same-key', chrome_url_overrides: { newtab: 'index.html' } }))],
  ['index.html', encoder.encode('<html>new</html>')],
  ['background.js', encoder.encode('new background')],
  ['build-info.json', encoder.encode(JSON.stringify({ buildId: 'a'.repeat(40) }))],
  ['assets/app.js', encoder.encode('new app')],
]);
const release = {
  buildId: 'a'.repeat(40), version: '2.0.2',
  files: [...bytes].map(([path, data]) => ({ path, size: data.length, sha256: createHash('sha256').update(data).digest('hex') })),
};

function directory(initial = {}) {
  const entries = new Map(Object.entries(initial));
  let writes = 0;
  const handle = {
    entries,
    get writes() { return writes; },
    async getDirectoryHandle(name, options) {
      if (!entries.has(name) && options?.create) entries.set(name, directory());
      const entry = entries.get(name);
      if (!entry?.getDirectoryHandle) throw new Error(`Missing directory: ${name}`);
      return entry;
    },
    async getFileHandle(name, options) {
      if (!entries.has(name) && options?.create) entries.set(name, new Uint8Array());
      if (!entries.has(name)) throw new Error(`Missing file: ${name}`);
      return {
        async getFile() { return { text: async () => new TextDecoder().decode(entries.get(name)) }; },
        async createWritable() {
          let next;
          return {
            async write(value) { next = new Uint8Array(value); },
            async close() { entries.set(name, next); writes++; },
            async abort() {},
          };
        },
      };
    },
  };
  return handle;
}

async function runUpdate(folder) {
  const controls = {
    '#update': { disabled: true, addEventListener(_event, handler) { this.click = handler; } },
    '#status': { textContent: '', className: '' },
    '#release': { textContent: '' },
  };
  globalThis.document = { querySelector: selector => controls[selector] };
  globalThis.location = { href: 'https://example.test/GlassTab/update/' };
  globalThis.window = { showDirectoryPicker: async () => folder };
  globalThis.fetch = async url => {
    const path = new URL(url).pathname;
    if (path.endsWith('/update.json')) return { ok: true, json: async () => release };
    const file = decodeURIComponent(path.split('/files/')[1]);
    return { ok: bytes.has(file), arrayBuffer: async () => bytes.get(file).buffer };
  };
  await import(`../updater/update.js?case=${Math.random()}`);
  await new Promise(resolve => setImmediate(resolve));
  await controls['#update'].click();
  return controls['#status'];
}

test('updater rejects a different extension folder without writing', async () => {
  const folder = directory({ 'manifest.json': encoder.encode(JSON.stringify({ name: 'Other extension' })) });
  const status = await runUpdate(folder);
  assert.equal(folder.writes, 0);
  assert.match(status.textContent, /not the same GlassTab/);
});

test('updater writes the selected GlassTab folder after verification', async () => {
  const folder = directory({ 'manifest.json': bytes.get('manifest.json') });
  const status = await runUpdate(folder);
  assert.equal(folder.writes + folder.entries.get('assets').writes, bytes.size);
  assert.deepEqual(folder.entries.get('index.html'), bytes.get('index.html'));
  assert.deepEqual(folder.entries.get('assets').entries.get('app.js'), bytes.get('assets/app.js'));
  assert.match(status.textContent, /Update complete/);
});
