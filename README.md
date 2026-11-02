# PulseMind scroll animation

A React scroll animation using the supplied PulseMind logo, recolored entirely
in `#F41626` to match the line. The complete logo is visible at the top.
Scrolling extends its tip as a heartbeat line down the right edge of the page; scrolling
back up retracts only the extension. This project includes Vite, React,
strict TypeScript, Tailwind CSS v4, and a shadcn-compatible component structure.

## Run locally

Install Node.js 22.12 or newer (Node 24 LTS is suitable), including npm, then run:

```bash
npm install
npm run dev
```

Open the local URL printed by Vite and scroll down to draw the SVG stroke.
Keep that terminal running while viewing the app. Use Vite's `Local:` URL rather
than the editor's **Go Live** button: Live Server serves the TypeScript source
without compiling it, which produces a blank page.

If your terminal reports `zsh: command not found: npm`, install Node.js (which
includes npm). On a Mac with Homebrew:

```bash
brew install node
```

Open a new terminal, then run `node --version` and `npm --version` to confirm the
installation before running `npm run dev` again.

```bash
npm run typecheck
npm run build
npm run preview
```

`build` checks TypeScript before creating the production app in `dist/`.

## Component and style paths

- `components/ui/site-header.tsx`: sticky white navigation, original two-tone vector logo, responsive menu, and language switch.
- `lib/site-content.ts`: English/Vietnamese navigation and hero labels.
- `components/ui/svg-follow-scroll.tsx`: red line scroll animation, exported as `Skiper19`.
- `components/ui/galaxy-lungs.tsx`: GPU particle lungs, displayed behind the logo.
- `components/ui/helix-chrono-matrix.tsx`: compatibility export for the existing lung import.
- `components/ui/wireframe-lungs.tsx`: preserved mirrored wireframe version and WebGL fallback.
- `lib/lung-geometry.ts`: shared mirrored anatomical contours and airway paths.
- `lib/particle-airways.ts`: curved windpipe and tapering bronchial tubes for the particle model.
- `assets/pulsemind-original.ai`: original Illustrator source supplied through Drive.
- `lib/pulsemind-logo.ts`: original vector contours from Illustrator artboard 4.
- `public/images/pulsemind-logo.svg`: reusable red SVG logo.
- `public/images/pulsemind-logo.png`: original supplied artwork, retained as a reference.
- `demo.tsx`: supplied usage example, rendered by `main.tsx`.
- `styles/globals.css`: Tailwind import, shadcn theme tokens, and font utilities.
- `lib/utils.ts`: standard shadcn `cn()` class-name helper.
- `components.json`: shadcn CLI configuration and component aliases.

The `@/` alias resolves to the project root in both TypeScript and Vite, so the
supplied `@/components/ui/svg-follow-scroll` import works directly. Reusable UI
components belong in `components/ui`; keeping this folder aligned with
`components.json` means the shadcn CLI and copied component imports agree on where
to find them. There was no previous default component or style directory.

The logo uses all 19 original vector paths and transforms from the supplied
Illustrator file's fourth artboard. No tracing, curve fitting, or font substitution
is used; only the fill changes to `#F41626`. The scrolling extension starts beneath
the original tip, using the source cap's position and width. Its bend spans 80%
of the viewport height, then continues through two ECG-style heartbeat clusters
to the page bottom, including its rounded end cap. The spikes scale with the
viewport and stay inside the page edges. Framer Motion reveals only the extension
as you scroll.
The SVG spans the actual page instead of staying inside a sticky viewport; a
ResizeObserver keeps the geometry fitted to every screen size. Scrolling controls the extension
directly, including when Reduce Motion is enabled; there is no autoplay, spring,
or inertia. The page background is white (`#FFFFFF`), matching the navigation.
Plus Jakarta Sans is bundled locally using Fontsource and registered as
Tailwind's `font-jakarta-sans` utility.

## Navigation

The compact white header is 80px tall on desktop and 72px on mobile, with a
188px two-tone PulseMind logo, 16px navigation labels with 28px gaps, and a
104 × 44px red EN / VI button without an active-language underline.
Desktop gutters scale from the supplied reference's 128px;
the three groups have equal space between them. The five menu links are visual
placeholders for now: clicking them does not navigate or scroll. No extra page
sections or section copy have been added.

