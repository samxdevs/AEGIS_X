# What the app needs from hardware and ML

**Project:** AEGIS — SIH 2026, PS 26180, Team TH10-HW
**Document owner:** App team
**Companion to:** `data_flow_architecture.md` (§7.3 and §7.4 are the contract this
document is trying to close)
**Status:** Request for answers. Every item is open until someone replies.

---

## 0. How to read this document

The phone app is built and running against fixtures today. Almost nothing left on
the app side is blocked by code — it is blocked by facts only the hardware and
model teams have. This is that list, grouped by who owns it.

The app was deliberately built fixture-first: local SQLite replica, the §7.3
schema as TypeScript, a validator that enforces all four schema rules, the delta
pull, and a fake field station so the protocol could be exercised with no radio.
All of that works now, with no drone, no Jetson, no network and no model.

That means the day the hardware and the model are done, the app should light up by
**pointing it at a different IP address** — and it will, but only if the answers
below are settled before then rather than discovered on the day. Every item here
is something the app currently has to guess at. A guess that turns out wrong is a
rewrite during demo week.

| Tag | Meaning |
|---|---|
| **BLOCKER** | The app cannot be finished, or cannot be trusted, without it. |
| **NEEDED** | We can build around it, but we redo the work if the answer differs. |
| **WHEN READY** | It lands with the hardware. It just needs to not surprise us. |

**Reply by item ID and nothing else.** "A3: exclusive, sorted oldest first" is a
complete reply.

---

## 1. If you only action three things

These three collapse most of the risk. With them done, the rest of this document
is cleanup rather than blocking work.

| # | Item | Why this one |
|---|---|---|
| **B12** | One real advisory JSON out of the actual pipeline | Even an ugly, half-broken one. We swap it in for a fixture and find every mismatch in an afternoon instead of on demo day. |
| **A1** | Vendor our schema + validator to the Jetson | Run it before every commit to SQLite. Then the two sides cannot drift, because they are literally the same file. |
| **E1** | Someone assigned to the Android network-binding module | App-side work, but it needs a dev build and a real Android phone. Without it, every request on Android times out with the drone sitting right there. |

---

## 2. Group A — the wire contract

**Owner: Jetson / server side, with Ahsan.**

§12 item 9 still lists *schema sign-off* as OPEN. This is the group that decides
whether "point the app at a new IP" actually works. Every answer here is one line
long; there are just a lot of them, and each one is a silent failure if it is
wrong.

### A1 · Freeze schema v1.0, and run our validator on the Jetson — **BLOCKER**

`mobile/src/schema/advisory.ts` and `validate.ts` were written to be copied to the
Jetson unchanged. If the Jetson validates before it commits to SQLite, a malformed
advisory never reaches the phone at all, and the two sides cannot drift apart.

> **Send back:** confirmation that §7.3 is frozen at `schema_version "1.0"`, plus a
> freeze date. Copy both files into the Jetson repo and call `validateAdvisory()`
> before the SQLite write.

### A2 · The exact manifest response body — **BLOCKER**

§7.4 says the manifest returns "advisory ids + generated_at + size" but does not
give the JSON. The app currently expects the shape below. If the Jetson emits a
different key, the sync returns zero advisories and reports success — the worst
possible failure, because it looks fine.

> **Send back:** confirmation of this exact body, or the real one.
>
> ```jsonc
> GET /api/v1/manifest?since=<id>
> {
>   "advisories": [
>     {"advisory_id": "...", "generated_at_utc": "...", "bytes": 4213}
>   ]
> }
> ```

### A3 · Cursor semantics, spelled out — **BLOCKER**

We assume `?since=<advisory_id>` means **strictly after** that id, and that the
manifest is ordered oldest-first. We also need to know that `advisory_id` genuinely
orders — it is a timestamp plus field id, so two advisories in the same second, or
two fields, or a Jetson clock that jumps backwards, all need a defined answer.

> **Send back:** exclusive or inclusive? Sort order? What orders two advisories
> with the same `generated_at_utc`?

### A4 · Is the manifest ever truncated? — **NEEDED**

