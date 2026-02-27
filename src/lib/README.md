# Data Models and Validation

This directory contains the core data models, validation schemas, and utility functions for the Adastro platform.

## Structure

```
src/lib/
├── types/
│   └── index.ts          # TypeScript interfaces for all data models
├── validation/
│   ├── schemas.ts        # Zod validation schemas
│   └── __tests__/        # Validation tests
├── utils/
│   ├── data-transform.ts # Data transformation utilities
│   └── __tests__/        # Utility tests
└── index.ts              # Main exports
```

## Core Data Models

### BlogPost
The main content entity representing a blog post with full metadata, categories, tags, and SEO information.

### Author
Represents content authors with profile information and social links.

### Category
Hierarchical content categorization with support for parent-child relationships.

### Tag
Simple content tagging system for flexible content organization.

### MediaAsset
File management with automatic optimization metadata and CDN integration.

### SEOMetadata
Complete SEO metadata including Open Graph and Twitter Card data.

## Validation

All data models include comprehensive Zod validation schemas with:

- Input validation for create/update operations
- Type-safe data transformation
- Automatic sanitization of user content
- SEO metadata normalization

## Usage Examples

### Creating a Blog Post

```typescript
import { createBlogPostSchema, prepareBlogPostForDb } from '@/lib';

// Validate input data
const postData = createBlogPostSchema.parse({
  title: 'My New Post',
  content: 'Post content here...',
  author: authorObject,
  categories: [categoryObject],
  tags: [tagObject],
});

// Prepare for database insertion
const dbData = prepareBlogPostForDb(postData);
```

### Validating Author Data

```typescript
import { authorSchema, createAuthorSchema } from '@/lib';

// Validate complete author object
const author = authorSchema.parse(authorData);

// Validate author creation data (without generated fields)
const newAuthor = createAuthorSchema.parse({
  name: 'John Doe',
  email: 'john@example.com',
  bio: 'Author bio',
});
```

### Data Transformation

```typescript
import { 
  generateSlug, 
  sanitizeHtml, 
  generateExcerpt,
  transformDbAuthor 
} from '@/lib';

// Generate URL-friendly slug
const slug = generateSlug('My Blog Post Title'); // 'my-blog-post-title'

// Sanitize HTML content
const clean = sanitizeHtml('<p>Safe content</p><script>alert("xss")</script>');

// Generate excerpt from content
const excerpt = generateExcerpt(longContent, 160);

// Transform database row to typed object
const author = transformDbAuthor(dbRow);
```

## Testing

All data models and utilities include comprehensive unit tests:

```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with UI
npm run test:ui
```

## Security Features

- HTML sanitization to prevent XSS attacks
- Input validation with strict schemas
- SQL injection prevention through parameterized queries
- Content Security Policy compliance
- Automatic data transformation and normalization