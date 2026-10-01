# Reply — What the app needs from hardware and ML

**Project:** SIH 2026 · PS 26180 · Team TH10-HW
**Replying to:** `app_integration_requirements.md` (app team)
**From:** Hardware + ML side (Ahsan)
**Date:** 14 September 2026
**Deadline:** 20 September 2026 — **6 days**

---

## How to read this reply

Answers are by item ID, as requested. Each answer carries a status tag so you can
tell a fact from a decision from a guess. This matters more than usual on this
project, because the whole correction track that produced `core/` was about
removing numbers that were presented with more confidence than they had earned.
That discipline applies to this document too.

| Tag | Meaning |
|---|---|
| **CONFIRMED** | Read from code, from a run output, or from a decision already taken and recorded. Safe to build against. |
| **DECIDED** | A decision made in this reply. Binding once you acknowledge it. Not yet in code. |
| **PROPOSED** | Our recommendation. Needs your agreement before it becomes binding. |
| **PENDING** | We do not know yet. A named owner and a date is given for every one of these. |
| **CANNOT** | We cannot supply this before the deadline. Stated plainly so you can plan around it rather than wait. |

**Nothing in this document is a measurement unless it says CONFIRMED.** If a number
is not in here, it is because we do not have it, not because we forgot. Where we
have supplied a number that was fitted rather than measured in a field, the reply
says so.

---

# §0 · Read this before anything else — the architecture changed

**Status: CONFIRMED. Decision taken 12 September 2026.**

We know you are already aware the drone was dropped on 12 September and replaced by
a handheld pod. **But your document does not reflect it anywhere** — it describes a
drone throughout: "Drone lands. Motors disarmed.", `flight.survey_images`,
`flight.inspection_images`, the 2.4 GHz RC interference reasoning, "the phone never
connects to the drone in flight."

We understand the document was drafted with AI assistance that was working from the
older architecture. That is completely fine and it is exactly why this section
exists: **the stale architecture is now sitting in a written artefact that both
teams are building against**, and several of the items below inherit assumptions
from it. Four schema fields and at least two of your screens describe things that no
longer exist.

So §0 is not news — it is a correction to the document, so that the version of this
contract that survives is the right one. **Please update your source document and
re-brief whatever assistant you are drafting with**, or the same assumptions will
come back in the next revision.

### What the system physically is now

**Two devices, not three.**

**1. The Nano Pod — handheld.**
A Jetson Nano 4GB, two CSI cameras, an MLX90640 thermal array, a GPS receiver and a
battery pack, mounted on a rod. The farmer carries it and walks the field, scanning
manually. It is headless — it has no screen of its own.

**2. The Fixed Mast Node — unattended.**
An ESP32-based station left standing in the field. Sticky-trap camera, soil probes,
air temperature and humidity, light, rain, a single-point IR sensor, and a DS3231
real-time clock. It logs continuously and serves its stored data over its own WiFi
access point when something comes to collect it.

### What this changes for you

| Your assumption | Reality now | Item affected |
|---|---|---|
| Sync happens after the drone lands | Sync happens whenever the farmer chooses; the pod is in their hand the whole time | C3, E4 |
| Two-pass flight: survey then inspection | One continuous walk. There is no survey/inspection distinction any more | A1 (schema), B4 |
| `flight.survey_images` / `inspection_images` | These fields no longer describe anything real | §8 schema proposals |
| RC link interference designed around | Moot. No RC link exists | Appendix of your doc |
| Thermal/CWSI comes from the mast, hours stale | **CWSI now comes from the pod, measured during the scan, age ≈ minutes** | B10, and `inputs[]` |
| Autonomy is part of the pitch | It is not. SIH PS 26180 does not require autonomy, and we say so openly | — |

### One consequence worth stating loudly

**The phone app is now the only user interface the system has.** The pod is
headless. There is no screen on the mast. Everything the farmer ever sees comes
through your app. That raises the importance of your work rather than lowering it,
and it is the honest way to describe the app to a judge.

### The one thing we ask you not to do

Do not add a "drone" or "flight" label to any screen. A judge who sees the word
flight and then watches a person walk a field will ask why, and the answer is
"leftover from an older architecture" — which is a bad answer. Everything is a
**scan**, run by a **pod**.

---

# §1 · Your three priority items, answered first

### B12 · One real advisory JSON out of the actual pipeline — **CANNOT, and here is the honest reason**

You called this the highest-value item in your document. You are right, and we
cannot give it to you today.

**Nothing in the pipeline currently emits an advisory JSON.** Not a broken one, not
a partial one. An audit run against the whole repository on 13 September found the
following, quoting file paths, and we are repeating it here without softening it:

- No camera capture loop exists. `cv2.VideoCapture` is never called anywhere in the
  project.
- No live-frame tiling function. Tiling exists only inside offline training code.
- No GPS/NMEA parser. Not stubbed — entirely absent.
- No persistence layer. `edge/storage.py` does not exist. No SQLite anywhere.
- `gateway/__init__.py` is a 0-byte file. **There is no HTTP server, so there is
  currently no path by which a phone could see anything.**
- The TensorRT engine has not been built yet. The build script exists and has never
  been run, because the Jetson was only flashed on 13 September.

What *does* exist and is verified:

- The trained classifier, evaluated, calibrated, and exported to ONNX with a
  verified channel order (below, B1–B3).
- `core/aggregate.py`, `core/rejection.py`, `core/thermal.py`,
  `core/trap_segmentation.py`, `core/indices.py`, `core/ndvi.py` — all tested.
- 165 tests passing.

So the accurate description is: **we have a trained model and a set of tested
components, and no pipeline connecting them.** Individual modules are good. Nothing
calls anything else.

**What you will actually get, and when:**

| Deliverable | Owner | Target |
|---|---|---|
| A hand-assembled `advisory.json` with real model outputs, real class strings, real confidences, real `null`+reason blocks — built by running the exported model over stored test images and filling the schema by script | Ahsan + Antigravity | **16 Sep 2026** |
| The same file emitted by the real `edge/` pipeline on the Nano | Ahsan + Antigravity | **18 Sep 2026**, and this date has real risk on it |

Everything needed to build that file by hand now exists: the verbatim class list, the calibrated thresholds, and the verified ETL registry are all in §3 of this document. The 16 Sep file will not come from a camera and will have no GPS in it. It will have
genuine class labels, genuine calibrated confidences, genuine index values computed
by `core/indices.py`, and genuine `null` + reason blocks for everything gated. That
is enough to find the mismatches you want to find, and it is honest about what it
is. It will carry `"replay": true` (see A7).

**Please plan on the 16th, not on today.** If you need to keep moving before then,
use §2–§7 of this document: every field shape in it is settled enough to build
against.

---

### A1 · Freeze schema v1.0, and run your validator on the Jetson

**Two answers, because the second half of your request has a problem you may not be
aware of.**

**Freeze: PROPOSED — 16 September 2026, 23:59 IST.**

Not today, because §8 of this document proposes six schema changes that come
directly out of the architecture change in §0 and out of the gaps in your own
questions (B3 has no field to live in; the GPS point data has nowhere to go;
`media_ids` does not exist; `template_id` is needed for E3 to be possible offline).
Freezing today would freeze a schema that cannot express what the system now
produces.

Freeze on the 16th, after you have replied to §8. From that date, any change to
§7.3 requires both sides to agree in writing, and we will treat that as binding on
our side.

**Ahsan to ratify this date. It is not final until he does.**

**Vendoring `validate.ts` to the Jetson: CANNOT, as written. Here is what we
propose instead.**

`mobile/src/schema/advisory.ts` and `validate.ts` are TypeScript. **The Jetson runs
Python 3.6 on Ubuntu 18.04 (JetPack 4.6.4, L4T 32.7).** The entire `edge/` tree is
constrained to Python 3.6 — no f-string `=`, no walrus, no `dataclasses`. Putting a
Node.js runtime on the Nano and shelling out to it on every SQLite write is
possible, but it adds a second runtime, ~50 MB, and a process spawn per advisory, on
a board where we are already fighting for the 4 GB alongside TensorRT.

Your underlying goal — *the two sides cannot drift because they are literally the
same file* — is exactly right, and we want it. Here is how to get it:

**PROPOSED: a shared `advisory.schema.v1.json` (JSON Schema draft-07) as the single
source of truth, plus a shared fixture corpus.**

1. You generate `advisory.schema.v1.json` from your existing TypeScript types, or we
   write it together. It lives in one place both repos vendor from.
2. Your `validate.ts` keeps doing what it does, but is driven by that schema for
   structural validation.
3. On the Jetson we run `jsonschema==3.2.0` — pure Python, works on 3.6, no
   compilation — against the same file, before every SQLite commit. A malformed
   advisory never reaches storage, which is the outcome you asked for.
4. Your **four semantic rules** are not expressible in JSON Schema and will be
   hand-ported to roughly 40 lines of Python. They are:
   - absence is `null` + a machine-readable reason,
   - every threshold carries `threshold_source` and `threshold_confirmed`,
   - `inputs[]` is mandatory and complete,
   - `source` on every numeric field.
5. **The anti-drift mechanism is a shared fixture corpus, not shared code.** Your
   five fixtures plus every real advisory we produce go into one directory. Both
   validators run against all of them in CI on both sides. If a rule is ported
   wrong, a fixture fails on one side and passes on the other, and we see it
   immediately.

This gives you the guarantee you actually wanted, and does not require Node on the
Nano.

**If you would rather we port `validate.ts` to Python line-by-line instead of going
via JSON Schema, say so and we will. Either is fine. What we cannot do is run the
TypeScript itself.**

---

### E1 · The Android network-binding module

**Acknowledged. Nothing needed from us, and you are right about the failure mode.**

`ConnectivityManager.requestNetwork()` with `TRANSPORT_WIFI` and *without*
`NET_CAPABILITY_INTERNET`, then binding the socket or process to the returned
`Network`, is the correct fix. This was flagged in `data_flow_architecture.md` §14.1
for exactly the reason you give: the symptom is indistinguishable from a dead
server, and it will cost a day if it is hit cold during demo week.

Two things we can do from our side to reduce the blast radius, both **DECIDED**:

1. **The DHCP server will not advertise a default route or a DNS server.** See C4.
   This does not fix the Android routing behaviour, but it removes one way the
   phone can decide to route local traffic somewhere unhelpful.
2. **A file-drop fallback path.** If the binding module is not ready by demo day, we
   will make the Jetson also write every advisory as a plain `.json` file to a
   directory, and you can ingest via `adb push` / manual file import / a share
   intent. It is not the demo we want, but it means "the app renders a real
   advisory" is never blocked on a Kotlin module. Tell us if you want the import
   path built on your side; it is a few hours of work and it is real insurance.

**We cannot supply an Android phone from the hardware side — see C7.**

---

# §2 · Group A — the wire contract

**Blanket statement covering A2 through A9, and it is good news for you:**

**The Jetson side of this API does not exist yet.** Not partially — the gateway file
is 0 bytes. That means there is nothing on our side to negotiate against, and the
correct engineering move is the one you were hoping for: **your client is built, so
the server conforms to the client.** Where you have proposed a shape, we adopt it
verbatim. Where we push back below, it is on a point of correctness, not preference,
and we say why.

---

### A2 · The exact manifest response body — **DECIDED: your shape, with two additions**

We will emit exactly what you wrote, plus two fields:

```jsonc
GET /api/v1/manifest?since=<cursor>

{
  "schema_version": "1.0",
  "advisories": [
    {
      "advisory_id": "2026-09-16T14:32:11Z_F01",
      "seq": 42,
      "generated_at_utc": "2026-09-16T14:32:11Z",
      "bytes": 4213,
      "replay": false
    }
  ],
  "truncated": false
}
```

- `advisory_id`, `generated_at_utc`, `bytes` — unchanged from your proposal.
- `seq` — a monotonic integer. See A3; this is the fix for your ordering concern.
- `replay` — surfaced at manifest level so the app can label an entry before it
  fetches it. See A7.
- `schema_version` at the envelope level so a future v1.1 manifest is detectable
  without parsing entries.
- `truncated` — see A4.

**Content-Type will be `application/json; charset=utf-8` on every endpoint.**

---

### A3 · Cursor semantics — **DECIDED: exclusive, ascending, and ordered by `seq`, not by id**

**Direct answers to your three questions:**

- **Exclusive.** `?since=X` returns everything strictly after X.
- **Ascending — oldest first.**
- **Nothing orders two advisories by `generated_at_utc`, and that is why we are
  adding `seq`.**

**Your instinct here was correct and it is the most important catch in Group A.**
`advisory_id` is a timestamp plus a field id. It does not order safely, for exactly
the three reasons you listed, and one more that is specific to our hardware:

**The Jetson Nano has no battery-backed real-time clock.** There is no RTC on the
board and we are not adding one to the pod — it gets its time from the GPS receiver.
Before a GPS fix, the Nano's clock is whatever the filesystem last recorded, which
can be days out. **A backwards clock jump on this hardware is not a hypothetical, it
is the expected behaviour on every cold boot until the GPS locks (roughly 26–30
seconds from cold start in open sky).**