The node API (§5.4) has `limit` and a `truncated` flag. The phone API has neither.
After a month of flights with no phone contact, does the manifest just return
everything?

> **Send back:** either "unbounded, it's tiny" — or add `limit` + `"truncated": true`
> and we'll loop.

### A5 · Error codes, and which ones are worth retrying — **NEEDED**

Three cases we need distinguished: an id that does not exist, the AP being up
before the database is ready, and an advisory still being generated. Right now they
would all surface to the farmer as "sync failed".

> **Send back:** status code per case, and whether a retry is safe. A `503` +
> `Retry-After` for "not ready yet" is ideal.

### A6 · Is `/ack` required, or a courtesy? — **NEEDED**

The app treats a failed ack as harmless — it keeps its own cursor and filters the
manifest against what it already holds, so a lost ack costs nothing. That is only
true if the Jetson does not gate anything on the ack.

> **Send back:** confirmation that the Jetson keeps serving records it has already
> acked, and never deletes an advisory on ack.

### A7 · How a seeded replay is labelled — **BLOCKER**

§13.0.1 says replayed history must never be presented as live measurement, and the
app keeps three separate origins for exactly this — `synced`, `replay`, `fixture`.
It currently reads `"replay": true` off the advisory JSON.

**If the demo runs on seeded data and this field is missing, the app will label
invented history as a live measurement in front of judges.** That is failure
pattern #1 landing in the demo itself.

> **Send back:** confirmation that the Jetson sets `"replay": true` on every seeded
> record — or name the header you would rather use and we will read that instead.

### A8 · What happens when you want to add a field — **NEEDED**

The app accepts `schema_version "1.0"` and nothing else. We need a rule now so a
late addition on the Jetson does not brick every installed app.

> **Send back:** agreement or an alternative. Proposed: additive changes stay
> `"1.0"` (we ignore unknown keys); anything breaking bumps to `"1.1"` and the
> Jetson serves both for a week.

### A9 · The `/health` field list — **NEEDED**

The field-station screen shows this before a sync, so the farmer knows the drone is
alive and how much is waiting.

> **Send back:** confirm or amend. We read `device`, `advisory_count`,
> `storage_free_kb`, `gps_time_valid`.

### A10 · Media — and the schema gap under it — **NEEDED**

`GET /api/v1/media/<id>` is in §7.4 but built on neither side. The real problem is
upstream: **nothing in the §7.3 advisory JSON references a media id**, so even with
the endpoint live, the app has no way to know which crop or trap image belongs to
which finding. That is a schema change, so it needs deciding before A1 freezes.

> **Send back:** in or out for the demo. If in: where media ids attach (likely
> `disease[].media_ids` and `pest[].media_ids`), formats, thumb and full pixel
> sizes, and rough bytes per advisory.

### A11 · Every timestamp is UTC with a trailing Z — **NEEDED**

The app parses and does age arithmetic on these. A local-time string or an offset
silently shifts every `age_hours` by 5½ hours, and §6.3 is the whole reason we care
about this.

> **Send back:** confirmation of ISO-8601 UTC, `Z` suffix, everywhere. No offsets,
> no epoch seconds, no local time.

### A12 · What gets emitted when the Jetson's GPS time is invalid — **NEEDED**

`generated_by.gps_time_valid: false` exists in the schema. We need to know whether
an advisory is still generated in that state, and what the Jetson does with the
node's `rtc_utc` when it cannot trust its own clock to compare against.

> **Send back:** still emitted, or suppressed? If emitted, are `age_hours` values
> still computed, or null?

---

## 3. Group B — model outputs and what they mean

**Owner: ML team.**

The app does not compute anything. Whatever the model emits is what a farmer reads.
So the questions here are less about the model's accuracy and more about the
vocabulary it speaks in — and about the bands that turn a number into an advisory.
**A bare index value with no interpretation is not advice.**

### B1 · The exact class label strings — **BLOCKER**

`disease[].class` is rendered to the farmer. Today the app prints the raw string,
so a label like `rice_bacterial_leaf_blight` reaches the screen as-is. We need the
real list to build a display-name map — and later, a translated one.

