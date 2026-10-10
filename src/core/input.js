// Keyboard and mouse state with rebindable actions.
export const DEFAULT_BINDINGS = {
  forward: ['KeyW', 'ArrowUp'], back: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
  jump: ['Space'], sprint: ['ShiftLeft', 'ShiftRight'], walk: ['KeyZ'], autorun: ['KeyR', 'NumLock'],
  interact: ['KeyE', 'KeyF'], target: ['Tab'], bags: ['KeyI', 'KeyB'], character: ['KeyC'], journal: ['KeyJ', 'KeyL'],
  map: ['KeyM'], spellbook: ['KeyP', 'KeyK'], camera: ['KeyV'], mouselook: ['KeyT'], workshop: ['F10'],
  quicksave: ['F5'], quickload: ['F9'], menu: ['Escape'],
  bar1: ['Digit1'], bar2: ['Digit2'], bar3: ['Digit3'], bar4: ['Digit4'], bar5: ['Digit5'],
  bar6: ['Digit6'], bar7: ['Digit7'], bar8: ['Digit8'], bar9: ['Digit9'], bar10: ['Digit0'],
  help: ['F1'],
};

export class Input {
  constructor(el) {
    this.el = el;
    this.keys = new Set();
    this.pressed = new Set(); // keys pressed since last frame
    this.buttons = 0;
    this.mouse = { x: 0, y: 0, dx: 0, dy: 0, wheel: 0, downX: 0, downY: 0, dragDist: 0 };
    this.clicks = []; // {button, x, y}
    this.bindings = structuredClone(DEFAULT_BINDINGS);
    this.enabled = true;
    this.pointerLocked = false;
    this.listeners = [];
    this.onKey = null; // hook for UI shortcuts
    const on = (t, ev, fn, opt) => { t.addEventListener(ev, fn, opt); this.listeners.push([t, ev, fn, opt]); };
    on(window, 'keydown', (e) => {
      if (isTyping(e)) return;
      if (['Tab', 'Space', 'F1', 'F5', 'F9', 'F10', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.keys.add(e.code);
      if (this.onKey && !e.repeat) this.onKey(e);
    });
    on(window, 'keyup', (e) => this.keys.delete(e.code));
    on(window, 'blur', () => { this.keys.clear(); this.buttons = 0; });
    on(el, 'mousedown', (e) => {
      this.buttons |= 1 << e.button;
      this.mouse.downX = e.clientX; this.mouse.downY = e.clientY; this.mouse.dragDist = 0;
      if (e.button === 1) e.preventDefault();
    });
    on(window, 'mouseup', (e) => {
      const was = this.buttons & (1 << e.button);
      this.buttons &= ~(1 << e.button);
      if (was && this.mouse.dragDist < 6 && e.target === el) this.clicks.push({ button: e.button, x: e.clientX, y: e.clientY });
    });
    on(window, 'mousemove', (e) => {
      this.mouse.x = e.clientX; this.mouse.y = e.clientY;
      if (this.buttons || this.pointerLocked) {
        this.mouse.dx += e.movementX || 0;
        this.mouse.dy += e.movementY || 0;
        this.mouse.dragDist += Math.abs(e.movementX || 0) + Math.abs(e.movementY || 0);
      }
    });
    on(el, 'wheel', (e) => { this.mouse.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
    on(el, 'contextmenu', (e) => e.preventDefault());
    on(document, 'pointerlockchange', () => { this.pointerLocked = document.pointerLockElement === el; });
  }

  down(action) {
    if (!this.enabled) return false;
    const b = this.bindings[action];
    return b ? b.some((k) => this.keys.has(k)) : false;
  }
  hit(action) {
    if (!this.enabled) return false;
    const b = this.bindings[action];
    return b ? b.some((k) => this.pressed.has(k)) : false;
  }
  mouseDown(button) { return !!(this.buttons & (1 << button)); }
  keyFor(action) {
    const b = this.bindings[action];
    return b && b[0] ? prettyKey(b[0]) : '';
  }

  requestLock() {
    try {
      const p = this.el.requestPointerLock && this.el.requestPointerLock();
      if (p && p.catch) p.catch(() => {});
    } catch (e) { /* pointer lock unavailable */ }
  }
  exitLock() { try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) { /* ignore */ } }

  endFrame() {
    this.pressed.clear();
    this.mouse.dx = 0; this.mouse.dy = 0; this.mouse.wheel = 0;
    this.clicks.length = 0;
  }
}

function isTyping(e) {
  const t = e.target;
  return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
}

export function prettyKey(code) {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  const map = { Space: 'Space', ShiftLeft: 'Shift', ShiftRight: 'Shift', Escape: 'Esc', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Tab: 'Tab', NumLock: 'NumLk' };
  return map[code] || code;
}
