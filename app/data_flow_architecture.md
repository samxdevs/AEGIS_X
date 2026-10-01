# Connectivity & Data Flow Architecture

**Project:** SIH 2026 — Edge-deployed smart farming assistant
**Document owner:** Ahsan
**Status:** Draft for team review. Contains DECIDED, PROPOSED, and OPEN items — read the labels.
**Canonical location:** `sih-smart-farming/docs/`

---

## 0. How to read this document

Every claim in here is tagged. This is deliberate — we have been burned before by
estimates that got quoted later as if they were measurements.

| Tag | Meaning |
|---|---|
| **DECIDED** | Settled. Build against this. |
| **PROPOSED** | My recommendation with reasoning. Needs one person to say yes. |
| **OPEN** | We genuinely do not know yet. Listed in §12. |
| **ESTIMATE** | Calculated from datasheets or arithmetic. **Never measured.** Do not quote as a measurement. |

If you are on the app team, the sections you need are **§6, §7, §9, §14**. The rest
is context.

---

## 1. Scope and assumptions

**Physical inventory on the farm. Nothing else exists.**

1. One or more **ground nodes** (single pole each). For the demo: exactly one.
2. One **drone** carrying a Jetson Nano 4GB and two IMX219-NoIR cameras.
3. The **farmer's phone**.

Explicitly absent, and the architecture must survive their absence:

- No internet. No cellular backhaul assumed. No cloud. No remote database.
- No laptop or PC on the farm.
- No mains power at the node.
- No always-on link between any two devices.

**Out of scope as of this build:** irrigation actuation (advisory only).

**Still in scope, hardware pending:** NDVI. The optical path (filter selection) and
the `calib_matrix` derivation are both being finalised. The code path exists and
raises `NotImplementedError` rather than returning an uncalibrated number — that is
a correctness guard on an unfinished input, **not a cancelled feature.** Schema,
API, and UI must carry NDVI as a first-class field from day one so that nothing
downstream changes when the hardware lands.

---

## 2. The shape of the system

Three tiers. Each tier stores its own data permanently. Each pair of tiers syncs a
**delta** when they happen to be near each other. No two devices ever need to be
online at the same moment for the system as a whole to keep working.

```
   TIER 1                    TIER 2                      TIER 3
 GROUND NODE               DRONE / JETSON               FARMER'S PHONE
 (continuous)              (per flight)                 (whenever)

 +-------------+           +----------------+           +-------------+
 | MLX90640    |           | 2x IMX219-NoIR |           |   SIH app |
 | SHT31       |           | EfficientNet   |           |   local DB  |
 | ESP32-CAM   |           | Lite0 / TRT    |           |   history   |
 | DS3231 RTC  |           | indices, CWSI  |           |   advisory  |
 | SD card     |           | FAO-56, fusion |           |   UI        |
 +-------------+           | SQLite (SoR)   |           +-------------+
        |                  +----------------+                  ^
        |                        ^      |                      |
        |   WiFi, node = AP      |      |  WiFi, Jetson = AP   |
        +------------------------+      +----------------------+
             Jetson PULLS                     Phone PULLS
          (on the ground, pre/post flight)   (after landing)
```

**Direction of travel matters.** In both hops, the device with more power and more
storage is the **client that pulls**, and the constrained device is the **passive
server**. Reasons in §5.1 and §6.1.

**The Jetson's SQLite file is the system of record.** It is the only place where node
data, flight imagery, and model outputs coexist. The phone holds a replica for
viewing. The node holds a raw buffer.

---

## 3. Why store-and-forward, and not live streaming

**DECIDED.**

The obvious-looking design is: node transmits continuously, drone listens, drone
relays to phone in real time. We are not doing that. Reasons, in order of weight:

1. **Nothing needs to be real time.** CWSI is a diurnal measurement — it is
   meaningful in a window around solar noon, and its baseline takes two weeks to
   initialise. Sticky-trap thresholds are counts *per trap per day*. FAO-56 operates
   on daily soil water depletion. Not one output in our pipeline changes if the data
   arrives four hours late.

2. **Continuous transmission kills the node.** The node is battery/solar. A WiFi
   radio that is always associated and always awake is the single largest current
   draw in the design. Duty cycling is what makes a season-long deployment possible.

3. **Live links fail silently.** A dropped packet in a stream is data lost forever.
   A failed sync against a persistent buffer is retried on the next contact, and
   nothing is lost.

