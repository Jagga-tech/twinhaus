import { parsePhotoScan, type PhotoScanResult } from './photoScan.js';
import { providerNeedsKey, type LlmProviderId } from '../store/twinStore.js';

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
  if (providerNeedsKey(options.provider) && !options.apiKey) {
    throw new Error(`Add your ${label(options.provider)} API key in Settings to read photos.`);
  }
  if (options.provider === 'custom' && !options.baseUrl?.trim()) {
    throw new Error('Add the endpoint base URL for your custom provider in Settings.');
  }
  const image = await downscaleImage(options.file);
  const text =
    options.provider === 'anthropic'
      ? await callAnthropic(options, image)
      : await callOpenAiCompatible(options, image);
  // A text-only model may return 200 but politely say it cannot see the image; catch that too.
  if (isNoVisionReply(text)) throw new Error(visionUnsupportedHelp(options.model));
  return parsePhotoScan(text);
}

/** The one clear, actionable message we show whenever the chosen model cannot read images. */
export function visionUnsupportedHelp(model: string): string {
  const name = model.trim() ? `The model "${model.trim()}"` : 'This model';
  return `${name} can't read images. Open Settings and pick a vision-capable model, for example Claude (any Claude 3 or newer), OpenAI GPT-4o, or a local Ollama vision model like llava.`;
}

/**
 * Decide whether a failed API response means the model cannot read images (as opposed to a bad key,
 * a missing model, or a rate limit). Providers phrase this differently, so we look for the response
 * mentioning an image or vision alongside a "not supported / invalid" signal. Returns the friendly
 * help message when it matches, or null to let the caller surface the raw error.
 */
export function visionUnsupportedMessage(model: string, body: string): string | null {
  const text = body.toLowerCase();
  const mentionsImage =
    text.includes('image') || text.includes('vision') || text.includes('multimodal');
  const mentionsUnsupported = [
    'not support',
    "doesn't support",
    'does not support',
    'unsupported',
    'only supported',
    'cannot process',
    'can not process',
    'no vision',
    'not a vision',
    'invalid',
  ].some((phrase) => text.includes(phrase));
  return mentionsImage && mentionsUnsupported ? visionUnsupportedHelp(model) : null;
}

/** Detect a 200-OK reply where a text-only model says, in prose, that it cannot see the image. */
export function isNoVisionReply(text: string): boolean {
  const lower = text.toLowerCase();
  return [
    'cannot see',
    "can't see",
    'unable to see',
    'unable to view',
    'cannot view',
    "can't view",
    'do not have the ability to see',
    "don't have the ability to see",
    'cannot process image',
    'as a text-based',
    'text-only model',
  ].some((phrase) => lower.includes(phrase));
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
    const body = await response.text();
    throw new Error(
      visionUnsupportedMessage(options.model, body) ??
        `Anthropic API error (${response.status}): ${body}`,
    );
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
    const body = await response.text();
    throw new Error(
      visionUnsupportedMessage(options.model, body) ??
        `${label(options.provider)} API error (${response.status}): ${body}`,
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
  return { anthropic: 'Anthropic', openai: 'OpenAI', ollama: 'Ollama', custom: 'Custom endpoint' }[
    provider
  ];
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
