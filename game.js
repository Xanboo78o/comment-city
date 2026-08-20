// COMMENT CITY (working title) — the game the comments build.
// RULE: anything without art renders as THE TILE, labeled with the file it's waiting for.
// Adam's pipeline: export SVG at 64-scale -> drop in art/ with the right name -> refresh.

const TILE = 64;
const VIEW_H = TILE * 11;            // 11 tiles of world visible vertically
const GROUND_TILE_Y = 8;             // ground surface = bottom of tile row 8
const GROUND_Y = GROUND_TILE_Y * TILE;

// ---------- hand-authored city layout (edit by hand, never generate) ----------
// x/w/h in tiles. Buildings sit on the ground line.
const WORLD_W_TILES = 64;
const CITY = [
  { slot: 'apartment-facade', x: 3,  w: 5, h: 4, label: "JIM'S APARTMENT" },
  { slot: 'streetlight',      x: 9,  w: 1, h: 3 },
  { slot: 'burger-facade',    x: 11, w: 6, h: 3, label: 'BURGER JOB' },
  { slot: 'bench',            x: 18, w: 2, h: 1 },
  { slot: 'store-facade',     x: 21, w: 5, h: 3, label: 'CONVENIENCE STORE' },
  { slot: 'trashcan',         x: 27, w: 1, h: 1 },
  { slot: 'filler-1',         x: 29, w: 4, h: 4 },
  { slot: 'atm',              x: 34, w: 1, h: 2 },
  { slot: 'job2-facade',      x: 36, w: 5, h: 3, label: 'JOB #2 (TBD)' },
  { slot: 'streetlight',      x: 42, w: 1, h: 3 },
  { slot: 'filler-2',         x: 44, w: 6, h: 5 },
  { slot: 'construction',     x: 52, w: 6, h: 4, label: 'COMING SOON' },
  { slot: 'streetlight',      x: 59, w: 1, h: 3 },
];

// ---------- asset slots: filename (art/<slot>.svg) + expected size ----------
const SLOT_SIZES = {
  'player': [1, 1.5], 'npc': [1, 1.5], 'cop': [1, 1.5], 'shopkeeper': [1, 1.5],
  'skyline': [20, 5],
};

// ---------- asset loader ----------
const art = {};   // slot -> { img, ok }
function loadArt(slot) {
  if (art[slot]) return art[slot];
  const entry = { img: new Image(), ok: false };
  entry.img.onload = () => { entry.ok = true; };
  entry.img.src = 'art/' + slot + '.svg';
  art[slot] = entry;
  return entry;
}
['the-tile', 'dirt', 'grass', 'player', 'npc', 'skyline',
 ...CITY.map(b => b.slot)].forEach(loadArt);

// ---------- canvas ----------
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let scale = 1, viewW = 0;
function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  scale = canvas.height / VIEW_H;
  viewW = canvas.width / scale;
}
addEventListener('resize', resize);
resize();

// draw a slot at world coords; missing art -> THE TILE grid + filename label
function drawSlot(slot, x, y, w, h, flip) {
  const a = loadArt(slot);
  if (a.ok) {
    ctx.save();
    if (flip) { ctx.translate(x + w, y); ctx.scale(-1, 1); ctx.drawImage(a.img, 0, 0, w, h); }
    else ctx.drawImage(a.img, x, y, w, h);
    ctx.restore();
    return;
  }
  const t = art['the-tile'];
  for (let ty = 0; ty < h; ty += TILE) {
    for (let tx = 0; tx < w; tx += TILE) {
      // +1px bleed except at the footprint edge, so seams never show background
      const tw = Math.min(TILE, w - tx) + (tx + TILE < w ? 1 : 0);
      const th = Math.min(TILE, h - ty) + (ty + TILE < h ? 1 : 0);
      if (t && t.ok) ctx.drawImage(t.img, x + tx, y + ty, tw, th);
      else { ctx.fillStyle = '#f0f'; ctx.fillRect(x + tx, y + ty, tw, th); }
    }
  }
  ctx.font = 'bold 11px monospace';
  ctx.textBaseline = 'top';
  const name = slot + '.svg';
  const size = (w / TILE) + 'x' + (h / TILE) + ' tiles';
  const chipW = Math.max(ctx.measureText(name).width, ctx.measureText(size).width) + 8;
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fillRect(x + 3, y + 3, chipW, 28);
  ctx.fillStyle = '#000';
  ctx.fillText(name, x + 7, y + 6);
  ctx.font = '10px monospace';
  ctx.fillText(size, x + 7, y + 19);
}

// tile one slot across a horizontal strip
function tileStrip(slot, y, fromX, toX) {
  const startTx = Math.floor(fromX / TILE), endTx = Math.ceil(toX / TILE);
  for (let tx = startTx; tx <= endTx; tx++) {
    if (tx < 0 || tx >= WORLD_W_TILES) continue;
    const a = art[slot];
    if (a && a.ok) ctx.drawImage(a.img, tx * TILE, y, TILE + 1, TILE + 1);
    else drawSlot(slot, tx * TILE, y, TILE, TILE);
  }
}