4. **It is a named, defensible pattern.** This is *delay-tolerant networking* with a
   UAV acting as a **data mule**. It is standard in wireless sensor networks for
   exactly our situation: sparse nodes, no backhaul, an occasional mobile collector.
   Say this phrase to judges. It signals we chose an architecture rather than
   improvised one.

The cost of this choice is honest and small: **advisories are as fresh as the last
flight.** Every advisory carries per-input age (§7.3) so nobody mistakes a
three-day-old thermal reading for this morning's.

---

## 4. Tier 1 — The ground node

### 4.1 Physical layout

**DECIDED** (from hardware finalisation):

- Single pole. Build 3 m for wheat/rice.
- **MLX90640** (55° FOV) on a sideways boom, ≥1.2 m out, pointing **nadir**,
  1.2–1.5 m above canopy.
- **Sticky trap + ESP32-CAM** at canopy top, on the **opposite side** of the pole
  from the thermal boom.
- **SHT31 in a radiation shield, in air.** Not buried.

The opposite-side placement is not cosmetic — it keeps the trap and its camera out
of the thermal array's field of view. A sticky card inside the MLX90640 FOV would
contaminate the canopy temperature distribution that Otsu cool-mode extraction
depends on.

### 4.2 What each sensor produces

| Sensor | Output | Proposed cadence | Bytes/reading (ESTIMATE) |
|---|---|---|---|
| MLX90640 | 32×24 = 768 px thermal frame | Every 10 min, 10:00–15:00; hourly otherwise | 1,536 (int16 centi-°C) |
| SHT31 | air temp + RH | Every 5 min | ~24 |
| ESP32-CAM | sticky trap JPEG, 1600×1200 | 2×/day | ~180,000 (ESTIMATE, q≈12) |
| DS3231 | timestamp on every record | — | 8 |

**PROPOSED — the node stores raw frames, not summaries.**

It is tempting to have the ESP32 compute a mean canopy temperature and send one
float. Do not. Otsu cool-mode extraction and the Ta+15 °C biophysical gate live in
`core/` on the Jetson, they are tested there, and they are the parts a judge will
ask about. Duplicating that logic onto an ESP32 in C would create a second,
untested implementation of our science. **The node is dumb: capture, timestamp,
store, serve.** All interpretation happens exactly once, on the Jetson.

### 4.3 Storage

Append-only files on the ESP32-CAM's SD card, plus a manifest index.

```
/data/
  manifest.json          # index: seq -> {type, ts, path, bytes, sha1_prefix}
  thermal/000123.bin
  ambient/2026-09-08.ndjson
  trap/000045.jpg
```

Every record gets a **monotonic sequence number** (`seq`). `seq` never resets and
never reuses. This is what makes resumable, idempotent sync possible — see §5.3.

**Records are never deleted on acknowledgement.** The Jetson's ACK advances a
cursor; it does not free storage. Deletion happens only when the card fills, oldest
first, and only after the record's `seq` is below the acknowledged cursor. Buffer
math in §8 shows we will never reach that point in a season.

### 4.4 Power and duty cycle

**OPEN — no power budget exists yet. This is the largest unquantified risk in the
node design.**

Datasheet-order draws, for scale only (**ESTIMATE, bench verification required**):

- ESP32 WiFi transmitting: ~160–260 mA peak
- ESP32 deep sleep: ~10 µA bare module, but ESP32-CAM boards leak considerably
  more (~1–6 mA) through the on-board regulator
- MLX90640: ~23 mA active, ~8 µA standby
- SHT31: ~1.5 mA measuring, sub-µA idle

The regulator leakage on ESP32-CAM boards is the number that decides whether this
runs a week or a season. Somebody needs to put a meter on it.

---

## 5. Tier 1 → Tier 2 — Node to drone

### 5.1 The link decision

**DECIDED: WiFi. The node runs a SoftAP and an HTTP server. The Jetson associates
as a client and pulls.**

Alternatives considered and why they lost:

