# Integration readiness — app side

**As of:** 21 September 2026
**Against:** wire contract v1.0 (`PAYLOAD_CONTRACT.md`, `APP_TEAM_CHANGES.md`,
`TEMPLATE_ID_REGISTRY.md`, `VEGETATION_BLOCK_SPEC.md`)
**Question this answers:** when the replacement AR9271 adapter arrives and
`SIH-FIELD` goes live, does the app just work?

---

## Verdict

**On iOS: probably yes.** One permission prompt, then it should pull.

**On Android: no, not without more work.** There is one hard blocker — a native
module that is specified but not written — and until it lands, a phone joined to
`SIH-FIELD` will send its requests out over mobile data and time out. The pod
will be up, the AP will be up, the phone will be associated, and every request
will still fail. There is a workaround (turn mobile data off) that is good
enough to demo on and not good enough to ship on.

Everything downstream of the socket is done and tested: the whole v1.0 schema,
all nine endpoints, the delta pull, the validator, all six screens, offline
Hindi. 106 tests pass, `tsc` is clean, and the advisory captured off the Jetson
on 19 September validates and renders byte for byte.

What follows is everything between here and "it works", split by who has to do
it.

---

## 1. Blockers — it will not work until these are done

### B1. Android network binding module · **app team** · ~1 day

**This is the only true blocker.**

When Android joins a WiFi network with no internet, it keeps the *default route*
on mobile data. `fetch('http://192.168.4.1:8080/...')` therefore leaves over the
cellular interface and times out.

The failure is indistinguishable from a dead server, which is why this costs a
day if it is hit cold rather than planned for.

**The fix:** `ConnectivityManager.requestNetwork()` with a `NetworkRequest`
specifying `TRANSPORT_WIFI` and *without* `NET_CAPABILITY_INTERNET`, then
binding the process to the `Network` handed back in the callback.

That is Kotlin. It cannot be done from JS and it cannot run in Expo Go. It needs
a small native module plus an Expo config plugin.

**Current state:** `src/sync/network.ts` exposes the interface the rest of the
app already codes against, ships a no-op, and returns `bound: false` so the pod
screen says plainly that binding is unavailable rather than failing
mysteriously later. `explainNetworkFailure()` already names this exact cause
when a local-address request times out. **When the module lands, nothing else in
the app changes** — that was the point of putting the boundary in one file.

**Workaround until then:** turn mobile data off on the phone. Android then has
no default route to prefer and the request goes over WiFi. This genuinely works.
It is also one settings toggle away from silently breaking mid-demo, so it is a
bridge, not a destination.

### B2. A real dev build · **app team** · ~2 hours, mostly waiting

Expo Go cannot run this against a pod, for two independent reasons:

- it cannot load the native module from B1, and
- `usesCleartextTraffic` is set through `expo-build-properties`, which only
  takes effect in a built app. Expo Go blocks plain HTTP on Android.

So: `npx expo run:android` (or an EAS build) is required. Worth doing **before**
the adapter arrives rather than on the same afternoon — a first native build
always finds something.

### B3. Nobody has rendered a single screen · **app team** · ~half a day

Everything is typechecked and unit-tested. **No screen has ever been drawn.**

Layout, contrast, text overflow and scroll behaviour on the new cards
(`vegetation.tsx`, `water.tsx`, `pest.tsx`, the reliability panels) are entirely
unproven. The fixtures make this cheap — the app runs a full six-advisory
history with no pod, no network and no model — so this is an afternoon with
Expo Go, not a dependency on hardware.

Do this one first. It is the only item on this page that needs nothing from
anybody else.

---

## 2. Latent defects — it will work, then silently stop

These will not show up in a first happy-path test. They show up later, usually
in front of someone.

### D1. A pod database reset wedges sync permanently · ~~app team~~ · **FIXED**

The cursor is `seq`, the pod's SQLite rowid. The manifest is requested as
`?since=<cursor>`.

**If the pod's database is ever wiped or reflashed, `seq` restarts at 1.** The
phone's cursor is still at, say, 95. Every subsequent manifest request returns
an empty list, forever. No error, no warning — the app reports a successful sync
that fetched nothing, and the farmer's history quietly stops growing.

Given this is a competition build that will be reflashed repeatedly, this is a
when, not an if.

**Fixed, 21 September.** `/health` already reports `latest_seq`, which is the
pod's own high-water mark and cannot legitimately go backwards — pruning removes
the *oldest* records, so it only ever grows. `latest_seq < cursor` therefore has
exactly one meaning, and the sync now rewinds to 0 and re-pulls. Re-pulling is
harmless: ingest is an upsert keyed on `advisory_id`.

