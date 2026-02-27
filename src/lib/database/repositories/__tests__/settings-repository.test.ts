import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SettingsRepository, type CreateSiteSetting } from '../settings-repository.js';
import { DatabaseError } from '../../connection.js';

// Mock the database connection
vi.mock('../../connection.js', () => ({
  DatabaseConnection: vi.fn().mockImplementation(() => ({
    getClient: vi.fn(),
    executeQuery: vi.fn(),
    executeOptionalQuery: vi.fn(),
    executeArrayQuery: vi.fn()
  })),
  DatabaseError: class extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'DatabaseError';
    }
  },
  NotFoundError: class extends Error {
    constructor(table: string, id: string) {
      super(`${table} with id ${id} not found`);
      this.name = 'NotFoundError';
    }
  }
}));

describe('SettingsRepository', () => {
  let repository: SettingsRepository;
  let mockDb: any;

  beforeEach(() => {
    repository = new SettingsRepository();
    mockDb = (repository as any).db;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('mapFromDatabase', () => {
    it('should correctly map database row to SiteSetting', () => {
      const dbRow = {
        id: '123',
        key: 'site.title',
        value: 'My Website',
        category: 'general',
        description: 'Site title',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z'
      };

      const result = repository.mapFromDatabase(dbRow);

      expect(result).toEqual({
        id: '123',
        key: 'site.title',
        value: 'My Website',
        category: 'general',
        description: 'Site title',
        createdAt: new Date('2023-01-01T00:00:00Z'),
        updatedAt: new Date('2023-01-01T00:00:00Z')
      });
    });
  });

  describe('mapToDatabase', () => {
    it('should correctly map CreateSiteSetting to database format', () => {
      const createData: CreateSiteSetting = {
        key: 'site.title',
        value: 'My Website',
        category: 'general',
        description: 'Site title'
      };

      const result = repository.mapToDatabase(createData);

      expect(result).toEqual({
        key: 'site.title',
        value: 'My Website',
        category: 'general',
        description: 'Site title'
      });
    });

    it('should handle partial update data', () => {
      const updateData = {
        value: 'Updated Website',
        category: 'general'
      };

      const result = repository.mapToDatabase(updateData);

      expect(result).toEqual({
        value: 'Updated Website',
        category: 'general'
      });
    });
  });

  describe('validateCreate', () => {
    it('should pass validation for valid data', async () => {
      const validData: CreateSiteSetting = {
        key: 'site.title',
        value: 'My Website',
        category: 'general'
      };

      mockDb.executeOptionalQuery.mockResolvedValue(null); // No existing setting

      await expect(repository.validateCreate(validData)).resolves.not.toThrow();
    });

    it('should throw error for missing key', async () => {
      const invalidData: CreateSiteSetting = {
        key: '',
        value: 'My Website',
        category: 'general'
      };

      await expect(repository.validateCreate(invalidData)).rejects.toThrow('Setting key is required');
    });

    it('should throw error for missing category', async () => {
      const invalidData: CreateSiteSetting = {
        key: 'site.title',
        value: 'My Website',
        category: ''
      };

      await expect(repository.validateCreate(invalidData)).rejects.toThrow('Setting category is required');
    });

    it('should throw error for null value', async () => {
      const invalidData: CreateSiteSetting = {
        key: 'site.title',
        value: null,
        category: 'general'
      };

      await expect(repository.validateCreate(invalidData)).rejects.toThrow('Setting value is required');
    });

    it('should throw error for duplicate key', async () => {
      const duplicateData: CreateSiteSetting = {
        key: 'site.title',
        value: 'My Website',
        category: 'general'
      };

      mockDb.executeOptionalQuery.mockResolvedValue({ id: '123' }); // Existing setting

      await expect(repository.validateCreate(duplicateData)).rejects.toThrow("Setting with key 'site.title' already exists");
    });
  });

  describe('validateUpdate', () => {
    it('should pass validation for valid update data', async () => {
      const validData = {
        value: 'Updated Website',
        category: 'general'
      };

      await expect(repository.validateUpdate(validData)).resolves.not.toThrow();
    });

    it('should throw error for empty category', async () => {
      const invalidData = {
        category: ''
      };

      await expect(repository.validateUpdate(invalidData)).rejects.toThrow('Setting category cannot be empty');
    });
  });

  describe('findByKey', () => {
    it('should find setting by key', async () => {
      const mockSetting = {
        id: '123',
        key: 'site.title',
        value: 'My Website',
        category: 'general',
        description: undefined,
        createdAt: new Date('2023-01-01T00:00:00Z'),
        updatedAt: new Date('2023-01-01T00:00:00Z')
      };

      mockDb.executeOptionalQuery.mockResolvedValue(mockSetting);

      const result = await repository.findByKey('site.title');

      expect(result).toEqual({
        id: '123',
        key: 'site.title',
        value: 'My Website',
        category: 'general',
        description: undefined,
        createdAt: new Date('2023-01-01T00:00:00Z'),
        updatedAt: new Date('2023-01-01T00:00:00Z')
      });
    });

    it('should return null for non-existent key', async () => {
      mockDb.executeOptionalQuery.mockResolvedValue(null);

      const result = await repository.findByKey('non.existent');

      expect(result).toBeNull();
    });
  });

  describe('findByCategory', () => {
    it('should find settings by category', async () => {
      const mockSettings = [
        {
          id: '123',
          key: 'site.title',
          value: 'My Website',
          category: 'general',
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z'
        },
        {
          id: '456',
          key: 'site.description',
          value: 'My Description',
          category: 'general',
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z'
        }
      ];

      mockDb.executeArrayQuery.mockResolvedValue(mockSettings);

      const result = await repository.findByCategory('general');

      expect(result).toHaveLength(2);
      expect(result[0].key).toBe('site.title');
      expect(result[1].key).toBe('site.description');
    });
  });

  describe('upsert', () => {
    it('should create new setting if it does not exist', async () => {
      const newSetting: CreateSiteSetting = {
        key: 'site.title',
        value: 'My Website',
        category: 'general'
      };

      mockDb.executeOptionalQuery.mockResolvedValue(null); // No existing setting
      mockDb.executeQuery.mockResolvedValue({
        id: '123',
        key: 'site.title',
        value: 'My Website',
        category: 'general',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z'
      });

      const result = await repository.upsert(newSetting);

      expect(result.key).toBe('site.title');
      expect(result.value).toBe('My Website');
    });

    it('should update existing setting', async () => {
      const updateSetting: CreateSiteSetting = {
        key: 'site.title',
        value: 'Updated Website',
        category: 'general'
      };

      const existingSetting = {
        id: '123',
        key: 'site.title',
        value: 'My Website',
        category: 'general',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockDb.executeOptionalQuery.mockResolvedValue(existingSetting);
      mockDb.executeQuery.mockResolvedValue({
        id: '123',
        key: 'site.title',
        value: 'Updated Website',
        category: 'general',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z'
      });

      const result = await repository.upsert(updateSetting);

      expect(result.value).toBe('Updated Website');
    });
  });

  describe('bulkUpsert', () => {
    it('should upsert multiple settings', async () => {
      const settings: CreateSiteSetting[] = [
        { key: 'site.title', value: 'My Website', category: 'general' },
        { key: 'site.description', value: 'My Description', category: 'general' }
      ];

      mockDb.executeOptionalQuery.mockResolvedValue(null); // No existing settings
      mockDb.executeQuery.mockResolvedValueOnce({
        id: '123',
        key: 'site.title',
        value: 'My Website',
        category: 'general',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z'
      }).mockResolvedValueOnce({
        id: '456',
        key: 'site.description',
        value: 'My Description',
        category: 'general',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z'
      });

      const result = await repository.bulkUpsert(settings);

      expect(result).toHaveLength(2);
      expect(result[0].key).toBe('site.title');
      expect(result[1].key).toBe('site.description');
    });
  });

  describe('getSettingsByKeys', () => {
    it('should return settings for specified keys', async () => {
      const mockResult = [
        { key: 'site.title', value: 'My Website' },
        { key: 'site.description', value: 'My Description' }
      ];

      mockDb.executeArrayQuery.mockResolvedValue(mockResult);

      const result = await repository.getSettingsByKeys(['site.title', 'site.description']);

      expect(result).toEqual({
        'site.title': 'My Website',
        'site.description': 'My Description'
      });
    });
  });

  describe('createBackup', () => {
    it('should create a backup with all settings', async () => {
      const mockSettings = [
        {
          id: '123',
          key: 'site.title',
          value: 'My Website',
          category: 'general',
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z'
        }
      ];

      mockDb.executeArrayQuery.mockResolvedValue(mockSettings);

      const backup = await repository.createBackup();

      expect(backup.version).toBe('1.0');
      expect(backup.settings).toHaveLength(1);
      expect(backup.settings[0].key).toBe('site.title');
      expect(backup.timestamp).toBeInstanceOf(Date);
    });
  });
});