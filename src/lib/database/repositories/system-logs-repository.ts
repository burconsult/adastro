import { BaseRepository } from '../base-repository.js';
import { DatabaseError } from '../connection.js';

export interface SystemLog {
  id: string;
  level: 'debug' | 'info' | 'warn' | 'error' | 'critical';
  category: string;
  message: string;
  data?: Record<string, any>;
  source?: string;
  createdAt: Date;
}

export interface CreateSystemLog {
  level: 'debug' | 'info' | 'warn' | 'error' | 'critical';
  category: string;
  message: string;
  data?: Record<string, any>;
  source?: string;
}

export interface UpdateSystemLog {
  data?: Record<string, any>;
}

export interface LogFilter {
  level?: SystemLog['level'];
  category?: string;
  source?: string;
  startDate?: Date;
  endDate?: Date;
  search?: string;
  limit?: number;
  offset?: number;
}

export class SystemLogsRepository extends BaseRepository<SystemLog, CreateSystemLog, UpdateSystemLog> {
  constructor() {
    super('system_logs', true);
  }

  mapFromDatabase(row: any): SystemLog {
    return {
      id: row.id,
      level: row.level,
      category: row.category,
      message: row.message,
      data: row.data,
      source: row.source,
      createdAt: new Date(row.created_at)
    };
  }

  mapToDatabase(data: CreateSystemLog | UpdateSystemLog): any {
    const mapped: any = {};
    
    if ('level' in data) mapped.level = data.level;
    if ('category' in data) mapped.category = data.category;
    if ('message' in data) mapped.message = data.message;
    if ('data' in data) mapped.data = data.data;
    if ('source' in data) mapped.source = data.source;
    
    return mapped;
  }

  async validateCreate(data: CreateSystemLog): Promise<void> {
    if (!data.level) {
      throw new DatabaseError('Log level is required');
    }
    
    if (!data.category || data.category.trim().length === 0) {
      throw new DatabaseError('Log category is required');
    }

    if (!data.message || data.message.trim().length === 0) {
      throw new DatabaseError('Log message is required');
    }

    const validLevels = ['debug', 'info', 'warn', 'error', 'critical'];
    if (!validLevels.includes(data.level)) {
      throw new DatabaseError(`Invalid log level. Must be one of: ${validLevels.join(', ')}`);
    }
  }

  async validateUpdate(data: UpdateSystemLog): Promise<void> {
    // No specific validation needed for updates
  }

  // Convenience methods for different log levels
  async debug(category: string, message: string, data?: Record<string, any>, source?: string): Promise<SystemLog> {
    return this.create({ level: 'debug', category, message, data, source });
  }

  async info(category: string, message: string, data?: Record<string, any>, source?: string): Promise<SystemLog> {
    return this.create({ level: 'info', category, message, data, source });
  }

  async warn(category: string, message: string, data?: Record<string, any>, source?: string): Promise<SystemLog> {
    return this.create({ level: 'warn', category, message, data, source });
  }

  async error(category: string, message: string, data?: Record<string, any>, source?: string): Promise<SystemLog> {
    return this.create({ level: 'error', category, message, data, source });
  }

  async critical(category: string, message: string, data?: Record<string, any>, source?: string): Promise<SystemLog> {
    return this.create({ level: 'critical', category, message, data, source });
  }

  async findByFilter(filter: LogFilter): Promise<SystemLog[]> {
    return this.db.executeArrayQuery(
      async (client) => {
        let query = client
          .from('system_logs')
          .select('*');

        if (filter.level) {
          query = query.eq('level', filter.level);
        }
        
        if (filter.category) {
          query = query.eq('category', filter.category);
        }
        
        if (filter.source) {
          query = query.eq('source', filter.source);
        }
        
        if (filter.startDate) {
          query = query.gte('created_at', filter.startDate.toISOString());
        }
        
        if (filter.endDate) {
          query = query.lte('created_at', filter.endDate.toISOString());
        }

        if (filter.search) {
          query = query.or(`message.ilike.%${filter.search}%,category.ilike.%${filter.search}%`);
        }

        query = query.order('created_at', { ascending: false });

        if (filter.limit) {
          const offset = filter.offset || 0;
          query = query.range(offset, offset + filter.limit - 1);
        }

        const result = await query;
        
        if (result.data) {
          result.data = result.data.map(row => this.mapFromDatabase(row));
        }
        
        return result;
      },
      'findByFilter system_logs'
    );
  }

