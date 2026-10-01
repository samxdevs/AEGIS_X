/**
 * Every string, figure and spec on this site comes from the SIH 2026 AEGIS deck
 * (PS 26180, Team TH10-HW). The only values not from the deck are the sample
 * telemetry in the hero and the alert card (both labelled illustrative in the
 * UI) and the component-level BOM, which is a marked placeholder.
 */

export const meta = {
  name: "AEGIS",
  fullName: "Autonomous Edge Guidance & Intelligent Surveillance",
  team: "TH10-HW",
  problemStatement: "26180",
  eyebrow: "SIH 2026 · PS 26180 · Team TH10-HW",
  theme: "Agriculture, FoodTech & Rural Development",
  category: "Hardware",
} as const;

export const nav = [
  { label: "Two-pass", href: "/#two-pass" },
  { label: "System", href: "/#system" },
  { label: "Evidence", href: "/#evidence" },
  { label: "Feasibility", href: "/#feasibility" },
  { label: "Impact", href: "/#impact" },
  { label: "Team", href: "/team" },
] as const;

export const hero = {
  headline: ["Two passes over the field.", "Every problem located, named", "and explained."],
  sub: "AEGIS flies an autonomous survey grid at 20–30 m, then revisits only the coordinates it flagged at 3–5 m. Segmentation runs on the aircraft, the orthomosaic builds on the field station. No step of the pipeline waits on a network.",
  primaryCta: "See the two-pass flow",
  secondaryCta: "Read the technical stack",
  telemetry: [
    { k: "ALT", v: "20–30 m AGL" },
    { k: "AREA", v: "4–8 acres" },
    { k: "ENDURANCE", v: "18–25 min" },
  ],
  link: { k: "LINK", v: "no network · local only" },
  proof: [
    "₹80,000 payload, not ₹6.67 lakh",
    "Fully offline: app, field display or SMS",
    "Evidence photo and confidence on every alert",
  ],
} as const;

export const alert = {
  title: "Water stress",
  severity: "Moderate",
  zone: "ZONE 3 · NE BLOCK · 17.4021, 78.5312",
  confidence: 0.81,
  capture: "PASS 2 · 3–5 m AGL",
  frameNote: "canopy gap",
  why: "Soil moisture 18%, leaf wetness 0, canopy +3.4 °C over the field mean.",
  action: "ड्रिप लाइन 3 जाँचें: इस खंड में सिंचाई से पहले।",
  chips: ["NEEDS INSPECTION", "LOG RESULT"],
} as const;

export const twoPass = {
  eyebrow: "TWO-PASS AUTONOMY",
  headline: "The survey finds where. The revisit decides what.",
  sub: "One flight maps the whole field at 20–30 m and flags coordinates. The second visits only those coordinates at 3–5 m. A 5 mm insect that was under a single pixel on pass one becomes a photograph on pass two.",
  passOne: {
    kicker: "PASS 1",
    title: "Survey grid",
    spec: "20–30 m AGL",
    body: "The drawn polygon becomes an autonomous survey grid. ArduPilot flies it, the camera triggers at every waypoint, and the Jetson segments frames in the air.",
    footnote: "4–8 acres · 18–25 min · one battery",
  },
  passTwo: {
    kicker: "PASS 2",
    title: "Flagged coordinates only",
    spec: "3–5 m AGL · reviewed before flight",
    body: "The hotspot map generates a second mission. A person approves it, the aircraft descends over each flagged square, and the close-up frame becomes the evidence attached to the alert.",
    frameTitle: "Evidence frame",
    frameMeta: "ZONE 3 · SAMPLE ALERT",
  },
  stats: [
    { v: "20–30 m", k: "Pass 1 survey altitude" },
    { v: "3–5 m", k: "Pass 2 confirmation altitude" },
    { v: "2 m", k: "Severity grid resolution" },
    { v: "0", k: "Network connections required", highlight: true },
  ],
} as const;

