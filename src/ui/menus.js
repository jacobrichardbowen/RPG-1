// Full-screen menus: title, character creation, intro, pause, settings, death, ending.
import { h, clear } from './dom.js';
import { CLASSES } from '../data/classes.js';
import { RACES } from '../assets/placeholders/characters.js';
import { QUESTS } from '../data/quests.js';
import { CONTROLS } from './windows.js';
import { registry } from '../assets/registry.js';
import { Player } from '../entities/player.js';
import { CharacterSheet } from '../game/character.js';
// Where the character stands while you design them: on the dock, with the prison ship behind.
const PREVIEW_SPOT = { x: 13.6, z: 233.5, yaw: -Math.PI / 2 - 0.25 };

const HAIR_COLORS = [0x1a1210, 0x3b2a1c, 0x6a4a2a, 0x9a6a3a, 0xc8a060, 0xe0d0a0, 0x8a3a1a, 0xb0b0b0];
const HAIR_STYLES = [['short', 'Short'], ['long', 'Long'], ['ponytail', 'Ponytail'], ['bun', 'Bun'], ['mohawk', 'Crest'], ['none', 'Shaved']];
const NAMES = ['Aldric', 'Brynn', 'Caelith', 'Dara', 'Edric', 'Fenna', 'Garran', 'Hesper', 'Ivo', 'Jessa', 'Korrin', 'Lysa', 'Merek', 'Nyx', 'Orsa', 'Pell', 'Quill', 'Rhosyn', 'Sable', 'Tamsin'];

export class Menus {
  constructor(ui) {
    this.ui = ui;
    this.game = ui.game;
    this.layer = h('div', { class: 'menus' });
    ui.root.append(this.layer);
    this.current = null;
    this.stack = [];
  }

  modal() { return !!this.current; }
  closeAll() { clear(this.layer); this.current = null; this.stack = []; this.game.paused = false; }

  show(name, el, { pause = true } = {}) {
    clear(this.layer);
    this.layer.append(el);
    this.current = name;
    if (pause && this.game.state === 'play') this.game.paused = true;
    if (this.game.input.pointerLocked) this.game.input.exitLock();
    const first = el.querySelector('button, input');
    if (first) setTimeout(() => first.focus({ preventScroll: true }), 30);
  }

  close() {
    clear(this.layer);
    const prev = this.current;
    this.current = null;
    if (this.game.state === 'play') this.game.paused = false;
    if (prev === 'workshop' && this.returnTo) { const r = this.returnTo; this.returnTo = null; r(); }
  }

  handleKey(e) {
    if (!this.current) return false;
    if (e.code === 'Escape') {
      if (this.current === 'pause') this.close();
      else if (this.current === 'settings' || this.current === 'help') this.back();
      else if (this.current === 'workshop') this.workshop?.requestClose();
      else if (this.current === 'intro') this.close();
      return true;
    }
    if (this.current === 'workshop' && e.code === 'F10') { this.workshop?.requestClose(); return true; }
    if (this.current === 'pause' && e.code === 'F10') { this.openWorkshop(); return true; }
    return true;
  }

  back() {
    if (this.game.state === 'play') this.showPause();
    else this.showMain();
  }

  update() { if (this.workshop && this.current === 'workshop') this.workshop.update(); }

  // ------------------------------------------------------------------ title
  showMain() {
    const g = this.game;
    g.state = 'menu';
    const info = g.hasSave() ? g.saveInfo() : null;
    const overrides = [...registry.overrides.values()].length;
    const buttons = h('div', { class: 'menu-buttons' });
    if (info) {
      buttons.append(h('button', { class: 'menu-btn primary', onclick: () => { g.audio.unlock(); g.load(); } }, 'Continue', h('span', { class: 'menu-btn-sub' }, `${info.name}, level ${info.level} ${info.race} ${info.cls}`)));
    }
    buttons.append(
      h('button', { class: `menu-btn ${info ? '' : 'primary'}`, onclick: () => { g.audio.unlock(); this.showCreation(); } }, 'New Game'),
      h('button', { class: 'menu-btn', onclick: () => { g.audio.unlock(); this.openWorkshop(); } }, 'Asset Workshop', h('span', { class: 'menu-btn-sub' }, overrides ? `${overrides} custom asset${overrides > 1 ? 's' : ''} active` : 'Swap in your own models, textures and sounds')),
      h('button', { class: 'menu-btn', onclick: () => this.showSettings() }, 'Settings'),
      h('button', { class: 'menu-btn', onclick: () => this.showHelp() }, 'How to Play'),
    );
    const el = h('div', { class: 'menu-screen title-screen' },
      h('div', { class: 'title-block' },
        h('div', { class: 'title-kicker' }, 'A vertical slice'),
        h('h1', { class: 'game-title' }, 'Isle of Brackwater'),
        h('div', { class: 'title-sub' }, 'The tide brought you here in chains. It will not let you leave quietly.'),
      ),
      buttons,
      h('div', { class: 'title-foot' }, 'Built with procedural placeholder art: every model, texture, icon and sound can be replaced in the Asset Workshop.'),
    );
    this.show('main', el, { pause: false });
  }