EN / VI switches the navigation and hero labels between English and
Vietnamese and updates the document language. The header slides away on downward
scroll and returns on upward scroll or at the top, without changing the page's
layout. Small scroll movements are filtered to prevent flicker. The mobile menu
closes on downward scroll, link selection, or Escape. Anchor offsets account for
the sticky header; reduced motion disables sliding and smooth scrolling.
The hero fits the remaining first-screen space
below the header; the red heartbeat continues to the page bottom.

## Animated lungs

The [Black Hole Galaxy reference](https://www.framer.com/marketplace/components/black-hole-galaxy/)
is adapted into mirrored anatomical lung volumes, preserving their broad rounded
bases, trachea, and branching airways. The current particle surface takes visual
direction from the [NUSX reference](https://nusx.edu.sg/). Three.js uses a budget
of 10,000 lung dots on desktop (6,500 on mobile), plus up to 1,400 airway particles
(900 on mobile), with breathing and soft star cores. Actual counts depend on
available surface area and spacing (approximately 6,300 lung dots on desktop).
Dots are 36% larger than the previous version, with wider gaps.
Staggered rows follow the curved surface. Rows and dots are placed using measured
curve lengths, with a minimum distance between neighbors to avoid crowding.
Surface normals, directional lighting, faded rear faces, and depth-dependent
dot size and brightness make the rounded 3D shape readable during camera motion.
The lung dots have boosted contrast on gray, while airway dots use stronger
emission, larger cores, and less rear-face fading to keep the branches visible.
Airway sampling follows tube surface area and curve
length, with the same spacing check across branches and junctions, so narrow
tips receive fewer particles and don't form dense clusters. The actual airway
count stops below its budget when additional dots would violate that spacing.
A transparent compositor maps the additive
glow into red so it remains visible over the white page.

Particles keep their identities as the lower lobes expand outward and downward
on a 5.6-second breathing cycle, then settle on exhale. Front/back shading and a
subtle oblique fissure give the mirrored lobes more volume. The windpipe has a
curved cylindrical wall, cartilage rings, a rounded fading top, and tapering
bronchial branches. Interior airway particles move down and back with the breath;
they never wrap abruptly from the end of a tube to its beginning.

The lung model stays fixed. Cursor movement controls a bounded spherical camera
orbit and a separate gradual dolly out/in, with a critically damped spring to
preserve smooth velocity during direction changes. Returning to the center
restores the frontal view. Camera fitting includes room for the fully expanded
lungs, with an approximately 8% larger view while keeping the windpipe in frame.
The original vector logo and scrolling
heartbeat stay in front.

The pause/play control stays in the lower-left corner. Reduce Motion starts the
particle animation paused; Play explicitly enables it. Cursor interaction remains
available while paused. Rendering stops off-screen or in a hidden browser tab.
If WebGL is unavailable, the preserved mirrored wireframe version is displayed.

The reusable component also supports a standalone panel:

```tsx
import GalaxyLungs from "@/components/ui/galaxy-lungs";

<GalaxyLungs />
```

Three.js is loaded in a separate runtime chunk. The project includes `three`,
`@types/three`, TypeScript, Tailwind, `lucide-react`, and the shadcn component paths.

## Setting up the same stack in another project

For a new project, scaffold React with TypeScript:

```bash
npm create vite@latest my-project -- --template react-ts
cd my-project
npm install
npm install tailwindcss @tailwindcss/vite framer-motion
```

Register `tailwindcss()` alongside `react()` in `vite.config.ts`, then add
`@import "tailwindcss";` to your global stylesheet and import that stylesheet
from the application entry point. Tailwind v4 supports the supplied `mt-42` and
`rounded-4xl` utilities without a `tailwind.config` file.

For an existing JavaScript project, install TypeScript and React types, add a
`tsconfig.json` with `jsx: "react-jsx"`, and rename React source files to `.tsx`:

```bash
npm install -D typescript @types/react @types/react-dom @types/node
```

Configure `@/*` in TypeScript and the matching Vite alias before initializing
shadcn:

```bash
npx shadcn@latest init
```

Choose your global stylesheet and set the UI alias to `@/components/ui`. In this
project the manual configuration is already present, so you can add components
directly:

```bash
npx shadcn@latest add button
```

References: [Vite setup](https://vite.dev/guide/),
[Tailwind with Vite](https://tailwindcss.com/docs/installation/using-vite), and
[shadcn manual setup](https://ui.shadcn.com/docs/installation/manual).
