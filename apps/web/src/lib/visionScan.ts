import { parsePhotoScan, type PhotoScanResult } from './photoScan.js';

/**
 * The vision half of photo-to-twin: send a phone photo to Claude and get back a structured reading
 * of the rooms and smart devices in it. Kept apart from `photoScan.ts` so the shape-making stays
 * pure and testable while this handles the browser bits, downscaling the image and calling the API.
 *
 * Only Anthropic is wired up: it is multimodal, and Twinhaus already talks to it directly from the
 * browser with the user's own key, so there is no proxy or extra service to stand up.
 */

/** Longest edge we send to the model; Anthropic downsizes past this anyway, so we save upload. */
const MAX_EDGE_PX = 1568;

const INSTRUCTIONS = [
  'You are looking at a photo of part of a home. Read it and return ONLY a JSON object, no prose.',
  'Shape:',
  '{',
  '  "rooms": [{ "name": string, "widthM": number, "depthM": number, "heightM": number }],',
  '  "devices": [{ "category": string, "label": string, "room": string }],',
  '  "note": string',
  '}',
  'Rules:',
  '- Estimate room width and depth in meters from visible cues (doors ~0.8m, counters ~0.9m tall).',
  '- List every smart device or sensor you can see: smart bulbs and lamps, switches, plugs, cameras,',
  '  doorbells, motion or presence sensors, thermostats, smart locks, blinds or shades, speakers,',
  '  TVs, fans, robot vacuums. Use one of these categories: light, switch, lock, climate, sensor,',
  '  motion, camera, media, cover, fan, vacuum, other.',
  '- Set each device "room" to the name of the room it is in.',
  '- If you are unsure of a size, give your best estimate and say so in "note". Do not invent devices.',
].join('\n');

export interface VisionScanOptions {
  apiKey: string;
  model: string;
  file: File;
}

/** Downscale a photo, send it to Claude, and parse the reply into a {@link PhotoScanResult}. */
export async function scanPhoto(options: VisionScanOptions): Promise<PhotoScanResult> {
  if (!options.apiKey) {
    throw new Error('Add your Anthropic API key in Settings to read photos.');
  }
  const image = await downscaleImage(options.file);

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': options.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: options.model,
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: image.mediaType, data: image.base64 },
            },
            { type: 'text', text: INSTRUCTIONS },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic API error (${response.status}): ${await response.text()}`);
  }

  const data = (await response.json()) as {
    content: Array<{ type: string; text?: string }>;
  };
  const text = data.content
    .filter((block) => block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text)
    .join('');

  return parsePhotoScan(text);
}

interface EncodedImage {
  base64: string;
  mediaType: string;
}

/**
 * Shrink a photo so its longest edge is at most {@link MAX_EDGE_PX} and re-encode it as JPEG, then
 * return it base64-encoded. Phone photos are often many megabytes; this keeps the upload small and
 * within the API's per-image limits without hurting what the model can read.
 */
async function downscaleImage(file: File): Promise<EncodedImage> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE_PX / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not process the image in this browser.');
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
  return { base64: dataUrl.split(',')[1] ?? '', mediaType: 'image/jpeg' };
}
