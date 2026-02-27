import { sanitizeHtml } from '../utils/data-transform.js';
import type { EditorJSBlock, EditorJSData } from './types.js';

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const isDirectVideoUrl = (value: unknown) =>
  typeof value === 'string' && /\.(mp4|webm|ogg)(\?.*)?$/i.test(value.trim());

const isDirectAudioUrl = (value: unknown) =>
  typeof value === 'string' && /\.(mp3|wav|ogg|m4a|aac)(\?.*)?$/i.test(value.trim());

const coerceTextValue = (value: unknown) => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
};

const normalizeMediaService = (source: string, service?: unknown): string | undefined => {
  if (typeof service === 'string' && service.trim().length > 0) {
    return service.trim();
  }

  if (isDirectVideoUrl(source)) return 'html5video';
  if (isDirectAudioUrl(source)) return 'html5audio';

  const lower = source.toLowerCase();
  if (/(youtube\.com|youtu\.be|youtube-nocookie\.com)/.test(lower)) return 'youtube';
  if (/vimeo\.com/.test(lower)) return 'vimeo';
  if (/(twitter\.com|x\.com)/.test(lower)) return 'twitter';
  if (/instagram\.com/.test(lower)) return 'instagram';
  return undefined;
};

export function normalizeEditorJsData(input: unknown): EditorJSData {
  if (input && typeof input === 'object' && Array.isArray((input as EditorJSData).blocks)) {
    const data = input as EditorJSData;
    const normalizedBlocks = (data.blocks ?? [])
      .map((block) => {
        if (!block || typeof block !== 'object' || typeof block.type !== 'string') {
          return null;
        }

        const rawData = block.data && typeof block.data === 'object' ? { ...block.data } : {};

        switch (block.type) {
          case 'paragraph':
            return {
              ...block,
              data: {
                ...rawData,
                text: coerceTextValue((rawData as Record<string, unknown>).text)
              }
            };
          case 'header': {
            const level = Number((rawData as Record<string, unknown>).level) || 2;
            return {
              ...block,
              data: {
                ...rawData,
                text: coerceTextValue((rawData as Record<string, unknown>).text),
                level: Math.min(6, Math.max(1, level))
              }
            };
          }
          case 'video':
          case 'audio':
          case 'embed': {
            const source = coerceTextValue(
              (rawData as Record<string, unknown>).source
              ?? (rawData as Record<string, unknown>).embed
              ?? (rawData as Record<string, unknown>).url
            ).trim();
            if (!source) return null;

            const service = normalizeMediaService(source, (rawData as Record<string, unknown>).service);
            const displayRaw = coerceTextValue((rawData as Record<string, unknown>).display);
            const display = ['full', 'wide', 'inline'].includes(displayRaw) ? displayRaw : 'full';

            return {
              ...block,
              data: {
                ...rawData,
                source,
                embed: source,
                url: source,
                service,
                caption: coerceTextValue((rawData as Record<string, unknown>).caption),
                ...(block.type === 'video' || block.type === 'embed' ? { display } : {})
              }
            };
          }
          default:
            return {
              ...block,
              data: rawData
            };
        }
      })
      .filter((block): block is EditorJSBlock => Boolean(block));

    return {
      time: data.time,
      version: data.version,
      blocks: normalizedBlocks
    };
  }

  return { blocks: [] };
}

type ListItem =
  | string
  | {
      content?: unknown;
      items?: ListItem[];
      text?: unknown;
      checked?: boolean;
    };

const coerceText = (value: unknown) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
};

const normalizeListItem = (item: ListItem) => {
  if (typeof item === 'string') {
    return { text: item, children: [] as ListItem[], checked: false };
  }
  if (!item || typeof item !== 'object') {
    return { text: '', children: [] as ListItem[], checked: false };
  }

  if ('content' in item || 'items' in item) {
    return {
      text: coerceText(item.content),
      children: Array.isArray(item.items) ? item.items : [],
      checked: false
    };
  }

  if ('text' in item) {
    return {
      text: coerceText(item.text),
      children: Array.isArray(item.items) ? item.items : [],
      checked: Boolean(item.checked)
    };
  }

  return { text: '', children: [] as ListItem[], checked: false };
};

const renderListItems = (items: ListItem[], ordered: boolean, checklist = false): string => {
  return items
    .map((item) => {
      const normalized = normalizeListItem(item);
      const marker = checklist
        ? `<span class="checklist-marker" aria-hidden="true">${normalized.checked ? '[x]' : '[ ]'}</span> `
        : '';
      const content = sanitizeHtml(normalized.text);
      const nested = normalized.children.length > 0
        ? renderList(normalized.children, ordered, checklist)
        : '';
      return `<li>${marker}${content}${nested}</li>`;
    })
    .join('');
};