- The decision lives in `src/sync/cursor.ts`, deliberately free of database and
  React Native imports so it can be unit-tested. **11 tests** in
  `cursor.test.ts` cover both directions — it must fire on a real restart, and
  must *not* fire on a level sync, a pod that is ahead, a phone that has never
  synced, a pod that omitted the field, or a failed health probe. A check that
  fired on an ordinary sync would re-pull the whole history every time.
- The rewind target is `0`, not `null`. `null` would send `readCursor()` to the
  replica's own high-water mark as a fallback — which after a reset is the *old*
  numbering, so the next sync would detect a restart again and loop.
- The cursor is written the moment a restart is detected, not at the end of the
  sync, so an attempt interrupted halfway cannot leave the stale value in place
  to wedge the next one.
- It is **not** silent: `SyncOutcome.podReset` surfaces on the pod screen,
  because after a reset the phone may hold the only remaining copy of scans the
  pod has lost. Nothing on the phone is ever deleted by this.

Still worth confirming Q6 below — if `seq` is guaranteed to survive a reflash,
this becomes belt-and-braces rather than load-bearing.

### D2. Ack payload shape is assumed, not confirmed · **needs hardware team**

The route table documents `POST /api/v1/ack` with `{"advisory_id": "<id>"}`. The
400 error text documents *both* forms: `"Missing 'upto' or 'advisory_id' field
in payload"`.

The app sends `{"upto": <seq>}`, because a range acknowledgement is what
advancing a cursor means.

**Risk if wrong:** low. A failed ack is swallowed deliberately — the pod keeps
serving records it has already acked, and the next manifest is filtered against
the replica anyway. The only symptom would be `/health`'s `advisory_count` not
decreasing. Worth one curl to confirm.

### D3. Manifest `since` is assumed exclusive · **needs hardware team**

The app treats `?since=N` as "strictly greater than N", ascending.

**If it is actually inclusive**, the app re-fetches one advisory per sync —
harmless, because ingest is idempotent.

**If it is neither** — if it means an offset, or an index — the app skips
records, which is not harmless. One curl against a pod holding three advisories
settles it.

### D4. Every scan will be labelled REPLAY until a live one exists

`advisory-device-capture.json` carries `replay: true`, as the hardware team
said it would — the current pipeline runs against a video file. The app renders
a **REPLAY · NOT A LIVE SCAN** banner on every one of those, correctly.

This is not a defect, but it *will* look like one to a judge if nobody expects
it. Make sure at least one genuine live walk happens before the demo so the
banner's absence is itself visible.

---

## 3. Open questions for the hardware team

None of these block a first connection. All of them affect whether the app
renders the truth.

| # | Question | Why it matters |
|---|---|---|
| Q1 | Is `?since=N` on the manifest exclusive of N? | D3. Wrong guess means skipped records. |
| Q2 | Does `POST /api/v1/ack` accept `{"upto": <seq>}`? | D2. Wrong guess means the ack is a no-op. |
| Q3 | When the ground mast is deployed, what `name` values appear in `inputs[]`? | The contract enumerates only the three `pod_*` sensors, but `source_node` can be `MAST`. The app tolerates unknown names and humanises them, so nothing breaks — but we can write proper labels if we know them. |
| Q4 | `growth_stage.verification_status`: registry §1.3 says "strictly `WEB_VERIFIED`", the device sends `UNSOURCED`. Which is right? | The app accepts both. One of the two documents is stale and should be corrected before a judge reads them side by side. |
| Q5 | Are advisories ever pruned from the pod, or only media? | The app steps over a 404 and keeps going, so a gap is survivable. It changes what `advisory_count` means. |
| Q6 | Does `seq` survive a reflash? | D1. If you can guarantee it does, D1 becomes optional. I would still fix it. |
| Q7 | Does `GET /api/v1/advisory/latest` 404 or 204 on an empty database? | The app expects 404 and handles it. A 200 with an empty body would throw. |
| Q8 | `trap/upload` — is a raw `image/jpeg` body accepted, or is `multipart/form-data` required? | The contract says either. The app sends raw. Untested on the device either way (see §4). |

There is also one thing the contract does not cover at all, which needs an
endpoint rather than an answer — see **§4** below. It is the only item on this
page we cannot work around from the app side.

---

## 4. The one capability the contract does not cover — a request

