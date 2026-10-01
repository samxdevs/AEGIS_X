/**
 * The 21 action templates, and the offline Hindi table keyed on `template_id`.
 *
 * ── Why this file exists at all ─────────────────────────────────────────────
 * The pod emits a rendered English sentence *and* a `template_id` plus a
 * structured `params` map. The second pair is what makes a Hindi UI possible
 * with no connection: the app looks the id up here and substitutes from
 * `params`. Deterministic, auditable, no model, no network, no runtime
 * translation service in an offline-first product.
 *
 * Text is transcribed from `docs/TEMPLATE_ID_REGISTRY.md` (16 September 2026,
 * "BINDING CONTRACT DELIVERABLE"). The English here is a *fallback* — the pod's
 * own `action` string is preferred and rendered verbatim, because the pod is
 * the authority on its own wording and may tighten a dose. This table is what
 * the screen falls back to when the pod sends a template id the English string
 * for which is missing, and what the Hindi view renders from always.
 *
 * ── The safety property, stated precisely ───────────────────────────────────
 * Registry §1.2: because the localised view renders from *this* table and may
 * never read the pod's English `rationale`, a warning that lives only in that
 * rationale can be dropped by switching language. So the edge carries
 * `verification_status` structurally in two places, and this file renders the
 * badge from the structural field — never by pattern-matching prose.
 *
 * `RECALLED_UNVERIFIED` carries a hard requirement: it MUST NOT be displayed
 * without a prominent caution badge. That is enforced in `presentVerification`
 * below and exercised by `templates.test.ts`, not left to each renderer.
 *
 * ── Null safety ─────────────────────────────────────────────────────────────
 * Registry §1.1: on the hardware as it stands, `cwsi` and `soil_moisture_pct`
 * WILL be null, because the MLX90640 references are unconfigured and the ADS1115
 * soil probes are unattached. `interpolate` renders a missing or null param as a
 * written phrase rather than "null", "undefined" or a silently dropped clause.
 *
 * Pure module, no React Native imports — it runs under `node --test`.
 */

import type { Action, VerificationStatus } from './advisory.ts';

export type Language = 'en' | 'hi';

/** Contract §4.3. Frozen at 21; a 22nd id is a contract change, not a patch. */
export const TEMPLATE_IDS = [
  'ACT_EXT_OFFICER_CONSULT',
  'ACT_IRRIGATE_WATER_DEFICIT',
  'ACT_MAINTAIN_ROUTINE',
  'ACT_MULTICROP_INVESTIGATE',
  'ACT_RESCAN_AMBIGUOUS',
  'ACT_TREAT_RICE_BLAST',
  'ACT_TREAT_RICE_BLIGHT',
  'ACT_TREAT_RICE_BROWN_SPOT',
  'ACT_TREAT_RICE_HISPA',
  'ACT_TREAT_RICE_LEAF_ROLLER',
  'ACT_TREAT_RICE_OTHER_DISEASE',
  'ACT_TREAT_RICE_STEM_BORER',
  'ACT_TREAT_RICE_TUNGRO',
  'ACT_TREAT_SUGARCANE_POKKAH_BOENG',
  'ACT_TREAT_SUGARCANE_RED_ROT',
  'ACT_TREAT_SUGARCANE_RUST',
  'ACT_TREAT_SUGARCANE_SMUT',
  'ACT_TREAT_SUGARCANE_VIRAL_ABIOTIC',
  'ACT_TREAT_WHEAT_BROWN_RUST',
  'ACT_TREAT_WHEAT_POWDERY_MILDEW',
  'ACT_TREAT_WHEAT_YELLOW_RUST',
] as const;

export type TemplateId = (typeof TEMPLATE_IDS)[number];

export type TemplateStrings = {
  /** What to do. Placeholders are `{param_name}`, matching `action.params`. */
  action: string;
  /** Why. Carries the citation in the registry's own words. */
  rationale: string;
};

export type TemplateEntry = {
  id: TemplateId;
  /** The status the edge is expected to stamp. Cross-checked, never trusted. */
  verification: VerificationStatus;
  en: TemplateStrings;
  hi: TemplateStrings;
};

/**
 * The registry.
 *
 * Hindi is written the way an extension officer speaks rather than as a literal
 * gloss: chemical names stay in their trade/technical form because that is what
 * is printed on the packet a farmer will buy, and dose units stay numeric
 * because a mis-transcribed dose is the worst failure this table can have.
 */
