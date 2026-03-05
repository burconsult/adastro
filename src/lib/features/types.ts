import type { SettingDefinition, SiteSetting } from '../settings/types.js';
import type { EditorJSData } from '../editorjs/types.js';
import type { BlogPost, MediaAsset, SEOMetadata, Tag } from '../types/index.js';
import type { ComponentType, ReactNode } from 'react';
import type { AuthUser } from '../auth/auth-helpers.js';

export interface FeatureDefinition {
  id: string;
  label: string;
  description: string;
  settings: SettingDefinition[];
}

export type FeatureI18nMessages = Record<string, Record<string, string>>;

export interface FeatureSettingRenderOptions {
  disabled?: boolean;
  options?: string[];
  label?: string;
  description?: string;
}

export type FeatureSettingRenderer = (setting: SiteSetting, options?: FeatureSettingRenderOptions) => ReactNode;

export interface FeatureSettingsPanelProps {
  getSetting: (key: string) => SiteSetting | undefined;
  getValue: (key: string) => any;
  renderSetting: FeatureSettingRenderer;
  t: (key: string, fallback: string) => string;
}

export interface FeatureAdminExtension {
  settingsPanel?: ComponentType<FeatureSettingsPanelProps>;
}

export type EditorJsToolsLoader = (data?: EditorJSData) => Promise<Record<string, any>> | Record<string, any>;

export interface PostEditorFormSnapshot {
  title: string;
  excerpt: string;
  content: string;
  tagIds: string[];
  featuredImage?: MediaAsset | null;
  audioAsset?: MediaAsset | null;
  seoMetadata?: SEOMetadata;
}

export interface PostEditorExtensionProps {
  post?: BlogPost;
  formData: PostEditorFormSnapshot;
  tags: Tag[];
  updateField: (field: keyof PostEditorFormSnapshot, value: any) => void;
  setFeaturedImage: (asset: MediaAsset) => void;
  setAudioAsset: (asset: MediaAsset) => void;
  notify: (message: string, variant?: 'success' | 'error' | 'info') => void;
}

export interface SeoActionsProps {
  metadata: SEOMetadata;
  setMetadata: (metadata: SEOMetadata) => void;
  postTitle: string;
  postExcerpt: string;
  postContent: string;
  postTags: string[];
  notify: (message: string, variant?: 'success' | 'error' | 'info') => void;
  disableAutoGenerate: () => void;
  autoGenerate: boolean;
}

export interface FeaturePostEditorExtension {
  sidebarPanel?: ComponentType<PostEditorExtensionProps>;
  seoActions?: ComponentType<SeoActionsProps>;
  editorJsTools?: EditorJsToolsLoader;
}

export interface MediaLibraryBanner {
  type: 'success' | 'error';
  message: string;
}

export interface MediaLibraryExtensionProps {
  addAsset: (asset: MediaAsset | any) => void;
  selectAsset: (id: string | null) => void;
  setBanner: (banner: MediaLibraryBanner | null) => void;
  refreshStats: () => void;
}

export interface FeatureMediaLibraryExtension {
  panel?: ComponentType<MediaLibraryExtensionProps>;
}

export interface ProfileExtensionProps {
  featureId: string;
  data: Record<string, any>;
  updateData: (data: Record<string, any>) => void;
  featureFlags?: Record<string, boolean>;
}

export interface FeatureProfileExtension {
  panel?: ComponentType<ProfileExtensionProps>;
}

export interface FooterSignupProps {
  tone?: 'default' | 'inverse';
}

export interface BlogCommentsProps {
  slug: string;
  postId?: string;
  locale?: string;
  messages?: Record<string, string>;
}

export interface FeaturePublicExtension {
  footerNewsletterSignup?: ComponentType<FooterSignupProps>;
  blogPostComments?: ComponentType<BlogCommentsProps>;
}

export interface FeatureUiExtension {
  postEditor?: FeaturePostEditorExtension;
  mediaLibrary?: FeatureMediaLibraryExtension;
  profile?: FeatureProfileExtension;
  public?: FeaturePublicExtension;
}

export interface FeatureApiContext {
  request: Request;
  params: Record<string, string | undefined>;
  locals?: any;
}

export type FeatureApiHandler = (context: FeatureApiContext) => Promise<Response>;

export interface FeatureApiModule {
  handlers: Record<string, FeatureApiHandler>;
}

export interface FeatureProfileApiContext {
  request: Request;
  user: AuthUser;
  profileData: Record<string, any>;
}

export interface FeatureProfileApiExtension {
  getFeatureFlags?: (context: FeatureProfileApiContext) => Promise<Record<string, boolean>>;
  hydrateProfileData?: (context: FeatureProfileApiContext) => Promise<Record<string, any> | void>;
  afterProfileUpdate?: (context: FeatureProfileApiContext) => Promise<void>;
}

export interface FeatureServerExtension {
  profileApi?: FeatureProfileApiExtension;
}

export interface FeatureModule {
  id: string;
  definition: FeatureDefinition;
  admin?: FeatureAdminExtension;
  ui?: FeatureUiExtension;
  i18n?: FeatureI18nMessages;
}

export interface FeatureServerModule {
  id: string;
  server?: FeatureServerExtension;
  loadApi?: () => Promise<FeatureApiModule>;
}
