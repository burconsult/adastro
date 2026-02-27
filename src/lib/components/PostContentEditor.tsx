import React, { useRef } from 'react';
import { sanitizeHtml } from '@/lib/utils/data-transform';

interface PostContentEditorProps {
  content: string;
  onChange: (content: string) => void;
  showPreview: boolean;
  splitView: boolean;
  onTogglePreview: () => void;
  onToggleSplitView: () => void;
  onMediaInsert: () => void;
  onEmbedInsert: (embedMarkdown: string) => void;
  onLinkInsert: (linkMarkdown: string) => void;
  mode?: 'markdown' | 'html';
  showFormatting?: boolean;
  showPreviewControls?: boolean;
}

export const PostContentEditor: React.FC<PostContentEditorProps> = ({
  content,
  onChange,
  showPreview,
  splitView,
  onTogglePreview,
  onToggleSplitView,
  onMediaInsert,
  onEmbedInsert,
  onLinkInsert,
  mode = 'markdown',
  showFormatting = true,
  showPreviewControls = true
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
  };

  const applySelectionChange = (next: string, selectionStart: number, selectionEnd: number) => {
    onChange(next);
    const textarea = textareaRef.current;
    if (!textarea) return;
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(selectionStart, selectionEnd);
    });
  };

  const wrapSelection = (prefix: string, suffix: string, placeholder = '') => {
    const textarea = textareaRef.current;
    if (!textarea) {
      onChange(`${content}${prefix}${placeholder}${suffix}`);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = start === end ? placeholder : content.slice(start, end);
    const next = `${content.slice(0, start)}${prefix}${selected}${suffix}${content.slice(end)}`;
    const nextStart = start + prefix.length;
    const nextEnd = nextStart + selected.length;
    applySelectionChange(next, nextStart, nextEnd);
  };

  const replaceLineSelection = (transform: (line: string, index: number) => string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const lineStart = content.lastIndexOf('\n', start - 1) + 1;
    const lineEnd = (() => {
      const idx = content.indexOf('\n', end);
      return idx === -1 ? content.length : idx;
    })();
    const selection = content.slice(lineStart, lineEnd);
    const lines = selection.split('\n');
    const transformed = lines.map(transform).join('\n');
    const next = `${content.slice(0, lineStart)}${transformed}${content.slice(lineEnd)}`;
    applySelectionChange(next, lineStart, lineStart + transformed.length);
  };

  const handleInsertHeading = (level: number) => {
    const prefix = `${'#'.repeat(level)} `;
    replaceLineSelection((line, index) => {
      if (index > 0) return line;
      return `${prefix}${line.replace(/^#{1,6}\s+/, '')}`;
    });
  };

  const handleInsertList = (ordered: boolean) => {
    replaceLineSelection((line, index) => {
      const trimmed = line.trim();
      if (!trimmed) return line;
      if (ordered) {
        return `${index + 1}. ${trimmed.replace(/^\d+\.\s+/, '')}`;
      }
      return `- ${trimmed.replace(/^[-*+]\s+/, '')}`;
    });
  };

  const handleInsertQuote = () => {
    replaceLineSelection((line) => (line.trim() ? `> ${line.replace(/^>\s+/, '')}` : line));
  };

  const handleInsertDivider = () => {
    const textarea = textareaRef.current;
    if (!textarea) {
      onChange(`${content}\n\n---\n\n`);
      return;
    }
    const start = textarea.selectionStart;
    const next = `${content.slice(0, start)}\n\n---\n\n${content.slice(start)}`;
    const cursor = start + 5;
    applySelectionChange(next, cursor, cursor);
  };

  const handleInsertLink = () => {
    if (typeof window === 'undefined') return;
    const url = window.prompt('Enter the URL to link to');
    if (!url) return;
    const text = window.prompt('Optional link text (defaults to URL)') || url;
    onLinkInsert(`[${text}](${url})`);
  };

  const handleInsertEmbed = () => {
    if (typeof window === 'undefined') return;
    const url = window.prompt('Enter the embed URL (YouTube, Vimeo, social post, etc.)');
    if (!url) return;
    const title = window.prompt('Optional embed title (used for accessibility)') || 'Embedded content';
    const embedMarkdown = `\n<iframe
  src="${url}"
  title="${title}"
  loading="lazy"
  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
  allowfullscreen
  style="width: 100%; min-height: 360px; border: 0;"
/>
`;
    onEmbedInsert(embedMarkdown);
  };

  const escapeHtml = (value: string) =>
    value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const escapeAttribute = (value: string) => escapeHtml(value).replace(/`/g, '&#96;');

  const sanitizeUrl = (rawUrl: string) => {
    const trimmed = rawUrl.trim();
    if (/^(https?:|mailto:|\/|#)/i.test(trimmed)) {
      return escapeAttribute(trimmed);
    }
    return '#';
  };

  const formatInline = (value: string) => {
    let output = value;
    output = output.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_match, alt, url) => {
      const safeAlt = escapeAttribute(alt);
      const safeUrl = sanitizeUrl(url);
      return `<img src="${safeUrl}" alt="${safeAlt}" />`;
    });
    output = output.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, text, url) => {
      const safeUrl = sanitizeUrl(url);
      return `<a href="${safeUrl}" rel="noopener noreferrer">${text}</a>`;
    });
    output = output.replace(/`([^`]+)`/g, '<code>$1</code>');
    output = output.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    output = output.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    return output;
  };

  const renderMarkdownPreview = (markdown: string) => {
    if (!markdown.trim()) return '<p class="text-muted-foreground">Start writing to see a preview.</p>';

    const lines = markdown.split('\n');
    const html: string[] = [];
    let inCodeBlock = false;
    let codeLang = '';
    let codeLines: string[] = [];
    let listType: 'ul' | 'ol' | null = null;
    let listItems: string[] = [];
    let quoteLines: string[] = [];
    let paragraphLines: string[] = [];

    const flushList = () => {
      if (!listType) return;
      html.push(`<${listType}>${listItems.join('')}</${listType}>`);
      listType = null;
      listItems = [];
    };

    const flushQuote = () => {
      if (quoteLines.length === 0) return;
      html.push(`<blockquote>${quoteLines.join('<br />')}</blockquote>`);
      quoteLines = [];
    };

    const flushParagraph = () => {
      if (paragraphLines.length === 0) return;
      const text = paragraphLines.join(' ');
      html.push(`<p>${formatInline(escapeHtml(text))}</p>`);
      paragraphLines = [];
    };

    for (const rawLine of lines) {
      const line = rawLine.replace(/\r$/, '');
      const trimmed = line.trim();

      if (trimmed.startsWith('```')) {
        if (inCodeBlock) {
          const code = escapeHtml(codeLines.join('\n'));
          const langClass = codeLang ? ` class="language-${escapeAttribute(codeLang)}"` : '';
          html.push(`<pre><code${langClass}>${code}</code></pre>`);
          inCodeBlock = false;
          codeLang = '';
          codeLines = [];
        } else {
          flushParagraph();
          flushList();
          flushQuote();
          inCodeBlock = true;
          codeLang = trimmed.slice(3).trim();
        }
        continue;
      }

      if (inCodeBlock) {
        codeLines.push(line);
        continue;
      }

      if (!trimmed) {
        flushParagraph();
        flushList();
        flushQuote();
        continue;
      }

      const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
      if (headingMatch) {
        flushParagraph();
        flushList();
        flushQuote();
        const level = headingMatch[1].length;
        html.push(`<h${level}>${formatInline(escapeHtml(headingMatch[2]))}</h${level}>`);
        continue;
      }

      if (/^(-{3,}|\*{3,})$/.test(trimmed)) {
        flushParagraph();
        flushList();
        flushQuote();
        html.push('<hr />');
        continue;
      }

      if (trimmed.startsWith('>')) {
        flushParagraph();
        flushList();
        const quoteText = trimmed.replace(/^>\s?/, '');
        quoteLines.push(formatInline(escapeHtml(quoteText)));
        continue;
      }

      const orderedMatch = trimmed.match(/^\d+\.\s+(.*)$/);
      const unorderedMatch = trimmed.match(/^[-*+]\s+(.*)$/);
      if (orderedMatch || unorderedMatch) {
        flushParagraph();
        flushQuote();
        const nextType = orderedMatch ? 'ol' : 'ul';
        if (listType && listType !== nextType) {
          flushList();
        }
        listType = nextType;
        const itemText = orderedMatch ? orderedMatch[1] : unorderedMatch![1];
        listItems.push(`<li>${formatInline(escapeHtml(itemText))}</li>`);
        continue;
      }

      paragraphLines.push(trimmed);
    }

    flushParagraph();
    flushList();
    flushQuote();

    return html.join('');
  };

  const showToolbar = showPreviewControls || (showFormatting && mode === 'markdown');
  const placeholderText = mode === 'html'
    ? 'Paste or write HTML content...'
    : 'Start writing your post content in Markdown/MDX format...';

  return (
    <div className="post-content-editor">
      <div className="border border-border rounded-md">
        {/* Simple Toolbar */}
        {showToolbar && (
          <div className="border-b border-border p-3 bg-muted/60 rounded-t-md">
            <div className="flex items-center gap-2">
              {showPreviewControls && (
                <div className="flex flex-wrap items-center gap-1">
                  <button
                    type="button"
                    onClick={onTogglePreview}
                    className={`px-3 py-1 text-sm border rounded hover:bg-muted ${showPreview && !splitView ? 'bg-background shadow' : ''}`}
                  >
                    {showPreview && !splitView ? 'Editing' : 'Preview'}
                  </button>
                  <button
                    type="button"
                    onClick={onToggleSplitView}
                    className={`px-3 py-1 text-sm border rounded hover:bg-muted ${splitView ? 'bg-background shadow' : ''}`}
                  >
                    {splitView ? 'Single Pane' : 'Split View'}
                  </button>
                </div>
              )}
              {showFormatting && mode === 'markdown' && (
                <>
                  <div className="flex flex-wrap items-center gap-1">
                    <button
                      type="button"
                      onClick={() => wrapSelection('**', '**', 'bold text')}
                      className="px-2 py-1 text-sm border rounded hover:bg-muted"
                      aria-label="Bold"
                    >
                      <strong>B</strong>
                    </button>
                    <button
                      type="button"
                      onClick={() => wrapSelection('*', '*', 'italic text')}
                      className="px-2 py-1 text-sm border rounded hover:bg-muted"
                      aria-label="Italic"
                    >
                      <em>I</em>
                    </button>
                    <button
                      type="button"
                      onClick={() => wrapSelection('`', '`', 'code')}
                      className="px-2 py-1 text-sm border rounded hover:bg-muted"
                      aria-label="Inline code"
                    >
                      {'</>'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleInsertHeading(2)}
                      className="px-2 py-1 text-sm border rounded hover:bg-muted"
                      aria-label="Heading 2"
                    >
                      H2
                    </button>
                    <button
                      type="button"
                      onClick={() => handleInsertHeading(3)}
                      className="px-2 py-1 text-sm border rounded hover:bg-muted"
                      aria-label="Heading 3"
                    >
                      H3
                    </button>
                    <button
                      type="button"
                      onClick={() => handleInsertList(false)}
                      className="px-2 py-1 text-sm border rounded hover:bg-muted"
                      aria-label="Bulleted list"
                    >
                      • List
                    </button>
                    <button
                      type="button"
                      onClick={() => handleInsertList(true)}
                      className="px-2 py-1 text-sm border rounded hover:bg-muted"
                      aria-label="Numbered list"
                    >
                      1. List
                    </button>
                    <button
                      type="button"
                      onClick={handleInsertQuote}
                      className="px-2 py-1 text-sm border rounded hover:bg-muted"
                      aria-label="Quote"
                    >
                      “”
                    </button>
                    <button
                      type="button"
                      onClick={handleInsertDivider}
                      className="px-2 py-1 text-sm border rounded hover:bg-muted"
                      aria-label="Divider"
                    >
                      ―
                    </button>
                  </div>
                  <div className="flex items-center gap-1 ml-auto">
                    <button
                      type="button"
                      onClick={onMediaInsert}
                      className="px-3 py-1 text-sm border rounded hover:bg-muted"
                    >
                      Insert Image
                    </button>
                    <button
                      type="button"
                      onClick={handleInsertEmbed}
                      className="px-3 py-1 text-sm border rounded hover:bg-muted"
                    >
                      Insert Embed
                    </button>
                    <button
                      type="button"
                      onClick={handleInsertLink}
                      className="px-3 py-1 text-sm border rounded hover:bg-muted"
                    >
                      Insert Link
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Editor/Preview Area */}
        <div className={`relative ${splitView ? 'grid md:grid-cols-2 gap-0 border-t border-border' : ''}`}>
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleContentChange}
            className={[
              'p-4 border-0 resize-none focus:outline-none focus:ring-0 font-mono text-sm',
              splitView ? 'min-h-[400px] border-r border-border' : '',
              showPreview && !splitView ? 'hidden' : 'block w-full'
            ]
              .filter(Boolean)
              .join(' ')}
            placeholder={placeholderText}
            style={{ minHeight: '400px' }}
          />

          {(showPreview || splitView) && (
            <div className={`p-4 min-h-[400px] bg-background text-foreground prose prose-sm sm:prose dark:prose-invert max-w-none ${splitView ? 'border-l border-border' : ''}`}>
              <div
                dangerouslySetInnerHTML={{
                  __html: mode === 'html' ? sanitizeHtml(content) : renderMarkdownPreview(content)
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PostContentEditor;
