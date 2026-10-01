# What this app is — in short

## The project

- A farmer walks their field holding a small scanning device.
- It photographs the crop, identifies diseases and pests, and produces advice.
- A weather/soil station sits permanently in the field and feeds it extra data.
- **Neither device has a screen.** This phone app is the only way anyone sees
  any of it.
- No internet anywhere in the field. The phone joins the scanner's own Wi-Fi.

## What the app does

- Connects to the scanner over local Wi-Fi and copies new scans to the phone.
- Stores them permanently on the phone, so everything works offline afterwards.
- Shows each scan: what was found, how much to trust it, and what to do.
- Gives the advice in English **or Hindi, with no internet** (see `templates.ts`).
- Optionally writes a plain-language summary using AI — when there's signal.

## The one idea behind every decision here

The system often **cannot** measure something — a sensor isn't calibrated, the
sky is cloudy, a camera isn't fitted yet, the model isn't reliable for that
disease.

> The app's job is to make sure a missing measurement never looks like a
> measurement, and a guess never looks like a fact.

Almost every file below exists because of that sentence. A farmer may spray a
field based on this screen.

## What we did this session

- The app had been built against an **early draft** of the data format.
- The hardware team sent the **final** format (4 documents + 1 real sample).
- We rewrote the app to match it: data shapes, validation, all screens, the
  network layer, the test tooling and the sample data.
- Added three things the final format introduced: offline Hindi advice,
  reliability warnings, and per-sensor status.

---

## Every file, and why it exists

### `src/schema/` — the rules about the data

| File | What | Why |
|---|---|---|
| `advisory.ts` | The exact shape of a scan, written as TypeScript types | The phone and the device must agree on every field. Mistakes get caught while coding, not in a field. |
| `validate.ts` | 5 rules checked on **every** scan as it arrives | Bad data is stored **flagged and shown as broken** — never silently displayed, never thrown away. |
| `templates.ts` | The 21 possible pieces of advice, in English **and Hindi** | The device sends a code + numbers, not a sentence. The app looks up the sentence. That's how Hindi works with **zero internet**. |
| `reliability.ts` | How often the model is *actually* right, per disease | **The most important file here.** See below. |
| `classes.ts` | The 29 things the model can identify + farmer-friendly names | So a screen says "Rice blast", not `rice__blast`. |
| `*.test.ts` | Tests | Prove the rules fire when broken, and that real data still passes. |

**Why `reliability.ts` matters:** the model reports a "confidence" number. For
one common disease it reports **98% confident** — and independent testing shows
it gets that disease right **0% of the time** on an unfamiliar camera. Those two
numbers measure different things. So the app always shows *how often it's
actually right* **before** it shows the confidence. Otherwise the screen is
convincing and wrong.

### `src/db/` — the phone's own copy

| File | What | Why |
|---|---|---|
| `client.ts` | The local database + upgrade steps | Everything must work with the device switched off and no signal. |
| `advisories.ts` | Saving/loading scans, running validation on the way in | One doorway in, so nothing unchecked can get stored. |
| `seed.ts` | Loads 6 sample scans on first launch | The app demos fully with **no device and no network**. |
| `explanations.ts` | Cache for the AI-written summaries | Written once where there's signal, read later in the field. |

### `src/sync/` — talking to the device

| File | What | Why |
|---|---|---|
| `client.ts` | All 9 ways the app talks to the device | Only fetches what's new; safe to interrupt and re-run. |
| `network.ts` | **The Android problem**, isolated in one file | See "What's left". Kept in one file so the fix touches nothing else. |
| `state.ts` | Connected / syncing / failed / never connected | The freshness of what you're reading should never be ambiguous. |

### `src/ui/` — what you see

| File | What | Why |
|---|---|---|
| `theme.ts` | Colours, type, spacing | Matches the project website, so they read as one product. Light-only — it has to be readable in direct sunlight. |
| `components.tsx` | Buttons, cards, labels, the "not measured" block | There is **no way** to render a missing value as `0` or a blank. The component doesn't offer one. |
| `charts.tsx` | Bars, meters, the field plot | Hand-built, because a chart library shows the number and drops the warning attached to it. |
| `advisory.tsx` | Verdict, advice, sensor status, scan summary | The top half of a scan — what was found and what to do. |
| `detections.tsx` | Findings + reliability + map of where they were | Shows reliability *above* confidence. The map has no background map on purpose — the location is only accurate to a few metres. |
| `vegetation.tsx` | Greenness measurements | Carries a required warning: these compare parts of your field *to each other*, not to a healthy standard. |
| `water.tsx` | Temperature, water need, satellite view | Three of these are usually unavailable. This card renders *absence* well. |
| `pest.tsx` | Trap counts vs. spray thresholds | Says plainly that the count includes dirt and non-target insects — it's a deliberate over-count. |
| `explanation.tsx` | The AI summary block | Visually separated so nobody confuses AI prose with a measurement. |
| `field-geometry.ts` | Map maths | Separated out so it can be tested — a dot in the wrong place still *looks* like a correct map. |
| `brand.tsx`, `status-bar.ts` | Logo, status bar colour | Cosmetic. |

