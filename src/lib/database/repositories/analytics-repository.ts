import { BaseRepository } from '../base-repository.js';
import { DatabaseError } from '../connection.js';

export interface AnalyticsEvent {
  id: string;
  eventType: string;
  entityType: string;
  entityId?: string;
  data: Record<string, any>;
  userAgent?: string;
  ipAddress?: string;
  createdAt: Date;
}

export interface CreateAnalyticsEvent {
  eventType: string;
  entityType: string;
  entityId?: string;
  data: Record<string, any>;
  userAgent?: string;
  ipAddress?: string;
}

export interface UpdateAnalyticsEvent {
  data?: Record<string, any>;
}

export interface AnalyticsMetric {
  name: string;
  value: number;
  change?: number;
  period: string;
}

export interface AnalyticsFilter {
  eventType?: string;
  entityType?: string;
  entityId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export class AnalyticsRepository extends BaseRepository<AnalyticsEvent, CreateAnalyticsEvent, UpdateAnalyticsEvent> {
  constructor() {
    super('analytics_events', true);
  }

  mapFromDatabase(row: any): AnalyticsEvent {
    return {
      id: row.id,
      eventType: row.event_type,
      entityType: row.entity_type,
      entityId: row.entity_id,
      data: row.data,
      userAgent: row.user_agent,
      ipAddress: row.ip_address,
      createdAt: new Date(row.created_at)
    };
  }

  mapToDatabase(data: CreateAnalyticsEvent | UpdateAnalyticsEvent): any {
    const mapped: any = {};
    
    if ('eventType' in data) mapped.event_type = data.eventType;
    if ('entityType' in data) mapped.entity_type = data.entityType;
    if ('entityId' in data) mapped.entity_id = data.entityId;
    if ('data' in data) mapped.data = data.data;
    if ('userAgent' in data) mapped.user_agent = data.userAgent;
    if ('ipAddress' in data) mapped.ip_address = data.ipAddress;
    
    return mapped;
  }

  async validateCreate(data: CreateAnalyticsEvent): Promise<void> {
    if (!data.eventType || data.eventType.trim().length === 0) {
      throw new DatabaseError('Event type is required');
    }
    
    if (!data.entityType || data.entityType.trim().length === 0) {
      throw new DatabaseError('Entity type is required');
    }

    if (!data.data || typeof data.data !== 'object') {
      throw new DatabaseError('Event data must be a valid object');
    }
  }

  async validateUpdate(data: UpdateAnalyticsEvent): Promise<void> {
    if (data.data && typeof data.data !== 'object') {
      throw new DatabaseError('Event data must be a valid object');
    }
  }

  async findByFilter(filter: AnalyticsFilter): Promise<AnalyticsEvent[]> {
    return this.db.executeArrayQuery(
      async (client) => {
        let query = client
          .from('analytics_events')
          .select('*');

        if (filter.eventType) {
          query = query.eq('event_type', filter.eventType);
        }
        
        if (filter.entityType) {
          query = query.eq('entity_type', filter.entityType);
        }
        
        if (filter.entityId) {
          query = query.eq('entity_id', filter.entityId);
        }
        
        if (filter.startDate) {
          query = query.gte('created_at', filter.startDate.toISOString());
        }
        
        if (filter.endDate) {
          query = query.lte('created_at', filter.endDate.toISOString());
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
      'findByFilter analytics_events'
    );
  }

  async getEventCounts(
    eventType?: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<{ eventType: string; count: number }[]> {
    const result = await this.db.executeQuery(
      async (client) => {
        let query = client
          .from('analytics_events')
          .select('event_type, count(*)', { count: 'exact' });

        if (eventType) {
          query = query.eq('event_type', eventType);
        }
        
        if (startDate) {
          query = query.gte('created_at', startDate.toISOString());
        }
        
        if (endDate) {
          query = query.lte('created_at', endDate.toISOString());
        }

        return query.group('event_type');
      },
      'getEventCounts analytics_events'
    );

    return result.map((row: any) => ({
      eventType: row.event_type,
      count: row.count
    }));
  }

  async getTopEntities(
    entityType: string,
    limit = 10,
    startDate?: Date,
    endDate?: Date
  ): Promise<{ entityId: string; count: number }[]> {
    const result = await this.db.executeQuery(
      async (client) => {
        let query = client
          .from('analytics_events')
          .select('entity_id, count(*)', { count: 'exact' })
          .eq('entity_type', entityType)
          .not('entity_id', 'is', null);

        if (startDate) {
          query = query.gte('created_at', startDate.toISOString());
        }
        
        if (endDate) {
          query = query.lte('created_at', endDate.toISOString());
        }

        return query
          .group('entity_id')
          .order('count', { ascending: false })
          .limit(limit);
      },
      'getTopEntities analytics_events'
    );

    return result.map((row: any) => ({
      entityId: row.entity_id,
      count: row.count
    }));
  }

  async getDailyStats(
    eventType?: string,
    days = 30
  ): Promise<{ date: string; count: number }[]> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const result = await this.db.executeQuery(
      async (client) => {
        let query = client
          .from('analytics_events')
          .select('created_at::date as date, count(*)', { count: 'exact' })
          .gte('created_at', startDate.toISOString())
          .lte('created_at', endDate.toISOString());

        if (eventType) {
          query = query.eq('event_type', eventType);
        }

        return query
          .group('created_at::date')
          .order('date', { ascending: true });
      },
      'getDailyStats analytics_events'
    );

    return result.map((row: any) => ({
      date: row.date,
      count: row.count
    }));
  }

  async cleanupOldEvents(retentionDays = 365): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await this.db.executeQuery(
      async (client) => {
        return client
          .from('analytics_events')
          .delete()
          .lt('created_at', cutoffDate.toISOString());
      },
      'cleanupOldEvents analytics_events'
    );

    return result.count || 0;
  }
}