// Database connection and error handling
export {
  DatabaseConnection,
  DatabaseError,
  ValidationError,
  NotFoundError,
  ConflictError,
  dbConnection,
  adminDbConnection,
} from './connection.js';

// Base repository
export { BaseRepository } from './base-repository.js';

// Repositories
export { 
  AuthorRepository,
  type CreateAuthor,
  type UpdateAuthor,
} from './repositories/author-repository.js';

export { 
  CategoryRepository,
  type CreateCategory,
  type UpdateCategory,
} from './repositories/category-repository.js';

export { 
  TagRepository,
  type CreateTag,
  type UpdateTag,
} from './repositories/tag-repository.js';

export { 
  PostRepository,
  type CreatePost,
  type UpdatePost,
} from './repositories/post-repository.js';

export {
  PageRepository,
  type CreatePage,
  type UpdatePage,
} from './repositories/page-repository.js';

export {
  PageSectionRepository,
  type CreatePageSection,
  type PageSectionInput,
  type UpdatePageSection,
} from './repositories/page-section-repository.js';

export { 
  MediaRepository,
  mediaRepository,
  type MediaAssetFilters,
} from './repositories/media-repository.js';

export {
  UserProfileRepository,
  type CreateUserProfile,
  type UpdateUserProfile,
} from './repositories/user-profile-repository.js';

// Admin feature repositories
export {
  SettingsRepository,
  type SiteSetting,
  type CreateSiteSetting,
  type UpdateSiteSetting,
} from './repositories/settings-repository.js';

export {
  AnalyticsRepository,
  type AnalyticsEvent,
  type CreateAnalyticsEvent,
  type UpdateAnalyticsEvent,
  type AnalyticsMetric,
  type AnalyticsFilter,
} from './repositories/analytics-repository.js';

export {
  MigrationRepository,
  type MigrationJob,
  type MigrationResults,
  type CreateMigrationJob,
  type UpdateMigrationJob,
} from './repositories/migration-repository.js';

export {
  ScheduledPostsRepository,
  type ScheduledPost,
  type CreateScheduledPost,
  type UpdateScheduledPost,
} from './repositories/scheduled-posts-repository.js';

export {
  SystemLogsRepository,
  type SystemLog,
  type CreateSystemLog,
  type UpdateSystemLog,
  type LogFilter,
} from './repositories/system-logs-repository.js';

// Auth services
export {
  AuthService,
  authService,
  requireAuth,
  requireAdmin,
  getAuthenticatedUser,
  type AuthUser,
  type SignInCredentials,
  type SignUpCredentials,
  type ResetPasswordCredentials,
  type UpdatePasswordCredentials,
} from '../auth/auth-helpers.js';

// Astro helpers
export {
  getPublishedPosts,
  getPublishedPostBySlug,
  getPublishedPages,
  getPublishedPageBySlug,
  getPostsByTag,
  getPostsByCategory,
  getTagsWithPosts,
  getCategoriesWithPosts,
  getLocalizedTagBySlug,
  getLocalizedCategoryBySlug,
  getPostStaticPaths,
  getPageStaticPaths,
  getTagStaticPaths,
  getCategoryStaticPaths,
  calculatePagination,
  type PaginationInfo,
} from '../astro-helpers.js';