const renderList = (items: ListItem[], ordered: boolean, checklist = false) => {
  const tag = ordered ? 'ol' : 'ul';
  const listItems = renderListItems(items, ordered, checklist);
  const className = checklist ? ' class="checklist"' : '';
  return `<${tag}${className}>${listItems}</${tag}>`;
};

const renderTable = (rows: unknown, withHeadings: boolean) => {
  if (!Array.isArray(rows) || rows.length === 0) return '';
  const safeRows = rows.filter((row): row is unknown[] => Array.isArray(row));
  if (safeRows.length === 0) return '';

  const renderCells = (cells: unknown[], cellTag: 'td' | 'th') =>
    cells.map((cell) => `<${cellTag}>${sanitizeHtml(cell)}</${cellTag}>`).join('');

  const [headRow, ...bodyRows] = safeRows;
  const head = withHeadings
    ? `<thead><tr>${renderCells(headRow, 'th')}</tr></thead>`
    : '';
  const bodyRowsToRender = withHeadings ? bodyRows : safeRows;
  const body = `<tbody>${bodyRowsToRender
    .map((row) => `<tr>${renderCells(row, 'td')}</tr>`)
    .join('')}</tbody>`;

  return `<table>${head}${body}</table>`;
};

const renderLinkPreview = (blockData: Record<string, any>) => {
  const url = blockData.link || blockData.meta?.canonical || '';
  if (!url) return '';
  const title = blockData.meta?.title || url;
  const description = blockData.meta?.description || '';
  const imageUrl = blockData.meta?.image?.url || blockData.meta?.image || '';

  const image = imageUrl
    ? `<div class="link-preview-image"><img src="${escapeHtml(imageUrl)}" alt="" loading="lazy" /></div>`
    : '';
  const desc = description ? `<p>${sanitizeHtml(description)}</p>` : '';

  return `
    <a class="link-preview" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">
      ${image}
      <div class="link-preview-content">
        <strong>${sanitizeHtml(title)}</strong>
        ${desc}
        <span>${escapeHtml(url)}</span>
      </div>
    </a>
  `;
};

export function editorJsToHtml(data: EditorJSData): string {
  if (!data || !Array.isArray(data.blocks) || data.blocks.length === 0) {
    return '';
  }

  const html = data.blocks
    .map((block) => {
      const { type, data: blockData = {} } = block;

      switch (type) {
        case 'paragraph':
          return `<p>${sanitizeHtml(blockData.text || '')}</p>`;
        case 'header': {
          const level = Number(blockData.level) || 2;
          const safeLevel = Math.min(6, Math.max(1, level));
          return `<h${safeLevel}>${sanitizeHtml(blockData.text || '')}</h${safeLevel}>`;
        }
        case 'list': {
          const items = Array.isArray(blockData.items) ? blockData.items : [];
          const ordered = blockData.style === 'ordered';
          const checklist = blockData.style === 'checklist';
          return renderList(items, ordered, checklist);
        }
        case 'checklist': {
          const items = Array.isArray(blockData.items) ? blockData.items : [];
          return renderList(items, false, true);
        }
        case 'table': {
          return renderTable(blockData.content, Boolean(blockData.withHeadings));
        }
        case 'linkTool':
        case 'link': {
          return renderLinkPreview(blockData);
        }
        case 'quote': {
          const text = sanitizeHtml(blockData.text || '');
          const caption = blockData.caption ? `<cite>${sanitizeHtml(blockData.caption)}</cite>` : '';
          return `<blockquote>${text}${caption}</blockquote>`;
        }
        case 'image':
        case 'aiImage': {
          const url = blockData.file?.url || blockData.url || '';
          if (!url) return '';
          const alt = sanitizeHtml(blockData.caption || blockData.alt || '');
          const caption = blockData.caption ? `<figcaption>${sanitizeHtml(blockData.caption)}</figcaption>` : '';
          return `<figure><img src="${url}" alt="${alt}" loading="lazy" decoding="async" />${caption}</figure>`;
        }
        case 'delimiter':
          return '<hr />';
        case 'embed':
        case 'video':
        case 'audio': {
          const src = blockData.embed || blockData.source || blockData.url || '';
          if (!src) return '';
          const display = ['wide', 'inline', 'full'].includes(blockData.display) ? blockData.display : 'full';
          const caption = blockData.caption ? `<figcaption>${sanitizeHtml(blockData.caption)}</figcaption>` : '';
          if (blockData.service === 'html5video' || isDirectVideoUrl(src)) {
            const typeAttribute = blockData.mimeType ? ` type="${escapeHtml(String(blockData.mimeType))}"` : '';
            return `<figure class="embed embed--${display}"><video controls preload="metadata" playsinline><source src="${escapeHtml(src)}"${typeAttribute} /></video>${caption}</figure>`;
          }
          if (blockData.service === 'html5audio' || isDirectAudioUrl(src)) {
            const typeAttribute = blockData.mimeType ? ` type="${escapeHtml(String(blockData.mimeType))}"` : '';
            return `<figure class="embed embed--inline embed--audio"><audio controls preload="metadata"><source src="${escapeHtml(src)}"${typeAttribute} /></audio>${caption}</figure>`;
          }
          const title = escapeHtml(blockData.caption || 'Embedded content');
          return `<figure class="embed embed--${display}"><iframe src="${src}" title="${title}" loading="lazy" allowfullscreen></iframe>${caption}</figure>`;
        }
        case 'code': {
          const code = escapeHtml(blockData.code || '');
          return `<pre><code>${code}</code></pre>`;
        }
        case 'raw':
          return sanitizeHtml(blockData.html || '');
        default:
          return blockData.text ? `<p>${sanitizeHtml(blockData.text)}</p>` : '';
      }
    })
    .join('');

  return html;
}

