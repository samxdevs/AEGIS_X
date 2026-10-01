# AEGIS — farmer's phone app

The app holds a local replica of the pod's advisory database and pulls a delta
from it whenever the two happen to be near each other.

**There is no drone.** The system is a handheld scanning pod the farmer carries
through the field, and an unattended ground mast standing in it. Both are
headless, so **this app is the only user interface the system has** — every
degradation the hardware reports is one a farmer can only learn about here.
Nothing in this app should ever use the words *drone*, *flight* or *survey*.

Built against **wire contract v1.0**, 21 September 2026:
`docs/PAYLOAD_CONTRACT.md`, `docs/APP_TEAM_CHANGES.md`,
`docs/TEMPLATE_ID_REGISTRY.md`, `docs/VEGETATION_BLOCK_SPEC.md`.

It is built **fixture-first**: it runs with no pod, no network and no ML model.
Everything below works today.

## Running it

```bash
cd mobile
npm install
npm start          # Expo dev server
npm test           # schema, templates, cursor, LLM guard, geometry — 127 tests
npm run typecheck
npm run station    # fake pod gateway, serving the v1.0 API from the fixtures
```

`npm start` runs in Expo Go, which is enough for all UI work. Syncing against a
real pod needs a dev build — see **Android** below.

### Testing the sync without a pod

The SIH-FIELD access point is waiting on a replacement AR9271 USB adapter, so
nothing here has yet run over the radio it will ship on. That blocks the
*radio*, not the protocol — localhost is a link, and every endpoint, status code
and error body in the contract is reachable from the simulator:

```bash
npm run station                     # point the app at http://<LAN-IP>:8080
npm run station -- --flaky          # fails ~1 fetch in 3, to exercise resumability
npm run station -- --slow 800       # 800 ms per response
npm run station -- --booting 20     # 503 + Retry-After for the first 20 s
npm run station -- --allow-mock     # serve mock-backend advisories instead of 403
npm run station -- --no-mast        # mast sync reports MAST_NOT_FOUND
```

It reproduces the awkward parts rather than the easy ones. `sync/trigger` really
does drop the access point for thirty seconds and close every socket, because
that is what the pod does — it has one radio, and collecting from the ground
mast means leaving its own network. A client that has never seen that window
will report a working pod as dead.

Every advisory it serves carries `x-aegis-simulated: true`, and the app stores
anything with that header as `origin: 'fixture'`. A simulator that let invented
numbers arrive looking measured would build the project's own worst failure mode
into the test rig, so the header decides the origin rather than the app's
optimism about what it just connected to.

## What is here

| Path | What it does |
|---|---|
| `src/schema/advisory.ts` | The v1.0 advisory as TypeScript, mirroring what the pod emits. |
| `src/schema/templates.ts` | The 21 action templates, with the offline Hindi table and the mandatory verification badges. |
| `src/schema/reliability.ts` | Cross-source generalisation tiers and per-class held-out recall. |
| `src/schema/classes.ts` | The 29 classifier classes and what to call them on screen. |
| `src/schema/validate.ts` | The five schema rules, mechanically enforced. |
| `fixtures/` | Six advisories. One captured off the real device; five degraded on purpose. |
| `src/db/` | SQLite replica, migrations, ingest, sync cursor, file import. |
| `src/sync/client.ts` | Every gateway endpoint, and the delta pull: cursor → manifest → fetch → ack. |
| `src/sync/network.ts` | The platform boundary. All of it, in one file. |
| `src/ui/advisory.tsx` | Provenance, verdict, growth stage, actions, inputs, scan. |
| `src/ui/vegetation.tsx` | Canopy gate, the four RGB indices, and the mandatory relative-reading caveat. |
| `src/ui/water.tsx` | Thermal, the NoIR probe, satellite NDVI, FAO-56 irrigation. |
| `src/ui/pest.tsx` | Sticky-trap counts, the ETL comparison, and what the count actually counts. |
| `src/ui/detections.tsx` | Findings with their reliability tier ahead of their confidence, and the field plot. |
| `src/llm/` | The fourth tier: the advisory explained in plain language. |
| `app/` | Three screens: history, advisory, pod. |
| `tools/fake-field-station.mjs` | A fake pod gateway, so the whole API is testable with no hardware. |