So: **`seq` is the SQLite `rowid` of the advisories table.** Monotonic, assigned at
commit, never reused, never re-ordered, and completely independent of the clock.

**The cursor is `seq`.** `GET /api/v1/manifest?since=42` returns `seq` 43 onward.

**Compatibility:** the server will accept either an integer (`seq`) or an
`advisory_id` string in `?since=`, and resolve a string to its `seq` internally, so
your existing client code does not have to change on day one. But **please migrate
to `seq` before the freeze** — the string form is a courtesy and it inherits every
ordering problem you identified.

`?since=0` or an omitted `since` returns everything from the beginning.

---

### A4 · Is the manifest ever truncated? — **DECIDED: bounded, with the flag, because it is free**

Honest sizing first. An advisory is roughly 3–6 KB of JSON. A scan produces one.
Realistic worst case before a phone ever appears is a few dozen. So the true answer
is "unbounded, it's tiny."

**But we are implementing `limit` and `truncated` anyway**, because the node-side
API (§5.4) already has them, one sync algorithm written once and used at both hops
is the whole point of the design, and the cost is about ten lines.

- `?limit=<n>`, default **200**, maximum **500**.
- `"truncated": true` when more records exist past the returned page.
- Loop on `truncated` using the last `seq` you received.

---

### A5 · Error codes — **DECIDED**

| Case | Status | Body | Retry safe? |
|---|---|---|---|
| Advisory id does not exist | `404` | `{"error":"not_found","advisory_id":"..."}` | **No.** It will not appear later. |
| AP is up, database not ready | `503` + `Retry-After: 5` | `{"error":"not_ready"}` | **Yes.** Back off and retry. |
| Advisory still being generated | **Does not occur — see below** | — | — |
| Media pruned from SD | `410` | `{"error":"gone","reason":"retention_pruned"}` | **No.** See D2. |
| Malformed request (bad `since`, bad `limit`) | `400` | `{"error":"bad_request","detail":"..."}` | No. |
| Anything else | `500` | `{"error":"internal"}` | Yes, once. |

**On "still being generated" — we are designing the case out rather than reporting
it.** The advisory is written to SQLite in a **single transaction after it is
complete.** An advisory is either fully committed and visible in the manifest, or it
does not exist. There is no half-generated state a client can observe. This is the
same guarantee that makes your delta pull idempotent, so it is worth having anyway.

**The `503` case is real and you should expect it.** The AP comes up as a systemd
unit at boot; the API server needs the database open. There is a window of a few
seconds where a fast phone can connect and get nothing. `503` + `Retry-After: 5` is
the correct answer there, and your retry will succeed.

---

### A6 · Is `/ack` required, or a courtesy? — **CONFIRMED: courtesy. Nothing is gated on it.**

Confirming all three things you asked:

- **The Jetson keeps serving records it has already acked.** Forever, or until the
  SD card is reimaged. A re-ack, a missing ack, or an ack for an id that does not
  exist are all harmless.
- **The Jetson never deletes an advisory on ack.** Advisory JSON is never pruned at
  all — see D2, where only *media* is subject to retention.
- **`/ack` advances one thing only:** a server-side "last known phone cursor" used
  to compute `advisory_count` on `/health`, so the farmer's connection screen can
  say how many are waiting. If the ack is lost, that count is stale and nothing else
  is affected.

Your design — keep your own cursor, filter the manifest against what you already
hold, treat a failed ack as harmless — is correct and we are building to preserve
it.

---

### A7 · How a seeded replay is labelled — **DECIDED: `"replay": true`, top-level, mandatory, and defaulting to the safe value**

You are right to make this a BLOCKER. We agree with the framing completely: an
invented history rendered as a live measurement in front of judges is failure
pattern #1 landing in the demo itself, which is the one place none of our code
guards can catch it.

**The field is `"replay"`, a boolean, top level on the advisory object, and it is
mandatory.** It is also surfaced in the manifest entry (A2) so you can label before
fetching.

Three commitments on it:

1. **It is required by the schema.** Absent `replay` fails validation on the Jetson
   before the SQLite write. There is no path where it is silently missing.
2. **The default in code is `true`, not `false`.** Any advisory that reaches the
   writer without an explicit provenance stamp is marked as replay. This is
   deliberate: the failure we care about is a seeded record labelled live, not a
   live record labelled seeded. Defaulting to `true` means a bug produces the safe
   error.
3. **On your side, please treat a missing `replay` key as `true` as well**, not as
   `false`, for the same reason. If we ship a bug, we would both rather the demo
   under-claim.

**A fourth commitment, which is the one that actually matters:** the 16 Sep advisory
described in B12 will carry `"replay": true`, because it is assembled from stored
images rather than captured live. So you will exercise this path before demo day
rather than on it.

---

### A8 · Adding a field later — **DECIDED: your proposal, adopted verbatim**

- Additive changes stay at `"1.0"`. You ignore unknown keys. We will not remove or
  retype a field under `"1.0"`.
- Anything breaking — a removal, a type change, a semantic change to an existing
  field — bumps to `"1.1"`, and the Jetson serves both for a week.
- Serving both means: `GET /api/v1/advisory/<id>` returns 1.1 by default and accepts
  `?schema_version=1.0` to get the old shape.

One note: **§8 of this document is not covered by this rule.** Those are changes
being proposed *before* the freeze, precisely so that they do not have to happen
after it.

---

### A9 · The `/health` field list — **DECIDED: your four fields, plus four**

```jsonc
GET /api/v1/health

{
  "device": "sih-pod-01",
  "advisory_count": 3,
  "storage_free_kb": 48213904,
  "gps_time_valid": true,
  "schema_version": "1.0",
  "latest_seq": 42,
  "server_time_utc": "2026-09-18T09:14:02Z",
  "clock_source": "gps" | "ntp" | "filesystem"
}
```

Your four are confirmed as named and typed above. The additions:

- `latest_seq` — lets the connection screen show "3 waiting" without a manifest
  call.
- `server_time_utc` — so the phone can detect and display clock skew rather than
  silently doing wrong age arithmetic. Relevant given the no-RTC problem in A3.
- `clock_source` — `"filesystem"` is the state where the Nano has booted but GPS has
  not locked, and it is the state where every timestamp we emit is untrustworthy.
  This is the machine-readable version of A12.

`advisory_count` means "committed advisories the phone has not acked", not the total
on disk. Say so on the screen if you show it.

**`/health` returns `200` even when `gps_time_valid` is `false`.** It is a liveness
endpoint. Degraded is not down.

---

### A10 · Media, and the schema gap under it — **PROPOSED: reserve the keys now, build the endpoint only if the schedule allows**

**Your diagnosis is correct and it is the sharpest observation in Group A.** Nothing
in §7.3 references a media id. The endpoint could be live and the app would still
have no way to know which image belongs to which finding. That is a schema problem,
not an endpoint problem, and it has to be settled before the freeze.

**Our recommendation, in two parts:**

**Part 1 — reserve the keys now. Cost to us: nothing.**

```jsonc
"disease": [
  {"class": "...", "confidence": 0.83, "media_ids": [], "source": "measured"}
],
"pest": [
  {"taxon": "...", "count_per_trap_per_day": 42, "media_ids": [], "source": "measured"}
]
```

`media_ids` is **always present and always an array**, empty when there is no media.
Never `null`, never absent. That way your renderer has one code path, and the day
media lands it is a data change and not a schema change.

**Part 2 — the endpoint is OUT of the demo critical path.**

With six days left and no storage layer written at all, building image capture,
retention, an id scheme, thumbnailing and a serving endpoint is not a responsible
use of the remaining time compared to getting `frame → prediction → SQLite → HTTP →
phone` working at all. **We would rather ship a demo with no images than a demo
where the sync is flaky.**

If it does land, these are the values you can build against — treat them as
**PROPOSED**, and as not happening unless we confirm by 18 Sep:

| Property | Value |
|---|---|
| Format | JPEG, quality 85 |
| `full` | 640 × 640, the inspection crop as fed to the model, before normalisation |
| `thumb` | 160 × 160 |
| Bytes per image | ~40–70 KB full, ~6–10 KB thumb |
| Images per advisory | 0–6 |
| Rough bytes per advisory with media | 250–450 KB |
| Id format | `<advisory_seq>-<kind>-<n>`, e.g. `42-crop-3` |
| Endpoint | `GET /api/v1/media/<id>?size=thumb|full` → `image/jpeg` |

Note that with media on, an advisory goes from ~4 KB to ~400 KB — a hundredfold
increase over a link that is 2.4 GHz WiFi at field range. Worth designing your
progress UI for, if it lands.

---

### A11 · Every timestamp is UTC with a trailing Z — **CONFIRMED, and we will enforce it**

ISO-8601, UTC, `Z` suffix, second resolution, everywhere, on every endpoint and
every field. No offsets. No epoch seconds. No local time. Format string:
`%Y-%m-%dT%H:%M:%SZ`.

This is enforced by regex in the Jetson-side validator before the SQLite write, so
it cannot drift through a code change on our side.

**One thing to be aware of that is specific to our hardware:** the mast node runs a
DS3231 RTC with a CR2032 backup, and its `rtc_utc` is genuinely UTC. The Jetson has
no RTC and takes UTC from GPS. Neither device ever handles local time anywhere in
the system. The only place IST should exist is in your presentation layer.

---

### A12 · What gets emitted when GPS time is invalid — **DECIDED**

**The advisory is still emitted.** Suppressing it would mean the system goes silent
in exactly the degraded state where the farmer most needs to know something is
wrong, and it would violate our own principle that the system should report its own
degradation.

**What changes when `gps_time_valid` is `false`:**

| Field | Behaviour |
|---|---|
| `generated_by.gps_time_valid` | `false` |
| `generated_at_utc` | Still emitted, using the best clock available. **Do not trust it.** `/health.clock_source` tells you where it came from. |
| `inputs[].latest_sample_utc` | Emitted unchanged — this comes from the mast's DS3231, which is trustworthy independently of the Jetson's clock. |
| `inputs[].age_hours` | **`null`**, with `"age_reason": "CLOCK_UNTRUSTED"` |
| `inputs[].rtc_valid` | Still reports the *node's* RTC validity, which is a separate question |
| `water.cwsi` | **`null`**, with `"cwsi_status": "CLOCK_UNTRUSTED"` — see B10; CWSI is diurnal and a wrong timestamp voids the reading outright |

**Why `age_hours` goes null rather than being computed:** `age_hours` is the
difference between the Jetson's clock and the node's RTC. If the Jetson's clock is
untrusted, that difference is not a measurement of anything. Emitting a plausible
number there would be failure pattern #1 in its purest form. `null` + reason is the
correct answer and it is what your rule 1 exists for.

**Please render this state prominently.** "Device clock not yet synchronised — data
ages unavailable" is a much better thing for a judge to see than an age that quietly
happens to be wrong.

---

# §3 · Group B — model outputs and what they mean

### B1 · The exact class label strings — **CONFIRMED. Full verbatim list below.**

**29 classes.** Defined in one place only: `configs/classes.py:4-20`. `NUM_CLASSES` resolves dynamically from `len(CLASS_NAMES)` at line 22 — it is not a literal, so it cannot drift from the list.

**The separator is a double underscore.** `not_crop` has no crop prefix.

| idx | class string | crop | category | plain English |
|---|---|---|---|---|
| 0 | `rice__normal` | Rice | **Healthy** | Healthy rice |
| 1 | `rice__bacterial_leaf_blight` | Rice | Disease | Bacterial leaf blight |
| 2 | `rice__bacterial_leaf_streak` | Rice | Disease | Bacterial leaf streak |
| 3 | `rice__bacterial_panicle_blight` | Rice | Disease | Bacterial panicle blight |
| 4 | `rice__blast` | Rice | Disease | Rice blast |
| 5 | `rice__brown_spot` | Rice | Disease | Brown spot |
| 6 | `rice__downy_mildew` | Rice | Disease | Downy mildew |
| 7 | `rice__tungro` | Rice | Disease | Tungro virus |
| 8 | `rice__hispa` | Rice | Disease (pest damage) | Rice hispa damage |
| 9 | `rice__leaf_roller` | Rice | Disease (pest damage) | Leaf roller damage |
| 10 | `rice__yellow_stem_borer` | Rice | Disease (pest damage) | Yellow stem borer damage |
| 11 | `sugarcane__healthy` | Sugarcane | **Healthy** | Healthy sugarcane |
| 12 | `sugarcane__dried_leaf` | Sugarcane | **Healthy** ⚠ | Dried leaf — **see warning below** |
| 13 | `sugarcane__mosaic` | Sugarcane | Disease | Mosaic virus |
| 14 | `sugarcane__red_rot` | Sugarcane | Disease | Red rot |
| 15 | `sugarcane__rust` | Sugarcane | Disease | Rust |
| 16 | `sugarcane__yellow_leaf` | Sugarcane | Disease | Yellow leaf disease |
| 17 | `sugarcane__smut` | Sugarcane | Disease | Smut |
| 18 | `sugarcane__pokkah_boeng` | Sugarcane | Disease | Pokkah boeng |
| 19 | `sugarcane__grassy_shoot` | Sugarcane | Disease | Grassy shoot |
| 20 | `sugarcane__brown_spot` | Sugarcane | Disease | Brown spot |
| 21 | `sugarcane__banded_chlorosis` | Sugarcane | Disease | Banded chlorosis |
| 22 | `sugarcane__sett_rot` | Sugarcane | Disease | Sett rot |
| 23 | `wheat__healthy` | Wheat | **Healthy** | Healthy wheat |
| 24 | `wheat__yellow_rust` | Wheat | Disease | Yellow (stripe) rust |
| 25 | `wheat__brown_rust` | Wheat | Disease | Brown (leaf) rust |
| 26 | `wheat__septoria` | Wheat | Disease | Septoria leaf blotch |
| 27 | `wheat__powdery_mildew` | Wheat | Disease | Powdery mildew |
| 28 | `not_crop` | — | **Reject** | Not a crop |