const ENTRIES: TemplateEntry[] = [
  // ---- Category A: operational and degradation ----------------------------
  {
    id: 'ACT_RESCAN_AMBIGUOUS',
    verification: 'VERIFIED',
    en: {
      action:
        'Re-scan the ambiguous area. Walk at a steady, slow pace (approx. 0.5 m/s) holding the sensor pod steady at 1.0 m above canopy height under diffuse daylight.',
      rationale:
        'Temporal consensus (k >= 2 agreeing frames) was not achieved or image quality was degraded. Citation: SIH PS 26180 Section 5; edge/pipeline.py:175-215; edge/storage.py:118-124.',
    },
    hi: {
      action:
        'जिस हिस्से पर संदेह है उसे दोबारा स्कैन करें। पॉड को फसल की ऊपरी सतह से लगभग 1.0 मीटर ऊपर स्थिर पकड़कर, धीमी और एक-सी चाल (लगभग 0.5 मीटर प्रति सेकंड) से चलें। सीधी तेज़ धूप के बजाय हल्की छाँव वाली रोशनी बेहतर है।',
      rationale:
        'लगातार कम से कम दो फ़्रेम एक ही नतीजे पर नहीं पहुँचे, या तस्वीर की गुणवत्ता कमज़ोर रही। इसलिए कोई नतीजा घोषित नहीं किया गया।',
    },
  },
  {
    id: 'ACT_MULTICROP_INVESTIGATE',
    verification: 'VERIFIED',
    en: {
      action:
        'Inspect plot boundaries or intercropped rows. The camera observed conflicting visual characteristics of multiple crops without a clear supermajority.',
      rationale:
        'Detections span multiple crop taxonomies without reaching the required 85% single-crop supermajority floor. Citation: SIH-TH10 Contract ans_for_vitthal.md §8 S2; edge/storage.py:108-115.',
    },
    hi: {
      action:
        'खेत की मेड़ों और मिश्रित फ़सल वाली कतारों को देखें। कैमरे को एक से अधिक फ़सलों के लक्षण मिले और किसी एक फ़सल की स्पष्ट बहुलता नहीं बनी।',
      rationale:
        'पहचान एक से अधिक फ़सलों में बँट गई और किसी एक फ़सल को ज़रूरी 85% बहुमत नहीं मिला, इसलिए फ़सल तय नहीं की जा सकी।',
    },
  },
  {
    id: 'ACT_MAINTAIN_ROUTINE',
    verification: 'WEB_VERIFIED',
    en: {
      action:
        'Maintain routine crop management and irrigation schedule. Continue weekly scouting without chemical application.',
      rationale:
        "Canopy is confirmed healthy with high consensus across consecutive spatial tiles; prophylactic pesticide application is economically and environmentally unjustified. Citation: DPPQS, Ministry of Agriculture & Farmers Welfare: 'Components of IPM', Section 'Cultural Practices' & 'Chemical Control as Last Resort'.",
    },
    hi: {
      action:
        'फ़सल की सामान्य देखभाल और सिंचाई का क्रम जारी रखें। हर सप्ताह खेत का निरीक्षण करते रहें, कोई दवा छिड़कने की ज़रूरत नहीं है।',
      rationale:
        'लगातार कई हिस्सों में फ़सल स्वस्थ पाई गई। बिना रोग के एहतियातन दवा छिड़कना न तो आर्थिक रूप से सही है और न ही पर्यावरण के लिए। सन्दर्भ: कृषि मंत्रालय (DPPQS), समेकित नाशीजीव प्रबंधन के घटक।',
    },
  },
  {
    id: 'ACT_EXT_OFFICER_CONSULT',
    verification: 'UNSOURCED',
    en: {
      action:
        'Collect a fresh leaf sample showing typical symptoms in a clean paper bag and present it to your nearest Krishi Vigyan Kendra (KVK) or Block Agriculture Extension Officer.',
      rationale:
        'Symptom pattern requires microscopic or laboratory pathogen confirmation before chemical intervention. Citation: Procedural fallback: no published chemical or dose cited.',
    },
    hi: {
      action:
        'लक्षण दिखाने वाली ताज़ी पत्ती का नमूना साफ़ कागज़ के लिफ़ाफ़े में लेकर अपने नज़दीकी कृषि विज्ञान केंद्र (KVK) या ब्लॉक कृषि विस्तार अधिकारी को दिखाएँ।',
      rationale:
        'इन लक्षणों की पुष्टि प्रयोगशाला में ही हो सकती है। जाँच से पहले कोई रासायनिक दवा न डालें। इस सलाह के साथ कोई दवा या मात्रा नहीं दी गई है।',
    },
  },

  // ---- Category B: rice ---------------------------------------------------
  {
    id: 'ACT_TREAT_RICE_BLIGHT',
    verification: 'WEB_VERIFIED',
    en: {
      action:
        'Drain standing water from the field. Immediately withhold all top-dressing of nitrogenous fertilizer. Spray Streptocycline @ 100 ppm (20 g in 200 L water per acre) mixed with Copper Oxychloride 50% WP @ 2.5 g/L (500 g in 200 L water per acre). Repeat after 10–12 days if disease persists.',
      rationale:
        'Excessive nitrogen accelerates bacterial multiplication; drainage reduces microclimate humidity. Combined copper bactericide and antibiotic halts systemic bacterial multiplication. Citation: CIB&RC Major Uses of Pesticides (Fungicides as on 31.03.2026), p. 29 & ICAR-IIRR Technical Bulletin No. 42.',
    },
    hi: {
      action:
        'खेत से खड़ा पानी निकाल दें। नाइट्रोजन वाली खाद (यूरिया आदि) का ऊपरी छिड़काव तुरंत रोक दें। स्ट्रेप्टोसाइक्लिन 100 ppm (20 ग्राम प्रति 200 लीटर पानी, प्रति एकड़) में कॉपर ऑक्सीक्लोराइड 50% WP 2.5 ग्राम प्रति लीटर (500 ग्राम प्रति 200 लीटर पानी, प्रति एकड़) मिलाकर छिड़काव करें। रोग बना रहे तो 10–12 दिन बाद दोहराएँ।',
      rationale:
        'ज़्यादा नाइट्रोजन से जीवाणु तेज़ी से बढ़ते हैं और खड़ा पानी नमी बढ़ाता है। कॉपर और एंटीबायोटिक मिलकर जीवाणु का फैलाव रोकते हैं। सन्दर्भ: CIB&RC कवकनाशी सूची (31.03.2026), पृष्ठ 29 तथा ICAR-IIRR तकनीकी बुलेटिन संख्या 42।',
    },
  },
  {
    id: 'ACT_TREAT_RICE_BLAST',
    verification: 'WEB_VERIFIED',
    en: {
      action:
        'Maintain proper water level in the field. Avoid night irrigation. Spray Tricyclazole 75% WP @ 0.6 g/L (120 g in 200 L water per acre) or Isoprothiolane 40% EC @ 1.5 ml/L (300 ml in 200 L water per acre) at early onset of spindle-shaped lesions.',
      rationale:
        'Tricyclazole specifically inhibits melanin biosynthesis in appressoria of Magnaporthe oryzae, preventing host cuticle penetration. Citation: CIB&RC Major Uses of Pesticides (Fungicides as on 31.03.2026), p. 40 & p. 14.',
    },
    hi: {
      action:
        'खेत में पानी का स्तर सही बनाए रखें और रात में सिंचाई न करें। तकली जैसे धब्बे दिखते ही ट्राइसाइक्लाज़ोल 75% WP 0.6 ग्राम प्रति लीटर (120 ग्राम प्रति 200 लीटर पानी, प्रति एकड़) या आइसोप्रोथायोलेन 40% EC 1.5 मिली प्रति लीटर (300 मिली प्रति 200 लीटर पानी, प्रति एकड़) का छिड़काव करें।',
      rationale:
        'ट्राइसाइक्लाज़ोल कवक को पत्ती की सतह भेदने से रोकता है। शुरुआती अवस्था में छिड़काव सबसे असरदार होता है। सन्दर्भ: CIB&RC कवकनाशी सूची (31.03.2026), पृष्ठ 40 और 14। प्रतीक्षा अवधि 30 दिन।',
    },
  },
  {
    id: 'ACT_TREAT_RICE_BROWN_SPOT',
    verification: 'RECALLED_UNVERIFIED',
    en: {
      action:
        'Apply foliar spray of Mancozeb 75% WP @ 2.5–3.0 g/L (500–600 g in 200 L water per acre) or combi-fungicide Mancozeb 63% + Carbendazim 12% WP @ 2.5 g/L. Supplement with top-dressing of Muriate of Potash (MOP) @ 10 kg/acre if soil potassium is deficient.',
      rationale:
        'Brown spot is aggravated by nutritional stress (specifically potassium and silicon deficiency) in light or drought-prone soils. Citation: Recalled from memory: ICAR-NRRI Cuttack advisory; document unverified offline.',
    },
    hi: {
      action:
        'मैंकोज़ेब 75% WP 2.5–3.0 ग्राम प्रति लीटर (500–600 ग्राम प्रति 200 लीटर पानी, प्रति एकड़) या मैंकोज़ेब 63% + कार्बेन्डाज़िम 12% WP 2.5 ग्राम प्रति लीटर का पत्तियों पर छिड़काव करें। मिट्टी में पोटाश की कमी हो तो 10 किलो प्रति एकड़ म्यूरेट ऑफ़ पोटाश दें।',
      rationale:
        'भूरा धब्बा रोग हल्की या सूखा-प्रवण मिट्टी में पोषक तत्वों, ख़ासकर पोटाश और सिलिकॉन की कमी से बढ़ता है। यह मात्रा किसी मूल सरकारी दस्तावेज़ से जाँची नहीं गई है।',
    },
  },
  {
    id: 'ACT_TREAT_RICE_TUNGRO',
    verification: 'WEB_VERIFIED',
    en: {
      action:
        'Rogue and bury severely stunted yellow-orange hills immediately. Direct chemical sprays at the vector (Green Leafhopper): spray Thiamethoxam 25% WG @ 0.2 g/L (40 g in 200 L water per acre) or Dinotefuran 20% SG @ 0.4 g/L (80 g in 200 L water per acre). No chemical cure exists for the virus itself.',
      rationale:
        'Tungro is caused by a dual viral complex transmitted non-persistently by Nephotettix virescens. Controlling vector leafhoppers halts secondary transmission. Citation: CIB&RC Major Uses of Pesticides (Insecticides as on 31.03.2026), p. 54 & p. 26.',
    },
    hi: {
      action:
        'बुरी तरह बौने और पीले-नारंगी पड़े पौधों को तुरंत उखाड़कर गाड़ दें। दवा वायरस पर नहीं, उसे फैलाने वाले हरे फुदके पर चलाएँ: थायामेथोक्सम 25% WG 0.2 ग्राम प्रति लीटर (40 ग्राम प्रति 200 लीटर पानी, प्रति एकड़) या डाइनोटेफ्यूरान 20% SG 0.4 ग्राम प्रति लीटर (80 ग्राम प्रति 200 लीटर पानी, प्रति एकड़) छिड़कें।',
      rationale:
        'टुंग्रो वायरस का कोई रासायनिक इलाज नहीं है। यह हरे फुदके से फैलता है, इसलिए कीट को रोकने पर ही रोग का फैलाव रुकता है। सन्दर्भ: CIB&RC कीटनाशी सूची (31.03.2026), पृष्ठ 54 और 26। प्रतीक्षा अवधि 14 दिन।',
    },
  },
  {
    id: 'ACT_TREAT_RICE_STEM_BORER',
    verification: 'WEB_VERIFIED',
    en: {
      action:
        'Install pheromone traps @ 8 traps/acre for monitoring. When dead hearts exceed 5% at vegetative stage or 1 egg mass/m² is observed, apply Chlorantraniliprole 0.4% GR @ 4 kg/acre in standing water or spray Cartap Hydrochloride 50% SP @ 2.0 g/L (400 g in 200 L water per acre).',
      rationale:
        "Larvae bore into central tillers causing 'dead heart' during vegetative growth and 'white earhead' at panicle emergence. Systemic ryanodine receptor activators control internal larvae. Citation: CIB&RC Major Uses of Pesticides (Insecticides as on 31.03.2026), p. 13 & p. 12.",
    },
    hi: {
      action:
        'निगरानी के लिए 8 फेरोमोन ट्रैप प्रति एकड़ लगाएँ। कल्ले निकलने की अवस्था में 5% से अधिक "मृत गोभ" दिखें या एक अंडा-समूह प्रति वर्ग मीटर मिले, तो खड़े पानी में क्लोरएंट्रानिलिप्रोल 0.4% GR 4 किलो प्रति एकड़ डालें, या कार्टाप हाइड्रोक्लोराइड 50% SP 2.0 ग्राम प्रति लीटर (400 ग्राम प्रति 200 लीटर पानी, प्रति एकड़) छिड़कें।',
      rationale:
        'सूंडी तने के भीतर घुसकर बीच का कल्ला सुखा देती है और बाली अवस्था में सफ़ेद बाली बनाती है। भीतर छिपी सूंडी पर केवल अंतर्वाही दवा असर करती है। सन्दर्भ: CIB&RC कीटनाशी सूची (31.03.2026), पृष्ठ 13 और 12।',
    },
  },
  {
    id: 'ACT_TREAT_RICE_LEAF_ROLLER',
    verification: 'WEB_VERIFIED',
    en: {
      action:
        'Spray Flubendiamide 39.35% SC @ 0.1 ml/L (20 ml in 200 L water per acre) or Chlorantraniliprole 18.5% SC @ 0.3 ml/L (60 ml in 200 L water per acre) when 2 or more damaged folded leaves with live larvae are seen per hill.',
      rationale:
        'Larvae fold leaves longitudinally and scrape the green mesophyll, leaving white transparent streaks and impairing photosynthesis. Citation: CIB&RC Major Uses of Pesticides (Insecticides as on 31.03.2026), p. 33 & p. 12.',
    },
    hi: {
      action:
        'यदि प्रति पौधा दो या अधिक मुड़ी हुई पत्तियों में जीवित सूंडी दिखे, तो फ्लुबेंडियामाइड 39.35% SC 0.1 मिली प्रति लीटर (20 मिली प्रति 200 लीटर पानी, प्रति एकड़) या क्लोरएंट्रानिलिप्रोल 18.5% SC 0.3 मिली प्रति लीटर (60 मिली प्रति 200 लीटर पानी, प्रति एकड़) छिड़कें।',
      rationale:
        'सूंडी पत्ती को लंबाई में मोड़कर भीतर से हरा भाग खुरच देती है, जिससे सफ़ेद धारियाँ बनती हैं और पौधे का भोजन बनना घट जाता है। सन्दर्भ: CIB&RC कीटनाशी सूची (31.03.2026), पृष्ठ 33 और 12।',
    },
  },
  {
    id: 'ACT_TREAT_RICE_HISPA',
    verification: 'WEB_VERIFIED',
    en: {
      action:
        'Clip and destroy leaf tips harboring grub eggs before chemical application. Spray Chlorpyriphos 20% EC @ 2.5 ml/L (500 ml in 200 L water per acre) or Quinalphos 25% EC @ 2.0–4.0 ml/L (400–800 ml in 200 L water per acre) when pest exceeds 1 adult or 1 damaged leaf per hill.',
      rationale:
        'Adults scrape leaf upper surfaces while grubs mine inside the parenchyma. Tip clipping eliminates major egg clusters prior to spray. Citation: CIB&RC Major Uses of Pesticides (Insecticides as on 31.03.2026), p. 17 & p. 46.',
    },
    hi: {
      action:
        'छिड़काव से पहले अंडों वाली पत्तियों के सिरे काटकर नष्ट कर दें। प्रति पौधा एक वयस्क कीट या एक क्षतिग्रस्त पत्ती से अधिक दिखे तो क्लोरपायरीफॉस 20% EC 2.5 मिली प्रति लीटर (500 मिली प्रति 200 लीटर पानी, प्रति एकड़) या क्विनालफॉस 25% EC 2.0–4.0 मिली प्रति लीटर छिड़कें।',
      rationale:
        'वयस्क कीट पत्ती की ऊपरी सतह खुरचता है और उसकी सूंडी पत्ती के भीतर सुरंग बनाती है। सिरे काटने से अधिकांश अंडे पहले ही हट जाते हैं। सन्दर्भ: CIB&RC कीटनाशी सूची (31.03.2026), पृष्ठ 17 और 46।',
    },
  },
  {
    id: 'ACT_TREAT_RICE_OTHER_DISEASE',
    verification: 'UNSOURCED',
    en: {
      action:
        'Avoid standing water stagnation. Avoid unverified over-the-counter chemical sprays. Consult your local Krishi Vigyan Kendra (KVK) officer for verified local treatment guidance.',
      rationale:
        'Explicitly unsourced: ICAR chemical registration unverified for this class. No published chemical or dose is cited.',
    },
    hi: {
      action:
        'खेत में पानी रुकने न दें। दुकान से बिना जाँची-परखी दवा लेकर न छिड़कें। सही इलाज के लिए अपने कृषि विज्ञान केंद्र (KVK) के अधिकारी से सलाह लें।',
      rationale:
        'इस रोग के लिए कोई प्रमाणित दवा या मात्रा इस प्रणाली में दर्ज नहीं है, इसलिए कोई दवा नहीं बताई जा रही।',
    },
  },

  // ---- Category C: sugarcane ---------------------------------------------
  {
    id: 'ACT_TREAT_SUGARCANE_RED_ROT',
    verification: 'RECALLED_UNVERIFIED',
    en: {
      action:
        'Foliar chemical spraying on standing infected crop is INEFFECTIVE. Immediately uproot and burn wilted clumps along with entire root mass. Disinfect the planting spot with Carbendazim 0.1% (1 g/L). Do NOT take a ratoon crop from this infected field. Plant certified disease-free setts in next cycle.',
      rationale:
        'Colletotrichum falcatum is an internal vascular pathogen colonizing the nodal and internodal pith; surface foliar fungicides cannot penetrate vascular bundles once internal red lesions and white cross-bands develop. Citation: Recalled from memory: ICAR-SBI Publication 214 unverified against physical text.',
    },
    hi: {
      action:
        'खड़ी फ़सल पर पत्तियों पर दवा छिड़कने से कोई लाभ नहीं होगा। सूखते हुए झुंडों को जड़ सहित उखाड़कर तुरंत जला दें। उस जगह की मिट्टी को कार्बेन्डाज़िम 0.1% (1 ग्राम प्रति लीटर) से उपचारित करें। इस खेत से पेड़ी (रटून) फ़सल न लें। अगली बार प्रमाणित रोगमुक्त बीज-टुकड़े ही बोएँ।',
      rationale:
        'यह कवक गन्ने के भीतर की नलिकाओं में बसता है। एक बार भीतर लाल धारियाँ और सफ़ेद पट्टियाँ बन जाने पर ऊपर से छिड़की गई दवा वहाँ पहुँच ही नहीं सकती। यह सलाह किसी मूल दस्तावेज़ से जाँची नहीं गई है।',
    },
  },
  {
    id: 'ACT_TREAT_SUGARCANE_SMUT',
    verification: 'RECALLED_UNVERIFIED',
    en: {
      action:
        'Carefully envelope the characteristic black whip structure in a polythene bag, cut at the base, and burn outside the field to prevent teliospore dissemination. Spray Triadimefon 25% WP @ 1.0 g/L (200 g in 200 L water per acre) or Propiconazole 25% EC @ 1.0 ml/L to protect adjacent uninfected canes.',
      rationale:
        'Smut whips release billions of wind-dispersed teliospores. Enclosing in polythene before excision prevents massive spore showers onto neighboring clumps. Citation: Recalled from memory: ICAR-IISR Bulletin 49 unverified against physical text.',
    },
    hi: {
      action:
        'काले चाबुक जैसी रचना को सावधानी से पॉलीथीन की थैली में ढँक लें, फिर जड़ के पास से काटकर खेत के बाहर जला दें। आसपास के स्वस्थ गन्नों की सुरक्षा के लिए ट्रायडिमेफ़ॉन 25% WP 1.0 ग्राम प्रति लीटर (200 ग्राम प्रति 200 लीटर पानी, प्रति एकड़) या प्रोपिकोनाज़ोल 25% EC 1.0 मिली प्रति लीटर छिड़कें।',
      rationale:
        'इस चाबुक से करोड़ों बीजाणु हवा में उड़ते हैं। काटने से पहले थैली चढ़ा देने पर वे पड़ोस के गन्नों पर नहीं फैलते। यह मात्रा किसी मूल दस्तावेज़ से जाँची नहीं गई है।',
    },
  },
  {
    id: 'ACT_TREAT_SUGARCANE_POKKAH_BOENG',
    verification: 'RECALLED_UNVERIFIED',
    en: {
      action:
        'Apply foliar spray of Copper Oxychloride 50% WP @ 2.5 g/L (500 g in 200 L water per acre) or Carbendazim 50% WP @ 1.0 g/L (200 g in 200 L water per acre) directed into the central leaf whorl. Repeat after 15 days if top rot symptoms persist.',
      rationale:
        'Air-borne conidia infect young spindle leaves during monsoon humidity. Direct whorl drenching halts progression from chlorotic wrinkle phase into top rot and knife-cut phases. Citation: Recalled from memory: ICAR-SBI Advisory unverified against physical text.',
    },
    hi: {
      action:
        'कॉपर ऑक्सीक्लोराइड 50% WP 2.5 ग्राम प्रति लीटर (500 ग्राम प्रति 200 लीटर पानी, प्रति एकड़) या कार्बेन्डाज़िम 50% WP 1.0 ग्राम प्रति लीटर (200 ग्राम प्रति 200 लीटर पानी, प्रति एकड़) का छिड़काव बीच की पत्ती-गुच्छी के भीतर सीधे करें। ऊपरी सड़न के लक्षण बने रहें तो 15 दिन बाद दोहराएँ।',
      rationale:
        'बरसात की नमी में हवा से फैले बीजाणु नई पत्तियों को पकड़ते हैं। गुच्छी के भीतर सीधे दवा पहुँचाने पर रोग ऊपरी सड़न तक नहीं बढ़ पाता। यह सलाह किसी मूल दस्तावेज़ से जाँची नहीं गई है।',
    },
  },
  {
    id: 'ACT_TREAT_SUGARCANE_RUST',
    verification: 'RECALLED_UNVERIFIED',
    en: {
      action:
        'Spray Mancozeb 75% WP @ 2.0 g/L (400 g in 200 L water per acre) or Propiconazole 25% EC @ 1.0 ml/L (200 ml in 200 L water per acre) upon emergence of orange-brown elongated pustules on lower leaf surfaces.',
      rationale:
        'Ergosterol biosynthesis inhibitor halts urediniospore germination and pustule expansion during periods of high relative humidity (>80%). Citation: Recalled from memory: ICAR-IISR pp. 31–33 unverified against physical text.',
    },
    hi: {
      action:
        'पत्तियों की निचली सतह पर नारंगी-भूरे लंबे फफोले दिखते ही मैंकोज़ेब 75% WP 2.0 ग्राम प्रति लीटर (400 ग्राम प्रति 200 लीटर पानी, प्रति एकड़) या प्रोपिकोनाज़ोल 25% EC 1.0 मिली प्रति लीटर (200 मिली प्रति 200 लीटर पानी, प्रति एकड़) छिड़कें।',
      rationale:
        'अधिक नमी में यह कवक तेज़ी से फैलता है। यह दवा बीजाणुओं का अंकुरण और फफोलों का बढ़ना रोकती है। यह मात्रा किसी मूल दस्तावेज़ से जाँची नहीं गई है।',
    },
  },
  {
    id: 'ACT_TREAT_SUGARCANE_VIRAL_ABIOTIC',
    verification: 'WEB_VERIFIED',
    en: {
      action:
        'Do not apply chemical fungicides or bactericides; chemical sprays cannot cure viral, phytoplasma, or temperature-induced symptoms. Rogue diseased clumps showing severe mosaic or grassy shoot. Ensure balanced fertilization.',
      rationale:
        'Viral and phytoplasma diseases are systemically incurable by chemical sprays. Banded chlorosis is a physiological reaction to cold/weather swings that recovers naturally. Citation: DPPQS & NIPHM AESA based IPM Package for Sugarcane, pp. 29, 32.',
    },
    hi: {
      action:
        'कोई कवकनाशी या जीवाणुनाशी दवा न छिड़कें। विषाणु, फाइटोप्लाज़्मा या मौसम से हुए लक्षण दवा से ठीक नहीं होते। तेज़ मोज़ेक या घास जैसी बढ़वार वाले झुंडों को उखाड़ दें। खाद संतुलित मात्रा में दें।',
      rationale:
        'विषाणु जनित रोग पूरे पौधे में फैल जाते हैं और छिड़काव से ठीक नहीं होते। पट्टीदार पीलापन ठंड या मौसम बदलने की प्रतिक्रिया है और अपने आप ठीक हो जाता है। सन्दर्भ: DPPQS एवं NIPHM, गन्ना हेतु AESA आधारित IPM पैकेज, पृष्ठ 29 व 32।',
    },
  },

  // ---- Category D: wheat --------------------------------------------------
  {
    id: 'ACT_TREAT_WHEAT_YELLOW_RUST',
    verification: 'WEB_VERIFIED',
    en: {
      action:
        'Immediately upon first observation of linear yellow pustule stripes on leaves, spray Propiconazole 25% EC (e.g. Tilt) @ 1.0 ml/L (200 ml in 200 L water per acre) or Tebuconazole 25.9% EC @ 1.0 ml/L. Ensure uniform foliar coverage.',
      rationale:
        'Yellow rust is a high-consequence wind-borne epidemic pathogen in North-Western plains. Triazoles provide curative and eradicant action if applied at initial locus stage. Citation: CIB&RC Major Uses of Pesticides (Fungicides as on 31.03.2026), p. 24 & ICAR-IIWBR Karnal Advisory Bulletin.',
    },
    hi: {
      action:
        'पत्तियों पर पीली धारियों जैसे फफोले दिखते ही तुरंत प्रोपिकोनाज़ोल 25% EC (जैसे टिल्ट) 1.0 मिली प्रति लीटर (200 मिली प्रति 200 लीटर पानी, प्रति एकड़) या टेबुकोनाज़ोल 25.9% EC 1.0 मिली प्रति लीटर छिड़कें। छिड़काव पूरी पत्ती पर एक समान होना चाहिए।',
      rationale:
        'पीला रतुआ हवा से बहुत तेज़ी से फैलता है और उत्तर-पश्चिमी मैदानों में महामारी बन जाता है। शुरुआती धब्बे दिखते ही छिड़काव करने पर यह दवा रोग को रोक भी देती है और मिटा भी देती है। सन्दर्भ: CIB&RC कवकनाशी सूची (31.03.2026), पृष्ठ 24; ICAR-IIWBR करनाल।',
    },
  },
  {
    id: 'ACT_TREAT_WHEAT_BROWN_RUST',
    verification: 'WEB_VERIFIED',
    en: {
      action:
        'Spray Propiconazole 25% EC @ 1.0 ml/L (200 ml in 200 L water per acre) or Mancozeb 75% WP @ 2.0 g/L (400 g in 200 L water per acre) when brown scattered round pustules cover >2% of flag leaf area.',
      rationale:
        'Protects flag leaves, which contribute over 50% of photosynthates toward grain filling during reproductive stages. Citation: CIB&RC Major Uses of Pesticides (Fungicides as on 31.03.2026), p. 24 & p. 18; ICAR-IIWBR Karnal.',
    },
    hi: {
      action:
        'ऊपरी (ध्वज) पत्ती के 2% से अधिक हिस्से पर बिखरे भूरे गोल फफोले दिखें तो प्रोपिकोनाज़ोल 25% EC 1.0 मिली प्रति लीटर (200 मिली प्रति 200 लीटर पानी, प्रति एकड़) या मैंकोज़ेब 75% WP 2.0 ग्राम प्रति लीटर (400 ग्राम प्रति 200 लीटर पानी, प्रति एकड़) छिड़कें।',
      rationale:
        'दाना भरने के समय ऊपरी पत्ती अकेले आधे से अधिक भोजन बनाती है, इसलिए उसी को बचाना सबसे ज़रूरी है। सन्दर्भ: CIB&RC कवकनाशी सूची (31.03.2026), पृष्ठ 24 व 18; ICAR-IIWBR करनाल।',
    },
  },
  {
    id: 'ACT_TREAT_WHEAT_POWDERY_MILDEW',
    verification: 'WEB_VERIFIED',
    en: {
      action:
        'Apply foliar spray of Propiconazole 25% EC @ 1.0 ml/L (200 ml in 200 L water per acre) or Sulphur 80% WG / WP @ 2.5 g/L (500 g in 200 L water per acre) upon appearance of white floury patches on lower leaves.',
      rationale:
        'Triazole or elemental sulphur spray halts superficial mycelial growth and conidial germination in humid, shaded microclimates. Citation: CIB&RC Major Uses of Pesticides (Fungicides as on 31.03.2026), p. 35 & p. 40; ICAR-IIWBR Karnal & PAU PoP.',
    },
    hi: {
      action:
        'निचली पत्तियों पर सफ़ेद आटे जैसे धब्बे दिखते ही प्रोपिकोनाज़ोल 25% EC 1.0 मिली प्रति लीटर (200 मिली प्रति 200 लीटर पानी, प्रति एकड़) या सल्फर 80% WG/WP 2.5 ग्राम प्रति लीटर (500 ग्राम प्रति 200 लीटर पानी, प्रति एकड़) छिड़कें।',
      rationale:
        'नम और छायादार वातावरण में यह कवक पत्ती की सतह पर फैलता है। ट्रायज़ोल या गंधक का छिड़काव उसकी बढ़वार और बीजाणु बनना रोक देता है। सन्दर्भ: CIB&RC कवकनाशी सूची (31.03.2026), पृष्ठ 35 व 40; ICAR-IIWBR करनाल एवं PAU पैकेज ऑफ़ प्रैक्टिसेज़।',
    },
  },

  // ---- Category E: irrigation --------------------------------------------
  {
    id: 'ACT_IRRIGATE_WATER_DEFICIT',
    verification: 'VERIFIED',
    en: {
      action:
        'Apply field irrigation. Estimated daily crop water requirement is approximately {etc_mm_day} mm/day. Apply recommended depth of {irrigation_depth_mm} mm.',
      rationale:
        "Computed from the FAO-56 Hargreaves-Samani reference evapotranspiration and the crop coefficient for the current growth stage. Canopy stress index: {cwsi}. Soil moisture: {soil_moisture_pct}. Citation: Allen et al. (1998), FAO Irrigation and Drainage Paper 56: 'Crop Evapotranspiration', Chapters 4 & 6; edge/irrigation_model.py:4-45.",
    },
    hi: {
      action:
        'खेत में सिंचाई करें। अनुमानित दैनिक जल आवश्यकता लगभग {etc_mm_day} मिमी प्रतिदिन है। सुझाई गई सिंचाई गहराई {irrigation_depth_mm} मिमी है।',
      rationale:
        'यह गणना FAO-56 (हरग्रीव्स-सामानी) विधि से निकाले गए संदर्भ वाष्पन-उत्सर्जन और फ़सल की वर्तमान अवस्था के गुणांक से की गई है। फ़सल तनाव सूचकांक: {cwsi}। मिट्टी की नमी: {soil_moisture_pct}। सन्दर्भ: ऐलन आदि (1998), FAO सिंचाई एवं जल निकासी पत्र 56, अध्याय 4 व 6।',
    },
  },
];

