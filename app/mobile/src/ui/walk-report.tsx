/**
 * The walk report: what one walk found, in the order a farmer needs it.
 *
 *   1. the walk in numbers     duration, stretches, need a look / healthy / unclear
 *   2. the walk in order       a strip with one block per 20 seconds of walking
 *   3. where it happened       the stretches and alerts on a map
 *   4. what to go and look at  only the problems, each one to check by eye
 *   5. photos you took         each Capture and what the pod made of it
 *   6. the field's conditions  the station's readings, soil as raw volts
 *
 * Healthy ground is counted, never listed: a list of thirty "healthy" rows would
 * bury the three that matter. Everything here is read from the advisory's walk
 * fields, so an older single-scan advisory (which has none) never reaches it.
 *
 * Nothing on this screen is a diagnosis. A flagged stretch says what the model
 * thought and tells the farmer to check it by eye, as the alerts did live.
 */

import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { podBaseUrl } from '../scan/api.ts';
import {
  formatClock,
  inSentence,
  lookItems,
  orderedStretches,
  reportMarks,
  stopReasonNote,
  stretchLabel,
  stretchTone,
} from '../scan/report.ts';
import type { ReportMark, ReportTone } from '../scan/report.ts';
import { formatTimer } from '../scan/logic.ts';
import type { Advisory, FieldConditions } from '../schema/advisory.ts';
import { describeClass } from '../schema/classes.ts';
import { FieldMap, MapLegend } from './charts.tsx';
import { CaptureCard } from './pod-camera.tsx';
import { Card, Chip, ChipRow, Divider, Muted, Panel, Row, StatusChip, humaniseStatus } from './components.tsx';
import type { Tone } from './components.tsx';
import { extentMetres, pickScaleMetres, toMetres, toUnitSquare } from './field-geometry.ts';
import { SatelliteMap } from './satellite-map.tsx';
import type { GeoPoint } from './satellite-map.tsx';
import { chart, color, radius, space, type, themed, live } from './theme.ts';
import { msg, tr } from '../i18n/tr.ts';

/** Everything the walk report adds above the standard advisory sections. */
export function WalkReport({ advisory }: { advisory: Advisory }) {
  return (
    <>
      <WalkSummaryCard advisory={advisory} />
      <WalkMapCard advisory={advisory} />
      <NeedALookCard advisory={advisory} />
      <PhotosCard advisory={advisory} />
      <FieldConditionsCard conditions={advisory.field_conditions} />
    </>
  );
}

const CROP_LABEL: Record<string, string> = {
  wheat: msg('Wheat'),
  rice: msg('Rice'),
  sugarcane: msg('Sugarcane'),
};

const STRIP_FILL: Record<ReportTone, string> = live(() => ({
  good: chart.fill.good,
  warn: chart.fill.warn,
  bad: chart.fill.bad,
  unknown: chart.muted,
}));

// ---- 1 and 2: the summary and the strip -----------------------------------

