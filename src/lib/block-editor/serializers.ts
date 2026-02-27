import type { BaseBlockNode, BlockChild, BlockNode, PostContentBlocks, TextNode } from '../types/block-editor.js';
import { isBlockNode, isTextNode } from '../types/block-editor.js';

const BLOCK_WRAPPERS = {
  bold: ['<strong>', '</strong>'],
  italic: ['<em>', '</em>'],
  underline: ['<u>', '</u>'],
  code: ['<code>', '</code>'],
  link: ['<a href="%s">', '</a>']
} as const;

type MarkTypeKey = keyof typeof BLOCK_WRAPPERS;

type Serializable = PostContentBlocks | BlockNode | BlockChild | TextNode | undefined | null;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/`/g, '&#96;');
}

function wrapWithMarks(node: TextNode): string {
  let output = escapeHtml(node.text);

  for (const mark of node.marks ?? []) {
    const type = mark.type as MarkTypeKey;
    if (!BLOCK_WRAPPERS[type]) continue;

    if (type === 'link') {
      const href = mark.attrs?.href ? escapeAttribute(mark.attrs.href) : '#';
      const [open, close] = BLOCK_WRAPPERS[type];
      output = `${open.replace('%s', href)}${output}${close}`;
      continue;
    }

    const [open, close] = BLOCK_WRAPPERS[type];
    output = `${open}${output}${close}`;
  }

  return output;
}

function renderChildren(children: BlockChild[] | undefined): string {
  if (!children || children.length === 0) return '';
  return children.map((child) => renderNode(child)).join('');
}

function renderListItems(children: BlockChild[] | undefined): string {
  if (!children || children.length === 0) return '';
  return children
    .map((child) => {
      if (isBlockNode(child)) {
        return `<li>${renderChildren(child.content)}</li>`;
      }
      return `<li>${wrapWithMarks(child)}</li>`;
    })
    .join('');
}

function renderBlock(node: BaseBlockNode): string {
  switch (node.type) {
    case 'paragraph': {
      const content = renderChildren(node.content);
      const attrs = node.attrs && 'align' in node.attrs && node.attrs.align
        ? ` data-align="${escapeAttribute(node.attrs.align)}"`
        : '';
      return `<p${attrs}>${content}</p>`;
    }
    case 'heading': {
      const level = node.attrs && 'level' in node.attrs ? Number(node.attrs.level) : 2;
      const headingLevel = Number.isInteger(level) && level >= 1 && level <= 6 ? level : 2;
      const content = renderChildren(node.content);
      return `<h${headingLevel}>${content}</h${headingLevel}>`;
    }
    case 'list': {
      const ordered = Boolean(node.attrs && 'ordered' in node.attrs && node.attrs.ordered);
      const start = node.attrs && 'start' in node.attrs && node.attrs.start ? Number(node.attrs.start) : undefined;
      const tag = ordered ? 'ol' : 'ul';
      const startAttr = ordered && start && start > 1 ? ` start="${start}"` : '';
      return `<${tag}${startAttr}>${renderListItems(node.content)}</${tag}>`;
    }
    case 'quote': {
      const content = renderChildren(node.content);
      const cite = node.attrs && 'cite' in node.attrs && node.attrs.cite ? ` cite="${escapeAttribute(node.attrs.cite)}"` : '';
      return `<blockquote${cite}>${content}</blockquote>`;
    }
    case 'image': {
      if (!node.attrs || !('url' in node.attrs)) {
        return '';
      }
      const url = escapeAttribute(node.attrs.url);
      const alt = escapeAttribute('alt' in node.attrs ? node.attrs.alt ?? '' : '');
      const caption = 'caption' in node.attrs && node.attrs.caption ? `<figcaption>${escapeHtml(node.attrs.caption)}</figcaption>` : '';
      return `<figure><img src="${url}" alt="${alt}" />${caption}</figure>`;
    }
    case 'embed': {
      if (!node.attrs) return '';
      if ('html' in node.attrs && node.attrs.html) {
        return node.attrs.html as string;
      }
      if ('url' in node.attrs && node.attrs.url) {
        const title = 'title' in node.attrs && node.attrs.title ? escapeAttribute(node.attrs.title) : 'Embedded content';
        const src = escapeAttribute(node.attrs.url);
        return `<iframe src="${src}" title="${title}" loading="lazy" allowfullscreen></iframe>`;
      }
      return '';
    }
    case 'callout': {
      const tone = node.attrs && 'tone' in node.attrs && node.attrs.tone ? ` data-tone="${escapeAttribute(node.attrs.tone)}"` : '';
      const icon = node.attrs && 'icon' in node.attrs && node.attrs.icon ? `<span class="callout-icon">${escapeHtml(node.attrs.icon)}</span>` : '';
      const title = node.attrs && 'title' in node.attrs && node.attrs.title ? `<strong class="callout-title">${escapeHtml(node.attrs.title)}</strong>` : '';
      const content = renderChildren(node.content);
      return `<aside class="callout"${tone}>${icon}${title}${content}</aside>`;
    }
    case 'divider':
      return '<hr />';
    default:
      return `<div data-block-type="${escapeAttribute(node.type)}">${renderChildren(node.content)}</div>`;
  }
}

function renderNode(node: Serializable): string {
  if (!node) return '';
  if (Array.isArray(node)) {
    return node.map((child) => renderNode(child)).join('');
  }
  if (isTextNode(node)) {
    return wrapWithMarks(node);
  }
  if (isBlockNode(node)) {
    return renderBlock(node);
  }
  return '';
}

export function normalizeBlocks(input: unknown): PostContentBlocks {
  if (!Array.isArray(input)) return [];
  return input.filter((node): node is BlockNode => Boolean(node) && typeof node === 'object' && 'type' in node);
}

export function blocksToPlainText(blocks: PostContentBlocks): string {
  const collect = (nodes: Serializable, parts: string[]) => {
    if (!nodes) return;
    if (Array.isArray(nodes)) {
      nodes.forEach((node) => collect(node, parts));
      return;
    }
    if (isTextNode(nodes)) {
      parts.push(nodes.text);
      return;
    }
    if (isBlockNode(nodes)) {
      collect(nodes.content ?? [], parts);
    }
  };

  const parts: string[] = [];
  collect(blocks, parts);
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

export function blocksToHtml(blocks: PostContentBlocks): string {
  if (!Array.isArray(blocks) || blocks.length === 0) return '';
  return blocks.map((block) => renderNode(block)).join('');
}

export function blocksToMarkdown(blocks: PostContentBlocks): string {
  if (!Array.isArray(blocks) || blocks.length === 0) {
    return '';
  }

  const renderMarkdown = (node: BlockNode): string => {
    if (isTextNode(node)) {
      return node.text;
    }

    const inner = (node.content ?? []).map(renderMarkdown).join(node.type === 'list' ? '\n' : '');

    switch (node.type) {
      case 'paragraph':
        return `${inner}\n\n`;
      case 'heading': {
        const level = node.attrs && 'level' in node.attrs ? Number(node.attrs.level) : 2;
        const headingLevel = Number.isInteger(level) && level >= 1 && level <= 6 ? level : 2;
        return `${'#'.repeat(headingLevel)} ${inner}\n\n`;
      }
      case 'list': {
        const ordered = Boolean(node.attrs && 'ordered' in node.attrs && node.attrs.ordered);
        return (node.content ?? [])
          .map((child, index) => {
            const prefix = ordered ? `${index + 1}. ` : '- ';
            return `${prefix}${renderMarkdown(child).trim()}`;
          })
          .join('\n') + '\n\n';
      }
      case 'quote':
        return (node.content ?? [])
          .map((child) => `> ${renderMarkdown(child).trim()}`)
          .join('\n') + '\n\n';
      case 'image': {
        if (!node.attrs || !('url' in node.attrs)) {
          return '';
        }
        const alt = 'alt' in node.attrs ? node.attrs.alt ?? '' : '';
        const title = 'caption' in node.attrs && node.attrs.caption ? ` "${node.attrs.caption}"` : '';
        return `![${alt}](${node.attrs.url}${title})\n\n`;
      }
      case 'callout':
        return `> **${node.attrs && 'title' in node.attrs && node.attrs.title ? node.attrs.title : 'Note'}** ${inner}\n\n`;
      case 'divider':
        return `---\n\n`;
      case 'embed':
        if (!node.attrs || !('url' in node.attrs)) {
          return '';
        }
        return `${node.attrs.url}\n\n`;
      default:
        return `${inner}\n\n`;
    }
  };

  return blocks.map(renderMarkdown).join('').trim();
}

export function markdownToBlocks(markdown: string): PostContentBlocks {
  const trimmed = markdown?.trim();
  if (!trimmed) return [];

  return [
    {
      id: generateBlockId(),
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: trimmed
        }
      ]
    }
  ];
}

export function ensureContentFallback(blocks: PostContentBlocks, fallbackContent: string): string {
  const html = blocksToHtml(blocks);
  if (html.trim()) {
    return html;
  }
  return fallbackContent;
}

export function generateBlockId(): string {
  const maybeCrypto = typeof globalThis !== 'undefined' ? (globalThis as { crypto?: { randomUUID?: () => string } }).crypto : undefined;
  if (maybeCrypto?.randomUUID) {
    return maybeCrypto.randomUUID();
  }
  const random = Math.floor(Math.random() * 1_000_000);
  return `block-${Date.now()}-${random}`;
}
