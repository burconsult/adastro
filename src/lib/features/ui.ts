import type { ComponentType } from 'react';
import type {
  BlogCommentsProps,
  EditorJsToolsLoader,
  FeaturePublicExtension,
  FeatureMediaLibraryExtension,
  FeaturePostEditorExtension,
  FeatureProfileExtension,
  FooterSignupProps,
  MediaLibraryExtensionProps,
  PostEditorExtensionProps,
  ProfileExtensionProps,
  SeoActionsProps
} from './types.js';
import { loadFeatureModules } from './loader.js';

export interface PostEditorExtensionDefinition {
  id: string;
  SidebarPanel?: ComponentType<PostEditorExtensionProps>;
  SeoActions?: ComponentType<SeoActionsProps>;
  editorJsTools?: EditorJsToolsLoader;
}

export interface MediaLibraryExtensionDefinition {
  id: string;
  Panel?: ComponentType<MediaLibraryExtensionProps>;
}

export interface ProfileExtensionDefinition {
  id: string;
  Panel?: ComponentType<ProfileExtensionProps>;
}

export interface PublicExtensionDefinition {
  id: string;
  FooterNewsletterSignup?: ComponentType<FooterSignupProps>;
  BlogPostComments?: ComponentType<BlogCommentsProps>;
}

const resolvePostEditorExtension = (
  id: string,
  extension?: FeaturePostEditorExtension
): PostEditorExtensionDefinition | null => {
  if (!extension) return null;
  return {
    id,
    SidebarPanel: extension.sidebarPanel,
    SeoActions: extension.seoActions,
    editorJsTools: extension.editorJsTools
  };
};

const resolveMediaLibraryExtension = (
  id: string,
  extension?: FeatureMediaLibraryExtension
): MediaLibraryExtensionDefinition | null => {
  if (!extension) return null;
  return {
    id,
    Panel: extension.panel
  };
};

const resolveProfileExtension = (
  id: string,
  extension?: FeatureProfileExtension
): ProfileExtensionDefinition | null => {
  if (!extension) return null;
  return {
    id,
    Panel: extension.panel
  };
};

const resolvePublicExtension = (
  id: string,
  extension?: FeaturePublicExtension
): PublicExtensionDefinition | null => {
  if (!extension) return null;
  return {
    id,
    FooterNewsletterSignup: extension.footerNewsletterSignup,
    BlogPostComments: extension.blogPostComments
  };
};

export function getPostEditorExtensions(): PostEditorExtensionDefinition[] {
  return loadFeatureModules()
    .map((module) => resolvePostEditorExtension(module.id, module.ui?.postEditor))
    .filter((entry): entry is PostEditorExtensionDefinition => Boolean(entry));
}

export function getMediaLibraryExtensions(): MediaLibraryExtensionDefinition[] {
  return loadFeatureModules()
    .map((module) => resolveMediaLibraryExtension(module.id, module.ui?.mediaLibrary))
    .filter((entry): entry is MediaLibraryExtensionDefinition => Boolean(entry));
}

export function getProfileExtensions(): ProfileExtensionDefinition[] {
  return loadFeatureModules()
    .map((module) => resolveProfileExtension(module.id, module.ui?.profile))
    .filter((entry): entry is ProfileExtensionDefinition => Boolean(entry));
}

export function getPublicExtensions(): PublicExtensionDefinition[] {
  return loadFeatureModules()
    .map((module) => resolvePublicExtension(module.id, module.ui?.public))
    .filter((entry): entry is PublicExtensionDefinition => Boolean(entry));
}

export function getFooterNewsletterSignupComponent(): ComponentType<FooterSignupProps> | undefined {
  return getPublicExtensions().find((extension) => extension.FooterNewsletterSignup)?.FooterNewsletterSignup;
}

export function getBlogPostCommentsComponent(): ComponentType<BlogCommentsProps> | undefined {
  return getPublicExtensions().find((extension) => extension.BlogPostComments)?.BlogPostComments;
}