| Option | Why not |
|---|---|
| **Bluetooth / BLE** | Range and throughput both inadequate. Correctly ruled out. |
| **ESP-NOW** | 250-byte payload cap. A 180 KB trap JPEG becomes ~750 fragments needing hand-rolled retry/reassembly. Also the Jetson cannot speak ESP-NOW natively — it would need a second ESP32 as a UART bridge. Real work, for a link we do not need. |
| **LoRa** | Kilometre range but a few kbps. Fine for a heartbeat, hopeless for images. And the phone cannot receive LoRa without extra hardware, which breaks our three-device inventory. |
| **WiFi, node as AP** ✅ | Full TCP/IP. Plain HTTP GET. Resumable via HTTP Range. Ample throughput. Zero extra hardware on the node. |

**Why the node is the AP and the Jetson is the client** (this is the reversal from
the original "node transmits to drone" framing):

1. **The node does not need to know the drone exists.** It wakes, serves anything
   asked of it, sleeps. No discovery logic, no retry state machine, no knowledge of
   flight schedules on a device with 4 MB of flash.
2. **The Jetson knows what it already has.** Only the collector can compute the
   delta. A pushing node would either re-send everything or maintain per-collector
   state.
3. **Flow control belongs with the client.** The Jetson can pause, resume, retry,
   and re-order. A pushing node blasting at a possibly-absent receiver cannot.
4. **It scales to N nodes trivially.** SSIDs `SIH-NODE-01 … NN`. The Jetson scans
   for the `SIH-NODE-*` prefix and works through them one at a time.

### 5.2 When sync happens

**PROPOSED, and I want this one argued about because it is the biggest simplification
available to us.**

**Sync on the ground, with motors disarmed — not in flight.**

- **Pre-flight:** drone is powered on at the launch point beside the node. Jetson
  pulls the backlog. Takes seconds (§8).
- **Post-flight:** drone lands. Jetson pulls anything logged during the flight, then
  runs fusion.

Why not hover-sync over each node:

1. **Nothing needs node data mid-flight.** The in-flight job is RGB capture,
   EfficientNet-Lite0 inference, and vegetation indices. CWSI comes off the *mast*,
   not the drone. Trap counts come off the *node camera*. All fusion is post-flight.
   There is no in-flight consumer of node data at all.
2. **Radio safety.** Most hobby RC links are 2.4 GHz frequency-hopping across the
   whole band. ESP32 is 2.4 GHz only. Running a WiFi association during flight puts
   our data link in the same band as our sole control path. Doing it disarmed on the
   ground makes the problem disappear at zero cost. See §10.
3. **Battery.** Hovering to sync spends flight time on something that works better
   parked.

For a multi-node field this generalises: land near each node, or walk the drone.
For a large deployment, hover-sync becomes worth engineering. **It is the scale-up
story, not the demo.**

### 5.3 The rendezvous problem

If the node deep-sleeps to save power, it cannot hear the Jetson.

**PROPOSED — fold rendezvous into the sensing cadence.** The node already wakes
every 5 min for an SHT31 reading. Extend that wake by a fixed **listen window**
(propose 20–30 s) with the SoftAP up. The Jetson arrives, waits at most one wake
period, and syncs.

This is elegant because sensing and rendezvous become the same event — no separate
schedule to keep aligned, no clock agreement needed between node and drone.

**For demo day:** add a physical push-button on the node that forces a 5-minute
awake window. Removes all rendezvous timing risk from the live demonstration.

### 5.4 Node HTTP API

**PROPOSED.** Node serves at `192.168.4.1:80` (ESP32 SoftAP default).

```
GET  /status
     -> {"node_id":"07","fw":"1.2.0","rtc_utc":"2026-09-08T09:14:22Z",
         "rtc_valid":true,"batt_mv":3920,"sd_free_kb":29847,
         "seq_min":1,"seq_max":4471,"awake_until_ms":18300}

GET  /manifest?since=<seq>&limit=<n>
     -> {"records":[
          {"seq":4470,"type":"thermal","ts":"2026-09-08T09:10:00Z",
           "bytes":1536,"sha1":"a3f9c1"},
          {"seq":4471,"type":"ambient","ts":"2026-09-08T09:14:00Z",
           "bytes":24,"sha1":"77b201"}
        ],"seq_max":4471,"truncated":false}

GET  /record/<seq>
     -> raw bytes. MUST support HTTP Range for resume.

POST /ack {"upto_seq": 4471}
     -> advances the node's synced cursor. Does NOT delete.
```

**Integrity:** every record carries a SHA-1 prefix in the manifest. The Jetson
verifies after transfer and re-requests on mismatch. A truncated trap JPEG that
silently becomes a blob-detection input is exactly the class of defect that our
green test suites would not catch.

