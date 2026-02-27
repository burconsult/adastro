#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'
import { config as loadEnv } from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const scriptsDir = dirname(__filename)
const supabaseInfraRoot = dirname(scriptsDir)
const infraRoot = dirname(supabaseInfraRoot)
const projectRoot = dirname(infraRoot)

loadEnv({ path: join(projectRoot, '.env') })
loadEnv({ path: join(projectRoot, '.env.local') })

const args = process.argv.slice(2)

const getArgValue = (flag) => {
  const index = args.indexOf(flag)
  if (index === -1) return undefined
  return args[index + 1]
}

const hasFlag = (flag) => args.includes(flag)

const email = (getArgValue('--email') || '').trim().toLowerCase()
const password = getArgValue('--password')
const displayNameInput = (getArgValue('--name') || '').trim()
const allowCreate = !hasFlag('--no-create')
const markEmailConfirmed = !hasFlag('--no-confirm-email')

if (!email) {
  console.error('Missing required --email argument.')
  console.error('Usage: npm run admin:bootstrap -- --email you@example.com --password "StrongPass!123"')
  process.exit(1)
}

if (!password || password.trim().length < 8) {
  console.error('Missing or weak --password argument (minimum 8 characters).')
  process.exit(1)
}

const supabaseUrl = process.env.SUPABASE_URL
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY

if (!supabaseUrl || !supabaseSecretKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SECRET_KEY in environment.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseSecretKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

const slugify = (value) => (
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
)

const isMissingTableError = (message) => {
  const normalized = String(message || '').toLowerCase()
  return normalized.includes('does not exist')
    || normalized.includes('could not find the table')
    || normalized.includes('relation')
}

const findAuthUserByEmail = async (targetEmail) => {
  let page = 1
  const perPage = 200

  while (page <= 20) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage })
    if (error) {
      throw new Error(`Could not list auth users: ${error.message}`)
    }

    const users = data?.users || []
    const match = users.find((user) => user.email?.toLowerCase() === targetEmail)
    if (match) return match

    if (users.length < perPage) break
    page += 1
  }

  return null
}

const resolveUniqueAuthorSlug = async (baseSlug, targetEmail) => {
  let candidate = baseSlug || 'admin'
  let attempt = 2

  while (attempt <= 50) {
    const { data, error } = await supabase
      .from('authors')
      .select('slug,email')
      .eq('slug', candidate)
      .maybeSingle()

    if (error) {
      if (isMissingTableError(error.message)) {
        return candidate
      }
      throw new Error(`Could not validate author slug: ${error.message}`)
    }

    if (!data || data.email?.toLowerCase() === targetEmail) {
      return candidate
    }

    candidate = `${baseSlug}-${attempt}`
    attempt += 1
  }

  return `${baseSlug}-${Date.now().toString().slice(-6)}`
}

const ensureAuthorProfile = async (user, nameOverride) => {
  const userEmail = String(user.email || '').trim().toLowerCase()
  if (!userEmail) return 'Skipped author sync: auth user has no email.'

  const displayNameRaw = nameOverride
    || String(user.user_metadata?.full_name || user.user_metadata?.name || userEmail.split('@')[0] || 'Admin')
  const displayName = displayNameRaw.slice(0, 120)
  const baseSlug = slugify(displayName) || slugify(userEmail.split('@')[0] || '') || 'admin'

  const { data: existing, error: existingError } = await supabase
    .from('authors')
    .select('id,slug,email,auth_user_id,name')
    .eq('email', userEmail)
    .maybeSingle()

  if (existingError) {
    if (isMissingTableError(existingError.message)) {
      return 'Skipped author sync: `authors` table is not available yet.'
    }
    throw new Error(`Could not load author profile: ${existingError.message}`)
  }

  if (existing) {
    const updates = {
      auth_user_id: user.id,
      updated_at: new Date().toISOString()
    }

    if (!existing.name) {
      updates.name = displayName
    }

    if (!existing.slug) {
      updates.slug = await resolveUniqueAuthorSlug(baseSlug, userEmail)
    }

    const { error } = await supabase
      .from('authors')
      .update(updates)
      .eq('id', existing.id)

    if (error) {
      throw new Error(`Could not update author profile: ${error.message}`)
    }
    return 'Updated existing author profile.'
  }

  const slug = await resolveUniqueAuthorSlug(baseSlug, userEmail)
  const { error: insertError } = await supabase
    .from('authors')
    .insert({
      name: displayName,
      email: userEmail,
      slug,
      auth_user_id: user.id
    })

  if (insertError) {
    throw new Error(`Could not create author profile: ${insertError.message}`)
  }

  return 'Created author profile.'
}

try {
  const projectRef = new URL(supabaseUrl).hostname.split('.')[0]
  console.log(`🔐 Bootstrapping admin user for project ${projectRef}`)
  console.log(`   Email: ${email}`)

  let user = await findAuthUserByEmail(email)
  const displayName = displayNameInput || email.split('@')[0]

  if (!user && allowCreate) {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: markEmailConfirmed,
      app_metadata: { role: 'admin' },
      user_metadata: { full_name: displayName }
    })

    if (error) {
      throw new Error(`Could not create user: ${error.message}`)
    }

    user = data?.user || null
    console.log('✅ Created auth user.')
  } else if (!user) {
    throw new Error('User does not exist and --no-create was provided.')
  }

  const mergedAppMetadata = {
    ...(user.app_metadata || {}),
    role: 'admin'
  }

  const updatePayload = {
    password,
    app_metadata: mergedAppMetadata,
    email_confirm: markEmailConfirmed
  }

  const { data: updatedData, error: updateError } = await supabase.auth.admin.updateUserById(user.id, updatePayload)
  if (updateError) {
    throw new Error(`Could not update user: ${updateError.message}`)
  }

  const updatedUser = updatedData?.user || { ...user, app_metadata: mergedAppMetadata }
  console.log('✅ Updated password and admin role.')

  const authorMessage = await ensureAuthorProfile(updatedUser, displayNameInput)
  console.log(`✅ ${authorMessage}`)

  console.log('\nDone. You can now sign in with this user and access /admin.')
} catch (error) {
  console.error(`❌ ${error instanceof Error ? error.message : 'Unexpected bootstrap error.'}`)
  process.exit(1)
}
