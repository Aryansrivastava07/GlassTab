import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const buildId = process.env.BUILD_ID;
if (!/^[a-f0-9]{40}$/.test(buildId || '')) throw new Error('BUILD_ID must be a full Git commit SHA');

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const root = join(projectRoot, '.pages');
const dist = join(projectRoot, 'dist');
const filesRoot = join(root, 'files');
if (!root.startsWith(projectRoot + sep)) throw new Error('Output must remain in the project directory');
await rm(root, { recursive: true, force: true });
await mkdir(filesRoot, { recursive: true });
await cp(dist, filesRoot, { recursive: true });

const packageJson = JSON.parse(await readFile(join(projectRoot, 'package.json'), 'utf8'));
const buildInfo = { buildId, version: packageJson.version };
await writeFile(join(filesRoot, 'build-info.json'), JSON.stringify(buildInfo));

async function collect(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collect(path));
    else if (entry.isFile()) {
      const data = await readFile(path);
      files.push({
        path: relative(filesRoot, path).split(sep).join('/'),
        size: data.length,
        sha256: createHash('sha256').update(data).digest('hex'),
      });
    }
  }
  return files;
}

const files = (await collect(filesRoot)).sort((a, b) => a.path.localeCompare(b.path));
const manifest = JSON.parse(await readFile(join(filesRoot, 'manifest.json'), 'utf8'));
if (manifest.version !== packageJson.version) throw new Error('Package and extension versions differ');
if (!files.some(file => file.path === 'index.html') || !files.some(file => file.path === 'manifest.json')) {
  throw new Error('Incomplete extension build');
}
await writeFile(join(root, 'update.json'), JSON.stringify({ ...buildInfo, files }, null, 2));
await cp(join(projectRoot, 'updater'), join(root, 'update'), { recursive: true });
await writeFile(join(root, 'index.html'), '<!doctype html><html lang="en"><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=./update/"><title>GlassTab updates</title><a href="./update/">Open the GlassTab updater</a></html>');
await writeFile(join(root, '.nojekyll'), '');
console.log(`Prepared ${files.length} extension files for build ${buildId}`);