**Column groups, as the code computes them:**

- `HEALTHY_COLS` = `[0, 11, 12, 23]`
- `NOTCROP_COL` = `28`
- `CROP_COLS` = `0`–`27` (28 entries) — **`not_crop` is excluded, which is what makes the energy OOD score meaningful**
- `DISEASE_COLS` = `[1..10, 13..22, 24..27]` (24 entries)

---

**⚠ Warning on index 12, `sugarcane__dried_leaf` — please do not render this as "healthy".**

The code groups it in `HEALTHY_COLS`. That grouping is correct *for the model* — "dried leaf" is not a disease, so it does not belong in `DISEASE_COLS`. But **"your sugarcane is healthy" is the wrong sentence to show a farmer when the model has detected dried leaves**, which can indicate water stress, senescence, or nutrient deficiency.

**PROPOSED handling:** render index 12 as a **third state**, distinct from both healthy and diseased — something like *"Dried leaf detected — not a disease. Check irrigation and crop stage."* We will surface it as `crop_health.state: "HEALTHY"` with `crop_health.class: "sugarcane__dried_leaf"`, so you can key off the class rather than the state.

This is a genuine semantic mismatch between how the model groups classes and what a farmer should be told, and we would rather name it than let it reach a screen.

---

**Two documents in the repo state the wrong class count. Ignore them.**

`BUILD_CHECKLIST_1.md:150-152` and `AI_Handbook_4.md` (multiple lines) both assert **31 classes** with `len(CROP_COLS)==30`. The origin: the legacy taxonomy had 13 rice classes including `rice__black_stem_borer` and `rice__white_stem_borer`, giving 13+12+5+1 = 31. **Those two classes were dropped when the data behind them turned out to be paywalled**, and the taxonomy has been 29 since. The documents were never updated.

**The code is authoritative. If a document disagrees with `configs/classes.py`, the code wins.**

**On Hindi names — still `CANNOT`, and we are not going to fake it.** We can give you crop and plain-English names, above. Authoritative Hindi disease nomenclature varies regionally, and a confidently wrong Hindi name in front of an agriculture judge is worse than an English one. Please get these checked by someone with an agriculture background. If nobody is available, ship English for the disease names and Hindi for everything else, and say so.

---

### B2 · What `confidence` actually is — **CONFIRMED, with three corrections to what we told you and one defect we found**

**Correction 1 — the threshold values. These differ from the plan defaults.** Read verbatim from `configs/train_config.py:26-32`:

| Constant | **Actual value** | What we said earlier |
|---|---|---|
| `TAU_DISEASE` | **0.4** | ~~0.55~~ |
| `TAU_MARGIN` | **0.15** | ~~0.10~~ |
| `TAU_CONF` | 0.60 | 0.60 ✓ |
| `TAU_ENERGY` | −2.8529 | ✓ |
| `T_CAL` | 0.597 | ✓ |
| `TAU_PRIOR` | **0.0** | ~~1.0~~ |
| `CELL_K, CELL_N, CELL_MIN_SCORE` | 2, 3, 0.55 | ✓ |

**Correction 2 — prior adjustment is OFF.** `TAU_PRIOR = 0.0` was swept in Step 15 and **0.0 won on validation macro-F1**, because the model was already trained with sqrt-inverse-frequency class weighting in the loss. Applying post-hoc prior adjustment on top of that would double-correct the same imbalance.

So the confidence chain is simpler than we described. It is:

1. Raw logits from the engine
2. Divide by `T_CAL = 0.597`
3. Softmax
4. `confidence` = the maximum

**No prior adjustment.** Please strike that from any notes you took.

**Correction 3 — `T_CAL < 1.0` is correct, not a bug.** We flagged it for verification and it has been verified. The model trains with `LABEL_SMOOTH = 0.1`, weight decay 0.05, dropout 0.2, drop-path 0.1 and EMA 0.9995 — a stack of regularisers that contract logit magnitudes and leave the model **underconfident**, not overconfident. A `T` below 1 sharpens the distribution to correct for that, which is the right direction. The empirical check: L-BFGS reduced validation NLL from **0.2941 to 0.1615**, a 45% improvement. A wrong temperature would have raised it.

**So: the confidence is genuinely calibrated, and calibrated in the correct direction.**

---

**🔴 A defect we found while checking this, which nobody had caught.**

`core/aggregate.py:22-24` declares its own defaults:

```python
def aggregate_frame(tile_probs, healthy_cols, notcrop_col,
                    tau_disease=0.55, tau_margin=0.10, min_tiles=2,
                    tau_healthy=0.50, notcrop_frac=0.50):
```

**`tau_disease=0.55` and `tau_margin=0.10` — but the calibrated config values are 0.4 and 0.15.** The function signature disagrees with the fitted constants.

**Any caller that does not explicitly pass the config values silently uses the uncalibrated defaults**, and with a *higher* disease threshold and a *lower* margin requirement, the detection behaviour changes in both directions at once. Nothing would crash. Nothing would look wrong.

**This is standing failure pattern #3 — a guard implemented correctly at the leaf function but defaulted wrongly upstream** — and it is the fourth time it has appeared on this project. It has not bitten yet only because the pipeline that calls `aggregate_frame` does not exist yet. **It will bite the moment it is written**, which is this week.

It is now a named fix on our build list: the caller must pass `TAU_DISEASE` and `TAU_MARGIN` from `configs/train_config.py` explicitly, and a test must assert that the defaults are never used in the runtime path.

**We are telling you because the numbers in your fixtures should reflect the calibrated values (0.4 / 0.15), not the function defaults.**

---

**Cut-offs — what reaches you and what does not:**

| Condition | Behaviour |
|---|---|
| Mean `not_crop` probability across tiles **> 0.50** (`notcrop_frac`) | Frame is `NOT_CROP`. No finding emitted. |
| Energy over `CROP_COLS` below `TAU_ENERGY = -2.8529` | Out of distribution. No finding emitted. |
| No tile has disease prob ≥ **0.4** AND beating best-healthy on the same tile by ≥ **0.15** | Not a disease finding |
| Mean best-healthy across tiles ≥ **0.50** (`tau_healthy`) | Frame is `HEALTHY` |
| Neither | Frame is `UNCERTAIN`. No finding emitted. |

**Nothing below threshold reaches you flagged-low. It does not reach you at all.** The counts of what was rejected, and why, come through the `crop_health` block in B3 — which is how a judge can be shown that the system rejected things rather than guessing.

**Our UI recommendation stands and B3a is the reason: render this as "model confidence", never as a percentage chance of being correct.**

---

### B3 · "Healthy" and "this isn't a leaf" — **CONFIRMED on the mechanism, PROPOSED on the field**

**Two separate mechanisms, both real. This is one of the stronger parts of the project.**

**1. Healthy is a class, not an empty array.** Four healthy classes — `rice__normal`, `sugarcane__healthy`, `sugarcane__dried_leaf`, `wheat__healthy` (indices 0, 11, 12, 23). A healthy verdict is a positive, confident prediction, which is a stronger claim than "we found no disease."

**Do not treat an empty `disease[]` as healthy.** Empty can also mean everything was rejected as out-of-distribution, or as not-crop, or nothing was scanned. Four different things to tell a farmer.

**2. Two independent out-of-domain reject paths.**

- **`not_crop` is a trained 29th class**, with ~1,436 real images behind it — soil, walls, pavement, hands, feet and shoes, non-crop greenery, most shot in the field by us for this purpose. A frame is rejected as `NOT_CROP` when the **mean** `not_crop` probability across tiles exceeds **0.50**. Note it is a mean, not a max: one confusing tile cannot reject a good frame.
- **Energy-based open-set rejection** (`core/rejection.py`). Energy is computed over `CROP_COLS` — indices 0–27 — **deliberately excluding the `not_crop` logit at index 28**. Including it would let the network's own "I don't know" channel inflate the score. `TAU_ENERGY = -2.8529` was fitted at 95% TPR on 5,255 **category-disjoint** images the model never saw.

  **Stated limitation:** that open-set is predominantly *near*-OOD — 3,955 of 5,255 are plant-disease-like, 1,300 are weeds. A threshold fitted on near-OOD may behave differently on far-OOD input like machinery or masonry. Documented as an intentional constraint in `DATASET_PROVENANCE.md` §5, not an oversight.

**3. `core/aggregate.py` returns four explicit states**, which is the field you asked for:

`aggregate_frame()` → `DISEASE | HEALTHY | NOT_CROP | UNCERTAIN`
`aggregate_cell()` → `DISEASE | HEALTHY | UNCERTAIN | NO_DATA`

`NO_DATA` exists specifically so "healthy" and "never looked at" can never render the same colour. That decision was made for your map.

**PROPOSED schema addition — §7.3 has no field to carry any of this:**

```jsonc
"crop_health": {
  "state": "HEALTHY",
  "class": "wheat__healthy",
  "reason": null,
  "crop": "wheat",
  "frames_evaluated": 28,
  "frames_agreeing": 24,
  "frames_rejected_ood": 4,
  "frames_rejected_not_crop": 2,
  "frames_uncertain": 2,
  "source": "measured"
}
```

`state` ∈ `HEALTHY | DISEASE | NOT_CROP | UNCERTAIN | NO_DATA`. `class` is included so you can special-case `sugarcane__dried_leaf` per the warning in B1.

---

### B3a · The number you should know before you design any confidence UI — **CONFIRMED, and it is not flattering**

Volunteered, because it changes how findings should be presented and because you would find out on demo day otherwise.

**Step 14 evaluation of the V3 model:**

| Split | Macro-F1 |
|---|---|
| `test_indist` — held-out images from sources the model trained on | **94.85%** |
| `test_sourceheldout` — images from sources the model has **never** seen | **37.40%** |

Per-class source-held-out recall for three rice classes:

| Class | Source-held-out recall |
|---|---|
| `rice__bacterial_leaf_blight` | **0.00%** |
| `rice__blast` | **3.92%** |
| `rice__brown_spot` | **2.26%** |

**What this is:** residual source-identity shortcut learning. Classes with few independent capture sources learn the camera and compression signature of the source rather than the lesion morphology. Diagnosed in V1, partially mitigated in V3 with five anti-shortcut augmentations and a broader source mix, and **not fixable in six days.**

**What it means for you:**

1. **Both numbers go on the slide.** The honest number is the second one, and presenting it deliberately beats being caught by a judge who asks the right question.
2. **In-field confidence will often be high and wrong.** This is the main argument for "model confidence" rather than a probability.
3. **It is a strong argument for `frames_agreeing` being visible.** "22 of 28 frames agreed" is information a farmer and a judge can both use. A lone confidence number is not.

---

### B4 · How `n_inspection_crops` aggregates — **CORRECTED. It is not top-k; it is MIL max-pooling.**

**First, a naming correction from §0:** there is no inspection pass any more. One handheld scan. `n_inspection_crops` should become `n_frames_evaluated`, or you keep the key and we redefine it — your call, see §8.

**We described this as a "top-k rule" earlier. That was wrong.** The verbatim code (`core/aggregate.py:22-64`) shows something better and easier to explain:

**Tile → frame, in one sentence:** each tile votes independently by comparing its **best disease probability against its best healthy probability on the same tile**, and if *any single tile* clears both the absolute floor (0.4) and the margin over healthy (0.15), **that one tile carries the whole frame to `DISEASE`.**

The code:

```python
d_best = p[:, disease_cols].max(axis=1)          # best disease prob per tile
h_best = p[:, healthy_cols].max(axis=1)          # best healthy prob per tile
votes = (d_best >= tau_disease) & ((d_best - h_best) >= tau_margin)
if votes.any():                                   # MIL max-pool
    i = int(np.argmax(np.where(votes, d_best, -np.inf)))
    return 'DISEASE', int(d_arg[i]), float(d_best[i])
```

**This is multiple-instance learning max-pooling, and it is the correct choice for this problem.** A lesion may occupy one tile out of nine. Averaging confidences across tiles — the obvious approach — would dilute a real single-tile detection into nothing on an otherwise healthy leaf. **That is the exact failure this design exists to prevent**, and it is worth saying to a judge in those words.

