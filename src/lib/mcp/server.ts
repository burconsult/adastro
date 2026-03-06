import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod/v4';

import { SettingsService } from '@/lib/services/settings-service';
import { ContentManager } from '@/lib/services/content-manager';
import { PostRepository } from '@/lib/database/repositories/post-repository';
import { PageRepository } from '@/lib/database/repositories/page-repository';
import { MediaRepository } from '@/lib/database/repositories/media-repository';
import { AuthorRepository } from '@/lib/database/repositories/author-repository';
import { CategoryRepository } from '@/lib/database/repositories/category-repository';
import { TagRepository } from '@/lib/database/repositories/tag-repository';
import { getSiteContentRouting } from '@/lib/site-config';
import { generateExcerpt, generateSlug, sanitizeHtml } from '@/lib/utils/data-transform';
import { editorJsToHtml, normalizeEditorJsData } from '@/lib/editorjs';
import { supabaseAdmin } from '@/lib/supabase';
import { normalizeBooleanSetting } from '@/lib/setup/runtime';
import { isFeatureActive } from '@/lib/features/state';
import { getFeatureMcpExtensions } from '@/lib/features/runtime';
import type { PageSectionInput } from '@/lib/database/repositories/page-section-repository';
import type { FeatureMcpToolRegistration } from '@/lib/features/types';

type JsonRecord = Record<string, unknown>;

type ToolResponse = {
  ok: boolean;
  data?: unknown;
  error?: string;
};

export interface AdAstroMcpToolDeps {
  getStatus(): Promise<JsonRecord>;
  listAuthors(input: { limit: number; offset: number; search?: string }): Promise<unknown>;
  listCategories(input: { limit: number; offset: number; search?: string }): Promise<unknown>;
  listTags(input: { limit: number; offset: number; search?: string }): Promise<unknown>;
  listMedia(input: { limit: number; offset: number; search?: string; mimeType?: string }): Promise<unknown>;
  getMedia(id: string): Promise<unknown>;
  listPosts(input: {
    status?: 'draft' | 'published' | 'scheduled';
    search?: string;
    limit: number;
    offset: number;
  }): Promise<unknown>;
  getPost(input: { id?: string; slug?: string }): Promise<unknown>;
  createPost(input: JsonRecord): Promise<unknown>;
  updatePost(input: JsonRecord & { id: string }): Promise<unknown>;
  publishPost(input: { id: string; publishAt?: string }): Promise<unknown>;
  unpublishPost(input: { id: string }): Promise<unknown>;
  listPages(input: {
    status?: 'draft' | 'published' | 'archived';
    search?: string;
    limit: number;
    offset: number;
  }): Promise<unknown>;
  getPage(input: { id?: string; slug?: string }): Promise<unknown>;
  createPage(input: JsonRecord): Promise<unknown>;
  updatePage(input: JsonRecord & { id: string }): Promise<unknown>;
  getSettings(input: { keys?: string[]; prefix?: string; category?: string }): Promise<unknown>;
  updateSettings(input: { settings: Record<string, unknown> }): Promise<unknown>;
  getAnalyticsSummary(input: { days: 7 | 30 }): Promise<unknown>;
}

const clampLimit = (value: unknown, fallback = 20, max = 100) => {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(1, Math.min(max, Math.trunc(numeric)));
};

const clampOffset = (value: unknown) => {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.trunc(numeric));
};

const normalizeSections = (sections: unknown): PageSectionInput[] => {
  if (!Array.isArray(sections)) return [];
  const normalized: PageSectionInput[] = [];

  sections.forEach((section, index) => {
    if (!section || typeof section !== 'object') return;
    const record = section as Record<string, unknown>;
    const type = typeof record.type === 'string' ? record.type.trim() : '';
    if (!type) return;

    const content =
      record.content && typeof record.content === 'object' && !Array.isArray(record.content)
        ? (record.content as Record<string, any>)
        : {};
    const orderIndex =
      typeof record.orderIndex === 'number' && Number.isFinite(record.orderIndex)
        ? record.orderIndex
        : index;

    normalized.push({ type, content, orderIndex });
  });

  return normalized;
};

function toToolText(result: unknown): string {
  return JSON.stringify(result, null, 2);
}

function success(data: unknown): ToolResponse {
  return { ok: true, data };
}

function failure(error: unknown): ToolResponse {
  const message = error instanceof Error ? error.message : String(error);
  return { ok: false, error: message };
}

