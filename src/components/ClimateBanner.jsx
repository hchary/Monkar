import { useMemo } from "react";

const COLS = 64;
const ROWS = 12;

function makeTone() {
  return new Array(COLS * ROWS).fill(0);
}

function set(tone, r, c, t) {
  if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return;
  tone[r * COLS + c] = t;
}

function hspan(tone, r, c0, c1, t) {
  for (let c = c0; c <= c1; c++) set(tone, r, c, t);
}

// shared grayscale ramp used by every climate below
const RAMP = {
  0: "transparent",
  1: "#17160f",
  2: "#2c2a24",
  3: "#3d3a30",
  4: "#55503f",
  5: "#7a765f",
  6: "#9a9682",
  7: "#c9c5b0",
  8: "#e9e6d8",
};

const TONE_FOREST = {
  0: "transparent",
  1: "#2c2a24",
  2: "#38352c",
  3: "#55503f",
  4: "#9a9682",
  5: "#15140e",
  6: "#4a473c",
};

function buildForest() {
  const tone = makeTone();
  const SIZES = {
    far: { widths: [1, 3, 3, 5], top: 6, tones: [6] },
    mid: { widths: [1, 3, 3, 5, 5, 7], top: 4, tones: [1, 2] },
    near: { widths: [1, 3, 3, 5, 5, 7, 9], top: 2, tones: [1] },
  };
  const trees = [
    { base: 6, size: "far" },
    { base: 18, size: "mid" },
    { base: 33, size: "near" },
    { base: 48, size: "far" },
    { base: 59, size: "mid" },
  ];
  const groundRow = ROWS - 1;
  const grassRow = ROWS - 2;
  hspan(tone, groundRow, 0, COLS - 1, 5);
  for (let c = 0; c < COLS; c++) if (c % 5 === 0) set(tone, grassRow, c, 5);
  trees.forEach((tree) => {
    const spec = SIZES[tree.size];
    spec.widths.forEach((w, r) => {
      const half = Math.floor(w / 2);
      const t = spec.tones[r % spec.tones.length];
      for (let dx = -half; dx <= half; dx++) set(tone, spec.top + r, tree.base + dx, t);
    });
    const trunkStart = spec.top + spec.widths.length;
    for (let tr = trunkStart; tr < groundRow; tr++) set(tone, tr, tree.base, 3);
  });
  const clouds = [
    { base: 15, row: 1 },
    { base: 42, row: 0 },
  ];
  const cloudShape = [
    { dr: 0, dc0: -1, dc1: 1 },
    { dr: 1, dc0: -4, dc1: 4 },
  ];
  clouds.forEach((cloud) => {
    cloudShape.forEach((seg) => {
      for (let cc = seg.dc0; cc <= seg.dc1; cc++) set(tone, cloud.row + seg.dr, cloud.base + cc, 4);
    });
  });
  return tone;
}

function buildIce() {
  const tone = makeTone();
  hspan(tone, 10, 0, COLS - 1, 7);
  hspan(tone, 11, 0, COLS - 1, 7);
  for (let c = 0; c < COLS; c++) if (c % 7 === 0) set(tone, 9, c, 2);
  const shards = [
    { base: 8, h: 5 },
    { base: 20, h: 3 },
    { base: 30, h: 6 },
    { base: 42, h: 4 },
    { base: 54, h: 5 },
  ];
  shards.forEach((s) => {
    const topRow = 10 - s.h;
    for (let i = 0; i < s.h; i++) {
      const w = Math.min(2 * i + 1, 7);
      const half = Math.floor(w / 2);
      const t = i === 0 ? 8 : i % 2 === 0 ? 7 : 6;
      for (let dx = -half; dx <= half; dx++) set(tone, topRow + i, s.base + dx, t);
    }
  });
  return tone;
}

function buildOpenSea() {
  const tone = makeTone();
  const horizon = 4;
  hspan(tone, horizon, 0, COLS - 1, 5);
  for (let r = horizon + 1; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const phase = (c + r * 3) % 8;
      set(tone, r, c, phase < 3 ? 3 : phase < 6 ? 4 : 3);
    }
  }
  for (let c = 3; c < COLS; c += 9) set(tone, horizon + 1, c, 7);
  set(tone, 1, 12, 6);
  set(tone, 2, 41, 6);
  return tone;
}