The like-for-like comparison matters too: disease is compared against healthy **on the same tile**, not against a frame-wide average. A tile cannot be called diseased just because a different part of the image looked unhealthy.

**Order of evaluation:** `NOT_CROP` (mean > 0.50) → tile votes → `DISEASE` if any vote → `HEALTHY` if mean best-healthy ≥ 0.50 → otherwise `UNCERTAIN`. Fewer than `min_tiles = 2` valid tiles returns `UNCERTAIN` rather than guessing.

**Frame → scan:** `aggregate_cell` applies a **k-of-n rule** — `CELL_K = 2` of `CELL_N = 3` frames must agree at a score of at least `CELL_MIN_SCORE = 0.55`.

**So `n_agreeing` exists at two levels, and both are free:**

| Field | Meaning |
|---|---|
| `n_tiles_agreeing` / `n_tiles_evaluated` | Tiles that voted disease, out of 9 |
| `n_agreeing` / `n_frames_evaluated` | Frames that agreed, out of frames scanned |

```jsonc
"disease": [
  {"class": "rice__blast", "confidence": 0.83,
   "n_frames_evaluated": 28, "n_agreeing": 22,
   "n_tiles_agreeing": 4, "n_tiles_evaluated": 9,
   "media_ids": [], "source": "measured"}
]
```

**Please show "22 of 28 frames agreed."** It is far stronger than a lone number, exactly as you said, and it is the honest representation of how the decision was actually made.

---

### B5 · Can two diseases appear at once? — **DECIDED**

**`aggregate_frame` returns exactly one class per frame** — the highest-scoring qualifying tile. So `disease[]` is built across the scan, not within a frame.

- **Everything above threshold, deduplicated by class.** Not top-k, not always exactly one.
- **Practical maximum: 3.** We cap it in the emitter. A single scan of a single field producing more than two or three distinct confident disease classes almost certainly means the model is confused rather than the field being multiply infected — and a list of five diseases is not advice. Given the source-held-out numbers in B3a, this cap is a safety measure as much as a layout one.
- **Ordering: descending `n_agreeing` first, then descending `confidence`.** Rank by how much evidence there was, not by how confident the model happened to be on one frame. **Index 0 is the primary finding.**
- If more than 3 classes pass, the overflow is dropped and `crop_health.reason` is set to `MULTIPLE_CLASSES_TRUNCATED`, so it is never silent.

Layout: design for 1 as common, 2 as occasional, 3 as rare.
### B6 · Interpretation bands for VARI, ExG, TGI, DGCI — **This is the hardest honest answer in the document. Please read all of it.**

You called this the largest content gap on the list. It is, and the reason is not
that we have not got round to it.

**There are no published, crop-specific, absolute band boundaries for these four
indices that we can honestly cite.** Not for wheat, not for rice, not for sugarcane.
We looked. Giving you `VARI > 0.4 = healthy` with a plausible-sounding citation
attached would be citation drift — reattributing our own engineering judgement to a
source — which is a documented standing failure pattern on this project and one we
have caught in our own toolchain four separate times.

**Why absolute bands do not exist for these indices, specifically:**

These are **uncalibrated RGB ratio indices computed from an ordinary camera**. Their
absolute value depends on the illumination spectrum at the moment of capture, the
camera's white balance and gain, the sensor's colour filter response, the sun angle,
and how much soil is in the frame. The same healthy wheat canopy photographed at
09:00 and at 14:00 on the same day yields materially different VARI. **There is no
number we can give you that means "healthy" independent of those conditions.**

What the literature does establish is what each index *correlates with*, which is a
weaker but real claim:

| Index | Method origin | What it tracks | Absolute bands available? |
|---|---|---|---|
| **ExG** (Excess Green) | Woebbecke et al., 1995 | Vegetation vs. soil separation. It is a **segmentation** index, not a health index. | **No.** It is used with a threshold to find plants, which is exactly what we use it for. |
| **VARI** | Gitelson et al., 2002 | Vegetation fraction; designed to be relatively insensitive to atmospheric effects | **No** crop-specific health bands |
| **TGI** (Triangular Greenness) | Hunt et al., 2011/2013 | Correlates with leaf chlorophyll content | **No** absolute bands; the published relationships are regression fits against measured chlorophyll, not thresholds |
| **DGCI** | Karcher & Richardson, 2003 | Dark green colour, used for nitrogen status; **originally defined for use with a reference colour card in frame** | **No** — and its published use explicitly requires calibration to a reference standard we are not carrying |

*These attributions are method-origin references, verified as real published methods.
They are not sources for threshold values, because they do not contain threshold
values.*

**So here is what we propose instead, and we think it is genuinely better than a
made-up number.**

#### PROPOSED: relative interpretation, against the field's own distribution

The pod already computes the index for every accepted tile across the whole scan.
That gives us a within-scan distribution — a field compared against itself, under
one illumination, with one camera, in one session. **All the confounds above cancel
in that comparison.** A cell in the bottom decile of its own field on the same
afternoon is genuinely worth walking over to look at.

```jsonc
"vegetation": {
  "interpretation_mode": "relative",
  "vari": {
    "mean": 0.31, "p10": 0.12, "p50": 0.30, "p90": 0.44,
    "field_median": 0.30,
    "band": "TYPICAL",
    "band_basis": "within_scan_percentile",
    "threshold_source": "PROVISIONAL — within-scan relative, no published absolute band exists for uncalibrated RGB VARI",
    "threshold_confirmed": false,
    "source": "measured"
  }
}
```

**Bands, for every one of the four indices, PROVISIONAL, `threshold_confirmed:
false`:**

| Band | Definition | Farmer-facing meaning |
|---|---|---|
| `LOWER_TAIL` | below the scan's 10th percentile | "Noticeably less green than the rest of your field. Worth inspecting." |
| `BELOW_TYPICAL` | 10th–25th percentile | "Slightly below the rest of the field." |
| `TYPICAL` | 25th–75th percentile | "In line with the rest of the field." |
| `ABOVE_TYPICAL` | above the 75th percentile | "Among the greener parts of your field." |

**What this deliberately does not claim:** it does not say the field is healthy. A
uniformly stressed field has a perfectly normal internal distribution. **Please
render that caveat on the screen, not in a tooltip.** Something like: *"Compares
parts of your field against each other. It cannot tell you whether the whole field
is healthy."*

**What we would need to give you absolute bands, so you can see why we are not:** a
calibrated reflectance reference in every frame, a bench-characterised camera
response, and a local field campaign correlating index values against measured
chlorophyll or nitrogen for each of three crops. That is a season of work and a
spectrometer, not six days.

**A judge who asks "what does VARI 0.31 mean?" should be told: "on its own, nothing
— which is why we present it relative to the rest of the field rather than inventing
a threshold."** That is a stronger answer than a confident number, and it is
defensible under follow-up.

---

### B7 · When `out_of_domain_fraction` makes DGCI untrustworthy — **PROPOSED: 0.30, marked provisional**

Context: `core/indices.py` narrows DGCI's valid hue domain to **[60°, 120°]** —
yellow-green through green. Pixels outside that arc are not meaningfully "dark green"
at all and are excluded. `out_of_domain_fraction` is the proportion excluded.

**PROPOSED threshold: withhold the DGCI mean when `out_of_domain_fraction > 0.30`.**

```jsonc
"dgci": {
  "mean": null,
  "out_of_domain_fraction": 0.47,
  "reason": "OUT_OF_DOMAIN_FRACTION_EXCEEDED",
  "threshold": 0.30,
  "threshold_source": "PROVISIONAL — engineering judgement, not measured",
  "threshold_confirmed": false,
  "source": "measured"
}
```

**Be clear with us and with judges about what 0.30 is: it is our engineering
judgement and nothing else.** It is not measured, not published, not derived. The
reasoning is that with over 30% of the frame outside the green arc, the remaining
mean describes a minority of pixels and is not representative of the canopy. That
reasoning is sound; the specific number is a choice.

`threshold_confirmed: false`, so your provisional rendering path will pick it up
automatically. Related but separate: `core/indices.py` also enforces
`PROVISIONAL_MIN_CANOPY_FRACTION = 0.15` — below 15% canopy the whole index block is
withheld, because soil reflectance dominates.

---

### B8 · The pest threshold table with citations — **CONFIRMED, and the answer is mostly "there is no published threshold"**

Here is the complete registry, dumped verbatim from `core/trap_segmentation.py:444-690`. **We have independently re-checked the primary NIPHM source for the three numeric thresholds — result below.**

**The headline: of 15 registry entries, exactly 3 carry a numeric threshold, and all three are the same number from the same source. Everything else is deliberately `None`.**

| taxon | threshold | unit | threshold_source | confirmed? | why |
|---|---|---|---|---|---|
| `sugarcane_whitefly` | **100.0** | insects_per_trap_daily | NIPHM (2014), *AESA Based IPM Package for Sugarcane*, p. 11 | **true** | **Verified against primary source** |
| `sugarcane_woolly_aphid` | **100.0** | insects_per_trap_daily | NIPHM (2014), *AESA Based IPM Package for Sugarcane*, p. 11 | **true** | **Verified against primary source** |
| `sugarcane_whitefly_woolly_aphid` | **100.0** | insects_per_trap_daily | NIPHM (2014), Sugarcane, p. 11 — combined conservative reading | **true** | See note below |
| `wheat_aphid` | `None` | `None` | NIPHM (2014), Wheat, p. 10 | n/a | `NO_PUBLISHED_ETL` — source gives no number |
| `wheat_thrips` | `None` | `None` | NIPHM (2014), Wheat, p. 10 | n/a | `NO_PUBLISHED_ETL` — source gives no number |
| `rice_yellow_stem_borer` | `None` | `None` | NIPHM (2014), Rice, p. 9 | n/a | `NOT_SAMPLED_BY_STICKY_TRAP` — native: 25 moths/trap/week on a **pheromone lure trap** |
| `rice_leaf_folder` | `None` | `None` | NIPHM (2014), Rice, p. 9 | n/a | `NOT_SAMPLED_BY_STICKY_TRAP` — native: 2 damaged leaves per hill, **visual scouting** |
| `rice_brown_planthopper` | `None` | `None` | NIPHM (2014), Rice, p. 9 | n/a | `NOT_SAMPLED_BY_STICKY_TRAP` — native: 10–15 hoppers per hill, **hill-base tap** |
| `rice_hispa` | `None` | `None` | NIPHM (2014), Rice, p. 9 | n/a | `NOT_SAMPLED_BY_STICKY_TRAP` — native: 2 adults or 2 dead leaves per hill |
| `sugarcane_early_shoot_borer` | `None` | `None` | NIPHM (2014), Sugarcane, p. 11 | n/a | `NOT_SAMPLED_BY_STICKY_TRAP` — native: 15% dead heart, visual |
| `sugarcane_top_borer` | `None` | `None` | NIPHM (2014), Sugarcane, p. 11 | n/a | `NOT_SAMPLED_BY_STICKY_TRAP` — native: pheromone trap @ 4–5/acre |
| `sugarcane_pyrilla` | `None` | `None` | NIPHM (2014), Sugarcane, p. 18 | n/a | `NOT_SAMPLED_BY_STICKY_TRAP` — native: 3–5 individuals per leaf, visual |
| `whitefly` (generic alias) | `None` | `None` | points to `sugarcane_whitefly` | n/a | `NO_PUBLISHED_ETL` |
| `aphids` (generic alias) | `None` | `None` | points to `sugarcane_woolly_aphid` | n/a | `NO_PUBLISHED_ETL` |
| `thrips` (generic alias) | `None` | `None` | points to `wheat_thrips` | n/a | `NO_PUBLISHED_ETL` |

Source URLs, present in the code and safe to put in front of a judge:
`https://niphm.gov.in/IPMPackages/Sugarcane.pdf` · `.../Wheat.pdf` · `.../Rice.pdf`

**The citation re-check, and its result.** We fetched the NIPHM sugarcane package and read section D, *Yellow pan water/sticky traps*, on page 11. It instructs the reader to set up yellow pan water or sticky traps 15 cm above the canopy to monitor woolly aphids and whitefly at 4–5 traps per acre, to count them on the traps daily, and to intervene once the population exceeds 100 per trap. **The code's quoted text matches the source exactly, the page number is right, and the threshold is real.** Marked `threshold_confirmed: true`.

This matters because past output from our toolchain has attached plausible-looking but fabricated page numbers to NIPHM and ICAR. This one survived checking. **The Wheat and Rice page numbers have not yet been re-checked the same way** — but since neither yields a numeric threshold, nothing rendered to a farmer depends on them.

**On the combined `sugarcane_whitefly_woolly_aphid` entry:** the NIPHM text counts woolly aphids *and* whiteflies together against one limit of 100 per trap. The registry's combined entry is the faithful reading of the source; the two separate entries are a conservative split. If the Model B classifier cannot reliably separate the two taxa on a card, **use the combined entry** — it is what the source actually says.

---

