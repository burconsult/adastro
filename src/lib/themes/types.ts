export interface ThemeModule {
  id: string;
  label: string;
  description?: string;
  version?: string;
  author?: string;
  previewImage?: string;
  previewDescription?: string;
  previewFeatures?: string[];
  fonts?: {
    body: string;
    heading: string;
  };
  source?: 'core' | 'installed';
}