## The schema is the contract

`validateAdvisory()` runs on every advisory at ingest and enforces five rules:

1. **Absence is `null` plus a machine-readable reason** — never a default, never
   zero, never an interpolated guess. Each of the four availability blocks
   (`thermal`, `ndvi`, `ndvi_satellite`, `irrigation`) must say why when it is
   unavailable.
2. **Every threshold carries `threshold_source` and `threshold_confirmed`** — a
   `PROVISIONAL` figure must not render like a CIB&RC-sourced one.
3. **`inputs[]` is mandatory and complete** — a section that produced a number
   must declare the sensor it came from.
4. **`source` on every numeric block** — `measured` | `derived` | `derived_fao56`.
5. **Every claim declares its citation provenance** — `verification_status` on
   every action and on the growth stage, `cross_source_reliability` on every
   detection, and the two copies of `verification_status` must agree.

An advisory that fails is **stored with its violations and rendered as broken**,
not dropped and not quietly displayed. Catching a fabricated number and then
throwing away the evidence would defeat the point of catching it.

The renderer is built so the honest rendering is the only one reachable:
`<Measurement>` takes a value and its status together and has no prop that makes
a `null` render as `0`, blank, or a dash.

### The validator's hardest job is not rejecting things

`fixtures/advisory-device-capture.json` is the advisory the hardware team
captured off the Jetson Nano on 19 September, byte for byte, and
`validate.test.ts` asserts it passes. A validator that rejects reality is worse
than no validator: every real advisory would arrive flagged, and a warning that
fires on everything is a warning nobody reads.

That fixture is also why several enums here are open rather than closed. The
device emits `growth_stage.status: "CROP_NOT_SPECIFIED"`, which the contract's
own table does not list, and an `irrigation` block of exactly two keys where the
table describes twenty. Both are accepted; both would have failed a literal
reading of the document.

## Confidence is not accuracy

This is the single most important thing this app does differently.

Model A reports a calibrated softmax maximum as `confidence`. It is not an
accuracy, and on this model the two are close to unrelated. Evaluated on
held-out camera rigs — which is what a field pod actually is — macro-F1 is
**37.4%**, against 94.85% in-distribution. The gap is residual source-identity
shortcut learning: the model partly learned which dataset a photo came from
rather than what is wrong with the plant.

Per class it gets worse. `rice__bacterial_leaf_blight` recovers **0.00%** of its
cases on an unseen camera. The real device capture carries exactly that class at
**0.9817** confidence.

So every detection carries `cross_source_reliability`, and the UI renders the
tier **before** the confidence, prints the held-out recall beside it, and shows
`TESTED_FAILED` as a full-width warning rather than a quiet chip. The history
list carries it too, because the list is where most looking happens. A finding
is a reason to walk over and look, not a diagnosis.

## Offline Hindi, from `template_id`

The pod sends a rendered English sentence *and* a `template_id` plus a
structured `params` map. The second pair is what makes a Hindi UI possible with
no connection: `src/schema/templates.ts` holds all 21 templates in both
languages and substitutes from `params`. Deterministic, auditable, no model, no
network, no runtime translation service in an offline-first product.

The safety property that falls out of this is the one the registry cares about.
Because a localised view renders from that table and may never read the pod's
English `rationale`, a warning living only in the rationale can be dropped by
switching language. So the badge is rendered from the structural
`verification_status` enum, never by pattern-matching prose, and
`RECALLED_UNVERIFIED` carries its caution unconditionally — there is no prop on
`<VerificationBadge>` that suppresses it. `templates.test.ts` pins that, checks
both languages carry the same placeholders so a dose cannot be dropped in
translation, and checks an *unrecognised* status fails cautious rather than
falling through to a neutral badge.

| Status | Rendered as |
|---|---|
| `WEB_VERIFIED` | CIB&RC REGISTERED — checked against the Government of India registered label claim. |
| `VERIFIED` | TRACED TO CODE — the system's own logic or a published equation. |
| `RECALLED_UNVERIFIED` | **DOSE NOT VERIFIED** — mandatory caution, sends them to their KVK. |
| `UNSOURCED` | CONSULTATION RECOMMENDED — no chemical is being recommended at all. |

## The vegetation caveat is mandatory