export const workflow = {
  eyebrow: "END-TO-END WORKFLOW",
  headline: ["From field", "polygon to", "farmer advisory"],
  sub: "Eight steps, none of which reach for the internet. The drone marker travels the rail as you scroll, and the step you are on opens to explain itself.",
  loop: {
    kicker: "GROUND TRUTH LOOP",
    body: "Every advisory ends in an inspection log. What the farmer actually found goes back into the next round of training data.",
  },
  steps: [
    {
      label: "Field polygon",
      body: "The farmer or FPO draws the boundary once. It becomes a survey grid at the chosen altitude, and the same polygon is reused every week so flights stay comparable.",
      tags: ["FIELDS2COVER", "REPEATABLE ROUTE"],
    },
    {
      label: "Survey grid mission",
      body: "ArduPilot flies it without a pilot: take off, grid, camera trigger at every waypoint, return home. The mission is verified in ArduPilot SITL first.",
      tags: ["ARDUPILOT + PIXHAWK", "VERIFIED IN SITL"],
    },
    {
      label: "Synced image + GPS capture",
      body: "A shared clock writes image, GPS and attitude into one record over MAVLink, so any pixel can be traced back to a coordinate on the ground instead of an approximate one.",
      tags: ["MAVLINK TIME-SYNC", "ONE RECORD PER FRAME"],
    },
    {
      label: "Onboard inference",
      body: "The Jetson Nano segments sampled frames in flight: nano-scale networks at 640 px, FP16 TensorRT, active cooling. Heavy work is deliberately left for the ground.",
      tags: ["JETSON NANO 4 GB", "FP16 TENSORRT"],
    },
    {
      label: "Hotspot map",
      body: "Flagged tiles are projected pixel-to-GPS, duplicates merged, and binned into a 2 m severity grid, producing a fast GeoJSON hotspot map.",
      tags: ["RASTERIO + GEOPANDAS", "2 m SEVERITY GRID"],
    },
    {
      label: "Low-altitude revisit",
      body: "The hotspots generate a second mission at 3–5 m over the flagged coordinates only. A person reviews that mission before it flies. The aircraft never re-tasks itself unsupervised.",
      tags: ["HUMAN-REVIEWED", "3–5 m AGL"],
    },
    {
      label: "Sensor fusion",
      body: "LoRa nodes bring soil moisture, leaf wetness, air temperature and water level in from the ground. Rule-based fusion pairs them with the imagery, so a stressed zone gets a reason and not just a colour.",
      tags: ["ESP32 + SX1276", "RULE-BASED FUSION"],
    },
    {
      label: "Farmer advisory",
      body: "Class, severity, confidence and an evidence photo, in the local language, delivered by app, field display or SMS. Anything the model is unsure of is labelled “needs inspection” rather than guessed.",
      tags: ["MAPLIBRE OFFLINE", "SMS VIA SIM7600"],
    },
  ],
} as const;

export const layers = {
  eyebrow: "TECHNICAL APPROACH",
  headline: ["Four layers,", "one offline system"],
  sub: "Nothing here is unproven hardware. Pixhawk, Jetson Nano and ESP32 are already in hand; ArduPilot, OpenDroneMap and pretrained encoders are reused. Only the integration between the four layers is ours.",
  aside: {
    kicker: "DATA LEAVES THE FIELD",
    body: "Imagery, models, map tiles and advisories stay local. Sync and SMS fire when a network appears.",
  },
  items: [
    {
      kicker: "LAYER 1",
      title: "Field sensing",
      specs: [
        "2 × ESP32 + LoRa SX1276 nodes",
        "SEN0308 capacitive soil moisture via ADS1115",
        "SHT31 air temp / RH, DS18B20 soil temp",
        "Leaf wetness, rain gauge, water level",
        "Reflectance panel for repeatable flights",
      ],
      stats: [
        { k: "NODES", v: "2 × ESP32" },
        { k: "RADIO", v: "LoRa SX1276" },
        { k: "SENSORS", v: "soil · air · leaf · water" },
      ],
    },
    {
      kicker: "LAYER 2",
      title: "Aircraft",
      specs: [
        "800 mm carbon quad, 15″ props, 6S 10 Ah",
        "4 × Tarot 4008 330 KV, 40 A ESCs",
        "Pixhawk + ArduPilot, M10 GPS, TFmini Plus",
        "IMX219 nadir camera on a damped mount",
        "Jetson Nano 4 GB: MAVLink sync + TensorRT",
        "3.2–3.7 kg all-up weight",
      ],
      stats: [
        { k: "SPAN", v: "800 mm" },
        { k: "PACK", v: "6S 10 Ah" },
        { k: "ENDURANCE", v: "18–25 min" },
      ],
    },
    {
      kicker: "LAYER 3",
      title: "Field edge station",
      specs: [
        "OpenDroneMap orthomosaic and RGB indices",
        "U-Net / YOLO11n aerial segmentation on tiles",
        "Rasterio + GeoPandas pixel-to-GPS projection",
        "Duplicate merge, 2 m severity grid, GeoJSON",
        "Rule-based fusion of imagery and sensors",
      ],
      stats: [
        { k: "RUNS", v: "fully offline" },
        { k: "GRID", v: "2 m severity" },
        { k: "OUTPUT", v: "GeoJSON layers" },
      ],
    },
    {
      kicker: "LAYER 4",
      title: "Farmer interface",
      specs: [
        "MapLibre GL offline map with problem layers",
        "Local-language advisory with evidence photo",
        "Field display and SMS fallback via SIM7600",
        "Mission history for week-on-week comparison",
        "Inspection log closes the loop with ground truth",
      ],
      stats: [
        { k: "DELIVERY", v: "app" },
        { k: "IN FIELD", v: "display" },
        { k: "FALLBACK", v: "SMS" },
      ],
    },
  ],
} as const;

