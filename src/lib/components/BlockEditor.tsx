import React, { useCallback } from 'react';
import type { PostContentBlocks, BaseBlockNode, BlockNode } from '../types/block-editor.js';
import { generateBlockId } from '../block-editor/index.js';
import { isTextNode } from '../types/block-editor.js';

interface BlockEditorProps {
  value: PostContentBlocks;
  onChange: (blocks: PostContentBlocks) => void;
  onRequestMedia?: () => void;
}

const ensureTextContent = (block: BaseBlockNode): string => {
  if (!block.content || block.content.length === 0) return '';
  return block.content
    .map((child) => (isTextNode(child) ? child.text : ensureTextContent(child)))
    .join('')
    .trim();
};

const setBlockText = (block: BaseBlockNode, text: string): BaseBlockNode => ({
  ...block,
  content: [
    {
      type: 'text',
      text
    }
  ]
});

const updateBlock = (blocks: PostContentBlocks, index: number, next: BlockNode): PostContentBlocks => {
  const copy = [...blocks];
  copy[index] = next;
  return copy;
};

const removeBlock = (blocks: PostContentBlocks, index: number): PostContentBlocks => {
  if (index < 0 || index >= blocks.length) return blocks;
  return [...blocks.slice(0, index), ...blocks.slice(index + 1)];
};

const createParagraphBlock = (): BaseBlockNode => ({
  id: generateBlockId(),
  type: 'paragraph',
  content: [
    {
      type: 'text',
      text: ''
    }
  ]
});

const createHeadingBlock = (level: number = 2): BaseBlockNode => ({
  id: generateBlockId(),
  type: 'heading',
  attrs: {
    level: (level >= 1 && level <= 6 ? level : 2) as 1 | 2 | 3 | 4 | 5 | 6
  },
  content: [
    {
      type: 'text',
      text: ''
    }
  ]
});

export const BlockEditor: React.FC<BlockEditorProps> = ({ value, onChange, onRequestMedia }) => {
  const handleParagraphChange = useCallback(
    (index: number, text: string) => {
      const block = value[index];
      if (!block || (block as BaseBlockNode).type !== 'paragraph') return;
      onChange(updateBlock(value, index, setBlockText(block as BaseBlockNode, text)));
    },
    [onChange, value]
  );

  const handleHeadingChange = useCallback(
    (index: number, text: string) => {
      const block = value[index];
      if (!block || (block as BaseBlockNode).type !== 'heading') return;
      onChange(updateBlock(value, index, setBlockText(block as BaseBlockNode, text)));
    },
    [onChange, value]
  );

  const handleHeadingLevelChange = useCallback(
    (index: number, level: number) => {
      const block = value[index];
      if (!block || (block as BaseBlockNode).type !== 'heading') return;
      const next: BaseBlockNode = {
        ...(block as BaseBlockNode),
        attrs: {
          ...(block as BaseBlockNode).attrs,
          level: (level >= 1 && level <= 6 ? level : 2) as 1 | 2 | 3 | 4 | 5 | 6
        }
      };
      onChange(updateBlock(value, index, next));
    },
    [onChange, value]
  );

  const handleDeleteBlock = useCallback(
    (index: number) => {
      onChange(removeBlock(value, index));
    },
    [onChange, value]
  );

  const handleAddParagraph = useCallback(() => {
    onChange([...value, createParagraphBlock()]);
  }, [onChange, value]);

  const handleAddHeading = useCallback(() => {
    onChange([...value, createHeadingBlock()]);
  }, [onChange, value]);

  return (
    <div className="space-y-4">
      {value.length === 0 && (
        <div className="border border-dashed border-border rounded-md p-6 text-center text-sm text-muted-foreground">
          Start writing by adding a block below.
        </div>
      )}

      {value.map((block, index) => {
        if (!('type' in block)) return null;

        if (block.type === 'paragraph') {
          return (
            <div key={block.id} className="border border-border rounded-md bg-card/50">
              <div className="flex items-center justify-between border-b border-border px-3 py-2 text-xs text-muted-foreground uppercase tracking-wide">
                <span>Paragraph</span>
                <button type="button" className="text-destructive hover:underline" onClick={() => handleDeleteBlock(index)}>
                  Remove
                </button>
              </div>
              <textarea
                className="w-full border-0 bg-transparent p-4 focus:outline-none focus:ring-0 min-h-[120px]"
                placeholder="Start typing..."
                value={ensureTextContent(block as BaseBlockNode)}
                onChange={(event) => handleParagraphChange(index, event.target.value)}
              />
            </div>
          );
        }

        if (block.type === 'heading') {
          const level = (block as BaseBlockNode).attrs && 'level' in (block as BaseBlockNode).attrs
            ? Number((block as BaseBlockNode).attrs?.level) || 2
            : 2;

          return (
            <div key={block.id} className="border border-border rounded-md bg-card/50">
              <div className="flex items-center justify-between border-b border-border px-3 py-2 text-xs text-muted-foreground uppercase tracking-wide">
                <span>Heading</span>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1 text-muted-foreground">
                    Level
                    <select
                      className="border border-input rounded px-2 py-1 text-xs"
                      value={level}
                      onChange={(event) => handleHeadingLevelChange(index, Number(event.target.value))}
                    >
                      {[1, 2, 3, 4, 5, 6].map((option) => (
                        <option key={option} value={option}>
                          H{option}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button type="button" className="text-destructive hover:underline" onClick={() => handleDeleteBlock(index)}>
                    Remove
                  </button>
                </div>
              </div>
              <input
                className="w-full border-0 bg-transparent px-4 py-3 text-xl font-semibold focus:outline-none focus:ring-0"
                placeholder="Heading text"
                value={ensureTextContent(block as BaseBlockNode)}
                onChange={(event) => handleHeadingChange(index, event.target.value)}
              />
            </div>
          );
        }

        return (
          <div key={block.id} className="border border-border rounded-md bg-card/20 p-4 text-sm text-muted-foreground">
            Unsupported block type: {block.type}
            <button type="button" className="ml-2 text-destructive hover:underline" onClick={() => handleDeleteBlock(index)}>
              Remove
            </button>
          </div>
        );
      })}

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={handleAddParagraph} className="px-3 py-1.5 text-sm border border-border rounded-md bg-background hover:bg-muted">
          + Paragraph
        </button>
        <button type="button" onClick={handleAddHeading} className="px-3 py-1.5 text-sm border border-border rounded-md bg-background hover:bg-muted">
          + Heading
        </button>
        {onRequestMedia && (
          <button type="button" onClick={onRequestMedia} className="px-3 py-1.5 text-sm border border-border rounded-md bg-background hover:bg-muted">
            + Image
          </button>
        )}
      </div>
    </div>
  );
};

export default BlockEditor;