async function runTool(handler: () => Promise<unknown>) {
  try {
    const payload = success(await handler());
    return {
      content: [{ type: 'text' as const, text: toToolText(payload) }]
    };
  } catch (error) {
    const payload = failure(error);
    return {
      isError: true,
      content: [{ type: 'text' as const, text: toToolText(payload) }]
    };
  }
}

async function resolvePreferredAuthorId(authorRepo: AuthorRepository, requestedAuthorId?: string): Promise<string> {
  if (requestedAuthorId && typeof requestedAuthorId === 'string') {
    const author = await authorRepo.findById(requestedAuthorId);
    if (!author) {
      throw new Error(`Author not found: ${requestedAuthorId}`);
    }
    return author.id;
  }

  const [author] = await authorRepo.findAll(1, 0);
  if (!author) {
    throw new Error('No authors found. Create or invite an author before using publishing tools.');
  }
  return author.id;
}

class DefaultAdAstroMcpToolDeps implements AdAstroMcpToolDeps {
  private readonly settingsService = new SettingsService();
  private readonly contentManager = new ContentManager(true);
  private readonly postRepo = new PostRepository(true);
  private readonly pageRepo = new PageRepository(true);
  private readonly mediaRepo = new MediaRepository(true);
  private readonly authorRepo = new AuthorRepository(true);
  private readonly categoryRepo = new CategoryRepository(true);
  private readonly tagRepo = new TagRepository(true);

  async getStatus(): Promise<JsonRecord> {
    const [routing, siteTitle, siteUrl, setupCompleted] = await Promise.all([
      getSiteContentRouting({ refresh: true }),
      this.settingsService.getSetting('site.title'),
      this.settingsService.getSetting('site.url'),
      this.settingsService.getSetting('setup.completed')
    ]);

    return {
      app: 'AdAstro',
      version: '1.0.0',
      siteTitle,
      siteUrl,
      setupCompleted: normalizeBooleanSetting(setupCompleted),
      articlesBasePath: routing.articleBasePath,
      articlePermalinkStyle: routing.articlePermalinkStyle,
      serverTime: new Date().toISOString()
    };
  }

  async listAuthors(input: { limit: number; offset: number; search?: string }) {
    const items = input.search
      ? await this.authorRepo.search(input.search, input.limit, input.offset)
      : await this.authorRepo.findAll(input.limit, input.offset);
    return { items, total: items.length };
  }

  async listCategories(input: { limit: number; offset: number; search?: string }) {
    const items = input.search
      ? await this.categoryRepo.search(input.search, input.limit, input.offset)
      : await this.categoryRepo.findAll(input.limit, input.offset);
    return { items, total: items.length };
  }

  async listTags(input: { limit: number; offset: number; search?: string }) {
    const items = input.search
      ? await this.tagRepo.search(input.search, input.limit, input.offset)
      : await this.tagRepo.findAll(input.limit, input.offset);
    return { items, total: items.length };
  }

  async listMedia(input: { limit: number; offset: number; search?: string; mimeType?: string }) {
    return this.mediaRepo.findMany({
      limit: input.limit,
      offset: input.offset,
      search: input.search,
      mimeType: input.mimeType
    });
  }

  async getMedia(id: string) {
    const asset = await this.mediaRepo.findById(id);
    if (!asset) throw new Error(`Media asset not found: ${id}`);
    return asset;
  }

  async listPosts(input: { status?: 'draft' | 'published' | 'scheduled'; search?: string; limit: number; offset: number }) {
    const items = await this.postRepo.findWithFilters({
      status: input.status,
      search: input.search,
      limit: input.limit,
      offset: input.offset
    });
    return { items, total: items.length };
  }

  async getPost(input: { id?: string; slug?: string }) {
    if (input.id) {
      const post = await this.postRepo.findByIdWithRelations(input.id);
      if (!post) throw new Error(`Post not found: ${input.id}`);
      return post;
    }
    if (input.slug) {
      const post = await this.postRepo.findBySlug(input.slug);
      if (!post) throw new Error(`Post not found for slug: ${input.slug}`);
      return post;
    }
    throw new Error('Provide either id or slug.');
  }

