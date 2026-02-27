# Database Integration Layer

This directory contains the Supabase integration layer for the Adastro platform. It provides a clean abstraction over Supabase operations with proper error handling, validation, and type safety.

## Architecture

The integration layer follows the Repository pattern and includes:

- **Connection utilities** - Database connection management and error handling
- **Base repository** - Common CRUD operations and utilities
- **Specific repositories** - Domain-specific operations for each entity
- **Authentication helpers** - Supabase Auth integration
- **Type-safe interfaces** - Full TypeScript support

## Components

### Database Connection (`connection.ts`)

Provides centralized database connection management and error handling:

```typescript
import { dbConnection, adminDbConnection } from './connection.js';

// Use regular connection (with RLS)
const result = await dbConnection.executeQuery(
  (client) => client.from('posts').select('*'),
  'fetch posts'
);

// Use admin connection (bypasses RLS)
const adminResult = await adminDbConnection.executeQuery(
  (client) => client.from('posts').select('*'),
  'admin fetch posts'
);
```

### Error Types

The layer provides specific error types for different scenarios:

- `DatabaseError` - General database errors
- `ValidationError` - Data validation failures
- `NotFoundError` - Resource not found
- `ConflictError` - Unique constraint violations

### Repositories

Each entity has its own repository with CRUD operations:

#### AuthorRepository

```typescript
import { AuthorRepository } from './repositories/author-repository.js';

const authorRepo = new AuthorRepository();

// Create author
const author = await authorRepo.create({
  name: 'John Doe',
  email: 'john@example.com',
  bio: 'Software developer'
});

// Find by email
const author = await authorRepo.findByEmail('john@example.com');

// Search authors
const authors = await authorRepo.search('john');
```

#### CategoryRepository

```typescript
import { CategoryRepository } from './repositories/category-repository.js';

const categoryRepo = new CategoryRepository();

// Create category
const category = await categoryRepo.create({
  name: 'Technology',
  slug: 'technology',
  description: 'Tech-related posts'
});

// Find by slug
const category = await categoryRepo.findBySlug('technology');

// Get category hierarchy
const hierarchy = await categoryRepo.getCategoryHierarchy(categoryId);
```

#### TagRepository

```typescript
import { TagRepository } from './repositories/tag-repository.js';

const tagRepo = new TagRepository();

// Create tag from name (auto-generates slug)
const tag = await tagRepo.createFromName('JavaScript');

// Find or create multiple tags
const tags = await tagRepo.findOrCreateByNames(['React', 'Vue', 'Angular']);

// Find most used tags
const popularTags = await tagRepo.findMostUsed(10);
```

#### PostRepository

```typescript
import { PostRepository } from './repositories/post-repository.js';

const postRepo = new PostRepository();

// Create post with relationships
const post = await postRepo.create({
  title: 'My Blog Post',
  slug: 'my-blog-post',
  content: 'Post content...',
  authorId: authorId,
  categoryIds: [categoryId1, categoryId2],
  tagIds: [tagId1, tagId2],
  status: 'published'
});

// Find with filters
const posts = await postRepo.findWithFilters({
  status: 'published',
  authorId: authorId,
  search: 'javascript',
  limit: 10,
  offset: 0
});
```

### Authentication

The auth helpers provide Supabase Auth integration:

```typescript
import { authService, requireAuth, requireAdmin } from './auth/auth-helpers.js';

// Sign up user
const { user, needsConfirmation } = await authService.signUp({
  email: 'user@example.com',
  password: 'password123',
  name: 'User Name'
});

// Sign in user
const { user, session } = await authService.signIn({
  email: 'user@example.com',
  password: 'password123'
});

// Require authentication in routes
const user = await requireAuth(); // Throws if not authenticated
const adminUser = await requireAdmin(); // Throws if not admin
```

## Usage Examples

### Creating a Blog Post Workflow

```typescript
import { 
  AuthorRepository, 
  CategoryRepository, 
  TagRepository, 
  PostRepository 
} from './index.js';

async function createBlogPost(postData: {
  title: string;
  content: string;
  authorEmail: string;
  categoryNames: string[];
  tagNames: string[];
}) {
  const authorRepo = new AuthorRepository(true);
  const categoryRepo = new CategoryRepository(true);
  const tagRepo = new TagRepository(true);
  const postRepo = new PostRepository(true);

  // Find or create author
  let author = await authorRepo.findByEmail(postData.authorEmail);
  if (!author) {
    throw new Error('Author not found');
  }

  // Find or create categories
  const categories = await Promise.all(
    postData.categoryNames.map(name => 
      categoryRepo.findBySlug(slugify(name))
    )
  );

  // Find or create tags
  const tags = await tagRepo.findOrCreateByNames(postData.tagNames);

  // Create post
  const post = await postRepo.create({
    title: postData.title,
    slug: slugify(postData.title),
    content: postData.content,
    authorId: author.id,
    categoryIds: categories.filter(Boolean).map(c => c!.id),
    tagIds: tags.map(t => t.id),
    status: 'draft'
  });

  return post;
}
```

### Error Handling

```typescript
import { 
  DatabaseError, 
  ValidationError, 
  NotFoundError, 
  ConflictError 
} from './connection.js';

try {
  const post = await postRepo.create(postData);
} catch (error) {
  if (error instanceof ValidationError) {
    console.error('Validation failed:', error.message, error.field);
  } else if (error instanceof ConflictError) {
    console.error('Conflict:', error.message);
  } else if (error instanceof NotFoundError) {
    console.error('Not found:', error.message);
  } else if (error instanceof DatabaseError) {
    console.error('Database error:', error.message, error.code);
  }
}
```

## Testing

The integration layer includes comprehensive tests:

- **Unit tests** - Test individual functions and validation logic
- **Integration examples** - Demonstrate usage patterns
- **Error handling tests** - Verify error scenarios

Run tests with:

```bash
npm run test:run
```

## Configuration

The layer uses environment variables for Supabase configuration:

```env
SUPABASE_URL=your-supabase-url
SUPABASE_PUBLISHABLE_KEY=your-publishable-key
SUPABASE_SECRET_KEY=your-secret-key
```

## Best Practices

1. **Use admin repositories for server-side operations** that need to bypass RLS
2. **Handle errors appropriately** using the specific error types
3. **Validate data** before database operations
4. **Use transactions** for operations that modify multiple tables
5. **Implement proper pagination** for list operations
6. **Cache frequently accessed data** when appropriate

## Requirements Fulfilled

This implementation fulfills the following requirements from the spec:

- **6.1** - Supabase PostgreSQL integration for dynamic data storage
- **6.2** - Supabase Auth integration for secure access
- **6.4** - Efficient database queries with proper indexing and error handling

The integration layer provides a solid foundation for the content management system with proper error handling, validation, and type safety.
