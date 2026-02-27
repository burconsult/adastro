export interface ThemeModule {
  id: string;
  label: string;
  description?: string;
  version?: string;
  author?: string;
  previewImage?: string;
  accent?: string;
  fonts?: {
    body: string;
    heading: string;
  };
  fontImports?: string[];
  source?: 'core' | 'installed';
}
