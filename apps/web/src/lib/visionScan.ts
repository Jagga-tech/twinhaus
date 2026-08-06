import { parsePhotoScan, type PhotoScanResult } from './photoScan.js';
import type { LlmProviderId } from '../store/twinStore.js';

/**
 * The vision half of photo-to-twin: send a phone photo to an AI and get back a structured reading
 * of the rooms and smart devices in it. Kept apart from `photoScan.ts` so the shape-making stays
 * pure and testable while this handles the browser bits, downscaling the image and calling an API.
 *
 * All three of the app's providers are wired up, so this uses whichever one you already run the
 * chat on: Anthropic (Claude), OpenAI (GPT), or a local Ollama vision model. They all read images;
 * the only difference is the request shape, which is why the two paths below diverge.
 */

/** Longest edge we send to the model; providers downsize past this anyway, so we save upload. */
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
  provider: LlmProviderId;
  apiKey: string;
  model: string;
  /** Base URL for OpenAI-compatible gateways or the local Ollama daemon; blank uses the default. */
  baseUrl?: string;
  file: File;
}

/** Downscale a photo, send it to the chosen AI, and parse the reply into a {@link PhotoScanResult}. */
export async function scanPhoto(options: VisionScanOptions): Promise<PhotoScanResult> {
  if (options.provider !== 'ollama' && !options.apiKey) {
    throw new Error(`Add your ${label(options.provider)} API key in Settings to read photos.`);
  }
  const image = await downscaleImage(options.file);
  const text =
    options.provider === 'anthropic'
      ? await callAnthropic(options, image)
      : await callOpenAiCompatible(options, image);
  return parsePhotoScan(text);
}

/** Claude's Messages API: the image rides in a dedicated image block. */
async function callAnthropic(options: VisionScanOptions, image: EncodedImage): Promise<string> {
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
  const data = (await response.json()) as { content: Array<{ type: string; text?: string }> };
  return data.content
    .filter((block) => block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text)
    .join('');
}

/** OpenAI and Ollama both take the chat-completions shape with an `image_url` data URL. */
async function callOpenAiCompatible(
  options: VisionScanOptions,
  image: EncodedImage,
): Promise<string> {
  const base = (options.baseUrl?.trim() || defaultBaseUrl(options.provider)).replace(/\/+$/, '');
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (options.apiKey) headers.authorization = `Bearer ${options.apiKey}`;

  const response = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: options.model,
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: INSTRUCTIONS },
            { type: 'image_url', image_url: { url: image.dataUrl } },
          ],
        },
      ],
    }),
  });
  if (!response.ok) {
    throw new Error(
      `${label(options.provider)} API error (${response.status}): ${await response.text()}`,
    );
  }
  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content ?? '';
}

function defaultBaseUrl(provider: LlmProviderId): string {
  return provider === 'ollama' ? 'http://localhost:11434/v1' : 'https://api.openai.com/v1';
}

function label(provider: LlmProviderId): string {
  return { anthropic: 'Anthropic', openai: 'OpenAI', ollama: 'Ollama' }[provider];
}

interface EncodedImage {
  base64: string;
  mediaType: string;
  dataUrl: string;
}

/**
 * Shrink a photo so its longest edge is at most {@link MAX_EDGE_PX} and re-encode it as JPEG. Phone
 * photos are often many megabytes; this keeps the upload small and within the API's per-image limits
 * without hurting what the model can read. Returns both the raw base64 (for Claude) and the full
 * data URL (for the OpenAI-compatible path).
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
  return { base64: dataUrl.split(',')[1] ?? '', mediaType: 'image/jpeg', dataUrl };
}