export const TEMPLATES: Record<string, TemplateEntry> = Object.fromEntries(
  ENTRIES.map((e) => [e.id, e]),
);

export function isKnownTemplate(id: string): id is TemplateId {
  return Object.prototype.hasOwnProperty.call(TEMPLATES, id);
}

// ---- Verification presentation --------------------------------------------

export type VerificationTone = 'good' | 'neutral' | 'warn' | 'bad' | 'unknown';

export type VerificationPresentation = {
  /** The short badge. Registry §1.2 prescribes the shape of each of these. */
  badge: string;
  tone: VerificationTone;
  /** One line under the action. Never optional on RECALLED_UNVERIFIED. */
  note: string;
  /**
   * True when the registry makes the badge mandatory rather than informational.
   * The renderer may collapse an informational badge; it may not collapse this.
   */
  mandatory: boolean;
};

const PRESENTATION: Record<Language, Record<string, VerificationPresentation>> = {
  en: {
    VERIFIED: {
      badge: 'TRACED TO CODE',
      tone: 'neutral',
      note: 'This instruction comes from the system’s own logic or from a published equation, not from a chemical recommendation.',
      mandatory: false,
    },
    WEB_VERIFIED: {
      badge: 'CIB&RC REGISTERED',
      tone: 'good',
      note: 'The chemical and the dose were checked against the Government of India registered label claim, or against an ICAR institute package of practices.',
      mandatory: false,
    },
    RECALLED_UNVERIFIED: {
      badge: 'DOSE NOT VERIFIED',
      tone: 'bad',
      note: 'This dose was recalled from memory and has NOT been checked against the published bulletin. Confirm it at your Krishi Vigyan Kendra before mixing or spraying anything.',
      mandatory: true,
    },
    UNSOURCED: {
      badge: 'CONSULTATION RECOMMENDED',
      tone: 'warn',
      note: 'No chemical or dose is being recommended here. Take a sample to your nearest Krishi Vigyan Kendra or block extension officer.',
      mandatory: true,
    },
  },
  hi: {
    VERIFIED: {
      badge: 'प्रणाली की गणना',
      tone: 'neutral',
      note: 'यह सलाह प्रणाली की अपनी गणना या प्रकाशित सूत्र पर आधारित है, किसी रासायनिक संस्तुति पर नहीं।',
      mandatory: false,
    },
    WEB_VERIFIED: {
      badge: 'सत्यापित: CIB&RC / ICAR',
      tone: 'good',
      note: 'दवा और मात्रा भारत सरकार के पंजीकृत लेबल दावे या ICAR संस्थान के पैकेज ऑफ़ प्रैक्टिसेज़ से मिलान करके जाँची गई है।',
      mandatory: false,
    },
    RECALLED_UNVERIFIED: {
      badge: 'चेतावनी: मात्रा असत्यापित',
      tone: 'bad',
      note: 'यह मात्रा स्मृति से ली गई है और प्रकाशित बुलेटिन से जाँची नहीं गई है। कुछ भी मिलाने या छिड़कने से पहले कृषि विज्ञान केंद्र से पुष्टि अवश्य करें।',
      mandatory: true,
    },
    UNSOURCED: {
      badge: 'विशेषज्ञ से सलाह लें',
      tone: 'warn',
      note: 'यहाँ कोई दवा या मात्रा नहीं बताई जा रही है। नमूना लेकर नज़दीकी कृषि विज्ञान केंद्र या ब्लॉक कृषि अधिकारी से मिलें।',
      mandatory: true,
    },
  },
};

