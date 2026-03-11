import React, { useMemo, useState } from 'react';
import ModeToggle from '@/components/ModeToggle';
import { Dialog, DialogClose, DialogContent, DialogTrigger } from '@/lib/components/ui/dialog';
import { Settings, UserRound, X } from 'lucide-react';

type NavLink = {
  label: string;
  href: string;
};

type LocaleOption = {
  code: string;
  label: string;
  href: string;
};

type Props = {
  siteTitle?: string;
  siteLogoUrl?: string;
  homeHref?: string;
  homeLabel?: string;
  openMenuLabel?: string;
  closeMenuLabel?: string;
  toggleThemeLabel?: string;
  signInLabel?: string;
  navLinks?: NavLink[];
  authLink?: NavLink;
  adminLink?: NavLink | null;
  authState?: 'authenticated' | 'guest';
  localeOptions?: LocaleOption[];
  currentLocale?: string;
  localeSwitcherLabel?: string;
  primaryCta?: {
    label: string;
    href: string;
  } | null;
};

export default function MobileNavigation({
  siteTitle = 'AdAstro',
  siteLogoUrl = '/logo.svg',
  homeHref = '/',
  homeLabel = 'Home',
  openMenuLabel = 'Open menu',
  closeMenuLabel = 'Close mobile menu',
  toggleThemeLabel = 'Toggle theme',
  signInLabel = 'Sign in',
  navLinks = [],
  authLink,
  adminLink = null,
  authState = 'guest',
  localeOptions = [],
  currentLocale = 'en',
  localeSwitcherLabel = 'Language',
  primaryCta = null
}: Props) {
  const [open, setOpen] = useState(false);
  const prefetchProps = (href: string): Record<string, string> =>
    href.startsWith('/') ? { 'data-astro-prefetch': 'hover' } : {};
  const secondaryLinks = useMemo(() => navLinks.filter((link) => Boolean(link)), [navLinks]);
  const links = secondaryLinks.length > 0
    ? secondaryLinks
    : [{ label: homeLabel, href: homeHref }];
  const menuLinks = [...links, ...(adminLink ? [adminLink] : []), ...(authLink ? [authLink] : [])];
  const isAuthenticated = authState === 'authenticated';
  const isAdmin = Boolean(adminLink);
  const hasLocaleSwitcher = localeOptions.length > 1;
  const activeLocale = currentLocale.trim().toLowerCase();
  const handleLocaleChange = (href: string) => {
    if (!href || typeof window === 'undefined') return;
    window.location.assign(href);
  };

  return (
    <nav className="flex items-center gap-3">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-background text-foreground transition-colors hover:bg-accent sm:hidden"
              aria-label={openMenuLabel}
              aria-expanded={open}
            >
            <span className="sr-only">{openMenuLabel}</span>
            <div className="flex flex-col gap-1">
              <span className={`h-0.5 w-5 bg-current transition ${open ? 'translate-y-1.5 rotate-45' : ''}`}></span>
              <span className={`h-0.5 w-5 bg-current transition ${open ? 'opacity-0' : ''}`}></span>
              <span className={`h-0.5 w-5 bg-current transition ${open ? '-translate-y-1.5 -rotate-45' : ''}`}></span>
            </div>
          </button>
        </DialogTrigger>
        <DialogContent
          containerClassName="items-stretch justify-start"
          className="ml-0 mr-auto flex h-full w-[85vw] max-w-sm flex-col gap-6 rounded-none border-r border-border bg-background p-6 shadow-xl"
        >
          <div className="flex items-center justify-between">
            <a href={homeHref} {...prefetchProps(homeHref)} className="flex items-center gap-2 text-lg font-semibold">
              <img src={siteLogoUrl} alt={`${siteTitle} logo`} className="h-7 w-7" />
              <span>{siteTitle}</span>
            </a>
            <DialogClose>
              <button
                type="button"
                className="h-10 w-10 rounded-md border border-border bg-background text-foreground transition-colors hover:bg-accent"
                aria-label={closeMenuLabel}
              >
                <X className="mx-auto h-5 w-5" aria-hidden="true" />
              </button>
            </DialogClose>
          </div>

          <div className="flex flex-1 flex-col gap-2">
            {menuLinks.map((link) => (
              <DialogClose key={link.href}>
                <a
                  href={link.href}
                  {...prefetchProps(link.href)}
                  className="flex min-h-[48px] items-center rounded-lg px-3 text-base font-medium text-foreground transition-colors hover:bg-accent"
                >
                  {link.label}
                </a>
              </DialogClose>
            ))}
          </div>

          <div className="space-y-4 border-t border-border pt-4">
            {primaryCta && (
              <DialogClose>
                <a
                  href={primaryCta.href}
                  {...prefetchProps(primaryCta.href)}
                  className="inline-flex w-full items-center justify-center rounded-full bg-primary px-4 py-3 text-base font-semibold text-primary-foreground transition hover:bg-primary/90"
                >
                  {primaryCta.label}
                </a>
              </DialogClose>
            )}
            <ModeToggle variant="list" label={toggleThemeLabel} />
          </div>
        </DialogContent>
      </Dialog>

      {(hasLocaleSwitcher || isAdmin || authLink) && (
        <div className="flex items-center gap-2 sm:hidden">
          {hasLocaleSwitcher && (
            <label className="sr-only" htmlFor="mobile-locale-switcher">{localeSwitcherLabel}</label>
          )}
          {hasLocaleSwitcher && (
            <select
              id="mobile-locale-switcher"
              aria-label={localeSwitcherLabel}
              className="h-10 max-w-[8.5rem] rounded-md border border-border bg-background px-2 py-1 text-xs font-semibold text-foreground"
              value={activeLocale}
              onChange={(event) => {
                const nextLocale = event.target.value;
                const nextOption = localeOptions.find((option) => option.code.trim().toLowerCase() === nextLocale);
                if (nextOption) handleLocaleChange(nextOption.href);
              }}
            >
              {localeOptions.map((option) => (
                <option key={option.code} value={option.code.trim().toLowerCase()}>
                  {option.label}
                </option>
              ))}
            </select>
          )}
          {isAdmin && adminLink && (
            <a
              href={adminLink.href}
              {...prefetchProps(adminLink.href)}
              aria-label={adminLink.label}
              className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-background text-foreground transition-colors hover:bg-accent"
            >
              <Settings className="h-5 w-5" aria-hidden="true" />
            </a>
          )}
          {authLink && (
            <a
              href={authLink.href}
              {...prefetchProps(authLink.href)}
              aria-label={authLink.label}
              className={`inline-flex h-10 items-center justify-center border border-border bg-background text-foreground transition-colors hover:bg-accent ${
                isAuthenticated ? 'w-10 rounded-md' : 'rounded-md px-3 text-xs font-semibold'
              }`}
            >
              {isAuthenticated ? (
                <UserRound className="h-5 w-5" aria-hidden="true" />
              ) : (
                <span>{signInLabel}</span>
              )}
            </a>
          )}
        </div>
      )}

      <div className="hidden items-center gap-4 text-base text-muted-foreground sm:flex">
        {secondaryLinks.map((link) => (
          <a
            key={link.href}
            href={link.href}
            {...prefetchProps(link.href)}
            className="rounded-md px-2 py-1.5 text-[0.97rem] font-medium hover:bg-accent hover:text-foreground transition-colors"
          >
            {link.label}
          </a>
        ))}
        {primaryCta && (
          <a
            href={primaryCta.href}
            {...prefetchProps(primaryCta.href)}
            className="inline-flex items-center rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background transition hover:bg-foreground/90"
          >
            {primaryCta.label}
          </a>
        )}
        {hasLocaleSwitcher && (
          <select
            aria-label={localeSwitcherLabel}
            className="h-9 min-w-[8.5rem] rounded-md border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground"
            value={activeLocale}
            onChange={(event) => {
              const nextLocale = event.target.value;
              const nextOption = localeOptions.find((option) => option.code.trim().toLowerCase() === nextLocale);
              if (nextOption) handleLocaleChange(nextOption.href);
            }}
          >
            {localeOptions.map((option) => (
              <option key={option.code} value={option.code.trim().toLowerCase()}>
                {option.label}
              </option>
            ))}
          </select>
        )}
        <ModeToggle />
        {isAdmin && adminLink && (
          <a
            href={adminLink.href}
            {...prefetchProps(adminLink.href)}
            aria-label={adminLink.label}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background text-foreground transition-colors hover:bg-accent"
          >
            <Settings className="h-5 w-5" aria-hidden="true" />
          </a>
        )}
        {authLink && (
          isAuthenticated ? (
            <a
              href={authLink.href}
              {...prefetchProps(authLink.href)}
              aria-label={authLink.label}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background text-foreground transition-colors hover:bg-accent"
            >
              <UserRound className="h-5 w-5" aria-hidden="true" />
            </a>
          ) : (
            <a
              href={authLink.href}
              {...prefetchProps(authLink.href)}
              className="inline-flex items-center rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              {authLink.label}
            </a>
          )
        )}
      </div>
    </nav>
  );
}
