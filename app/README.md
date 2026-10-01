# AEGIS

**Autonomous Edge Guidance & Intelligent Surveillance**

A field-deployable AI farming assistant that assumes there is no network.
Smart India Hackathon 2026 · Problem statement **26180** · Team **TH10-HW**
· Theme: Agriculture, FoodTech & Rural Development · PS category: Hardware

An 800 mm quadcopter flies an autonomous survey grid at 20–30 m, then revisits
only the coordinates it flagged at 3–5 m for close-up confirmation. Segmentation
runs on the aircraft, the orthomosaic builds on the field station, and no step of
the pipeline waits on connectivity.

This repository holds the project website and the farmer's phone app.

## Running the site

```bash
cd web
npm install
npm run dev
```

Then open <http://localhost:3000>. `npm run build` produces a fully static
export; both routes prerender.

## Layout

```
web/                    the Next.js site
  app/                  routes: / and /team
  components/
    sections/           one file per page section
    drone/              the aircraft SVG
    team/               roster cards
    ui/                 shared primitives + the AEGIS wordmark
  lib/content.ts        every string on the landing page
  lib/team.ts           the roster
mobile/                 the farmer's phone app (Expo / React Native)
  src/schema/           the §7.3 advisory contract + its validator
  fixtures/             five sample advisories, four of them degraded
  src/db/               SQLite replica and sync cursor
  src/sync/             delta pull + the §14.1 platform boundary
  app/                  routes: history, advisory, field station
design/                 design mockups (.dc.html artboards + canvas)
data_flow_architecture.md   connectivity + data flow, the app's spec
SIH_2026_AEGIS_Presentation.pptx
```

## Running the app

```bash
cd mobile
npm install
npm start
```

See `mobile/README.md`. It runs with no drone, no field station and no network —
the local replica is seeded with sample advisories, labelled as such.

**All copy lives in `lib/content.ts`.** Every claim, figure and spec there comes
from the presentation. The one exception is the demo advisory card, which is
invented sample data and labels itself `SAMPLE ALERT · ILLUSTRATIVE VALUES`
wherever it appears. The component-level BOM on the Feasibility section is a
marked placeholder.

## Stack

Next.js 16 · React 19 · Tailwind CSS v4 · Motion · TypeScript

Theme is [tweakcn](https://tweakcn.com) **nature**, light mode only — the dark
token block is deliberately removed. Type is Montserrat + Source Code Pro. The
AEGIS wordmark is drawn as SVG paths (`AEGIS_LETTERFORMS` in
`components/ui/bits.tsx`) rather than set in a typeface, and the same drawing is
reused on the drone's airframe.

Motion is decoration throughout: everything animated is disabled or reduced
under `prefers-reduced-motion`.

## Team

Akshat Bisht · Mohd Ahsan · Samriddh Murgai · Sania Malik · Suman Mondal ·
Vitthal Goel
