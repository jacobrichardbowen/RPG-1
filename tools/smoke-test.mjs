// Optional automated check: boots Play.html in headless Chromium, starts a game, fast-forwards the
// simulation through a fight and a quest, and fails on any script error.
//   npm install --no-save playwright && npx playwright install chromium
//   npm run check
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch (e) {
  console.error('This check needs Playwright:  npm install --no-save playwright && npx playwright install chromium');
  process.exit(2);
}

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.setDefaultTimeout(180000);
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(pathToFileURL(path.join(root, 'Play.html')).href);
await page.waitForFunction(() => window.game && window.game.state === 'menu');

const result = await page.evaluate(() => {
  const g = window.game;
  const out = {};
  g.newGame({ name: 'Tester', race: 'westerling', cls: 'warrior', look: { female: false, skin: 1, hairColor: 0x3b2a1c, hairStyle: 'short', beard: false } });
  g.ui.menus.close();
  // Fresh Off the Boat
  g.quests.accept('fresh_boat');
  const orvel = g.npcs.find((n) => n.id === 'orvel');
  g.questEvent('talk', { npc: 'orvel' });
  out.boatReady = g.quests.status('fresh_boat') === 'ready';
  out.boatDone = g.quests.turnIn('fresh_boat');
  void orvel;
  // Kill a mudsnapper.
  const p = g.player;
  const crab = g.creatures.find((c) => c.type === 'mudsnapper');
  p.setPosition(crab.pos.x - 1.8, crab.pos.z);
  p.faceUnit(crab);
  g.setTarget(crab);
  p.autoAttack = true;
  for (let i = 0; i < 40 && crab.alive; i++) { g.useBarSlot(0); g.debugStep(1); p.hp = p.maxHp; }
  out.crabDead = !crab.alive;
  out.xp = g.sheet.xp;
  out.saved = g.save(true);
  return out;
});
await browser.close();

console.log(result);
const ok = result.boatReady && result.boatDone && result.crabDead && !errors.length;
if (errors.length) console.error('Script errors:\n' + errors.join('\n'));
console.log(ok ? 'Smoke test passed.' : 'Smoke test FAILED.');
process.exit(ok ? 0 : 1);
