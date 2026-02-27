export type BlockType =
  | 'paragraph'
  | 'heading'
  | 'list'
  | 'quote'
  | 'image'
  | 'embed'
  | 'callout'
  | 'divider';

export interface ParagraphAttrs {
  align?: 'left' | 'center' | 'right' | 'justify';
}

export interface HeadingAttrs {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  anchor?: string;
}

export interface ListAttrs {
  ordered?: boolean;
  start?: number;
  tight?: boolean;
}

export interface QuoteAttrs {
  cite?: string;
}

export interface ImageAttrs {
  mediaId?: string;
  url: string;
  alt: string;
  caption?: string;
  focalPoint?: { x: number; y: number };
}

export interface EmbedAttrs {
  provider: 'youtube' | 'vimeo' | 'twitter' | 'custom';
  url: string;
  title?: string;
  html?: string;
}

export interface CalloutAttrs {
  tone?: 'info' | 'success' | 'warning' | 'danger';
  title?: string;
  icon?: string;
}

export type DividerAttrs = Record<string, never>;

export type BlockAttrs =
  | ParagraphAttrs
  | HeadingAttrs
  | ListAttrs
  | QuoteAttrs
  | ImageAttrs
  | EmbedAttrs
  | CalloutAttrs
  | DividerAttrs
  | Record<string, unknown>;

export type MarkType = 'bold' | 'italic' | 'underline' | 'code' | 'link';

export interface Mark {
  type: MarkType;
  attrs?: {
    href?: string;
    title?: string;
    [key: string]: unknown;
  };
}

export interface TextNode {
  type: 'text';
  text: string;
  marks?: Mark[];
}

export interface BaseBlockNode {
  id: string;
  type: BlockType;
  attrs?: BlockAttrs;
  content?: BlockChild[];
}

export type BlockChild = BaseBlockNode | TextNode;

export type BlockNode = BaseBlockNode | TextNode;

export type PostContentBlocks = BlockNode[];

export function isTextNode(node: BlockNode): node is TextNode {
  return node.type === 'text';
}

export function isBlockNode(node: BlockNode): node is BaseBlockNode {
  return node.type !== 'text';
}