function buildCoast() {
  const tone = makeTone();
  for (let r = 2; r < 8; r++) {
    for (let c = 0; c < COLS; c++) {
      const phase = (c + r * 3) % 8;
      set(tone, r, c, phase < 3 ? 3 : phase < 6 ? 4 : 3);
    }
  }
  for (let c = 0; c < COLS; c++) {
    const wob = Math.round(Math.sin(c / 5));
    const edgeRow = 8 + wob;
    set(tone, edgeRow, c, 8);
    for (let r2 = edgeRow + 1; r2 < 11; r2++) set(tone, r2, c, 6);
  }
  hspan(tone, 11, 0, COLS - 1, 4);
  set(tone, 10, 20, 2);
  set(tone, 10, 21, 2);
  set(tone, 10, 46, 2);
  const tb = 55;
  for (let r3 = 4; r3 < 10; r3++) set(tone, r3, tb + Math.floor((r3 - 4) / 2), 2);
  set(tone, 4, tb - 2, 3);
  set(tone, 4, tb - 1, 3);
  set(tone, 3, tb, 3);
  set(tone, 4, tb + 1, 3);
  set(tone, 4, tb + 2, 3);
  return tone;
}

function crestAt(c) {
  const crest = 8 + Math.round(Math.sin(c / 10) * 1.5 + Math.sin(c / 3) * 0.5);
  return Math.max(6, Math.min(10, crest));
}

function buildDesert() {
  const tone = makeTone();
  const sun = [
    [1, 54], [1, 55], [2, 53], [2, 54], [2, 55], [2, 56], [3, 54], [3, 55],
  ];
  sun.forEach(([r, c]) => set(tone, r, c, 8));
  for (let c = 0; c < COLS; c++) {
    const crest = crestAt(c);
    for (let r = crest; r < ROWS; r++) set(tone, r, c, r === crest ? 7 : 6);
  }
  function cactus(base, height) {
    const baseRow = crestAt(base) - 1;
    for (let i = 0; i < height; i++) set(tone, baseRow - i, base, 1);
    const armRow = baseRow - Math.floor(height / 2);
    set(tone, armRow, base - 1, 1);
    set(tone, armRow - 1, base - 1, 1);
    set(tone, armRow - 1, base + 1, 1);
  }
  cactus(22, 5);
  cactus(44, 4);
  return tone;
}

function buildVolcano() {
  const tone = makeTone();
  const baseCol = 32;
  const topRow = 2;
  const widths = [1, 3, 5, 7, 9, 11, 13, 15, 17];
  widths.forEach((w, i) => {
    const half = Math.floor(w / 2);
    const row = topRow + i;
    for (let dx = -half; dx <= half; dx++) set(tone, row, baseCol + dx, (dx + i) % 3 === 0 ? 2 : 1);
  });
  set(tone, topRow, baseCol, 8);
  set(tone, topRow + 1, baseCol - 1, 7);
  set(tone, topRow + 1, baseCol + 1, 7);
  for (let r = topRow + 2; r < topRow + 9 && r < ROWS - 1; r++) set(tone, r, baseCol - 2, 7);
  for (let r2 = topRow + 3; r2 < topRow + 8 && r2 < ROWS - 1; r2++) set(tone, r2, baseCol + 3, 6);
  set(tone, topRow - 1, baseCol - 1, 5);
  set(tone, topRow - 1, baseCol + 1, 5);
  set(tone, topRow - 2, baseCol, 4);
  hspan(tone, ROWS - 1, 0, COLS - 1, 1);
  return tone;
}

