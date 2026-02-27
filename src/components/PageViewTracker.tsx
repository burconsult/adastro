import React from 'react';

const TRACKED_SESSION_KEY_PREFIX = 'adastro:pv:';

function shouldSkipPath(pathname: string): boolean {
  return (
    pathname.startsWith('/admin') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/setup')
  );
}

export default function PageViewTracker() {
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const { pathname, search } = window.location;
    if (shouldSkipPath(pathname)) return;

    const nav = window.navigator as Navigator & { doNotTrack?: string };
    if (nav.doNotTrack === '1' || (window as any).doNotTrack === '1') return;

    const key = `${TRACKED_SESSION_KEY_PREFIX}${pathname}${search}`;
    try {
      if (window.sessionStorage.getItem(key) === '1') return;
      window.sessionStorage.setItem(key, '1');
    } catch {
      // Ignore storage failures; tracking remains best-effort.
    }

    const payload = {
      path: pathname,
      query: search || '',
      title: document.title || '',
      referrer: document.referrer || '',
      viewport: `${window.innerWidth || 0}x${window.innerHeight || 0}`
    };

    void fetch('/api/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true
    }).catch(() => {
      // Best-effort analytics should fail silently on the client.
    });
  }, []);

  return null;
}