  async createPost(input: JsonRecord) {
    const blocksProvided = Object.prototype.hasOwnProperty.call(input, 'blocks');
    const normalizedBlocks = blocksProvided ? normalizeEditorJsData((input as any).blocks) : { blocks: [] };
    const derivedHtml = normalizedBlocks.blocks.length > 0 ? editorJsToHtml(normalizedBlocks) : '';
    const rawContent = typeof input.content === 'string' ? input.content : '';
    const content = rawContent.trim() ? sanitizeHtml(rawContent) : derivedHtml;
    if (!content.trim()) {
      throw new Error('Post content is required (content or blocks).');
    }

    const title = typeof input.title === 'string' ? input.title.trim() : '';
    if (!title) throw new Error('Post title is required.');

    const authorId = await resolvePreferredAuthorId(this.authorRepo, typeof input.authorId === 'string' ? input.authorId : undefined);
    const slugCandidate = typeof input.slug === 'string' ? input.slug.trim() : '';
    const slug = slugCandidate || generateSlug(title);
    if (!slug) throw new Error('Could not generate a valid post slug.');

    const post = await this.postRepo.create({
      title,
      slug,
      content,
      blocks: blocksProvided ? normalizedBlocks : undefined,
      excerpt: typeof input.excerpt === 'string' && input.excerpt.trim()
        ? input.excerpt.trim()
        : generateExcerpt(content),
      status: (typeof input.status === 'string' ? input.status : 'draft') as any,
      authorId,
      categoryIds: Array.isArray(input.categoryIds) ? input.categoryIds.filter((v): v is string => typeof v === 'string') : [],
      tagIds: Array.isArray(input.tagIds) ? input.tagIds.filter((v): v is string => typeof v === 'string') : [],
      featuredImageId: typeof input.featuredImageId === 'string' ? input.featuredImageId : undefined,
      audioAssetId: typeof input.audioAssetId === 'string' ? input.audioAssetId : undefined,
      seoMetadata: typeof input.seoMetadata === 'object' && input.seoMetadata !== null ? input.seoMetadata : undefined,
      publishedAt: typeof input.publishedAt === 'string' ? new Date(input.publishedAt) : undefined
    });

    return (await this.postRepo.findByIdWithRelations(post.id)) ?? post;
  }

  async updatePost(input: JsonRecord & { id: string }) {
    const id = input.id;
    const existing = await this.postRepo.findById(id);
    if (!existing) throw new Error(`Post not found: ${id}`);

    const blocksProvided = Object.prototype.hasOwnProperty.call(input, 'blocks');
    const normalizedBlocks = blocksProvided ? normalizeEditorJsData((input as any).blocks) : undefined;
    const derivedHtml = normalizedBlocks && normalizedBlocks.blocks.length > 0 ? editorJsToHtml(normalizedBlocks) : '';
    const rawContent = typeof input.content === 'string' ? input.content : '';

    let contentToPersist: string | undefined;
    if (rawContent.trim()) {
      contentToPersist = sanitizeHtml(rawContent);
    } else if (blocksProvided) {
      contentToPersist = derivedHtml || existing.content;
    }

    const updated = await this.postRepo.update(id, {
      title: typeof input.title === 'string' ? input.title.trim() || undefined : undefined,
      slug: typeof input.slug === 'string'
        ? (input.slug.trim() || (typeof input.title === 'string' ? generateSlug(input.title) : undefined))
        : undefined,
      content: contentToPersist,
      blocks: blocksProvided ? normalizedBlocks ?? { blocks: [] } : undefined,
      excerpt: typeof input.excerpt === 'string' ? input.excerpt : undefined,
      status: typeof input.status === 'string' ? (input.status as any) : undefined,
      authorId: typeof input.authorId === 'string' ? await resolvePreferredAuthorId(this.authorRepo, input.authorId) : undefined,
      categoryIds: Array.isArray(input.categoryIds) ? input.categoryIds.filter((v): v is string => typeof v === 'string') : undefined,
      tagIds: Array.isArray(input.tagIds) ? input.tagIds.filter((v): v is string => typeof v === 'string') : undefined,
      featuredImageId: typeof input.featuredImageId === 'string' ? input.featuredImageId : undefined,
      audioAssetId: typeof input.audioAssetId === 'string' ? input.audioAssetId : undefined,
      seoMetadata: typeof input.seoMetadata === 'object' && input.seoMetadata !== null ? input.seoMetadata : undefined,
      publishedAt: typeof input.publishedAt === 'string' ? new Date(input.publishedAt) : undefined
    });

    return (await this.postRepo.findByIdWithRelations(updated.id)) ?? updated;
  }

  async publishPost(input: { id: string; publishAt?: string }) {
    return this.contentManager.publishPost(input.id, input.publishAt ? new Date(input.publishAt) : undefined);
  }

  async unpublishPost(input: { id: string }) {
    return this.contentManager.unpublishPost(input.id);
  }

