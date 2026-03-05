import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.SUPABASE_URL || 'https://placeholder.supabase.co'
const supabasePublishableKey = import.meta.env.SUPABASE_PUBLISHABLE_KEY || 'placeholder-publishable-key'
const supabaseSecretKey = import.meta.env.SUPABASE_SECRET_KEY
const hasSecretKey = typeof supabaseSecretKey === 'string' && supabaseSecretKey.length > 0

if (!import.meta.env.SUPABASE_URL || !import.meta.env.SUPABASE_PUBLISHABLE_KEY) {
  console.warn('⚠️  Supabase environment variables not configured. Using placeholder values for development.')
}

if (import.meta.env.SSR && !hasSecretKey) {
  console.error('❌ SUPABASE_SECRET_KEY is not configured. Admin routes and privileged operations will fail closed.')
}

// Client for public operations (with RLS)
export const supabase = createClient(supabaseUrl, supabasePublishableKey)

// Admin client for server-side operations (bypasses RLS)
export const supabaseAdmin = createClient(
  supabaseUrl,
  hasSecretKey ? supabaseSecretKey : 'missing-secret-key',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

export const isSupabaseAdminConfigured = hasSecretKey

export function createSupabaseServerClient(accessToken?: string) {
  return createClient(
    supabaseUrl,
    supabasePublishableKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false
      },
      ...(accessToken
        ? {
            global: {
              headers: {
                Authorization: `Bearer ${accessToken}`
              }
            }
          }
        : {})
    }
  )
}

export type Database = {
  public: {
    Tables: {
      authors: {
        Row: {
          id: string
          name: string
          slug: string
          email: string
          bio: string | null
          avatar_url: string | null
          auth_user_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          email: string
          bio?: string | null
          avatar_url?: string | null
          auth_user_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          email?: string
          bio?: string | null
          avatar_url?: string | null
          auth_user_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      categories: {
        Row: {
          id: string
          name: string
          slug: string
          description: string | null
          parent_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          description?: string | null
          parent_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          description?: string | null
          parent_id?: string | null
          created_at?: string
        }
      }
      tags: {
        Row: {
          id: string
          name: string
          slug: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          created_at?: string
        }
      }
      posts: {
        Row: {
          id: string
          title: string
          slug: string
          locale: string
          content: string
          blocks: any
          excerpt: string | null
          author_id: string
          featured_image_id?: string | null
          audio_asset_id?: string | null
          status: 'draft' | 'published' | 'scheduled'
          published_at: string | null
          created_at: string
          updated_at: string
          seo_metadata: any | null
          custom_fields: any | null
        }
        Insert: {
          id?: string
          title: string
          slug: string
          locale?: string
          content: string
          blocks?: any
          excerpt?: string | null
          author_id: string
          featured_image_id?: string | null
          audio_asset_id?: string | null
          status?: 'draft' | 'published' | 'scheduled'
          published_at?: string | null
          created_at?: string
          updated_at?: string
          seo_metadata?: any | null
          custom_fields?: any | null
        }
        Update: {
          id?: string
          title?: string
          slug?: string
          locale?: string
          content?: string
          blocks?: any
          excerpt?: string | null
          author_id?: string
          featured_image_id?: string | null
          audio_asset_id?: string | null
          status?: 'draft' | 'published' | 'scheduled'
          published_at?: string | null
          created_at?: string
          updated_at?: string
          seo_metadata?: any | null
          custom_fields?: any | null
        }
      }
      pages: {
        Row: {
          id: string
          title: string
          slug: string
          locale: string
          status: 'draft' | 'published' | 'archived'
          template: string
          content_blocks: any
          content_html: string | null
          excerpt: string | null
          author_id: string | null
          seo_metadata: any | null
          published_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          slug: string
          locale?: string
          status?: 'draft' | 'published' | 'archived'
          template?: string
          content_blocks?: any
          content_html?: string | null
          excerpt?: string | null
          author_id?: string | null
          seo_metadata?: any | null
          published_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          slug?: string
          locale?: string
          status?: 'draft' | 'published' | 'archived'
          template?: string
          content_blocks?: any
          content_html?: string | null
          excerpt?: string | null
          author_id?: string | null
          seo_metadata?: any | null
          published_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      page_sections: {
        Row: {
          id: string
          page_id: string
          type: string
          content: any
          order_index: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          page_id: string
          type: string
          content?: any
          order_index?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          page_id?: string
          type?: string
          content?: any
          order_index?: number
          created_at?: string
          updated_at?: string
        }
      }
      media_assets: {
        Row: {
          id: string
          filename: string
          storage_path: string
          alt_text: string | null
          caption: string | null
          mime_type: string
          file_size: number
          dimensions: any | null
          original_filename: string | null
          original_storage_path: string | null
          original_mime_type: string | null
          original_file_size: number | null
          original_dimensions: any | null
          uploaded_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          filename: string
          storage_path: string
          alt_text?: string | null
          caption?: string | null
          mime_type: string
          file_size: number
          dimensions?: any | null
          original_filename?: string | null
          original_storage_path?: string | null
          original_mime_type?: string | null
          original_file_size?: number | null
          original_dimensions?: any | null
          uploaded_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          filename?: string
          storage_path?: string
          alt_text?: string | null
          caption?: string | null
          mime_type?: string
          file_size?: number
          dimensions?: any | null
          original_filename?: string | null
          original_storage_path?: string | null
          original_mime_type?: string | null
          original_file_size?: number | null
          original_dimensions?: any | null
          uploaded_by?: string | null
          created_at?: string
        }
      }
      user_profiles: {
        Row: {
          id: string
          auth_user_id: string
          full_name: string | null
          bio: string | null
          avatar_url: string | null
          avatar_source: string | null
          data: any
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          auth_user_id: string
          full_name?: string | null
          bio?: string | null
          avatar_url?: string | null
          avatar_source?: string | null
          data?: any
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          auth_user_id?: string
          full_name?: string | null
          bio?: string | null
          avatar_url?: string | null
          avatar_source?: string | null
          data?: any
          created_at?: string
          updated_at?: string
        }
      }
      comments: {
        Row: {
          id: string
          post_id: string
          author_name: string
          author_email: string
          content: string
          status: 'pending' | 'approved' | 'rejected'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          post_id: string
          author_name: string
          author_email: string
          content: string
          status?: 'pending' | 'approved' | 'rejected'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          post_id?: string
          author_name?: string
          author_email?: string
          content?: string
          status?: 'pending' | 'approved' | 'rejected'
          created_at?: string
          updated_at?: string
        }
      }
      newsletter_subscribers: {
        Row: {
          id: string
          auth_user_id: string | null
          email: string
          status: 'subscribed' | 'unsubscribed'
          source: string | null
          unsubscribed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          auth_user_id?: string | null
          email: string
          status?: 'subscribed' | 'unsubscribed'
          source?: string | null
          unsubscribed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          auth_user_id?: string | null
          email?: string
          status?: 'subscribed' | 'unsubscribed'
          source?: string | null
          unsubscribed_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      post_categories: {
        Row: {
          post_id: string
          category_id: string
        }
        Insert: {
          post_id: string
          category_id: string
        }
        Update: {
          post_id?: string
          category_id?: string
        }
      }
      post_tags: {
        Row: {
          post_id: string
          tag_id: string
        }
        Insert: {
          post_id: string
          tag_id: string
        }
        Update: {
          post_id?: string
          tag_id?: string
        }
      }
    }
  }
}