export function htmlToEditorJs(html: string): EditorJSData {
  if (typeof window === 'undefined' || !html.trim()) {
    return { blocks: [] };
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const blocks: EditorJSBlock[] = [];
  const nodes = Array.from(doc.body.childNodes);

  const pushParagraph = (text: string) => {
    if (!text.trim()) return;
    blocks.push({
      type: 'paragraph',
      data: { text: sanitizeHtml(text) }
    });
  };

  nodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      pushParagraph(node.textContent || '');
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return;
    }

    const element = node as HTMLElement;
    const tag = element.tagName.toLowerCase();

    if (tag === 'p') {
      blocks.push({
        type: 'paragraph',
        data: { text: sanitizeHtml(element.innerHTML) }
      });
      return;
    }

    if (/^h[1-6]$/.test(tag)) {
      const level = Number(tag.replace('h', ''));
      blocks.push({
        type: 'header',
        data: { text: sanitizeHtml(element.innerHTML), level }
      });
      return;
    }

    if (tag === 'ul' || tag === 'ol') {
      const items = Array.from(element.querySelectorAll('li')).map((li) => sanitizeHtml(li.innerHTML));
      if (items.length > 0) {
        blocks.push({
          type: 'list',
          data: { style: tag === 'ol' ? 'ordered' : 'unordered', items }
        });
      }
      return;
    }

    if (tag === 'blockquote') {
      blocks.push({
        type: 'quote',
        data: { text: sanitizeHtml(element.innerHTML) }
      });
      return;
    }

    if (tag === 'pre') {
      const code = element.textContent || '';
      blocks.push({
        type: 'code',
        data: { code }
      });
      return;
    }

    if (tag === 'hr') {
      blocks.push({ type: 'delimiter', data: {} });
      return;
    }

    if (tag === 'img') {
      const src = element.getAttribute('src') || '';
      if (src) {
        blocks.push({
          type: 'image',
          data: {
            file: { url: src },
            caption: element.getAttribute('alt') || ''
          }
        });
      }
      return;
    }

    if (tag === 'figure') {
      const img = element.querySelector('img');
      const video = element.querySelector('video');
      const audio = element.querySelector('audio');
      const caption = element.querySelector('figcaption')?.textContent || '';
      const src = img?.getAttribute('src') || '';
      if (src) {
        blocks.push({
          type: 'image',
          data: {
            file: { url: src },
            caption
          }
        });
        return;
      }

      const videoSrc = video?.getAttribute('src') || video?.querySelector('source')?.getAttribute('src') || '';
      if (videoSrc) {
        blocks.push({
          type: 'video',
          data: {
            source: videoSrc,
            embed: videoSrc,
            url: videoSrc,
            service: isDirectVideoUrl(videoSrc) ? 'html5video' : undefined,
            caption
          }
        });
        return;
      }

      const audioSrc = audio?.getAttribute('src') || audio?.querySelector('source')?.getAttribute('src') || '';
      if (audioSrc) {
        blocks.push({
          type: 'audio',
          data: {
            source: audioSrc,
            embed: audioSrc,
            url: audioSrc,
            service: isDirectAudioUrl(audioSrc) ? 'html5audio' : undefined,
            caption
          }
        });
        return;
      }
    }

    if (tag === 'audio') {
      const audioSrc = element.getAttribute('src') || element.querySelector('source')?.getAttribute('src') || '';
      if (audioSrc) {
        blocks.push({
          type: 'audio',
          data: {
            source: audioSrc,
            embed: audioSrc,
            url: audioSrc,
            service: isDirectAudioUrl(audioSrc) ? 'html5audio' : undefined
          }
        });
        return;
      }
    }

    blocks.push({
      type: 'raw',
      data: { html: sanitizeHtml(element.outerHTML) }
    });
  });

  return { blocks };
}
