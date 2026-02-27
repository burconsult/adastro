import React from 'react';
import { getBlogPostCommentsComponent } from '@/lib/features/ui';
import type { BlogCommentsProps } from '@/lib/features/types';

export default function BlogCommentsSlot(props: BlogCommentsProps) {
  const CommentsComponent = getBlogPostCommentsComponent();
  if (!CommentsComponent) return null;
  return <CommentsComponent {...props} />;
}
