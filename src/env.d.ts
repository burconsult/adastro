/// <reference types="astro/client" />

import type { AuthUser } from './lib/auth/auth-helpers';

declare global {
  namespace App {
    interface Locals {
      user?: AuthUser;
    }
  }
}

export {};
