import type { APIRoute } from 'astro'
import { PostRepository } from '../../lib/database/repositories/post-repository.js'

export async function getStaticPaths() {
  const postRepository = new PostRepository()
  const posts = await postRepository.findWithFilters({ status: 'published' })
  return posts.map((post) => ({ params: { slug: post.slug } }))
}

const width = 1200
const height = 630

export const GET: APIRoute = async ({ params }) => {
  const { slug } = params
  const postRepository = new PostRepository()
  const post = typeof slug === 'string' ? await postRepository.findBySlug(slug) : null
  const title = post?.title ?? 'My Blog'
  const subtitle = post?.author?.name ? `by ${post.author.name}` : ''

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
  <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
      <linearGradient id="g" x1="0" x2="1" y1="1" y2="0">
        <stop offset="0%" stop-color="#6D28D9"/>
        <stop offset="100%" stop-color="#9333EA"/>
      </linearGradient>
      <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
        <feDropShadow dx="0" dy="0" stdDeviation="12" flood-color="rgba(0,0,0,0.35)"/>
      </filter>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#g)"/>
    <circle cx="300" cy="520" r="320" fill="rgba(255,255,255,0.06)"/>
    <circle cx="1040" cy="140" r="220" fill="rgba(255,255,255,0.08)"/>
    <g transform="translate(80, 180)">
      <text x="0" y="0" font-family="Inter Tight, system-ui, sans-serif" font-size="72" font-weight="800" fill="#fff" filter="url(#shadow)">
        ${escapeXml(title).slice(0, 90)}
      </text>
      <text x="0" y="72" dy="1.8em" font-family="Inter Tight, system-ui, sans-serif" font-size="32" font-weight="600" fill="rgba(255,255,255,0.9)">
        ${escapeXml(subtitle)}
      </text>
    </g>
  </svg>`

  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}

function escapeXml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