  // ------------------------------------------------------------------ creation
  showCreation() {
    const g = this.game;
    g.state = 'create';
    const c = this.char = this.char || {
      name: NAMES[Math.floor(Math.random() * NAMES.length)], race: 'westerling', cls: 'warrior',
      look: { female: false, skin: 1, hairColor: 0x3b2a1c, hairStyle: 'short', beard: false },
    };
    this.makePreview();
    const el = h('div', { class: 'menu-screen create-screen' });
    const panel = h('div', { class: 'create-panel' });
    el.append(panel, h('div', { class: 'create-preview-controls' },
      h('button', { class: 'btn', title: 'Turn left', onclick: () => { g.player.yaw -= 0.5; } }, '⟲'),
      h('button', { class: 'btn', title: 'Turn right', onclick: () => { g.player.yaw += 0.5; } }, '⟳')));
    const render = () => {
      clear(panel);
      panel.append(h('h2', { class: 'create-title' }, 'Who are you?'));
      // Name
      const name = h('input', { id: 'char-name', class: 'text-input', maxlength: 20, value: c.name, 'aria-label': 'Character name' });
      name.addEventListener('input', () => { c.name = name.value.replace(/[^\p{L}\p{N} '\-]/gu, '').slice(0, 20); });
      panel.append(h('label', { class: 'field-label', for: 'char-name' }, 'Name'), h('div', { class: 'name-row' }, name, h('button', { class: 'btn btn-dim', title: 'Random name', onclick: () => { c.name = NAMES[Math.floor(Math.random() * NAMES.length)]; render(); } }, 'Random')));
      // Race
      panel.append(h('div', { class: 'field-label' }, 'Race'));
      const races = h('div', { class: 'card-grid' });
      for (const [id, r] of Object.entries(RACES)) {
        const bonus = Object.entries(r.stats).filter(([, v]) => v).map(([k, v]) => `${v > 0 ? '+' : ''}${v} ${k.toUpperCase()}`).join('  ');
        races.append(h('button', { class: `card ${c.race === id ? 'on' : ''}`, onclick: () => { c.race = id; if (r.lizard) c.look.hairStyle = 'none'; else if (c.look.hairStyle === 'none') c.look.hairStyle = 'short'; this.makePreview(); render(); } },
          h('div', { class: 'card-name' }, r.name), h('div', { class: 'card-text' }, r.blurb), h('div', { class: 'card-bonus' }, bonus), h('div', { class: 'card-passive' }, r.passive)));
      }
      panel.append(races);
      // Class
      panel.append(h('div', { class: 'field-label' }, 'Class'));
      const classes = h('div', { class: 'card-grid three' });
      for (const [id, k] of Object.entries(CLASSES)) {
        classes.append(h('button', { class: `card ${c.cls === id ? 'on' : ''}`, onclick: () => { c.cls = id; this.makePreview(); render(); } },
          h('div', { class: 'card-name' }, k.name), h('div', { class: 'card-text' }, k.blurb), h('div', { class: 'card-bonus' }, `Uses ${k.resource}`)));
      }
      panel.append(classes);
      // Appearance
      panel.append(h('div', { class: 'field-label' }, 'Appearance'));
      const look = c.look;
      const upd = () => { this.updatePreviewLook(); render(); };
      panel.append(h('div', { class: 'opt-row' }, h('span', { class: 'opt-label' }, 'Body'),
        h('button', { class: `chip ${!look.female ? 'on' : ''}`, onclick: () => { look.female = false; upd(); } }, 'Masculine'),
        h('button', { class: `chip ${look.female ? 'on' : ''}`, onclick: () => { look.female = true; look.beard = false; upd(); } }, 'Feminine')));
      const skins = h('div', { class: 'opt-row' }, h('span', { class: 'opt-label' }, RACES[c.race].lizard ? 'Scales' : 'Skin'));
      RACES[c.race].skins.forEach((col, i) => skins.append(h('button', { class: `swatch ${look.skin === i ? 'on' : ''}`, style: { background: `#${col.toString(16).padStart(6, '0')}` }, 'aria-label': `Tone ${i + 1}`, onclick: () => { look.skin = i; upd(); } })));
      panel.append(skins);
      if (!RACES[c.race].lizard) {
        const hs = h('div', { class: 'opt-row wrap' }, h('span', { class: 'opt-label' }, 'Hair'));
        for (const [id, label] of HAIR_STYLES) hs.append(h('button', { class: `chip ${look.hairStyle === id ? 'on' : ''}`, onclick: () => { look.hairStyle = id; upd(); } }, label));
        panel.append(hs);
        const hc = h('div', { class: 'opt-row' }, h('span', { class: 'opt-label' }, 'Color'));
        for (const col of HAIR_COLORS) hc.append(h('button', { class: `swatch ${look.hairColor === col ? 'on' : ''}`, style: { background: `#${col.toString(16).padStart(6, '0')}` }, 'aria-label': 'Hair color', onclick: () => { look.hairColor = col; upd(); } }));
        panel.append(hc);
        if (!look.female) panel.append(h('div', { class: 'opt-row' }, h('span', { class: 'opt-label' }, 'Beard'),
          h('button', { class: `chip ${!look.beard ? 'on' : ''}`, onclick: () => { look.beard = false; upd(); } }, 'None'),
          h('button', { class: `chip ${look.beard ? 'on' : ''}`, onclick: () => { look.beard = true; upd(); } }, 'Full')));
      }
      panel.append(h('div', { class: 'create-buttons' },
        h('button', { class: 'btn btn-dim', onclick: () => { this.disposePreview(); this.showMain(); } }, 'Back'),
        h('button', { class: 'btn btn-big', onclick: () => this.begin() }, 'Begin your journey')));
    };
    render();
    this.show('create', el, { pause: false });
  }

  makePreview() {
    const g = this.game, c = this.char;
    g.sheet = new CharacterSheet({ name: c.name, race: c.race, cls: c.cls, look: c.look });
    if (g.player) g.player.dispose();
    g.player = new Player(g, { race: c.race, name: c.name, ...c.look });
    g.player.setPosition(PREVIEW_SPOT.x, PREVIEW_SPOT.z);
    g.player.yaw = PREVIEW_SPOT.yaw;
    this.previewEquip();
  }

  previewEquip() {
    const g = this.game, c = this.char;
    const main = { warrior: 'wpn_sword', mage: 'wpn_staff', nightblade: 'wpn_dagger' }[c.cls];
    g.player.visual.attach('grip_r', main, { upright: c.cls === 'mage', offsetY: c.cls === 'mage' ? -0.55 : 0 });
    if (c.cls === 'warrior') g.player.visual.attach('shield_l', 'wpn_shield'); else g.player.visual.detach('shield_l');
  }

  updatePreviewLook() {
    const g = this.game, c = this.char;
    g.player.rebuildLook({ race: c.race, name: c.name, ...c.look });
  }

  disposePreview() {
    const g = this.game;
    if (g.player) { g.player.dispose(); g.player = null; }
    g.sheet = null;
  }

  begin() {
    const g = this.game, c = this.char;
    c.name = (c.name || '').trim() || 'Stranger';
    this.disposePreview();
    this.close();
    g.newGame({ name: c.name, race: c.race, cls: c.cls, look: { ...c.look } });
    this.char = null;
  }

  // ------------------------------------------------------------------ intro
  showIntro() {
    const el = h('div', { class: 'menu-screen intro-screen' },
      h('div', { class: 'intro-card parchment' },
        h('p', {}, 'For eleven weeks you lay in the hold of the prison hulk ', h('i', {}, 'Penitence'), ', with no word of why you were taken or where you were bound.'),
        h('p', {}, 'Then, this morning, the hatch opened. A guard read out a writ bearing the Sea-Regent\'s seal: you are pardoned, released, and delivered to the Isle of Brackwater, a muddy speck at the edge of the Crown\'s charts.'),
        h('p', {}, 'Nobody will tell you who wanted you free. Perhaps the island knows.'),
        h('div', { class: 'intro-hint' }, 'WASD to move · drag the mouse to look · E to talk · F1 for all controls'),
        h('button', { class: 'btn btn-big', onclick: () => this.endIntro() }, 'Step onto the deck'),
      ));
    this.show('intro', el, { pause: true });
  }

  endIntro() {
    const g = this.game;
    this.close();
    const kell = g.npcs.find((n) => n.id === 'kell');
    if (kell) setTimeout(() => g.speechAndLog(kell, 'On your feet, prisoner. Down the gangplank, the harbormaster is waiting.'), 600);
    g.quests.addJournal(null, 'The prison ship has reached the Isle of Brackwater. My papers say I am pardoned. I should find the harbormaster on the dock.');
  }

  // ------------------------------------------------------------------ pause
  togglePause() {
    if (this.current === 'pause') this.close();
    else if (!this.current && this.game.state === 'play') this.showPause();
  }

  showPause() {
    const g = this.game;
    const msg = h('div', { class: 'menu-note' });
    const el = h('div', { class: 'menu-screen pause-screen' },
      h('div', { class: 'pause-panel' },
        h('h2', {}, 'Paused'),
        h('button', { class: 'menu-btn primary', onclick: () => this.close() }, 'Resume'),
        h('button', { class: 'menu-btn', onclick: () => { if (g.save(false)) msg.textContent = 'Saved.'; } }, 'Save game', h('span', { class: 'menu-btn-sub' }, 'F5')),
        h('button', { class: 'menu-btn', disabled: !g.hasSave(), onclick: () => { this.close(); g.load(); } }, 'Load last save', h('span', { class: 'menu-btn-sub' }, 'F9')),
        h('button', { class: 'menu-btn', onclick: () => this.showSettings() }, 'Settings'),
        h('button', { class: 'menu-btn', onclick: () => this.openWorkshop() }, 'Asset Workshop'),
        h('button', { class: 'menu-btn', onclick: () => this.showHelp() }, 'How to Play'),
        h('button', { class: 'menu-btn', onclick: () => this.confirmQuit() }, 'Quit to title'),
        msg,
      ));
    this.show('pause', el);
  }

  confirmQuit() {
    const g = this.game;
    const el = h('div', { class: 'menu-screen pause-screen' }, h('div', { class: 'pause-panel' },
      h('h2', {}, 'Quit to title?'),
      h('p', { class: 'menu-note' }, 'Your progress is saved automatically when you quit.'),
      h('button', { class: 'menu-btn primary', onclick: () => { g.save(true); this.quitToTitle(); } }, 'Save and quit'),
      h('button', { class: 'menu-btn', onclick: () => this.showPause() }, 'Cancel')));
    this.show('pause', el);
  }

  quitToTitle() {
    const g = this.game;
    g.ui.windows.closeAll();
    g.resetSession();
    g.sheet = null;
    g.quests = null;
    g.target = null;
    g.ui.hud.hidden = true;
    this.showMain();
  }

  // ------------------------------------------------------------------ settings
  showSettings() {
    const g = this.game, s = g.settings;
    const row = (label, ctrl) => h('div', { class: 'set-row' }, h('label', { class: 'set-label' }, label), ctrl);
    const slider = (id, key, min, max, step, fmt = (v) => v) => {
      const out = h('span', { class: 'set-val' }, fmt(s[key]));
      const inp = h('input', { id, type: 'range', min, max, step, value: s[key] });
      inp.addEventListener('input', () => { s[key] = +inp.value; out.textContent = fmt(s[key]); g.applySettings(); });
      return h('div', { class: 'set-ctrl' }, inp, out);
    };
    const toggle = (id, key) => {
      const inp = h('input', { id, type: 'checkbox' });
      inp.checked = !!s[key];
      inp.addEventListener('change', () => { s[key] = inp.checked; g.applySettings(); });
      return inp;
    };
    const quality = h('div', { class: 'set-ctrl' });
    for (const q of ['low', 'medium', 'high']) quality.append(h('button', { class: `chip ${s.quality === q ? 'on' : ''}`, onclick: () => { s.quality = q; g.applySettings(); this.showSettings(); } }, q[0].toUpperCase() + q.slice(1)));
    const pct = (v) => `${Math.round(v * 100)}%`;
    const el = h('div', { class: 'menu-screen settings-screen' }, h('div', { class: 'settings-panel' },
      h('h2', {}, 'Settings'),
      h('div', { class: 'set-group' }, 'Graphics'),
      row('Quality', quality),
      row('Render scale', slider('set-scale', 'renderScale', 0.5, 1.5, 0.05, pct)),
      row('Field of view', slider('set-fov', 'fov', 50, 95, 1, (v) => `${v}°`)),
      row('Show FPS', toggle('set-fps', 'showFps')),
      h('div', { class: 'set-group' }, 'Controls'),
      row('Mouse sensitivity', slider('set-sens', 'sensitivity', 0.2, 3, 0.05, (v) => v.toFixed(2))),
      row('Invert mouse Y', toggle('set-inv', 'invertY')),
      h('div', { class: 'set-group' }, 'Sound'),
      row('Master', slider('set-master', 'master', 0, 1, 0.05, pct)),
      row('Music', slider('set-music', 'music', 0, 1, 0.05, pct)),
      row('Effects', slider('set-sfx', 'sfx', 0, 1, 0.05, pct)),
      row('Ambience', slider('set-amb', 'ambient', 0, 1, 0.05, pct)),
      h('div', { class: 'set-group' }, 'Interface'),
      row('Floating combat text', toggle('set-fct', 'combatText')),
      row('Nameplates', toggle('set-np', 'nameplates')),
      row('Day length', slider('set-day', 'dayMinutes', 12, 120, 6, (v) => `${v} min`)),
      h('div', { class: 'settings-buttons' }, h('button', { class: 'btn btn-big', onclick: () => this.back() }, 'Done')),
    ));
    this.show('settings', el, { pause: true });
  }

  showHelp() {
    const t = h('div', { class: 'controls-grid' });
    for (const [k, v] of CONTROLS) t.append(h('div', { class: 'ck' }, k), h('div', { class: 'cv' }, v));
    const el = h('div', { class: 'menu-screen settings-screen' }, h('div', { class: 'settings-panel' },
      h('h2', {}, 'How to Play'), t,
      h('p', { class: 'menu-note' }, 'Talk to people with a golden ! over their heads to find work. Click underlined words in conversation to ask about them. Rest between fights: you heal quickly out of combat.'),
      h('div', { class: 'settings-buttons' }, h('button', { class: 'btn btn-big', onclick: () => this.back() }, 'Done'))));
    this.show('help', el, { pause: true });
  }

  // ------------------------------------------------------------------ death & ending
  showDeath() {
    const g = this.game;
    const el = h('div', { class: 'menu-screen death-screen' }, h('div', { class: 'death-panel' },
      h('h2', {}, 'You have died'),
      h('p', {}, 'The sea takes you, and then, for reasons of its own, gives you back.'),
      h('button', { class: 'menu-btn primary', onclick: () => { this.close(); g.respawnAtShrine(); } }, 'Wake at the Shrine of the Tide'),
      g.hasSave() ? h('button', { class: 'menu-btn', onclick: () => { this.close(); g.load(); } }, 'Load last save') : null));
    setTimeout(() => this.show('death', el, { pause: false }), 1500);
  }

  showEnding() {
    const g = this.game, s = g.sheet;
    const done = Object.values(g.quests.state).filter((q) => q.status === 'done').length;
    const total = Object.keys(QUESTS).length;
    const el = h('div', { class: 'menu-screen ending-screen' }, h('div', { class: 'intro-card parchment ending-card' },
      h('h2', {}, 'The Grey Heron Sails at Dawn'),
      h('p', {}, `${s.name} came to Brackwater a prisoner with no past worth telling. Now the island has a story about them: of crabs culled and debts uncovered, of a fat bogling king laid low, and of the night the Drowned Eye closed above Vael's Tor.`),
      h('p', {}, 'Somewhere across the water, the Sea-Regent is waiting to learn what her pardon has bought.'),
      h('div', { class: 'ending-stats' },
        h('div', {}, h('b', {}, s.level), ' level'), h('div', {}, h('b', {}, `${done}/${total}`), ' quests'),
        h('div', {}, h('b', {}, s.kills), ' foes defeated'), h('div', {}, h('b', {}, s.deaths), ' deaths')),
      h('p', { class: 'ending-note' }, 'This is the end of the vertical slice. Thank you for playing!'),
      h('div', { class: 'create-buttons' },
        h('button', { class: 'btn', onclick: () => this.close() }, 'Keep exploring'),
        h('button', { class: 'btn btn-dim', onclick: () => { g.save(true); this.quitToTitle(); } }, 'Return to title'))));
    this.show('ending', el);
  }

  // ------------------------------------------------------------------ workshop
  async openWorkshop() {
    const g = this.game;
    const { Workshop } = await import('../assets/workshop.js');
    if (!this.workshop) this.workshop = new Workshop(g, () => this.closeWorkshop());
    const wasState = this.current;
    this.returnTo = wasState === 'pause' ? () => this.showPause() : g.state === 'menu' ? () => this.showMain() : null;
    this.show('workshop', this.workshop.el, { pause: true });
    this.workshop.onShow();
  }

  closeWorkshop() {
    this.workshop?.onHide();
    this.close();
  }
}