/**
 * How to render one verification status.
 *
 * An unrecognised status is treated as the most cautious case rather than
 * falling through to a neutral badge. A new enum value shipping from the pod
 * must never arrive on screen looking safer than the ones we know about.
 */
export function presentVerification(
  status: VerificationStatus,
  language: Language = 'en',
): VerificationPresentation {
  const table = PRESENTATION[language] ?? PRESENTATION.en;
  const known = table[status];
  if (known) return known;
  return {
    badge: language === 'hi' ? 'अज्ञात स्रोत' : 'UNRECOGNISED PROVENANCE',
    tone: 'bad',
    note:
      language === 'hi'
        ? `इस सलाह का स्रोत-चिह्न "${status}" इस ऐप को ज्ञात नहीं है। इसे असत्यापित मानें।`
        : `This advice carries a provenance marker this app does not recognise ("${status}"). Treat it as unverified.`,
    mandatory: true,
  };
}

// ---- Rendering ------------------------------------------------------------

/**
 * How a missing or null parameter is written out, per language.
 *
 * Registry §1.1 is explicit that `cwsi` and `soil_moisture_pct` are null on the
 * hardware as it stands. Rendering "null" at a farmer would be worse than
 * useless, and silently dropping the clause would hide that a sensor is absent.
 */