**What this means for your UI, and it is more than a rendering note.**

**1. "No published threshold" is the common case and must be a first-class state, not an error.** Twelve of fifteen entries have no number. `threshold: null` with `status: "NO_PUBLISHED_ETL"` is the system being honest, not the system failing.

**2. `NOT_SAMPLED_BY_STICKY_TRAP` is the most valuable thing in this table and should be visible.** Six pests are in the registry specifically to record that **a yellow sticky card is the wrong instrument for them.** Stem borers are caught on pheromone lure traps. Planthoppers are counted by tapping the base of a hill. Leaf folders are counted as damaged leaves. A sticky-card count for any of these is not a low number — it is a meaningless one, and a system that reported one would be inventing a measurement.

> Suggested rendering: *"Brown planthopper is not monitored by sticky trap. NIPHM guidance counts 10–15 hoppers per hill by tapping the plant base. Please scout manually."*

That turns a gap into advice, and it is a very strong answer to a judge who asks "why doesn't your trap detect stem borer?"

**3. A schema gap you need to know about before the freeze.** The literal keys `threshold_source` and `threshold_confirmed` **do not exist in the code.** The registry uses `citation`, `source_url`, `source_quote`, and `status`. Those schema fields exist only in `data_flow_architecture.md`. **The gateway must map registry fields onto schema fields**, and until it does, nothing populates them. This is now an explicit build item on our side, raised here so it is not discovered by an empty field on demo day.

The mapping we will implement:

| Schema field | Source in code |
|---|---|
| `threshold` | `threshold_value` |
| `unit` | `threshold_unit` |
| `threshold_source` | `citation`, with `source_url` appended |
| `threshold_confirmed` | `true` only where the citation has been re-verified against the primary PDF; `false` otherwise |
| `status` | `status` verbatim |
| `native_sampling_method`, `native_threshold` | passed through — **please render these**, per point 2 |

**4. A scope warning that has not gone away.** The trap pipeline still depends on `MM_PER_PIXEL`, which is `None` and guarded by a `RuntimeError` (`core/trap_segmentation.py:26`). It cannot be set from software — it needs the ESP32-CAM in its final enclosure and a photo of a ruler at the working distance. **The hardware arrives this week and the measurement has not been taken.** Same for `PROVISIONAL_MARKER_SPACING_W_MM = 80.0` / `_H_MM = 55.0`, which must be measured with calipers on the actual printed cards.

If either slips, `pest[]` will be an **empty array with a reason**, not a fabricated count. **Please make sure that renders gracefully — there is a real chance it is the demo-day state.**

**5. One honest line for the slide.** NIPHM specifies 4–5 sticky traps per acre. **We have one.** One trap does not represent a field, and an agronomy judge will know. The correct framing is: *"One instrumented station for the demonstration. In deployment, traps scale to 4–5 per acre per NIPHM guidance."*

---

### B9 · Who writes the `actions[]` text — **DECIDED: templates, keyed, with a parameter block. See F5 for why this is the important one.**

**Templates. Not free text. Not LLM output.**

Full answer in **F5**, because the key design point there is the one that makes your
Hindi requirement (E3) achievable offline. Short version:

- The Jetson emits a **stable `template_id`**, a **`params` object** of the values
  substituted into it, and the **rendered English string**.
- You hold the Hindi table keyed by `template_id` and substitute from `params`.
- Hindi then works **offline**, deterministically, with no model and no network.
- **Length cap: `action` ≤ 240 characters. `rationale` ≤ 400 characters. SMS variant
  ≤ 160 characters**, emitted as a separate `sms` field.

---

### B10 · CWSI and FAO-56 ranges and bands

**CWSI — CONFIRMED on range and direction, PROPOSED on bands, with a significant
architecture change you need to know about.**

**The architecture change first:** CWSI no longer comes from the mast. The MLX90640
thermal array moved to the handheld pod on 12 September. This matters to you in two
ways:

1. **`inputs[]` changes.** There is no more `mast_thermal` input with an age of
   hours. It becomes `pod_thermal`, measured during the scan, age in minutes.
2. **The mast retains an MLX90614 single-point IR sensor** for continuous canopy
   temperature logging. **It cannot produce CWSI and must never be presented as
   doing so.** A single point cannot support the canopy/soil pixel separation CWSI
   requires. We have a test in the suite that asserts exactly this
   (`test_section_a_mlx90614_cannot_report_cwsi_without_array`). If you ever see a
   CWSI value attributed to the mast, that is a bug, and please report it rather than
   rendering it.

**Range and direction — CONFIRMED:** CWSI is **0 to 1**. **0 = fully watered and
transpiring freely. 1 = fully stressed and not transpiring.** Higher means more
stress. Your assumption is correct.

**Method — CONFIRMED:** the **Jones (1999) direct method**, using physical wet and
dry reference surfaces — wetted and dry cotton, mounted on two forward arms on the
pod, inside the MLX90640's field of view.

    CWSI = (Tc − Twet) / (Tdry − Twet)

Every term is measured in the same thermal frame at the same instant. **This is
genuinely worth showing a judge**, because it eliminates the multi-day
non-water-stressed baseline campaign the empirical method needs. The empirical Idso
method remains in the code as a fallback path.

**Bands — PROPOSED, `threshold_confirmed: false`:**

| CWSI | Band | Meaning |
|---|---|---|
| 0.00 – 0.20 | `NO_STRESS` | Transpiring freely |
| 0.20 – 0.40 | `MILD` | Early stress; monitor |
| 0.40 – 0.60 | `MODERATE` | Irrigation advisable |
| 0.60 – 1.00 | `SEVERE` | Irrigate |

**These boundaries are engineering judgement informed by the general CWSI
literature, and they are not a crop-specific cited threshold for wheat, rice or
sugarcane.** `threshold_source: "PROVISIONAL"`, `threshold_confirmed: false`. Render
them as provisional. If we find a citable crop-specific source before the freeze we
will send it as an addendum, but do not build assuming we will.

**CWSI can be `null`, and the reasons are machine-readable.** Expect these:

| `cwsi_status` | When |
|---|---|
| `OK` | Value present |
| `CLOCK_UNTRUSTED` | GPS time invalid — see A12. **CWSI is strictly diurnal; a wrong timestamp voids the reading.** |
| `NOT_SOLAR_NOON` | Measured outside the 11:30–14:00 window |
| `NOT_CLEAR_SKY` | The mast's BH1750 light sensor indicates cloud; CWSI is invalid under variable cloud |
| `THERMAL_SENSOR_ABSENT` | MLX90640 not connected |
| `INSUFFICIENT_CANOPY_PIXELS` | Fewer than 100 valid canopy pixels in frame |
| `REFERENCE_SURFACES_INVALID` | Wet/dry references not resolvable in the thermal frame |

**Design for `null` being common.** CWSI genuinely requires clear sky near solar
noon. **On a cloudy demo day, CWSI will be `null` and that is the system working
correctly.** A screen that handles this gracefully — showing the reason — is a
better demo than one that shows a number it should not have.

---

**FAO-56 — PROPOSED, and yes, you are right that `depletion_mm` alone is
meaningless.**

Your instinct is correct: depletion in millimetres tells a reader nothing without
knowing what it is depletion *of*. **We will emit the denominators alongside it.**

```jsonc
"fao56": {
  "depletion_mm": 21.4,
  "taw_mm": 96.0,
  "raw_mm": 52.8,
  "depletion_fraction": 0.223,
  "ks": 0.92,
  "et0_mm_day": 4.6,
  "et0_method": "hargreaves_samani",
  "root_zone_depth_m": 0.6,
  "soil_texture": "loam",
  "threshold_source": "PROVISIONAL — soil water parameters not measured on the demo plot",
  "threshold_confirmed": false,
  "source": "derived"
}
```

Definitions so your UI text is accurate:

- **TAW** — Total Available Water. The water in the root zone between field capacity
  and permanent wilting point. Derived from soil texture and rooting depth.
- **RAW** — Readily Available Water. The fraction of TAW the crop can extract without
  stress, `RAW = p × TAW`, where `p` is a crop-and-stage depletion fraction.
- **Ks** — the water stress coefficient. **Ks = 1.0 while depletion is below RAW**,
  and declines linearly toward 0 as depletion approaches TAW. So **Ks < 1.0 is the
  signal that the crop is under water stress**, not the depletion figure by itself.

**Recommended presentation:** a bar showing depletion against RAW and TAW, with the
RAW line labelled as the irrigation trigger. "21 mm of 96 mm depleted; irrigation
recommended at 53 mm" is actionable. "depletion 21.4" is not.

**All of these are marked `derived`, never `measured`**, and
`threshold_confirmed: false`, because TAW and RAW depend on soil parameters that
require an infiltrometer test on the actual plot (Row 10 of
`HUMAN_ACTIONS_OUTSTANDING.md`) which has not been done and will not be before the
deadline. The soil texture used is a defaulted table value. **This is a derived
estimate from defaulted parameters, and must not be rendered as a measurement of
the farmer's soil.**

---

### B11 · NDVI, the day the optics land — **CONFIRMED, plus a string mismatch you need to fix now, plus a warning**

**First, the mismatch — and it is exactly the kind of thing your document exists to
catch.**

Your document says the app renders `PENDING_HARDWARE_FINALIZATION`.
`data_flow_architecture.md` §7.3 specifies `GATED_HARDWARE_CALIBRATION`.

**These are different strings and one of them will not match.** The canonical value
is the one in §7.3:

    "ndvi_status": "GATED_HARDWARE_CALIBRATION"

Please change your constant to match. If that is expensive on your side, tell us and
we will emit yours instead — but **we must not ship two strings.**

**Confirming your actual question — DECIDED:** the enum is exactly two values for
schema v1.0.

| `ndvi_status` | `ndvi` | Meaning |
|---|---|---|
| `GATED_HARDWARE_CALIBRATION` | `null` | Current and expected state through the demo |
| `OK` | a number | The optics landed and the bench calibration was completed |

**No third value. The flip is a non-event, exactly as you asked.** If anything else
is ever needed it goes through the A8 versioning rule.

**Why it is gated, so you can answer this if asked:** the dual-bandpass path is
fully implemented in `core/ndvi.py` — 660 nm / 850 nm NDVI, silicon cross-talk
unmixing, empirical line calibration. It is blocked on two physical things: the
MidOpt DB660/850 filter (~₹19,000, not obtainable in India at the size needed inside
the window), and `calib_matrix`, the bench cross-talk unmixing matrix, which must be
measured on the assembled sensor against monochromatic sources. **`core/ndvi.py`
raises `NotImplementedError` rather than returning an uncalibrated number.**

**The correct line for a judge is: the NIR path is implemented and hardware-gated,
not absent.** A visible gate is engineering judgement. A fabricated NDVI would be
failure pattern #1.

**Now the warning, and please take this one seriously.**

The demo dashboard will show a **static Sentinel-2 NDVI tile from Copernicus** as a
**clearly-labelled visual stand-in** for what an NDVI map looks like.

**That satellite tile must never, under any circumstances, reach the app's `ndvi`
field.** It does not come from our pipeline, it does not come from our sensor, it is
not of the demo plot, and it is not a measurement this system made. It is a picture
of what the feature would look like.

The Jetson will never emit it — `ndvi` stays `null`. We are telling you so that if
anyone on either team suggests "let's just put the satellite image in the app so
there's something to show", **the answer is no**, and both of us know why in advance.
That is precisely failure pattern #1 arriving through a side door during demo week.

---

# §4 · Group C — radio, addresses and the field setup

### C1 · Has the Jetson WiFi adapter been ordered? — **PARTIAL, with a correction and a new requirement**

**Correction to the recommendation you may be holding:** the Intel AC8265 M.2 card
was **rejected**. Fitting it requires removing the Nano's heatsink to reach the M.2
slot, which is invasive work on the only board we have, six days out.

**The decision is a USB dongle with an RTL8188EUS chipset** — e.g. TP-Link
TL-WN725N. Chipset matters: kernel 4.9 on L4T 32.7 has reliable `hostapd` AP-mode
support for RTL8188EUS, and unreliable or absent support for several cheaper
chipsets sold in identical-looking packaging.

**Status: Ahsan to confirm ordered / arrived and fill in the date before this
document is sent.** Ordering was scheduled for this week and the AC8265 remains under
review by the supervisor.

> **Ahsan — fill this in: we will be buying a dongle with either an Atheros AR9271-P chip OR one with a RT5370 / RT5372 chip**

**And a new requirement that came out of the architecture change, which we are
raising here because it affects C3 and it affects procurement:**

**The pod needs TWO WiFi interfaces, not one.**

The Nano has to be:
- a **client (STA)** on the mast node's access point, to pull sensor and trap data;
- an **access point (AP)** for the phone, to serve advisories.

**A single RTL8188EUS cannot reliably do both at once.** Concurrent AP+STA on that
driver is not dependable, and where it works at all both interfaces must share a
channel.

Two ways out:

| Option | Cost | Consequence for the app |
|---|---|---|
| **Two USB dongles** (recommended) | ~₹600 | None. AP is always up, independent of node collection. |
| **Sequential mode-switching** | Free | **The AP drops for roughly 20–30 seconds** while the pod collects from the mast. The phone loses the connection and must reconnect. |

**Recommendation: buy the second dongle.** It removes an entire class of demo-day
failure for ₹600, and the Nano has four USB ports.

**If the sequential path is taken instead, your sync screen needs to handle the AP
disappearing mid-sync and coming back.** Tell us which you are designing for and we
will make the procurement decision match.

---

### C2 · Final SSID, password, IP and port — **PROPOSED, and there is a real subnet collision to fix**

**You spotted the collision risk. It is real.** The ESP32 SoftAP default gateway
address is **192.168.4.1** — the same address your app defaults to for the Jetson.

**Resolution — PROPOSED:**

| | Value | Note |
|---|---|---|
| **Jetson AP SSID** | `SIH-FIELD` | Keeps your default |
| **WPA2-PSK password** | *Ahsan123* | 8–63 chars, WPA2-PSK only. **No WPA3** — Android/driver interop on kernel 4.9 is not worth the risk. |
| **Jetson static IP** | **192.168.4.1** | Unchanged. Your default keeps working. |
| **Jetson subnet** | 192.168.4.0/24 | |
| **API port** | **8080** | Unchanged |
| **Base URL** | `http://192.168.4.1:8080/api/v1/` | Plain HTTP. No TLS — a self-signed cert on a local AP causes more problems than it solves here. |
| **Mast node AP SSID** | `SIH-NODE-01` | |
| **Mast node IP — CHANGED** | **192.168.9.1**, subnet 192.168.9.0/24 | **Moved off 192.168.4.x to resolve the collision.** One-line firmware change: `WiFi.softAPConfig()`. |

**The collision is resolved by moving the node, not the Jetson**, so nothing changes
on your side and your hardcoded default remains correct.

> **Ahsan — for now we are setting the password as Ahsan123**

**One more thing worth designing for:** the SSID is intentionally not hidden and the
password is intentionally simple. On demo day a judge may want to join it themselves.
That is a good outcome — make sure the app handles a second client gracefully. The
API is read-only and stateless per request, so it will.

---

### C3 · When does the AP come up, and for how long? — **DECIDED, and the handheld change makes this simpler**

**Automatic at boot. Stays up for the entire session. Survives reboot.**

- `hostapd` and `dnsmasq` run as enabled systemd units. The AP is up within a few
  seconds of the Nano reaching multi-user, and comes back automatically after any
  reboot or power cycle.
- **No button press.** With the drone gone, there is no landing event to trigger
  anything on, and the pod is a handheld device the farmer is already holding. A
  button adds a step to explain and a thing to forget.
- **No timeout.** The pod runs from a 20,000 mAh PD power bank; the AP's draw is
  negligible next to the Nano under TensorRT load. Battery life is bounded by
  inference, not by the radio.

**What this means for your connection screen — it gets simpler:**

- There is no "wait for landing" state.
- There is no countdown.
- The correct instruction is a standing one: *"Join the WiFi network `SIH-FIELD`.
  The pod is always broadcasting while it is switched on."*
- The only transient state is the `503` window of a few seconds at boot (A5) and,
  **if the single-dongle path is taken in C1**, the 20–30 second AP drop during node
  collection.

**Please build the screen for the two-dongle case (AP always up), and we will tell
you by 16 Sep whether the second dongle was bought.** If it was not, you will need the
transient-drop handling and we will give you notice.

---

### C4 · DHCP behaviour, and no captive portal — **DECIDED, and we are going further than you asked**

**Confirmed: `dnsmasq` hands out leases and does NOT respond to connectivity-check
URLs.** No captive portal, no sign-in page, no DNS interception.

**DHCP configuration:**

| Setting | Value |
|---|---|
| Range | **192.168.4.50 – 192.168.4.150** |
| Netmask | 255.255.255.0 |
| Lease time | 12 hours |
| Jetson (server) | 192.168.4.1, static, outside the pool |

**Three deliberate choices to help with your E1 problem:**

1. **No default gateway is advertised.** `dhcp-option=3` is sent empty. The phone is
   not told there is a route to the internet through us, because there is not one.
2. **No DNS server is advertised.** `dhcp-option=6` is sent empty. Every address in
   the app is a literal IP, so no DNS is needed, and not offering one removes a way
   for the phone to send lookups into a void.
3. **No wildcard DNS record.** Specifically, `address=/#/192.168.4.1` will **not** be
   in the config. That single line is what turns a local AP into something Android
   reads as a captive portal, and it is a common copy-paste from tutorials. It is
   explicitly banned from our config and we will show you the file if you want.

**What you should expect to see on the phone:** Android will probe, fail to reach
the internet, and display "Connected, no internet" plus possibly a "stay connected?"
prompt. **That is the correct and expected behaviour.** It is not a captive portal
and it does not drop the network. It does not solve E1 — the routing problem is
independent — but it will not make E1 worse.

---

### C5 · The exact node and field ID strings — **PROPOSED, for Ahsan to ratify**

You are right that §7.3 is inconsistent — `"field_id": "F01"` is prefixed and
zero-padded, `"source_node": "07"` is bare. **PROPOSED, consistent scheme:**

| Key | Value for demo | Format |
|---|---|---|
| `field_id` | `"F01"` | `F` + 2 digits, zero-padded |
| `source_node` | `"N01"` | `N` + 2 digits, zero-padded. **Changed from `"07"`.** |
| `generated_by.device` | `"sih-pod-01"` | lowercase, hyphenated |

**All three are opaque strings to the app — never parse them, never sort on them,
never derive a number from them.** Padding will not change after the freeze.

**One clarification that comes from §0:** `source_node` identifies the **mast node**.
Data originating on the pod itself — thermal/CWSI, cameras, GPS — is not from a node
and will carry `"source_node": "POD"` in `inputs[]`. See the revised `inputs[]` list
in §8.

> **Ahsan — i think the nano should be reffered as "nano_node" and the rest mast nodes in the filed will be reffered to as "node_01" or "N01"**

---

### C6 · One node, one field — **CONFIRMED, with one clarification**

**Confirmed: one mast node, one field, for the demo. Build the single-node UI.**

The clarification: **there are two physical devices, but only one data-source node.**
The pod is the collector, not a node. In `inputs[]`, mast-sourced entries carry
`"source_node": "N01"` and pod-sourced entries carry `"source_node": "POD"`. That is
a string difference in an existing field, not a second node in your information
design, and it does not require the multi-node UI you correctly want to avoid.

**If this changes — if a second mast is built — you will hear it from us the same
day, not in demo week.** We do not expect it to; the mast BOM is ordered as one unit.

---

### C7 · An Android phone we can keep — **PENDING, Ahsan owns this, and it is more urgent than it looks**

**We cannot supply a phone from the hardware budget.** It has to come from within the
team.

You are right that E1 cannot be built or tested in Expo Go or on an emulator — it
needs a physical device, a cable, and an `expo run:android` dev build. **E1 is
currently the single app-side item that can make the whole system look broken on
demo day**, with the pod sitting three feet away and every request timing out.

> **Ahsan — needed before you send this document:**
> - Whose phone, for the build week: i think since vitthal is builiding the app he needs to test and make sure evrything is working fine so he should use his own phone
> - Android version: latest i assume
> - Can the app team hold it? its his own phone so yeah
> - Demo-day phone, if different: i think we should use his phone only if possible

**A suggestion:** the phone used to build E1 and the phone used for the demo should
be the **same physical device**, or at minimum the same Android major version.
Network-binding behaviour differs meaningfully across Android 10 / 12 / 13+, and
"it worked on mine" is a demo-week failure we have time to avoid.

---

# §5 · Group D — decisions marked OPEN

### D1 · Schema sign-off date — **PROPOSED: 16 September 2026, 23:59 IST**

Reasoning is in §1 under A1: §8 of this document proposes six changes that come out
of the architecture change and out of gaps your own questions exposed. Freezing
before those are agreed would freeze a schema that cannot express what the system
produces.

**Proposed sequence:**

| When | What |
|---|---|
| **14 Sep** | This document reaches you |
| **15 Sep** | You reply on §8. Outstanding items: F5 template list, Wheat/Rice page re-check |
| **15 Sep** | You reply on §8 — accept, amend, or reject each proposal |
| **16 Sep** | Both sides sign off. **Schema frozen.** |
| **16 Sep** | First real advisory JSON (B12) |
| **After 17 Sep** | Any §7.3 change requires written agreement from both sides |

**Your position — "we accept §7.3 as written, subject to A2–A12 and the media
question in A10" — is accepted.** This document answers all of A2–A12 and A10.


---

### D2 · SD retention, and what a pruned image looks like — **PROPOSED**

**The retention rule, in two parts:**

**1. Advisory JSON is never pruned.** Ever. An advisory is a few kilobytes; a 64 GB
card holds more than this system will generate in years. There is no scenario where
deleting advisory JSON is the right call, and making it never happen removes a class
of bug. **So a `404` on `/api/v1/advisory/<id>` genuinely means "never existed",
which is what you wanted.**

**2. Images are pruned by a retention rule, and it is not size-driven.**

| Image class | Retained? |
|---|---|
| Frames that produced a `DISEASE` finding | **Kept** |
| Frames rejected as out-of-distribution | **Kept** — these are the evidence that rejection worked, and they are good demo material |
| Sticky trap images | **Kept** |
| Routine frames that produced a `HEALTHY` verdict | **Discarded after the advisory is committed** |
| Frames rejected as `not_crop` | **Discarded** |

The rationale is that the interesting frames are a small minority and the routine
ones are the bulk. This is a policy decision, not a technical constraint — **storage
is genuinely not a limit on this system and nobody should spend money or time
solving a storage problem here.**

> **Ahsan — i think tha above propossed decision is okay to go with if you do have any other suggestion plz do tell**

**3. The response for pruned media — DECIDED: `410 Gone`, as you proposed.**

```jsonc
HTTP 410
{"error": "gone", "reason": "retention_pruned", "media_id": "42-crop-3"}
```

Distinguishable from `404` ("never existed"), exactly as you asked. Your framing was
right: *"deleted to save space"* and *"never existed"* are different things to tell a
farmer, and the difference is one status code.

---

### D3 · The phone writes nothing but `/ack` — **CONFIRMED**

**Read-only replica. Confirmed.** `POST /api/v1/ack` is the only write endpoint that
will exist, and as established in A6 nothing is gated on it.

Nobody on the hardware or ML side is expecting farmer notes, confirmations,
corrections, or label feedback to flow back. **If anyone raises it later, the answer
is that it is a post-submission feature**, because it introduces write conflict
resolution, authentication, and a two-way sync — none of which exist and none of
which can be built in six days.

**One thing we would genuinely like eventually, flagged only so it is not a surprise
if it comes up: farmer confirmation of a detection would be extremely valuable
training data** for the shortcut-learning problem in B3a. It is the right long-term
answer to that weakness. It is out of scope now.

---

### D4 · Is the Supabase upstream tier in or out? — **PENDING, Ahsan decides. Our recommendation: OUT.**

**Recommendation: out for the demo.**

Reasoning:
- It adds zero to the demo narrative. The project's central claim is that it works
  with **no cloud at any point**, and §13.1 has us answering *"why not cloud?"* to
  judges. A cloud tier is a thing to explain away, not a thing to show.
- It is additive, so it can be added after submission with no field-path change.
- With six days left and no persistence layer at all, any hour spent on an upstream
  tier is an hour not spent on `frame → prediction → SQLite → HTTP → phone`.

**If Ahsan decides it is in, one condition is non-negotiable and it matches your own
position exactly: no field-path behaviour changes. Our answer is the same as yours —
no.** An advisory must never wait on, depend on, or be altered by the presence of an
upstream. The Supabase push reads from the phone's local SQLite after the fact and
touches nothing else.

> **Ahsan — i think as it needs to be cloud free we should not use it and it will also take extra time so i say No*

---

# §6 · Group E — acknowledged, plus what we can do to help

No answers required from us, but three of these have a hardware or ML dependency
worth naming.

| Item | Our note |
|---|---|
| **E1** Android binding | Answered in §1. The file-drop fallback offer stands and is real insurance. |
| **E2** Dev build | Agreed — get the first dev build green **before** the hardware arrives. It is a day of Gradle problems and it is much worse to hit it on the 18th. |
| **E3** Hindi | **The `template_id` + `params` design in F5 is what makes offline Hindi possible.** Without it you would be translating free text at runtime with no network. Please read F5 before scoping E3. We can supply English strings and crop/disease plain names; we cannot supply verified Hindi disease nomenclature — see B1. |
| **E4** Onboarding + media | C2 and C3 are answered above, so the connection screen is unblocked now. A10 says media is likely out — **we suggest you do not build the media viewer**, and spend that time on the connection and degraded-state screens instead. |
| **E5** Conformance check against the real Jetson | **Yes, and we want this.** Realistic first slot is **17 September**, after the TensorRT engine is built and the HTTP server exists. Bench only, no field, no pod assembly. We will run `--flaky` and `--slow` with you. **Please hold 30 minutes on the 17th.** |

