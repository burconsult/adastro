#!/usr/bin/env node

import { config as loadEnv } from 'dotenv';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const scriptsDir = dirname(__filename);
const supabaseInfraRoot = dirname(scriptsDir);
const projectRoot = dirname(supabaseInfraRoot);

loadEnv({ path: join(projectRoot, '.env') });

const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
const projectRef = process.env.SUPABASE_PROJECT_REF
  || (process.env.SUPABASE_URL ? new URL(process.env.SUPABASE_URL).hostname.split('.')[0] : null);

if (!accessToken || !projectRef) {
  console.error('Missing SUPABASE_ACCESS_TOKEN or SUPABASE_PROJECT_REF (or SUPABASE_URL).');
  process.exit(1);
}

const numberFromEnv = (key, fallback) => {
  const raw = process.env[key];
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
};

const payload = {
  // Adjust these defaults or set env overrides (e.g. RATE_LIMIT_OTP=30).
  rate_limit_anonymous_users: numberFromEnv('RATE_LIMIT_ANONYMOUS_USERS', 10),
  rate_limit_email_sent: numberFromEnv('RATE_LIMIT_EMAIL_SENT', 30),
  rate_limit_sms_sent: numberFromEnv('RATE_LIMIT_SMS_SENT', 10),
  rate_limit_verify: numberFromEnv('RATE_LIMIT_VERIFY', 360),
  rate_limit_token_refresh: numberFromEnv('RATE_LIMIT_TOKEN_REFRESH', 1800),
  rate_limit_otp: numberFromEnv('RATE_LIMIT_OTP', 60),
  rate_limit_web3: numberFromEnv('RATE_LIMIT_WEB3', 10)
};

const smtpConfigured = [
  'SMTP_ADMIN_EMAIL',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASS'
].every((key) => process.env[key]);

if (!smtpConfigured) {
  delete payload.rate_limit_email_sent;
}

const apiBase = `https://api.supabase.com/v1/projects/${projectRef}/config/auth`;

const request = async (method, body) => {
  const response = await fetch(apiBase, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`${method} failed: ${response.status} ${response.statusText} - ${details}`);
  }

  return response.json();
};

try {
  const current = await request('GET');
  const applied = await request('PATCH', payload);

  console.log('Current auth config (rate limits filtered):');
  Object.keys(current)
    .filter((key) => key.startsWith('rate_limit_'))
    .forEach((key) => console.log(`${key}: ${current[key]}`));

  console.log('\nUpdated auth rate limits:');
  Object.keys(payload).forEach((key) => console.log(`${key}: ${payload[key]}`));

  if (applied) {
    console.log('\nSupabase auth config updated.');
  }
} catch (error) {
  console.error('Failed to update auth rate limits:', error.message);
  process.exit(1);
}
