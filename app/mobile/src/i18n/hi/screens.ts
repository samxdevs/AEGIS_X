/** Hindi: the screens, navigation, lists and the AI explanation card. */
export const SCREENS: Record<string, string> = {
  // Scan screen shell
  'No advisory with that id in the local store.': 'इस पहचान वाली कोई सलाह फ़ोन में नहीं मिली।',
  'This advisory cannot be shown': 'यह सलाह दिखाई नहीं जा सकती',
  'Older format': 'पुराना प्रारूप',
  'What is missing': 'क्या कमी है',
  'This record was stored before the app moved to the current advisory format, so it does not carry everything the screen now reads. It is kept rather than deleted, but it cannot be rendered.':
    'यह रिकॉर्ड ऐप के नए प्रारूप से पहले सहेजा गया था, इसलिए इसमें वह सब नहीं है जो यह स्क्रीन पढ़ती है। इसे मिटाया नहीं गया है, पर दिखाया नहीं जा सकता।',
  'missing "{m}"': '"{m}" नहीं है',
  'Pull again from the pod, or clear the replica on the pod screen, to replace it.':
    'इसे बदलने के लिए पॉड से फिर से डेटा लें, या पॉड स्क्रीन पर फ़ोन का डेटा साफ़ करें।',
  'Field {id}': 'खेत {id}',
  'Scan {n}': 'स्कैन {n}',
  'scan {n}': 'स्कैन {n}',
  'Field readings': 'खेत की माप',
  'What else the pod measured': 'पॉड ने और क्या मापा',
  'About this scan': 'इस स्कैन के बारे में',

  // All scans
  'ALL {n} SCANS · NEWEST FIRST': 'सभी {n} स्कैन · नए पहले',
  '{a} OF {n} SCANS': '{n} में से {a} स्कैन',
  'Show all': 'सब दिखाएँ',
  'No scans yet. Pull from the pod on the Pod tab.': 'अभी कोई स्कैन नहीं है। पॉड टैब पर जाकर पॉड से डेटा लें।',

  // Sync state
  'NEVER SYNCED': 'कभी सिंक नहीं हुआ',
  'Nothing has been pulled from a pod on this phone yet.': 'इस फ़ोन पर अभी तक पॉड से कुछ नहीं लिया गया है।',
  SYNCED: 'सिंक हुआ',
  SYNCING: 'सिंक हो रहा है',
  'Pulling from the pod.': 'पॉड से डेटा लिया जा रहा है।',
  'SYNC FAILED': 'सिंक नहीं हुआ',
  'Last pull did not finish. Open the Pod tab for the reason.': 'पिछली बार डेटा पूरा नहीं आया। कारण जानने के लिए पॉड टैब खोलें।',

  // Home
  'No scans yet': 'अभी कोई स्कैन नहीं',
  "Put this phone on the pod's WiFi, then open the Pod tab and pull. Scans show up here with a map of where the problems are.":
    'इस फ़ोन को पॉड के वाई-फ़ाई से जोड़ें, फिर पॉड टैब खोलकर डेटा लें। स्कैन यहाँ दिखेंगे, साथ में नक्शा भी कि समस्या कहाँ है।',
  'Where to look': 'कहाँ देखें',
  '1 spot': '1 जगह',
  '{n} spots': '{n} जगहें',
  'Every flagged finding with a GPS position from your recent scans. Tap a circle to open its scan.':
    'हाल के स्कैन में मिली हर समस्या, जिसकी जीपीएस जगह पता है। उसका स्कैन खोलने के लिए गोले पर टैप करें।',
  'Circles are about {m} m across the GPS error: a patch of field, not one plant.':
    'हर गोला जीपीएस की लगभग {m} मीटर की चूक दिखाता है: यह खेत का एक हिस्सा है, एक पौधा नहीं।',
  'Nothing to map yet': 'नक्शे पर दिखाने को अभी कुछ नहीं',
  'No flagged finding in your recent scans had a GPS fix. Leaving the pod in open sky for a minute before scanning usually gets one.':
    'हाल के स्कैन की किसी समस्या की जीपीएस जगह नहीं मिली। स्कैन से पहले पॉड को एक मिनट खुले आसमान के नीचे रखने से आमतौर पर जगह मिल जाती है।',
  '1 flagged scan has no GPS positions and is not on the map.': 'समस्या वाले 1 स्कैन की जीपीएस जगह नहीं है, इसलिए वह नक्शे पर नहीं है।',
  '{n} flagged scans have no GPS positions and are not on the map.': 'समस्या वाले {n} स्कैन की जीपीएस जगह नहीं है, इसलिए वे नक्शे पर नहीं हैं।',
  'ALL {n} SCANS ON THIS PHONE': 'इस फ़ोन पर सभी {n} स्कैन',
  RECENT: 'हाल के',
  'See all {n} scans ›': 'सभी {n} स्कैन देखें ›',
  'Opens the latest scan': 'सबसे नया स्कैन खोलता है',
  LATEST: 'सबसे नया',
  'FIELD {id}': 'खेत {id}',
  SAMPLE: 'नमूना',
  REPLAY: 'रीप्ले',
  IMPORTED: 'आयात किया',
  'Right {pct} of the time in tests on new cameras. Check by eye before acting.':
    'नए कैमरों पर जाँच में केवल {pct} बार सही। कुछ करने से पहले अपनी आँखों से देखें।',
  'FIRST THING TO DO': 'सबसे पहले क्या करें',
  'No action in this scan.': 'इस स्कैन में कोई कार्य नहीं है।',
  'Open scan ›': 'स्कैन खोलें ›',

  // Navigation
  'Back to {where}': '{where} पर वापस',
  Back: 'वापस',
  'All scans': 'सभी स्कैन',
  Home: 'होम',
  Scan: 'स्कैन',
  Fields: 'खेत',
  'Pod & sync': 'पॉड और सिंक',
  Profile: 'प्रोफ़ाइल',

  // Fields
  'No scans yet, so no fields to show.': 'अभी कोई स्कैन नहीं है, इसलिए कोई खेत नहीं दिख रहा।',
  '1 NEEDS A LOOK': '1 को देखना ज़रूरी',
  '{n} NEED A LOOK': '{n} को देखना ज़रूरी',
  'LOOKS HEALTHY': 'स्वस्थ दिखता है',
  'No field': 'कोई खेत नहीं',
  'Last scanned {when}': 'आखिरी स्कैन {when}',
  '1 scan': '1 स्कैन',
  '{n} scans': '{n} स्कैन',
  '{n} older scans on the All scans list.': '{n} पुराने स्कैन "सभी स्कैन" सूची में हैं।',

  // Profile
  'Your profile': 'आपकी प्रोफ़ाइल',
  'Settings for this phone.': 'इस फ़ोन की सेटिंग।',
  'Changes every screen in the app, including the advice. Works without internet.':
    'ऐप की हर स्क्रीन बदल जाती है, सलाह भी। बिना इंटरनेट के काम करता है।',
  'Technical messages from the pod, and the scan code on each scan, stay in English.':
    'पॉड के तकनीकी संदेश और हर स्कैन का कोड अंग्रेज़ी में ही रहेंगे।',

  // Profile: AI explanations
  'AI explanations': 'AI से समझाना',
  'IN USE': 'चालू है',
  'Optional. Add your own API key to get a plain-language explanation on each scan. The scan and its advice work fully without it.':
    'ज़रूरी नहीं। हर स्कैन पर आसान भाषा में समझाने के लिए अपनी API कुंजी डालें। स्कैन और उसकी सलाह इसके बिना भी पूरी चलती है।',
  Provider: 'सेवा',
  'API key': 'API कुंजी',
  Model: 'मॉडल',
  'Server address': 'सर्वर का पता',
  Show: 'दिखाएँ',
  Hide: 'छिपाएँ',
  Other: 'अन्य',
  'Get a key at {site}': 'कुंजी यहाँ से लें: {site}',
  'Any service that speaks the OpenAI format, including one running on your own computer.':
    'OpenAI प्रारूप वाली कोई भी सेवा, अपने कंप्यूटर पर चल रही सेवा भी।',
  'Leave empty to use the one shown. Type a model name to use a different one.':
    'दिखाया गया मॉडल लेने के लिए खाली छोड़ें। दूसरा मॉडल लेने के लिए उसका नाम लिखें।',
  Save: 'सहेजें',
  'Test key': 'कुंजी जाँचें',
  'Testing…': 'जाँच हो रही है…',
  Remove: 'हटाएँ',
  'Key works': 'कुंजी चल रही है',
  'Could not connect': 'जुड़ नहीं सका',
  Saved: 'सहेज लिया',
  '{name} answered using {model}.': '{name} ने {model} से जवाब दिया।',
  'Explanations will now use {name}.': 'अब समझाने के लिए {name} इस्तेमाल होगा।',
  'The key stays on this phone. When you ask for an explanation, that scan is sent to the provider you chose, and nothing else is.':
    'कुंजी इसी फ़ोन में रहती है। जब आप समझाने को कहते हैं, तब वही स्कैन आपकी चुनी हुई सेवा को भेजा जाता है, और कुछ नहीं।',

  // Ages
  'just now': 'अभी',
  '{n} min ago': '{n} मिनट पहले',
  '{n} h ago': '{n} घंटे पहले',
  yesterday: 'कल',
  '{n} days ago': '{n} दिन पहले',

  // Counts and rows
  'needs a look': 'को देखना ज़रूरी',
  'need a look': 'को देखना ज़रूरी',
  healthy: 'स्वस्थ',
  unclear: 'साफ़ नहीं',
  'Shows scans that are {what}': 'वे स्कैन दिखाता है जो {what} हैं',
  'Dried leaf, worth a look': 'सूखी पत्ती, एक बार देख लें',
  'Not crop': 'फसल नहीं',
  'Nothing scanned': 'कुछ स्कैन नहीं हुआ',
  'RIGHT {pct} IN TESTS': 'जाँच में {pct} सही',
  'SIMULATED MODEL': 'नकली मॉडल',
  'FALLBACK ENGINE': 'बैकअप इंजन',

  // Map
  'Open scan': 'स्कैन खोलें',
  'No internet, so no satellite image. The positions are the same; only the picture underneath is missing.':
    'इंटरनेट नहीं है, इसलिए सैटेलाइट की तस्वीर नहीं है। जगहें वही हैं; बस नीचे की तस्वीर नहीं है।',
  'Loading satellite image': 'सैटेलाइट की तस्वीर आ रही है',
  'Full screen': 'पूरी स्क्रीन',
  'Full screen map': 'पूरी स्क्रीन पर नक्शा',
  Close: 'बंद करें',
  'Close map': 'नक्शा बंद करें',

  // AI explanation
  'Generated · not a measurement': 'AI से लिखा · यह माप नहीं है',
  'In plain language': 'आसान भाषा में',
  AI: 'AI',
  'Written by AI from the readings above. Every figure is checked against them, and the advice itself comes from the readings, not the AI.':
    'ऊपर की माप से AI ने लिखा है। हर अंक को माप से जाँचा जाता है, और सलाह माप से ही आती है, AI से नहीं।',
  'Not generated yet. This step needs an internet connection. The advisory above does not.':
    'अभी नहीं लिखा गया। इस काम के लिए इंटरनेट चाहिए। ऊपर की सलाह के लिए नहीं।',
  'Explain this advisory': 'यह सलाह समझाएँ',
  'Not configured': 'सेट नहीं है',
  'No AI provider is set, so explanations cannot be generated. Add an API key on the Profile tab. Everything else on this screen works without one.':
    'कोई AI सेवा चुनी नहीं गई है, इसलिए समझाने वाला हिस्सा नहीं बन सकता। प्रोफ़ाइल टैब पर API कुंजी डालें। इस स्क्रीन पर बाकी सब इसके बिना चलता है।',
  'Writing the explanation…': 'समझाने वाला हिस्सा लिखा जा रहा है…',
  GENERATED: 'लिखा गया',
  'Write it again': 'फिर से लिखें',
  'Explanation refused': 'यह समझाना हटा दिया गया',
  'The model wrote figures that are not in this advisory: {figs}. It was discarded rather than shown. A number that was never measured must not reach this screen.':
    'AI ने ऐसे अंक लिखे जो इस सलाह में नहीं हैं: {figs}। इसलिए इसे दिखाया नहीं गया। जो अंक कभी मापा ही नहीं गया, वह इस स्क्रीन पर नहीं आना चाहिए।',
  'Try again': 'फिर कोशिश करें',
  'Could not generate': 'नहीं लिखा जा सका',
};