> **Send back:** the `labels.txt` / class-index mapping, verbatim as the model emits
> it. Plus, per class: crop, a plain-English name, and an accepted Hindi name.

### B2 · What `confidence` actually is — **BLOCKER**

Raw softmax maximum, or calibrated? These render completely differently — an
uncalibrated 0.88 from a 15-class softmax is not an 88% chance of anything, and
showing it as one is a fabricated measurement in the presentation layer.

> **Send back:** calibrated or raw. And the cut-off below which the Jetson emits
> nothing at all, versus emits it flagged low.

### B3 · "Healthy" and "this isn't a leaf" — **BLOCKER**

Two different questions. Is a healthy plant a class, or an empty `disease[]`? And
what does the model return for soil, a shoe, a motion-blurred frame, or a crop it
was never trained on? A classifier with no out-of-domain guard returns its most
confident wrong answer, and the app will render it as a finding.

> **Send back:** how "healthy" is signalled. Whether there is an OOD / reject path,
> and what field carries it.

### B4 · How `n_inspection_crops` aggregates — **NEEDED**

One row per class with a mean confidence? A majority vote? Top-1 per crop, merged?
This decides whether the app can honestly say "6 of 8 close-up crops agreed" —
which is a far stronger thing to show a judge than a lone number.

> **Send back:** the aggregation rule in one sentence, and whether an `n_agreeing`
> field could be added alongside.

### B5 · Can two diseases appear at once? — **NEEDED**

`disease` is an array. Is it top-k, everything above a threshold, or always exactly
one? Affects layout and whether we rank or just list.

> **Send back:** max array length in practice, and the ordering rule.

### B6 · Interpretation bands for VARI, ExG, TGI, DGCI — **BLOCKER**

This is the largest content gap on the whole list. The app receives
`vari.mean = 0.31` and can currently do nothing with it but print it. A farmer
cannot act on that. We need the bands — what is healthy, what is marginal, what is
stressed — for this crop, with a source, because §7.3 rule 2 applies to every
threshold we display, not just pest ones.

> **Send back:** per index — band boundaries, what each band means, a citation, and
> `threshold_confirmed` true/false. A `PROVISIONAL` band we can label is far better
> than none.

### B7 · When `out_of_domain_fraction` makes DGCI untrustworthy — **NEEDED**

The field exists in the schema but has no threshold attached, so the app currently
displays a DGCI mean regardless of how much of the frame fell outside the valid
domain.

> **Send back:** the fraction above which we should withhold the mean and show a
> reason instead.

### B8 · The pest threshold table, with citations — **BLOCKER**

§7.3 rule 2 requires `threshold_source` and `threshold_confirmed` on every
threshold, and the app renders a provisional one visibly differently from a cited
one. That only works if somebody has actually decided which is which.

> **Send back:** one row per taxon.
>
> ```
> taxon | threshold | unit | threshold_source | confirmed?
> ```
>
> Mark anything uncited as `PROVISIONAL` — do not leave it blank.

### B9 · Who writes the `actions[]` text, and in what language — **BLOCKER**

These are the sentences the farmer actually reads and acts on — the whole output of
the system, from their side. If they are free text generated on the Jetson, the app
can neither translate them nor lay them out predictably. If they are templates
keyed to findings, we can do both.

> **Send back:** fixed templates keyed by finding, or free text? A length cap. And
> whether the Jetson emits Hindi, or the app translates.
>
> This one is really a decision, not a fact — see **Group F**, which is the same
> question asked properly. Answering F1 answers this.

### B10 · CWSI and FAO-56 ranges and bands — **NEEDED**

We assume CWSI is 0–1 and that higher means more stress. We need the action
boundaries, and the same for FAO-56 `depletion_mm` and `ks` — depletion in
particular is meaningless to a reader without knowing the total available water it
is a fraction of.

> **Send back:** CWSI band boundaries and their meaning. For FAO-56, whether we
> should show depletion against a field capacity figure, and where that figure
> comes from.

### B11 · NDVI, the day the optics land — **WHEN READY**

The field is already wired end to end — schema, validator, UI — and renders as
`PENDING_HARDWARE_FINALIZATION`. We want the flip to be a non-event.

