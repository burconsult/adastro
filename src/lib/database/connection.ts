import { supabase, supabaseAdmin, type Database } from '../supabase.js';
import type { SupabaseClient } from '@supabase/supabase-js';

// Database error types
export class DatabaseError extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'DatabaseError';
  }
}

export class ValidationError extends DatabaseError {
  constructor(message: string, public field?: string) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends DatabaseError {
  constructor(resource: string, id?: string) {
    super(`${resource}${id ? ` with id ${id}` : ''} not found`, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends DatabaseError {
  constructor(message: string) {
    super(message, 'CONFLICT');
    this.name = 'ConflictError';
  }
}

// Database connection utilities
export class DatabaseConnection {
  private client: SupabaseClient<Database>;

  constructor(useAdmin = false) {
    this.client = useAdmin ? supabaseAdmin : supabase;
  }

  getClient(): SupabaseClient<Database> {
    return this.client;
  }

  // Generic error handler for Supabase operations
  handleError(error: any, operation: string): never {
    console.error(`Database error in ${operation}:`, error);

    if (error?.code === '23505') {
      throw new ConflictError('Resource already exists with this unique constraint');
    }

    if (error?.code === '23503') {
      throw new ValidationError('Referenced resource does not exist');
    }

    if (error?.code === '23514') {
      throw new ValidationError('Data violates check constraint');
    }

    throw new DatabaseError(
      error?.message || `Unknown error in ${operation}`,
      error?.code,
      error?.details
    );
  }

  // Execute query with error handling
  async executeQuery<T>(
    queryFn: (client: SupabaseClient<Database>) => Promise<{ data: T | null; error: any }>,
    operation: string
  ): Promise<T> {
    try {
      const { data, error } = await queryFn(this.client);
      
      if (error) {
        this.handleError(error, operation);
      }

      if (data === null) {
        throw new NotFoundError('Resource');
      }

      return data;
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      this.handleError(error, operation);
    }
  }

  // Execute query that may return null (for optional operations)
  async executeOptionalQuery<T>(
    queryFn: (client: SupabaseClient<Database>) => Promise<{ data: T | null; error: any }>,
    operation: string
  ): Promise<T | null> {
    try {
      const { data, error } = await queryFn(this.client);
      
      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        this.handleError(error, operation);
      }

      return data;
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      this.handleError(error, operation);
    }
  }

  // Execute query that returns an array
  async executeArrayQuery<T>(
    queryFn: (client: SupabaseClient<Database>) => Promise<{ data: T[] | null; error: any }>,
    operation: string
  ): Promise<T[]> {
    try {
      const { data, error } = await queryFn(this.client);
      
      if (error) {
        this.handleError(error, operation);
      }

      return data || [];
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      this.handleError(error, operation);
    }
  }
}

// Singleton instances
export const dbConnection = new DatabaseConnection(false);
export const adminDbConnection = new DatabaseConnection(true);
