// Builds the game into a single self-contained HTML file.
//   node tools/build.mjs          -> Play.html (double-click to play) + dist/artifact.html
//   node tools/build.mjs --watch  -> rebuild on every source change
// Files in assets/models, assets/textures, assets/audio and assets/icons are baked into the
// build as asset overrides (name them after their slot id, e.g. assets/models/mob_mudsnapper.glb).
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const watch = process.argv.includes('--watch');
const ASSET_DIRS = ['models', 'textures', 'audio', 'icons'];
const MIME = {
  glb: 'model/gltf-binary', gltf: 'model/gltf+json', fbx: 'application/octet-stream', obj: 'text/plain', bin: 'application/octet-stream',
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', bmp: 'image/bmp',
  ogg: 'audio/ogg', mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4', flac: 'audio/flac', webm: 'audio/webm', json: 'application/json',
};

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (!e.name.startsWith('.') && e.name !== 'README.md') out.push(p);
  }
  return out;
}

function bakedAssets() {
  const files = [];
  let total = 0;
  for (const d of ASSET_DIRS) {
    for (const f of walk(path.join(root, 'assets', d))) {
      const ext = path.extname(f).slice(1).toLowerCase();
      if (!MIME[ext]) continue;
      const data = fs.readFileSync(f);
      total += data.length;
      files.push({ name: path.relative(path.join(root, 'assets'), f).replace(/\\/g, '/'), type: MIME[ext], data: data.toString('base64') });
    }
  }
  if (files.length) console.log(`  baked ${files.length} asset file(s), ${(total / 1024 / 1024).toFixed(2)} MB`);
  return files;
}

function fontCSS() {
  const dir = path.join(root, 'vendor', 'fonts');
  const list = JSON.parse(fs.readFileSync(path.join(dir, 'fonts.json'), 'utf8'));
  return list.map((f) => {
    const b64 = fs.readFileSync(path.join(dir, f.file)).toString('base64');
    return `@font-face{font-family:'${f.fam}';font-style:${f.style};font-weight:${f.w};font-display:swap;src:url(data:font/woff2;base64,${b64}) format('woff2');}`;
  }).join('\n');
}

function css() {
  const dir = path.join(root, 'src', 'styles');
  return fs.readdirSync(dir).filter((f) => f.endsWith('.css')).sort().map((f) => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
}

function writeHtml(js) {
  const tpl = fs.readFileSync(path.join(root, 'src', 'index.html'), 'utf8');
  const safeJs = js.replace(/<\/script/gi, '<\\/script');
  const baked = JSON.stringify(bakedAssets()).replace(/<\//g, '<\\/');
  const style = `${fontCSS()}\n${css()}`;
  const fill = (s) => s
    .replace('/*__CSS__*/', () => style)
    .replace('/*__BAKED__*/', () => `window.__BAKED_ASSETS__=${baked};`)
    .replace('/*__JS__*/', () => safeJs)
    .replace('__BUILD_DATE__', new Date().toISOString().slice(0, 10));
  const full = fill(tpl);
  fs.writeFileSync(path.join(root, 'Play.html'), full);
  // Artifact variant: the host wraps the page in its own document skeleton.
  const head = /<head>([\s\S]*?)<\/head>/.exec(full)[1].replace(/<meta[^>]*>\s*/g, '');
  const body = /<body[^>]*>([\s\S]*?)<\/body>/.exec(full)[1];
  fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
  fs.writeFileSync(path.join(root, 'dist', 'artifact.html'), `${head.trim()}\n${body.trim()}\n`);
  const kb = (Buffer.byteLength(full) / 1024).toFixed(0);
  console.log(`  wrote Play.html (${kb} KB) and dist/artifact.html`);
}

const options = {
  entryPoints: [path.join(root, 'src', 'main.js')],
  bundle: true,
  format: 'iife',
  minify: !watch,
  sourcemap: false,
  target: ['es2020'],
  write: false,
  legalComments: 'none',
  logLevel: 'warning',
};

if (watch) {
  const ctx = await esbuild.context({
    ...options,
    plugins: [{
      name: 'html',
      setup(b) {
        b.onEnd((r) => {
          if (r.errors.length) return;
          writeHtml(r.outputFiles[0].text);
          console.log(`[${new Date().toLocaleTimeString()}] rebuilt`);
        });
      },
    }],
  });
  await ctx.watch();
  fs.watch(path.join(root, 'src', 'styles'), () => ctx.rebuild().catch(() => {}));
  console.log('Watching for changes... (Ctrl+C to stop)');
} else {
  const t = Date.now();
  const r = await esbuild.build(options);
  writeHtml(r.outputFiles[0].text);
  console.log(`Build finished in ${Date.now() - t} ms`);
}
