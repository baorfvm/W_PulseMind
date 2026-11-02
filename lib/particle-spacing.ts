import type { Point3D } from "@/lib/lung-geometry";

/** Reject close neighbors instead of letting independent random dots clump. */
export class ParticleSpacing {
  private cells = new Map<string, Point3D[]>();

  constructor(readonly distance: number) {}

  private cell(p: Point3D): number[] {
    return [p.x, p.y, p.z].map((value) => Math.floor(value / this.distance));
  }

  hasRoom(p: Point3D): boolean {
    const [x, y, z] = this.cell(p);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          const nearby = this.cells.get(`${x + dx},${y + dy},${z + dz}`);
          if (nearby?.some((q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2 + (p.z - q.z) ** 2 < this.distance ** 2)) return false;
        }
      }
    }
    return true;
  }

  add(p: Point3D): void {
    const key = this.cell(p).join(",");
    const bucket = this.cells.get(key);
    if (bucket) bucket.push(p);
    else this.cells.set(key, [p]);
  }
}

/** Invert a cumulative density table, interpolating rather than snapping to rows. */
export function sampleDensity(cumulative: number[], fraction: number): number {
  const target = fraction * cumulative[cumulative.length - 1];
  let low = 0, high = cumulative.length - 1;
  while (low + 1 < high) {
    const middle = (low + high) >>> 1;
    if (cumulative[middle] < target) low = middle;
    else high = middle;
  }
  const span = cumulative[high] - cumulative[low];
  return (low + (span > 0 ? (target - cumulative[low]) / span : 0)) / (cumulative.length - 1);
}