---

## 6. Tier 2 — The drone / Jetson Nano

### 6.1 What the Jetson does, in order

1. **Pre-flight sync.** Pull node backlog (§5).
2. **Fly.** Two-tier pass: high-altitude survey for field-scale vegetation health,
   then close-range inspection for disease classification. Capture only.
3. **Land.**
4. **Post-flight sync.** Pull anything the node logged during flight.
5. **Process.** Vegetation indices (VARI / ExG / TGI / DGCI), EfficientNet-Lite0
   classification via TensorRT FP16, CWSI from mast thermal, FAO-56 from soil water
   depletion, trap blob detection + gateway CNN.
6. **Fuse and rank.** Produce one advisory record.
7. **Write to SQLite.** This is the commit point. Nothing exists until it is in the
   database.
8. **Raise AP, serve to phone.**

### 6.2 The system of record

**DECIDED: SQLite on the Jetson's SD card. No cloud, no server, no remote database.**

Why SQLite and not files or a "real" database:

- Single file. Backs up by copying.
- Transactional. A power cut mid-write does not corrupt the store — which matters
  on a device that gets its power pulled by unplugging a battery.
- Present in JetPack already, and available on Android and iOS for the phone-side
  replica. Same schema on both ends of the sync.

**To answer the question directly: we do not need cloud storage at any point, and
we should not add one.** The Jetson holds the full history. The phone holds a
replica. Offline is not a degraded mode we tolerate — it is the only mode, and the
system was designed for it. That is a *feature* to present, not a limitation to
apologise for.

### 6.3 Time synchronisation — read this one

**This is a finding, and it is the kind that fails quietly.**

No internet means no NTP. Neither the ESP32 nor the Jetson Nano dev kit keeps time
across a power cycle without added hardware. An ESP32 that boots to
`1970-01-01T00:00:00Z` will happily timestamp a thermal frame, and that frame will
look completely valid downstream.

**CWSI is a diurnal measurement.** A canopy temperature reading whose timestamp is
wrong is not slightly degraded — it is meaningless, because we cannot know where in
the day it sat. And it will not look wrong. It will look like data.

**PROPOSED:**

1. **DS3231 RTC on every node** (~Rs 150, battery-backed, ±2 ppm ≈ ±63 s/year).
   This is authoritative for node records.
2. **Jetson takes time from GPS** — via the flight controller over MAVLink, or a
   standalone module. GNSS time is exact and needs no infrastructure. Authoritative
   for flight records.
3. **On every contact, log both clocks. Never silently overwrite either.** The
   `/status` response carries `rtc_utc`; the Jetson records its own GPS time
   alongside. Drift becomes a measurable, auditable quantity rather than a hidden
   corruption.
4. **`rtc_valid: false` propagates.** If a node lost RTC battery, every record it
   produces after that point is flagged, and any advisory consuming those records
   carries the flag through to the app. A degraded input must be visible at the UI,
   not absorbed silently in the middle of the pipeline.

Point 4 is a direct application of failure pattern #3 — a guard that exists at the
leaf but is defaulted off upstream is not a guard.

### 6.4 Hardware gap

**OPEN — the Jetson Nano 4GB dev kit ships with no WiFi.** The B01 carrier has an
empty M.2 Key E slot. Options:

- Intel AC8265 M.2 card (~Rs 2,500–3,500, **ESTIMATE**) — dual band, well supported
  on JetPack 4.6.4, needs antennas mounted.
- USB WiFi dongle with external antenna (~Rs 500–800, **ESTIMATE**) — cheaper,
  faster to source, one USB port consumed. Verify the chipset has an in-tree driver
  for L4T's 4.9 kernel before buying; RTL8188/8812 family generally does.

**Given procurement lead times, the USB dongle is the safer buy.** This needs
ordering now — it is on the critical path for any live demonstration and it is
currently the only piece of the connectivity story with no hardware behind it.

---

## 7. Tier 2 → Tier 3 — Drone to farmer's phone

### 7.1 The link

**PROPOSED: after landing, the Jetson raises its own WiFi AP** (`hostapd` +
`dnsmasq`) and serves the API over it. The phone joins that SSID.

```
SSID:  SIH-FIELD
Sec:   WPA2-PSK
Jetson: 192.168.4.1
API:   http://192.168.4.1:8080/api/v1/...
```

