// Procedural icons for items, abilities and effects. Each is an asset slot (icon_<item>,
// icon_ab_<ability>, icon_fx_<effect>) that accepts a square PNG override.
import { registry } from '../assets/registry.js';
import { ITEMS } from '../data/items.js';
import { ABILITIES } from '../data/classes.js';

const S = 64;
const css = (hex, a = 1) => `rgba(${(hex >> 16) & 255},${(hex >> 8) & 255},${hex & 255},${a})`;
const shade = (hex, k) => {
  const r = Math.min(255, ((hex >> 16) & 255) * k), g = Math.min(255, ((hex >> 8) & 255) * k), b = Math.min(255, (hex & 255) * k);
  return (r << 16) | (g << 8) | b;
};

function frame(color, ability) {
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(S * 0.4, S * 0.35, 4, S / 2, S / 2, S * 0.75);
  g.addColorStop(0, css(shade(color, ability ? 0.75 : 0.5)));
  g.addColorStop(1, css(shade(color, ability ? 0.18 : 0.12)));
  x.fillStyle = g;
  x.fillRect(0, 0, S, S);
  x.lineJoin = 'round';
  x.lineCap = 'round';
  return { c, x };
}

function finish(x) {
  x.strokeStyle = 'rgba(0,0,0,0.6)';
  x.lineWidth = 3;
  x.strokeRect(1.5, 1.5, S - 3, S - 3);
  x.strokeStyle = 'rgba(255,230,180,0.12)';
  x.lineWidth = 1;
  x.strokeRect(3.5, 3.5, S - 7, S - 7);
}

function path(x, pts, fill, stroke = 'rgba(0,0,0,0.65)', lw = 2.5) {
  x.beginPath();
  pts.forEach(([a, b], i) => (i ? x.lineTo(a, b) : x.moveTo(a, b)));
  x.closePath();
  if (fill) { x.fillStyle = fill; x.fill(); }
  if (stroke) { x.strokeStyle = stroke; x.lineWidth = lw; x.stroke(); }
}
function circle(x, cx, cy, r, fill, stroke = 'rgba(0,0,0,0.6)', lw = 2.5) {
  x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2);
  if (fill) { x.fillStyle = fill; x.fill(); }
  if (stroke) { x.strokeStyle = stroke; x.lineWidth = lw; x.stroke(); }
}
function grad(x, x0, y0, x1, y1, a, b) {
  const g = x.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, a); g.addColorStop(1, b);
  return g;
}

