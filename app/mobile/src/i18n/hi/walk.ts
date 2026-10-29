/**
 * Hindi: starting, watching and stopping a walk from the app, the warnings and
 * alerts, the walk report, and switching the pod off.
 *
 * The warning sentences are the app's own wording for the pod's codes
 * (SCAN_CONTROL_API.md section 3). Worth a read-through by a Hindi-speaking
 * agronomist before it goes in front of farmers.
 */
export const WALK: Record<string, string> = {
  // Warnings, in the spec's wording
  'Too dark to see the leaves. Scan in daylight or move out of the shade.':
    'पत्ते देखने के लिए बहुत अँधेरा है। दिन की रोशनी में स्कैन करें या छाया से बाहर आएँ।',
  'Too much glare. Tilt the pod away from the sun.': 'चकाचौंध बहुत है। पॉड को सूरज से दूसरी ओर झुकाएँ।',
  'Walk slower. Pictures are coming out blurry.': 'धीरे चलें। तस्वीरें धुँधली आ रही हैं।',
  'Not able to see the leaves clearly. Point it towards the crop.':
    'पत्ते साफ़ नहीं दिख रहे। पॉड को फसल की ओर करें।',
  'Field station not found. Check that it is switched on. The scan continues without weather and soil data.':
    'खेत का स्टेशन नहीं मिला। देखें कि वह चालू है। स्कैन मौसम और मिट्टी के माप के बिना जारी रहेगा।',
  'Pod is getting hot. Keep it out of direct sun.': 'पॉड गरम हो रहा है। इसे सीधी धूप से बचाएँ।',
  'Pod storage almost full.': 'पॉड की जगह लगभग भर गई है।',
  "Storage card not found. Saving to the pod's internal memory.":
    'स्टोरेज कार्ड नहीं मिला। पॉड की अपनी मेमोरी में सहेजा जा रहा है।',
  'Pod notice: {code}': 'पॉड की सूचना: {code}',
  "Can't reach the pod. If you walked away from it, walk closer. If it lost power, switch it on. The walk so far is saved.":
    'पॉड से जुड़ नहीं पा रहे। अगर आप उससे दूर चले गए हैं तो उसके पास आएँ। अगर उसकी बिजली चली गई है तो उसे चालू करें। अब तक की सैर सहेजी हुई है।',
  'Phone battery low ({n}%). Charge soon.': 'फ़ोन की बैटरी कम है ({n}%)। जल्दी चार्ज करें।',

  // Home: the pod, and Start
  'SCAN A FIELD': 'खेत स्कैन करें',
  'Pod ready ✓': 'पॉड तैयार ✓',
  'Pod is starting up': 'पॉड चालू हो रहा है',
  'Checking the pod': 'पॉड देखा जा रहा है',
  'Pod not found': 'पॉड नहीं मिला',
  READY: 'तैयार',
  'The pod answers but is not ready yet. It takes about a minute or two after it is switched on.':
    'पॉड जवाब दे रहा है पर अभी तैयार नहीं है। चालू करने के बाद इसमें एक-दो मिनट लगते हैं।',
  "Check the pod is switched on and this phone is on the pod's WiFi. The Pod tab has the details.":
    'देखें कि पॉड चालू है और यह फ़ोन पॉड के वाई-फ़ाई पर है। पॉड टैब में ब्योरा है।',
  'A scan is already running on the pod. You can open it from here.':
    'पॉड पर एक स्कैन पहले से चल रहा है। आप इसे यहाँ से खोल सकते हैं।',
  'Open running scan': 'चल रहा स्कैन खोलें',
  'Start scan': 'स्कैन शुरू करें',
  'SCAN IN PROGRESS': 'स्कैन चल रहा है',
  'SCAN STOPPED': 'स्कैन रुक गया',
  'WALK REPORT READY': 'चलने की रिपोर्ट तैयार',
  'Your walk is finished': 'आपकी सैर पूरी हुई',
  'Open report': 'रिपोर्ट खोलें',

  // The start sheet
  'Plays a recorded crop video through the pod instead of its camera. The report is labelled as a replay.':
    'पॉड के कैमरे की जगह रिकॉर्ड किया हुआ फसल का वीडियो चलाता है। रिपोर्ट पर "रीप्ले" लिखा होगा।',
  'Pick the field and the crop you are about to walk, then carry the pod through the rows.':
    'जिस खेत और फसल में चलने वाले हैं उसे चुनें, फिर पॉड को कतारों के बीच से ले जाएँ।',
  FIELD: 'खेत',
  'Field name, for example F01': 'खेत का नाम, जैसे F01',
  'Use letters, numbers and dashes only.': 'सिर्फ़ अक्षर, अंक और डैश इस्तेमाल करें।',
  CROP: 'फसल',
  'Choose the crop you are walking. Anything that looks like a different crop is counted as unclear, not as a disease.':
    'जिस फसल में चल रहे हैं उसे चुनें। जो चीज़ किसी दूसरी फसल जैसी दिखे उसे बीमारी नहीं, "साफ़ नहीं" गिना जाएगा।',
  'Could not start': 'शुरू नहीं हो सका',
  'Start replay': 'रीप्ले शुरू करें',
  Cancel: 'रद्द करें',

  // Starting, refusals
  'A scan is already running on the pod.': 'पॉड पर एक स्कैन पहले से चल रहा है।',
  'The pod did not accept that: {detail}': 'पॉड ने इसे नहीं माना: {detail}',
  'The pod did not accept that field or crop.': 'पॉड ने यह खेत या फसल नहीं मानी।',
  'The pod camera is not available. Check the camera cable, then switch the pod off and on.':
    'पॉड का कैमरा उपलब्ध नहीं है। कैमरे का तार देखें, फिर पॉड बंद करके दोबारा चालू करें।',
  'This pod does not support starting a scan from the app yet. It needs the newer pod software.':
    'यह पॉड अभी ऐप से स्कैन शुरू करना नहीं जानता। इसमें नया पॉड सॉफ़्टवेयर चाहिए।',
  'This pod does not support shutting down from the app yet. It needs the newer pod software.':
    'यह पॉड अभी ऐप से बंद होना नहीं जानता। इसमें नया पॉड सॉफ़्टवेयर चाहिए।',

  // The live screen
  Scanning: 'स्कैन हो रहा है',
  'TIME SCANNING': 'स्कैन का समय',
  FINISHING: 'पूरा हो रहा है',
  'Finishing…': 'पूरा हो रहा है…',
  'The pod is saving your walk and making the report. This takes a few seconds. Stay near the pod.':
    'पॉड आपकी सैर सहेज रहा है और रिपोर्ट बना रहा है। इसमें कुछ सेकंड लगते हैं। पॉड के पास रहें।',
  'Starting. The pod is collecting readings from the field station.':
    'शुरू हो रहा है। पॉड खेत के स्टेशन से माप ले रहा है।',
  'The pod stops by itself after {m} minutes.': 'पॉड {m} मिनट बाद अपने आप रुक जाता है।',
  'STRETCHES CHECKED': 'जाँचे गए हिस्से',
  'Need a look': 'देखना ज़रूरी',
  Unclear: 'साफ़ नहीं',
  'LEAF TEMPERATURE': 'पत्ते का तापमान',
  'Not used in a replay': 'रीप्ले में इस्तेमाल नहीं',
  'No reading': 'माप नहीं',
  Waiting: 'इंतज़ार',
  'FIELD STATION': 'खेत का स्टेशन',
  Checking: 'देखा जा रहा है',
  Reachable: 'जुड़ा है',
  '{n} readings': '{n} माप',
  ALERTS: 'चेतावनियाँ',
  'Possible {disease}. Check this plant by eye.': 'संभव है {disease}। इस पौधे को अपनी आँखों से देखें।',
  '1 frame agreeing': '1 तस्वीर सहमत',
  '{n} frames agreeing': '{n} तस्वीरें सहमत',
  '{n} earlier alerts. They are all in the report.': 'पहले की {n} चेतावनियाँ। सब रिपोर्ट में हैं।',
  "Phone location is not allowed for this app. Positions will come from the pod's GPS if it has a fix.":
    'इस ऐप को फ़ोन की लोकेशन की इजाज़त नहीं है। पॉड का GPS मिलने पर जगहें उसी से आएँगी।',
  "Phone location is switched off. Positions will come from the pod's GPS if it has a fix.":
    'फ़ोन की लोकेशन बंद है। पॉड का GPS मिलने पर जगहें उसी से आएँगी।',
  STOP: 'रोकें',
  'Stop scan': 'स्कैन रोकें',
  'Stop the scan?': 'स्कैन रोकें?',
  'The pod will finish and make your report. This takes a few seconds.':
    'पॉड काम पूरा करके आपकी रिपोर्ट बनाएगा। इसमें कुछ सेकंड लगते हैं।',
  'Keep scanning': 'स्कैन जारी रखें',
  'The pod is no longer scanning': 'पॉड अब स्कैन नहीं कर रहा',
  'Could not get the report': 'रिपोर्ट नहीं मिल सकी',
  'The scan stopped': 'स्कैन रुक गया',
  'The pod stopped answering as scanning. If it lost power, it will make a report of the walk when it next starts. Pull from the pod on the Pod tab to get it.':
    'पॉड ने स्कैन चलने का जवाब देना बंद कर दिया। अगर बिजली गई थी तो अगली बार चालू होने पर वह सैर की रिपोर्ट बना देगा। उसे पाने के लिए पॉड टैब में "पॉड से डेटा लें" दबाएँ।',
  'The pod stopped this scan because of a problem, and no report was made. Check the pod, then start again.':
    'पॉड ने किसी गड़बड़ी के कारण यह स्कैन रोक दिया और रिपोर्ट नहीं बनी। पॉड देखें, फिर दोबारा शुरू करें।',
  'The pod finished but did not name a report. Open the Pod tab and pull from the pod to get it.':
    'पॉड का काम पूरा हुआ पर उसने रिपोर्ट का नाम नहीं बताया। पॉड टैब खोलकर पॉड से रिपोर्ट लें।',

  // The walk report
  'Walk report': 'सैर की रिपोर्ट',
  'How your walk went': 'आपकी सैर कैसी रही',
  'TIME WALKED': 'चलने का समय',
  '{total} stretches: {look} need a look, {ok} healthy, {unclear} unclear.':
    '{total} हिस्से: {look} को देखना है, {ok} स्वस्थ, {unclear} साफ़ नहीं।',
  '{n} more were not crop or had no data.': '{n} और हिस्से फसल नहीं थे या उनका डेटा नहीं था।',
  'Timeline of the walk, one block per stretch': 'सैर की समय-रेखा, हर हिस्से का एक खाना',
  'Stretch {n}': 'हिस्सा {n}',
  'Not crop or no data': 'फसल नहीं या डेटा नहीं',
  'No data': 'डेटा नहीं',
  'Not crop': 'फसल नहीं',
  'Alert: possible {disease}': 'चेतावनी: संभव है {disease}',
  problem: 'समस्या',
  'Need a look or alert': 'देखना ज़रूरी या चेतावनी',
  'Where you walked': 'आप कहाँ चले',
  'Each circle is how accurate that position was. It marks a patch of the field, not one plant. Use it to find the area, then look around it.':
    'हर घेरा बताता है कि वह जगह कितनी सटीक थी। यह खेत का एक टुकड़ा दिखाता है, एक पौधा नहीं। इससे इलाका ढूँढें, फिर आसपास देखें।',
  'Check these': 'इन्हें देखें',
  'Nothing was flagged on this walk. Healthy stretches are counted above, not listed.':
    'इस सैर में कुछ चिह्नित नहीं हुआ। स्वस्थ हिस्से ऊपर गिने गए हैं, यहाँ सूची में नहीं हैं।',
  'These are places the model thought might be a problem. It can be wrong, so check each one by eye before treating anything.':
    'ये वे जगहें हैं जहाँ मॉडल को समस्या लगी। वह गलत भी हो सकता है, इसलिए कोई दवा डालने से पहले हर जगह अपनी आँखों से देखें।',
  'Possible {disease}': 'संभव है {disease}',
  'Something was flagged': 'कुछ चिह्नित हुआ',
  'check by eye': 'आँखों से देखें',
  ALERT: 'चेतावनी',
  'Stopped by you': 'आपने रोका',
  'Stopped at the time limit': 'समय सीमा पर रुका',
  'The walk reached the longest the pod will scan, so the pod stopped it by itself. Everything up to then is in this report.':
    'सैर उस सबसे लंबे समय तक पहुँच गई जितना पॉड स्कैन करता है, इसलिए पॉड ने उसे अपने आप रोक दिया। तब तक का सब कुछ इस रिपोर्ट में है।',
  Interrupted: 'बीच में रुक गया',
  'The pod was switched off or lost power before the walk was stopped. This report was built when it next started, from what it had saved. Nothing up to the cut was lost.':
    'सैर रोकने से पहले पॉड बंद हो गया या उसकी बिजली चली गई। यह रिपोर्ट उसके अगली बार चालू होने पर, उसके सहेजे डेटा से बनी। रुकने तक का कुछ भी खोया नहीं।',
  'Stopped by a problem': 'गड़बड़ी से रुका',
  'The pod stopped this walk because of a problem. What it had recorded up to then is in this report.':
    'पॉड ने किसी गड़बड़ी के कारण यह सैर रोक दी। तब तक जो दर्ज हुआ वह इस रिपोर्ट में है।',

  // Field conditions
  'Field conditions': 'खेत की हालत',
  Light: 'रोशनी',
  'Soil sensor 1': 'मिट्टी सेंसर 1',
  'Soil sensor 2': 'मिट्टी सेंसर 2',
  'Soil figures are raw sensor volts. They are not calibrated yet, so they are not a moisture level.':
    'मिट्टी के आँकड़े सेंसर के सीधे वोल्ट हैं। उनका अंशांकन अभी नहीं हुआ, इसलिए वे नमी का स्तर नहीं हैं।',
  SOIL: 'मिट्टी',
  UNCALIBRATED: 'अंशांकन नहीं',
  'Old reading': 'पुराना माप',
  'This reading was {n} minutes old when the pod collected it.':
    'पॉड ने जब यह माप लिया तब वह {n} मिनट पुराना था।',
  'not measured': 'मापा नहीं गया',
  'The field station gave no valid reading for this walk, so there are no weather or soil figures. Nothing is estimated in their place.':
    'इस सैर के लिए खेत के स्टेशन से कोई सही माप नहीं मिला, इसलिए मौसम और मिट्टी के आँकड़े नहीं हैं। उनकी जगह कुछ अंदाज़े से नहीं भरा गया।',

  // About this scan
  walk: 'सैर',
  phone: 'फ़ोन',
  'pod storage': 'पॉड की मेमोरी',
  'pod GPS': 'पॉड का GPS',
  'phone GPS': 'फ़ोन का GPS',
  'Time from {source}.': 'समय {source} से।',
  'Positions from {source}.': 'जगहें {source} से।',

  // Switching the pod off
  'Switch the pod off': 'पॉड बंद करें',
  'Shuts the pod down properly so nothing is lost. If a scan is running it is stopped and saved first. To use the pod again, switch it on by hand.':
    'पॉड को ठीक से बंद करता है ताकि कुछ खोए नहीं। अगर स्कैन चल रहा हो तो पहले उसे रोककर सहेजा जाता है। पॉड दोबारा इस्तेमाल करने के लिए उसे हाथ से चालू करें।',
  'Shut down pod': 'पॉड बंद करें',
  'Shut down the pod?': 'पॉड बंद करें?',
  'If a scan is running it will be stopped and saved first. Then the pod switches itself off. To use it again you will have to switch it on by hand.':
    'अगर स्कैन चल रहा हो तो पहले उसे रोककर सहेजा जाएगा। फिर पॉड अपने आप बंद हो जाएगा। दोबारा इस्तेमाल के लिए उसे हाथ से चालू करना होगा।',
  'Shut down': 'बंद करें',
  'Shutting down': 'बंद हो रहा है',
  'The pod is shutting down. Wait for it to switch itself off before you unplug it.':
    'पॉड बंद हो रहा है। प्लग निकालने से पहले उसके अपने आप बंद होने का इंतज़ार करें।',
  'The pod will start shutting down in {s} seconds. Wait for it to switch itself off before you unplug it.':
    'पॉड {s} सेकंड में बंद होना शुरू करेगा। प्लग निकालने से पहले उसके अपने आप बंद होने का इंतज़ार करें।',
  'Collected automatically': 'अपने आप लिया जाता है',
  'The pod collects from the field station by itself when a scan starts and when it stops. There is nothing to press.':
    'स्कैन शुरू और बंद होने पर पॉड खेत के स्टेशन से अपने आप माप ले लेता है। कुछ दबाने की ज़रूरत नहीं।',
  'Demo: replay crop video': 'डेमो: फसल का वीडियो रीप्ले करें',
};
