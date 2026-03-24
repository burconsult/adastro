const rawBaseUrl = process.env.BASE_URL || process.env.SITE_URL;

if (!rawBaseUrl) {
  console.error('BASE_URL or SITE_URL is required.');
  process.exit(1);
}

const baseUrl = new URL(rawBaseUrl);
baseUrl.pathname = '';
baseUrl.search = '';
baseUrl.hash = '';

const checkResults = [];

const logPass = (label, detail) => {
  checkResults.push({ status: 'PASS', label, detail });
  console.log(`PASS ${label}: ${detail}`);
};

const fail = (label, detail) => {
  console.error(`FAIL ${label}: ${detail}`);
  process.exitCode = 1;
  throw new Error(`${label}: ${detail}`);
};

const request = async (pathname, init = {}) => {
  const url = new URL(pathname, baseUrl);
  const response = await fetch(url, {
    redirect: 'manual',
    ...init,
    headers: {
      accept: '*/*',
      ...(init.headers || {})
    }
  });

  return { url, response };
};

const expectStatus = async (pathname, expectedStatuses, init = {}) => {
  const { url, response } = await request(pathname, init);
  if (!expectedStatuses.includes(response.status)) {
    fail(pathname, `expected status ${expectedStatuses.join(', ')}, received ${response.status}`);
  }
  return { url, response };
};

const expectHeader = (response, label, headerName, pattern) => {
  const value = response.headers.get(headerName);
  if (!value) {
    fail(label, `missing ${headerName} header`);
  }
  if (!pattern.test(value)) {
    fail(label, `unexpected ${headerName} header: ${value}`);
  }
  return value;
};

const getHtml = async (pathname) => {
  const { response } = await expectStatus(pathname, [200], {
    headers: { accept: 'text/html' }
  });
  const html = await response.text();
  return { response, html };
};

const parseFirstAstroAssetPath = (html) => {
  const match = html.match(/(?:src|href)="(\/_astro\/[^"]+)"/);
  return match?.[1] || null;
};

const assertSetupMode = async (defaultLocale, setupStatus) => {
  const setupPage = await getHtml('/setup');
  expectHeader(setupPage.response, '/setup', 'cache-control', /no-store/i);
  expectHeader(setupPage.response, '/setup', 'content-security-policy', /default-src 'self'/i);
  expectHeader(setupPage.response, '/setup', 'x-content-type-options', /nosniff/i);

  const astroAssetPath = parseFirstAstroAssetPath(setupPage.html);
  if (!astroAssetPath) {
    fail('/setup', 'could not find a /_astro asset reference in HTML');
  }

  const localeRedirect = await expectStatus(`/${defaultLocale}`, [301, 302, 307, 308]);
  const localeLocation = localeRedirect.response.headers.get('location') || '';
  if (localeLocation !== '/setup') {
    fail(`/${defaultLocale}`, `expected setup redirect, received ${localeLocation}`);
  }
  logPass(`/${defaultLocale}`, 'redirects to /setup while setup is incomplete');

  const assetResult = await expectStatus(astroAssetPath, [200]);
  expectHeader(assetResult.response, astroAssetPath, 'cache-control', /immutable/i);
  logPass(astroAssetPath, 'immutable cache header present');

  const blockingEnvChecks = (setupStatus?.checks || [])
    .filter((check) => check?.id?.startsWith?.('env.') && check.status === 'fail')
    .map((check) => check.label);

  fail(
    'setup-mode',
    `preview is setup-gated; missing required env: ${blockingEnvChecks.join(', ') || 'unknown'}`
  );
};

const main = async () => {
  const setupStatusResult = await expectStatus('/api/setup/status', [200], {
    headers: { accept: 'application/json' }
  });
  expectHeader(setupStatusResult.response, '/api/setup/status', 'cache-control', /no-store/i);
  const setupStatus = await setupStatusResult.response.json();
  const defaultLocale = process.env.DEFAULT_LOCALE || setupStatus?.contentLocales?.defaultLocale || 'en';
  const articleBasePath = setupStatus?.contentRouting?.articleBasePath || 'blog';

  logPass('/api/setup/status', `default locale ${defaultLocale}, article base path ${articleBasePath}`);

  const rootResult = await expectStatus('/', [301, 302, 307, 308]);
  const rootLocation = rootResult.response.headers.get('location') || '';
  if (!rootLocation.startsWith(`/${defaultLocale}`) && rootLocation !== '/setup') {
    fail('/', `unexpected redirect location ${rootLocation}`);
  }
  logPass('/', `redirects to ${rootLocation}`);

  if (!setupStatus?.setupCompleted || rootLocation === '/setup') {
    await assertSetupMode(defaultLocale, setupStatus);
    return;
  }

  const localeHome = await getHtml(`/${defaultLocale}`);
  expectHeader(localeHome.response, `/${defaultLocale}`, 'x-content-type-options', /nosniff/i);
  expectHeader(localeHome.response, `/${defaultLocale}`, 'content-security-policy', /default-src 'self'/i);
  const astroAssetPath = parseFirstAstroAssetPath(localeHome.html);
  if (!astroAssetPath) {
    fail(`/${defaultLocale}`, 'could not find a /_astro asset reference in HTML');
  }
  logPass(`/${defaultLocale}`, 'HTML and security headers look correct');

  const articleIndex = await getHtml(`/${defaultLocale}/${articleBasePath}`);
  expectHeader(articleIndex.response, `/${defaultLocale}/${articleBasePath}`, 'content-security-policy', /default-src 'self'/i);
  logPass(`/${defaultLocale}/${articleBasePath}`, 'article index resolved');

  const adminRedirect = await expectStatus('/admin', [301, 302, 307, 308]);
  const adminLocation = adminRedirect.response.headers.get('location') || '';
  if (!/\/auth\/login/i.test(adminLocation)) {
    fail('/admin', `expected redirect to auth login, received ${adminLocation}`);
  }
  logPass('/admin', `redirects to ${adminLocation}`);

  for (const pathname of ['/robots.txt', '/rss.xml', '/sitemap.xml']) {
    const { response } = await expectStatus(pathname, [200]);
    logPass(pathname, `${response.status}`);
  }

  const assetResult = await expectStatus(astroAssetPath, [200]);
  expectHeader(assetResult.response, astroAssetPath, 'cache-control', /immutable/i);
  logPass(astroAssetPath, 'immutable cache header present');

  console.log(`Completed ${checkResults.length} hosted smoke checks against ${baseUrl.toString()}`);
};

await main();