### `src/llm/` — the AI summary (optional extra)

| File | What | Why |
|---|---|---|
| `prompt.ts` | Instructions given to the AI | Tells it exactly how to describe uncertainty without softening it. |
| `client.ts` | The API call | The **only** part of the app that touches the internet. |
| `guard.ts` | **Rejects any number the AI invented** | Checks every digit against the original data. If the AI writes a dose that wasn't measured, the whole summary is thrown away and the invented number is named on screen. |

This whole folder is optional. Remove it and the app still works completely.
The real advice comes from the device, not the AI.

### `app/` — the three screens

| Screen | What |
|---|---|
| `index.tsx` | History list — every scan on the phone, worst first |
| `advisory/[id].tsx` | One scan in full: what you can't trust → verdict → advice → evidence |
| `sync.tsx` | Connect to the device, troubleshoot, import a file manually |
| `_layout.tsx` | Startup: open database, load samples, re-check stored scans |

### `fixtures/` — 6 sample scans

| File | Deliberately shows |
|---|---|
| `advisory-device-capture` | **Real data from the actual device.** Kept exactly as received. |
| `advisory-healthy` | Everything working — the good case |
| `advisory-failed-tier` | High confidence on an unreliable diagnosis |
| `advisory-recalled-dose` | A chemical dose that is **not** officially verified |
| `advisory-trap-above-etl` | Pest count over the spray threshold |
| `advisory-uncertain` | The device refusing to guess |

Five are invented and are labelled **SAMPLE DATA** everywhere they appear.

### `tools/fake-field-station.mjs`

- A fake device that runs on your laptop and behaves exactly like the real one.
- **Why:** the real device's Wi-Fi hardware hasn't arrived. This lets us build
  and test the entire connection without it.
- It even reproduces the awkward parts — the device going offline for 30
  seconds, timeouts, boot delays, rejected uploads.

---

## Current state

- ✅ 106 automated tests passing
- ✅ Type-checks clean
- ✅ All 9 device connections written and tested against the fake device
- ✅ Real data from the actual device loads and displays correctly
- ⚠️ **No screen has ever been displayed** — nobody has run the app yet
- ⚠️ **Android needs one more piece** (see below)

## What's left

| # | Item | Who | Effort |
|---|---|---|---|
| 1 | **Run the app and look at it.** Fix layout problems. | You | Half a day |
| 2 | Build a proper installable app (needed for #3) | You | ~2 h |
| 3 | **Android networking fix** — small piece of Android-specific code | You | ~1 day |
| 4 | Wi-Fi hardware arrives; first real connection | Hardware team | — |
| 5 | Answer 2 questions about the data format | Hardware team | 10 min |
| 6 | Add a way for the app to *send* settings to the device | Hardware team | see below |

~~Fix a bug: if the device's memory is wiped, syncing stops silently~~ —
**done 21 Sept.** If the device is ever wiped or reset, its scan numbering
starts again from 1 while the phone is still counting from where it left off.
The phone now notices, rebuilds from scratch, and says so on screen. Nothing on
the phone is ever deleted, so if the device loses scans, the phone keeps them.

**About #6 — the app can only read, never write.** The device has no way to
accept anything *from* the phone. There is no screen for adding a field, entering
a planting date or naming your seed variety — not because it was skipped, but
because the device offers nowhere to send it. Those settings are currently typed
directly on the device itself. Until it accepts them over the connection, the
crop-calendar screen stays empty and the satellite view can't be switched on.
It's one small addition on their side, and half a day on ours. Full detail and
a proposed design are in `INTEGRATION_READINESS.md` §4.

**About #3:** Android refuses to use a Wi-Fi network that has no internet, and
sends requests over mobile data instead — so they fail. The workaround is to
**turn mobile data off on the phone**, which works fine for a demo. The proper
fix is a small piece of Android code, needed only if real users will install it.

Full detail in `INTEGRATION_READINESS.md`. Technical detail in `README.md`.
