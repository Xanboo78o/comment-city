// COMMENT CITY (working title) — the game the comments build.
// RULE: anything without art renders as THE TILE, labeled with the file it's waiting for.
// Adam's pipeline: export SVG at 64-scale -> drop in art/ with the right name -> refresh.
//
// 2.5D street-band layout (beat-em-up style): buildings at the back, walkable
// sidewalk band with a depth axis, road with traffic along the front edge.

const TILE = 64;
const BLEED = 10;              // how far each tile overlaps the previous one
const STEP = TILE - BLEED;     // grid spacing: tiles drawn at natural 64, stepped 54, never stretched
const VIEW_H = TILE * 11;      // 704 world-px of world visible vertically

// screen rows of the street (top to bottom). No horizon — Stardew-style ground
// plane: grass everywhere, buildings stand on it, road along the front.
const BAND_TOP = 416;                    // back edge of walkable band; buildings sit on this line
const BAND_DEPTH = 160;                  // z axis: 0 = back (at the doors), BAND_DEPTH = curb
const ROAD_TOP = BAND_TOP + BAND_DEPTH;  // 576
const ROAD_H = TILE * 2;                 // road is exactly 2 tiles: center line sits on the row seam

// ---------- hand-authored city layout (edit by hand, never generate) ----------
// x/w/h in tiles. Buildings sit on the band's back edge.
const WORLD_W_TILES = 64;
const WORLD_W = WORLD_W_TILES * TILE;
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