export const evidence = {
  eyebrow: "EVIDENCE, NOT VERDICTS",
  headline: ["Every alert can be", "argued with."],
  sub: "Mohanty et al. reported 99.35% accuracy on PlantVillage and about 31% on independent field images. So AEGIS never simply names a disease. It hands over the photograph, the confidence and the sensor reading behind the call, and says “needs inspection” when it does not know.",
  callouts: {
    left: [
      {
        title: "Evidence frame from the revisit",
        body: "The revisit photograph the call was made on, not a stock image of the disease.",
      },
      {
        title: "Class and severity, in plain words",
        body: "“Water stress · Moderate”, never a bare model label.",
      },
      {
        title: "Confidence, always on screen",
        body: "Shown even when it is low, especially when it is low.",
      },
    ],
    right: [
      { title: "The exact coordinate", body: "A GPS fix for the zone, not “the north field”." },
      {
        title: "Why, from the ground node",
        body: "The soil and canopy readings that explain the colour on the map.",
      },
      {
        title: "What to check next",
        body: "One action, in the farmer’s language, on the field display or by SMS.",
      },
      {
        title: "An honest unknown",
        body: "“Needs inspection” is a first-class outcome, not a failure.",
      },
    ],
  },
  notes: [
    {
      stat: "99.35% → 31%",
      title: "We train on our own imagery",
      body: "PlantVillage accuracy against independent field images, Mohanty et al. 2016. Lab-trained models collapse outdoors, so ours are trained at our own camera and altitudes.",
    },
    {
      stat: "by field, by date",
      title: "Splits that refuse to leak",
      body: "Train and test sets are split by field and by capture date, so the model cannot score well by memorising one afternoon in one plot.",
    },
    {
      stat: "“unknown”",
      title: "A state we ship on purpose",
      body: "When the model is not sure, the alert says “needs inspection” and asks for a close-up, rather than inventing a disease name a farmer might spray for.",
    },
  ],
} as const;

export const feasibility = {
  eyebrow: "FEASIBILITY AND VIABILITY",
  headline: ["One aircraft an FPO can", "actually afford to own."],
  sub: "No unproven parts: Pixhawk, Jetson Nano and ESP32 are already in hand, and ArduPilot, OpenDroneMap and pretrained encoders are reused. One crop and one district first: paddy, where open Indian disease data already exists.",
  cost: {
    title: "Capital cost of one complete unit",
    ours: { label: "AEGIS prototype", value: "₹76,000 – ₹83,000", pct: 12.4 },
    theirs: { label: "DJI Mavic 3M, imported multispectral", value: "₹6,67,000", pct: 100 },
    note: "Per-acre scouting sold through FPOs and cooperatives keeps the capital cost off the individual smallholder. NIR, thermal and RTK are a modular upgrade path; they bolt on without redesigning the aircraft.",
    placeholder: "[ COMPONENT-LEVEL BOM: fill from your costing sheet ]",
  },
  specs: [
    { v: "3.2–3.7 kg", k: "All-up weight" },
    { v: "18–25 min", k: "Endurance on one 6S 10 Ah pack" },
    { v: "4–8 acres", k: "Mapped per survey flight" },
    { v: "6 weeks", k: "Build order, ending in a live two-pass field demonstration", highlight: true },
  ],
  risksTitle: "Five ways this could fail",
  risksSub: ", and what we did about each one",
  risks: [
    {
      risk: "Lab-trained disease models collapse on real field imagery.",
      fix: "Train and test on our own camera and altitudes, and split the data by field and by date so nothing leaks between the two.",
    },
    {
      risk: "A 5 mm insect is under one pixel at mapping altitude.",
      fix: "Detect canopy damage first, then confirm it on the 3–5 m revisit or a close-up phone image. Never claim the insect from 25 m.",
    },
    {
      risk: "Hotspot coordinates drift away from the real plants.",
      fix: "Shared clock, calibrated camera intrinsics, logged attitude and AGL, and an orthomosaic correction before anything is written to the map.",
    },
    {
      risk: "Jetson Nano cannot carry heavy models in flight.",
      fix: "Nano-scale networks at 640 px, FP16 TensorRT, sampled frames and active cooling. The mosaic and the heavy passes run on the ground station.",
    },
    {
      risk: "Rural fields have no usable network for hours.",
      fix: "Imagery, models, map tiles and advisories all stay local. Sync and SMS fire opportunistically, whenever a network happens to appear.",
    },
  ],
} as const;

