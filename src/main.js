// Entry point: boot the asset registry, build the world, start the game.
import { registry } from './assets/registry.js';
import { defineSlots } from './assets/slots.js';
import { defineAudioSlots } from './game/audio.js';
import { defineIconSlots } from './ui/icons.js';
import { Game } from './game/game.js';

const bootFill = document.getElementById('boot-fill');
const bootMsg = document.getElementById('boot-msg');
let step = 0;
const STEPS = 9;
function progress(msg) {
  step++;
  if (bootMsg) bootMsg.textContent = msg;
  if (bootFill) bootFill.style.width = `${Math.min(100, (step / STEPS) * 100)}%`;
}
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));

async function decodeBaked() {
  const list = window.__BAKED_ASSETS__ || [];
  const files = [];
  for (const f of list) {
    const bin = atob(f.data);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const file = new File([bytes], f.name.split('/').pop(), { type: f.type });
    file.relPath = f.name;
    files.push(file);
  }
  return files;
}

async function boot() {
  try {
    progress('Gathering the placeholders');
    defineSlots();
    defineIconSlots();
    defineAudioSlots();
    await nextFrame();
    progress('Unpacking your assets');
    await registry.init(await decodeBaked());
    await nextFrame();
    const game = new Game(document.getElementById('viewport'), document.getElementById('ui'));
    window.game = game;
    window.registry = registry; // handy for poking at assets from the browser console
    await game.init(async (msg) => { progress(msg); await nextFrame(); });
    // When hosted as a claude.ai artifact, keep an in-progress game across page updates.
    const hot = window.claude?.hot;
    hot?.snapshot?.(() => (game.state === 'play' && game.player ? game.serialize() : {}));
    const resume = (data) => { if (data && data.sheet) game.loadData(data); };
    if (hot?.ready) hot.ready(resume); else resume(hot?.data ?? {});
    progress('Ready');
    document.getElementById('boot').classList.add('done');
    setTimeout(() => document.getElementById('boot')?.remove(), 1000);
  } catch (e) {
    console.error(e);
    if (bootMsg) {
      bootMsg.textContent = `Something went wrong while loading: ${e.message}. Try reloading; if you added custom assets, open the Asset Workshop and reset them.`;
      bootMsg.style.color = '#ff8a7a';
    }
  }
}

boot();
