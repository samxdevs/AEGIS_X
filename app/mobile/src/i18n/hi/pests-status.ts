/** Hindi: the sticky-trap card, and the explanations for missing readings. */
export const PESTS_STATUS: Record<string, string> = {
  // Trap status labels
  'BELOW THE LIMIT': 'सीमा से नीचे',
  'AT THE LIMIT': 'सीमा पर',
  'OVER THE LIMIT': 'सीमा से ऊपर',
  'NO PUBLISHED LIMIT': 'कोई तय सीमा नहीं',
  'WRONG INSTRUMENT': 'गलत तरीका',
  'PEST NOT RECOGNISED': 'कीट पहचाना नहीं गया',
  'CARD TOO FULL TO COUNT': 'कार्ड गिनने के लिए बहुत भरा',
  'BAD MONITORING WINDOW': 'निगरानी का समय ठीक नहीं',
  'NO START DATE': 'शुरू की तारीख नहीं',
  'A yellow sticky card is not how this pest is monitored, so no count is given for it. A count here would be a meaningless number rather than a low one. Stem borers are monitored on pheromone lure traps; planthoppers are counted by tapping the base of a hill over a tray. Ask your extension officer which applies to this one.':
    'इस कीट की निगरानी पीले चिपचिपे कार्ड से नहीं होती, इसलिए इसकी गिनती नहीं दी गई। यहाँ की गिनती कम नहीं, बेमतलब होती। तना छेदक फ़ेरोमोन ट्रैप से देखे जाते हैं; फुदके पौधे के नीचे ट्रे रखकर थपथपाकर गिने जाते हैं। इसके लिए कौन सा तरीका है, अपने कृषि अधिकारी से पूछें।',
  'The published guidance gives no action threshold for this pest, so there is nothing to compare the count against. That is the source being honest rather than a missing feature. Treat the count as something to watch over time, not as a trigger.':
    'छपी सलाह में इस कीट के लिए कार्रवाई की कोई सीमा नहीं है, इसलिए गिनती की तुलना किसी से नहीं हो सकती। यह स्रोत की ईमानदारी है, कोई कमी नहीं। गिनती पर समय के साथ नज़र रखें, इसे दवा डालने का संकेत न मानें।',
  'The system does not have an entry for this pest, so it cannot say what a normal count looks like.':
    'प्रणाली में इस कीट की जानकारी नहीं है, इसलिए यह नहीं बता सकते कि सामान्य गिनती कितनी होती है।',
  'The card is too crowded for the segmenter to separate individual insects, so the count would be an undercount. Replace the card and start a fresh monitoring window.':
    'कार्ड इतना भरा है कि अलग-अलग कीड़े अलग नहीं किए जा सकते, इसलिए गिनती कम आती। कार्ड बदलें और फिर से निगरानी शुरू करें।',
  'The card has been out for either less than a day or more than a week, and the published threshold assumes something in between. No comparison was made.':
    'कार्ड एक दिन से कम या एक हफ़्ते से ज़्यादा लगा रहा, जबकि छपी सीमा इनके बीच के समय के लिए है। कोई तुलना नहीं की गई।',
  'Nobody recorded when this card was put out, so there is no monitoring window to divide by and no comparison to make.':
    'यह कार्ड कब लगाया गया, यह दर्ज नहीं है, इसलिए निगरानी का समय पता नहीं और तुलना नहीं हो सकती।',
  'small pale winged': 'छोटे हल्के पंख वाले',
  'larger insects': 'बड़े कीड़े',
  debris: 'कचरा',
  'could not classify': 'पहचान नहीं हुई',
  'Not comparable': 'तुलना नहीं हो सकती',
  'No comparison could be made against a published limit.': 'किसी छपी सीमा से तुलना नहीं हो सकी।',
  'CAUGHT ON THE CARD': 'कार्ड पर फँसे',
  'of {n}': '{n} में से',
  below: 'नीचे',
  over: 'ऊपर',
  'act at {n}': '{n} पर कार्रवाई',
  'Past the published point at which the guidance says to intervene.': 'छपी सलाह के अनुसार कार्रवाई की सीमा पार हो गई है।',
  'Exactly at the published intervention point.': 'ठीक छपी हुई कार्रवाई की सीमा पर।',
  'Under the published intervention point.': 'छपी हुई कार्रवाई की सीमा से नीचे।',
  'What that number counts': 'यह गिनती क्या गिनती है',
  'DAYS OUT': 'लगे हुए दिन',
  'PER DAY': 'प्रति दिन',
  'COUNTED BY': 'किसने गिना',
  'SHAPE SEGMENTER': 'आकार पहचानने वाला',
  'The limit is counted across the whole time the card has been out, not per day. The per-day figure is there to show whether numbers are climbing.':
    'सीमा कार्ड लगे रहने के पूरे समय की गिनती पर है, रोज़ की नहीं। रोज़ का अंक यह दिखाने के लिए है कि गिनती बढ़ रही है या नहीं।',
  'WHAT THE SHAPES LOOKED LIKE': 'आकार कैसे दिखे',
  'A guess, not an identification': 'अंदाज़ा, पक्की पहचान नहीं',
  'This breakdown comes from a model trained on traps in Europe and never checked against Indian field conditions. "Small pale winged" does not distinguish whitefly from thrips or aphids. It does not affect the count above or the comparison against the limit. Those come from the shape segmenter.':
    'यह बँटवारा यूरोप के ट्रैप पर सिखाए गए मॉडल से आता है और भारतीय खेतों पर कभी जाँचा नहीं गया। "छोटे हल्के पंख वाले" में सफ़ेद मक्खी, थ्रिप्स और माहू का फ़र्क नहीं होता। इसका ऊपर की गिनती या सीमा की तुलना पर कोई असर नहीं। वे आकार पहचानने वाले से आते हैं।',
  Pest: 'कीट',
  'Sticky trap': 'चिपचिपा ट्रैप',
  'No trap card photographed': 'ट्रैप कार्ड की फ़ोटो नहीं ली गई',
  'STICKY TRAP': 'चिपचिपा ट्रैप',
  'No card': 'कार्ड नहीं',
  'No trap count in this advisory. A card has to be photographed and sent to the pod before there is anything to count. Nothing is assumed in the meantime.':
    'इस सलाह में ट्रैप की गिनती नहीं है। गिनती के लिए पहले कार्ड की फ़ोटो लेकर पॉड को भेजनी होगी। तब तक कुछ भी मान नहीं लिया गया है।',
  '{n} over': '{n} ऊपर',
  Below: 'नीचे',
  'the limit': 'सीमा से',
  'the limits': 'सीमा से',
  '1 pest checked': '1 कीट जाँचा',
  '{n} pests checked': '{n} कीट जाँचे',
  Scale: 'पैमाना',
  'Published guidance assumes four to five traps per acre. This system has one, which samples a spot rather than a field.':
    'छपी सलाह में प्रति एकड़ चार से पाँच ट्रैप माने गए हैं। इस प्रणाली में एक है, जो पूरे खेत के बजाय एक जगह का नमूना लेता है।',
  'Trap card': 'ट्रैप कार्ड',
  'Card {id}': 'कार्ड {id}',
  'Shapes found on the card': 'कार्ड पर मिले आकार',
  'Against the published limit': 'छपी सीमा के मुकाबले',
  'Scale not measured': 'पैमाना नहीं मापा',
  'The pod could not work out how many millimetres a pixel covers ({s}), so it cannot tell a large insect from a small one by size. The total count is still the total count, but anything that depends on insect size is guesswork. Photograph the card flat, with its printed scale marker in frame, to fix this.':
    'पॉड यह नहीं निकाल सका कि तस्वीर का एक बिंदु कितने मिलीमीटर का है ({s}), इसलिए वह आकार से बड़े और छोटे कीड़े में फ़र्क नहीं कर सकता। कुल गिनती फिर भी सही है, पर कीड़े के आकार पर आधारित कुछ भी अंदाज़ा है। ठीक करने के लिए कार्ड को सीधा रखकर, उस पर छपे पैमाने के निशान समेत फ़ोटो लें।',
  'Scale measured': 'पैमाना मापा गया',
  'Scale read from the card at {v} mm per pixel, so size-based sorting is meaningful.': 'कार्ड से पैमाना {v} मिमी प्रति बिंदु पढ़ा गया, इसलिए आकार से बँटवारा सही है।',
  'Folded into advisory {id}. Pull from the pod to see it.': 'सलाह {id} में जोड़ा गया। देखने के लिए पॉड से डेटा लें।',
  "The pod stored the count but did not build a new advisory from it. It will appear in the next scan's advisory.":
    'पॉड ने गिनती रख ली पर उससे नई सलाह नहीं बनाई। यह अगले स्कैन की सलाह में दिखेगी।',

  // Fold and not-measured boxes
  'Hides the details': 'जानकारी छिपाता है',
  'Shows the details': 'जानकारी दिखाता है',
  'NOT MEASURED': 'नहीं मापा',
  'No status given. The advisory does not say why this is missing. Treat this record as untrustworthy.':
    'कोई स्थिति नहीं दी गई। सलाह में यह नहीं लिखा कि यह क्यों नहीं है। इस रिकॉर्ड पर भरोसा न करें।',

  // Why a reading is missing: full sentences
  'The thermal camera is working, but the wet and dry reference pads it measures against have not been set up. Canopy temperature is real; the stress index needs those pads and was not estimated without them.':
    'थर्मल कैमरा काम कर रहा है, पर जिन गीले और सूखे संदर्भ पैड से तुलना होती है वे लगाए नहीं गए हैं। पत्तियों का तापमान असली है; तनाव सूचकांक के लिए वे पैड चाहिए, और उनके बिना अंदाज़ा नहीं लगाया गया।',
  'The wet and dry reference pads were too close in temperature for the stress index to mean anything.':
    'गीले और सूखे संदर्भ पैड का तापमान इतना पास था कि तनाव सूचकांक का कोई मतलब नहीं रहता।',
  'One of the reference pads gave an unsteady reading, so the stress index was not worked out from it.':
    'एक संदर्भ पैड की माप स्थिर नहीं थी, इसलिए उससे तनाव सूचकांक नहीं निकाला गया।',
  'The sensor this needs was not connected during the scan.': 'इसके लिए ज़रूरी सेंसर स्कैन के समय जुड़ा नहीं था।',
  'This scan is a replay of a recorded video. The thermal camera was not pointed at the scene in the video, so its reading would describe somewhere else and was left out. The camera itself is fine.':
    'यह स्कैन रिकॉर्ड किए गए वीडियो का रीप्ले है। थर्मल कैमरा वीडियो वाली जगह की ओर नहीं था, इसलिए उसकी माप किसी और जगह की होती, और उसे छोड़ दिया गया। कैमरा खुद ठीक है।',
  'The second camera and its bench calibration have not landed yet. Nothing is estimated in their place.':
    'दूसरा कैमरा और उसका कैलिब्रेशन अभी तैयार नहीं है। इनकी जगह कोई अंदाज़ा नहीं लगाया गया।',
  'The infrared camera was not found on the pod.': 'पॉड पर इन्फ्रारेड कैमरा नहीं मिला।',
  'No satellite image has been downloaded for this field yet. That step needs an internet connection, which the pod does not have in the field.':
    'इस खेत की कोई सैटेलाइट तस्वीर अभी तक नहीं आई। इसके लिए इंटरनेट चाहिए, जो खेत में पॉड के पास नहीं होता।',
  'Every recent satellite pass over this field was under cloud.': 'इस खेत के ऊपर से सैटेलाइट जब भी हाल में गुज़रा, बादल थे।',
  'The satellite service login is not set up on the pod.': 'पॉड पर सैटेलाइट सेवा का लॉगिन सेट नहीं है।',
  'The boundary of this field has not been entered, so there is no area to read a satellite image over.':
    'इस खेत की सीमा नहीं डाली गई, इसलिए सैटेलाइट तस्वीर किस हिस्से की पढ़ें, यह तय नहीं।',
  'Not enough temperature readings came back from the field station in the last day to work out water use.':
    'पिछले एक दिन में खेत के स्टेशन से तापमान की इतनी माप नहीं आई कि पानी की ज़रूरत निकाली जा सके।',
  'The field station needs at least {h} hours of readings from the last day to work this out.':
    'इसे निकालने के लिए खेत के स्टेशन को पिछले दिन की कम से कम {h} घंटे की माप चाहिए।',
  'The field station needs more hours of readings from the last day to work this out.':
    'इसे निकालने के लिए खेत के स्टेशन को पिछले दिन की और घंटों की माप चाहिए।',
  'It has {h} hours so far.': 'अभी तक {h} घंटे की माप है।',
  'Too little of the frame was canopy. Below that point soil colour dominates and the reading would be about the ground, not the crop.':
    'तस्वीर में पत्तियाँ बहुत कम थीं। इससे कम पर मिट्टी का रंग हावी हो जाता है और माप फसल के बजाय ज़मीन की होती।',
  'Too much of the frame fell outside the range of greens this measure is defined for, so the average would have described a minority of the pixels.':
    'तस्वीर का बहुत बड़ा हिस्सा उन हरे रंगों से बाहर था जिनके लिए यह माप बनी है, इसलिए औसत थोड़े से हिस्से का ही होता।',
  'No frame in this scan passed the checks needed to compute it.': 'इस स्कैन की कोई तस्वीर इसे निकालने के लिए ज़रूरी जाँच में पास नहीं हुई।',
  'The planting date has not been entered, so the crop stage cannot be worked out.': 'बुवाई की तारीख नहीं डाली गई, इसलिए फसल की अवस्था नहीं निकाली जा सकती।',
  'The scan did not settle on one crop, so there is no crop calendar to place it against.': 'स्कैन में एक फसल तय नहीं हुई, इसलिए फसल के कैलेंडर से मिलान नहीं हो सकता।',
  'There is no growth-stage table for this crop in the system.': 'प्रणाली में इस फसल की बढ़त की अवस्थाओं की तालिका नहीं है।',
  'No satellite track was recorded during the walk, so the distance covered is not known.': 'चलते समय जीपीएस से रास्ता दर्ज नहीं हुआ, इसलिए तय की गई दूरी पता नहीं।',
  'Not available.': 'उपलब्ध नहीं।',

  // Why a reading is missing: short phrases for tiles and folded rows
  'Reference pads not set up': 'संदर्भ पैड नहीं लगे',
  'Reference pads gave a bad reading': 'संदर्भ पैड की माप खराब',
  'Sensor not connected': 'सेंसर जुड़ा नहीं',
  'Not used (replayed video)': 'इस्तेमाल नहीं (रीप्ले वीडियो)',
  'Infrared camera not fitted yet': 'इन्फ्रारेड कैमरा अभी नहीं लगा',
  'Infrared camera not found': 'इन्फ्रारेड कैमरा नहीं मिला',
  'No satellite image downloaded': 'सैटेलाइट तस्वीर नहीं आई',
  'Cloudy on every recent satellite pass': 'हाल में हर बार बादल थे',
  'Satellite login not set up': 'सैटेलाइट लॉगिन सेट नहीं',
  'Field boundary not entered': 'खेत की सीमा नहीं डाली',
  'Field station needs more readings': 'स्टेशन को और माप चाहिए',
  'Station has {f} h of readings, needs {n} h': 'स्टेशन के पास {f} घंटे की माप है, {n} घंटे चाहिए',
  'Too little crop in the frame': 'तस्वीर में बहुत कम फसल',
  'Colours outside the measurable range': 'रंग मापने की सीमा से बाहर',
  'No usable frames': 'काम की कोई तस्वीर नहीं',
  'Planting date not entered': 'बुवाई की तारीख नहीं डाली',
  'Scan saw more than one crop': 'स्कैन में एक से ज़्यादा फसल',
  'No stage table for this crop': 'इस फसल की अवस्था तालिका नहीं',
  'No GPS track recorded': 'जीपीएस रास्ता दर्ज नहीं',
  'Not available': 'उपलब्ध नहीं',
  MEASURED: 'मापा गया',
  PROVISIONAL: 'अस्थायी',
  'Read this first': 'पहले यह पढ़ें',
  'Where this comes from': 'यह कहाँ से आया',
};