Alternative considered: Jetson joins the *phone's* hotspot. Rejected — it requires
per-farmer SSID/password configuration on the Jetson, and drains the phone battery.
Jetson-as-AP means the phone is configured once, by joining a network.

### 7.2 What happens when the phone is out of range

**Nothing is lost, and nothing special happens.** This is the same delay-tolerant
pattern as §3, one hop further along.

- The advisory was committed to the Jetson's SQLite **before** the AP came up. It
  exists whether or not anyone connects.
- The phone maintains a **sync cursor**. On next connection it pulls everything
  since that cursor, however many flights that spans.
- The AP can stay up as long as the drone has power, or be raised on a button
  press to save battery.

In practice this case barely arises: the drone lands, and somebody physically walks
over to collect it. The phone is present because the farmer is present. But the
design does not *depend* on that being true, and the app must not assume a fresh
advisory is ever waiting.

**Optional, cheap, good demo value:** the node also serves its own `/status` and
last-readings over its AP. A farmer walking the field can join `SIH-NODE-01` and
see live temperature/humidity without the drone existing at all. Roughly free —
the AP and HTTP server are already there for §5.

### 7.3 The advisory schema

**PROPOSED. App team: this is your contract. Push back on it now, not in week three.**

```jsonc
{
  "advisory_id": "2026-09-08T14:32:11Z_F01",
  "schema_version": "1.0",
  "field_id": "F01",
  "generated_at_utc": "2026-09-08T14:32:11Z",
  "generated_by": {"device":"jetson-nano-01","gps_time_valid":true},

  "flight": {
    "started_utc": "2026-09-08T13:58:02Z",
    "survey_images": 84,
    "inspection_images": 31
  },

  "inputs": [
    {"name":"mast_thermal","source_node":"07",
     "latest_sample_utc":"2026-09-08T13:10:00Z","age_hours":1.4,
     "status":"OK","rtc_valid":true},
    {"name":"ambient","source_node":"07",
     "latest_sample_utc":"2026-09-08T14:25:00Z","age_hours":0.1,
     "status":"OK","rtc_valid":true},
    {"name":"sticky_trap","source_node":"07",
     "latest_sample_utc":"2026-09-06T08:00:00Z","age_hours":54.5,
     "status":"STALE","rtc_valid":true}
  ],

  "vegetation": {
    "vari": {"mean":0.31,"p10":0.12,"p90":0.44,"source":"measured"},
    "exg":  {"mean":0.28,"source":"measured"},
    "tgi":  {"mean":14.2,"source":"measured"},
    "dgci": {"mean":0.61,"out_of_domain_fraction":0.04,"source":"measured"},
    "ndvi": null,
    "ndvi_status": "PENDING_HARDWARE_FINALIZATION",
    "ndvi_reason": "Optical path and calib_matrix in progress. Field reserved; not estimated."
  },

  "disease": [
    {"class":"rice_bacterial_leaf_blight","confidence":0.88,
     "n_inspection_crops":6,"source":"measured"}
  ],

  "pest": [
    {"taxon":"sugarcane_whitefly","count_per_trap_per_day":42,
     "threshold":100,"threshold_source":"NIPHM Sugarcane.pdf p.11",
     "threshold_confirmed":true,"status":"BELOW_THRESHOLD",
     "input_age_hours":54.5,"source":"measured"}
  ],

  "water": {
    "cwsi": null,
    "cwsi_status": "BASELINE_INITIALIZING",
    "cwsi_days_remaining": 9,
    "fao56": {"depletion_mm":21.4,"ks":0.92,"source":"derived"}
  },

  "actions": [
    {"rank":1,"action":"...","rationale":"...",
     "confidence":"medium","advisory_only":true}
  ],

  "notes": ["Irrigation actuation is out of scope. All actions are advisory."]
}
```

**Four schema rules, each traceable to one of our four failure patterns:**

1. **Absence is `null` plus a machine-readable reason.** Never a plausible default,
   never zero, never an interpolated guess. If we did not measure it, the app must
   be able to tell, and must display it as not measured. *(Pattern #1 — fabricated
   measurements presented as measured.)*

