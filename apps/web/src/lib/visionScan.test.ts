import { describe, expect, it } from 'vitest';
import { isNoVisionReply, visionUnsupportedHelp, visionUnsupportedMessage } from './visionScan.js';

describe('visionUnsupportedMessage', () => {
  it('recognizes an OpenAI "does not support image" error', () => {
    const body = JSON.stringify({
      error: { message: 'This model does not support image input.', type: 'invalid_request_error' },
    });
    const message = visionUnsupportedMessage('gpt-3.5-turbo', body);
    expect(message).toContain('gpt-3.5-turbo');
    expect(message).toContain('vision-capable');
  });

  it('recognizes an "image_url is invalid for this model" style error', () => {
    const body = 'Invalid content type: image_url is not accepted by this model.';
    expect(visionUnsupportedMessage('some-model', body)).not.toBeNull();
  });

  it('recognizes an Ollama non-vision model error', () => {
    expect(visionUnsupportedMessage('llama3.1', 'llama3.1 does not support images')).not.toBeNull();
  });

  it('leaves an unrelated error (missing model, rate limit) to surface raw', () => {
    expect(visionUnsupportedMessage('claude-foo', 'model: claude-foo not found')).toBeNull();
    expect(visionUnsupportedMessage('gpt-4o', 'Rate limit exceeded, try again later')).toBeNull();
    expect(visionUnsupportedMessage('x', 'invalid x-api-key header')).toBeNull();
  });
});

describe('isNoVisionReply', () => {
  it('catches a text-only model that politely declines', () => {
    expect(isNoVisionReply("I'm a text-based model and cannot see images.")).toBe(true);
    expect(isNoVisionReply('Sorry, I am unable to view the image you provided.')).toBe(true);
  });

  it('does not flag a normal JSON answer', () => {
    expect(isNoVisionReply('{"rooms":[{"name":"Kitchen"}],"devices":[]}')).toBe(false);
  });
});

describe('visionUnsupportedHelp', () => {
  it('names the model when known and stays generic otherwise', () => {
    expect(visionUnsupportedHelp('gpt-4-turbo')).toContain('"gpt-4-turbo"');
    expect(visionUnsupportedHelp('  ')).toContain('This model');
  });
});