  async listPages(input: { status?: 'draft' | 'published' | 'archived'; search?: string; limit: number; offset: number }) {
    const items = await this.pageRepo.findWithFilters({
      status: input.status,
      search: input.search,
      limit: input.limit,
      offset: input.offset
    });
    return { items, total: items.length };
  }

  async getPage(input: { id?: string; slug?: string }) {
    if (input.id) {
      const page = await this.pageRepo.findByIdWithRelations(input.id);
      if (!page) throw new Error(`Page not found: ${input.id}`);
      return page;
    }
    if (input.slug) {
      const page = await this.pageRepo.findBySlug(input.slug);
      if (!page) throw new Error(`Page not found for slug: ${input.slug}`);
      return page;
    }
    throw new Error('Provide either id or slug.');
  }

  async createPage(input: JsonRecord) {
    const title = typeof input.title === 'string' ? input.title.trim() : '';
    if (!title) throw new Error('Page title is required.');

    const slugCandidate = typeof input.slug === 'string' ? input.slug.trim() : '';
    const slug = slugCandidate || generateSlug(title);
    if (!slug) throw new Error('Could not generate a valid page slug.');

    const blocksProvided = Object.prototype.hasOwnProperty.call(input, 'blocks');
    const normalizedBlocks = blocksProvided ? normalizeEditorJsData((input as any).blocks) : { blocks: [] };
    const derivedFromBlocks = normalizedBlocks.blocks.length > 0 ? editorJsToHtml(normalizedBlocks) : '';
    const incomingContent = typeof input.content === 'string' ? sanitizeHtml(input.content) : '';
    const incomingHtml = typeof input.contentHtml === 'string' ? sanitizeHtml(input.contentHtml) : '';
    const contentHtml = incomingHtml.trim() || incomingContent.trim() || derivedFromBlocks;

    const authorId = await resolvePreferredAuthorId(this.authorRepo, typeof input.authorId === 'string' ? input.authorId : undefined);
    const sections = normalizeSections((input as any).sections);

    return this.pageRepo.createWithSections({
      title,
      slug,
      status: (typeof input.status === 'string' ? input.status : 'draft') as any,
      template: typeof input.template === 'string' && input.template.trim() ? input.template.trim() : 'default',
      contentBlocks: blocksProvided ? normalizedBlocks : undefined,
      contentHtml,
      excerpt: typeof input.excerpt === 'string' ? input.excerpt : undefined,
      authorId,
      seoMetadata: typeof input.seoMetadata === 'object' && input.seoMetadata !== null ? input.seoMetadata : undefined,
      publishedAt: typeof input.publishedAt === 'string' ? new Date(input.publishedAt) : undefined
    }, sections);
  }

  async updatePage(input: JsonRecord & { id: string }) {
    const id = input.id;
    const existing = await this.pageRepo.findByIdWithRelations(id);
    if (!existing) throw new Error(`Page not found: ${id}`);

    const blocksProvided = Object.prototype.hasOwnProperty.call(input, 'blocks');
    const normalizedBlocks = blocksProvided ? normalizeEditorJsData((input as any).blocks) : undefined;
    const derivedFromBlocks = normalizedBlocks && normalizedBlocks.blocks.length > 0 ? editorJsToHtml(normalizedBlocks) : '';
    const incomingContent = typeof input.content === 'string' ? sanitizeHtml(input.content) : '';
    const incomingHtml = typeof input.contentHtml === 'string' ? sanitizeHtml(input.contentHtml) : '';

    let contentHtml: string | undefined;
    if (incomingHtml.trim()) {
      contentHtml = incomingHtml;
    } else if (incomingContent.trim()) {
      contentHtml = incomingContent;
    } else if (blocksProvided) {
      contentHtml = derivedFromBlocks || existing.contentHtml || '';
    }

    const sections = Object.prototype.hasOwnProperty.call(input, 'sections')
      ? normalizeSections((input as any).sections)
      : (existing.sections ?? []).map((section, index) => ({
          type: section.type,
          content: section.content ?? {},
          orderIndex: typeof (section as any).orderIndex === 'number' ? (section as any).orderIndex : index
        }));

    return this.pageRepo.updateWithSections(id, {
      title: typeof input.title === 'string' ? input.title.trim() || undefined : undefined,
      slug: typeof input.slug === 'string'
        ? (input.slug.trim() || (typeof input.title === 'string' ? generateSlug(input.title) : undefined))
        : undefined,
      status: typeof input.status === 'string' ? (input.status as any) : undefined,
      template: typeof input.template === 'string' ? input.template : undefined,
      excerpt: typeof input.excerpt === 'string' ? input.excerpt : undefined,
      seoMetadata: typeof input.seoMetadata === 'object' && input.seoMetadata !== null ? input.seoMetadata : undefined,
      publishedAt: typeof input.publishedAt === 'string' ? new Date(input.publishedAt) : undefined,
      authorId: typeof input.authorId === 'string' ? await resolvePreferredAuthorId(this.authorRepo, input.authorId) : undefined,
      ...(blocksProvided ? { contentBlocks: normalizedBlocks ?? { blocks: [] } } : {}),
      ...(contentHtml !== undefined ? { contentHtml } : {})
    }, sections);
  }

