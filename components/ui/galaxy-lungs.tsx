"use client";

import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { alongAirway, lungPoint } from "@/lib/lung-geometry";
import { PARTICLE_AIRWAYS } from "@/lib/particle-airways";
import { ParticleSpacing, sampleDensity } from "@/lib/particle-spacing";
import WireframeLungs from "@/components/ui/wireframe-lungs";

export interface GalaxyLungsProps {
  headline?: string;
  className?: string;
  presentation?: "panel" | "background";
  particleCount?: number;
}

// Soft stars retain their identities throughout the complete breathing cycle.
const FRAGMENT = `
  uniform float uBreath;
  uniform float uIntensity;
  uniform vec3 uCenterColor;
  varying vec3 vColor;
  varying float vOpacity;
  void main() {
    float distanceFromCenter = length(gl_PointCoord - vec2(0.5));
    float halo = exp(-distanceFromCenter * distanceFromCenter * 30.0);
    float core = exp(-distanceFromCenter * distanceFromCenter * 150.0);
    vec3 base = mix(vColor, uCenterColor, core * 0.8);
    float alpha = halo * vOpacity * (0.78 + uBreath * 0.22);
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(base * (1.1 + uBreath * 0.4) * uIntensity, alpha);
  }
`;

const BODY_VERTEX = `
  uniform float uPixelRatio;
  uniform float uSizeBase;
  uniform float uBreath;
  uniform float uFocusDistance;
  attribute vec4 aSection;
  attribute vec3 customColor;
  attribute float aLevel;
  attribute float aAngle;
  attribute float aRadial;
  attribute float aSide;
  attribute float aSize;
  attribute vec3 aNormal;
  varying vec3 vColor;
  varying float vOpacity;
  void main() {
    float angle = aAngle;
    float radius = aSection.y * aRadial;
    // Expansion increases toward the diaphragm; the upper airway stays anchored.
    float strain = uBreath * (0.035 + smoothstep(0.0, 0.9, aLevel) * 0.065);
    float x = aSide * (aSection.x + cos(angle) * radius);
    x += aSide * (x * aSide - 1.15) * strain;
    float y = aSection.z + cos(angle) * aSection.y * 0.1 * pow(aLevel, 4.0);
    y += uBreath * (0.08 + 0.5 * pow(aLevel, 1.5));
    float z = sin(angle) * aSection.w * aRadial * (0.92 + cos(angle) * 0.08);
    z *= 1.0 + strain * 1.4;
    // Gentle local expansion/contraction replaces continuous swirling.
    x += aSide * sin(aLevel * 19.0 + angle * 2.0) * uBreath * 0.018 * (1.0 - aRadial);
    vec4 view = modelViewMatrix * vec4(x, -y, z, 1.0);
    vec3 viewNormal = normalize(normalMatrix * (aNormal / vec3(1.0 + strain, 1.04, 1.0 + strain * 1.4)));
    vec3 light = normalize((viewMatrix * vec4(-0.45, 0.65, 1.0, 0.0)).xyz);
    float lighting = 0.28 + 0.72 * max(dot(viewNormal, light), 0.0);
    float facing = dot(viewNormal, normalize(-view.xyz));
    float depth = clamp((uFocusDistance + 2.5 + view.z) / 5.0, 0.0, 1.0);
    vColor = customColor * lighting;
    // Surface shading and a shallow oblique lobe fissure add volume without a hard cut.
    float fissureLevel = 0.58 + cos(angle) * 0.12;
    float fissure = exp(-pow((aLevel - fissureLevel) / 0.013, 2.0));
    // Rounded surface lighting, receding back faces and perspective-sized dots.
    vOpacity = mix(0.1, 1.0, smoothstep(-0.15, 0.65, facing)) * mix(0.5, 1.0, depth)
      * (1.0 - fissure * 0.45 * smoothstep(0.75, 1.0, aRadial));
    gl_PointSize = clamp(aSize * uSizeBase * uPixelRatio * (300.0 / -view.z) * mix(0.8, 1.12, depth), 1.0, 32.0);
    gl_Position = projectionMatrix * view;
  }
`;