---

# §7 · Group F — where the farmer's advice comes from

### F1 · What generates `actions[]` — **Decision acknowledged. One correction and one hard condition.**

Acknowledged: the LLM layer is in scope, runs on the phone opportunistically, and
the field path does not change. **We agree with the shape of this decision.** The
reasoning — the LLM explains an advisory that already exists, and no advisory ever
waits on the API — is correct and it preserves the "no cloud at any point" claim.

**One correction to your F3 note:** it says *"the model runs on the phone"*. To be
precise, nothing runs on the phone — **the phone calls a remote API.** No model
weights are on the device. It matters because a judge asking "is there an AI model on
the phone?" gets a different answer than "does the phone use AI?", and we should both
give the same one.

**The hard condition — and B9 is the reason:**

**The Jetson emits `actions[]` deterministically, always, regardless of whether the
LLM layer ever runs.** Your document says this and we are confirming it as binding
from our side. If anyone proposes dropping the Jetson templates because "the LLM
handles it", the answer is no, and here is the concrete cost: **an offline farmer
gets a blank screen, and the offline half of your two-part demo has no content.**

`actions[]` from the Jetson is the product. The LLM is a nicer rendering of it.

---

### F2 · The rule the LLM must obey — **AGREED, completely, and we want to propose a mechanism rather than just agree**

**Agreed: generated text is assembled from schema values only. The prompt cannot
introduce figures. Measured values pass through verbatim or not at all.**

We agree with your reasoning in full, and want to add one sentence to it: **the app
is not just the last place a fabricated number can be caught — with a generative
layer, it becomes the only place one can be created that no downstream check will
see.** Every guard in `core/` is upstream of this. None of them can help you.

So an agreement in principle is not enough. **Here is a mechanism we think you should
build, and it is about twenty lines:**

#### The numeric-token guard

After generation, before rendering:

1. Extract every numeric token from the generated text — integers, decimals,
   percentages, ranges.
2. For each, assert it appears as a value **in the source advisory JSON** (allowing
   for obvious formatting: `0.83` ↔ `83%`, `21.4` ↔ `21`).
3. **If any token fails, discard the entire generated block** and render the
   deterministic `actions[]` alone, with a quiet note that the explanation was
   unavailable.

Fail closed, not open. A missing explanation costs nothing. A hallucinated spray
concentration in the last paragraph a farmer reads is a safety problem.

**Prompt-side constraints we would ask you to adopt:**

- Send the advisory JSON as the **only** data in the prompt. No retrieved context, no
  agronomic knowledge base, no web search.
- System prompt in the spirit of the one already specified for `edge/advisory.py`:
  *"You are a translator. Render the finding below into simple language for a
  smallholder farmer. Do not add diagnoses. Do not add recommendations not present in
  the JSON. Do not change any number. Do not introduce any number that is not in the
  JSON."*
- **Do not ask it for a dose, a concentration, a product name, or a timing** that is
  not already in the JSON. If the template did not say it, the model must not.
- Temperature low. Cap output length.

**What the app renders when generation fails or is unavailable — answering your
direct question:**

**The deterministic `actions[]`, on its own, with no error and no empty state.** The
explanation block simply is not there. This is the normal case — most of the time the
phone will be offline — so it must be the default rendering, not a fallback that
looks degraded. An unobtrusive line like *"Detailed explanation available when
online"* is fine. A red error is not: nothing has failed.

---

### F3 · Jetson headroom — **CONFIRMED closed**

Agreed, moot, and confirming the numbers: Jetson Nano 4 GB, running EfficientNet-Lite0
under TensorRT FP16 with the index pipeline, in a single post-scan pass. **Nothing
about the LLM decision adds any load to the Nano.** Nothing needed from us.

For completeness, since it may come up: a local LLM on this board was never viable.
4 GB shared with TensorRT, Maxwell GM20B, **FP16 only — no INT8 hardware at all**, so
the quantisation that makes small local models practical is unavailable to us. Your
option-2 assessment was correct.

---

### F3a · The API key cannot ship inside the app — **Our vote: the rate-limited key, said out loud**

App-team decision, but you asked, so: **rate-limited key in the app, accepted and
disclosed as demo-week risk.**

Reasoning: the proxy is correct engineering and it is the right answer for anything
shipping. For a six-day demo it adds a host, a deployment, a second thing that can be
down on demo day, and a morning of work — and it protects against a threat (someone
decompiling an APK that has been installed on two phones) that does not exist during
a hackathon.

**The condition is the one you already named: say it out loud.** "The API key is
embedded and rate-limited; in production this moves behind a proxy" is a perfectly
good answer and shows you understood the problem. Hiding it is what turns it into a
finding.

You noted the call site is identical either way. That makes this genuinely reversible,
which is the best reason to take the cheap path now.

---

### F4 · Generated text must be visibly distinct — **AGREED. The flag is confirmed.**

```jsonc
"actions": [
  {
    "rank": 1,
    "template_id": "IRRIGATE_MODERATE_STRESS",
    "action": "...",
    "rationale": "...",
    "params": {"cwsi": 0.52, "depletion_mm": 21.4},
    "confidence": "medium",
    "advisory_only": true,
    "generated_by": "template",
    "source": "derived"
  }
]
```

**`generated_by` is mandatory and the Jetson always emits `"template"`.** The Jetson
has no generative layer and never will — `"llm"` can only ever be set by the phone,
on the phone-side cached explanation, which lives beside the advisory rather than
inside it.

**A suggestion on rendering, offered rather than required:** rather than treating this
as a styling variant of the same block, consider making the generated explanation a
visually separate card **below** the deterministic actions, with its own heading —
something like *"Explained in simple terms"*. Mixing two provenance classes in one
block and distinguishing them by styling alone is fragile; a judge scanning quickly
may not catch a colour difference, and a screenshot definitely will not.

Same reasoning as your rule-2 rendering of provisional thresholds, applied one level
up.

---

### F5 · Language — **DECIDED, and this is the design choice that makes offline Hindi possible**

**This is the most useful answer in Group F, so it is worth reading even though it
looks like a small schema note.**

**The layers:**

| Layer | Produces | Available offline? |
|---|---|---|
| **Jetson** | `template_id` + `params` + rendered English `action` / `rationale` | **Always** |
| **App** | Hindi, by looking up `template_id` in a local table and substituting `params` | **Always** |
| **Cloud LLM** | A richer conversational explanation, in Hindi or English | Only when online. May always be absent. |

**The key design point:** because the Jetson emits a **stable `template_id` and a
structured `params` object** — not just a rendered sentence — **you can produce Hindi
entirely offline, with no model and no network.** You hold a table:

```
IRRIGATE_MODERATE_STRESS → "आपके खेत में पानी की कमी के संकेत हैं ({cwsi})। सिंचाई करें।"
```

and substitute from `params`. Deterministic, auditable, offline, and the numbers come
from the schema by construction — which also means it satisfies F2 for free.

**If the Jetson emitted only free text, none of this would be possible** and E3 would
require a runtime translation service, which would make Hindi a network-dependent
feature in an offline-first product. That would be a bad outcome and it is the reason
we are pushing this shape.

**So, direct answers:**

- **Which layer produces Hindi?** The **app**, from `template_id` + `params`.
  Offline. Always.
- **What does the app show when the LLM is not reachable?** The deterministic
  `actions[]`, in the farmer's chosen language, complete and useful. **Nothing is
  missing. Nothing is degraded.** See F2.
- **What does the LLM add?** A more conversational, longer explanation, when online.
  Always additive, never required.

**What we need from you:** the Hindi table is app-side content. We will give you the
complete `template_id` list with the English strings and the `params` each expects.
**Target: 17 Sep**, once the rules engine templates are written. There will be
roughly 12–20 of them. Please do not start the Hindi work until you have that list —
the ids are what it keys on.

---

# §8 · Consolidated schema changes — needs your sign-off before the 16 Sep freeze

Six changes. Five come directly out of the architecture change in §0 or out of gaps
your own questions exposed. One is a compatibility addition.

**Please reply accept / amend / reject per item.**

---

### S1 · `flight` → `scan` — required by §0

There is no flight. There is no survey pass and no inspection pass.

```jsonc
"scan": {
  "started_utc": "2026-09-18T13:58:02Z",
  "ended_utc":   "2026-09-18T14:31:44Z",
  "mode": "handheld_pod",
  "frames_captured": 412,
  "frames_evaluated": 28,
  "tiles_classified": 252,
  "distance_walked_m": null,
  "distance_reason": "GPS_TRACK_NOT_RECORDED"
}
```

**If renaming the key is expensive on your side, we will keep `flight` as the key
name with corrected contents.** Ugly, but it is your renderer and your cost — tell us
which you prefer. Our preference is the rename, because `flight` on a screen invites
a question with no good answer.

---

### S2 · `crop_health` block — required, because B3 has nowhere to live

As specified in B3. There is currently **no field in §7.3** that distinguishes
"healthy", "nothing scanned", "everything rejected as not-crop", and "uncertain". An
empty `disease[]` means all four.

```jsonc
"crop_health": {
  "state": "HEALTHY",
  "reason": null,
  "crop": "wheat",
  "frames_evaluated": 28,
  "frames_agreeing": 24,
  "frames_rejected_ood": 4,
  "frames_rejected_not_crop": 2,
  "frames_uncertain": 2,
  "source": "measured"
}
```

`state` ∈ `HEALTHY | DISEASE | NOT_CROP | UNCERTAIN | NO_DATA`.

---

### S3 · `detections[]` — the GPS data has nowhere to go

**The pod carries a GPS receiver and point-tags every detection with the farmer's
location.** §7.3 has no latitude or longitude field anywhere, so this data currently
cannot reach the app at all.

```jsonc
"detections": [
  {
    "class": "rice__blast",
    "confidence": 0.83,
    "lat": 28.6139,
    "lon": 77.2090,
    "fix_quality": 1,
    "hdop": 1.4,
    "captured_utc": "2026-09-18T14:07:31Z",
    "source": "measured"
  }
],
"gps": {
  "status": "OK",
  "point_count": 17,
  "accuracy_note": "Point tagging only, approximately 2.5 m CEP. Not a survey-grade position."
}
```

`gps.status` ∈ `OK | NO_FIX | ABSENT`. When not `OK`, `detections[]` entries carry
`lat: null`, `lon: null` and a reason — they are still emitted, because the detection
is real even when the position is not.

**`disease[]` stays as the aggregate. `detections[]` is the point-event list.** They
are different things and a map wants the second.

**This is a map screen you do not currently have.** It is genuinely good demo material
— clustered pins showing infection hotspots — but it is **new app work and we are
raising it six days out, which is late.** If you cannot build the map, say so and we
will still emit the field so it is in the frozen schema for later.

**Honest caveat to render:** ~2.5 m CEP, handheld, no RTK. It locates a corner of a
field, not a plant. Do not zoom the map to a level that implies plant-level precision.

---

### S4 · `media_ids` on `disease[]` and `pest[]` — reserve the key now

Per A10. Always present, always an array, empty when there is no media. Costs us
nothing now and prevents a schema change later.

---

### S5 · `template_id`, `params`, `generated_by` on `actions[]`

Per F4 and F5. **`template_id` and `params` are what make offline Hindi possible** —
this is the one we would least like to lose.

---

### S6 · `seq` and `replay`

Per A3 and A7. `seq` is the ordering fix for the no-RTC clock problem. `replay` is
mandatory, defaults to `true` on both sides.

---

### S7 · Revised `inputs[]` — the source list changed with the architecture

For reference rather than sign-off — the shape is unchanged, the contents are not.
**The big one: `mast_thermal` is gone. CWSI now comes from the pod, fresh.**

| `name` | `source_node` | Sensor | Typical age |
|---|---|---|---|
| `pod_thermal` | `POD` | MLX90640 32×24 array | minutes |
| `pod_gps` | `POD` | NEO-6M / M8-class | minutes |
| `pod_camera_rgb` | `POD` | IMX219 CSI-0 | minutes |
| `mast_ambient` | `N01` | SHT31, in a radiation shield | < 1 h |
| `mast_ir_point` | `N01` | MLX90614 — **canopy temperature trend only, never CWSI** | < 1 h |
| `mast_soil` | `N01` | 2 × capacitive probes via ADS1115 | < 1 h |
| `mast_light` | `N01` | BH1750 — clear-sky gate for CWSI | < 1 h |
| `mast_rain` | `N01` | Tipping bucket | < 1 h |
| `mast_trap` | `N01` | ESP32-CAM sticky trap | hours to days |

`mast_trap` is the one that will legitimately go `STALE` — it is captured twice daily.
**That is deliberate demo material: pulling the node's power and showing the next
advisory come back with `sticky_trap: STALE` and a declared age demonstrates that the
system reports its own degradation.** Please make sure `STALE` renders well; it is a
feature we want to show, not a failure we want to hide.

---

# §9 · What we cannot give you, and when

