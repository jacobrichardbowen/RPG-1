// Parchment map of the island, rendered once from the terrain, plus minimap/world-map drawing.
import { TERRAIN_HALF } from '../world/terrain.js';
import { ROADS, BUILDINGS, ZONES, DOCK } from '../world/layout.js';
import { TileNoise } from '../core/noise.js';

const MAP_PX = 768;
const WORLD = 640; // meters covered by the map image (centered at 0,0)

export function worldToMap(x, z, size = MAP_PX) {
  return [((x + WORLD / 2) / WORLD) * size, ((z + WORLD / 2) / WORLD) * size];
}

export function renderMapImage(terrain) {
  const c = document.createElement('canvas');
  c.width = c.height = MAP_PX;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(MAP_PX, MAP_PX);
  const d = img.data;
  const n = new TileNoise(7);
  const step = WORLD / MAP_PX;
  for (let py = 0; py < MAP_PX; py++) {
    for (let px = 0; px < MAP_PX; px++) {
      const x = -WORLD / 2 + px * step, z = -WORLD / 2 + py * step;
      const h = terrain.heightAt(x, z);
      const hx = terrain.heightAt(x + step, z), hz = terrain.heightAt(x, z + step);
      const shadeL = Math.max(-1, Math.min(1, ((h - hx) + (h - hz)) * 0.9));
      const paper = n.fbm(px / MAP_PX, py / MAP_PX, 6, 4);
      let r, g, b;
      if (h < 0) {
        const deep = Math.min(1, -h / 14);
        r = 168 - deep * 50; g = 178 - deep * 40; b = 168 - deep * 22;
        // Contour ring near the shore.
        if (h > -0.6) { r -= 20; g -= 18; b -= 12; }
      } else {
        const marsh = terrain.marshAt(x, z);
        r = 214 - h * 1.1; g = 196 - h * 1.0; b = 150 - h * 1.2;
        if (marsh > 0.4) { r -= 22; g -= 10; b -= 18; }
        if (h < 1.4) { r += 10; g += 8; b -= 4; }
        r += shadeL * 34; g += shadeL * 30; b += shadeL * 24;
        // Contour lines every 6 m.
        const band = h % 6;
        if (h > 3 && band < 0.35) { r -= 26; g -= 26; b -= 22; }
        const road = terrain.roadAt(x, z);
        if (road > 0.5) { r = r * 0.62; g = g * 0.55; b = b * 0.48; }
      }
      const k = 0.9 + paper * 0.2;
      const i = (py * MAP_PX + px) * 4;
      d[i] = r * k; d[i + 1] = g * k; d[i + 2] = b * k; d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  // Buildings as small inked blocks.
  ctx.fillStyle = 'rgba(70,45,25,0.85)';
  for (const bd of BUILDINGS) {
    if (bd.type === 'cult_camp') continue;
    const [mx, my] = worldToMap(bd.x, bd.z);
    const s = bd.type === 'tavern' || bd.type === 'hall' ? 9 : bd.type === 'spire' ? 10 : 5;
    ctx.save(); ctx.translate(mx, my); ctx.rotate(-bd.rot);
    if (bd.type === 'spire' || bd.type === 'lighthouse' || bd.type === 'shrine' || bd.type === 'bog_hut') { ctx.beginPath(); ctx.arc(0, 0, s / 2, 0, 7); ctx.fill(); }
    else ctx.fillRect(-s / 2, -s / 2.6, s, s / 1.3);
    ctx.restore();
  }
  const [dx0, dy0] = worldToMap(DOCK.x - DOCK.width / 2, DOCK.z0);
  const [dx1, dy1] = worldToMap(DOCK.x + DOCK.width / 2, DOCK.z1);
  ctx.fillRect(dx0, dy0, dx1 - dx0, dy1 - dy0);
  // Vignette edge
  const g = ctx.createRadialGradient(MAP_PX / 2, MAP_PX / 2, MAP_PX * 0.35, MAP_PX / 2, MAP_PX / 2, MAP_PX * 0.72);
  g.addColorStop(0, 'rgba(60,40,20,0)');
  g.addColorStop(1, 'rgba(60,40,20,0.45)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, MAP_PX, MAP_PX);
  void ROADS;
  return c;
}

export function drawMarker(ctx, kind, x, y, s = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  switch (kind) {
    case 'player':
      break;
    case '!': case 'q': case '!gray': case 'qgray': {
      const gray = kind.endsWith('gray');
      ctx.font = 'bold 15px Georgia, serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 3; ctx.strokeStyle = '#2a1a00';
      const ch = kind.startsWith('q') ? '?' : '!';
      ctx.strokeText(ch, 0, 0);
      ctx.fillStyle = gray ? '#a8a8a8' : '#ffd100';
      ctx.fillText(ch, 0, 0);
      break;
    }
    case 'npc':
      ctx.fillStyle = '#e8d070'; ctx.strokeStyle = '#3a2a00'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(0, 0, 2.6, 0, 7); ctx.fill(); ctx.stroke();
      break;
    case 'enemy':
      ctx.fillStyle = '#e03a2a'; ctx.strokeStyle = '#300'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(0, 0, 2.6, 0, 7); ctx.fill(); ctx.stroke();
      break;
    case 'elite':
      ctx.fillStyle = '#ffb020'; ctx.strokeStyle = '#300'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(0, 0, 4, 0, 7); ctx.fill(); ctx.stroke();
      break;
    case 'herb':
      ctx.fillStyle = '#5ad0ff'; ctx.strokeStyle = '#013'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(0, 0, 2.6, 0, 7); ctx.fill(); ctx.stroke();
      break;
    default: break;
  }
  ctx.restore();
}

export function drawPlayerArrow(ctx, x, y, yaw, s = 1) {
  ctx.save();
  ctx.translate(x, y);
  // Map up is -Z (north); yaw 0 faces +Z (south).
  ctx.rotate(Math.PI - yaw);
  ctx.scale(s, s);
  ctx.beginPath();
  ctx.moveTo(0, -8); ctx.lineTo(5.5, 6); ctx.lineTo(0, 3); ctx.lineTo(-5.5, 6); ctx.closePath();
  ctx.fillStyle = '#fff4c0'; ctx.strokeStyle = '#2a1a00'; ctx.lineWidth = 2;
  ctx.stroke(); ctx.fill();
  ctx.restore();
}

export { MAP_PX, WORLD, ZONES, TERRAIN_HALF };
