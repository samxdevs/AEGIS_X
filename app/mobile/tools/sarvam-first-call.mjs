/**
 * One Sarvam speech-to-text call, to prove the key and the endpoint before the
 * app depends on either. The language is left for Sarvam to detect, because a
 * farmer is not going to pick one from a list before speaking.
 *
 *   node --env-file=.env tools/sarvam-first-call.mjs path/to/question.wav
 */

import { createReadStream } from 'node:fs';
import { SarvamAIClient } from 'sarvamai';

const file = process.argv[2];
if (!file) {
  console.error('usage: node --env-file=.env tools/sarvam-first-call.mjs <audio file>');
  process.exit(1);
}
if (!process.env.SARVAM_API_KEY) {
  console.error('SARVAM_API_KEY is not set. Put it in mobile/.env and run with --env-file=.env.');
  process.exit(1);
}

const client = new SarvamAIClient({ apiSubscriptionKey: process.env.SARVAM_API_KEY });
const result = await client.speechToText.transcribe({
  file: createReadStream(file),
  model: 'saaras:v3',
  language_code: 'unknown',
});

console.log(JSON.stringify(result, null, 2));