const SHAPES = {
  sword(x, col) {
    x.save(); x.translate(32, 32); x.rotate(-Math.PI / 4);
    path(x, [[-4, -26], [4, -26], [4, 12], [-4, 12]], grad(x, -4, 0, 4, 0, css(shade(col, 1.3)), css(shade(col, 0.7))));
    path(x, [[-4, -26], [0, -32], [4, -26]], css(shade(col, 1.2)));
    path(x, [[-12, 12], [12, 12], [12, 16], [-12, 16]], '#b08d40');
    path(x, [[-2.5, 16], [2.5, 16], [2.5, 26], [-2.5, 26]], '#5a3a20');
    circle(x, 0, 28, 3.5, '#b08d40');
    x.restore();
  },
  dagger(x, col) {
    x.save(); x.translate(32, 34); x.rotate(-Math.PI / 4);
    path(x, [[-4, -18], [0, -26], [4, -18], [3, 6], [-3, 6]], grad(x, -4, 0, 4, 0, css(shade(col, 1.3)), css(shade(col, 0.7))));
    path(x, [[-9, 6], [9, 6], [9, 10], [-9, 10]], '#7a6040');
    path(x, [[-2.5, 10], [2.5, 10], [2.5, 20], [-2.5, 20]], '#3a2a2a');
    x.restore();
  },
  axe(x, col) {
    x.save(); x.translate(32, 32); x.rotate(-Math.PI / 5);
    path(x, [[-2.5, -24], [2.5, -24], [2.5, 28], [-2.5, 28]], '#7a5a3a');
    path(x, [[2, -20], [18, -28], [22, -10], [18, 6], [2, -4]], grad(x, 2, -20, 22, 0, css(shade(col, 1.3)), css(shade(col, 0.6))));
    x.restore();
  },
  mace(x, col) {
    x.save(); x.translate(32, 32); x.rotate(-Math.PI / 4);
    path(x, [[-2.5, -8], [2.5, -8], [2.5, 28], [-2.5, 28]], '#5a4030');
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      path(x, [[Math.cos(a) * 8, -16 + Math.sin(a) * 8], [Math.cos(a + 0.2) * 14, -16 + Math.sin(a + 0.2) * 14], [Math.cos(a + 0.4) * 8, -16 + Math.sin(a + 0.4) * 8]], css(shade(col, 0.9)), 'rgba(0,0,0,0.5)', 1.5);
    }
    circle(x, 0, -16, 10, grad(x, -10, -26, 10, -6, css(shade(col, 1.4)), css(shade(col, 0.6))));
    x.restore();
  },
  staff(x, col) {
    x.save(); x.translate(32, 32); x.rotate(-Math.PI / 4);
    path(x, [[-2.5, -18], [2.5, -18], [3, 30], [-3, 30]], '#6a5038');
    const g = x.createRadialGradient(0, -22, 1, 0, -22, 11);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.4, css(col)); g.addColorStop(1, css(shade(col, 0.4), 0.3));
    circle(x, 0, -22, 10, g, 'rgba(0,0,0,0.4)');
    x.restore();
  },
  shield(x, col) {
    path(x, [[12, 12], [52, 12], [50, 34], [32, 54], [14, 34]], grad(x, 12, 12, 52, 54, css(shade(col, 1.4)), css(shade(col, 0.6))));
    path(x, [[32, 14], [32, 52]], null, 'rgba(255,220,150,0.5)', 2);
    path(x, [[14, 26], [50, 26]], null, 'rgba(255,220,150,0.4)', 2);
    circle(x, 32, 28, 5, '#c0a050');
  },
  chest(x, col) {
    path(x, [[16, 14], [24, 10], [32, 14], [40, 10], [48, 14], [52, 26], [46, 28], [46, 54], [18, 54], [18, 28], [12, 26]], grad(x, 12, 10, 52, 54, css(shade(col, 1.5)), css(shade(col, 0.6))));
    path(x, [[32, 14], [32, 54]], null, 'rgba(0,0,0,0.35)', 2);
    path(x, [[18, 40], [46, 40]], null, 'rgba(255,220,150,0.35)', 2);
  },
  helm(x, col) {
    x.beginPath(); x.arc(32, 36, 20, Math.PI, 0); x.lineTo(52, 44); x.lineTo(12, 44); x.closePath();
    x.fillStyle = grad(x, 12, 16, 52, 44, css(shade(col, 1.5)), css(shade(col, 0.6))); x.fill();
    x.strokeStyle = 'rgba(0,0,0,0.6)'; x.lineWidth = 2.5; x.stroke();
    path(x, [[10, 44], [54, 44], [54, 49], [10, 49]], css(shade(col, 0.8)));
  },
  crown(x, col) {
    path(x, [[12, 46], [12, 22], [22, 32], [32, 14], [42, 32], [52, 22], [52, 46]], grad(x, 12, 14, 52, 46, css(shade(col, 1.5)), css(shade(col, 0.6))));
    circle(x, 32, 38, 4, '#ffffff', null);
  },
  boots(x, col) {
    path(x, [[20, 10], [34, 10], [34, 38], [50, 42], [52, 52], [18, 52], [18, 38]], grad(x, 18, 10, 52, 52, css(shade(col, 1.4)), css(shade(col, 0.55))));
    path(x, [[18, 46], [52, 46]], null, 'rgba(0,0,0,0.4)', 2);
  },
  legs(x, col) {
    path(x, [[18, 10], [46, 10], [48, 54], [36, 54], [32, 24], [28, 54], [16, 54]], grad(x, 16, 10, 48, 54, css(shade(col, 1.4)), css(shade(col, 0.55))));
    path(x, [[18, 16], [46, 16]], null, 'rgba(0,0,0,0.4)', 3);
  },
  gloves(x, col) {
    path(x, [[20, 54], [20, 30], [16, 22], [20, 18], [26, 26], [26, 12], [32, 12], [32, 24], [34, 10], [40, 10], [40, 26], [44, 16], [50, 18], [44, 36], [44, 54]], grad(x, 16, 10, 50, 54, css(shade(col, 1.4)), css(shade(col, 0.55))));
  },
  ring(x, col) {
    x.beginPath(); x.ellipse(32, 38, 16, 12, 0, 0, Math.PI * 2);
    x.strokeStyle = 'rgba(0,0,0,0.6)'; x.lineWidth = 9; x.stroke();
    x.strokeStyle = '#c8a050'; x.lineWidth = 6; x.stroke();
    circle(x, 32, 24, 7, css(col), 'rgba(0,0,0,0.6)');
    circle(x, 30, 22, 2, '#ffffff', null);
  },
  amulet(x, col) {
    x.beginPath(); x.moveTo(16, 10); x.quadraticCurveTo(32, 38, 48, 10);
    x.strokeStyle = '#c8a050'; x.lineWidth = 3; x.stroke();
    circle(x, 32, 40, 12, grad(x, 20, 28, 44, 52, css(shade(col, 1.5)), css(shade(col, 0.5))));
    circle(x, 32, 40, 4, '#111', null);
  },
  potion(x, col) {
    path(x, [[27, 10], [37, 10], [37, 22], [48, 34], [48, 50], [16, 50], [16, 34], [27, 22]], 'rgba(200,220,230,0.25)');
    path(x, [[17, 36], [47, 36], [47, 49], [17, 49]], grad(x, 0, 36, 0, 50, css(shade(col, 1.4)), css(shade(col, 0.6))), null);
    path(x, [[26, 6], [38, 6], [38, 11], [26, 11]], '#8a6a4a');
    circle(x, 24, 40, 2.5, 'rgba(255,255,255,0.7)', null);
  },
  potion_big(x, col) {
    circle(x, 32, 38, 16, 'rgba(200,220,230,0.25)');
    x.save(); x.beginPath(); x.arc(32, 38, 15, 0, Math.PI * 2); x.clip();
    x.fillStyle = grad(x, 0, 30, 0, 54, css(shade(col, 1.4)), css(shade(col, 0.6))); x.fillRect(10, 30, 44, 30); x.restore();
    path(x, [[28, 8], [36, 8], [36, 22], [28, 22]], 'rgba(200,220,230,0.3)');
    path(x, [[27, 5], [37, 5], [37, 10], [27, 10]], '#8a6a4a');
  },
  bread(x, col) {
    x.beginPath(); x.ellipse(32, 36, 22, 14, -0.2, 0, Math.PI * 2);
    x.fillStyle = grad(x, 10, 22, 54, 50, css(shade(col, 1.4)), css(shade(col, 0.6))); x.fill();
    x.strokeStyle = 'rgba(0,0,0,0.6)'; x.lineWidth = 2.5; x.stroke();
    for (let i = 0; i < 3; i++) path(x, [[22 + i * 9, 28], [27 + i * 9, 40]], null, 'rgba(60,30,10,0.6)', 2.5);
  },
  meat(x, col) {
    x.beginPath(); x.ellipse(28, 30, 16, 13, -0.6, 0, Math.PI * 2);
    x.fillStyle = grad(x, 12, 16, 44, 44, css(shade(col, 1.3)), css(shade(col, 0.6))); x.fill();
    x.strokeStyle = 'rgba(0,0,0,0.6)'; x.lineWidth = 2.5; x.stroke();
    path(x, [[36, 38], [50, 52]], null, '#e8e0c8', 6);
    circle(x, 51, 53, 4, '#e8e0c8');
  },
  bowl(x, col) {
    x.beginPath(); x.ellipse(32, 30, 20, 7, 0, 0, Math.PI * 2); x.fillStyle = css(col); x.fill();
    x.beginPath(); x.moveTo(12, 30); x.quadraticCurveTo(32, 62, 52, 30); x.fillStyle = '#7a5a3a'; x.fill();
    x.strokeStyle = 'rgba(0,0,0,0.6)'; x.lineWidth = 2.5; x.stroke();
    for (let i = 0; i < 3; i++) path(x, [[24 + i * 8, 22], [26 + i * 8, 12]], null, 'rgba(255,255,255,0.35)', 2);
  },
  mug(x, col) {
    path(x, [[16, 16], [42, 16], [40, 52], [18, 52]], '#8a6a4a');
    x.beginPath(); x.ellipse(29, 17, 13, 5, 0, 0, Math.PI * 2); x.fillStyle = '#f0e8d0'; x.fill();
    x.beginPath(); x.arc(44, 32, 8, -1.2, 1.2); x.strokeStyle = '#6a4a2a'; x.lineWidth = 4; x.stroke();
    path(x, [[18, 30], [41, 30]], null, css(col), 3);
  },
  scroll(x, col) {
    path(x, [[16, 14], [48, 14], [48, 50], [16, 50]], '#e8dcc0');
    circle(x, 16, 32, 5, '#c8b890'); circle(x, 48, 32, 5, '#c8b890');
    for (let i = 0; i < 4; i++) path(x, [[22, 22 + i * 7], [42, 22 + i * 7]], null, 'rgba(60,40,20,0.45)', 2);
    circle(x, 38, 44, 5, css(col), 'rgba(0,0,0,0.5)', 1.5);
  },
  letter(x, col) {
    path(x, [[12, 18], [52, 18], [52, 48], [12, 48]], css(shade(col, 1.0)));
    path(x, [[12, 18], [32, 34], [52, 18]], null, 'rgba(0,0,0,0.45)', 2);
    circle(x, 32, 36, 5, '#a02020', 'rgba(0,0,0,0.5)', 1.5);
  },
  book(x, col) {
    path(x, [[14, 12], [48, 12], [48, 54], [14, 54]], grad(x, 14, 12, 48, 54, css(shade(col, 1.5)), css(shade(col, 0.6))));
    path(x, [[48, 14], [52, 16], [52, 54], [48, 54]], '#e8dcc0');
    path(x, [[20, 24], [42, 24], [42, 32], [20, 32]], null, '#c8a050', 2);
  },
  claw(x, col) {
    x.beginPath(); x.moveTo(14, 50); x.quadraticCurveTo(20, 14, 50, 10); x.quadraticCurveTo(34, 26, 30, 50); x.closePath();
    x.fillStyle = grad(x, 14, 10, 50, 50, css(shade(col, 1.5)), css(shade(col, 0.6))); x.fill();
    x.strokeStyle = 'rgba(0,0,0,0.6)'; x.lineWidth = 2.5; x.stroke();
  },
  fang(x, col) {
    x.beginPath(); x.moveTo(22, 12); x.quadraticCurveTo(46, 14, 40, 54); x.quadraticCurveTo(30, 30, 22, 12);
    x.fillStyle = grad(x, 22, 12, 46, 54, '#ffffff', css(shade(col, 0.7))); x.fill();
    x.strokeStyle = 'rgba(0,0,0,0.6)'; x.lineWidth = 2.5; x.stroke();
  },
  bone(x) {
    path(x, [[20, 40], [40, 20]], null, '#e8e0c8', 7);
    for (const [a, b] of [[17, 37], [23, 43], [37, 17], [43, 23]]) circle(x, a, b, 5, '#e8e0c8');
  },
  hide(x, col) {
    path(x, [[14, 18], [24, 12], [40, 14], [52, 22], [48, 38], [52, 50], [34, 54], [18, 50], [12, 36]], grad(x, 12, 12, 52, 54, css(shade(col, 1.4)), css(shade(col, 0.55))));
  },
  pearl(x, col) {
    const g = x.createRadialGradient(26, 26, 2, 32, 32, 16);
    g.addColorStop(0, '#ffffff'); g.addColorStop(1, css(shade(col, 0.75)));
    circle(x, 32, 32, 14, g);
    path(x, [[30, 18], [36, 30]], null, 'rgba(80,60,60,0.5)', 1.5);
  },
  gem(x, col) {
    path(x, [[32, 10], [50, 26], [32, 54], [14, 26]], grad(x, 14, 10, 50, 54, css(shade(col, 1.6)), css(shade(col, 0.5))));
    path(x, [[14, 26], [50, 26]], null, 'rgba(255,255,255,0.4)', 1.5);
  },
  coin(x, col) {
    circle(x, 32, 34, 15, grad(x, 17, 19, 47, 49, css(shade(col, 1.5)), css(shade(col, 0.6))));
    circle(x, 32, 34, 9, null, 'rgba(60,40,0,0.5)', 2);
  },
  mushroom(x, col) {
    path(x, [[28, 30], [36, 30], [38, 52], [26, 52]], '#e0e8f0');
    x.beginPath(); x.arc(32, 32, 18, Math.PI, 0); x.closePath();
    const g = x.createRadialGradient(32, 24, 2, 32, 30, 20);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, css(col)); g.addColorStop(1, css(shade(col, 0.5)));
    x.fillStyle = g; x.fill(); x.strokeStyle = 'rgba(0,0,0,0.5)'; x.lineWidth = 2.5; x.stroke();
  },
  bottle(x, col) {
    path(x, [[28, 8], [36, 8], [36, 20], [44, 28], [44, 54], [20, 54], [20, 28], [28, 20]], grad(x, 20, 8, 44, 54, css(shade(col, 1.4)), css(shade(col, 0.5))));
    path(x, [[23, 34], [41, 34], [41, 44], [23, 44]], '#e8dcc0', 'rgba(0,0,0,0.4)', 1.5);
  },
  key(x, col) {
    circle(x, 22, 24, 10, null, css(col), 6);
    path(x, [[30, 30], [52, 52]], null, css(col), 6);
    path(x, [[44, 44], [50, 38]], null, css(col), 5);
    path(x, [[48, 48], [54, 42]], null, css(col), 5);
  },
};