export const impact = {
  eyebrow: "IMPACT AND BENEFITS",
  headline: ["Sprayed where it is needed,", "not everywhere."],
  sub: "The same flight that finds a problem also bounds it. Once a zone has a coordinate and a severity, the input follows the zone instead of the field.",
  audiences: [
    {
      icon: "sprout",
      title: "Farmers",
      body: "Problems located before they spread, and spray or irrigation applied to the flagged zone instead of the whole field.",
    },
    {
      icon: "group",
      title: "FPOs and cooperatives",
      body: "One aircraft serves many members, with shared scouting reports and a season-long record of every field.",
    },
    {
      icon: "clipboard",
      title: "Agriculture officers",
      body: "Field-level maps with dated evidence photos make advisories and scheme reporting verifiable rather than anecdotal.",
    },
    {
      icon: "globe",
      title: "Nation",
      body: "Lower chemical and water use per acre, and earlier warning of drought, flood and heat damage.",
      highlight: true,
    },
  ],
  benefits: [
    {
      kicker: "ECONOMIC",
      body: "Targeted intervention cuts pesticide, fertiliser and pumping spend. Capital cost is about ₹80,000 against ₹6.67 lakh for an imported multispectral drone, so an FPO can own one outright.",
      emphasis: "₹80,000",
    },
    {
      kicker: "ENVIRONMENTAL",
      body: "Chemicals reach only the zones that show damage, and irrigation is advised only where soil moisture and canopy temperature both justify it: less runoff, less groundwater drawn.",
      emphasis: "and",
    },
    {
      kicker: "SOCIAL",
      body: "Diagnostics reach farms with no connectivity, in the local language, with the photograph and the confidence attached, so advice can be questioned and checked, not just obeyed.",
      emphasis: "questioned and checked",
    },
  ],
} as const;

type ClosingPart = { t: string; accent?: boolean };

export const closing: {
  line: ClosingPart[];
  primaryCta: string;
  secondaryCta: string;
} = {
  line: [
    { t: "The drone finds " },
    { t: "where", accent: true },
    { t: " the problem is, close-up vision determines " },
    { t: "what", accent: true },
    { t: " it is, ground sensors explain " },
    { t: "why", accent: true },
    { t: " it is happening, and edge AI recommends " },
    { t: "what to check next", accent: true },
    { t: "." },
  ],
  primaryCta: "Read the full deck",
  secondaryCta: "Talk to the team",
};

export const footer = {
  blurb:
    "A field-deployable AI farming assistant that assumes there is no network, and says so plainly when it does not know.",
  columns: [
    { title: "SYSTEM", items: ["Two-pass autonomy", "Four layers", "Evidence model", "Offline by design"] },
    { title: "PROJECT", items: ["Problem statement 26180", "Team TH10-HW", "Six-week build order", "Repeat-flight history"] },
    {
      title: "RESEARCH",
      items: [
        "Mohanty et al., 2016",
        "Cucho-Padin et al., 2019",
        "Aasen et al., 2018",
        "ArduPilot survey docs",
      ],
    },
  ],
  legal: "SMART INDIA HACKATHON 2026 · AGRICULTURE, FOODTECH & RURAL DEVELOPMENT · PS CATEGORY: HARDWARE",
  team: "TEAM AEGIS · TH10-HW",
} as const;
