import { describe, expect, it } from 'vitest';
import { editorJsToHtml, htmlToEditorJs, normalizeEditorJsData } from '../serializer';

describe('editorjs serializer', () => {
  it('renders direct video blocks as html5 video', () => {
    const html = editorJsToHtml({
      blocks: [
        {
          type: 'video',
          data: {
            source: 'https://cdn.example.com/demo.mp4',
            service: 'html5video',
            caption: 'Demo clip'
          }
        }
      ]
    });

    expect(html).toContain('<video controls preload="metadata" playsinline>');
    expect(html).toContain('https://cdn.example.com/demo.mp4');
    expect(html).toContain('<figcaption>Demo clip</figcaption>');
  });

  it('keeps iframe rendering for non-direct embeds', () => {
    const html = editorJsToHtml({
      blocks: [
        {
          type: 'embed',
          data: {
            embed: 'https://www.youtube.com/embed/abc123',
            caption: 'Video'
          }
        }
      ]
    });

    expect(html).toContain('<iframe');
    expect(html).not.toContain('<video');
  });

  it('converts figure/video html into video blocks', () => {
    const data = htmlToEditorJs(
      '<figure><video controls><source src="https://cdn.example.com/sample.webm" type="video/webm"></video><figcaption>Sample</figcaption></figure>'
    );

    expect(data.blocks).toHaveLength(1);
    expect(data.blocks[0]?.type).toBe('video');
    expect(data.blocks[0]?.data?.source).toBe('https://cdn.example.com/sample.webm');
    expect(data.blocks[0]?.data?.service).toBe('html5video');
    expect(data.blocks[0]?.data?.caption).toBe('Sample');
  });

  it('renders direct audio blocks as html5 audio', () => {
    const html = editorJsToHtml({
      blocks: [
        {
          type: 'audio',
          data: {
            source: 'https://cdn.example.com/voice.mp3',
            service: 'html5audio',
            caption: 'Voice'
          }
        }
      ]
    });

    expect(html).toContain('<audio controls preload="metadata">');
    expect(html).toContain('https://cdn.example.com/voice.mp3');
    expect(html).toContain('<figcaption>Voice</figcaption>');
  });

  it('converts figure/audio html into audio blocks', () => {
    const data = htmlToEditorJs(
      '<figure><audio controls><source src="https://cdn.example.com/sample.m4a" type="audio/mp4"></audio><figcaption>Narration</figcaption></figure>'
    );

    expect(data.blocks).toHaveLength(1);
    expect(data.blocks[0]?.type).toBe('audio');
    expect(data.blocks[0]?.data?.source).toBe('https://cdn.example.com/sample.m4a');
    expect(data.blocks[0]?.data?.service).toBe('html5audio');
    expect(data.blocks[0]?.data?.caption).toBe('Narration');
  });

  it('normalizes invalid paragraph payloads into safe text values', () => {
    const normalized = normalizeEditorJsData({
      blocks: [
        {
          type: 'paragraph',
          data: { text: { value: 'bad object' } }
        }
      ]
    });

    expect(normalized.blocks).toHaveLength(1);
    expect(normalized.blocks[0]?.type).toBe('paragraph');
    expect(normalized.blocks[0]?.data?.text).toBe('');
  });

  it('normalizes embed-like blocks and removes empty embeds', () => {
    const normalized = normalizeEditorJsData({
      blocks: [
        {
          type: 'video',
          data: { url: 'https://cdn.example.com/clip.mp4' }
        },
        {
          type: 'audio',
          data: { embed: '' }
        }
      ]
    });

    expect(normalized.blocks).toHaveLength(1);
    expect(normalized.blocks[0]?.type).toBe('video');
    expect(normalized.blocks[0]?.data?.service).toBe('html5video');
    expect(normalized.blocks[0]?.data?.source).toBe('https://cdn.example.com/clip.mp4');
  });
});