**Needs a contract change, so it needs you.** Everything else on this page is
either ours to build or a yes/no question. This is the one thing we cannot
work around from the app side.

### The gap

The v1.0 gateway has exactly three write endpoints — `/ack`, `/trap/upload`
and `/sync/trigger`. None of them accepts configuration.

So **there is no way for the farmer, or for the app, to tell the pod anything
about the field being scanned.** Today that information reaches the pod by:

- `--total-cycle-days` — a command-line flag (registry §1.3)
- `configs/thermal_refs.json` — a file on the device
- the field boundary — device-side config (`FIELD_NOT_CONFIGURED` is one of
  your own documented reasons)

All three of which mean: somebody with a keyboard and a shell.

An "enter your planting date" screen built today would be a form with nowhere
to submit.

### Why it is worth an endpoint

Four things are currently dark **only** because of this. No sensor is involved
in any of them.

| Shows now | Because | Would become |
|---|---|---|
| Growth stage: empty | no planting date | the crop's stage, and how far through the season it is |
| "Variety · assumed" | no variety entered | "Variety · confirmed by you", and `cycle_verification_status: VERIFIED` |
| Irrigation using a default Kc | Kc depends on stage | a crop water figure that is actually about this crop |
| Satellite: unavailable | no field boundary | a field-level greenness reading |

It is also, bluntly, the first question a judge asks: *"how does the farmer
tell it what they planted?"* Right now the honest answer is "over SSH".

### What we are asking for

One endpoint. Smallest useful shape:

```http
POST /api/v1/field
Content-Type: application/json

{
  "field_id": "F01",
  "crop": "rice",
  "planting_date": "2026-07-14",
  "total_cycle_days": 145,
  "boundary": [[26.8501, 80.9460], [26.8509, 80.9460]]
}
```

- Everything except `field_id` optional — the app sends whatever the farmer
  has actually entered, and nothing it has guessed.
- **`planting_date` is the one that matters.** If only a single field can be
  supported before the deadline, make it that one; it alone unlocks the growth
  stage and fixes the irrigation figure.
- `total_cycle_days` present should give `cycle_source: "farmer_override"` and
  `cycle_verification_status: "VERIFIED"`, per registry §1.3.
- Response: `200` echoing the stored config, or `400` in the existing error
  envelope. No new error shapes needed.

A matching **`GET /api/v1/field/<id>`** would help more than it sounds: without
it the farmer has no way to tell whether their entry actually took, and the app
would be showing a value it merely hopes is in effect.

### What we will do with it

- A planting-date and variety screen, roughly half a day, the day the endpoint
  exists. The growth-stage card already invites the entry — it just has nowhere
  to send it.
- The app will display what the **pod** currently holds, not what the phone
  last typed, so the two can never silently disagree.

### What we will not do

Store the planting date only on the phone and compute the growth stage locally.

The app's core rule is that it never calculates an advisory — if a number is
not in what the pod sent, the app does not have it. Breaking that here would
also put the two devices into disagreement, because the pod uses planting date
for its own water calculation. A phone-local date would produce a stage on one
screen and a contradictory irrigation figure on the next.

### If the answer is no

Nothing breaks. The growth-stage card stays empty and already explains why, and
every other screen is unaffected. The cost is that the farmer cannot correct
anything the system assumes about their field, and the demo has to answer that
question with "you edit a config file on the device".

---

## 5. Known-untested on the device

Named by the hardware team, and repeated on the pod screen inside the app so
that if one of these fails live, the app has already said it might.

- **`POST /api/v1/trap/upload`** — implemented to the contract, never run
  against the Jetson. Also has **no UI**: `uploadTrapImage()` is wired and
  typechecked but nothing calls it, because picking a photo needs
  `expo-image-picker` and a dev build (B2). Roughly half a day once B2 is done.
- **`POST /api/v1/sync/trigger`** — implemented, never run against the Jetson.
  The AP/STA window it opens is simulated faithfully in
  `tools/fake-field-station.mjs`, including dropping every socket for 30 s, and
  the app explains the outage before it happens rather than after.
- **The radio itself.** Everything the hardware team verified was over Ethernet.
  Nothing in this repo has spoken to a pod over `SIH-FIELD`.

---

## 6. Already handled — no action needed

Listed so nobody spends time re-solving these. Each has a fixture and, where it
matters, a test.

