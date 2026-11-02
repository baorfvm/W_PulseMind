export type Point3D = { x: number; y: number; z: number };
export type Airway = [Point3D, Point3D, Point3D, Point3D];


// Inner border, outer border, and depth follow the rounded silhouette in the
// reference. Broad diaphragmatic bases replace the previous pointed ellipsoids.
const LUNG_SECTIONS = [
  [0, 67, 67, 0],
  [0.025, 55, 86, 13],
  [0.08, 42, 114, 26],
  [0.18, 30, 149, 39],
  [0.35, 24, 183, 52],
  [0.52, 25, 205, 62],
  [0.7, 31, 217, 68],
  [0.84, 39, 219, 66],
  [0.93, 50, 216, 57],
  [0.975, 70, 204, 37],
  [0.995, 105, 181, 16],
  [1, 143, 143, 0],
];

// Shape-preserving cubic interpolation keeps the sampled outline smooth without
// adding bulges between landmarks or pinching the bottom into a sharp point.
function sectionValue(level: number, column: number, index: number): number {
  const a = LUNG_SECTIONS[index];
  const b = LUNG_SECTIONS[index + 1];
  const slope = (i: number) => {
    const before = LUNG_SECTIONS[Math.max(0, i - 1)];
    const current = LUNG_SECTIONS[i];
    const after = LUNG_SECTIONS[Math.min(LUNG_SECTIONS.length - 1, i + 1)];
    if (i === 0) return (after[column] - current[column]) / (after[0] - current[0]);
    if (i === LUNG_SECTIONS.length - 1) return (current[column] - before[column]) / (current[0] - before[0]);
    const left = (current[column] - before[column]) / (current[0] - before[0]);
    const right = (after[column] - current[column]) / (after[0] - current[0]);
    return left * right <= 0 ? 0 : 2 * left * right / (left + right);
  };
  const distance = b[0] - a[0];
  const t = Math.max(0, Math.min(1, (level - a[0]) / distance));
  return (2 * t ** 3 - 3 * t ** 2 + 1) * a[column]
    + (t ** 3 - 2 * t ** 2 + t) * distance * slope(index)
    + (-2 * t ** 3 + 3 * t ** 2) * b[column]
    + (t ** 3 - t ** 2) * distance * slope(index + 1);
}

export function lungPoint(side: number, level: number, angle: number, breath: number): Point3D {
  const nextSection = LUNG_SECTIONS.findIndex((section) => section[0] > level);
  const index = nextSection < 0 ? LUNG_SECTIONS.length - 2 : Math.max(0, nextSection - 1);
  const inner = sectionValue(level, 1, index);
  const outer = sectionValue(level, 2, index);
  const depth = Math.max(0, sectionValue(level, 3, index));
  let radius = Math.max(0, (outer - inner) / 2);
  if (level > 0 && level < 0.08) {
    const cap = level / 0.08;
    radius += 20 * Math.sqrt(cap) * (1 - cap) ** 2;
  }
  const center = (inner + outer) / 2;
  const y = -166 + level * 344 + Math.cos(angle) * radius * 0.1 * level ** 4;
  return {
    x: side * (center + Math.cos(angle) * radius) * (1 + breath * 0.055),
    y: -60 + (y + 60) * (1 + breath * 0.025),
    z: Math.sin(angle) * depth * (0.92 + Math.cos(angle) * 0.08) * (1 + breath * 0.08),
  };
}


const point = (x: number, y: number, z = 0): Point3D => ({ x, y, z });
export const AIRWAYS: Airway[] = [
  [point(0, -228), point(0, -185), point(0, -121), point(0, -78)],
];

for (const side of [-1, 1]) {
  AIRWAYS.push([point(0, -78), point(side * 12, -58), point(side * 32, -37), point(side * 53, -24)]);
  for (const target of [point(side * 105, -91, 10), point(side * 151, 20, -9), point(side * 136, 113, 8)]) {
    const middle = point(side * 85, (target.y - 24) / 2, target.z * 0.5);
    AIRWAYS.push([point(side * 53, -24), point(side * 71, -14), middle, target]);
    for (const offset of [-1, 1]) {
      AIRWAYS.push([
        target,
        point(target.x + side * 8, target.y + 3, target.z),
        point(target.x + side * (offset > 0 ? 24 : -19), target.y + 14, target.z + offset * 8),
        point(target.x + side * (offset > 0 ? 32 : -26), target.y + 31, target.z + offset * 14),
      ]);
    }
  }
}

export function alongAirway(path: Airway, t: number): Point3D {
  const inverse = 1 - t;
  const weights = [inverse ** 3, 3 * inverse ** 2 * t, 3 * inverse * t ** 2, t ** 3];
  return {
    x: path.reduce((sum, p, i) => sum + p.x * weights[i], 0),
    y: path.reduce((sum, p, i) => sum + p.y * weights[i], 0),
    z: path.reduce((sum, p, i) => sum + p.z * weights[i], 0),
  };
}


