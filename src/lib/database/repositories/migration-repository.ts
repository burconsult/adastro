import { BaseRepository } from '../base-repository.js';
import { DatabaseError } from '../connection.js';

export interface MigrationJob {
  id: string;
  filename: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'rolled_back';
  progress: number;
  totalItems: number;
  processedItems: number;
  options?: Record<string, any>;
  rollbackSafe?: boolean;
  results?: MigrationResults;
  errorLog?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

export interface MigrationResults {
  posts: { imported: number; skipped: number; errors: number };
  media: { imported: number; skipped: number; errors: number };
  categories: { imported: number; skipped: number; errors: number };
  tags: { imported: number; skipped: number; errors: number };
  authors: { imported: number; skipped: number; errors: number };
}

export interface CreateMigrationJob {
  filename: string;
  totalItems?: number;
}

export interface UpdateMigrationJob {
  status?: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'rolled_back';
  progress?: number;
  totalItems?: number;
  processedItems?: number;
  options?: Record<string, any>;
  rollbackSafe?: boolean;
  results?: MigrationResults;
  errorLog?: string;
  startedAt?: Date;
  completedAt?: Date;
}

export class MigrationRepository extends BaseRepository<MigrationJob, CreateMigrationJob, UpdateMigrationJob> {
  constructor() {
    super('migration_jobs', true);
  }

  mapFromDatabase(row: any): MigrationJob {
    return {
      id: row.id,
      filename: row.filename,
      status: row.status,
      progress: row.progress,
      totalItems: row.total_items,
      processedItems: row.processed_items,
      options: row.options ?? undefined,
      rollbackSafe: row.rollback_safe ?? undefined,
      results: row.results,
      errorLog: row.error_log,
      createdAt: new Date(row.created_at),
      startedAt: row.started_at ? new Date(row.started_at) : undefined,
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined
    };
  }

  mapToDatabase(data: CreateMigrationJob | UpdateMigrationJob): any {
    const mapped: any = {};
    
    if ('filename' in data) mapped.filename = data.filename;
    if ('status' in data) mapped.status = data.status;
    if ('progress' in data) mapped.progress = data.progress;
    if ('totalItems' in data) mapped.total_items = data.totalItems;
    if ('processedItems' in data) mapped.processed_items = data.processedItems;
    if ('options' in data) mapped.options = data.options;
    if ('rollbackSafe' in data) mapped.rollback_safe = data.rollbackSafe;
    if ('results' in data) mapped.results = data.results;
    if ('errorLog' in data) mapped.error_log = data.errorLog;
    if ('startedAt' in data) mapped.started_at = data.startedAt?.toISOString();
    if ('completedAt' in data) mapped.completed_at = data.completedAt?.toISOString();
    
    return mapped;
  }

  async validateCreate(data: CreateMigrationJob): Promise<void> {
    if (!data.filename || data.filename.trim().length === 0) {
      throw new DatabaseError('Filename is required');
    }
  }

  async validateUpdate(data: UpdateMigrationJob): Promise<void> {
    if (data.progress !== undefined && (data.progress < 0 || data.progress > 100)) {
      throw new DatabaseError('Progress must be between 0 and 100');
    }
  }

  async createJob(filename: string, totalItems = 0): Promise<MigrationJob> {
    return this.create({
      filename,
      totalItems
    });
  }

  async startJob(id: string): Promise<MigrationJob> {
    return this.update(id, {
      status: 'processing',
      startedAt: new Date()
    });
  }

  async updateProgress(
    id: string,
    progress: number,
    processedItems?: number
  ): Promise<MigrationJob> {
    const updateData: UpdateMigrationJob = { progress };
    if (processedItems !== undefined) {
      updateData.processedItems = processedItems;
    }
    
    return this.update(id, updateData);
  }

  async completeJob(
    id: string,
    results: MigrationResults
  ): Promise<MigrationJob> {
    return this.update(id, {
      status: 'completed',
      progress: 100,
      results,
      completedAt: new Date()
    });
  }

  async failJob(
    id: string,
    errorLog: string,
    results?: Partial<MigrationResults>
  ): Promise<MigrationJob> {
    return this.update(id, {
      status: 'failed',
      errorLog,
      results: results as MigrationResults,
      completedAt: new Date()
    });
  }

  async cancelJob(id: string): Promise<MigrationJob> {
    return this.update(id, {
      status: 'cancelled',
      completedAt: new Date()
    });
  }

  async findByStatus(status: MigrationJob['status']): Promise<MigrationJob[]> {
    return this.db.executeArrayQuery(
      async (client) => {
        const result = await client
          .from('migration_jobs')
          .select('*')
          .eq('status', status)
          .order('created_at', { ascending: false });
        
        if (result.data) {
          result.data = result.data.map(row => this.mapFromDatabase(row));
        }
        
        return result;
      },
      'findByStatus migration_jobs'
    );
  }

  async findActiveJobs(): Promise<MigrationJob[]> {
    return this.db.executeArrayQuery(
      async (client) => {
        const result = await client
          .from('migration_jobs')
          .select('*')
          .in('status', ['pending', 'processing'])
          .order('created_at', { ascending: false });
        
        if (result.data) {
          result.data = result.data.map(row => this.mapFromDatabase(row));
        }
        
        return result;
      },
      'findActiveJobs migration_jobs'
    );
  }

  async getJobHistory(limit = 50, offset = 0): Promise<MigrationJob[]> {
    return this.db.executeArrayQuery(
      async (client) => {
        const result = await client
          .from('migration_jobs')
          .select('*')
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);
        
        if (result.data) {
          result.data = result.data.map(row => this.mapFromDatabase(row));
        }
        
        return result;
      },
      'getJobHistory migration_jobs'
    );
  }

  async getJobStats(): Promise<{
    total: number;
    completed: number;
    failed: number;
    pending: number;
    processing: number;
  }> {
    const result = await this.db.executeQuery(
      async (client) => {
        return client
          .from('migration_jobs')
          .select('status, count(*)', { count: 'exact' })
          .group('status');
      },
      'getJobStats migration_jobs'
    );

    const stats = {
      total: 0,
      completed: 0,
      failed: 0,
      pending: 0,
      processing: 0
    };

    result.forEach((row: any) => {
      stats.total += row.count;
      switch (row.status) {
        case 'completed':
          stats.completed = row.count;
          break;
        case 'failed':
          stats.failed = row.count;
          break;
        case 'pending':
          stats.pending = row.count;
          break;
        case 'processing':
          stats.processing = row.count;
          break;
      }
    });

    return stats;
  }

  async cleanupOldJobs(retentionDays = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await this.db.executeQuery(
      async (client) => {
        return client
          .from('migration_jobs')
          .delete()
          .in('status', ['completed', 'failed', 'cancelled'])
          .lt('created_at', cutoffDate.toISOString());
      },
      'cleanupOldJobs migration_jobs'
    );

    return result.count || 0;
  }
}
