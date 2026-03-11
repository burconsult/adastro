import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SettingsService } from '../settings-service.js';
import { DatabaseError } from '../../database/connection.js';
import { getAllSettingDefinitions } from '../../settings/registry.js';

// Mock the SettingsRepository
vi.mock('../../database/repositories/settings-repository.js', () => ({
  SettingsRepository: vi.fn().mockImplementation(() => ({
    findByKey: vi.fn(),
    upsert: vi.fn(),
    findByCategory: vi.fn(),
    findAll: vi.fn(),
    getSettingsByKeys: vi.fn(),
    createBackup: vi.fn(),
    restoreFromBackup: vi.fn(),
    create: vi.fn()
  }))
}));

describe('SettingsService', () => {
  let service: SettingsService;
  let mockRepository: any;

  beforeEach(() => {
    service = new SettingsService();
    mockRepository = (service as any).repository;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getSetting', () => {
    it('should return setting value if exists', async () => {
      const mockSetting = {
        id: '123',
        key: 'site.title',
        value: 'My Website',
        category: 'general',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockRepository.findByKey.mockResolvedValue(mockSetting);

      const result = await service.getSetting('site.title');

      expect(result).toBe('My Website');
      expect(mockRepository.findByKey).toHaveBeenCalledWith('site.title');
    });

    it('should return default value if setting does not exist', async () => {
      mockRepository.findByKey.mockResolvedValue(null);

      const result = await service.getSetting('site.title');

      expect(result).toBe('AdAstro'); // Default value from definition
    });

    it('should return null for unknown setting', async () => {
      mockRepository.findByKey.mockResolvedValue(null);

      const result = await service.getSetting('unknown.setting');

      expect(result).toBeNull();
    });
  });

  describe('setSetting', () => {
    it('should set a valid setting', async () => {
      const mockOldSetting = {
        id: '123',
        key: 'site.title',
        value: 'Old Title',
        category: 'general',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockRepository.findByKey.mockResolvedValue(mockOldSetting);
      mockRepository.upsert.mockResolvedValue({
        ...mockOldSetting,
        value: 'New Title'
      });

      const changeListener = vi.fn();
      service.onSettingsChange(changeListener);

      await service.setSetting('site.title', 'New Title', 'user123');

      expect(mockRepository.upsert).toHaveBeenCalledWith({
        key: 'site.title',
        value: 'New Title',
        category: 'general',
        description: 'The main title of your website'
      });

      expect(changeListener).toHaveBeenCalledWith({
        key: 'site.title',
        oldValue: 'Old Title',
        newValue: 'New Title',
        category: 'general',
        timestamp: expect.any(Date),
        userId: 'user123'
      });
    });

    it('should throw error for unknown setting key', async () => {
      await expect(service.setSetting('unknown.key', 'value')).rejects.toThrow('Unknown setting key: unknown.key');
    });

    it('should validate string settings', async () => {
      await expect(service.setSetting('site.title', '')).rejects.toThrow("Setting 'site.title' is required");
    });

    it('should validate number settings', async () => {
      await expect(service.setSetting('content.postsPerPage', 0)).rejects.toThrow("Setting 'content.postsPerPage' must be at least 1");
      await expect(service.setSetting('content.postsPerPage', 100)).rejects.toThrow("Setting 'content.postsPerPage' must be at most 50");
    });

    it('should coerce boolean string values', async () => {
      const existingSetting = {
        id: '123',
        key: 'features.comments.enabled',
        value: true,
        category: 'extras',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockRepository.findByKey.mockResolvedValue(existingSetting);
      mockRepository.upsert.mockResolvedValue({ ...existingSetting, value: false });

      await expect(service.setSetting('features.comments.enabled', 'false')).resolves.not.toThrow();

      expect(mockRepository.upsert).toHaveBeenCalledWith({
        key: 'features.comments.enabled',
        value: false,
        category: 'extras',
        description: 'Allow comments on blog posts.'
      });
    });

    it('should validate array settings', async () => {
      // Array validation should work even without explicit validation rules
      await expect(service.setSetting('seo.keywords', 'not-an-array')).rejects.toThrow("Setting 'seo.keywords' must be an array");
    });

    it('should validate pattern settings', async () => {
      await expect(service.setSetting('site.url', 'not-a-url')).rejects.toThrow("Setting 'site.url' format is invalid");
    });
  });

  describe('getSettings', () => {
    it('should return settings for specified keys', async () => {
      const mockSettings = {
        'site.title': 'My Website',
        'site.description': 'My Description'
      };

      mockRepository.getSettingsByKeys.mockResolvedValue(mockSettings);

      const result = await service.getSettings(['site.title', 'site.description']);

      expect(result).toEqual(mockSettings);
    });

    it('should fill in default values for missing settings', async () => {
      mockRepository.getSettingsByKeys.mockResolvedValue({
        'site.title': 'My Website'
      });

      const result = await service.getSettings(['site.title', 'site.description']);

      expect(result).toEqual({
        'site.title': 'My Website',
        'site.description': 'A practical, speed-first CMS built with Astro and Supabase.' // Default value
      });
    });
  });

  describe('getSettingsByCategory', () => {
    it('should return settings for a category', async () => {
      const mockSettings = [
        {
          id: '123',
          key: 'site.title',
          value: 'My Website',
          category: 'general',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      mockRepository.findByCategory.mockResolvedValue(mockSettings);

      const result = await service.getSettingsByCategory('general');

      expect(result.name).toBe('general');
      expect(result.displayName).toBe('General Settings');
      const expectedGeneralCount = getAllSettingDefinitions().filter((definition) => (
        definition.category === 'general' && (definition.adminSurface ?? 'settings') === 'settings'
      )).length;
      expect(result.settings).toHaveLength(expectedGeneralCount);
    });

    it('should include default settings not in database', async () => {
      mockRepository.findByCategory.mockResolvedValue([]);

      const result = await service.getSettingsByCategory('general');

      expect(result.settings.length).toBeGreaterThan(0);
      expect(result.settings.some(s => s.key === 'site.title')).toBe(true);
    });

    it('should preserve definition order within a category', async () => {
      mockRepository.findByCategory.mockResolvedValue([
        {
          id: '1',
          key: 'site.tagline',
          value: 'Tagline',
          category: 'general',
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: '2',
          key: 'site.title',
          value: 'Title',
          category: 'general',
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: '3',
          key: 'site.url',
          value: 'https://example.com',
          category: 'general',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]);

      const result = await service.getSettingsByCategory('general');
      const keys = result.settings.map((setting) => setting.key);
      expect(keys.indexOf('site.title')).toBeLessThan(keys.indexOf('site.url'));
      expect(keys.indexOf('site.url')).toBeLessThan(keys.indexOf('site.tagline'));
    });
  });

  describe('updateSettings', () => {
    it('should update multiple settings', async () => {
      mockRepository.findByKey.mockResolvedValue(null);
      mockRepository.upsert.mockResolvedValue({});

      const updates = {
        'site.title': 'New Title',
        'site.description': 'New Description'
      };

      await service.updateSettings(updates, 'user123');

      expect(mockRepository.upsert).toHaveBeenCalledTimes(2);
    });
  });

  describe('resetToDefaults', () => {
    it('should reset all settings to defaults', async () => {
      mockRepository.findByKey.mockResolvedValue(null);
      mockRepository.upsert.mockResolvedValue({});

      await service.resetToDefaults();

      expect(mockRepository.upsert).toHaveBeenCalledTimes(getAllSettingDefinitions().length);
    });

    it('should reset category settings to defaults', async () => {
      mockRepository.findByKey.mockResolvedValue(null);
      mockRepository.upsert.mockResolvedValue({});

      await service.resetToDefaults('general');

      const expectedGeneralCount = getAllSettingDefinitions().filter((definition) => definition.category === 'general').length;
      expect(mockRepository.upsert).toHaveBeenCalledTimes(expectedGeneralCount);
    });
  });

  describe('exportSettings', () => {
    it('should export all settings', async () => {
      const mockSettings = [
        {
          id: '123',
          key: 'site.title',
          value: 'My Website',
          category: 'general',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      mockRepository.findAll.mockResolvedValue(mockSettings);

      const result = await service.exportSettings();

      expect(result).toEqual({
        'site.title': 'My Website'
      });
    });

    it('should export settings by category', async () => {
      const mockSettings = [
        {
          id: '123',
          key: 'site.title',
          value: 'My Website',
          category: 'general',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      mockRepository.findByCategory.mockResolvedValue(mockSettings);

      const result = await service.exportSettings('general');

      expect(result).toEqual({
        'site.title': 'My Website'
      });
    });
  });

  describe('importSettings', () => {
    it('should import valid settings', async () => {
      mockRepository.findByKey.mockResolvedValue(null);
      mockRepository.upsert.mockResolvedValue({});

      const settings = {
        'site.title': 'Imported Title',
        'site.description': 'Imported Description'
      };

      await service.importSettings(settings, 'user123');

      expect(mockRepository.upsert).toHaveBeenCalledTimes(2);
    });

    it('should skip invalid settings during import', async () => {
      mockRepository.findByKey.mockResolvedValue(null);
      mockRepository.upsert.mockResolvedValue({});

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const settings = {
        'site.title': 'Valid Title',
        'invalid.key': 'Invalid Value'
      };

      await service.importSettings(settings, 'user123');

      expect(mockRepository.upsert).toHaveBeenCalledTimes(1);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to import setting invalid.key:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('backup and restore', () => {
    it('should create backup', async () => {
      const mockBackup = {
        version: '1.0',
        timestamp: new Date(),
        settings: []
      };

      mockRepository.createBackup.mockResolvedValue(mockBackup);

      const result = await service.createBackup();

      expect(result).toEqual(mockBackup);
    });

    it('should restore from backup', async () => {
      const mockBackup = {
        version: '1.0',
        timestamp: new Date(),
        settings: []
      };

      mockRepository.restoreFromBackup.mockResolvedValue(undefined);

      await service.restoreFromBackup(mockBackup);

      expect(mockRepository.restoreFromBackup).toHaveBeenCalledWith(mockBackup);
    });
  });

  describe('initializeDefaultSettings', () => {
    it('should create default settings that do not exist', async () => {
      mockRepository.findByKey.mockResolvedValue(null);
      mockRepository.create.mockResolvedValue({});

      await service.initializeDefaultSettings();

      expect(mockRepository.create).toHaveBeenCalledTimes(getAllSettingDefinitions().length);
    });

    it('should skip existing settings', async () => {
      mockRepository.findByKey.mockResolvedValue({ id: '123' });
      mockRepository.create.mockResolvedValue({});

      await service.initializeDefaultSettings();

      expect(mockRepository.create).not.toHaveBeenCalled();
    });
  });
});
