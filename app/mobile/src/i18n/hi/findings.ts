/**
 * Hindi: findings, the map, crop and disease names, pests and the model's
 * trust levels. Disease names use the common Hindi farm names where one is
 * in general use (झोंका, झुलसा, रतुआ, कंडुआ).
 */
export const FINDINGS: Record<string, string> = {
  // Trust labels on each finding
  'USUALLY RIGHT': 'अक्सर सही',
  'OFTEN WRONG': 'अक्सर गलत',
  'RARELY RIGHT': 'शायद ही सही',
  UNTESTED: 'जाँचा नहीं गया',
  'NO TRUST DATA': 'भरोसे की जानकारी नहीं',

  // Findings card
  'What the camera found': 'कैमरे ने क्या पाया',
  'Nothing was flagged in this scan. See the verdict above for what that means. An empty list here is not the same as a clean bill of health.':
    'इस स्कैन में कोई समस्या नहीं मिली। इसका मतलब ऊपर के नतीजे में देखें। यहाँ खाली सूची का मतलब यह नहीं कि फसल पूरी तरह ठीक है।',
  'Check every finding by eye before treating. Tap one for the details.': 'दवा डालने से पहले हर समस्या अपनी आँखों से देखें। जानकारी के लिए किसी एक पर टैप करें।',
  'Show fewer': 'कम दिखाएँ',
  'Show {n} more': '{n} और दिखाएँ',
  'Photos are not kept on the pod.': 'पॉड पर फ़ोटो नहीं रखी जातीं।',
  '1 frame': '1 तस्वीर',
  '{n} frames': '{n} तस्वीरें',
  strongest: 'सबसे पक्का',
  'Right {pct} of the time in tests on new cameras. A prompt to look, not a diagnosis.':
    'नए कैमरों पर जाँच में केवल {pct} बार सही। इसे जाँचने का इशारा समझें, पक्की बीमारी नहीं।',
  'Almost never right in tests on new cameras. A prompt to look, not a diagnosis.':
    'नए कैमरों पर जाँच में लगभग कभी सही नहीं। इसे जाँचने का इशारा समझें, पक्की बीमारी नहीं।',
  'How much to trust this': 'इस पर कितना भरोसा करें',
  'On the independent test set this class was recognised correctly {pct} of the time.':
    'अलग से की गई जाँच में यह समस्या {pct} बार सही पहचानी गई।',
  'Frame it appeared in': 'तस्वीर जिसमें दिखा',
  'Frames it appeared in': 'तस्वीरें जिनमें दिखा',
  'Model certainty': 'मॉडल का यकीन',
  'Right on new cameras': 'नए कैमरों पर सही',
  'Never tested on new cameras': 'नए कैमरों पर कभी जाँचा नहीं',
  'Seen in a single frame. A real lesion usually shows up in several as you walk past it, so this one is worth a second look.':
    'केवल एक तस्वीर में दिखा। असली धब्बा आमतौर पर पास से गुज़रते हुए कई तस्वीरों में दिखता है, इसलिए इसे एक बार और देख लें।',

  // Map
  'The findings sit close together, about {m} m apart on average. Start where they are densest.':
    'समस्याएँ पास-पास हैं, औसतन लगभग {m} मीटर की दूरी पर। जहाँ सबसे ज़्यादा हैं वहाँ से शुरू करें।',
  'The findings are somewhat grouped, about {m} m apart on average.': 'समस्याएँ कुछ हद तक एक साथ हैं, औसतन लगभग {m} मीटर की दूरी पर।',
  'The findings are scattered across the area you scanned, roughly {m} m apart on average, rather than concentrated in one place.':
    'समस्याएँ एक जगह इकट्ठी होने के बजाय स्कैन किए पूरे हिस्से में फैली हैं, औसतन लगभग {m} मीटर की दूरी पर।',
  Clustered: 'एक जगह इकट्ठी',
  'Loosely grouped': 'कुछ हद तक इकट्ठी',
  'Spread out': 'फैली हुई',
  Where: 'कहाँ',
  'Where in the field': 'खेत में कहाँ',
  'Nothing to place on a map': 'नक्शे पर दिखाने को कुछ नहीं',
  'No satellite fix during this scan, and nothing was flagged to place on a map.': 'इस स्कैन में जीपीएस जगह नहीं मिली, और नक्शे पर दिखाने के लिए कोई समस्या नहीं मिली।',
  'Nothing was flagged in this scan, so there is nothing to place on a map.': 'इस स्कैन में कोई समस्या नहीं मिली, इसलिए नक्शे पर दिखाने को कुछ नहीं है।',
  'No GPS position for 1 finding': '1 समस्या की जीपीएस जगह नहीं',
  'No GPS positions for {n} findings': '{n} समस्याओं की जीपीएस जगह नहीं',
  'No positions': 'कोई जगह नहीं',
  '{n} findings were made but none could be positioned because the pod never got a satellite fix. The findings are still real; only their locations are missing.':
    '{n} समस्याएँ मिलीं पर किसी की जगह पता नहीं चली, क्योंकि पॉड को जीपीएस नहीं मिला। समस्याएँ फिर भी असली हैं; बस उनकी जगह पता नहीं है।',
  '{n} findings were made but none could be positioned. The findings are still real; only their locations are missing.':
    '{n} समस्याएँ मिलीं पर किसी की जगह पता नहीं चली। समस्याएँ फिर भी असली हैं; बस उनकी जगह पता नहीं है।',
  'Leaving the pod in open sky for a minute before a scan usually gets a fix. Without one, you get the findings but not a map of where they are.':
    'स्कैन से पहले पॉड को एक मिनट खुले आसमान के नीचे रखने से आमतौर पर जीपीएस मिल जाता है। उसके बिना समस्याएँ तो मिलती हैं, पर उनका नक्शा नहीं।',
  '{n} GPS fixes': '{n} जीपीएस जगहें',
  '{a} of {b} differential': '{b} में से {a} डिफ़रेंशियल',
  'worst spread {v}': 'सबसे ज़्यादा चूक {v}',
  'Each circle is about {m} m across the GPS error, so it marks a patch of the field, not one plant. Use it to find the area, then look around it.':
    'हर गोला जीपीएस की लगभग {m} मीटर की चूक दिखाता है, इसलिए यह खेत का एक हिस्सा है, एक पौधा नहीं। इससे जगह ढूँढें, फिर उसके आसपास देखें।',
  'How much to trust the marks': 'निशानों पर कितना भरोसा करें',
  '1 more finding has no position and is not on the map. The finding is real even where the position is not.':
    '1 और समस्या की जगह पता नहीं, इसलिए वह नक्शे पर नहीं है। जगह पता न होने पर भी समस्या असली है।',
  '{n} more findings have no position and are not on the map. The finding is real even where the position is not.':
    '{n} और समस्याओं की जगह पता नहीं, इसलिए वे नक्शे पर नहीं हैं। जगह पता न होने पर भी समस्याएँ असली हैं।',

  // Pests
  'Sugarcane whitefly and woolly aphid': 'गन्ने की सफ़ेद मक्खी और ऊनी माहू',
  'Yellow stem borer': 'पीला तना छेदक',
  Thrips: 'थ्रिप्स',
  Aphid: 'माहू',
  Whitefly: 'सफ़ेद मक्खी',
  'Brown planthopper': 'भूरा फुदका',
  'Leaf roller': 'पत्ती लपेटक',
  Hispa: 'हिस्पा',

  // Reliability
  'UNRECOGNISED ({tier})': 'अनजाना ({tier})',
  'NO RELIABILITY STATED': 'भरोसे की जानकारी नहीं दी गई',
  'This finding did not state how well its class generalises to cameras the model has not seen, so nothing can be said about how much to trust it.':
    'इस समस्या के साथ यह नहीं बताया गया कि यह नए कैमरों पर कितनी सही बैठती है, इसलिए इस पर कितना भरोसा करें, यह नहीं कहा जा सकता।',
  'HOLDS UP ON NEW CAMERAS': 'नए कैमरों पर भी सही',
  'This class was checked against photographs taken with equipment the model never learned from, and it still recognised most of them. It is the strongest evidence tier in this system.':
    'इस समस्या को ऐसे कैमरों की फ़ोटो पर जाँचा गया जिनसे मॉडल ने कभी नहीं सीखा, और फिर भी उसने ज़्यादातर सही पहचानीं। इस प्रणाली में यह सबसे भरोसेमंद स्तर है।',
  'WEAK ON NEW CAMERAS': 'नए कैमरों पर कमज़ोर',
  'On photographs from equipment the model never learned from, it recognised only some of these cases. Confirm by eye before acting.':
    'ऐसे कैमरों की फ़ोटो पर जिनसे मॉडल ने कभी नहीं सीखा, उसने इनमें से केवल कुछ ही पहचाने। कुछ करने से पहले अपनी आँखों से पुष्टि करें।',
  'FAILED ON NEW CAMERAS': 'नए कैमरों पर विफल',
  'On photographs from equipment the model never learned from, it almost never recognised this condition correctly. A high confidence figure here does not mean the finding is right: the two were measured to be unrelated for this class. Treat it as a prompt to look, not as a diagnosis.':
    'ऐसे कैमरों की फ़ोटो पर जिनसे मॉडल ने कभी नहीं सीखा, उसने इस समस्या को लगभग कभी सही नहीं पहचाना। यहाँ मॉडल का ऊँचा यकीन सही होने का सबूत नहीं है: जाँच में इस समस्या के लिए दोनों का कोई संबंध नहीं मिला। इसे जाँचने का इशारा समझें, पक्की बीमारी नहीं।',
  'NOT TESTED': 'जाँचा नहीं गया',
  'This class did not appear in the independent test set at all, so there is no evidence about how it behaves on a camera the model has not seen. That is not the same as it being reliable.':
    'यह समस्या अलग से की गई जाँच में थी ही नहीं, इसलिए कोई सबूत नहीं कि नए कैमरे पर यह कैसा काम करती है। इसका मतलब यह नहीं कि यह भरोसेमंद है।',

  // Crops and conditions (CLASS_INFO)
  Rice: 'धान',
  Healthy: 'स्वस्थ',
  'Bacterial leaf blight': 'जीवाणु पत्ती झुलसा',
  'Bacterial leaf streak': 'जीवाणु पत्ती धारी',
  'Bacterial panicle blight': 'जीवाणु बाली झुलसा',
  'Rice blast': 'झोंका रोग (ब्लास्ट)',
  'Brown spot': 'भूरा धब्बा रोग',
  'Downy mildew': 'मृदुरोमिल फफूंद',
  'Tungro virus': 'टुंग्रो विषाणु रोग',
  'Rice hispa damage': 'हिस्पा कीट का नुकसान',
  'Leaf roller damage': 'पत्ती लपेटक कीट का नुकसान',
  'Yellow stem borer damage': 'पीला तना छेदक का नुकसान',
  Sugarcane: 'गन्ना',
  'Dried leaf': 'सूखी पत्ती',
  'Mosaic virus': 'मोज़ेक विषाणु रोग',
  'Red rot': 'लाल सड़न रोग',
  Rust: 'रतुआ',
  'Yellow leaf disease': 'पीली पत्ती रोग',
  Smut: 'कंडुआ रोग',
  'Pokkah boeng': 'पोक्का बोइंग',
  'Grassy shoot': 'घासी प्ररोह रोग',
  'Banded chlorosis': 'पट्टीदार पीलापन',
  'Sett rot': 'टुकड़ा सड़न',
  Wheat: 'गेहूँ',
  'Yellow (stripe) rust': 'पीला रतुआ (धारीदार)',
  'Brown (leaf) rust': 'भूरा रतुआ (पत्ती का)',
  'Septoria leaf blotch': 'सेप्टोरिया पत्ती धब्बा',
  'Powdery mildew': 'चूर्णी फफूंद',
  'Not a crop': 'फसल नहीं',

  // Standing caveats
  'Confidence is how sure the model is of its own answer. It is not the chance that the answer is correct. On photographs from cameras this model never trained on, it recovered about a third of cases overall.':
    'यकीन का मतलब है मॉडल अपने जवाब को लेकर कितना पक्का है। इसका मतलब यह नहीं कि जवाब सही होने की संभावना इतनी है। जिन कैमरों से मॉडल ने कभी नहीं सीखा, उनकी फ़ोटो पर वह कुल मिलाकर लगभग एक तिहाई मामले ही पहचान पाया।',
  'Dried leaf detected. This is not a disease. It can follow water stress, normal crop stage, or a nutrient shortage. Check irrigation and crop stage.':
    'सूखी पत्ती मिली। यह कोई बीमारी नहीं है। यह पानी की कमी, फसल की सामान्य अवस्था, या पोषक तत्वों की कमी से हो सकती है। सिंचाई और फसल की अवस्था जाँचें।',
  'The count is every blob the segmenter found on the card, including debris and insects that are not the target. It is a deliberate over-estimate against the threshold, not a species count.':
    'यह गिनती कार्ड पर मिले हर धब्बे की है, कचरा और दूसरे कीड़े भी शामिल हैं। सीमा से तुलना के लिए यह जानबूझकर ज़्यादा गिनती है, किसी एक कीट की गिनती नहीं।',
  'Compares parts of your field against each other. It cannot tell you whether the whole field is healthy.':
    'यह आपके खेत के हिस्सों की आपस में तुलना करता है। यह नहीं बता सकता कि पूरा खेत स्वस्थ है या नहीं।',
};