  async getSettings(input: { keys?: string[]; prefix?: string; category?: string }) {
    if (input.keys && input.keys.length > 0) {
      return this.settingsService.getSettings(input.keys);
    }
    if (input.prefix && input.prefix.trim()) {
      return this.settingsService.getSettingsByPrefix(input.prefix.trim());
    }
    if (input.category && input.category.trim()) {
      return this.settingsService.getSettingsByCategory(input.category.trim());
    }
    return this.settingsService.exportSettings();
  }

  async updateSettings(input: { settings: Record<string, unknown> }) {
    await this.settingsService.updateSettings(input.settings, 'mcp-server');
    return {
      updatedKeys: Object.keys(input.settings),
      count: Object.keys(input.settings).length
    };
  }

  async getAnalyticsSummary(input: { days: 7 | 30 }) {
    const days = input.days;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const previousSince = new Date(Date.now() - days * 2 * 24 * 60 * 60 * 1000).toISOString();

    const [{ data: currentRows, error: currentError }, { data: previousRows, error: previousError }] = await Promise.all([
      (supabaseAdmin as any)
        .from('analytics_events')
        .select('created_at, data')
        .eq('event_type', 'page_view')
        .eq('entity_type', 'page')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(5000),
      (supabaseAdmin as any)
        .from('analytics_events')
        .select('created_at')
        .eq('event_type', 'page_view')
        .eq('entity_type', 'page')
        .gte('created_at', previousSince)
        .lt('created_at', since)
        .limit(5000)
    ]);

    if (currentError) throw new Error(currentError.message || 'Failed to load analytics data');
    if (previousError) throw new Error(previousError.message || 'Failed to load analytics comparison data');

    const rows = Array.isArray(currentRows) ? currentRows : [];
    const previousCount = Array.isArray(previousRows) ? previousRows.length : 0;
    const topPathMap = new Map<string, number>();
    const countryMap = new Map<string, number>();
    const deviceMap = new Map<string, number>();
    const browserMap = new Map<string, number>();
    const dailyMap = new Map<string, number>();

    for (const row of rows) {
      const createdAt = typeof row.created_at === 'string' ? row.created_at : '';
      const day = createdAt ? createdAt.slice(0, 10) : '';
      if (day) dailyMap.set(day, (dailyMap.get(day) || 0) + 1);

      const path = typeof (row as any)?.data?.path === 'string' ? String((row as any).data.path) : '/';
      topPathMap.set(path, (topPathMap.get(path) || 0) + 1);
      const countryCode = typeof (row as any)?.data?.countryCode === 'string'
        ? String((row as any).data.countryCode).trim().toUpperCase()
        : 'ZZ';
      const deviceType = typeof (row as any)?.data?.deviceType === 'string'
        ? String((row as any).data.deviceType).trim().toLowerCase()
        : 'unknown';
      const browser = typeof (row as any)?.data?.browser === 'string'
        ? String((row as any).data.browser).trim()
        : 'Unknown';
      countryMap.set(countryCode || 'ZZ', (countryMap.get(countryCode || 'ZZ') || 0) + 1);
      deviceMap.set(deviceType || 'unknown', (deviceMap.get(deviceType || 'unknown') || 0) + 1);
      browserMap.set(browser || 'Unknown', (browserMap.get(browser || 'Unknown') || 0) + 1);
    }

    const topPaths = [...topPathMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([path, count]) => ({ path, count }));

    const dailyViews = [...dailyMap.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, count]) => ({ date, count }));
    const countryBreakdown = [...countryMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([countryCode, count]) => ({ countryCode, count }));
    const deviceBreakdown = [...deviceMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([deviceType, count]) => ({ deviceType, count }));
    const browserBreakdown = [...browserMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([browser, count]) => ({ browser, count }));

    return {
      windowDays: days,
      totalPageViews: rows.length,
      previousWindowPageViews: previousCount,
      topPaths,
      dailyViews,
      countryBreakdown,
      deviceBreakdown,
      browserBreakdown
    };
  }
}

