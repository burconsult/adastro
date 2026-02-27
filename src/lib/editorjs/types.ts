export interface EditorJSBlock {
  id?: string;
  type: string;
  data?: Record<string, any>;
}

export interface EditorJSData {
  time?: number;
  version?: string;
  blocks: EditorJSBlock[];
}
