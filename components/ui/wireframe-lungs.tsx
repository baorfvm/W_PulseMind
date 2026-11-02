"use client";

import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { cn } from "@/lib/utils";

type ViewMode = "BREATHE" | "AIRFLOW" | "STRUCTURE";

export interface WireframeLungsProps {
  headline?: string;
  className?: string;
  presentation?: "panel" | "background";
}

const MODES: ViewMode[] = ["BREATHE", "AIRFLOW", "STRUCTURE"];
const RED = "244, 22, 38";

type Point3D = { x: number; y: number; z: number };
type Airway = [Point3D, Point3D, Point3D, Point3D];


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

function lungPoint(side: number, level: number, angle: number, breath: number): Point3D {
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
const AIRWAYS: Airway[] = [
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

function alongAirway(path: Airway, t: number): Point3D {
  const inverse = 1 - t;
  const weights = [inverse ** 3, 3 * inverse ** 2 * t, 3 * inverse * t ** 2, t ** 3];
  return {
    x: path.reduce((sum, p, i) => sum + p.x * weights[i], 0),
    y: path.reduce((sum, p, i) => sum + p.y * weights[i], 0),
    z: path.reduce((sum, p, i) => sum + p.z * weights[i], 0),
  };
}


export function WireframeLungs({
  headline = "A little space to breathe.",
  className,
  presentation = "panel",
}: WireframeLungsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const clockRef = useRef(0);
  const redrawRef = useRef<() => void>(() => {});
  const pointerRef = useRef({ x: -2000, y: -2000 });
  const [mode, setMode] = useState<ViewMode>("BREATHE");
  const [running, setRunning] = useState(() => typeof window === "undefined" || !window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  useEffect(() => {
    if (presentation !== "background") return;
    const onPointer = (event: globalThis.PointerEvent) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      pointerRef.current = x >= 0 && x <= rect.width && y >= 0 && y <= rect.height
        ? { x, y }
        : { x: -2000, y: -2000 };
      redrawRef.current();
    };
    window.addEventListener("pointermove", onPointer, { passive: true });
    return () => window.removeEventListener("pointermove", onPointer);
  }, [presentation]);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!container || !canvas || !context) return;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let frame = 0;
    let visible = false;
    let lastTime = 0;

    const draw = () => {
      if (!width || !height) return;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, width, height);
      const time = clockRef.current;
      const breath = mode === "STRUCTURE" ? 0.35 : (1 - Math.cos(time * Math.PI * 2 / 5.2)) / 2;
      const zoom = Math.min(width / 480, (height - 150) / 475);
      const centerX = width * 0.5;
      const centerY = height * 0.55;
      const pointer = pointerRef.current;

      const project = (p: Point3D) => {
        const x = p.x;
        const z = p.z;
        const perspective = 650 / (650 + z);
        const screenX = centerX + x * zoom * perspective;
        const screenY = centerY + p.y * zoom * perspective;
        const distance = Math.hypot(screenX - pointer.x, screenY - pointer.y);
        const excitation = Math.max(0, 1 - distance / Math.min(150, width * 0.25));
        return {
          x: screenX + Math.sin(p.y * 0.04 + time) * excitation * 3,
          y: screenY + Math.cos(p.x * 0.04 + time) * excitation * 3,
          excitation,
          depth: perspective,
        };
      };

      const strokeFiber = (points: Point3D[], alpha: number, lineWidth: number, closed = false) => {
        context.beginPath();
        let excitement = 0;
        for (let index = 0; index < points.length; index++) {
          const p = project(points[index]);
          excitement = Math.max(excitement, p.excitation);
          if (index === 0) context.moveTo(p.x, p.y);
          else context.lineTo(p.x, p.y);
        }
        if (closed) context.closePath();
        context.strokeStyle = `rgba(${RED},${Math.min(0.9, alpha + excitement * 0.46)})`;
        context.lineWidth = lineWidth + excitement * 0.6;
        context.lineJoin = "round";
        context.stroke();
      };

      // A translucent, rounded surface adds depth beneath the fine wireframe.
      for (const side of [-1, 1]) {
        const outline = [
          ...Array.from({ length: 201 }, (_, index) => lungPoint(side, index / 200, 0, breath)),
          ...Array.from({ length: 201 }, (_, index) => lungPoint(side, 1 - index / 200, Math.PI, breath)),
        ];
        context.beginPath();
        outline.forEach((point, index) => {
          const p = project(point);
          if (index === 0) context.moveTo(p.x, p.y);
          else context.lineTo(p.x, p.y);
        });
        context.closePath();
        const shading = context.createLinearGradient(centerX + side * 30 * zoom, 0, centerX + side * 220 * zoom, 0);
        shading.addColorStop(0, `rgba(${RED},0.105)`);
        shading.addColorStop(0.4, `rgba(${RED},0.025)`);
        shading.addColorStop(1, `rgba(${RED},0.08)`);
        context.fillStyle = shading;
        context.fill();
        strokeFiber(outline, 0.36, 0.85, true);
      }

      for (const side of [-1, 1]) {
        for (let ring = 0; ring < 34; ring++) {
          const level = 0.015 + ring / 33 * 0.97;
          const points = Array.from({ length: 81 }, (_, index) => lungPoint(side, level, index / 80 * Math.PI * 2, breath));
          strokeFiber(points, mode === "AIRFLOW" ? 0.19 : 0.33, 0.65, true);
        }
        for (let meridian = 0; meridian < 20; meridian++) {
          const angle = meridian / 20 * Math.PI * 2;
          const points = Array.from({ length: 61 }, (_, index) => lungPoint(side, 0.005 + index / 60 * 0.99, angle, breath));
          strokeFiber(points, mode === "STRUCTURE" ? 0.42 : 0.23, 0.65);
        }
      }

      // Mirror the same lobe divisions on both sides, as requested.
      for (const side of [-1, 1]) {
        const oblique = Array.from({ length: 81 }, (_, index) => {
          const t = index / 80;
          const level = 0.87 - t * 0.33 + Math.sin(t * Math.PI) * 0.025;
          return lungPoint(side, level, Math.PI + t * Math.PI, breath);
        });
        strokeFiber(oblique, 0.72, 1.45);
        const horizontal = Array.from({ length: 81 }, (_, index) => {
          const t = index / 80;
          return lungPoint(side, 0.45 + Math.sin(t * Math.PI) * 0.065, Math.PI + t * Math.PI, breath);
        });
        strokeFiber(horizontal, 0.65, 1.25);
      }

      for (let ring = 0; ring < 16; ring++) {
        const y = -225 + ring * 9.3;
        strokeFiber(Array.from({ length: 33 }, (_, index) => {
          const angle = index / 32 * Math.PI * 2;
          return point(Math.cos(angle) * 9.5, y + Math.sin(angle) * 2.4, Math.sin(angle) * 7);
        }), 0.58, 0.9, true);
      }
      for (const side of [-1, 1]) {
        strokeFiber([point(side * 9.5, -228), point(side * 9.5, -78)], 0.6, 0.85);
      }

      AIRWAYS.forEach((airway, index) => {
        const points = Array.from({ length: 25 }, (_, sample) => {
          const p = alongAirway(airway, sample / 24);
          return { ...p, x: p.x * (1 + breath * 0.065), y: p.y * (1 + breath * 0.018) };
        });
        strokeFiber(points, mode === "AIRFLOW" ? 0.7 : 0.4, index < 3 ? 1.4 : 0.8);
        if (mode !== "STRUCTURE") {
          for (let particle = 0; particle < (mode === "AIRFLOW" ? 3 : 1); particle++) {
            const t = (time * 0.17 + index * 0.137 + particle / 3) % 1;
            const p = alongAirway(airway, t);
            const projected = project({ ...p, x: p.x * (1 + breath * 0.065), y: p.y * (1 + breath * 0.018) });
            context.beginPath();
            context.arc(projected.x, projected.y, (mode === "AIRFLOW" ? 2.1 : 1.6) * projected.depth, 0, Math.PI * 2);
            context.fillStyle = `rgba(${RED},0.92)`;
            context.fill();
          }
        }
      });

      if (mode === "BREATHE") {
        for (let index = 0; index < 38; index++) {
          const side = index % 2 ? 1 : -1;
          const p = project(lungPoint(side, 0.06 + ((index * 0.137 + time * 0.028) % 0.88), index * 2.4 + time * 0.09, breath));
          context.beginPath();
          context.arc(p.x, p.y, 1.5 * p.depth, 0, Math.PI * 2);
          context.fillStyle = `rgba(${RED},${0.55 + p.excitation * 0.4})`;
          context.fill();
        }
      }
    };

    const schedule = () => {
      if (visible && !document.hidden && !frame) frame = requestAnimationFrame(tick);
    };
    const tick = (now: number) => {
      frame = 0;
      if (!visible || document.hidden) {
        lastTime = 0;
        return;
      }
      if (running && lastTime) clockRef.current += Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;
      draw();
      if (running) schedule();
    };
    redrawRef.current = schedule;

    const resize = new ResizeObserver(([entry]) => {
      width = entry.contentRect.width;
      height = entry.contentRect.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      schedule();
    });
    resize.observe(container);

    const visibility = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      lastTime = 0;
      if (visible) schedule();
      else {
        cancelAnimationFrame(frame);
        frame = 0;
      }
    });
    visibility.observe(container);
    const onVisibility = () => {
      lastTime = 0;
      if (document.hidden) {
        cancelAnimationFrame(frame);
        frame = 0;
      } else schedule();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      visibility.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      redrawRef.current = () => {};
    };
  }, [mode, running]);

  const handlePointer = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    pointerRef.current = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    redrawRef.current();
  };

  return (
    <div
      ref={containerRef}
      onPointerMove={handlePointer}
      onPointerLeave={() => {
        pointerRef.current = { x: -2000, y: -2000 };
        redrawRef.current();
      }}
      className={cn("relative isolate h-[min(780px,90svh)] min-h-[480px] w-full overflow-hidden", presentation === "background" && "h-full min-h-0", className)}
    >
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Matching mirrored wireframe lungs with rounded bases, lobe divisions, branching airways, and flowing particles"
        className={cn("absolute inset-0 h-full w-full", presentation === "background" && "opacity-55")}
      />
      <header className={cn("pointer-events-none relative z-10 flex flex-wrap items-start justify-between gap-5 px-2 pt-5 sm:px-8", presentation === "background" && "absolute bottom-8 left-6 p-0 sm:bottom-12 sm:left-12")}>
        <div className={presentation === "background" ? "sr-only" : undefined}>
          <p className="mb-3 text-[10px] font-medium uppercase tracking-[0.24em] text-[#77716e]">The rhythm of being</p>
          <h2 className="max-w-[260px] text-2xl font-medium tracking-[-0.055em] text-[#1F3A4B] sm:max-w-none sm:text-3xl">{headline}</h2>
        </div>
        <button
          type="button"
          onClick={() => setRunning((value) => !value)}
          aria-label={running ? "Pause lung animation" : "Play lung animation"}
          aria-pressed={running}
          className="pointer-events-auto flex items-center gap-2 rounded-full border border-[#1F3A4B]/15 bg-white/85 px-3 py-2 text-[10px] uppercase tracking-[0.12em] text-[#1F3A4B] backdrop-blur-sm transition-colors hover:border-[#F41626] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#F41626]"
        >
          {running ? <Pause size={12} /> : <Play size={12} />}
          {running ? "Pause" : "Play"}
        </button>
      </header>
      {presentation === "panel" && <footer className="absolute inset-x-0 bottom-3 z-10 flex flex-wrap items-center justify-between gap-4 px-2 sm:px-8">
        <div className="flex rounded-full border border-[#1F3A4B]/12 bg-white/85 p-1 backdrop-blur-sm" aria-label="Lung visualization mode">
          {MODES.map((view) => (
            <button
              key={view}
              type="button"
              aria-pressed={mode === view}
              onClick={() => setMode(view)}
              className={cn("rounded-full px-3 py-2 text-[9px] font-medium tracking-[0.1em] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F41626] sm:px-4", mode === view ? "bg-[#F41626] text-white" : "text-[#77716e] hover:text-[#F41626]")}
            >
              {view}
            </button>
          ))}
        </div>
        <span className="text-[9px] uppercase tracking-[0.16em] text-[#77716e]">Move closer. Feel the flow.</span>
      </footer>}
    </div>
  );
}

export default WireframeLungs;
