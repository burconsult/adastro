export type SetupCompletionRuntimeCache = {
  completed: boolean;
  allowReentry: boolean;
  checkedAt: number;
};

export type ContentRoutingRuntimeCache = {
  articleBasePath: string;
  articlePermalinkStyle: 'segment' | 'wordpress';
  checkedAt: number;
};

export type LocaleConfigRuntimeCache = {
  defaultLocale: string;
  locales: string[];
  checkedAt: number;
};

let setupCompletionRuntimeCache: SetupCompletionRuntimeCache | null = null;
let contentRoutingRuntimeCache: ContentRoutingRuntimeCache | null = null;
let localeConfigRuntimeCache: LocaleConfigRuntimeCache | null = null;

export const getSetupCompletionRuntimeCache = (): SetupCompletionRuntimeCache | null => (
  setupCompletionRuntimeCache
);

export const setSetupCompletionRuntimeCache = (value: SetupCompletionRuntimeCache | null): void => {
  setupCompletionRuntimeCache = value;
};

export const getContentRoutingRuntimeCache = (): ContentRoutingRuntimeCache | null => (
  contentRoutingRuntimeCache
);

export const setContentRoutingRuntimeCache = (value: ContentRoutingRuntimeCache | null): void => {
  contentRoutingRuntimeCache = value;
};

export const getLocaleConfigRuntimeCache = (): LocaleConfigRuntimeCache | null => (
  localeConfigRuntimeCache
);

export const setLocaleConfigRuntimeCache = (value: LocaleConfigRuntimeCache | null): void => {
  localeConfigRuntimeCache = value;
};

export const resetRuntimeConfigCaches = (): void => {
  setupCompletionRuntimeCache = null;
  contentRoutingRuntimeCache = null;
  localeConfigRuntimeCache = null;
};