const GLYPHS = {
  slash(x, col) {
    for (let i = 0; i < 3; i++) { x.beginPath(); x.moveTo(12 + i * 8, 52 - i * 2); x.quadraticCurveTo(30 + i * 4, 30, 52 - i * 2, 12 + i * 8); x.strokeStyle = css(shade(col, 1.6 - i * 0.25)); x.lineWidth = 5 - i; x.stroke(); }
  },
  shield: SHAPES.shield,
  charge(x, col) {
    for (let i = 0; i < 3; i++) path(x, [[12 + i * 12, 16], [26 + i * 12, 32], [12 + i * 12, 48]], null, css(shade(col, 1.5 - i * 0.3)), 5);
  },
  whirl(x, col) {
    x.beginPath();
    for (let a = 0; a < Math.PI * 5; a += 0.1) { const r = 2 + a * 1.6; x.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r); }
    x.strokeStyle = css(shade(col, 1.5)); x.lineWidth = 3.5; x.stroke();
  },
  heart(x, col) {
    x.beginPath(); x.moveTo(32, 52); x.bezierCurveTo(4, 32, 16, 8, 32, 22); x.bezierCurveTo(48, 8, 60, 32, 32, 52);
    x.fillStyle = grad(x, 10, 10, 54, 52, css(shade(col, 1.5)), css(shade(col, 0.6))); x.fill();
    x.strokeStyle = 'rgba(0,0,0,0.5)'; x.lineWidth = 2.5; x.stroke();
  },
  axe: SHAPES.axe,
  flame(x, col) {
    x.beginPath(); x.moveTo(32, 54); x.bezierCurveTo(10, 50, 14, 28, 26, 18); x.bezierCurveTo(24, 30, 32, 30, 32, 8); x.bezierCurveTo(46, 20, 54, 44, 32, 54);
    const g = x.createRadialGradient(32, 44, 2, 32, 36, 24); g.addColorStop(0, '#fff8c0'); g.addColorStop(0.4, css(col)); g.addColorStop(1, css(shade(col, 0.5)));
    x.fillStyle = g; x.fill();
  },
  shard(x, col) {
    path(x, [[12, 52], [40, 12], [52, 20], [22, 54]], grad(x, 12, 12, 52, 54, '#ffffff', css(col)), 'rgba(0,40,80,0.6)');
  },
  rune(x, col) {
    circle(x, 32, 32, 18, null, css(shade(col, 1.4)), 3);
    path(x, [[32, 16], [32, 48]], null, css(shade(col, 1.6)), 3);
    path(x, [[22, 24], [42, 40]], null, css(shade(col, 1.6)), 3);
    path(x, [[42, 24], [22, 40]], null, css(shade(col, 1.6)), 3);
  },
  snow(x, col) {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      path(x, [[32, 32], [32 + Math.cos(a) * 22, 32 + Math.sin(a) * 22]], null, css(shade(col, 1.5)), 3);
      path(x, [[32 + Math.cos(a) * 14, 32 + Math.sin(a) * 14], [32 + Math.cos(a + 0.4) * 19, 32 + Math.sin(a + 0.4) * 19]], null, css(shade(col, 1.5)), 2);
    }
  },
  ward(x, col) {
    const g = x.createRadialGradient(32, 32, 4, 32, 32, 22); g.addColorStop(0, 'rgba(255,255,255,0.1)'); g.addColorStop(0.8, css(col, 0.6)); g.addColorStop(1, css(shade(col, 1.5)));
    circle(x, 32, 32, 21, g, css(shade(col, 1.6)), 2);
  },
  meteor(x, col) {
    for (let i = 0; i < 4; i++) path(x, [[46 - i * 4, 18 - i * 3], [18, 46]], null, css(shade(col, 1.2), 0.5), 3);
    const g = x.createRadialGradient(42, 22, 1, 42, 22, 12); g.addColorStop(0, '#fff8c0'); g.addColorStop(1, css(col));
    circle(x, 42, 22, 10, g, null);
  },
  fangs(x, col) {
    for (const dx of [-8, 8]) { x.beginPath(); x.moveTo(32 + dx - 6, 14); x.quadraticCurveTo(32 + dx, 30, 32 + dx * 0.3, 52); x.quadraticCurveTo(32 + dx + 2, 30, 32 + dx + 6, 14); x.fillStyle = css(shade(col, 1.3)); x.fill(); x.strokeStyle = 'rgba(0,0,0,0.5)'; x.lineWidth = 2; x.stroke(); }
  },
  knife: SHAPES.dagger,
  eye(x, col) {
    x.beginPath(); x.moveTo(10, 32); x.quadraticCurveTo(32, 10, 54, 32); x.quadraticCurveTo(32, 54, 10, 32);
    x.fillStyle = '#f0e8e0'; x.fill(); x.strokeStyle = 'rgba(0,0,0,0.6)'; x.lineWidth = 2.5; x.stroke();
    circle(x, 32, 32, 9, css(col)); circle(x, 32, 32, 4, '#111', null);
    path(x, [[16, 48], [48, 16]], null, '#c03030', 4);
  },
  drop(x, col) {
    x.beginPath(); x.moveTo(32, 10); x.bezierCurveTo(46, 30, 50, 40, 32, 52); x.bezierCurveTo(14, 40, 18, 30, 32, 10);
    x.fillStyle = grad(x, 14, 10, 50, 52, css(shade(col, 1.6)), css(shade(col, 0.6))); x.fill();
    x.strokeStyle = 'rgba(0,0,0,0.5)'; x.lineWidth = 2.5; x.stroke();
  },
  step(x, col) {
    for (let i = 0; i < 3; i++) { x.beginPath(); x.ellipse(18 + i * 13, 46 - i * 13, 6, 9, 0.6, 0, Math.PI * 2); x.fillStyle = css(shade(col, 1.5 - i * 0.3), 0.9 - i * 0.2); x.fill(); }
  },
  stars(x, col) {
    for (const [cx, cy, r] of [[22, 24, 9], [42, 22, 7], [32, 42, 8]]) {
      x.beginPath();
      for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? r * 0.45 : r; x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
      x.closePath(); x.fillStyle = css(col); x.fill();
    }
  },
  chain(x, col) {
    for (let i = 0; i < 4; i++) { x.beginPath(); x.ellipse(16 + i * 11, 18 + i * 9, 8, 5, 0.7, 0, Math.PI * 2); x.strokeStyle = css(shade(col, 1.4)); x.lineWidth = 3.5; x.stroke(); }
  },
  snail(x, col) {
    x.beginPath(); for (let a = 0; a < Math.PI * 4; a += 0.1) { const r = 1 + a * 1.4; x.lineTo(36 + Math.cos(a) * r, 30 + Math.sin(a) * r); }
    x.strokeStyle = css(shade(col, 1.5)); x.lineWidth = 3; x.stroke();
    path(x, [[10, 46], [50, 46]], null, css(shade(col, 1.2)), 4);
  },
  wave(x, col) {
    for (let i = 0; i < 3; i++) { x.beginPath(); for (let px = 10; px <= 54; px += 2) x.lineTo(px, 22 + i * 10 + Math.sin(px / 5) * 4); x.strokeStyle = css(shade(col, 1.6 - i * 0.3)); x.lineWidth = 3; x.stroke(); }
  },
};