`VEGETATION_BLOCK_SPEC` §1.2 requires this sentence on screen whenever a
relative band is shown, and forbids hiding it in a tooltip:

> Compares parts of your field against each other. It cannot tell you whether
> the whole field is healthy.

It is a panel at the top of the card, above every band, rendered from the
exported `VEGETATION_CAVEAT` constant so an edit cannot paraphrase away its
second sentence — which is the load-bearing half. A uniformly stressed field has
a perfectly normal internal distribution and looks entirely healthy here.

The canopy gate is read from `min_fraction_threshold` in the payload rather than
hardcoded, because the contract table says 0.10 and the block spec says 0.15.

## The trap count is an over-estimate, and says so

`TEMPLATE_ID_REGISTRY` §4.3 sets up a deliberate split. The gate on whether a
farmer sprays is `total_blobs_counted` — a deterministic watershed segmentation.
The cross-domain CNN, stamped `RECALLED_UNVERIFIED`, does not get a vote on
chemical intervention. That means the count includes debris and non-target
insects, so it is a conservative over-estimate against the threshold.

Dropping that second half is not neutral: an over-estimate presented as a
species count pushes toward spraying. So the disclaimer travels with the number
from a constant, and the morphological breakdown under it is labelled as the
unverified guess it is.

## Fixtures

Five of six are degraded on purpose — degraded rendering is what gets skipped
when a demo is built happy-path-first, and on this system the degraded states
are not edge cases.

| Fixture | Exercises |
|---|---|
| `advisory-device-capture` | **Real.** Off the Jetson, 19 Sept. Multiple crops detected, thermal pending calibration, no GPS, `irrigation` collapsed to two keys, and blight at 0.98 on a 0.00%-recall class. |
| `advisory-healthy` | Everything available: CWSI computed, satellite scene cached, irrigation from the mast, trap under the limit. |
| `advisory-failed-tier` | High confidence on `TESTED_FAILED`, with a `WEB_VERIFIED` streptocycline dose. The case the reliability UI exists for. |
| `advisory-recalled-dose` | A `RECALLED_UNVERIFIED` sugarcane dose that must not render like a registered one, on a bare-soil scan where every index is legitimately withheld. |
| `advisory-trap-above-etl` | Over the published ETL, beside a pest a sticky card cannot sample and one with no published limit. |
| `advisory-uncertain` | The pod declining to call it, on the ONNX fallback engine. |

All six load with `origin: 'fixture'` and are labelled **SAMPLE DATA · NOT A
MEASUREMENT** wherever they appear. `origin` is a four-way distinction —
`synced` / `replay` / `fixture` / `imported` — because those are four different
claims about reality and the UI must not merge them.

`replay: true` means the advisory was assembled from a video file rather than a
live walk. The real capture carries it. A missing `replay` key is read as
`true` on both sides: the failure worth guarding against is a seeded record
labelled live, so a bug has to produce the safe error.

## The fourth tier — the advisory in plain language

`src/llm/` turns a stored advisory into a few paragraphs a farmer can act on, in
English or Hindi. It is **purely additive** and the field path does not touch it:
the advisory is pulled, validated, stored and rendered before this runs, and if
it never runs the app is exactly what it was. `actions[]` still comes from the
pod, deterministically, and is rendered above this block — in Hindi too, from
the template table, with no connection. **This explains those actions; it does
not replace them.**

Generated text is cached in SQLite per (advisory, language), so it is written
once in whatever window the phone has signal and read afterwards in the field
with no connection at all.

### The guard is the point

`src/llm/guard.ts` extracts every numeric token from the generated text and
requires each one to appear in the source advisory. An explanation that invents
a dose, a price, or a day count is **discarded and never shown** — the UI reports
the refusal and names the invented figure.

Everything else here exists to stop an unmeasured number reaching a farmer, and
the app is the last place a fabricated one can be caught. A model writing the
final prose is the first place in the whole system where one can be *created*.
It would be a strange place to stop being careful.

The check is deliberately blunt and will occasionally refuse a fine explanation.
That trade is the right way round: a refused explanation costs a retry, a
fabricated dose costs a crop. `guard.test.ts` includes that it actually fires —
a guard never seen to reject anything is not a guard.

### Configuring it