// ---------- asset loader ----------
// Adam draws road line tiles with the line running vertically; the street runs
// horizontally, so these get rotated 90° when pre-rastered.
const ROTATED = new Set(['road-center', 'road-dash', 'road-line']);
const art = {};   // slot -> { img, bmp, ok }
function loadArt(slot) {
  if (art[slot]) return art[slot];
  const entry = { img: new Image(), ok: false };
  entry.img.onload = () => {
    // pre-raster at natural size for the heavy tiled draws (full-screen grass)
    const w = Math.max(1, Math.round(entry.img.naturalWidth));
    const h = Math.max(1, Math.round(entry.img.naturalHeight));
    const cv = document.createElement('canvas');
    const c = cv.getContext('2d');
    if (ROTATED.has(slot)) {
      cv.width = h; cv.height = w;
      c.translate(h, 0); c.rotate(Math.PI / 2);
      // line decals lie on top of asphalt: crop off the tile's outer border
      c.drawImage(entry.img, -6, -6, w + 12, h + 12);
    } else {
      cv.width = w; cv.height = h;
      c.drawImage(entry.img, 0, 0, w, h);
    }
    entry.bmp = cv;
    entry.ok = true;
  };
  entry.img.src = 'art/' + slot + '.svg';
  art[slot] = entry;
  return entry;
}
['the-tile', 'dirt', 'grass', 'asphalt', 'asphalt-crack', 'road-center', 'road-dash', 'road-line', 'car', 'player', 'npc',
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

// draw a slot at world coords; missing art -> ONE big THE TILE over the whole
// footprint (single outline, giant X) + a chip naming the file it waits for
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
  if (t && t.ok) ctx.drawImage(t.img, x, y, w, h);
  else { ctx.fillStyle = '#f0f'; ctx.fillRect(x, y, w, h); }
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

// tile one slot across a horizontal strip.
// step: STEP overlaps borders into one line (grass/dirt); TILE = exact grid so
// painted road lines and dashes stay true to the tile art.
function tileStrip(slot, y, fromX, toX, step = STEP) {
  const startTx = Math.floor(fromX / step), endTx = Math.ceil(toX / step);
  for (let tx = startTx; tx <= endTx; tx++) {
    const x = tx * step;
    if (x < 0 || x >= WORLD_W) continue;
    const a = art[slot];
    if (a && a.ok) ctx.drawImage(a.bmp || a.img, x, y, TILE, TILE);
    else drawSlot(slot, x, y, TILE, TILE);
  }
}

// ---------- player ----------
const player = {
  x: 8 * TILE, z: 80, w: TILE, h: TILE * 1.5,
  facing: 1, speedX: 300, speedZ: 220,
};

// ---------- NPCs pacing the street at fixed depths ----------
const npcs = [
  { x: 14 * TILE, z: 40,  min: 11 * TILE, max: 18 * TILE, v: 60 },
  { x: 30 * TILE, z: 120, min: 27 * TILE, max: 34 * TILE, v: -60 },
];

// ---------- traffic ----------
const LANES = [
  { y: ROAD_TOP + 58, dir: -1, speed: 260 },   // far lane (top row), leftward
  { y: ROAD_TOP + 124, dir: 1, speed: 300 },   // near lane (bottom row), rightward
];
const CAR_W = TILE * 2, CAR_H = TILE;
const cars = [];
for (let l = 0; l < LANES.length; l++)
  for (let i = 0; i < 3; i++)
    cars.push({ lane: l, x: i * 1400 + l * 500 });

// ---------- input: keyboard + drag joystick ----------
const keys = {};
addEventListener('keydown', e => keys[e.code] = true);
addEventListener('keyup', e => keys[e.code] = false);
let joy = null;
canvas.addEventListener('pointerdown', e => { joy = { id: e.pointerId, sx: e.clientX, sy: e.clientY, dx: 0, dy: 0 }; });
canvas.addEventListener('pointermove', e => {
  if (joy && e.pointerId === joy.id) { joy.dx = e.clientX - joy.sx; joy.dy = e.clientY - joy.sy; }
});
canvas.addEventListener('pointerup', () => joy = null);
canvas.addEventListener('pointercancel', () => joy = null);

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

  // input -> movement (x along street, z into its depth)
  let dx = 0, dz = 0;
  if (keys['ArrowLeft'] || keys['KeyA']) dx -= 1;
  if (keys['ArrowRight'] || keys['KeyD']) dx += 1;
  if (keys['ArrowUp'] || keys['KeyW']) dz -= 1;
  if (keys['ArrowDown'] || keys['KeyS']) dz += 1;
  if (!dx && !dz && joy) {
    const len = Math.hypot(joy.dx, joy.dy);
    if (len > 12) { dx = joy.dx / len; dz = joy.dy / len; }
  }
  player.x += dx * player.speedX * dt;
  player.z += dz * player.speedZ * dt;
  if (dx) player.facing = Math.sign(dx);
  player.x = Math.max(0, Math.min(WORLD_W - player.w, player.x));
  player.z = Math.max(0, Math.min(BAND_DEPTH, player.z));
  if (bubbleTimer > 0) bubbleTimer -= dt;

  for (const n of npcs) {
    n.x += n.v * dt;
    if (n.x < n.min) { n.x = n.min; n.v *= -1; }
    if (n.x > n.max) { n.x = n.max; n.v *= -1; }
  }

  for (const c of cars) {
    const lane = LANES[c.lane];
    c.x += lane.dir * lane.speed * dt;
    if (lane.dir > 0 && c.x > WORLD_W + 200) c.x = -CAR_W - 200;
    if (lane.dir < 0 && c.x < -CAR_W - 200) c.x = WORLD_W + 200;
  }

  // camera
  const camX = Math.max(0, Math.min(WORLD_W - viewW, player.x + player.w / 2 - viewW / 2));

  // draw
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.save();
  ctx.translate(-camX, 0);

  // no horizon: grass ground plane fills everything behind the road
  for (let y = 0; y < ROAD_TOP; y += STEP) tileStrip('grass', y, camX, camX + viewW);

  // buildings standing on the ground plane
  for (const b of CITY) {
    const bx = b.x * TILE, bw = b.w * TILE, bh = b.h * TILE;
    drawSlot(b.slot, bx, BAND_TOP - bh, bw, bh);
    if (b.label) {
      ctx.font = 'bold 12px monospace';
      ctx.textBaseline = 'bottom';
      const lw = ctx.measureText(b.label).width;
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillRect(bx + bw / 2 - lw / 2 - 4, BAND_TOP - bh - 20, lw + 8, 16);
      ctx.fillStyle = '#000';
      ctx.fillText(b.label, bx + bw / 2 - lw / 2, BAND_TOP - bh - 6);
    }
  }

  // road: asphalt lanes with the occasional crack variant (deterministic per
  // tile so it never flickers); his double-yellow decal straddles the row seam
  const asp = art['asphalt'], crack = art['asphalt-crack'];
  if (asp && asp.ok) {
    for (let row = 0; row < 2; row++) {
      const y = ROAD_TOP + row * TILE;
      for (let tx = Math.floor(camX / STEP); tx <= Math.ceil((camX + viewW) / STEP); tx++) {
        const x = tx * STEP;
        if (x < 0 || x >= WORLD_W) continue;
        const useCrack = crack && crack.ok && ((tx * 7 + row * 13) % 11 === 0);
        const a = useCrack ? crack : asp;
        ctx.drawImage(a.bmp || a.img, x, y, TILE, TILE);
      }
    }
  } else {
    ctx.fillStyle = '#696969';
    ctx.fillRect(camX, ROAD_TOP, viewW, ROAD_H);
  }
  const rc = art['road-center'];
  if (rc && rc.ok) tileStrip('road-center', ROAD_TOP + TILE / 2, camX, camX + viewW, TILE);

  // people, depth-sorted (further back drawn first)
  const ents = [...npcs.map(n => ({ z: n.z, x: n.x, flip: n.v < 0, slot: 'npc' })),
                { z: player.z, x: player.x, flip: player.facing < 0, slot: 'player' }];
  ents.sort((a, b) => a.z - b.z);
  for (const e of ents) {
    const feet = BAND_TOP + e.z;
    drawSlot(e.slot, e.x, feet - TILE * 1.5, TILE, TILE * 1.5, e.flip);
  }

  // traffic (far lane first, then near lane in front)
  for (const c of cars) {
    const lane = LANES[c.lane];
    drawSlot('car', c.x, lane.y - CAR_H, CAR_W, CAR_H, lane.dir < 0);
  }

  if (bubbleTimer > 0) bubble(BUBBLE_TEXT, player.x + player.w / 2, BAND_TOP + player.z - player.h);

  ctx.restore();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
