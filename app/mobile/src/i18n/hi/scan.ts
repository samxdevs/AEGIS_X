/** Hindi: the scan screen's verdict, crop stage, sensors and scan details. */
export const SCAN: Record<string, string> = {
  // Where the record came from
  'SAMPLE DATA': 'नमूना डेटा',
  'Built into the app for testing. Not from your pod or your field.': 'जाँच के लिए ऐप में पहले से डाला गया। आपके पॉड या खेत का नहीं।',
  'Real model output on a recorded video, not a live scan.': 'रिकॉर्ड किए गए वीडियो पर मॉडल का असली नतीजा, अभी का स्कैन नहीं।',
  'IMPORTED FILE': 'आयात की गई फ़ाइल',
  'Loaded from a file, not pulled from a pod. Check where it came from.': 'फ़ाइल से डाला गया, पॉड से नहीं लिया गया। जाँचें कि यह कहाँ से आई।',
  'SIMULATED MODEL OUTPUT · NOT A MEASUREMENT': 'नकली मॉडल का नतीजा · यह माप नहीं है',
  'RAN ON THE FALLBACK ENGINE': 'बैकअप इंजन पर चला',
  'This advisory was produced by the simulated inference backend, not by the model running on the device. A pod in normal operation refuses to hand these out at all. Nothing here is a reading of a real plant.':
    'यह सलाह नकली मॉडल से बनी है, उपकरण पर चल रहे असली मॉडल से नहीं। सामान्य हालत में पॉड ऐसी सलाह देता ही नहीं। इसमें कुछ भी असली पौधे की माप नहीं है।',
  'Same model, but the pod did not start up normally. Worth telling whoever maintains it.':
    'मॉडल वही है, पर पॉड ठीक से चालू नहीं हुआ। इसकी देखभाल करने वाले को बताएँ।',
  '1 SCHEMA VIOLATION': '1 नियम टूटा',
  '{n} SCHEMA VIOLATIONS': '{n} नियम टूटे',
  'This advisory does not satisfy the contract the pod and this app share. Do not act on it without checking the pod.':
    'यह सलाह पॉड और ऐप के बीच तय नियमों पर खरी नहीं है। पॉड जाँचे बिना इस पर कुछ न करें।',

  // Verdict
  'Looks healthy': 'फसल स्वस्थ दिखती है',
  'Something was found': 'कुछ समस्या मिली',
  'This was not crop': 'यह फसल नहीं थी',
  'Not clear enough to say': 'पक्का नहीं कह सकते',
  'Nothing was scanned': 'कुछ स्कैन नहीं हुआ',
  'The model positively recognised healthy crop. That is a stronger call than "nothing found".':
    'मॉडल ने साफ़ तौर पर स्वस्थ फसल पहचानी। यह "कुछ नहीं मिला" से ज़्यादा पक्की बात है।',
  'Check it by eye before treating anything.': 'कोई दवा डालने से पहले अपनी आँखों से देखें।',
  'Mostly soil, path or hands, so there was nothing to diagnose.': 'ज़्यादातर मिट्टी, रास्ता या हाथ दिखे, इसलिए जाँचने को कुछ नहीं था।',
  'The frames disagreed, so the pod did not pick an answer.': 'तस्वीरों में मेल नहीं था, इसलिए पॉड ने कोई जवाब नहीं चुना।',
  'No frames were evaluated in this scan.': 'इस स्कैन में किसी तस्वीर की जाँच नहीं हुई।',
  'The camera saw more than one crop. Did you cross a field edge or an intercropped strip? The findings below may belong to different crops.':
    'कैमरे को एक से ज़्यादा फसल दिखी। क्या आप खेत की मेड़ या मिली-जुली फसल वाली पट्टी से गुज़रे? नीचे के नतीजे अलग-अलग फसलों के हो सकते हैं।',
  'The frames disagreed too much for one answer to stand out.': 'तस्वीरों में इतना फ़र्क था कि कोई एक जवाब साफ़ नहीं निकला।',
  'Something was seen, but never in two frames in a row, so it was not called.':
    'कुछ दिखा, पर लगातार दो तस्वीरों में कभी नहीं, इसलिए इसे समस्या नहीं माना गया।',
  '{n} of {total} frames agreed': '{total} में से {n} तस्वीरें सहमत',
  agreed: 'सहमत',
  disagreed: 'असहमत',
  unsure: 'पक्का नहीं',
  'What this actually means': 'इसका असल मतलब',
  'Heads up': 'ध्यान दें',

  // Crop stage
  'Just established': 'अभी जमी है',
  'Growing out': 'बढ़ रही है',
  'Full canopy': 'पूरी तरह फैली',
  Ripening: 'पक रही है',
  'day {d} of ~{c}': 'लगभग {c} में से दिन {d}',
  'day {d}': 'दिन {d}',
  'variety assumed': 'किस्म अनुमानित',
  'Not worked out: {why}': 'पता नहीं चला: {why}',
  Season: 'मौसम',
  'Crop stage': 'फसल की अवस्था',
  'CROP STAGE': 'फसल की अवस्था',
  'Day {d}': 'दिन {d}',
  'of ~{c} days': 'लगभग {c} दिनों में से',
  'Not known': 'पता नहीं',
  'Stage not worked out': 'अवस्था पता नहीं चली',
  'WATER FACTOR': 'पानी का गुणांक',
  'Day {d} of an assumed {c}-day cycle.': 'मान ली गई {c} दिन की अवधि का दिन {d}।',
  'Canopy against the stage': 'इस अवस्था के हिसाब से पत्तियों का फैलाव',
  'The scan measured {m}% ground cover. A crop at this stage is usually between {lo}% and {hi}%.':
    'स्कैन में {m}% ज़मीन ढकी मिली। इस अवस्था में फसल आमतौर पर {lo}% से {hi}% तक ढकती है।',
  'Less cover than expected can mean the planting date entered is too early, or that the crop is behind.':
    'उम्मीद से कम फैलाव का मतलब हो सकता है कि बुवाई की तारीख बहुत पहले की डाली गई है, या फसल पीछे है।',
  'More cover than expected usually means the planting date entered is too late.':
    'उम्मीद से ज़्यादा फैलाव का मतलब आमतौर पर है कि बुवाई की तारीख बहुत बाद की डाली गई है।',
  // Prescribed by TEMPLATE_ID_REGISTRY §1.3.
  'Cultivar: Verified by Farmer': 'किसान द्वारा पुष्टि की गई किस्म',
  'Default Variety Assumption': 'मानक किस्म अनुमान',
  'Worked out using the {c}-day cycle you entered for your own seed variety.':
    'आपके बताए अपने बीज की {c} दिन की अवधि से निकाला गया।',
  'No seed variety has been entered, so a regional default of {c} days was assumed. If you know your variety, the stage above will get noticeably better once you enter it.':
    'बीज की किस्म नहीं डाली गई, इसलिए इलाके की सामान्य {c} दिन की अवधि मान ली गई। अगर आपको अपनी किस्म पता है, तो उसे डालने पर ऊपर की अवस्था काफ़ी सटीक हो जाएगी।',

  // Sensors
  'Pod thermal camera': 'पॉड का थर्मल कैमरा',
  'Pod GPS': 'पॉड का जीपीएस',
  'Pod colour camera': 'पॉड का रंगीन कैमरा',
  'Pod infrared camera': 'पॉड का इन्फ्रारेड कैमरा',
  'Air temp / humidity': 'हवा का तापमान / नमी',
  'Soil probes': 'मिट्टी के सेंसर',
  'Sticky trap camera': 'चिपचिपे ट्रैप का कैमरा',
  Thermal: 'थर्मल',
  GPS: 'जीपीएस',
  Camera: 'कैमरा',
  Infrared: 'इन्फ्रारेड',
  'Air sensor': 'हवा का सेंसर',
  'Trap camera': 'ट्रैप कैमरा',
  'needs calibration': 'कैलिब्रेशन बाकी',
  simulated: 'नकली',
  'not connected': 'जुड़ा नहीं',
  WORKING: 'चालू',
  'NEEDS CALIBRATION': 'कैलिब्रेशन बाकी',
  SIMULATED: 'नकली',
  'NOT CONNECTED': 'जुड़ा नहीं',
  'This sensor is connected and working. What it measures directly is real and is shown. A second figure worked out from it needs a calibration step that has not been done, so that figure was left out rather than guessed.':
    'यह सेंसर जुड़ा है और काम कर रहा है। यह जो सीधे मापता है वह असली है और दिखाया गया है। इससे निकलने वाले दूसरे अंक के लिए कैलिब्रेशन चाहिए जो अभी नहीं हुआ, इसलिए उसे अंदाज़े से भरने के बजाय छोड़ दिया गया।',
  'This sensor is being simulated. Nothing that depends on it is a measurement of your field.':
    'यह सेंसर नकली चल रहा है। इस पर निर्भर कुछ भी आपके खेत की माप नहीं है।',
  'This sensor was not connected during the scan. Anything that needed it is missing rather than estimated.':
    'स्कैन के समय यह सेंसर जुड़ा नहीं था। जिसे इसकी ज़रूरत थी वह अंदाज़े से भरने के बजाय छोड़ दिया गया है।',
  'NOT USED: REPLAY': 'इस्तेमाल नहीं: रीप्ले',
  'This scan is a replay of a recorded video. The thermal camera was connected, but it was not looking at the scene in the video, so its reading was left out rather than attached to the wrong field.':
    'यह स्कैन रिकॉर्ड किए गए वीडियो का रीप्ले है। थर्मल कैमरा जुड़ा था, पर वीडियो वाली जगह को नहीं देख रहा था, इसलिए उसकी माप गलत खेत से जोड़ने के बजाय छोड़ दी गई।',
  Provenance: 'स्रोत',
  'Sensors used': 'इस्तेमाल हुए सेंसर',
  'None declared, so nothing shows what was measured': 'कोई नहीं बताया गया, इसलिए पता नहीं क्या मापा गया',
  'Nothing declared': 'कुछ नहीं बताया गया',
  'This advisory does not list the sensors it came from, so there is no way to tell which of its numbers were measured and which were not.':
    'इस सलाह में यह नहीं लिखा कि यह किन सेंसरों से बनी, इसलिए यह जानने का कोई तरीका नहीं कि कौन से अंक मापे गए और कौन से नहीं।',
  '{name} not used (replay)': '{name} इस्तेमाल नहीं हुआ (रीप्ले)',
  'All {n} working': 'सभी {n} चालू',
  '{w} of {n} fully working': '{n} में से {w} पूरी तरह चालू',
  'on the pod you carry': 'आपके हाथ वाले पॉड पर',
  'on the field station': 'खेत के स्टेशन पर',
  "on the farmer's phone": 'किसान के फ़ोन पर',
  'Phone GPS': 'फ़ोन GPS',
  'NOT USED: PHONE GPS': 'इस्तेमाल नहीं: फ़ोन GPS',
  "Positions in this report came from the phone's GPS.": 'इस रिपोर्ट की जगहें फ़ोन के GPS से आईं।',
  '{name} not used (phone GPS)': '{name} इस्तेमाल नहीं हुआ (फ़ोन GPS)',

  // Scan details
  'Scan details': 'स्कैन की जानकारी',
  '{n} of {total} frames used': '{total} में से {n} तस्वीरें इस्तेमाल हुईं',
  'replayed video': 'रिकॉर्ड किया वीडियो',
  Started: 'शुरू',
  Finished: 'खत्म',
  'Frames taken': 'ली गई तस्वीरें',
  'Good enough to use': 'इस्तेमाल लायक',
  'Patches examined': 'जाँचे गए हिस्से',
  '{a} frames were not crop and {b} did not look like anything the model was trained on. Both were set aside before the vote rather than forced into a class.':
    '{a} तस्वीरों में फसल नहीं थी और {b} तस्वीरें ऐसी किसी चीज़ जैसी नहीं थीं जिस पर मॉडल सिखाया गया है। दोनों को किसी श्रेणी में ज़बरदस्ती डालने के बजाय गिनती से अलग रखा गया।',
  'Most frames were discarded': 'ज़्यादातर तस्वीरें हटा दी गईं',
  'Only {n} of {total} frames were sharp and well-lit enough to use. Walking more slowly, holding the pod steadier, or scanning out of hard direct sun will keep more of them.':
    '{total} में से केवल {n} तस्वीरें साफ़ और ठीक रोशनी वाली थीं। धीरे चलने, पॉड को स्थिर पकड़ने, या तेज़ सीधी धूप से बचकर स्कैन करने से ज़्यादा तस्वीरें काम आएँगी।',
  'Distance walked': 'चली गई दूरी',
  'not recorded': 'दर्ज नहीं',
  MODE: 'तरीका',
  ENGINE: 'इंजन',
  SOURCE: 'स्रोत',
  RECORDED: 'रिकॉर्ड किया',
  LIVE: 'अभी का',
  SEQ: 'क्रम',
  'handheld pod': 'हाथ वाला पॉड',
  '{s} s walk': '{s} सेकंड चले',
  '{m} min walk': '{m} मिनट चले',
};
