/**
 * One advisory, rendered entirely from the schema.
 *
 * The ordering is deliberate and is the argument this screen makes:
 *
 *   1. what you cannot trust about this record   origin, backend, violations
 *   2. the verdict, in one sentence              crop_health
 *   3. what to do                                actions, then the explanation
 *   3b. the walk report, for a walk from the app  summary, timeline, look-list
 *   4. Details, closed until tapped:
 *        the findings and how much they are worth  disease
 *        where they are                            detections, on a map
 *        the field readings                        water, vegetation, pest, season
 *        how it was collected                      inputs, scan, advisory id
 *
 * Provenance before verdict, verdict before advice, advice before evidence.
 *
 * ── Why Details is closed ───────────────────────────────────────────────────
 * With every card open the screen ran to five phone-heights. Sections 1 to 3
 * are what a farmer acts on and stay open; section 4 is for checking and opens
 * on one tap, so nothing was removed. The reliability warning for a finding is
 * not lost by this: the verdict card and the action's mandatory caution carry
 * it above the fold.
 */

import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getAdvisory, topFinding } from '../../../src/db/advisories.ts';
import type { StoredAdvisory } from '../../../src/db/advisories.ts';
import {
  ActionsCard,
  BackendBanner,
  CropHealthCard,
  GrowthStageCard,
  InputsCard,
  OriginBanner,
  ScanCard,
  ViolationsCard,
  formatWhen,
} from '../../../src/ui/advisory.tsx';
import { DetectionsCard, DiseaseCard } from '../../../src/ui/detections.tsx';
import { PestCard } from '../../../src/ui/pest.tsx';
import { VegetationCard } from '../../../src/ui/vegetation.tsx';
import { IrrigationCard, NdviCard, ThermalCard } from '../../../src/ui/water.tsx';
import { Card, DetailsSection, Group, Muted, TileGrid } from '../../../src/ui/components.tsx';
import { Reveal } from '../../../src/ui/motion.tsx';
import { ExplanationCard } from '../../../src/ui/explanation.tsx';
import { WalkReport } from '../../../src/ui/walk-report.tsx';
import { isWalkReport } from '../../../src/scan/report.ts';
import { missingBlocks } from '../../../src/schema/validate.ts';
import type { Language } from '../../../src/schema/templates.ts';
import { fieldIdFromAdvisoryId } from '../../../src/schema/advisory.ts';
import { useBarClearance } from '../../../src/ui/floating-bar.ts';
import { useStatusBarStyle } from '../../../src/ui/status-bar.ts';
import { color, space, type } from '../../../src/ui/theme.ts';
import { useLanguage } from '../../../src/i18n/language.tsx';
import { tr } from '../../../src/i18n/tr.ts';