> **Send back:** confirmation that `ndvi_status` just becomes `"OK"` with no new
> status values. Then the range and bands, same as B6.

### B12 · One real advisory JSON, as early as possible — **BLOCKER**

The highest-value item in this document. Our five fixtures are invented from §7.3 —
well-formed by construction, which is exactly why they will not catch the
mismatches that matter. One file from the real pipeline, however broken, tells us
more than every other answer here combined.

> **Send back:** a single `advisory.json` straight out of the pipeline. It does not
> need to validate, be complete, or be from a good flight.

---

## 4. Group C — radio, addresses and the field setup

**Owner: Hardware.**

Short group, mostly one-line confirmations — but the app ships hard defaults for
several of these and they are all still tagged PROPOSED in §7.1.

### C1 · Has the Jetson WiFi adapter been ordered? — **BLOCKER**

§12 puts this at number one on the whole project's list: no connectivity demo
exists without it. The doc recommends the USB dongle over the M.2 card purely on
procurement lead time.

> **Send back:** ordered / not ordered, and the expected arrival date. If not
> ordered, this is the single most urgent line in this document.

### C2 · Final SSID, password, IP and port — **BLOCKER**

The app ships `http://192.168.4.1:8080` as its default and the field-station screen
can be repointed by hand — but the default is what the demo will run on, and the
farmer should never have to type an address.

> **Send back:** SSID (`SIH-FIELD`?), the WPA2 password, the Jetson's static IP, and
> the port. Confirm the AP subnet will not collide with the node's `192.168.4.x`.

### C3 · When does the AP come up, and for how long? — **NEEDED**

§7.2 leaves this open between "as long as the drone has power" and "on a button
press". The app's connection screen has to tell the farmer what to do and how long
they have, and those are different screens.

> **Send back:** automatic on landing, or button-triggered. How long it stays up.
> Whether it survives a Jetson reboot.

### C4 · DHCP behaviour, and no captive portal — **NEEDED**

Android probes every new network for internet access. If `dnsmasq` answers those
probes in a way that looks like a captive portal, Android may show a sign-in
notification, drop the network, or reroute traffic — on top of the routing problem
in E1.

> **Send back:** confirmation that `dnsmasq` hands out a lease and does *not*
> respond to connectivity-check URLs. Tell us the DHCP range.

### C5 · The exact node and field ID strings — **NEEDED**

These appear on screen and are used as keys. §7.3 shows `"field_id": "F01"` and
`"source_node": "07"` — one prefixed, one bare, one zero-padded.

> **Send back:** the literal strings for demo day, and confirmation the padding will
> not change later.

### C6 · One node, one field — still true? — **NEEDED**

§13 says single node, single field, and the app is built that way deliberately.
Multi-node UI is a different information design, not a loop around the existing one.

> **Send back:** confirmation. If it becomes two nodes, we need to know now, not in
> demo week.

### C7 · An Android phone we can keep — **NEEDED**

The network binding in E1 cannot be written or tested in Expo Go or on an emulator
— it needs a physical Android device, a USB cable, and an `expo run:android` dev
build.

> **Send back:** whose phone, its Android version, and whether we can hold it for
> the build week. Also: the phone the demo will run on, if it differs.

---

## 5. Group D — decisions still marked OPEN

**Owner: Ahsan, as document owner.**

Four items from §12 and §9 that reach the app but have no owner resolution yet.

### D1 · Schema sign-off date (§12 item 9) — **BLOCKER**

Listed with the app team as owner, but we cannot sign off on a contract with the
other side of it unspecified. Our position: we accept §7.3 as written, subject to
A2–A12 and the media question in A10.

> **Send back:** a date after which §7.3 changes require both sides to agree.
> Ideally this week.

### D2 · SD retention, and what a pruned image looks like (§12 item 8) — **NEEDED**

§9 lists this as the only unhandled failure mode. It reaches the app directly: if
media is pruned while advisory JSON is kept, the app will request an image that no
longer exists. "Deleted to save space" and "never existed" are different things to
tell a farmer.

