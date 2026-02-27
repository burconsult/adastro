import { BaseRepository } from '../base-repository.js';
import { DatabaseError } from '../connection.js';

export interface ScheduledPost {
  id: string;
  postId: string;
  scheduledFor: Date;
  status: 'pending' | 'processing' | 'published' | 'failed' | 'cancelled';
  retryCount: number;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateScheduledPost {
  postId: string;
  scheduledFor: Date;
}

export interface UpdateScheduledPost {
  scheduledFor?: Date;
  status?: 'pending' | 'processing' | 'published' | 'failed' | 'cancelled';
  retryCount?: number;
  errorMessage?: string;
}

export class ScheduledPostsRepository extends BaseRepository<ScheduledPost, CreateScheduledPost, UpdateScheduledPost> {
  constructor() {
    super('scheduled_posts', true);
  }

  mapFromDatabase(row: any): ScheduledPost {
    return {
      id: row.id,
      postId: row.post_id,
      scheduledFor: new Date(row.scheduled_for),
      status: row.status,
      retryCount: row.retry_count,
      errorMessage: row.error_message,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  mapToDatabase(data: CreateScheduledPost | UpdateScheduledPost): any {
    const mapped: any = {};
    
    if ('postId' in data) mapped.post_id = data.postId;
    if ('scheduledFor' in data) mapped.scheduled_for = data.scheduledFor?.toISOString();
    if ('status' in data) mapped.status = data.status;
    if ('retryCount' in data) mapped.retry_count = data.retryCount;
    if ('errorMessage' in data) mapped.error_message = data.errorMessage;
    
    return mapped;
  }

  async validateCreate(data: CreateScheduledPost): Promise<void> {
    if (!data.postId || data.postId.trim().length === 0) {
      throw new DatabaseError('Post ID is required');
    }
    
    if (!data.scheduledFor) {
      throw new DatabaseError('Scheduled date is required');
    }

    if (data.scheduledFor <= new Date()) {
      throw new DatabaseError('Scheduled date must be in the future');
    }

    // Check if post is already scheduled
    const existing = await this.findByPostId(data.postId);
    if (existing && existing.status === 'pending') {
      throw new DatabaseError('Post is already scheduled for publication');
    }
  }

  async validateUpdate(data: UpdateScheduledPost): Promise<void> {
    if (data.scheduledFor && data.scheduledFor <= new Date()) {
      throw new DatabaseError('Scheduled date must be in the future');
    }
  }

  async findByPostId(postId: string): Promise<ScheduledPost | null> {
    return this.db.executeOptionalQuery(
      async (client) => {
        const result = await client
          .from('scheduled_posts')
          .select('*')
          .eq('post_id', postId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        
        if (result.data) {
          result.data = this.mapFromDatabase(result.data);
        }
        
        return result;
      },
      'findByPostId scheduled_posts'
    );
  }

  async findByStatus(status: ScheduledPost['status']): Promise<ScheduledPost[]> {
    return this.db.executeArrayQuery(
      async (client) => {
        const result = await client
          .from('scheduled_posts')
          .select('*')
          .eq('status', status)
          .order('scheduled_for', { ascending: true });
        
        if (result.data) {
          result.data = result.data.map(row => this.mapFromDatabase(row));
        }
        
        return result;
      },
      'findByStatus scheduled_posts'
    );
  }

  async findDueForPublication(): Promise<ScheduledPost[]> {
    const now = new Date();
    
    return this.db.executeArrayQuery(
      async (client) => {
        const result = await client
          .from('scheduled_posts')
          .select('*')
          .eq('status', 'pending')
          .lte('scheduled_for', now.toISOString())
          .order('scheduled_for', { ascending: true });
        
        if (result.data) {
          result.data = result.data.map(row => this.mapFromDatabase(row));
        }
        
        return result;
      },
      'findDueForPublication scheduled_posts'
    );
  }

  async findUpcoming(limit = 10): Promise<ScheduledPost[]> {
    const now = new Date();
    
    return this.db.executeArrayQuery(
      async (client) => {
        const result = await client
          .from('scheduled_posts')
          .select('*')
          .eq('status', 'pending')
          .gt('scheduled_for', now.toISOString())
          .order('scheduled_for', { ascending: true })
          .limit(limit);
        
        if (result.data) {
          result.data = result.data.map(row => this.mapFromDatabase(row));
        }
        
        return result;
      },
      'findUpcoming scheduled_posts'
    );
  }

  async markAsProcessing(id: string): Promise<ScheduledPost> {
    return this.update(id, {
      status: 'processing'
    });
  }

  async markAsPublished(id: string): Promise<ScheduledPost> {
    return this.update(id, {
      status: 'published'
    });
  }

  async markAsFailed(id: string, errorMessage: string): Promise<ScheduledPost> {
    const scheduledPost = await this.findByIdOrThrow(id);
    
    return this.update(id, {
      status: 'failed',
      retryCount: scheduledPost.retryCount + 1,
      errorMessage
    });
  }

  async reschedule(id: string, newDate: Date): Promise<ScheduledPost> {
    if (newDate <= new Date()) {
      throw new DatabaseError('New scheduled date must be in the future');
    }

    return this.update(id, {
      scheduledFor: newDate,
      status: 'pending',
      errorMessage: undefined
    });
  }

  async cancel(id: string): Promise<ScheduledPost> {
    return this.update(id, {
      status: 'cancelled'
    });
  }

  async getScheduleStats(): Promise<{
    pending: number;
    processing: number;
    published: number;
    failed: number;
    cancelled: number;
  }> {
    const result = await this.db.executeQuery(
      async (client) => {
        return client
          .from('scheduled_posts')
          .select('status, count(*)', { count: 'exact' })
          .group('status');
      },
      'getScheduleStats scheduled_posts'
    );

    const stats = {
      pending: 0,
      processing: 0,
      published: 0,
      failed: 0,
      cancelled: 0
    };

    result.forEach((row: any) => {
      switch (row.status) {
        case 'pending':
          stats.pending = row.count;
          break;
        case 'processing':
          stats.processing = row.count;
          break;
        case 'published':
          stats.published = row.count;
          break;
        case 'failed':
          stats.failed = row.count;
          break;
        case 'cancelled':
          stats.cancelled = row.count;
          break;
      }
    });

    return stats;
  }

  async getUpcomingSchedule(days = 7): Promise<ScheduledPost[]> {
    const now = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + days);
    
    return this.db.executeArrayQuery(
      async (client) => {
        const result = await client
          .from('scheduled_posts')
          .select('*')
          .eq('status', 'pending')
          .gte('scheduled_for', now.toISOString())
          .lte('scheduled_for', endDate.toISOString())
          .order('scheduled_for', { ascending: true });
        
        if (result.data) {
          result.data = result.data.map(row => this.mapFromDatabase(row));
        }
        
        return result;
      },
      'getUpcomingSchedule scheduled_posts'
    );
  }

  async bulkReschedule(
    postIds: string[],
    newDate: Date
  ): Promise<ScheduledPost[]> {
    if (newDate <= new Date()) {
      throw new DatabaseError('New scheduled date must be in the future');
    }

    const results: ScheduledPost[] = [];
    
    for (const postId of postIds) {
      try {
        const scheduledPost = await this.findByPostId(postId);
        if (scheduledPost && scheduledPost.status === 'pending') {
          const updated = await this.reschedule(scheduledPost.id, newDate);
          results.push(updated);
        }
      } catch (error) {
        console.error(`Failed to reschedule post ${postId}:`, error);
      }
    }
    
    return results;
  }

  async cleanupOldSchedules(retentionDays = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await this.db.executeQuery(
      async (client) => {
        return client
          .from('scheduled_posts')
          .delete()
          .in('status', ['published', 'failed', 'cancelled'])
          .lt('created_at', cutoffDate.toISOString());
      },
      'cleanupOldSchedules scheduled_posts'
    );

    return result.count || 0;
  }
}