export function createDefaultAdAstroMcpToolDeps(): AdAstroMcpToolDeps {
  return new DefaultAdAstroMcpToolDeps();
}

type FeatureMcpToolSet = {
  featureId: string;
  tools: FeatureMcpToolRegistration[];
};

type FeatureToolResolver = () => Promise<FeatureMcpToolSet[]>;

export interface AdAstroMcpServerOptions {
  resolveFeatureToolSets?: FeatureToolResolver;
}

const CORE_MCP_TOOL_NAMES = new Set<string>([
  'adastro_status',
  'authors_list',
  'categories_list',
  'tags_list',
  'media_list',
  'media_get',
  'posts_list',
  'post_get',
  'post_create',
  'post_update',
  'post_publish',
  'post_unpublish',
  'pages_list',
  'page_get',
  'page_create',
  'page_update',
  'settings_get',
  'settings_update',
  'analytics_summary'
]);

async function resolveDefaultFeatureToolSets(): Promise<FeatureMcpToolSet[]> {
  const extensions = getFeatureMcpExtensions();
  const resolved: FeatureMcpToolSet[] = [];

  for (const { featureId, extension } of extensions) {
    try {
      const active = await isFeatureActive(featureId);
      if (!active) continue;

      const tools = await extension.getTools();
      if (!Array.isArray(tools) || tools.length === 0) continue;

      resolved.push({ featureId, tools });
    } catch (error) {
      console.warn(`Feature MCP tool registration skipped for "${featureId}".`, error);
    }
  }

  return resolved;
}

function registerFeatureTools(
  server: McpServer,
  featureToolSets: FeatureMcpToolSet[],
  reservedToolNames: Set<string>
) {
  for (const { featureId, tools } of featureToolSets) {
    for (const tool of tools) {
      const expectedPrefix = `${featureId}_`;
      if (!tool.name.startsWith(expectedPrefix)) {
        console.warn(
          `Skipping feature MCP tool "${tool.name}" from "${featureId}". Tool names must start with "${expectedPrefix}".`
        );
        continue;
      }

      if (reservedToolNames.has(tool.name)) {
        console.warn(`Skipping duplicate MCP tool registration for "${tool.name}".`);
        continue;
      }

      reservedToolNames.add(tool.name);

      server.registerTool(tool.name, {
        title: tool.title,
        description: tool.description,
        ...(tool.inputSchema ? { inputSchema: tool.inputSchema } : {}),
        ...(tool.annotations ? { annotations: tool.annotations } : {})
      }, async (args) => runTool(() => tool.handler(args as Record<string, unknown>)));
    }
  }
}

const listSchema = {
  limit: z.number().int().min(1).max(100).optional(),
  offset: z.number().int().min(0).optional(),
  search: z.string().trim().min(1).max(200).optional()
};