function WalkSummaryCard({ advisory: a }: { advisory: Advisory }) {
  const [picked, setPicked] = useState<number | null>(null);
  const stretches = orderedStretches(a);
  const summary = a.summary;
  const total = summary?.stretches_total ?? stretches.length;
  const seconds = walkSeconds(a);
  const reason = stopReasonNote(a.scan?.stop_reason);
  const crop = a.scan?.crop_declared ?? a.crop_health?.crop ?? null;

  const unlisted = (summary?.not_crop ?? 0) + (summary?.no_data ?? 0);
  const pickedStretch = picked === null ? null : stretches.find((x) => x.index === picked);

  return (
    <Card eyebrow={tr('Walk report')} title={tr('How your walk went')}>
      <View style={s.headline}>
        <View style={{ flex: 1 }}>
          <Text style={[type.micro, { color: color.fgSubtle }]}>{tr('TIME WALKED')}</Text>
          <Text style={[type.stat, { color: color.foreground, marginTop: 2 }]}>
            {seconds === null ? tr('unknown') : formatTimer(seconds)}
          </Text>
        </View>
        {crop ? <StatusChip label={tr(CROP_LABEL[crop] ?? crop).toUpperCase()} tone="neutral" /> : null}
      </View>

      {/* One sentence instead of four count tiles: the numbers are small and
          the strip below already shows them in walking order. */}
      <Text style={[type.body, { color: color.foreground, marginTop: space.sm }]}>
        {tr('{total} stretches: {look} need a look, {ok} healthy, {unclear} unclear.', {
          total,
          look: summary?.need_look ?? 0,
          ok: summary?.healthy ?? 0,
          unclear: summary?.unclear ?? 0,
        })}
        {unlisted > 0 ? ` ${tr('{n} more were not crop or had no data.', { n: unlisted })}` : ''}
      </Text>

      {/* One block per stretch, in walking order. Colour is never the only
          channel: the legend names each, and a tap names the block. */}
      {stretches.length > 0 ? (
        <View style={{ marginTop: space.lg }}>
          <View style={s.strip} accessibilityLabel={tr('Timeline of the walk, one block per stretch')}>
            {stretches.map((st) => (
              <Pressable
                key={st.index}
                onPress={() => setPicked(picked === st.index ? null : st.index)}
                accessibilityRole="button"
                accessibilityLabel={`${tr('Stretch {n}', { n: st.index + 1 })}, ${stretchLabel(st.verdict)}`}
                style={[
                  s.block,
                  { backgroundColor: STRIP_FILL[stretchTone(st.verdict)] },
                  picked === st.index && s.blockOn,
                ]}
              />
            ))}
          </View>
          <View style={s.stripAxis}>
            <Text style={[type.valueSmall, { color: color.fgSubtle }]}>{formatClock(stretches[0].start_utc)}</Text>
            <Text style={[type.valueSmall, { color: color.fgSubtle }]}>
              {formatClock(stretches[stretches.length - 1].end_utc)}
            </Text>
          </View>
          {pickedStretch ? (
            <Text style={[type.small, { color: color.foreground, marginTop: space.sm }]}>
              {[
                tr('Stretch {n}', { n: pickedStretch.index + 1 }),
                formatClock(pickedStretch.start_utc),
                stretchLabel(pickedStretch.verdict),
                pickedStretch.verdict === 'DISEASE' && pickedStretch.top_class
                  ? describeClass(pickedStretch.top_class).label
                  : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          ) : null}
          <MapLegend
            items={[
              { label: tr('Healthy'), tone: 'good' },
              { label: tr('Unclear'), tone: 'warn' },
              { label: tr('Need a look'), tone: 'bad' },
              { label: tr('Not crop or no data'), tone: 'unknown' },
            ]}
          />
        </View>
      ) : null}

      {/* How it ended. An ordinary stop is one quiet line; a power cut or the
          time limit is a notice, because the walk is not what the farmer chose. */}
      {reason ? (
        <View style={{ marginTop: space.md }}>
          {reason.detail ? (
            <Panel label={reason.label} tone={reason.tone as Tone}>
              {reason.detail}
            </Panel>
          ) : (
            <Text style={[type.small, { color: color.fgSubtle }]}>{reason.label}</Text>
          )}
        </View>
      ) : null}
    </Card>
  );
}

/** Seconds walked: the pod's own figure, else from the scan's two timestamps. */
function walkSeconds(a: Advisory): number | null {
  const given = a.scan?.duration_s;
  if (typeof given === 'number' && Number.isFinite(given)) return given;
  const start = Date.parse(a.scan?.started_utc ?? '');
  const end = Date.parse(a.scan?.ended_utc ?? '');
  return Number.isNaN(start) || Number.isNaN(end) ? null : Math.max(0, Math.round((end - start) / 1000));
}

// ---- 3: the map -----------------------------------------------------------

function markLabel(m: ReportMark): string {
  if (m.kind === 'alert') {
    return tr('Alert: possible {disease}', {
      disease: m.className ? inSentence(describeClass(m.className).condition) : tr('problem'),
    });
  }
  return m.verdict === 'DISEASE' && m.className
    ? `${stretchLabel(m.verdict)}: ${describeClass(m.className).condition}`
    : stretchLabel(m.verdict);
}

function WalkMapCard({ advisory }: { advisory: Advisory }) {
  const marks = reportMarks(advisory);
  // No positions, no map. The standard "Where in the field" section further
  // down says why when the pod had no fix, so this does not say it twice.
  if (marks.length === 0) return null;

  const geo: GeoPoint[] = marks.map((m) => ({
    lat: m.lat,
    lon: m.lon,
    tone: m.tone,
    radiusM: m.radiusM,
    label: markLabel(m),
    sub: formatClock(m.utc),
  }));

  const { metres } = toMetres(geo);
  const span = extentMetres(metres);
  const scaleM = pickScaleMetres(span);
  const plot = metres.map((m, i) => ({ ...toUnitSquare(m, span), weight: marks[i].kind === 'alert' ? 1 : 0.5, tone: marks[i].tone }));

  const present = new Set(marks.map((m) => m.tone));
  const legend: { label: string; tone: Tone }[] = [
    ...(present.has('good') ? [{ label: tr('Healthy'), tone: 'good' as const }] : []),
    ...(present.has('warn') ? [{ label: tr('Unclear'), tone: 'warn' as const }] : []),
    ...(present.has('bad') ? [{ label: tr('Need a look or alert'), tone: 'bad' as const }] : []),
    ...(present.has('unknown') ? [{ label: tr('Not crop or no data'), tone: 'unknown' as const }] : []),
  ];

  return (
    <Card eyebrow={tr('Where')} title={tr('Where you walked')}>
      <SatelliteMap
        points={geo}
        height={300}
        fallback={
          <View style={{ alignItems: 'center', paddingVertical: space.sm }}>
            <FieldMap points={plot} scaleLabel={`${scaleM} m`} scaleFraction={scaleM / span} />
          </View>
        }
      />
      <MapLegend items={legend} />
      <Text style={[type.small, { color: color.warningForeground, marginTop: space.sm }]}>
        {tr('Each circle is how accurate that position was. It marks a patch of the field, not one plant. Use it to find the area, then look around it.')}
      </Text>
    </Card>
  );
}

// ---- 4: need a look -------------------------------------------------------

function NeedALookCard({ advisory }: { advisory: Advisory }) {
  const items = lookItems(advisory);

  return (
    <Card
      eyebrow={tr('Check these')}
      title={tr('Need a look')}
      right={<Text style={[type.chipValue, { color: color.fgSubtle }]}>{items.length}</Text>}
    >
      {items.length === 0 ? (
        <Muted>{tr('Nothing was flagged on this walk. Healthy stretches are counted above, not listed.')}</Muted>
      ) : (
        <>
          <Text style={[type.small, { color: color.warningForeground, marginBottom: space.xs }]}>
            {tr('These are places the model thought might be a problem. It can be wrong, so check each one by eye before treating anything.')}
          </Text>
          {items.map((it, i) => {
            const info = it.className ? describeClass(it.className) : null;
            return (
              <View key={it.key} style={i > 0 ? s.itemRule : undefined}>
                <View style={s.item}>
                  <Text style={[type.chipValue, { color: color.fgSubtle, width: 86 }]}>{formatClock(it.utc)}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[type.label, { color: color.foreground }]}>
                      {info ? tr('Possible {disease}', { disease: inSentence(info.condition) }) : tr('Something was flagged')}
                    </Text>
                    <Text style={[type.small, { color: color.mutedForeground, marginTop: 2 }]}>
                      {[
                        info?.crop ?? null,
                        it.framesAgreeing === 1
                          ? tr('1 frame agreeing')
                          : tr('{n} frames agreeing', { n: it.framesAgreeing }),
                        tr('check by eye'),
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  </View>
                  {it.alerted ? <StatusChip label={tr('ALERT')} tone="bad" /> : null}
                </View>
              </View>
            );
          })}
        </>
      )}
    </Card>
  );
}

// ---- 5: field conditions --------------------------------------------------

/**
 * The photos the farmer took with Capture. Kept apart from "need a look": each
 * is one frame checked on its own, which is weaker than an alert, and mixing
 * them in would make a single photo read like the walk's verdict.
 */
function PhotosCard({ advisory }: { advisory: Advisory }) {
  const [base, setBase] = useState<string | null>(null);
  const photos = [...(advisory.captures ?? [])].sort((a, b) => a.capture_id - b.capture_id);
  useEffect(() => {
    if (photos.length > 0) void podBaseUrl().then(setBase);
  }, [photos.length]);
  if (photos.length === 0) return null;
  return (
    <Card eyebrow={tr('Taken with Capture')} title={tr('Photos you took')}>
      <Muted>{tr('Each photo was checked on its own. One photo is weaker evidence than an alert, which needs several frames to agree.')}</Muted>
      <View style={{ height: space.md }} />
      {photos.map((c) => (
        <CaptureCard key={c.capture_id} capture={c} base={base} />
      ))}
    </Card>
  );
}

function FieldConditionsCard({ conditions: c }: { conditions: FieldConditions | null | undefined }) {
  // An advisory that does not carry the block says nothing about it.
  if (!c) return null;

  if (!c.available) {
    return (
      <Card eyebrow={tr('Field station')} title={tr('Field conditions')}>
        <Panel label={tr('No reading')} tone="unknown">
          {c.reason ? humaniseStatus(c.reason) : tr('Not available.')}
        </Panel>
      </Card>
    );
  }

  const old = typeof c.age_minutes === 'number' && c.age_minutes >= 10;
  return (
    <Card
      eyebrow={tr('Field station')}
      title={tr('Field conditions')}
      right={c.node_id ? <Text style={[type.valueSmall, { color: color.fgSubtle }]}>{c.node_id}</Text> : undefined}
    >
      <Row>
        <Muted>{tr('Air temperature')}</Muted>
        <Value v={c.air_temp_c} unit="°C" digits={1} />
      </Row>
      <Divider />
      <Row>
        <Muted>{tr('Humidity')}</Muted>
        <Value v={c.rh_pct} unit="%" digits={0} />
      </Row>
      <Divider />
      <Row>
        <Muted>{tr('Light')}</Muted>
        <Value v={c.lux} unit="lux" digits={0} />
      </Row>
      <Divider />
      <Row>
        <Muted>{tr('Soil sensor 1')}</Muted>
        <Value v={c.soil1_v} unit="V" digits={2} />
      </Row>
      <Divider />
      <Row>
        <Muted>{tr('Soil sensor 2')}</Muted>
        <Value v={c.soil2_v} unit="V" digits={2} />
      </Row>
      <Text style={[type.small, { color: color.fgSubtle, marginTop: space.sm }]}>
        {tr('Soil figures are raw sensor volts. They are not calibrated yet, so they are not a moisture level.')}
      </Text>

      <ChipRow>
        <Chip label={tr('SOIL')} value={tr('UNCALIBRATED')} tone="warn" />
        {c.reading_utc ? <Chip label={tr('TAKEN')} value={formatClock(c.reading_utc)} /> : null}
        {typeof c.battery_v === 'number' ? <Chip label={tr('STATION BATTERY')} value={`${c.battery_v.toFixed(2)} V`} /> : null}
      </ChipRow>

      {old ? (
        <Panel label={tr('Old reading')} tone="warn">
          {tr('This reading was {n} minutes old when the pod collected it.', { n: Math.round(c.age_minutes as number) })}
        </Panel>
      ) : null}
    </Card>
  );
}

/** A reading, or the words for not having one. Never a blank, a zero or a dash. */
function Value({ v, unit, digits }: { v: number | null | undefined; unit: string; digits: number }) {
  return (
    <Text style={[type.valueSmall, { color: color.foreground }]}>
      {typeof v === 'number' && Number.isFinite(v) ? `${v.toFixed(digits)} ${unit}` : tr('not measured')}
    </Text>
  );
}

const s = themed(() => StyleSheet.create({
  headline: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.md },
  strip: { flexDirection: 'row', height: 30, gap: 1, borderRadius: radius.md, overflow: 'hidden' },
  block: { flex: 1, minWidth: 2 },
  blockOn: { borderWidth: 2, borderColor: color.foreground },
  stripAxis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, paddingVertical: space.md },
  itemRule: { borderTopWidth: 1, borderTopColor: color.border },
}));