  async findByLevel(level: SystemLog['level'], limit = 50): Promise<SystemLog[]> {
    return this.findByFilter({ level, limit });
  }

  async findByCategory(category: string, limit = 50): Promise<SystemLog[]> {
    return this.findByFilter({ category, limit });
  }

  async findRecent(hours = 24, limit = 100): Promise<SystemLog[]> {
    const startDate = new Date();
    startDate.setHours(startDate.getHours() - hours);

    return this.findByFilter({ startDate, limit });
  }

  async findErrors(limit = 50): Promise<SystemLog[]> {
    return this.db.executeArrayQuery(
      async (client) => {
        const result = await client
          .from('system_logs')
          .select('*')
          .in('level', ['error', 'critical'])
          .order('created_at', { ascending: false })
          .limit(limit);
        
        if (result.data) {
          result.data = result.data.map(row => this.mapFromDatabase(row));
        }
        
        return result;
      },
      'findErrors system_logs'
    );
  }

  async getLogStats(hours = 24): Promise<{
    debug: number;
    info: number;
    warn: number;
    error: number;
    critical: number;
    total: number;
  }> {
    const startDate = new Date();
    startDate.setHours(startDate.getHours() - hours);

    const result = await this.db.executeQuery(
      async (client) => {
        return client
          .from('system_logs')
          .select('level, count(*)', { count: 'exact' })
          .gte('created_at', startDate.toISOString())
          .group('level');
      },
      'getLogStats system_logs'
    );

    const stats = {
      debug: 0,
      info: 0,
      warn: 0,
      error: 0,
      critical: 0,
      total: 0
    };

    result.forEach((row: any) => {
      stats.total += row.count;
      switch (row.level) {
        case 'debug':
          stats.debug = row.count;
          break;
        case 'info':
          stats.info = row.count;
          break;
        case 'warn':
          stats.warn = row.count;
          break;
        case 'error':
          stats.error = row.count;
          break;
        case 'critical':
          stats.critical = row.count;
          break;
      }
    });

    return stats;
  }

  async getCategoryStats(hours = 24): Promise<{ category: string; count: number }[]> {
    const startDate = new Date();
    startDate.setHours(startDate.getHours() - hours);

    const result = await this.db.executeQuery(
      async (client) => {
        return client
          .from('system_logs')
          .select('category, count(*)', { count: 'exact' })
          .gte('created_at', startDate.toISOString())
          .group('category')
          .order('count', { ascending: false });
      },
      'getCategoryStats system_logs'
    );

    return result.map((row: any) => ({
      category: row.category,
      count: row.count
    }));
  }

  async getHourlyStats(hours = 24): Promise<{ hour: string; count: number }[]> {
    const startDate = new Date();
    startDate.setHours(startDate.getHours() - hours);

    const result = await this.db.executeQuery(
      async (client) => {
        return client
          .from('system_logs')
          .select('date_trunc(\'hour\', created_at) as hour, count(*)', { count: 'exact' })
          .gte('created_at', startDate.toISOString())
          .group('date_trunc(\'hour\', created_at)')
          .order('hour', { ascending: true });
      },
      'getHourlyStats system_logs'
    );

    return result.map((row: any) => ({
      hour: row.hour,
      count: row.count
    }));
  }

  async cleanupOldLogs(retentionDays = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await this.db.executeQuery(
      async (client) => {
        return client
          .from('system_logs')
          .delete()
          .lt('created_at', cutoffDate.toISOString());
      },
      'cleanupOldLogs system_logs'
    );

    return result.count || 0;
  }

  async cleanupByLevel(level: SystemLog['level'], retentionDays = 7): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await this.db.executeQuery(
      async (client) => {
        return client
          .from('system_logs')
          .delete()
          .eq('level', level)
          .lt('created_at', cutoffDate.toISOString());
      },
      'cleanupByLevel system_logs'
    );

    return result.count || 0;
  }

  async exportLogs(filter: LogFilter): Promise<SystemLog[]> {
    // Remove limit for export
    const exportFilter = { ...filter };
    delete exportFilter.limit;
    delete exportFilter.offset;

    return this.findByFilter(exportFilter);
  }
}