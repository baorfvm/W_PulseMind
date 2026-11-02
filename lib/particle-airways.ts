import type { Airway, Point3D } from "@/lib/lung-geometry";

export interface ParticleAirway {
  path: Airway;
  radius: [number, number];
  trachea?: boolean;
}

const p = (x: number, y: number, z = 0): Point3D => ({ x, y, z });

// A curved windpipe joins the carina and progressively tapering bronchi.
// These are separate from the preserved wireframe version's center lines.
export const PARTICLE_AIRWAYS: ParticleAirway[] = [
  { path: [p(0, -207, -3), p(-4, -174, -6), p(2, -111, -4), p(0, -77)], radius: [10.5, 9], trachea: true },
];

for (const side of [-1, 1]) {
  PARTICLE_AIRWAYS.push({
    path: [p(0, -77), p(side * 12, -66, 1), p(side * 29, -45, 3), p(side * 53, -28, 3)],
    radius: [9, 6],
  });
  for (const target of [p(side * 103, -103, 15), p(side * 146, 13, 12), p(side * 130, 107, 10)]) {
    PARTICLE_AIRWAYS.push({
      path: [p(side * 53, -28, 3), p(side * 74, -23, 8), p(side * 89, (target.y - 28) / 2, 12), target],
      radius: [5.8, 2.6],
    });
    for (const offset of [-1, 1]) {
      PARTICLE_AIRWAYS.push({
        path: [target, p(target.x + side * 9, target.y + 4, target.z),
          p(target.x + side * offset * 20, target.y + 19, target.z + offset * 8),
          p(target.x + side * offset * 29, target.y + 33, target.z + offset * 12)],
        radius: [2.6, 0.6],
      });
    }
  }
}