Nothing is configured by default, and until it is the explanation card stays
hidden rather than failing oddly.

**On the phone (recommended).** Open the Profile tab, find **AI explanations**,
pick a provider, paste a key, tap **Test key**, then **Save**. Supported: Claude,
ChatGPT, Gemini, Groq, Grok, Mistral, DeepSeek, OpenRouter, and **Other** for any
service that speaks the OpenAI chat-completions format (including Ollama on your
own machine). Each provider keeps its own key, and the model name is editable
because model names go stale faster than the app does. The key is stored in the
app's private storage on the phone, so unlike a build-time key it is not inside
the APK. The catalog is `src/llm/providers.ts`; adding a provider is one entry.

**At build time (fallback, used only when nothing is saved on the phone).**

```bash
# Preferred of the two: the key stays on a server you control.
EXPO_PUBLIC_AEGIS_LLM_PROXY=https://your-proxy.example/v1

# Demo-week alternative: the key is compiled into the bundle and is
# extractable from the APK by anyone who downloads it. EXPO_PUBLIC_ is Expo's
# marker for "inlined into the bundle", which is a usefully blunt name for it.
EXPO_PUBLIC_ANTHROPIC_API_KEY=sk-ant-...
```

Claude defaults to `claude-opus-5` at medium effort. One call per advisory per
language, not per screen. Whichever provider writes the text, the guard above
checks it the same way.

## Two platform gotchas

**Android.** Joined to a WiFi network with no internet, Android keeps the
default route on mobile data, so a request to `192.168.4.1` leaves over cellular
and times out. It looks exactly like a dead server.

The fix is `ConnectivityManager.requestNetwork()` with `TRANSPORT_WIFI` and
*without* `NET_CAPABILITY_INTERNET`, then binding to the returned `Network`.
That is native code — it cannot run in Expo Go.

**That native module is not written yet.** `src/sync/network.ts` exposes the
interface, ships a no-op, and reports `bound: false`, so the pod screen says
plainly that binding is unavailable instead of failing mysteriously later.
`explainNetworkFailure()` names the cause when a local-address request times
out. Turning mobile data off is the workaround until the module lands.

`app.json` already sets `usesCleartextTraffic` (the link is plain HTTP by
design) and the three network permissions the binding will need.

**iOS.** `NSLocalNetworkUsageDescription` and `NSAllowsLocalNetworking` are set
in `app.json`. iOS prompts on first local connection; a denied prompt is
reported as a permissions problem rather than an unreachable server.

## Not proven on hardware

Stated here rather than discovered in front of a judge. All three are also said
on the pod screen, in the app.

- **The SIH-FIELD access point does not exist yet** — it is waiting on a
  replacement AR9271 USB adapter. Every endpoint below was verified by the
  hardware team over Ethernet, not over that radio.
- **`POST /api/v1/trap/upload`** — implemented to the contract, not yet
  exercised on the real Jetson.
- **`POST /api/v1/sync/trigger`** — same. The AP/STA window it opens is
  simulated faithfully in `tools/fake-field-station.mjs`.

## Not built yet

- The Android network-binding native module and its config plugin.
- Picking a trap photo from the camera roll. `uploadTrapImage()` takes a `Blob`
  and is wired to the contract; nothing calls it from a screen yet, because
  choosing an image needs `expo-image-picker` and a dev build.
- A live call against the real LLM API. The guard, the prompt, the cache and the
  screen are all written and typecheck clean, but no request has been made from
  this machine — there is no key configured here. First run needs a human.
- Localisation of the app's own fixed strings. The *advice* speaks Hindi offline;
  the card headings around it do not.
- Entering the planting date and seed variety, which is what would move
  `cycle_verification_status` from `RECALLED_UNVERIFIED` to `VERIFIED` and make
  the growth stage worth reading. The screen already invites it.
- Multi-field and multi-node UI. One ground mast, one field.

## Stack

Expo SDK 57 · React Native 0.86 · expo-router · expo-sqlite · TypeScript strict.
Palette converted from the tweakcn **nature** oklch tokens in
`web/app/globals.css` so the app and the project site read as one system. Light
only — a screen that has to stay legible in direct sun is not the place for a
dark mode.

Tests run on Node's built-in runner with native type stripping: no jest, no
babel, no transform step.