export default function AdvisoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [stored, setStored] = useState<StoredAdvisory | null | 'loading'>('loading');
  /**
   * The language the *template* actions render in.
   *
   * Deliberately separate from the explanation card's own picker. This one
   * switches deterministic offline text that ships in the app; that one asks a
   * model over the internet. Sharing one control would suggest the two have the
   * same availability, and in a field they emphatically do not.
   */
  const { language: appLanguage } = useLanguage();
  const [language, setLanguage] = useState<Language>(appLanguage);
  // Follows the app language when that changes; the card's own switch can
  // still flip it for one scan, for reading the same advice in the other.
  useEffect(() => setLanguage(appLanguage), [appLanguage]);
  const insets = useSafeAreaInsets();
  useStatusBarStyle('light');
  const clearance = useBarClearance();

  useEffect(() => {
    if (!id) return;
    void getAdvisory(id).then(setStored);
  }, [id]);

  if (stored === 'loading') return null;

  if (!stored) {
    return (
      <View style={{ flex: 1, padding: space.lg, backgroundColor: color.background }}>
        <Muted>{tr('No advisory with that id in the local store.')}</Muted>
      </View>
    );
  }

  const a = stored.advisory;

  /**
   * A record this build cannot walk.
   *
   * Almost always a record stored under an older schema — it was valid when it
   * arrived, and the contract moved underneath it. Contract v1.0 did exactly
   * that: it replaced the old `water` block with `thermal`, `ndvi`,
   * `ndvi_satellite` and `irrigation`, so every record written before it lands
   * here. The renderer reads these blocks without checking, so rather than
   * scatter optional chaining through every card and hope, the screen stops and
   * says what is wrong.
   */
  const missing = missingBlocks(a);
  if (missing.length > 0) {
    return (
      <ScrollView
        style={{ backgroundColor: color.background }}
        contentContainerStyle={{ padding: space.lg, paddingBottom: clearance }}
      >
        <OriginBanner origin={stored.origin} />
        <Text style={[type.title, { color: color.foreground }]}>{tr('This advisory cannot be shown')}</Text>
        <Text style={[type.valueSmall, { color: color.mutedForeground, marginBottom: space.lg }]}>
          {a?.advisory_id ?? id}
        </Text>
        <Card eyebrow={tr('Older format')} title={tr('What is missing')}>
          <Muted>
            {tr('This record was stored before the app moved to the current advisory format, so it does not carry everything the screen now reads. It is kept rather than deleted, but it cannot be rendered.')}
          </Muted>
          <View style={{ marginTop: space.md }}>
            {missing.map((m) => (
              <Text key={m} style={[type.valueSmall, { color: color.destructive, marginBottom: 2 }]}>
                • {tr('missing "{m}"', { m })}
              </Text>
            ))}
          </View>
          <Muted>
            {tr('Pull again from the pod, or clear the replica on the pod screen, to replace it.')}
          </Muted>
        </Card>
        <ViolationsCard violations={stored.violations} />
      </ScrollView>
    );
  }

  const fieldId = fieldIdFromAdvisoryId(a.advisory_id);
  const heading = fieldId ? tr('Field {id}', { id: fieldId }) : tr('Scan {n}', { n: a.seq });

  return (
    <ScrollView
      style={{ backgroundColor: color.background }}
      contentContainerStyle={{ padding: space.lg, paddingBottom: clearance }}
    >
      {/* The header names the field, so the screen title does not have to. */}
      <Stack.Screen options={{ title: heading }} />

      {/* When and where, as a person says it. The advisory id is for the pod
          log and lives under Scan details. */}
      <Text style={[type.valueSmall, { color: color.mutedForeground, marginBottom: space.md }]}>
        {`${formatWhen(a.generated_at_utc)} · ${tr('scan {n}', { n: a.seq })}`}
      </Text>

      {/* Everything that qualifies the record comes before the record. */}
      <OriginBanner origin={stored.origin} />
      <BackendBanner advisory={a} />
      <ViolationsCard violations={stored.violations} />

      {/* The verdict a farmer came for, then the first thing to do. */}
      <Reveal index={0}>
        <CropHealthCard health={a.crop_health} topClass={topFinding(a)} />
      </Reveal>

      {/* The language switch lives in this card's header, because it changes
          this card and nothing else, and a farmer who cannot read the English
          needs to find it before giving up on the screen. */}
      <Reveal index={1}>
        <ActionsCard actions={a.actions} language={language} onLanguageChange={setLanguage} />
      </Reveal>

      {/* A walk run from the app: the places to look come straight after the
          advice, because they are the next thing to act on. */}
      {isWalkReport(a) ? <WalkReport advisory={a} /> : null}

      {/* After the pod's own actions, never instead of them. Renders nothing
          on a build with no model endpoint. */}
      <ExplanationCard advisory={a} />

      {/* Findings, map, readings and scan facts are for checking, not for
          deciding, so they sit behind one tap. Nothing here was removed. */}
      <DetailsSection note={tr('Findings, map, field readings and how this scan was made')}>
        <DiseaseCard advisory={a} />
        <DetectionsCard advisory={a} />
        <TileGrid eyebrow={tr('Field readings')} title={tr('What else the pod measured')}>
          <ThermalCard thermal={a.thermal} />
          <IrrigationCard irrigation={a.irrigation} />
          <VegetationCard vegetation={a.vegetation} />
          <NdviCard probe={a.ndvi} satellite={a.ndvi_satellite} />
          <GrowthStageCard stage={a.growth_stage} />
          <PestCard pest={a.pest} />
        </TileGrid>
        <Group eyebrow={tr('About this scan')}>
          <InputsCard inputs={a.inputs} thermalReason={a.thermal?.reason} gpsSource={a.gps?.source} />
          <ScanCard advisory={a} />
        </Group>
        <Text style={[type.valueSmall, { color: color.fgSubtle, textAlign: 'center', marginTop: space.sm }]}>
          {a.advisory_id}
        </Text>
      </DetailsSection>
    </ScrollView>
  );
}
