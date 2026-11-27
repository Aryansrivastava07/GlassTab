// Production-build regression checks. No live accounts, API keys, or external requests.
import { createServer } from 'node:http';
import { readFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { resolve, join, extname, sep } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';

const dist = resolve('dist');
const output = resolve('.audit');
await mkdir(output, { recursive: true });
const server = createServer(async (req, res) => {
  const path = resolve(dist, '.' + new URL(req.url, 'http://localhost').pathname);
  if (path !== dist && !path.startsWith(dist + sep)) { res.writeHead(403).end(); return; }
  try {
    const file = path === dist ? join(dist, 'index.html') : path;
    const type = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png' }[extname(file)] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type });
    res.end(await readFile(file));
  } catch { res.writeHead(404).end(); }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const origin = `http://127.0.0.1:${server.address().port}`;
const tempRoot = resolve(tmpdir());
const profile = await mkdtemp(join(tempRoot, 'glasstab-audit-'));
const browser = spawn(process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required',
  '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank',
], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
let ws;
try {
  const endpoint = await new Promise((resolveEndpoint, reject) => {
    const timer = setTimeout(() => reject(new Error('Browser startup timed out')), 15000);
    browser.once('error', reject);
    browser.stderr.on('data', chunk => {
      const url = chunk.toString().match(/DevTools listening on (ws:\/\/\S+)/)?.[1];
      if (url) { clearTimeout(timer); resolveEndpoint(url); }
    });
  });
  console.log('Browser launched; connecting to DevTools.');
  const targets = await (await fetch(`http://${new URL(endpoint).host}/json/list`, { signal: AbortSignal.timeout(10000) })).json();
  ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((done, reject) => {
    const timer = setTimeout(() => reject(new Error('DevTools websocket timed out')), 10000);
    ws.addEventListener('open', () => { clearTimeout(timer); done(); }, { once: true });
    ws.addEventListener('error', () => reject(new Error('DevTools websocket connection failed')), { once: true });
  });
  let nextId = 0;
  const pending = new Map();
  const errors = [];
  const send = (method, params = {}) => new Promise((resolveCall, reject) => {
    const id = ++nextId;
    const timer = setTimeout(() => reject(new Error(`DevTools timed out: ${method}`)), 15000);
    pending.set(id, { resolve: value => { clearTimeout(timer); resolveCall(value); }, reject: error => { clearTimeout(timer); reject(error); } });
    ws.send(JSON.stringify({ id, method, params }));
  });
  ws.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    if (message.id) {
      const call = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) call.reject(new Error(JSON.stringify(message.error)));
      else call.resolve(message.result);
    } else if (message.method === 'Runtime.exceptionThrown') {
      errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
    } else if (message.method === 'Fetch.requestPaused') {
      send('Fetch.failRequest', { requestId: message.params.requestId, errorReason: 'BlockedByClient' });
    }
  });
  const evaluate = async (fn) => {
    const result = await send('Runtime.evaluate', { expression: `(${fn})()`, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  };
  const waitFor = async (fn) => {
    const start = Date.now();
    while (!(await evaluate(fn))) {
      if (Date.now() - start > 12000) throw new Error(`Timed out: ${fn}`);
      await new Promise(done => setTimeout(done, 100));
    }
  };
  const key = async (keyName, modifiers = 0) => {
    const codes = { Enter: 13, Tab: 9, Escape: 27, ArrowRight: 39, ArrowDown: 40 };
    const event = { key: keyName, code: keyName, windowsVirtualKeyCode: codes[keyName], modifiers };
    await send('Input.dispatchKeyEvent', { type: 'keyDown', ...event, ...(keyName === 'Enter' && { text: '\r' }) });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', ...event });
  };
  const screenshot = async (name) => {
    const { data } = await send('Page.captureScreenshot', { format: 'png' });
    await writeFile(join(output, `${name}.png`), Buffer.from(data, 'base64'));
  };
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setFocusEmulationEnabled', { enabled: true });
  await send('Fetch.enable', { patterns: [{ urlPattern: 'https://*' }] });
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `
    localStorage.setItem('hasVisited', 'true');
    if (!localStorage.getItem('landing_features_config_v1')) localStorage.setItem('landing_features_config_v1', JSON.stringify({autoFocusSearch:false}));
  ` });
  await send('Page.navigate', { url: origin + '/?focus' });
  console.log('Loading the production dashboard.');
  await waitFor(() => Boolean(document.querySelector('#searchInput')));
  const resources = await evaluate(() => performance.getEntriesByType('resource').map(e => e.name));
  assert(!resources.some(url => /GlassAIStudio-|Sidebar-|NotesModal-|CustomWidgetStudio-/.test(url)), 'Closed tools must not load at startup');
  await screenshot('desktop');
  await evaluate(() => document.querySelector('#searchInput').focus());
  for (let i = 0; i < 100; i++) {
    if (await evaluate(() => document.activeElement.getAttribute('aria-label') === 'Open dashboard settings')) break;
    await key('Tab');
  }
  assert(await evaluate(() => document.activeElement.getAttribute('aria-label') === 'Open dashboard settings'), 'Settings is unreachable by keyboard');
  await key('Enter');
  await waitFor(() => Boolean(document.querySelector('[title="Close Settings"]')));
  assert(await evaluate(() => document.activeElement.getAttribute('role') === 'dialog'));
  for (let i = 0; i < 25; i++) {
    await key('Tab');
    assert(await evaluate(() => !!document.activeElement.closest('[role="dialog"]')), 'Tab escaped settings');
  }
  await evaluate(() => [...document.querySelectorAll('button')].find(el => el.textContent === 'Widgets').click());
  await waitFor(() => document.querySelectorAll('input[name="clock-face"]').length === 4);
  for (const face of ['station', 'roman', 'digital']) {
    await send('Runtime.evaluate', { expression: `document.querySelector('input[name="clock-face"][value="${face}"]').click()` });
    await waitFor(() => !!document.querySelector('[role="img"] > .face-' + document.querySelector('input[name="clock-face"]:checked').value));
  }
  await evaluate(() => {
    const panel = document.querySelector('fieldset select').closest('fieldset');
    const zone = panel.querySelector('select');
    zone.value = 'UTC';
    zone.dispatchEvent(new Event('change', { bubbles: true }));
    for (const label of ['Show date', '24-hour time', 'Show seconds']) {
      [...panel.querySelectorAll('label')].find(el => el.textContent === label).querySelector('input').click();
    }
  });
  assert(await evaluate(() => document.querySelector('[role="img"] .digital-time').textContent === new Date().toISOString().slice(11, 16)));
  assert(await evaluate(() => document.querySelector('[role="img"] .digital-readout').textContent.includes('24H')));
  await evaluate(() => [...document.querySelectorAll('button')].find(el => el.textContent === 'Sync').click());
  await waitFor(() => [...document.querySelectorAll('a')].some(a => a.textContent.includes('Update to latest version') && a.href === 'https://aryansrivastava07.github.io/GlassTab/update/'));
  await evaluate(() => [...document.querySelectorAll('button')].find(el => el.textContent === 'Accessibility').click());
  await waitFor(() => !![...document.querySelectorAll('h3')].find(el => el.textContent === 'Keyboard guide'));
  const { nodes } = await send('Accessibility.getFullAXTree');
  for (const label of ['Higher contrast', 'Larger text', 'Simple layout', 'Reduce motion']) {
    assert(nodes.some(node => node.role.value === 'checkbox' && node.name?.value.startsWith(label)), `Missing accessible checkbox: ${label}`);
  }
  await evaluate(() => {
    for (const title of ['Higher contrast', 'Larger text', 'Reduce motion']) {
      [...document.querySelectorAll('label')].find(el => el.textContent.startsWith(title)).querySelector('input').click();
    }
  });
  await waitFor(() => document.documentElement.classList.contains('high-contrast') && !!document.querySelector('.simple-dashboard'));
  await screenshot('accessibility');
  await key('Escape');
  await waitFor(() => !document.querySelector('[aria-modal="true"]'));
  assert(await evaluate(() => document.activeElement.getAttribute('aria-label') === 'Open dashboard settings'), 'Focus was not restored');
  assert(await evaluate(() => !document.querySelector('[inert]')), 'Background remained inert');
  await send('Page.reload');
  await waitFor(() => !!document.querySelector('.simple-dashboard'));
  assert(await evaluate(() => !!document.querySelector('.simple-dashboard .face-digital')));
  assert(await evaluate(() => document.documentElement.classList.contains('large-text')), 'Preference did not persist');
  // Keep all optional widgets visible while testing the narrow layout.
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: false });
  await screenshot('mobile');
  assert(await evaluate(() => document.querySelector('main').scrollWidth <= innerWidth), 'Mobile layout overflows');
  await send('Emulation.setDeviceMetricsOverride', { width: 320, height: 720, deviceScaleFactor: 1, mobile: false });
  await waitFor(() => document.querySelector('main').scrollWidth <= innerWidth);
  // Search keyboard navigation must keep Tab free and expose the selected suggestion.
  await evaluate(() => localStorage.setItem('landing_search_history_v1', JSON.stringify(['example query', 'second query'])));
  await send('Page.reload');
  await waitFor(() => !!document.querySelector('#searchInput'));
  await evaluate(() => document.querySelector('#searchInput').focus());
  assert(await evaluate(() => {
    const input = document.querySelector('#searchInput');
    return input.getAttribute('aria-expanded') === 'false' &&
      getComputedStyle(input).outlineStyle === 'none' &&
      getComputedStyle(input.closest('.search-container')).outlineStyle === 'solid';
  }), 'Focusing search must keep history closed and highlight the whole field');
  await key('ArrowDown');
  await waitFor(() => !!document.querySelector('#searchInput').getAttribute('aria-activedescendant'));
  await key('Escape');
  await evaluate(() => document.querySelector('#searchInput').click());
  await waitFor(() => document.querySelector('#searchInput').getAttribute('aria-expanded') === 'true');
  await key('Tab');
  assert(await evaluate(() => document.activeElement.id !== 'searchInput'), 'Search trapped Tab');
  // Dialogs loaded on demand must close and release focus.
  await evaluate(() => document.querySelector('[title="Quick Notes & Todos"]').click());
  await waitFor(() => !!document.querySelector('[aria-label="Notes and vault"]'));
  await key('Escape');
  await waitFor(() => !document.querySelector('[aria-label="Notes and vault"]'));
  await evaluate(() => document.querySelector('[title="Open AI Studio (Ginnie & Companions)"]').click());
  await waitFor(() => document.querySelector('#ai-studio-overlay')?.getAttribute('role') === 'dialog');
  await waitFor(() => !!document.querySelector('[aria-label="Talk to Gemini Live"]:not(:disabled)'));
  assert(await evaluate(() => {
    const composer = document.querySelector('#ai-studio-overlay textarea');
    composer.focus();
    const field = composer.closest('.compound-field');
    return getComputedStyle(composer).outlineStyle === 'none' &&
      getComputedStyle(field).outlineStyle === 'solid' &&
      field.scrollWidth <= field.clientWidth + 1;
  }), 'Chat composer focus and controls must fit the field at 320px');
  await evaluate(() => document.querySelector('[aria-label="Talk to Gemini Live"]').click());
  await waitFor(() => !!document.querySelector('[aria-label="Gemini voice API key"] input'));
  await evaluate(() => document.querySelector('[aria-label="Gemini voice API key"] input').focus());
  await send('Input.insertText', { text: 'test-only-voice-key' });
  await evaluate(() => [...document.querySelectorAll('button')].find(button => button.textContent === 'Save key').click());
  await waitFor(() => localStorage.getItem('glasstab_gemini_live_key') === 'test-only-voice-key');
  await evaluate(() => {
    const NativeSocket = window.WebSocket;
    window.WebSocket = class extends NativeSocket {
      constructor(url, protocols) {
        if (!url.startsWith('wss://generativelanguage.googleapis.com/')) return new NativeSocket(url, protocols);
        const fake = {
          readyState: 1, bufferedAmount: 0,
          close() { window.voiceSocketClosed = true; },
          send(raw) {
            const frame = JSON.parse(raw);
            if (frame.setup) {
              if (frame.setup.generationConfig.responseModalities[0] !== 'AUDIO') throw Error('Missing audio modality');
              fake.onmessage({ data: '{"setupComplete":{}}' });
            } else if (!window.sentMicrophone && frame.realtimeInput?.audio?.data) {
              window.sentMicrophone = true;
              const content = {
                inputTranscription: { text: 'Browser microphone test' }, outputTranscription: { text: 'Voice reply test' },
                modelTurn: { parts: [{ inlineData: { mimeType: 'audio/pcm;rate=24000', data: btoa('\0'.repeat(4800)) } }] },
                turnComplete: true,
              };
              fake.onmessage({ data: JSON.stringify({ serverContent: content }) });
            }
          },
        };
        setTimeout(() => fake.onopen(), 0);
        return fake;
      }
    };
    document.querySelector('[aria-label="Talk to Gemini Live"]').click();
  });
  await waitFor(() => window.sentMicrophone && document.body.innerText.includes('Voice reply test'));
  await evaluate(() => document.querySelector('[aria-label="End Gemini Live call"]').click());
  await waitFor(() => window.voiceSocketClosed && !!document.querySelector('[aria-label="Talk to Gemini Live"]'));
  await key('Escape');
  await waitFor(() => document.querySelector('#ai-studio-overlay')?.getAttribute('aria-hidden') === 'true');
  // Test keyboard layout editing with the standard desktop arrangement.
  await evaluate(() => {
    localStorage.setItem('landing_features_config_v1', JSON.stringify({ autoFocusSearch: false }));
    localStorage.setItem('landing_widget_drag_enabled', 'true');
  });
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.reload');
  await waitFor(() => !!document.querySelector('[data-widget-move]'));
  const before = await evaluate(() => {
    const handle = [...document.querySelectorAll('[data-widget-move]')].find(el => el.textContent.includes('Search'));
    handle.focus();
    const rect = handle.parentElement.getBoundingClientRect();
    return { x: rect.x, width: rect.width };
  });
  await key('ArrowRight');
  await key('ArrowRight', 8);
  const after = await evaluate(() => {
    const rect = document.activeElement.parentElement.getBoundingClientRect();
    return { x: rect.x, width: rect.width };
  });
  assert(after.x > before.x, 'Keyboard move failed');
  assert(after.width > before.width, 'Keyboard resize failed');
  await evaluate(() => {
    localStorage.removeItem('glasstab_clock_v1');
    window.dispatchEvent(new Event('glasstab_clock_v1'));
  });
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await waitFor(() => !document.querySelector('.clock-second'));
  assert.equal(errors.length, 0, errors.join('\n'));
  console.log('PASS: deferred loading; modal focus containment/restoration; saved accessibility preferences; 390px/320px reflow; search Tab/ARIA; notes and AI dialogs; keyboard widget move/resize; system reduced motion; no runtime exceptions.');
  console.log(`Screenshots: ${output}`);
} finally {
  ws?.close();
  browser.kill();
  server.close();
  // Only the unique temporary profile created above can be removed.
  if (resolve(profile).startsWith(tempRoot + sep) && profile.includes('glasstab-audit-')) {
    await rm(profile, { recursive: true, force: true, maxRetries: 6, retryDelay: 250 }).catch(() => {});
  }
}
