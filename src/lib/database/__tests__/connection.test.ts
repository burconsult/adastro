import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  DatabaseError, 
  ValidationError, 
  NotFoundError, 
  ConflictError,
  DatabaseConnection 
} from '../connection.js';

describe('Database Error Classes', () => {
  describe('DatabaseError', () => {
    it('should create database error with message and code', () => {
      const error = new DatabaseError('Test error', 'TEST_CODE', { detail: 'test' });
      
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.details).toEqual({ detail: 'test' });
      expect(error.name).toBe('DatabaseError');
    });
  });

  describe('ValidationError', () => {
    it('should create validation error', () => {
      const error = new ValidationError('Invalid data', 'email');
      
      expect(error.message).toBe('Invalid data');
      expect(error.field).toBe('email');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.name).toBe('ValidationError');
    });
  });

  describe('NotFoundError', () => {
    it('should create not found error', () => {
      const error = new NotFoundError('User', '123');
      
      expect(error.message).toBe('User with id 123 not found');
      expect(error.code).toBe('NOT_FOUND');
      expect(error.name).toBe('NotFoundError');
    });

    it('should create not found error without id', () => {
      const error = new NotFoundError('User');
      
      expect(error.message).toBe('User not found');
      expect(error.code).toBe('NOT_FOUND');
    });
  });

  describe('ConflictError', () => {
    it('should create conflict error', () => {
      const error = new ConflictError('Resource already exists');
      
      expect(error.message).toBe('Resource already exists');
      expect(error.code).toBe('CONFLICT');
      expect(error.name).toBe('ConflictError');
    });
  });
});

describe('DatabaseConnection', () => {
  describe('handleError', () => {
    let consoleSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it('should handle 23505 error as ConflictError', () => {
      const connection = new DatabaseConnection();
      const error = { code: '23505', message: 'Unique constraint violation' };
      
      expect(() => connection.handleError(error, 'test operation')).toThrow(ConflictError);
    });

    it('should handle 23503 error as ValidationError', () => {
      const connection = new DatabaseConnection();
      const error = { code: '23503', message: 'Foreign key violation' };
      
      expect(() => connection.handleError(error, 'test operation')).toThrow(ValidationError);
    });

    it('should handle 23514 error as ValidationError', () => {
      const connection = new DatabaseConnection();
      const error = { code: '23514', message: 'Check constraint violation' };
      
      expect(() => connection.handleError(error, 'test operation')).toThrow(ValidationError);
    });

    it('should handle unknown error as DatabaseError', () => {
      const connection = new DatabaseConnection();
      const error = { code: 'UNKNOWN', message: 'Unknown error' };
      
      expect(() => connection.handleError(error, 'test operation')).toThrow(DatabaseError);
    });
  });

  describe('executeOptionalQuery', () => {
    it('returns null when Supabase responds with PGRST116', async () => {
      const connection = new DatabaseConnection();
      const result = await connection.executeOptionalQuery(
        async () => ({ data: null, error: { code: 'PGRST116' } }),
        'optional test'
      );

      expect(result).toBeNull();
    });
  });
});