export async function createAdAstroMcpServer(
  deps: AdAstroMcpToolDeps = createDefaultAdAstroMcpToolDeps(),
  options: AdAstroMcpServerOptions = {}
) {
  const server = new McpServer(
    { name: 'adastro-mcp', version: '1.0.0' },
    {
      capabilities: { tools: {}, logging: {} },
      instructions: 'Use these tools to publish and administer AdAstro content safely. Prefer list/get tools before mutating tools.'
    }
  );

  server.registerTool('adastro_status', {
    title: 'AdAstro Status',
    description: 'Get site status, setup state, and current content routing.',
    annotations: { readOnlyHint: true, openWorldHint: false, idempotentHint: true }
  }, async () => runTool(() => deps.getStatus()));

  server.registerTool('authors_list', {
    title: 'List Authors',
    description: 'List authors to choose an authorId for posts/pages.',
    inputSchema: {
      ...listSchema
    },
    annotations: { readOnlyHint: true, idempotentHint: true }
  }, async (args) => runTool(() => deps.listAuthors({
    limit: clampLimit(args.limit),
    offset: clampOffset(args.offset),
    search: args.search
  })));

  server.registerTool('categories_list', {
    title: 'List Categories',
    description: 'List categories with optional search.',
    inputSchema: {
      ...listSchema
    },
    annotations: { readOnlyHint: true, idempotentHint: true }
  }, async (args) => runTool(() => deps.listCategories({
    limit: clampLimit(args.limit),
    offset: clampOffset(args.offset),
    search: args.search
  })));

  server.registerTool('tags_list', {
    title: 'List Tags',
    description: 'List tags with optional search.',
    inputSchema: {
      ...listSchema
    },
    annotations: { readOnlyHint: true, idempotentHint: true }
  }, async (args) => runTool(() => deps.listTags({
    limit: clampLimit(args.limit),
    offset: clampOffset(args.offset),
    search: args.search
  })));

  server.registerTool('media_list', {
    title: 'List Media',
    description: 'List media assets for selecting featured images and content media.',
    inputSchema: {
      ...listSchema,
      mimeType: z.string().trim().min(1).max(100).optional()
    },
    annotations: { readOnlyHint: true, idempotentHint: true }
  }, async (args) => runTool(() => deps.listMedia({
    limit: clampLimit(args.limit),
    offset: clampOffset(args.offset),
    search: args.search,
    mimeType: args.mimeType
  })));

  server.registerTool('media_get', {
    title: 'Get Media',
    description: 'Get a media asset by id.',
    inputSchema: {
      id: z.string().uuid()
    },
    annotations: { readOnlyHint: true, idempotentHint: true }
  }, async (args) => runTool(() => deps.getMedia(args.id)));

  server.registerTool('posts_list', {
    title: 'List Posts',
    description: 'List posts (draft, published, scheduled) with search and pagination.',
    inputSchema: {
      ...listSchema,
      status: z.enum(['draft', 'published', 'scheduled']).optional()
    },
    annotations: { readOnlyHint: true, idempotentHint: true }
  }, async (args) => runTool(() => deps.listPosts({
    status: args.status,
    search: args.search,
    limit: clampLimit(args.limit),
    offset: clampOffset(args.offset)
  })));

  server.registerTool('post_get', {
    title: 'Get Post',
    description: 'Get a single post by id or slug.',
    inputSchema: {
      id: z.string().uuid().optional(),
      slug: z.string().trim().min(1).max(240).optional()
    },
    annotations: { readOnlyHint: true, idempotentHint: true }
  }, async (args) => runTool(() => deps.getPost(args)));

  server.registerTool('post_create', {
    title: 'Create Post',
    description: 'Create a blog post. Provide content HTML/text or EditorJS blocks.',
    inputSchema: {
      title: z.string().trim().min(1).max(240),
      slug: z.string().trim().min(1).max(240).optional(),
      content: z.string().optional(),
      excerpt: z.string().max(500).optional(),
      status: z.enum(['draft', 'published', 'scheduled']).optional(),
      publishedAt: z.string().optional(),
      authorId: z.string().uuid().optional(),
      categoryIds: z.array(z.string().uuid()).optional(),
      tagIds: z.array(z.string().uuid()).optional(),
      featuredImageId: z.string().uuid().optional(),
      audioAssetId: z.string().uuid().optional(),
      seoMetadata: z.record(z.string(), z.unknown()).optional(),
      blocks: z.record(z.string(), z.unknown()).optional()
    },
    annotations: { destructiveHint: false, idempotentHint: false, openWorldHint: false }
  }, async (args) => runTool(() => deps.createPost(args as JsonRecord)));

  server.registerTool('post_update', {
    title: 'Update Post',
    description: 'Update an existing post by id.',
    inputSchema: {
      id: z.string().uuid(),
      title: z.string().trim().min(1).max(240).optional(),
      slug: z.string().trim().min(1).max(240).optional(),
      content: z.string().optional(),
      excerpt: z.string().max(500).optional(),
      status: z.enum(['draft', 'published', 'scheduled']).optional(),
      publishedAt: z.string().optional(),
      authorId: z.string().uuid().optional(),
      categoryIds: z.array(z.string().uuid()).optional(),
      tagIds: z.array(z.string().uuid()).optional(),
      featuredImageId: z.string().uuid().optional(),
      audioAssetId: z.string().uuid().optional(),
      seoMetadata: z.record(z.string(), z.unknown()).optional(),
      blocks: z.record(z.string(), z.unknown()).optional()
    },
    annotations: { destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, async (args) => runTool(() => deps.updatePost(args as JsonRecord & { id: string })));

  server.registerTool('post_publish', {
    title: 'Publish Post',
    description: 'Publish a draft or scheduled post.',
    inputSchema: {
      id: z.string().uuid(),
      publishAt: z.string().optional()
    },
    annotations: { destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, async (args) => runTool(() => deps.publishPost(args)));

  server.registerTool('post_unpublish', {
    title: 'Unpublish Post',
    description: 'Move a published post back to draft.',
    inputSchema: {
      id: z.string().uuid()
    },
    annotations: { destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, async (args) => runTool(() => deps.unpublishPost(args)));

  server.registerTool('pages_list', {
    title: 'List Pages',
    description: 'List pages with search and pagination.',
    inputSchema: {
      ...listSchema,
      status: z.enum(['draft', 'published', 'archived']).optional()
    },
    annotations: { readOnlyHint: true, idempotentHint: true }
  }, async (args) => runTool(() => deps.listPages({
    status: args.status,
    search: args.search,
    limit: clampLimit(args.limit),
    offset: clampOffset(args.offset)
  })));

  server.registerTool('page_get', {
    title: 'Get Page',
    description: 'Get a page by id or slug.',
    inputSchema: {
      id: z.string().uuid().optional(),
      slug: z.string().trim().min(1).max(240).optional()
    },
    annotations: { readOnlyHint: true, idempotentHint: true }
  }, async (args) => runTool(() => deps.getPage(args)));

  server.registerTool('page_create', {
    title: 'Create Page',
    description: 'Create a page with sections and/or EditorJS blocks.',
    inputSchema: {
      title: z.string().trim().min(1).max(240),
      slug: z.string().trim().min(1).max(240).optional(),
      status: z.enum(['draft', 'published', 'archived']).optional(),
      template: z.string().trim().max(100).optional(),
      content: z.string().optional(),
      contentHtml: z.string().optional(),
      excerpt: z.string().max(500).optional(),
      authorId: z.string().uuid().optional(),
      seoMetadata: z.record(z.string(), z.unknown()).optional(),
      publishedAt: z.string().optional(),
      blocks: z.record(z.string(), z.unknown()).optional(),
      sections: z.array(z.object({
        type: z.string().trim().min(1).max(100),
        content: z.record(z.string(), z.unknown()).optional(),
        orderIndex: z.number().int().optional()
      })).optional()
    },
    annotations: { destructiveHint: false, idempotentHint: false, openWorldHint: false }
  }, async (args) => runTool(() => deps.createPage(args as JsonRecord)));

  server.registerTool('page_update', {
    title: 'Update Page',
    description: 'Update an existing page by id.',
    inputSchema: {
      id: z.string().uuid(),
      title: z.string().trim().min(1).max(240).optional(),
      slug: z.string().trim().min(1).max(240).optional(),
      status: z.enum(['draft', 'published', 'archived']).optional(),
      template: z.string().trim().max(100).optional(),
      content: z.string().optional(),
      contentHtml: z.string().optional(),
      excerpt: z.string().max(500).optional(),
      authorId: z.string().uuid().optional(),
      seoMetadata: z.record(z.string(), z.unknown()).optional(),
      publishedAt: z.string().optional(),
      blocks: z.record(z.string(), z.unknown()).optional(),
      sections: z.array(z.object({
        type: z.string().trim().min(1).max(100),
        content: z.record(z.string(), z.unknown()).optional(),
        orderIndex: z.number().int().optional()
      })).optional()
    },
    annotations: { destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, async (args) => runTool(() => deps.updatePage(args as JsonRecord & { id: string })));

  server.registerTool('settings_get', {
    title: 'Get Settings',
    description: 'Read site settings by keys, category, prefix, or all settings.',
    inputSchema: {
      keys: z.array(z.string().trim().min(1)).max(200).optional(),
      prefix: z.string().trim().min(1).max(120).optional(),
      category: z.string().trim().min(1).max(120).optional()
    },
    annotations: { readOnlyHint: true, idempotentHint: true }
  }, async (args) => runTool(() => deps.getSettings(args)));

  server.registerTool('settings_update', {
    title: 'Update Settings',
    description: 'Update one or more settings by key/value.',
    inputSchema: {
      settings: z.record(z.string(), z.unknown())
    },
    annotations: { destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, async (args) => runTool(() => deps.updateSettings({ settings: args.settings })));

  server.registerTool('analytics_summary', {
    title: 'Analytics Summary',
    description: 'Get built-in analytics summary for the last 7 or 30 days.',
    inputSchema: {
      days: z.union([z.literal(7), z.literal(30)]).optional()
    },
    annotations: { readOnlyHint: true, idempotentHint: true }
  }, async (args) => runTool(() => deps.getAnalyticsSummary({ days: args.days ?? 7 })));

  const featureToolResolver = options.resolveFeatureToolSets ?? resolveDefaultFeatureToolSets;
  try {
    const featureToolSets = await featureToolResolver();
    if (featureToolSets.length > 0) {
      registerFeatureTools(server, featureToolSets, new Set(CORE_MCP_TOOL_NAMES));
    }
  } catch (error) {
    console.warn('Feature MCP tool resolution failed. Only core MCP tools are available.', error);
  }

  return server;
}
