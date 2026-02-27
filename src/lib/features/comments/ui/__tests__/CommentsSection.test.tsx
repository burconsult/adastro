import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CommentsSection } from '../CommentsSection.js';

type FetchMock = ReturnType<typeof vi.fn>;

const jsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });

describe('CommentsSection', () => {
  let fetchMock: FetchMock;

  beforeEach(() => {
    fetchMock = vi.fn();
    global.fetch = fetchMock as any;
  });

  it('renders approved comments above the comment form', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes('/api/features/comments/list')) {
        return Promise.resolve(
          jsonResponse({
            enabled: true,
            comments: [
              {
                id: 'comment-1',
                authorName: 'Alice',
                content: 'Great write-up',
                createdAt: '2026-02-09T12:00:00.000Z'
              }
            ]
          })
        );
      }

      if (url === '/api/profile') {
        return Promise.resolve(jsonResponse({ error: 'Authentication required' }, 401));
      }

      return Promise.reject(new Error(`Unhandled request: ${url}`));
    });

    render(<CommentsSection slug="hello-world" />);

    const commentBody = await screen.findByText('Great write-up');
    const submitButton = await screen.findByRole('button', { name: 'Post comment' });
    const commentItem = commentBody.closest('li');
    const form = submitButton.closest('form');

    expect(commentItem).not.toBeNull();
    expect(form).not.toBeNull();
    expect((commentItem!.compareDocumentPosition(form!) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0).toBe(true);
  });

  it('detects authenticated user and submits with profile identity', async () => {
    fetchMock.mockImplementation((url: string, options?: RequestInit) => {
      if (url.includes('/api/features/comments/list')) {
        return Promise.resolve(jsonResponse({ enabled: true, comments: [] }));
      }

      if (url === '/api/profile') {
        return Promise.resolve(
          jsonResponse({
            user: {
              id: 'user-1',
              email: 'jane@example.com'
            },
            profile: {
              fullName: 'Jane Writer'
            }
          })
        );
      }

      if (url === '/api/features/comments/submit') {
        return Promise.resolve(jsonResponse({ success: true, id: 'comment-1', status: 'approved' }));
      }

      return Promise.reject(new Error(`Unhandled request: ${url} ${JSON.stringify(options || {})}`));
    });

    render(<CommentsSection slug="hello-world" />);

    await screen.findByText((_, node) => node?.textContent === 'Commenting as Jane Writer (jane@example.com)');
    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Email')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Comment'), {
      target: { value: 'Signed-in user comment' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Post comment' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/features/comments/submit',
        expect.objectContaining({
          method: 'POST'
        })
      );
    });

    const submitCall = fetchMock.mock.calls.find(([url]: [string]) => url === '/api/features/comments/submit');
    expect(submitCall).toBeDefined();
    const options = submitCall?.[1] as RequestInit;
    const payload = JSON.parse(options.body as string);

    expect(payload.authorName).toBe('Jane Writer');
    expect(payload.authorEmail).toBe('jane@example.com');
    expect(payload.content).toBe('Signed-in user comment');
  });
});
