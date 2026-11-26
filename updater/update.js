const updateButton = document.querySelector('#update');
const status = document.querySelector('#status');
const releaseLabel = document.querySelector('#release');
const base = new URL('../', location.href);
let release;

function report(message, kind = '') {
  status.textContent = message;
  status.className = kind;
}

function validFile(file) {
  return file && typeof file.path === 'string' &&
    /^(?:[a-zA-Z0-9][a-zA-Z0-9._-]*\/)*[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(file.path) &&
    !file.path.split('/').some(part => part === '.' || part === '..') &&
    Number.isSafeInteger(file.size) && file.size >= 0 && file.size <= 30_000_000 &&
    /^[a-f0-9]{64}$/.test(file.sha256);
}

function validateRelease(data) {
  if (!data || !/^[a-f0-9]{40}$/.test(data.buildId) || !Array.isArray(data.files) ||
      data.files.length < 5 || data.files.length > 500 || !data.files.every(validFile)) {
    throw new Error('The published update manifest is invalid.');
  }
  const paths = data.files.map(file => file.path);
  if (new Set(paths).size !== paths.length || !paths.includes('manifest.json') ||
      !paths.includes('index.html') || !paths.includes('build-info.json')) {
    throw new Error('The published update is incomplete.');
  }
  return data;
}

async function sha256(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

async function downloadFiles() {
  const files = new Map();
  for (const [index, file] of release.files.entries()) {
    report(`Downloading and checking file ${index + 1} of ${release.files.length}…`);
    const url = new URL(`files/${file.path.split('/').map(encodeURIComponent).join('/')}`, base);
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Download failed: ${file.path}`);
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength !== file.size || await sha256(bytes) !== file.sha256) {
      throw new Error(`Integrity check failed: ${file.path}`);
    }
    files.set(file.path, bytes);
  }
  return files;
}

async function readManifest(folder) {
  const handle = await folder.getFileHandle('manifest.json');
  return JSON.parse(await (await handle.getFile()).text());
}

async function writeFile(folder, path, bytes) {
  const parts = path.split('/');
  let directory = folder;
  for (const part of parts.slice(0, -1)) {
    directory = await directory.getDirectoryHandle(part, { create: true });
  }
  const handle = await directory.getFileHandle(parts.at(-1), { create: true });
  const stream = await handle.createWritable();
  try {
    await stream.write(bytes);
    await stream.close();
  } catch (error) {
    await stream.abort().catch(() => {});
    throw error;
  }
}

async function loadRelease() {
  const response = await fetch(new URL('update.json', base), { cache: 'no-store' });
  if (!response.ok) throw new Error('The update service is unavailable.');
  release = validateRelease(await response.json());
  releaseLabel.textContent = `Latest build: ${release.version || 'GlassTab'} (${release.buildId.slice(0, 8)})`;
  updateButton.disabled = !('showDirectoryPicker' in window);
  if (updateButton.disabled) report('Use a current Chrome or Edge browser to update the folder.', 'error');
}

updateButton.addEventListener('click', async () => {
  if (!release) return;
  // The picker must run directly from the click to retain user activation.
  let folder;
  try {
    folder = await window.showDirectoryPicker({ id: 'glasstab-extension', mode: 'readwrite' });
  } catch (error) {
    if (error.name !== 'AbortError') report(error.message, 'error');
    return;
  }
  updateButton.disabled = true;
  try {
    const existing = await readManifest(folder);
    const files = await downloadFiles();
    const incoming = JSON.parse(new TextDecoder().decode(files.get('manifest.json')));
    if (existing.manifest_version !== 3 || !existing.name?.startsWith('GlassTab') ||
        !existing.key || existing.key !== incoming.key || existing.chrome_url_overrides?.newtab !== 'index.html') {
      throw new Error('This is not the same GlassTab extension folder. No files were changed.');
    }
    const installedBuild = await folder.getFileHandle('build-info.json').then(async handle =>
      JSON.parse(await (await handle.getFile()).text()).buildId).catch(() => null);
    if (installedBuild === release.buildId) {
      report('This folder already has the latest build. Reload GlassTab in chrome://extensions.', 'success');
      return;
    }
    // Download and verify everything before changing the selected folder.
    // Keep the manifest and entry point until the other release files are ready.
    const paths = [...files.keys()].filter(path => path !== 'index.html' && path !== 'manifest.json' && path !== 'build-info.json');
    for (const [index, path] of paths.entries()) {
      report(`Updating file ${index + 1} of ${paths.length + 3}…`);
      await writeFile(folder, path, files.get(path));
    }
    await writeFile(folder, 'index.html', files.get('index.html'));
    await writeFile(folder, 'manifest.json', files.get('manifest.json'));
    await writeFile(folder, 'build-info.json', files.get('build-info.json'));
    report('Update complete. Click Reload on GlassTab in chrome://extensions, then open a new tab.', 'success');
  } catch (error) {
    report(error.message || 'The update failed.', 'error');
  } finally {
    updateButton.disabled = false;
  }
});

loadRelease().catch(error => {
  releaseLabel.textContent = 'Could not check for an update.';
  report(error.message, 'error');
});