const AIR_VERTEX = `
  uniform float uPixelRatio;
  uniform float uSizeBase;
  uniform float uBreath;
  uniform float uFocusDistance;
  attribute vec3 aStart;
  attribute vec3 aControl1;
  attribute vec3 aControl2;
  attribute vec3 aEnd;
  attribute vec3 customColor;
  attribute float aProgress;
  attribute vec4 aTube;
  attribute vec2 aOffset;
  attribute float aSize;
  varying vec3 vColor;
  varying float vOpacity;
  void main() {
    // Interior air moves down on inhale and back on exhale. No wrapping or popping.
    float t = aProgress + aTube.w * uBreath * 0.08 * sin(aProgress * 3.14159265);
    float inverse = 1.0 - t;
    vec3 p = inverse * inverse * inverse * aStart
      + 3.0 * inverse * inverse * t * aControl1
      + 3.0 * inverse * t * t * aControl2 + t * t * t * aEnd;
    vec3 tangent = normalize(3.0 * inverse * inverse * (aControl1 - aStart)
      + 6.0 * inverse * t * (aControl2 - aControl1) + 3.0 * t * t * (aEnd - aControl2));
    vec3 normal = normalize(cross(tangent, vec3(0.0, 0.0, 1.0)));
    vec3 binormal = normalize(cross(tangent, normal));
    float radius = mix(aTube.x, aTube.y, t);
    // Rounded, gently fading top and cartilage ridges replace the flat moving cutoff.
    float crown = sqrt(max(0.0, 1.0 - pow(1.0 - min(t / 0.065, 1.0), 2.0)));
    radius *= mix(1.0, crown, aTube.z);
    float ring = pow(0.5 + 0.5 * cos(t * 18.0 * 6.2831853), 8.0);
    radius *= 1.0 + aTube.z * ring * 0.12;
    vec3 radial = cos(aOffset.x) * normal + sin(aOffset.x) * binormal;
    p += radial * radius * aOffset.y * (1.0 + uBreath * 0.018);
    float lower = smoothstep(-2.4, 4.5, p.y);
    p.x *= 1.0 + uBreath * lower * 0.07;
    p.y += uBreath * lower * 0.4;
    p.y = -p.y;
    vec4 view = modelViewMatrix * vec4(p, 1.0);
    float depth = clamp((uFocusDistance + 2.5 + view.z) / 5.0, 0.0, 1.0);
    gl_PointSize = clamp(aSize * uSizeBase * uPixelRatio * (300.0 / -view.z) * mix(0.8, 1.12, depth), 1.0, 32.0);
    gl_Position = projectionMatrix * view;
    vec3 viewNormal = normalize(normalMatrix * vec3(radial.x, -radial.y, radial.z));
    vec3 light = normalize((viewMatrix * vec4(-0.45, 0.65, 1.0, 0.0)).xyz);
    // Keep the airway tree legible through the more subtle lung surface.
    vColor = customColor * (0.65 + 0.55 * max(dot(viewNormal, light), 0.0));
    vOpacity = mix(0.45, 1.0, smoothstep(-0.15, 0.65, dot(viewNormal, normalize(-view.xyz)))) * mix(0.8, 1.0, depth)
      * mix(1.0, smoothstep(0.0, 0.035, t), aTube.z)
      * mix(1.0, 0.65, aTube.w);
  }
`;

// Keep the reference's additive emission intact, then map its intensity to red
// ink/glow over a transparent background so it works on the existing gray page.
const COMPOSITE_FRAGMENT = `
  uniform sampler2D uEmission;
  uniform vec3 uInk;
  uniform vec3 uDeep;
  uniform vec3 uHot;
  varying vec2 vUv;
  void main() {
    vec3 light = texture2D(uEmission, vUv).rgb;
    float energy = max(light.r, max(light.g, light.b));
    float alpha = 1.0 - exp(-energy * 2.65);
    if (alpha < 0.004) discard;
    vec3 color = mix(uDeep, uInk, smoothstep(0.015, 0.7, energy));
    color = mix(color, uHot, smoothstep(1.1, 3.5, energy) * 0.85);
    gl_FragColor = vec4(color, alpha);
    #include <colorspace_fragment>
  }
`;