| Item | Status | Owner | Date |
|---|---|---|---|
| B12 · Real advisory JSON from the pipeline | **CANNOT today** | Ahsan + Antigravity | Hand-assembled **16 Sep**; pipeline-emitted **18 Sep** (at risk) |
| B1 · Verbatim 29-class list | **DELIVERED** — see B1 | — | Done |
| B8 · ETL table, sugarcane citation re-verified against the NIPHM PDF | **DELIVERED** — see B8 | — | Done |
| B4 · Code-verified aggregation rule and thresholds | **DELIVERED** — see B2, B4 | — | Done |
| B2 · Re-verification of `T_CAL = 0.597` | **DELIVERED** — valid, see B2 | — | Done |
| B8 · Wheat and Rice NIPHM page-number re-check | **PENDING** (low impact — neither yields a number) | Ahsan | **16 Sep** |
| B1 · Verified Hindi disease names | **CANNOT** | Needs an agriculture-literate reviewer | Best-effort, marked `UNVERIFIED` |
| `aggregate_frame` default/config threshold mismatch (B2) | **OPEN DEFECT** | Ahsan + Antigravity | Fix before the pipeline caller is written |
| F5 · Full `template_id` list with English strings and params | **PENDING** | Ahsan + Antigravity | **17 Sep** |
| B6 · Absolute cited bands for RGB indices | **CANNOT — ever, at this budget** | — | Relative bands supplied instead, see B6 |
| B11 · NDVI values | **CANNOT** | Hardware-gated | Stays `GATED_HARDWARE_CALIBRATION` |
| A10 · Media endpoint | **Likely out** | Ahsan | Confirm by **18 Sep** |
| C1 · WiFi adapter status | **PENDING** | Ahsan | Fill in before sending |
| C5 · ID strings ratified | **PENDING** | Ahsan | Before sending |
| C7 · Android phone | **PENDING** | Ahsan | Urgent — blocks E1 |
| D4 · Supabase in/out | **PENDING** | Ahsan | **15 Sep** |
| E5 · Bench slot with the Jetson | **Offered** | Both | **17 Sep**, 30 min |

---

# §10 · Questions back to you

Answer by ID, same convention.

**Q1.** §0 — can you update your source document and re-brief your drafting
assistant, so the drone does not reappear in the next revision? And separately: now
that the architecture change is written into the contract, what does it actually
cost you on the app side?

**Q2.** S1 — rename `flight` to `scan`, or keep the key name with corrected contents?
Your renderer, your cost.

**Q3.** S3 — can you build a detection map in the time left? If not, we will still
emit `detections[]` so it is in the frozen schema.

**Q4.** A3 — can you migrate the cursor to integer `seq`? The string form will keep
working, but it inherits every ordering problem you identified.

**Q5.** A1 — is a shared JSON Schema draft-07 file acceptable as the source of truth,
or would you rather we port `validate.ts` to Python line-by-line? Either works. The
Jetson is Python 3.6 and cannot run TypeScript.

**Q6.** B11 — which string did you actually implement, `PENDING_HARDWARE_FINALIZATION`
or `GATED_HARDWARE_CALIBRATION`? We must not ship two.

**Q7.** **What is the minimum advisory you can render?** If we run out of time, we
need to know which fields to prioritise. If you can render with only `crop_health`,
`disease[]`, `actions[]` and `inputs[]` populated and everything else `null` +
reason, say so — it changes what we build first, and it is probably the most useful
answer you can give us today.

**Q8.** Would you build a **file-import path** as insurance against E1? A `.json`
picked from storage or received via share intent, ingested exactly as a synced
advisory would be but tagged `fixture` or a fourth origin. If E1 slips, this is the
difference between a demo and no demo.

**Q9.** Do you want `GET /api/v1/advisory/latest` as a convenience endpoint? Trivial
for us, and it may simplify your first-run path.

**Q10.** What is the app's **cold-start state** with zero advisories and no network?
A judge may open it before the first sync, and that screen is the first thing they
see.

**Q11.** C1 — are you designing the connection screen for "AP always up" (two
dongles) or "AP drops for 20–30 s during node collection" (one dongle)? Your answer
decides a ₹600 purchase and we would rather buy the right thing.

**Q12.** Project name: your document says **AEGIS**. Ours say **SIH** and older ones
say **PRISM**. **Pick one before the PPT.** A judge seeing three names across the
app, the report and the slides will ask, and there is no good answer.

---

# Appendix A · Every unconfirmed constant in the system

**This is the complete register, read from code on 14 September.** It is here because §7.3 rule 2 says every threshold you display must carry its provenance, and because you asked for `PROVISIONAL` to be marked rather than left blank. Now you can see exactly how much of the system is provisional — which is a lot, and which is normal for a field-calibrated agronomic system six days from submission.

**A naming note that matters for the schema mapping:** there is **no string anywhere in the codebase whose value is literally `"PROVISIONAL"`.** The convention is a `PROVISIONAL_*` **identifier prefix** with provenance in an adjacent comment. **The gateway must translate that convention into the `threshold_source` / `threshold_confirmed` schema fields** — the same mapping gap named in B8. Until it does, those fields are unpopulated.

### Reaches the app directly

| Constant | Value | File | Status |
|---|---|---|---|
| `PROVISIONAL_EXG_VEG_THRESHOLD` | 20 | `core/indices.py:37` | Tuned against synthetic and field tiles. **Explicitly "not from published literature."** |
| `PROVISIONAL_MIN_CANOPY_FRACTION` | 0.15 | `core/indices.py:34` | Engineering judgement |
| `PROVISIONAL_BIMODAL_GAP_C` | 4.0 °C | `core/thermal.py:48` | **UNMEASURED** |
| `PROVISIONAL_OTSU_MIN_INTERCLASS_VARIANCE_RATIO` | 0.85 | `core/thermal.py:67` | **UNMEASURED** — set from an 80-combination parameter sweep, not field data |
| `PROVISIONAL_PANEL_REFLECTANCES` | (0.05, 0.50, 0.84) | `core/ndvi.py:67` | Recalled nominal values, unverified. `PANEL_REFLECTANCES_CONFIRMED = False` |
| `MM_PER_PIXEL` | `None` | `core/trap_segmentation.py:26` | **Blocks all pest counting.** Guarded by `RuntimeError` |
| `PROVISIONAL_MARKER_SPACING_W_MM` / `_H_MM` | 80.0 / 55.0 mm | `core/trap_segmentation.py:38-39` | Must be measured with calipers on the printed cards |
| `PROVISIONAL_MAX_CARD_SATURATION` | 0.30 | `core/trap_segmentation.py:34` | Engineering judgement |
| `PROVISIONAL_TREND_RISING_RATIO` / `_FALLING_RATIO` | 1.50 / 0.67 | `core/trap_segmentation.py:44-45` | Engineering judgement — drives the pest **trend** arrow you may render |

### Reaches the app through FAO-56 and AWD numbers

Every value below is `derived` from an unmeasured parameter, and **B10's `threshold_confirmed: false` covers all of them.**

| Constant | Value | File | Status |
|---|---|---|---|
| `PROVISIONAL_PADDY_PERCOLATION_MM_DAY` | 5.0 mm/day | `edge/irrigation_model.py:119` | **"Secondary search recall … NOT from primary in-situ soil measurements on the target field"** — the code says this itself |
| `PROVISIONAL_PADDY_PERCOLATION_BY_SOIL` | clay 4.0 / loam 6.0 / sand 8.0 | `:120-124` | Same |
| `PROVISIONAL_PADDY_SATURATION_MM` | 200.0 mm | `:117` | Same |
| `PROVISIONAL_AWD_REIRRIGATION_DEFICIT_MM` | 40.0 mm | `:137` | **Read the note below** |
| `PROVISIONAL_AWD_REFILL_DEPTH_MM` | 50.0 mm | `:138` | Secondary recall, primary source unverified |
| `PROVISIONAL_IRRIGATION_EFFICIENCIES` | drip 0.90 / sprinkler 0.75 / furrow 0.60 | `:98-102` | Requires site-specific distribution uniformity audit |
| `PROVISIONAL_V_DRY` / `PROVISIONAL_V_WET` | 3.00 V / 1.20 V | `edge/adc.py:80-81` | Soil probe calibration, uncalibrated against gravimetric samples |

**The AWD note is worth reading in full, because it is the most honest comment in the codebase and it is good judge material.** IRRI's safe-AWD standard is a water table **15 cm below the surface inside a perforated field tube** — not a millimetre deficit. Converting one to the other requires the soil's drainable porosity, which **has not been measured for this field.** The code says outright that 40.0 mm is "our own engineering conversion under an assumed, unmeasured drainable porosity (~0.27)."

That is exactly the disclosure your rule-2 rendering exists for. **Any AWD advice must render as provisional.**

### Does not reach the app

| Constant | Value | File | Note |
|---|---|---|---|
| `PROVISIONAL_EXPOSURE_NS` | 10 ms | `edge/camera.py:47` | **"UNTESTED default."** Previously flagged as a blur risk; the fix is 1–2 ms plus vibration damping, and it has not been validated on hardware |
| `PROVISIONAL_GAIN` / `_DIGITAL_GAIN` | 1.0 / 1.0 | `edge/camera.py:48-49` | UNTESTED |
| `PROVISIONAL_SATURATION_THRESHOLD_DN` | 250 | `edge/camera.py:52` | |
| `PROVISIONAL_MAX_IRRIGATION_DURATION_S` etc. | — | `edge/actuation.py:39-42` | **Out of scope.** Actuation dropped 7 Sep; retained as reference implementation only |
| `PROVISIONAL_YF_S201_*` | — | `edge/flow.py:39-40` | Out of scope, same reason |

**Note for a judge who spots the actuation code:** it is validated, tested, and deliberately not wired to anything, because we dropped autonomous irrigation. It is kept as evidence of the fail-safe design, not as a live path.

---

# Appendix B · Honest current state of the system, 14 September 2026

Included because you are building against this and deserve to know what is real.

### Works and is verified

- **Trained classifier.** EfficientNet-Lite0, 29 classes, V3 (50 epochs, best epoch
  27, ~26,500 training images).
- **Evaluated.** `test_indist` macro-F1 **94.85%**. `test_sourceheldout` **37.40%**.
  Both numbers are real and both go on the slide.
- **Calibrated.** `TAU_ENERGY = -2.8529`, `T_CAL = 0.597`, fitted in Step 15.
- **Exported.** `model_a_sim.onnx`, static batch 9, opset 13, uint8 BGR input.
  Channel-order red-flag check passed at 7.15e-6 difference — versus 0.729 if the
  BGR→RGB swap were omitted, which is the check catching a real bug class. End-to-end
  macro-F1 delta against the reference pipeline: **0.000000** across 3,320 validation
  images.
- **`core/` modules**: aggregate, rejection, thermal, trap segmentation, RGB indices,
  NDVI (gated). All tested.
- **A cited ETL registry** — 15 taxa, with the sugarcane threshold re-verified against
  the NIPHM primary source this week, and twelve entries honestly carrying no number.
- **165 tests passing.**
- **Dataset governance**: cross-dataset perceptual-hash dedup across 72,395 hashes;
  several candidate datasets rejected outright for being scraped from datasets we
  already held (one was 99% duplicated). Documented in `DATASET_PROVENANCE.md`.

### Does not exist yet

- Camera capture loop — `cv2.VideoCapture` is never called anywhere
- Live-frame tiling
- GPS / NMEA parser
- `edge/storage.py` — no SQLite, nothing is persisted
- HTTP server — `gateway/__init__.py` is 0 bytes
- The TensorRT engine — script written, never run
- Rules engine templates and `actions[]` emission
- Any image retention logic

### Physical state

- Jetson Nano flashed on 13 Sep. Not yet booted, not yet verified.
- Most hardware ordered this week; nothing assembled.
- **The single highest-risk step in the whole project — building the TensorRT engine
  on the Nano — has not been attempted.** It was scheduled for day 4 of the plan and
  it is now day 12. If it fails there is not much recovery time.

### Known open defect

`core/aggregate.py`'s function defaults (`tau_disease=0.55`, `tau_margin=0.10`)
disagree with the calibrated config values (0.4, 0.15). No caller exists yet, so it
has not bitten — but the caller is being written this week. Fix plus a regression
test is on the build list. Named here rather than left in a commit message.

### The six-day plan

1. Boot the Nano, verify TensorRT 8.2 / CUDA 10.2 / compute capability 5.3
2. Build the TensorRT engine — **highest risk, do first**
3. Camera capture loop and live tiling
4. `edge/storage.py` — SQLite
5. HTTP server — the four endpoints in this document
6. Rules engine templates → `actions[]`
7. **E5 conformance check with you, 17 Sep**
8. Integration and failure rehearsal

**Items 4 and 5 are the ones that decide whether your app has anything to talk to.**
They are being prioritised accordingly.

---

*End of reply. Questions to Ahsan. The class list, thresholds, aggregation rule and ETL registry in this document were read verbatim from code on 14 September — they are not recalled, and every one carries a file path and line number you can check.*