> **Send back:** the retention rule, and a distinguishable response for pruned media
> — `410 Gone` rather than `404` would be enough.

### D3 · The phone writes nothing but `/ack` — **NEEDED**

The app is a read-only replica by design. If anyone is expecting farmer notes,
confirmations, or corrections to flow back to the Jetson, that is a new direction of
travel and a new set of problems.

> **Send back:** confirmation of read-only. If not, say so now.

### D4 · Is the Supabase upstream tier in or out? — **WHEN READY**

Currently scoped as purely additive — if the phone later reaches internet it pushes
a copy up, and nothing in the field path depends on it. We are happy to build it,
but not at the cost of anything above.

> **Send back:** in or out for the demo. If in, project URL and the anon key, plus
> whether any field-path behaviour is allowed to change (our answer: no).

---

## 6. Group E — our own list, no dependencies

**Owner: App team.**

Listed for visibility, not because anyone needs to answer them. These are the things
we build regardless, and E1 is the one to worry about.

### E1 · The Android network-binding native module — **BLOCKER**

The biggest app-side risk on the project, and the one that looks like someone else's
fault when it hits. Joined to a WiFi network with no internet, Android keeps the
default route on mobile data, so a request to `192.168.4.1` leaves over cellular and
times out — with the drone three feet away and the AP up. It is indistinguishable
from a dead server.

The fix is `ConnectivityManager.requestNetwork()` with `TRANSPORT_WIFI` and without
`NET_CAPABILITY_INTERNET`, then binding to the returned network. That is Kotlin, so
it needs a config plugin and a dev build — it cannot run in Expo Go.

> **Needs:** one person, a physical Android phone (C7), and a working
> `expo run:android` build. Workaround until then: turn mobile data off before
> syncing. The app already says so on the sync screen rather than failing
> mysteriously.

### E2 · A real dev build, not Expo Go — **BLOCKER**

Everything in the app works in Expo Go today, which is why progress has been fast.
E1 ends that. Getting the first dev build green is usually a day of Gradle problems
and is worth doing before we need it.

> **Decide:** local Android Studio or EAS Build — and do it before the hardware
> arrives, not after.

### E3 · Hindi, at minimum — **NEEDED**

The app is English-only. An agricultural advisory app for Indian farmers that only
speaks English is a demo problem as well as a real one, and a judge will ask. Our
fixed strings we can handle; the `actions[]` text is the hard part and depends
entirely on B9.

> **Needs:** a translator for roughly 80 UI strings, plus the disease and pest names
> from B1 and B8. A volunteer from the team is fine.

### E4 · Onboarding, and the media screen — **NEEDED**

A "how to connect" screen once C2 and C3 are settled, and the media viewer once A10
is. Both are ordinary work, both are blocked on a decision rather than on effort.

> **Needs:** nothing from anyone. Waiting on C2, C3, A10.

### E5 · Run the conformance check against the real Jetson — **NEEDED**

The moment the Jetson serves anything, we point the app at it and run the same sync
the fake station already passes — including the `--flaky` and `--slow` variants,
which exercise resumability. This is the half-hour that turns "should work" into
"works".

> **Needs:** thirty minutes with the Jetson on a bench, on any date, as early as
> possible. It does not need to fly.

---

## 7. Group F — where the farmer's advice actually comes from

**Owner: unassigned. That is the problem.**

`actions[]` is the whole output of the system from the farmer's side — the
sentences they read and act on. §7.3 specifies its *shape* (`rank`, `action`,
`rationale`, `confidence`, `advisory_only`) and says nothing whatsoever about what
**generates** it. There is no LLM anywhere in `data_flow_architecture.md`: not in
the three tiers, not in the schema, not in §12's open items.

So this group is not a request for facts like the others. It is a decision nobody
has made yet, and it sits directly on the demo's critical path.

### F1 · What generates `actions[]`? — **DECIDED, 13 Sep 2026**

**Decision: the LLM layer is in scope and is being built.** Taken by Vitthal. The
options below are kept for the record, and because F2–F5 still need answering.

