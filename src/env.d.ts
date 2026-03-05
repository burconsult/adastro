/// <reference types="astro/client" />

import type { AuthUser } from './lib/auth/auth-helpers';

declare global {
  namespace App {
    interface Locals {
      user?: AuthUser;
      locale?: string;
      defaultLocale?: string;
      supportedLocales?: string[];
      hasLocalePrefix?: boolean;
      localizedPath?: string;
      requestPathname?: string;
    }
  }
}

export {};
