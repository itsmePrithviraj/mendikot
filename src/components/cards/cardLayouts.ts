/** Pip centres on the 250×350 card. `flip` pips sit in the lower half and
 * are rotated 180° like a printed deck. */
export interface Pip {
  x: number;
  y: number;
  flip?: boolean;
}

export const PIP_SIZE = 44;
const L = 82,
  C = 125,
  R = 168;
const TOP = 84,
  BOTTOM = 266,
  MID = 175;
const ROW2 = 144.7,
  ROW3 = 205.3;

const corners: Pip[] = [
  { x: L, y: TOP },
  { x: R, y: TOP },
  { x: L, y: BOTTOM, flip: true },
  { x: R, y: BOTTOM, flip: true },
];
const sides: Pip[] = [
  { x: L, y: MID },
  { x: R, y: MID },
];
const columns: Pip[] = [
  { x: L, y: TOP },
  { x: L, y: ROW2 },
  { x: L, y: ROW3, flip: true },
  { x: L, y: BOTTOM, flip: true },
  { x: R, y: TOP },
  { x: R, y: ROW2 },
  { x: R, y: ROW3, flip: true },
  { x: R, y: BOTTOM, flip: true },
];

export const PIP_LAYOUTS: Record<number, Pip[]> = {
  2: [
    { x: C, y: TOP },
    { x: C, y: BOTTOM, flip: true },
  ],
  3: [
    { x: C, y: TOP },
    { x: C, y: MID },
    { x: C, y: BOTTOM, flip: true },
  ],
  4: corners,
  5: [...corners, { x: C, y: MID }],
  6: [...corners, ...sides],
  7: [...corners, ...sides, { x: C, y: (TOP + MID) / 2 }],
  8: [
    ...corners,
    ...sides,
    { x: C, y: (TOP + MID) / 2 },
    { x: C, y: (MID + BOTTOM) / 2, flip: true },
  ],
  9: [...columns, { x: C, y: MID }],
  // The ten keeps its eight column pips, set a little wider so the sheep
  // medallion can take the centre.
  10: columns.map((p) => ({ ...p, x: p.x < C ? 78 : 172 })),
};