2. **Every threshold carries `threshold_source` and `threshold_confirmed`.** Our
   `PROVISIONAL_*` convention has to survive the trip to the UI. An unconfirmed
   number rendered identically to an ICAR-sourced one is citation drift happening
   in the presentation layer. *(Pattern #2.)*

3. **`inputs[]` is mandatory and complete.** Every advisory declares what it was
   built from and how old each piece was. A staleness guard on the Jetson that the
   app cannot see is a guard defaulted off at the boundary. *(Pattern #3.)*

4. **`source` on every numeric field**: `measured` | `derived` | `provisional`.
   Cheap to emit, and it makes the app incapable of presenting a derived quantity
   as an observation.

### 7.4 Phone API

```
GET  /api/v1/health              -> liveness, storage, advisory count
GET  /api/v1/manifest?since=<cursor>
                                 -> advisory ids + generated_at + size
GET  /api/v1/advisory/<id>       -> the JSON above
GET  /api/v1/media/<id>?size=thumb|full
                                 -> inspection crops, trap images, index maps
POST /api/v1/ack {"upto":"<id>"} -> advance phone cursor
```

Same shape as the node API on purpose. One sync algorithm, written once, used at
both hops.

---

## 8. Volume and timing budget

**All ESTIMATE. Assumptions shown so they can be checked and corrected.**

**Per node per day:**

| Stream | Arithmetic | Total |
|---|---|---|
| Thermal | 31 frames (10-min, 10:00–15:00) + 12 hourly ≈ 43 × 1,536 B | ~65 KB |
| Ambient | 288 × 24 B | ~7 KB |
| Trap JPEG | 2 × ~180 KB | ~360 KB |
| **Total** | | **~430 KB/day** |

**Buffer life:** at ~0.5 MB/day, a 32 GB SD card holds decades. Storage is a
non-issue. Even a 1 GB card covers five years. **Nothing about this design is
storage-constrained** — do not let anyone spend money solving that problem.

**Transfer time** (assuming ESP32 SoftAP + SD-over-SPI sustains ~400 KB/s, which is
**unmeasured and the weakest number in this table**):

| Backlog | Transfer | + association (~3 s) |
|---|---|---|
| 1 day (~430 KB) | ~1.1 s | **~4 s** |
| 7 days (~3 MB) | ~7.5 s | **~11 s** |
| 30 days (~13 MB) | ~33 s | **~36 s** |

Comfortable at every scale we care about. Bandwidth is not a constraint either.

**What this budget tells us:** the real constraints in this design are **node power**
(§4.4), **time integrity** (§6.3), and **rendezvous reliability** (§5.3). Not
bandwidth, not storage. Effort should go there.

---

## 9. Failure modes

| Failure | Behaviour | Handled by |
|---|---|---|
| Phone out of range at landing | Advisory already committed to SQLite. Phone pulls on next connection. | §7.2 cursor |
| No flight for a week | Node buffers. Next sync pulls the full backlog in ~11 s. | §8 |
| Node asleep when drone arrives | Jetson waits ≤ one wake period (~5 min), or operator presses the wake button. | §5.3 |
| Transfer interrupted mid-record | HTTP Range resume from last byte. `seq` cursor unchanged, so nothing is skipped. | §5.4 |
| Corrupted record | SHA-1 mismatch → re-request. Never enters the pipeline. | §5.4 |
| Node battery dead | Last `seq` stops advancing. Jetson sees growing `age_hours`, marks input `STALE`, then `MISSING`. Advisory still generated from available inputs, with the gap declared. | §7.3 `inputs[]` |
| Node RTC battery dead | `rtc_valid:false` propagates to the advisory and to the UI. Thermal records from that period are excluded from CWSI. | §6.3 |
| CWSI baseline not yet built | `cwsi: null`, status `BASELINE_INITIALIZING`, days remaining shown. **No number is ever emitted during the window.** | §7.3 |
| Jetson SD full | Oldest media pruned first; advisory JSON retained (tiny). | **OPEN** — retention policy not written |
| Two drones, one node | ESP32 SoftAP accepts ~4 clients but sync is designed single-client. Out of scope. | — |

---

## 10. Radio plan

**OPEN — depends on what the RC and telemetry links actually are. Somebody needs to
confirm this.**

The concern: ESP32 is **2.4 GHz only**. Most hobby RC links (FrSky ACCST/ACCESS,
Spektrum DSMX) are 2.4 GHz frequency-hopping across the entire band, so no channel
choice avoids them. Telemetry radios are often 865–867 MHz in India, which is clear.

**PROPOSED mitigation, which costs nothing:** because we sync on the ground with
motors disarmed (§5.2), our WiFi and the flight-critical control link are never
active at the same time. The interference question is designed out rather than
managed.

If hover-sync is ever revisited for scale, this becomes a real analysis with real
range testing — not an assumption.

---

## 11. Security

Modest, and appropriate to the threat model (a physical field, a demo, no PII).

- **WPA2-PSK on both APs.** Node PSK derived from node ID + a project secret; a
  single project PSK is acceptable for the demo.
- **HTTP, not HTTPS.** TLS on an ESP32 for a link that exists for ten seconds at a
  time, inside a WPA2 tunnel, is not worth the flash or the certificate management.
  State this as a considered decision if asked — not an oversight.
- **No PII anywhere in the schema.** No names, no phone numbers, no precise
  homestead location. Field IDs only.
- **Physical access is the real exposure.** Anyone who can reach the pole can take
  the SD card. Not solvable in scope; worth acknowledging.

---

## 12. Open decisions and procurement

Ordered by how badly they block us.

| # | Item | Why it matters | Owner |
|---|---|---|---|
| 1 | **Jetson WiFi hardware** — USB dongle or M.2 AC8265 | No connectivity demo is possible without it. Nothing else on this list matters if this is not ordered. | Hardware |
| 2 | **MLX90640 55° FOV** (~Rs 7,250, ThinkRobotics) | Already identified as must-buy. No thermal = no CWSI = no water tier. | Hardware |
| 3 | **DS3231 RTC** (~Rs 150/node) | Without it, timestamps are fiction and CWSI is meaningless (§6.3). Cheapest high-impact item on the list. | Hardware |
| 4 | **RC / telemetry frequencies** confirmed | Determines whether §10 is closed or open. | Hardware |
| 5 | **One ESP32 or two per node?** | ESP32-CAM is GPIO-starved and the camera peripheral is demanding. A second plain ESP32 (~Rs 350) for MLX90640 + SHT31 over I2C may be more robust than fighting pin conflicts. Needs a bench call. | Hardware |
| 6 | **Node power budget** | Unquantified. Decides deployment duration (§4.4). | Hardware |
| 7 | **Wake/listen window duration** | 20–30 s proposed. Trade-off against §6 power budget. | Ahsan |
| 8 | **Jetson SD retention policy** | Only unhandled failure mode in §9. | Ahsan |
| 9 | **Schema sign-off** | App team builds against §7.3. Freeze it early. | App team |

---

## 13. Demo day — single node

### 13.0 The cold-start problem

On demo day we will have hours of history, not weeks. Three of our outputs are
instantaneous and three are time-dependent, and being clear about which is which is
the difference between a strong demo and a fabricated one.

**Computes from a single session — full live demo, no caveats:**

| Output | Why it works cold |
|---|---|
| VARI / ExG / TGI / DGCI | Single-frame arithmetic on one RGB capture. No history at all. |
| Disease classification | EfficientNet-Lite0 on one inspection crop. Stateless. |
| Trap **raw blob count** | One image in, one count out. |
| Ambient temp / humidity | Instantaneous sensor read. |

**Cannot compute from a single session:**

| Output | What it needs | Behaviour on demo day |
|---|---|---|
| CWSI | Non-water-stressed baseline, ~2 weeks | `null`, `BASELINE_INITIALIZING`, days remaining |
| FAO-56 `Ks` | Running soil water balance from a known start | `null` until the balance is seeded |
| Trap count **per trap per day** | Monitoring window ≥ 1.0 day (existing guard) | Raw count shown; rate withheld |
| Trap trend (RISING/FALLING) | Multiple counts over days | `INSUFFICIENT_HISTORY` |

### 13.0.1 The fix, and it is urgent

**Plant the pole and start logging now.** The node does not need the drone, the app,
or Step 13 to be finished — it needs power and an SD card. Data collection is fully
decoupled from software readiness, and every day of delay is a day of baseline we
cannot get back.

Starting in mid-September gives roughly two weeks of thermal history by late
September. That is the difference between demonstrating CWSI and explaining CWSI.
The blocker is procurement: **MLX90640 and DS3231 must be ordered immediately** —
they now gate the demo twice over, once for hardware presence and once for the
history they need to accumulate.

If the baseline is genuinely incomplete on the day, the honest presentation is a
**seeded replay**: pre-load the Jetson database with earlier-collected records,
render them through the real pipeline, and label them as replay in the UI. Never
present replayed history as live measurement. A judge who spots an unlabelled
replay has found failure pattern #1 in the demo itself.

### 13.1 Run sheet

1. Node powered, pole planted, trap card fresh. Press the wake button.
2. Drone powered at the launch point beside the node. Jetson boots, acquires GPS
   time, scans for `SIH-NODE-*`, associates, pulls backlog. **Show the manifest
   on a screen — this is the moment the data mule concept becomes visible.**
3. Fly the two-tier pass. Survey, then inspection.
4. Land. Post-flight sync.
5. Jetson processes, fuses, commits to SQLite, raises `SIH-FIELD`.
6. Phone joins. App pulls the advisory. Show it rendering.
7. **Then pull the node's power and fly again.** The second advisory comes back
   with `sticky_trap: STALE` and a declared age. *Demonstrating that the system
   reports its own degradation is a stronger result than a clean run.* Judges have
   seen clean runs.

Two things to have an answer ready for:

- **"Why not cloud?"** — Because connectivity in the target deployment is not
  assumable, and an advisory that requires a signal is an advisory that fails when
  it is needed. Offline is the design point, not a fallback.
- **"Where is NDVI?"** — Optical path still being finalised. MidOpt DB660/850 is
  unobtainable in our window, so we are evaluating alternative red/NIR filter
  options. Separately, the harder problem is `calib_matrix` derivation — an
  uncalibrated NDVI is a number without units, so the code raises
  `NotImplementedError` instead of returning one. **Frame this as an input still
  being finished, not a feature removed.** The field exists end-to-end through
  schema and UI; only the optics are outstanding. Refusing to emit an uncalibrated
  index is the same discipline that keeps CWSI silent during baseline
  initialisation.

---

## 14. What the app team needs to build

### 14.1 Two platform gotchas that will cost you a day each if you hit them cold

**Android — the phone will route your requests over cellular and they will fail.**
When joined to a WiFi network with no internet, Android keeps the default route on
mobile data. Your HTTP call to `192.168.4.1` goes out the cellular interface and
times out. Fix: `ConnectivityManager.requestNetwork()` with a `NetworkRequest`
specifying `TRANSPORT_WIFI` and *without* `NET_CAPABILITY_INTERNET`, then bind your
socket or process to the returned `Network`. This is not optional and it is not
obvious from the failure symptom — it looks like the server is down.

**iOS — local network permission.** Add `NSLocalNetworkUsageDescription` to
`Info.plist`, and `NSBonjourServices` if you use mDNS discovery. Without it,
connections to local addresses fail with a permissions error that does not clearly
say so. Also expect the OS to prompt about staying on a network with no internet.

### 14.2 Build order

1. **Local store first.** SQLite replica, same shape as the Jetson's. The app must
   render a full history with no drone present. Get this working before any
   networking.
2. **Sync as a delta pull.** Cursor → `/manifest` → fetch missing → `/ack`.
   Idempotent: re-running must be harmless. Resumable: interruption must not lose
   progress.
3. **Advisory renderer.** Drive entirely from the schema. In particular:
   - `null` + reason must render as an explicit *"not measured"* state with the
     reason shown. **Never blank, never zero, never a dash.**
   - `threshold_confirmed: false` must be visually distinct from confirmed.
   - `inputs[].age_hours` must be visible per input, not buried in a detail view.
   - `advisory_only: true` must appear on every action. We dropped actuation; the
     UI must not imply otherwise.
4. **Connection state UI.** Four states, all reachable: never synced / synced N ago
   / connected & syncing / sync failed. The freshness of what the farmer is looking
   at should never be ambiguous.

### 14.3 The one thing to get right

The app is the last place a fabricated number can be caught, and the easiest place
for one to be created. A UI that renders `null` as `0`, or a provisional threshold
identically to an ICAR-sourced one, reintroduces at the presentation layer exactly
the failure modes we spent the correction track removing from `core/`.

**If the schema says we do not know something, the screen must say we do not know
it.**

---

*End of document. Amendments to `sih-smart-farming/docs/` only — outer `docs/` is
`docs_STALE_SNAPSHOT_2026-09-04` and must not be written to.*