// ---------- player ----------
const player = {
  x: 8 * TILE, w: TILE, h: TILE * 1.5,
  vx: 0, facing: 1, speed: 300,
};

// ---------- NPCs pacing the street ----------
const npcs = [
  { x: 14 * TILE, min: 11 * TILE, max: 18 * TILE, v: 60 },
  { x: 30 * TILE, min: 27 * TILE, max: 34 * TILE, v: -60 },
];

// ---------- input: keyboard + touch halves ----------
const keys = {};
addEventListener('keydown', e => keys[e.code] = true);
addEventListener('keyup', e => keys[e.code] = false);
let touchDir = 0;
canvas.addEventListener('pointerdown', e => { touchDir = (e.clientX < innerWidth / 2) ? -1 : 1; });
canvas.addEventListener('pointerup', () => touchDir = 0);
canvas.addEventListener('pointercancel', () => touchDir = 0);

// ---------- spawn speech bubble ----------
let bubbleTimer = 6;
const BUBBLE_TEXT = 'nothing here is real yet. that’s your job.';

function bubble(text, wx, wy) {
  ctx.font = 'bold 14px monospace';
  const tw = ctx.measureText(text).width;
  const bw = tw + 20, bh = 28;
  const bx = wx - bw / 2, by = wy - bh - 14;
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(bx, by, bw, bh, 8);
  ctx.fill(); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(wx - 6, by + bh); ctx.lineTo(wx + 6, by + bh); ctx.lineTo(wx, by + bh + 10);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#000';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, bx + 10, by + bh / 2 + 1);
}

// ---------- main loop ----------
let last = performance.now();
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;

  // update
  let dir = 0;
  if (keys['ArrowLeft'] || keys['KeyA']) dir -= 1;
  if (keys['ArrowRight'] || keys['KeyD']) dir += 1;
  dir = dir || touchDir;
  player.vx = dir * player.speed;
  if (dir) player.facing = dir;
  player.x += player.vx * dt;
  player.x = Math.max(0, Math.min(WORLD_W_TILES * TILE - player.w, player.x));
  if (bubbleTimer > 0) bubbleTimer -= dt;

  for (const n of npcs) {
    n.x += n.v * dt;
    if (n.x < n.min) { n.x = n.min; n.v *= -1; }
    if (n.x > n.max) { n.x = n.max; n.v *= -1; }
  }

  // camera
  const camX = Math.max(0, Math.min(WORLD_W_TILES * TILE - viewW, player.x + player.w / 2 - viewW / 2));

  // draw
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  const sky = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
  sky.addColorStop(0, '#7ec8ff');
  sky.addColorStop(1, '#cfeaff');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, viewW, VIEW_H);

  // parallax skyline (slot; THE TILE until drawn)
  ctx.save();
  ctx.translate(-camX * 0.3, 0);
  const skW = SLOT_SIZES['skyline'][0] * TILE, skH = SLOT_SIZES['skyline'][1] * TILE;
  for (let sx = 0; sx < WORLD_W_TILES * TILE; sx += skW) {
    const a = art['skyline'];
    if (a && a.ok) ctx.drawImage(a.img, sx, GROUND_Y - skH, skW, skH);
  }
  ctx.restore();

  ctx.save();
  ctx.translate(-camX, 0);

  // ground: grass surface row, dirt below
  tileStrip('grass', GROUND_Y, camX, camX + viewW);
  for (let row = 1; row <= 2; row++) tileStrip('dirt', GROUND_Y + row * TILE, camX, camX + viewW);

  // buildings + props (sit on ground line)
  for (const b of CITY) {
    const bx = b.x * TILE, bw = b.w * TILE, bh = b.h * TILE;
    drawSlot(b.slot, bx, GROUND_Y - bh, bw, bh);
    if (b.label) {
      ctx.font = 'bold 12px monospace';
      ctx.textBaseline = 'bottom';
      const lw = ctx.measureText(b.label).width;
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillRect(bx + bw / 2 - lw / 2 - 4, GROUND_Y - bh - 20, lw + 8, 16);
      ctx.fillStyle = '#000';
      ctx.fillText(b.label, bx + bw / 2 - lw / 2, GROUND_Y - bh - 6);
    }
  }

  // NPCs
  for (const n of npcs) drawSlot('npc', n.x, GROUND_Y - TILE * 1.5, TILE, TILE * 1.5, n.v < 0);

  // player
  drawSlot('player', player.x, GROUND_Y - player.h, player.w, player.h, player.facing < 0);

  if (bubbleTimer > 0) bubble(BUBBLE_TEXT, player.x + player.w / 2, GROUND_Y - player.h);

  ctx.restore();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