const NOT_MEASURED: Record<Language, string> = {
  en: 'not measured',
  hi: 'मापा नहीं गया',
};

/**
 * Substitutes `{name}` placeholders from an action's params.
 *
 * Booleans and numbers are stringified; null, undefined and the empty string
 * all become the "not measured" phrase; anything structured is JSON-encoded
 * rather than rendered as "[object Object]".
 */
export function interpolate(
  template: string,
  params: Record<string, unknown>,
  language: Language = 'en',
): string {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => {
    const value = params?.[key];
    if (value === null || value === undefined || value === '') return NOT_MEASURED[language];
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  });
}

export type RenderedAction = {
  action: string;
  rationale: string;
  /**
   * False when the app had no entry for this template id and fell back to the
   * pod's English. The UI says so rather than showing English under a Hindi
   * heading with no explanation.
   */
  localised: boolean;
  verification: VerificationPresentation;
  /**
   * True when the pod's `verification_status` disagrees with what the registry
   * says this template carries. Not fatal — the pod is the live authority — but
   * it means one of the two is stale and somebody should know.
   */
  verificationMismatch: boolean;
};

/**
 * Renders one action in one language.
 *
 * English prefers the pod's own rendered string, because the pod is the
 * authority on its own wording. Hindi renders from this table, because there is
 * no Hindi on the wire — that is the entire point of shipping `template_id`.
 */
export function renderAction(action: Action, language: Language = 'en'): RenderedAction {
  const entry = TEMPLATES[action.template_id];
  const verification = presentVerification(action.verification_status, language);
  const verificationMismatch = Boolean(
    entry && action.verification_status && entry.verification !== action.verification_status,
  );

  if (language === 'en') {
    // The pod's string wins when it sent one; the table covers a pod that sent
    // a template id with an empty or missing body.
    const text = action.action?.trim();
    const why = action.rationale?.trim();
    return {
      action: text || (entry ? interpolate(entry.en.action, action.params, 'en') : action.template_id),
      rationale: why || (entry ? interpolate(entry.en.rationale, action.params, 'en') : ''),
      localised: true,
      verification,
      verificationMismatch,
    };
  }

  if (!entry) {
    return {
      action: action.action,
      rationale: action.rationale,
      localised: false,
      verification,
      verificationMismatch,
    };
  }

  return {
    action: interpolate(entry.hi.action, action.params, 'hi'),
    rationale: interpolate(entry.hi.rationale, action.params, 'hi'),
    localised: true,
    verification,
    verificationMismatch,
  };
}
