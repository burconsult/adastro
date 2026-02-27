declare module 'jest-axe' {
  export const axe: (...args: any[]) => Promise<any>;
  export const toHaveNoViolations: any;
}

declare module '@editorjs/checklist' {
  const ChecklistTool: any;
  export default ChecklistTool;
}

declare module '@editorjs/link' {
  const LinkTool: any;
  export default LinkTool;
}

declare module '@editorjs/marker' {
  const MarkerTool: any;
  export default MarkerTool;
}

declare module '@editorjs/embed' {
  const EmbedTool: any;
  export default EmbedTool;
}

declare module '@editorjs/raw' {
  const RawTool: any;
  export default RawTool;
}