export function drawItemIcon(id) {
  const it = ITEMS[id];
  const [shape, color] = it.icon || ['gem', 0x888888];
  const { c, x } = frame(color, false);
  (SHAPES[shape] || SHAPES.gem)(x, color);
  finish(x);
  return c;
}

export function drawAbilityIcon(id) {
  const ab = ABILITIES[id];
  const [glyph, color] = ab.icon || ['rune', 0xaaaaaa];
  const { c, x } = frame(color, true);
  (GLYPHS[glyph] || SHAPES[glyph] || GLYPHS.rune)(x, color);
  finish(x);
  return c;
}

function drawFx(glyph, color) {
  const { c, x } = frame(color, true);
  GLYPHS[glyph](x, color);
  finish(x);
  return c;
}

export function defineIconSlots() {
  for (const id of Object.keys(ITEMS)) {
    registry.define({ id: `icon_${id}`, kind: 'icon', category: 'Icons: items', label: ITEMS[id].name, build: () => drawItemIcon(id), description: 'Square PNG, 64×64 or larger.' });
  }
  for (const id of Object.keys(ABILITIES)) {
    registry.define({ id: `icon_ab_${id}`, kind: 'icon', category: 'Icons: abilities', label: ABILITIES[id].name, build: () => drawAbilityIcon(id), description: 'Square PNG, 64×64 or larger.' });
  }
  const fx = { stun: ['stars', 0xffe060], root: ['chain', 0x9ae0ff], slow: ['snail', 0x9ab0ff], blessing: ['wave', 0x80d0ff], well_fed: ['heart', 0xe0a050], tipsy: ['drop', 0xd0a040], skyleap: ['charge', 0x8a5aff], featherfall: ['ward', 0x5ad0ff] };
  for (const [id, [g, col]] of Object.entries(fx)) {
    registry.define({ id: `icon_fx_${id}`, kind: 'icon', category: 'Icons: effects', label: id.replace('_', ' '), build: () => drawFx(g, col) });
  }
}
