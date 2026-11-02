"use client";

import {
  motion,
  useScroll,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { useLayoutEffect, useRef, useState } from "react";
import { PULSEMIND_PATHS, PULSEMIND_TIP, PULSEMIND_VIEWBOX } from "@/lib/pulsemind-logo";
import HelixChronoMatrix from "@/components/ui/helix-chrono-matrix";
import { SITE_CONTENT, type Language } from "@/lib/site-content";

const LINE_COLOR = "#F41626";

type CanvasSize = { width: number; height: number; viewportHeight: number; headerHeight: number };

function RedScrollLine({
  progress,
  size,
}: {
  progress: MotionValue<number>;
  size: CanvasSize;
}) {
  const { width, height, viewportHeight } = size;
  const padding = width < 640 ? 24 : 48;
  const contentWidth = Math.min(width - padding * 2, 1024);
  const scale = contentWidth / PULSEMIND_VIEWBOX.width;
  const left = (width - contentWidth) / 2;
  const top = viewportHeight * 0.45 - 253.9523 * scale;
  const right = (width - padding - left) / scale;
  const turnHeight = viewportHeight * 0.8 / scale;
  const strokeWidth = PULSEMIND_TIP.width * scale;
  // Include the rounded cap so the visible line reaches the page bottom.
  const endY = (height - strokeWidth / 2 - top) / scale;
  const { x: tipX, y: tipY } = PULSEMIND_TIP;
  const railStart = tipY + turnHeight;
  const railLength = endY - railStart;
  const beatHeight = Math.min(viewportHeight * 0.22 / scale, railLength * 0.2);
  const leftPeak = Math.min(contentWidth * 0.18, 140) / scale;
  const rightPeak = Math.max(0, Math.min(padding - strokeWidth / 2 - 8, 24)) / scale;
  const heartbeats = [0.2, 0.62].map((position) => {
    const y = railStart + railLength * position;
    return [
      `V${y}`,
      `L${right - leftPeak * 0.2} ${y + beatHeight * 0.12}`,
      `L${right} ${y + beatHeight * 0.23}`,
      `L${right + rightPeak} ${y + beatHeight * 0.3}`,
      `L${right - leftPeak} ${y + beatHeight * 0.44}`,
      `L${right + rightPeak} ${y + beatHeight * 0.58}`,
      `L${right - leftPeak * 0.35} ${y + beatHeight * 0.72}`,
      `L${right} ${y + beatHeight * 0.88}`,
      `V${y + beatHeight}`,
    ].join(" ");
  }).join(" ");
  const extension = `M${tipX} ${tipY} C${right} ${tipY} ${right} ${tipY + turnHeight * 0.3} ${right} ${railStart} ${heartbeats} V${endY}`;
  const opacity = useTransform(progress, [0, 0.001], [0, 1]);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Red PulseMind logo with a heartbeat line drawing down the right side as you scroll"
      className="pointer-events-none absolute inset-0 h-full w-full"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g transform={`translate(${left} ${top}) scale(${scale})`} shapeRendering="geometricPrecision">
        {/* Continue beneath the original tip, matching its actual cap width. */}
        <motion.path
          d={extension}
          fill="none"
          stroke={LINE_COLOR}
          strokeWidth={PULSEMIND_TIP.width}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ pathLength: progress, opacity }}
        />
        {/* Keep every original Illustrator contour intact, including the tail. */}
        {PULSEMIND_PATHS.map((path, index) => (
          <path key={index} {...path} fill={LINE_COLOR} />
        ))}
      </g>
    </svg>
  );
}

const Skiper19 = ({ language = "en" }: { language?: Language }) => {
  const ref = useRef<HTMLElement>(null);
  const content = SITE_CONTENT[language];
  const [size, setSize] = useState<CanvasSize>({
    width: 1000,
    height: 2700,
    viewportHeight: 900,
    headerHeight: 0,
  });

  useLayoutEffect(() => {
    const section = ref.current;
    if (!section) return;

    const measure = () => {
      setSize({
        width: section.clientWidth,
        height: section.clientHeight,
        viewportHeight: section.querySelector<HTMLElement>("[data-hero]")?.clientHeight ?? window.innerHeight,
        headerHeight: document.querySelector("header")?.getBoundingClientRect().height ?? 0,
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(section);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: [`start ${size.headerHeight}px`, "end end"],
  });
  const hintOpacity = useTransform(scrollYProgress, [0, 0.15], [1, 0]);

  return (
    <section ref={ref} id="top" className="relative min-h-[300vh] bg-white text-[#1F3A4B]">
      <div className="absolute inset-x-0 top-0 h-[calc(100svh-var(--site-header-height))]">
        <HelixChronoMatrix presentation="background" />
      </div>
      <RedScrollLine progress={scrollYProgress} size={size} />
      <div data-hero className="pointer-events-none relative flex h-[calc(100svh-var(--site-header-height))] flex-col items-center px-6 sm:px-12">
        <h1 className="sr-only">PulseMind</h1>
        <div className="absolute top-8 flex items-center gap-2.5 text-[11px] font-medium uppercase tracking-[0.25em] sm:top-12">
          <span className="h-1.5 w-1.5 rounded-full bg-[#F41626]" aria-hidden="true" />
          {content.follow}
        </div>

        <p className="absolute bottom-[24%] px-6 text-center text-sm font-medium text-[#77716e] sm:text-base">
          {content.subtitle}
        </p>

        <motion.div
          style={{ opacity: hintOpacity }}
          className="absolute bottom-10 flex flex-col items-center gap-4 text-[10px] font-medium uppercase tracking-[0.2em] text-[#77716e] sm:bottom-12"
        >
          <span>{content.scroll}</span>
          <svg width="16" height="24" viewBox="0 0 16 24" fill="none" aria-hidden="true">
            <path d="M8 1V21M2 15L8 21L14 15" stroke="currentColor" strokeWidth="1.25" />
          </svg>
        </motion.div>

      </div>
    </section>
  );
};

export { Skiper19 };