| Condition | What the app does |
|---|---|
| Thermal CWSI unavailable (`pod_thermal: PENDING_CALIBRATION`) | Shows canopy temperature as the real measurement it is, shows the stress index as unavailable, and explains that the wet/dry reference pads are the missing piece — not the sensor. |
| NDVI gated, NoIR camera absent | Rendered as reserved, never estimated. The camera probe and the NDVI value are kept visually separate, because they are different things that share a name. |
| Satellite NDVI absent / cloudy / too few pixels | Each reason rendered distinctly. `reliability_note` on a small field becomes a plain-language warning that the pixels are bigger than the plot. |
| Irrigation block collapsed to two keys | Renders as an absence with its reason. The validator explicitly tolerates this — there is a test asserting the two-key form passes. |
| `gps: ABSENT`, null lat/lon | Findings still shown in full; the map is replaced by an explanation that the findings are real and only the positions are missing. |
| `cross_source_reliability` at any tier | Tier renders **before** confidence, with per-class held-out recall beside it. `TESTED_FAILED` gets a full-width warning, including on the history list. |
| Confidence presented as accuracy | Structurally prevented. Every confidence figure on the findings card sits under a standing caveat naming the 37.4% held-out macro-F1. |
| `threshold_confirmed: false` | Provisional thresholds render in a different tone with their own panel. The validator fires if a figure ships without its confirmation flag. |
| `RECALLED_UNVERIFIED` doses | Mandatory caution badge, rendered from the structural enum rather than from prose, and **not suppressible** — there is no prop for it. Same in Hindi. Tested. |
| `inference_backend: "mock"` → 403 | Counted and reported separately from failures, so the production guard working does not read as the app breaking. |
| `replay: true` | Banner on every screen showing that advisory. A *missing* `replay` key reads as `true`, so a dropped field under-claims rather than over-claims. |
| 503 at boot | Honoured with the pod's own `Retry-After`, one retry. |
| 30 s AP outage during mast sync | Explained before it happens; a sync attempted during it reports the outage rather than a dead pod. |
| Scan timing (5 s startup, ~1 scene/s, ~10 s for 30 frames) | No impact — the gateway serves stored advisories, and the 10 s HTTP timeout is against the gateway, not the pipeline. |
| Offline Hindi | All 21 templates, rendered from `template_id` + `params` with no network. Placeholder parity between languages is tested, so a dose cannot be dropped in translation. |

---

## 7. Pre-demo checklist

Ordered by what unblocks what.

**Now, needs nobody:**

- [ ] **B3** — run the app in Expo Go, walk all six fixtures, fix layout.
- [x] ~~**D1** — seq-reset recovery.~~ Done 21 Sept.
- [ ] Send **Q1–Q8** and the **§4 endpoint request** to the hardware team.

**Now, needs a laptop:**

- [ ] **B2** — produce a dev build and confirm it installs.
- [ ] Point the dev build at `npm run station` on the LAN and complete a real
      delta pull over a real socket. This proves everything except the radio.
- [ ] Run `npm run station -- --flaky --booting 20` and confirm the app recovers.

**When the adapter arrives:**

- [ ] **B1** — native binding module, or confirm the mobile-data-off workaround
      on the actual demo phone.
- [ ] First pull over `SIH-FIELD`.
- [ ] One genuine live walk, so at least one advisory carries `replay: false`.
- [ ] `trap/upload` and `sync/trigger` against the real device.

**Before anyone shows it to a judge:**

- [ ] Confirm **"Accept simulated advisories" is OFF** on the pod screen. It is
      off by default and warns loudly when on, but check it.
- [ ] Confirm the pod's clock source reads `gps`, not `filesystem`.
- [ ] Decide whether the LLM explanation tier is configured. It has never been
      called live from this machine — no key is set here. It is purely additive
      and the app is complete without it, so "off" is a legitimate answer.

---

## 8. Honest summary of effort remaining

| Item | Who | Rough effort |
|---|---|---|
| B3 — first render pass | app | half a day |
| ~~D1 — seq-reset recovery~~ | app | **done** |
| B2 — dev build | app | 2 h, mostly waiting |
| B1 — Android binding module | app | ~1 day |
| Trap upload UI | app | half a day |
| Q1–Q8 | hardware | one sitting with curl |
| §4 — a field-config endpoint | hardware | their call; unblocks 2 app screens |
| Planting-date / variety screen | app | half a day, **once §4 exists** |

The two half-day screens are both optional and neither blocks a demo. Without
the trap UI, trap counts still arrive through the mast. Without variety entry —
which cannot be built until §4 exists anyway — the growth stage stays on a
regional default, and the app already says so and invites correction.

**The critical path is B3 → B2 → B1**, and only the last of those has to wait
for hardware.
