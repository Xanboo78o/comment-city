// COMMENT CITY (working title) — the game the comments build.
// RULE: anything without art renders as THE TILE, labeled with the file it's waiting for.
// Adam's pipeline: export SVG at 64-scale -> drop in art/ with the right name -> refresh.
//
// 2.5D street-band layout (beat-em-up style): buildings at the back, walkable
// sidewalk band with a depth axis, road with traffic along the front edge.

const TILE = 64;
const VIEW_H = TILE * 13;      // 832 world-px of world visible vertically

// screen rows of the street (top to bottom). No horizon — Stardew-style ground
// plane: grass everywhere, buildings stand on it, road along the front.
// A road slice top->bottom is FIVE whole tiles (Adam's spec):
//   road-line / lane / road-center / lane / road-line
// (line tiles rotated 90° for east-west roads; unrotated for north-south)
const BAND_TOP = TILE * 6;               // 384: back edge of walkable band — a grid line, so facades align
const BAND_DEPTH = TILE * 2;             // z axis: 0 = back (at the doors), BAND_DEPTH = curb
const ROAD_TOP = BAND_TOP + BAND_DEPTH;  // 512
const ROAD_ROWS = ['road-line', 'lane', 'road-center', 'lane', 'road-line'];
const ROAD_H = TILE * ROAD_ROWS.length;  // 320

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
const GROUND = new Set(['grass', 'dirt', 'asphalt', 'asphalt-crack']);
const art = {};   // slot -> { img, bmp, ok }
function loadArt(slot) {
  if (art[slot]) return art[slot];
  const entry = { img: new Image(), ok: false };
  entry.img.onload = () => {
    // pre-raster for the heavy tiled draws (full-screen grass)
    const w = Math.max(1, Math.round(entry.img.naturalWidth));
    const h = Math.max(1, Math.round(entry.img.naturalHeight));
    const cv = document.createElement('canvas');
    const c = cv.getContext('2d');
    if (ROTATED.has(slot) || GROUND.has(slot)) {
      // ground/road tiles butt on the exact 64 grid; keep each tile's top/left
      // border and crop its right/bottom one so seams show ONE outline.
      // Road line tiles are drawn with the line vertical -> rotate 90° first
      // (east-west roads; north-south will use them unrotated).
      let src = entry.img, sw = w, sh = h;
      if (ROTATED.has(slot)) {
        const temp = document.createElement('canvas');
        temp.width = TILE; temp.height = TILE;
        const tc = temp.getContext('2d');
        tc.translate(TILE, 0); tc.rotate(Math.PI / 2);
        tc.drawImage(entry.img, 0, 0, TILE, TILE);
        src = temp; sw = TILE; sh = TILE;
      }
      cv.width = TILE; cv.height = TILE;
      c.drawImage(src, 0, 0, sw / TILE * (TILE + 6), sh / TILE * (TILE + 6));
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

// tile one slot across a horizontal strip on the exact 64 grid
function tileStrip(slot, y, fromX, toX) {
  const startTx = Math.floor(fromX / TILE), endTx = Math.ceil(toX / TILE);
  for (let tx = startTx; tx <= endTx; tx++) {
    const x = tx * TILE;
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
  { y: ROAD_TOP + TILE * 2 - 8, dir: -1, speed: 260 },  // far lane row, leftward
  { y: ROAD_TOP + TILE * 4 - 8, dir: 1, speed: 300 },   // near lane row, rightward
];
const CAR_W = 124, CAR_H = 74;   // his car art's natural proportions, don't squash
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
  if (!dx && !dz) {
    // xbox/any standard controller: left stick (analog) or d-pad
    for (const gp of (navigator.getGamepads ? navigator.getGamepads() : [])) {
      if (!gp || !gp.connected) continue;
      let gx = gp.axes[0] || 0, gy = gp.axes[1] || 0;
      if (gp.buttons[14]?.pressed) gx = -1;
      if (gp.buttons[15]?.pressed) gx = 1;
      if (gp.buttons[12]?.pressed) gy = -1;
      if (gp.buttons[13]?.pressed) gy = 1;
      const len = Math.hypot(gx, gy);
      if (len > 0.2) { dx = len > 1 ? gx / len : gx; dz = len > 1 ? gy / len : gy; }
      break;
    }
  }
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
  for (let y = 0; y < ROAD_TOP; y += TILE) tileStrip('grass', y, camX, camX + viewW);

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

  // road: five whole-tile rows per Adam's spec — line / lane / center / lane /
  // line. Lane rows mix in the crack variant deterministically (never flickers).
  const asp = art['asphalt'], crack = art['asphalt-crack'];
  for (let row = 0; row < ROAD_ROWS.length; row++) {
    const y = ROAD_TOP + row * TILE;
    for (let tx = Math.floor(camX / TILE); tx <= Math.ceil((camX + viewW) / TILE); tx++) {
      const x = tx * TILE;
      if (x < 0 || x >= WORLD_W) continue;
      let a;
      if (ROAD_ROWS[row] === 'lane') {
        const useCrack = crack && crack.ok && ((tx * 7 + row * 13) % 11 === 0);
        a = useCrack ? crack : asp;
      } else a = art[ROAD_ROWS[row]];
      if (a && a.ok) ctx.drawImage(a.bmp, x, y, TILE, TILE);
      else { ctx.fillStyle = '#696969'; ctx.fillRect(x, y, TILE, TILE); }
    }
  }

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
    drawSlot('car', c.x, lane.y - CAR_H, CAR_W, CAR_H, lane.dir > 0);
  }

  if (bubbleTimer > 0) bubble(BUBBLE_TEXT, player.x + player.w / 2, BAND_TOP + player.z - player.h);

  ctx.restore();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