**Where it runs: on the phone, opportunistically — not on the Jetson.** The drone
keeps producing the structured advisory offline exactly as it does now. When the
phone later reaches internet, the app sends that advisory to the Claude API and
caches the farmer-facing explanation in SQLite beside it, so it is readable offline
from then on.

This keeps the field path completely unchanged: an advisory still never requires a
network to exist, be delivered, or be read. The LLM is the fourth, additive tier
§7.2 already leaves room for. The demo tells a stronger story for it, not a weaker
one — show the advisory offline, then show the same advisory explained in Hindi,
and say plainly that the second half is the part allowed to be absent.

Three options were on the table. They have very different costs and they are not
equally compatible with the project's own thesis.

| Option | Where it runs | Cost |
|---|---|---|
| **Deterministic templates** | Jetson, in `core/` | Findings map to fixed strings with citations. Offline, auditable, translatable, cannot hallucinate a dose. Least impressive to demo, most defensible under questioning. |
| **Small local LLM** | Jetson, 4 GB shared with TensorRT | Very tight alongside EfficientNet-Lite0. Slow. Hallucinated agronomic advice is a safety problem, not a quality one. |
| **Opportunistic cloud LLM** | Fourth tier, off the field path | Only when the phone happens to reach internet. Richer, conversational, easy to do in Hindi. Must never be required for an advisory to exist. |

**Chosen: the opportunistic cloud tier.** The rule that makes it safe is that the
field path may not change — §6.2 says we do not need cloud at any point, and §13.1
has us answering *"why not cloud?"* to judges. Both stay true, because no advisory
ever waits on the API. What the LLM adds is a better *explanation* of an advisory
that already exists.

**What still has to hold, and what it means for the Jetson:**

- `actions[]` continues to come from the Jetson, deterministically. The LLM does not
  replace it — it explains it. If the Jetson stops emitting `actions[]` because "the
  LLM will handle it", an offline farmer gets nothing, and the demo's offline half
  has no content. **B9 is therefore still live**: we need the templates regardless.
- The LLM output is cached in the phone's SQLite beside the advisory it explains,
  so it survives going back offline.
- It is rendered as a clearly separate, clearly generated block. Never mixed into
  the measured sections.

> **Still needed from the Jetson side:** B9 (the deterministic `actions[]` the LLM
> explains), and F2's guarantee below.

### F2 · The rule the LLM must obey — **BLOCKER, and now live**

An LLM may **phrase** findings. It must never be the **source** of a number, a
threshold, or a dose. Measured values pass through it verbatim or not at all.

This is not a style preference. The entire correction track was about removing
fabricated measurements from `core/`; a model that invents a spray concentration in
the last paragraph the farmer reads reintroduces failure pattern #1 at the one point
where nobody downstream can catch it. §14.3 already says the app is the last place a
fabricated number can be caught — a generative layer makes the app the place one
gets *created*.

> **Send back:** agreement that generated text is assembled from schema values only,
> and that the prompt cannot introduce figures. Plus: what the app renders when
> generation fails or is unavailable.

### F3 · Jetson headroom — **CLOSED by F1**

Moot now that the model runs on the phone. Kept for the record: the Nano is 4 GB,
already running EfficientNet-Lite0 under TensorRT FP16 plus the index pipeline in
one post-flight pass (§6.1). Nothing about the LLM decision adds load to it.

**Nothing needed from Hardware on this item.**

### F3a · The API key cannot ship inside the app — **BLOCKER, app team**

An API key compiled into an APK is extractable by anyone who downloads it, and they
spend our credits. This has no clean answer at our scale, so it needs a decision
rather than a solution.

| Option | Cost |
|---|---|
| **Tiny proxy server** holding the key, app calls the proxy | Correct. Needs somewhere to host it and a morning of work. |
| **Rate-limited key in the app**, accepted as demo-week risk | Free, works, and is defensible if we say it out loud rather than hide it. |

> **Decide:** which one. Does not block starting — the call site is identical either
> way, only the URL changes.

### F4 · Generated text must be visibly distinct from cited advice — **NEEDED**