function buildCity() {
  const tone = makeTone();
  const buildings = [
    { c0: 2, w: 5, h: 5 }, { c0: 8, w: 4, h: 7 }, { c0: 13, w: 6, h: 4 }, { c0: 20, w: 3, h: 8 },
    { c0: 24, w: 5, h: 6 }, { c0: 30, w: 4, h: 9 }, { c0: 35, w: 6, h: 5 }, { c0: 42, w: 3, h: 7 },
    { c0: 46, w: 5, h: 4 }, { c0: 52, w: 4, h: 8 }, { c0: 57, w: 5, h: 6 },
  ];
  const groundRow = ROWS - 1;
  hspan(tone, groundRow, 0, COLS - 1, 3);
  buildings.forEach((b, bi) => {
    const top = groundRow - b.h;
    for (let r = top; r < groundRow; r++) hspan(tone, r, b.c0, b.c0 + b.w - 1, 2);
    for (let r2 = top + 1; r2 < groundRow; r2 += 2) {
      for (let cc = b.c0 + 1; cc < b.c0 + b.w - 1; cc += 2) {
        if ((r2 + cc + bi) % 5 === 0) set(tone, r2, cc, 7);
        else if ((r2 + cc + bi) % 7 === 0) set(tone, r2, cc, 8);
      }
    }
  });
  set(tone, groundRow - 10, 31, 8);
  set(tone, groundRow - 11, 31, 8);
  return tone;
}

function buildCave() {
  const tone = makeTone();
  const glowCenter = 32;
  const glowRow = 6;
  for (let dr = -2; dr <= 2; dr++) {
    for (let dc = -4; dc <= 4; dc++) {
      if (Math.abs(dr) + Math.abs(dc) <= 5) set(tone, glowRow + dr, glowCenter + dc, 3);
    }
  }
  set(tone, glowRow, glowCenter, 5);

  const stalactites = [
    { base: 5, len: 3 }, { base: 14, len: 5 }, { base: 23, len: 2 }, { base: 29, len: 4 },
    { base: 38, len: 3 }, { base: 47, len: 5 }, { base: 53, len: 2 }, { base: 60, len: 4 },
  ];
  stalactites.forEach((s) => {
    for (let i = 0; i < s.len; i++) {
      const w = Math.max(1, s.len - i);
      const half = Math.floor(w / 2);
      const t = i === s.len - 1 ? 4 : 2;
      for (let dx = -half; dx <= half; dx++) set(tone, i, s.base + dx, t);
    }
  });

  const groundRow = ROWS - 1;
  hspan(tone, groundRow, 0, COLS - 1, 1);
  const stalagmites = [
    { base: 2, len: 3 }, { base: 10, len: 2 }, { base: 18, len: 4 }, { base: 26, len: 2 },
    { base: 35, len: 5 }, { base: 41, len: 3 }, { base: 49, len: 2 }, { base: 57, len: 4 },
  ];
  stalagmites.forEach((s) => {
    for (let i = 0; i < s.len; i++) {
      const w = Math.max(1, s.len - i);
      const half = Math.floor(w / 2);
      const row = groundRow - i;
      const t = i === s.len - 1 ? 4 : 2;
      for (let dx = -half; dx <= half; dx++) set(tone, row, s.base + dx, t);
    }
  });

  set(tone, 2, 14, 8);
  set(tone, groundRow - 3, 35, 8);
  set(tone, groundRow - 1, 49, 7);
  set(tone, 7, 23, 7);
  set(tone, 9, 47, 7);
  return tone;
}

const BUILDERS = {
  foret: { build: buildForest, tones: TONE_FOREST },
  glace: { build: buildIce, tones: RAMP },
  pleine_mer: { build: buildOpenSea, tones: RAMP },
  bord_mer: { build: buildCoast, tones: RAMP },
  desert: { build: buildDesert, tones: RAMP },
  volcan: { build: buildVolcano, tones: RAMP },
  ville: { build: buildCity, tones: RAMP },
  grotte: { build: buildCave, tones: RAMP },
};

export default function ClimateBanner({ bannerKey }) {
  const entry = BUILDERS[bannerKey];
  const tone = useMemo(() => (entry ? entry.build() : null), [entry]);

  if (!entry || !tone) return null;

  const tile = (key) => (
    <div key={key} className="pixel-grid" style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)`, gridTemplateRows: `repeat(${ROWS}, 1fr)` }}>
      {tone.map((t, i) => (
        <div key={i} style={{ background: entry.tones[t] || "transparent" }} />
      ))}
    </div>
  );

  return <div className="climate-banner-footer">{[0, 1, 2].map(tile)}</div>;
}
