import { DatabaseConnection, DatabaseError, NotFoundError } from './connection.js';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../supabase.js';

export abstract class BaseRepository<T, CreateT, UpdateT> {
  protected db: DatabaseConnection;
  protected tableName: string;

  constructor(tableName: string, useAdmin = false) {
    this.db = new DatabaseConnection(useAdmin);
    this.tableName = tableName;
  }

  protected get client(): SupabaseClient<Database> {
    return this.db.getClient();
  }

  // Abstract methods that must be implemented by subclasses
  abstract mapFromDatabase(row: any): T;
  abstract mapToDatabase(data: CreateT | UpdateT): any;
  abstract validateCreate(data: CreateT): Promise<void>;
  abstract validateUpdate(data: UpdateT): Promise<void>;

  // Generic CRUD operations
  async create(data: CreateT): Promise<T> {
    await this.validateCreate(data);
    const mappedData = this.mapToDatabase(data);

    return this.db.executeQuery(
      async (client) => {
        const result = await client
          .from(this.tableName as any)
          .insert(mappedData)
          .select()
          .single();
        
        if (result.data) {
          result.data = this.mapFromDatabase(result.data);
        }
        
        return result;
      },
      `create ${this.tableName}`
    );
  }

  async findById(id: string): Promise<T | null> {
    return this.db.executeOptionalQuery(
      async (client) => {
        const result = await client
          .from(this.tableName as any)
          .select('*')
          .eq('id', id)
          .single();
        
        if (result.data) {
          result.data = this.mapFromDatabase(result.data);
        }
        
        return result;
      },
      `findById ${this.tableName}`
    );
  }

  async findByIdOrThrow(id: string): Promise<T> {
    const result = await this.findById(id);
    if (!result) {
      throw new NotFoundError(this.tableName, id);
    }
    return result;
  }

  async update(id: string, data: UpdateT): Promise<T> {
    await this.validateUpdate(data);
    const mappedData = this.mapToDatabase(data);

    return this.db.executeQuery(
      async (client) => {
        const result = await client
          .from(this.tableName as any)
          .update(mappedData)
          .eq('id', id)
          .select()
          .single();
        
        if (result.data) {
          result.data = this.mapFromDatabase(result.data);
        }
        
        return result;
      },
      `update ${this.tableName}`
    );
  }

  async delete(id: string): Promise<void> {
    await this.db.executeQuery(
      async (client) => {
        const result = await client
          .from(this.tableName as any)
          .delete()
          .eq('id', id)
          .select()
          .single();
        
        return result;
      },
      `delete ${this.tableName}`
    );
  }

  async findAll(limit = 50, offset = 0): Promise<T[]> {
    return this.db.executeArrayQuery(
      async (client) => {
        const result = await client
          .from(this.tableName as any)
          .select('*')
          .range(offset, offset + limit - 1)
          .order('created_at', { ascending: false });
        
        if (result.data) {
          result.data = result.data.map(row => this.mapFromDatabase(row));
        }
        
        return result;
      },
      `findAll ${this.tableName}`
    );
  }

  async count(): Promise<number> {
    const result = await this.db.executeQuery(
      async (client) => {
        return client
          .from(this.tableName as any)
          .select('*', { count: 'exact', head: true });
      },
      `count ${this.tableName}`
    );

    return result.count || 0;
  }

  async exists(id: string): Promise<boolean> {
    try {
      const result = await this.findById(id);
      return result !== null;
    } catch (error) {
      if (error instanceof NotFoundError) {
        return false;
      }
      throw error;
    }
  }
}