export function GalaxyLungs({
  headline = "A little space to breathe.", className,
  presentation = "panel", particleCount = 10000,
}: GalaxyLungsProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef({ running: true });
  const refreshRef = useRef<() => void>(() => {});
  const [running, setRunning] = useState(() => typeof window === "undefined" || !window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    settingsRef.current.running = running;
    refreshRef.current();
  }, [running]);

  useEffect(() => {
    if (unavailable) return;
    const mount = mountRef.current;
    if (!mount) return;
    let disposed = false;
    let cleanup = () => {};

    void import("@/lib/three-runtime").then((T) => {
      if (disposed) return;
      let renderer: InstanceType<typeof T.WebGLRenderer>;
      try {
        renderer = new T.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
      } catch {
        setUnavailable(true);
        return;
      }
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      renderer.setPixelRatio(ratio);
      renderer.setClearColor(0, 0);
      renderer.outputColorSpace = T.SRGBColorSpace;
      renderer.domElement.style.cssText = "display:block;width:100%;height:100%";
      renderer.domElement.setAttribute("aria-hidden", "true");
      mount.appendChild(renderer.domElement);

      const scene = new T.Scene();
      const lungsGroup = new T.Group();
      lungsGroup.position.y = -0.65;
      scene.add(lungsGroup);
      const camera = new T.PerspectiveCamera(45, 1, 0.1, 200);
      const emission = new T.WebGLRenderTarget(1, 1, { type: T.HalfFloatType, depthBuffer: false, stencilBuffer: false });
      const shared = {
        uPixelRatio: { value: ratio }, uSizeBase: { value: 0.34 }, uBreath: { value: 0 },
        uIntensity: { value: 1.65 },
        uFocusDistance: { value: 22 },
        uCenterColor: { value: new T.Color("#FFD5CA") },
      };
      const bodyMaterial = new T.ShaderMaterial({
        uniforms: shared, vertexShader: BODY_VERTEX, fragmentShader: FRAGMENT,
        transparent: true, depthWrite: false, blending: T.AdditiveBlending,
      });
      const airwayMaterial = new T.ShaderMaterial({
        uniforms: { ...shared, uIntensity: { value: 2.8 }, uSizeBase: { value: 0.48 } },
        vertexShader: AIR_VERTEX, fragmentShader: FRAGMENT,
        transparent: true, depthWrite: false, blending: T.AdditiveBlending,
      });

      let randomState = 57;
      const random = () => {
        randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
        return randomState / 4294967296;
      };
      const count = Math.max(2000, Math.min(window.innerWidth < 640 ? 6500 : 100000, Math.floor(particleCount / 2) * 2));
      const geometry = new T.BufferGeometry();
      const sections = new Float32Array(count * 4);
      const levels = new Float32Array(count), angles = new Float32Array(count);
      const radials = new Float32Array(count);
      const sides = new Float32Array(count), sizes = new Float32Array(count);
      const colors = new Float32Array(count * 3);
      const normals = new Float32Array(count * 3);
      const coreColor = new T.Color("#FF8C73");
      const middleColor = new T.Color("#F41626");
      const edgeColor = new T.Color("#850D28");
      // Staggered rows follow the actual curved surface, like the reference's
      // point-cloud mesh. Measure along meridians and around each elliptical row
      // instead of distributing the dots through the interior volume.
      const meridian = [0];
      for (let slice = 1; slice <= 256; slice++) {
        let length = 0;
        for (let direction = 0; direction < 8; direction++) {
          const angle = direction * Math.PI / 4;
          const a = lungPoint(1, (slice - 1) / 256, angle, 0);
          const b = lungPoint(1, slice / 256, angle, 0);
          length += Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) / (32 * 8);
        }
        meridian.push(meridian[slice - 1] + length);
      }
      const gap = 0.17 * Math.sqrt(10000 / count);
      const spacing = new ParticleSpacing(gap);
      const rowCount = Math.max(8, Math.floor(meridian[256] / (gap * 0.9)));
      const surfaceSamples: { level: number; angle: number }[] = [];
      for (let row = 0; row < rowCount; row++) {
        const level = sampleDensity(meridian, (row + 0.5) / rowCount);
        const perimeter = [0];
        let previous = lungPoint(1, level, 0, 0);
        for (let segment = 1; segment <= 128; segment++) {
          const next = lungPoint(1, level, segment / 128 * Math.PI * 2, 0);
          perimeter.push(perimeter[segment - 1] + Math.hypot(next.x - previous.x, next.y - previous.y, next.z - previous.z) / 32);
          previous = next;
        }
        const dots = Math.max(3, Math.floor(perimeter[128] / (gap * 1.04)));
        for (let dot = 0; dot < dots; dot++) {
          const fraction = (dot + (row % 2) * 0.5) / dots;
          surfaceSamples.push({ level, angle: sampleDensity(perimeter, fraction) * Math.PI * 2 });
        }
      }
      let bodyPairs = 0;
      for (const { level, angle } of surfaceSamples) {
        if (bodyPairs >= count / 2) break;
        const outside = lungPoint(1, level, 0, 0);
        const inside = lungPoint(1, level, Math.PI, 0);
        const front = lungPoint(1, level, Math.PI / 2, 0);
        const radial = 1;
        const center = (outside.x + inside.x) / 64;
        const radius = (outside.x - inside.x) / 64;
        const y = (outside.y + inside.y) / 64;
        const depth = front.z / (32 * 0.92);
        const candidate = {
          x: center + Math.cos(angle) * radius * radial,
          y: -(y + Math.cos(angle) * radius * 0.1 * level ** 4),
          z: Math.sin(angle) * depth * radial * (0.92 + Math.cos(angle) * 0.08),
        };
        const mirrored = { ...candidate, x: -candidate.x };
        if (!spacing.hasRoom(candidate) || !spacing.hasRoom(mirrored)) continue;
        spacing.add(candidate); spacing.add(mirrored);
        const thetaBefore = lungPoint(1, level, angle - 0.001, 0);
        const thetaAfter = lungPoint(1, level, angle + 0.001, 0);
        const levelBefore = lungPoint(1, Math.max(0, level - 0.001), angle, 0);
        const levelAfter = lungPoint(1, Math.min(1, level + 0.001), angle, 0);
        const ux = thetaAfter.x - thetaBefore.x, uy = -(thetaAfter.y - thetaBefore.y), uz = thetaAfter.z - thetaBefore.z;
        const vx = levelAfter.x - levelBefore.x, vy = -(levelAfter.y - levelBefore.y), vz = levelAfter.z - levelBefore.z;
        const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        const normalLength = Math.hypot(nx, ny, nz) || 1;
        const distance = Math.min(7.5, Math.hypot((outside.y + inside.y) / 2 + 8, (outside.x - inside.x) / 2 * radial) / 27 + 0.12);
        const size = 0.6 + random() * 0.1;
        const color = distance < 2.625
          ? coreColor.clone().lerp(middleColor, distance / 2.625)
          : middleColor.clone().lerp(edgeColor, Math.min(1, (distance - 2.625) / 4.875));
        for (let side = 0; side < 2; side++) {
          const index = bodyPairs * 2 + side;
          sections.set([center, radius, y, depth], index * 4);
          levels[index] = level; angles[index] = angle;
          radials[index] = radial; sides[index] = side ? 1 : -1; sizes[index] = size;
          colors.set([color.r, color.g, color.b], index * 3);
          normals.set([(side ? 1 : -1) * nx / normalLength, ny / normalLength, nz / normalLength], index * 3);
        }
        bodyPairs++;
      }
      geometry.setAttribute("position", new T.BufferAttribute(new Float32Array(count * 3), 3));
      geometry.setAttribute("aSection", new T.BufferAttribute(sections, 4));
      const attributes = { aLevel: levels, aAngle: angles, aRadial: radials, aSide: sides, aSize: sizes };
      Object.entries(attributes).forEach(([key, data]) => geometry.setAttribute(key, new T.BufferAttribute(data, 1)));
      geometry.setAttribute("customColor", new T.BufferAttribute(colors, 3));
      geometry.setAttribute("aNormal", new T.BufferAttribute(normals, 3));
      geometry.setDrawRange(0, bodyPairs * 2);
      const lungs = new T.Points(geometry, bodyMaterial);
      lungs.frustumCulled = false;
      lungsGroup.add(lungs);

      const airwayCount = window.innerWidth < 640 ? 900 : 1400;
      const airwayGeometry = new T.BufferGeometry();
      const controls = Array.from({ length: 4 }, () => new Float32Array(airwayCount * 3));
      const progress = new Float32Array(airwayCount);
      const tubes = new Float32Array(airwayCount * 4), offsets = new Float32Array(airwayCount * 2);
      const airSizes = new Float32Array(airwayCount), airColors = new Float32Array(airwayCount * 3);
      // Surface-area and arc-length weighting prevents tiny terminal branches
      // and slow sections of a Bezier curve from becoming dense red knots.
      const routeDensity = [0];
      const airwayDensity = PARTICLE_AIRWAYS.map((route) => {
        const density = [0];
        let previous = alongAirway(route.path, 0);
        for (let step = 1; step <= 96; step++) {
          const t = step / 96;
          const next = alongAirway(route.path, t);
          const length = Math.hypot(next.x - previous.x, next.y - previous.y, next.z - previous.z);
          const crown = route.trachea ? Math.sqrt(1 - (1 - Math.min(t / 0.065, 1)) ** 2) : 1;
          const radius = (route.radius[0] * (1 - t) + route.radius[1] * t) * crown;
          density.push(density[step - 1] + length * radius * Math.PI * 2);
          previous = next;
        }
        routeDensity.push(routeDensity[routeDensity.length - 1] + density[96]);
        return density;
      });
      let acceptedAirwayCount = 0;
      for (let attempt = 0; acceptedAirwayCount < airwayCount && attempt < airwayCount * 30; attempt++) {
        const routeIndex = Math.min(PARTICLE_AIRWAYS.length - 1, Math.floor(sampleDensity(routeDensity, random()) * PARTICLE_AIRWAYS.length));
        const route = PARTICLE_AIRWAYS[routeIndex];
        const t = sampleDensity(airwayDensity[routeIndex], random());
        const flow = random() < 0.16;
        const angle = random() * Math.PI * 2;
        const radial = flow ? Math.sqrt(random()) * 0.75 : 0.97;
        const point = alongAirway(route.path, t);
        const before = alongAirway(route.path, Math.max(0, t - 0.0001));
        const after = alongAirway(route.path, Math.min(1, t + 0.0001));
        const tangentLength = Math.hypot(after.x - before.x, after.y - before.y, after.z - before.z);
        const tx = (after.x - before.x) / tangentLength, ty = (after.y - before.y) / tangentLength, tz = (after.z - before.z) / tangentLength;
        const normalLength = Math.hypot(tx, ty);
        const nx = ty / normalLength, ny = -tx / normalLength;
        const crown = route.trachea ? Math.sqrt(1 - (1 - Math.min(t / 0.065, 1)) ** 2) : 1;
        const ring = ((1 + Math.cos(t * 18 * Math.PI * 2)) / 2) ** 8;
        const radius = (route.radius[0] * (1 - t) + route.radius[1] * t) * crown * (1 + (route.trachea ? ring * 0.12 : 0)) * radial;
        const candidate = {
          x: (point.x + (Math.cos(angle) * nx - Math.sin(angle) * tz * ny) * radius) / 32,
          y: -(point.y + (Math.cos(angle) * ny + Math.sin(angle) * tz * nx) * radius) / 32,
          z: (point.z + Math.sin(angle) * (tx * ny - ty * nx) * radius) / 32,
        };
        if (!spacing.hasRoom(candidate)) continue;
        spacing.add(candidate);
        const index = acceptedAirwayCount++;
        const onRing = route.trachea && ring > 0.5;
        route.path.forEach((p, control) => controls[control].set([p.x / 32, p.y / 32, p.z / 32], index * 3));
        progress[index] = t;
        tubes.set([route.radius[0] / 32, route.radius[1] / 32, route.trachea ? 1 : 0, flow ? 1 : 0], index * 4);
        offsets.set([angle, radial], index * 2);
        airSizes[index] = 0.6 + random() * 0.1;
        const color = middleColor.clone().lerp(coreColor, onRing ? 0.55 : random() * 0.35);
        airColors.set([color.r, color.g, color.b], index * 3);
      }
      airwayGeometry.setAttribute("position", new T.BufferAttribute(new Float32Array(airwayCount * 3), 3));
      ["aStart", "aControl1", "aControl2", "aEnd"].forEach((key, index) => airwayGeometry.setAttribute(key, new T.BufferAttribute(controls[index], 3)));
      airwayGeometry.setAttribute("aProgress", new T.BufferAttribute(progress, 1));
      airwayGeometry.setAttribute("aTube", new T.BufferAttribute(tubes, 4));
      airwayGeometry.setAttribute("aOffset", new T.BufferAttribute(offsets, 2));
      airwayGeometry.setAttribute("aSize", new T.BufferAttribute(airSizes, 1));
      airwayGeometry.setAttribute("customColor", new T.BufferAttribute(airColors, 3));
      airwayGeometry.setDrawRange(0, acceptedAirwayCount);
      const airways = new T.Points(airwayGeometry, airwayMaterial);
      airways.frustumCulled = false;
      lungsGroup.add(airways);

      const compositeScene = new T.Scene();
      const compositeCamera = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      const compositeMaterial = new T.ShaderMaterial({
        uniforms: {
          uEmission: { value: emission.texture }, uInk: { value: new T.Color("#F41626") },
          uDeep: { value: new T.Color("#9E0A20") }, uHot: { value: new T.Color("#FF493E") },
        },
        vertexShader: "varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}",
        fragmentShader: COMPOSITE_FRAGMENT,
        transparent: true, depthTest: false, depthWrite: false, blending: T.NormalBlending,
      });
      const quadGeometry = new T.PlaneGeometry(2, 2);
      compositeScene.add(new T.Mesh(quadGeometry, compositeMaterial));

      let frame = 0, lastTime = 0, elapsed = 0, visible = false, responsiveScale = 1;
      const pointer = { targetX: 0, targetY: 0, x: 0, y: 0, velocityX: 0, velocityY: 0 };
      const movingCamera = () => Math.abs(pointer.x - pointer.targetX) + Math.abs(pointer.y - pointer.targetY)
        + Math.abs(pointer.velocityX) + Math.abs(pointer.velocityY) > 0.0003;
      const render = () => {
        shared.uBreath.value = (1 - Math.cos(elapsed * Math.PI * 2 / 5.6)) / 2;
        // The organ never rotates. A bounded spherical camera orbit keeps the
        // windpipe upright and in frame, with separate, gradual dolly movement.
        const yaw = pointer.x * 0.48;
        const pitch = 0.12 + pointer.y * 0.2;
        const distance = 17 * responsiveScale * (1 + (pointer.x ** 2 + pointer.y ** 2) * 0.18);
        shared.uFocusDistance.value = distance;
        camera.position.set(
          Math.sin(yaw) * Math.cos(pitch) * distance,
          -0.2 + Math.sin(pitch) * distance,
          Math.cos(yaw) * Math.cos(pitch) * distance,
        );
        camera.lookAt(0, -0.2, 0);
        renderer.setRenderTarget(emission);
        renderer.clear();
        renderer.render(scene, camera);
        renderer.setRenderTarget(null);
        renderer.clear();
        renderer.render(compositeScene, compositeCamera);
      };
      const schedule = () => {
        if (!disposed && visible && !document.hidden && !frame && (settingsRef.current.running || movingCamera())) frame = requestAnimationFrame(tick);
      };
      const tick = (now: number) => {
        frame = 0;
        if (!visible || document.hidden) { lastTime = 0; return; }
        const delta = lastTime ? Math.min((now - lastTime) / 1000, 0.05) : 1 / 60;
        lastTime = now;
        if (settingsRef.current.running) elapsed += delta;
        // Exact critically damped spring: continuous velocity, no overshoot or
        // frame-rate-dependent jolts when the cursor changes direction.
        const decay = Math.exp(-4.8 * delta);
        for (const axis of ["x", "y"] as const) {
          const target = axis === "x" ? pointer.targetX : pointer.targetY;
          const velocity = axis === "x" ? "velocityX" : "velocityY";
          const offset = pointer[axis] - target;
          const impulse = pointer[velocity] + 4.8 * offset;
          pointer[axis] = target + (offset + impulse * delta) * decay;
          pointer[velocity] = (pointer[velocity] - 4.8 * impulse * delta) * decay;
        }
        render();
        schedule();
      };
      refreshRef.current = () => {
        lastTime = 0;
        if (!settingsRef.current.running && !movingCamera()) { cancelAnimationFrame(frame); frame = 0; }
        render();
        schedule();
      };
      const resize = () => {
        const width = Math.max(1, mount.clientWidth), height = Math.max(1, mount.clientHeight);
        camera.aspect = width / height;
        responsiveScale = Math.max(1.2, 15.2 / (2 * 17 * Math.tan(Math.PI / 8) * camera.aspect));
        camera.updateProjectionMatrix();
        renderer.setSize(width, height, false);
        emission.setSize(Math.round(width * ratio), Math.round(height * ratio));
        render();
      };
      const onPointer = (event: PointerEvent) => {
        const rect = mount.getBoundingClientRect();
        // Controls and scrolling outside the hero don't pull the camera around.
        if (event.clientY < rect.top || event.clientY > rect.bottom || (event.target instanceof Element && event.target.closest("button"))) return;
        pointer.targetX = Math.max(-1, Math.min(1, (event.clientX - rect.left) / rect.width * 2 - 1));
        pointer.targetY = -Math.max(-1, Math.min(1, (event.clientY - rect.top) / rect.height * 2 - 1));
        schedule();
      };
      const resetPointer = () => { pointer.targetX = 0; pointer.targetY = 0; schedule(); };
      const onVisibility = () => {
        lastTime = 0;
        if (document.hidden) { cancelAnimationFrame(frame); frame = 0; }
        else { render(); schedule(); }
      };
      const onContextLost = (event: Event) => { event.preventDefault(); setUnavailable(true); };
      const observer = new ResizeObserver(resize);
      observer.observe(mount);
      const intersection = new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        lastTime = 0;
        if (visible) { render(); schedule(); }
        else { cancelAnimationFrame(frame); frame = 0; }
      });
      intersection.observe(mount);
      window.addEventListener("pointermove", onPointer, { passive: true });
      window.addEventListener("blur", resetPointer);
      document.documentElement.addEventListener("pointerleave", resetPointer);
      document.addEventListener("visibilitychange", onVisibility);
      renderer.domElement.addEventListener("webglcontextlost", onContextLost);
      resize();

      cleanup = () => {
        cancelAnimationFrame(frame);
        observer.disconnect(); intersection.disconnect();
        window.removeEventListener("pointermove", onPointer);
        window.removeEventListener("blur", resetPointer);
        document.documentElement.removeEventListener("pointerleave", resetPointer);
        document.removeEventListener("visibilitychange", onVisibility);
        renderer.domElement.removeEventListener("webglcontextlost", onContextLost);
        geometry.dispose(); airwayGeometry.dispose(); quadGeometry.dispose(); emission.dispose();
        bodyMaterial.dispose(); airwayMaterial.dispose(); compositeMaterial.dispose();
        renderer.dispose(); renderer.domElement.remove();
        refreshRef.current = () => {};
      };
    }).catch(() => { if (!disposed) setUnavailable(true); });
    return () => { disposed = true; cleanup(); };
  }, [particleCount, unavailable]);

  if (unavailable) return <WireframeLungs headline={headline} className={className} presentation={presentation} />;

  return (
    <div className={cn("relative h-[min(780px,90svh)] min-h-[480px] w-full overflow-hidden", presentation === "background" && "h-full min-h-0", className)}>
      <div ref={mountRef} role="img" aria-label="Breathing red particle lungs with a curved windpipe and branching airways; move the cursor to orbit and zoom the camera" className="absolute inset-0" />
      {presentation === "panel" && <h2 className="pointer-events-none absolute left-8 top-8 z-10 text-3xl font-medium tracking-tight text-[#1F3A4B]">{headline}</h2>}
      <button
        type="button"
        aria-label={running ? "Pause lung animation" : "Play lung animation"}
        aria-pressed={running}
        onClick={() => setRunning((value) => !value)}
        className="pointer-events-auto absolute bottom-8 left-6 z-10 flex items-center gap-2 rounded-full border border-[#1F3A4B]/15 bg-white/85 px-3 py-2 text-[10px] uppercase tracking-[0.12em] text-[#1F3A4B] backdrop-blur-sm hover:border-[#F41626] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#F41626] sm:bottom-12 sm:left-12"
      >
        {running ? <Pause size={12} /> : <Play size={12} />}
        {running ? "Pause" : "Play"}
      </button>
    </div>
  );
}

export default GalaxyLungs;