The app already renders a `PROVISIONAL` threshold differently from an ICAR-sourced
one (§7.3 rule 2). Model-generated prose needs the same treatment, for the same
reason: a judge must be able to tell at a glance which sentences trace to a source
and which were written by a model.

> **Send back:** a flag on the advisory we can key off — `actions[].generated_by:
> "template" | "llm"` would be enough. We handle the rendering.

### F5 · Language — **NEEDED**

Ties to B9 and E3. If `actions[]` is free text from a model, the app cannot
translate it; if it is templates, we can. If a cloud LLM produces Hindi directly,
that is the strongest farmer-facing result available to us — but only on the tier
that is allowed to be absent.

> **Send back:** which layer produces Hindi, and what the app shows when that layer
> is not reachable.

---

## 8. Already built — please do not duplicate this work

All of it runs today with no drone, no Jetson, no network and no model. If something
below looks like it needs doing, check with us first.

| Built | Detail |
|---|---|
| §7.3 schema as TypeScript | Written to be vendored to the Jetson unchanged |
| The four schema rules, enforced | 14 tests; every rule fires when broken |
| SQLite replica | Migrations, ingest, cursor — same shape as the Jetson's |
| The delta pull | Idempotent and resumable; the cursor follows what committed |
| A fake field station | Serves §7.4 from fixtures, with flaky and slow modes |
| Five fixtures | Four degraded on purpose, so the broken renderings exist |
| Honest renderer | `null` cannot render as 0, blank, or a dash |
| Origin tracking | `synced` / `replay` / `fixture` kept all the way to the screen |

---

## 9. How to reply

Answer by item ID and nothing else — "A3: exclusive, sorted oldest first" is a
complete reply. Partial answers are welcome; a maybe on B6 is worth more than
silence, because we can build the provisional band and label it as one.

Anything still unanswered by the schema freeze date in D1, we will implement against
our best guess, write the guess down in the code, and tell you which items it was.
That is not ideal, but it beats blocking — and a documented guess is at least a
guess somebody can correct.

---

## Appendix — how the phone actually connects to the drone

Included because this gets asked a lot. It **is** specified (§7.1, §7.2) and it **is**
built on the app side; what does not exist is the radio to run it over.

```
1.  Drone lands. Motors disarmed.
2.  Jetson raises its own WiFi access point   hostapd + dnsmasq
        SSID      SIH-FIELD          (WPA2-PSK)
        Jetson    192.168.4.1
        API       http://192.168.4.1:8080/api/v1/
3.  Farmer joins that network on their phone, like any WiFi network.
4.  App runs the delta pull, over plain HTTP:
        cursor  ->  GET  /api/v1/manifest?since=<last id>
                ->  GET  /api/v1/advisory/<id>     for each one missing
                ->  POST /api/v1/ack               {"upto": "<id>"}
5.  Advisories land in the phone's SQLite replica and render.
```

Three things that are easy to get wrong when explaining this:

**The phone never connects to the drone in flight.** Sync happens on the ground with
motors disarmed (§5.2). That is deliberate: our WiFi is 2.4 GHz and so is the RC
control link, so §10 designs the interference question out rather than managing it.
Nothing streams, ever — this is store-and-forward, and the drone is a *data mule*.

**The phone is a client pulling from a passive server**, at both hops. The Jetson
pulls from the node; the phone pulls from the Jetson. Only the collector knows what
it already has, so only the collector can compute the delta.

**Nothing is lost if the phone is not there.** The advisory was committed to the
Jetson's SQLite *before* the AP came up. The phone's cursor picks up whatever it
missed, however many flights that spans (§7.2).

What is missing, and where it is tracked in this document:

| Missing | Item |
|---|---|
| The Jetson has no WiFi hardware at all — empty M.2 slot, nothing ordered | **C1** |
| The Jetson side of the API (`hostapd`, `dnsmasq`, the HTTP server) | **A2**–**A9** |
| Android routes the request over cellular unless we bind the socket | **E1** |
| The farmer joins the SSID by hand; no QR, no auto-join | **E4** |

Testable today with none of the above: `npm run station` in `mobile/` serves the same
API from the fixtures, over localhost. §12 item 1 blocks the radio, not the protocol.
