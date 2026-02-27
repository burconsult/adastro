import { BaseRepository } from '../base-repository.js';
import { DatabaseError } from '../connection.js';

export interface SiteSetting {
  id: string;
  key: string;
  value: any;
  category: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSiteSetting {
  key: string;
  value: any;
  category: string;
  description?: string;
}

export interface UpdateSiteSetting {
  value?: any;
  category?: string;
  description?: string;
}

export interface SettingsBackup {
  version: string;
  timestamp: Date;
  settings: SiteSetting[];
}

export class SettingsRepository extends BaseRepository<SiteSetting, CreateSiteSetting, UpdateSiteSetting> {
  constructor() {
    super('site_settings', true); // Use admin connection
  }

  mapFromDatabase(row: any): SiteSetting {
    return {
      id: row.id,
      key: row.key,
      value: row.value,
      category: row.category,
      description: row.description,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  mapToDatabase(data: CreateSiteSetting | UpdateSiteSetting): any {
    const mapped: any = {};
    
    if ('key' in data) mapped.key = data.key;
    if ('value' in data) mapped.value = data.value;
    if ('category' in data) mapped.category = data.category;
    if ('description' in data) mapped.description = data.description;
    
    return mapped;
  }

  async validateCreate(data: CreateSiteSetting): Promise<void> {
    if (!data.key || data.key.trim().length === 0) {
      throw new DatabaseError('Setting key is required');
    }
    
    if (!data.category || data.category.trim().length === 0) {
      throw new DatabaseError('Setting category is required');
    }

    if (data.value === undefined || data.value === null) {
      throw new DatabaseError('Setting value is required');
    }

    // Check if key already exists
    const existing = await this.findByKey(data.key);
    if (existing) {
      throw new DatabaseError(`Setting with key '${data.key}' already exists`);
    }
  }

  async validateUpdate(data: UpdateSiteSetting): Promise<void> {
    if (data.category !== undefined && (!data.category || data.category.trim().length === 0)) {
      throw new DatabaseError('Setting category cannot be empty');
    }
  }

  // Settings-specific methods
  async findByKey(key: string): Promise<SiteSetting | null> {
    return this.db.executeOptionalQuery(
      async (client) => {
        const result = await client
          .from('site_settings')
          .select('*')
          .eq('key', key)
          .single();
        
        if (result.data) {
          result.data = this.mapFromDatabase(result.data);
        }
        
        return result;
      },
      'findByKey site_settings'
    );
  }

  async findByCategory(category: string): Promise<SiteSetting[]> {
    return this.db.executeArrayQuery(
      async (client) => {
        const result = await client
          .from('site_settings')
          .select('*')
          .eq('category', category)
          .order('key', { ascending: true });
        
        if (result.data) {
          result.data = result.data.map(row => this.mapFromDatabase(row));
        }
        
        return result;
      },
      'findByCategory site_settings'
    );
  }

  async findByPrefix(prefix: string): Promise<SiteSetting[]> {
    return this.db.executeArrayQuery(
      async (client) => {
        const result = await client
          .from('site_settings')
          .select('*')
          .like('key', `${prefix}%`)
          .order('key', { ascending: true });

        if (result.data) {
          result.data = result.data.map(row => this.mapFromDatabase(row));
        }

        return result;
      },
      'findByPrefix site_settings'
    );
  }

  async getAllCategories(): Promise<string[]> {
    const result = await this.db.executeQuery(
      async (client) => {
        return client
          .from('site_settings')
          .select('category')
          .order('category', { ascending: true });
      },
      'getAllCategories site_settings'
    );

    // Extract unique categories
    const categories = new Set<string>();
    result.forEach((row: any) => categories.add(row.category));
    return Array.from(categories);
  }

  async upsert(data: CreateSiteSetting): Promise<SiteSetting> {
    const existing = await this.findByKey(data.key);
    
    if (existing) {
      return this.update(existing.id, {
        value: data.value,
        category: data.category,
        description: data.description
      });
    } else {
      return this.create(data);
    }
  }

  async deleteByKey(key: string): Promise<void> {
    await this.db.executeQuery(
      async (client) => {
        const result = await client
          .from('site_settings')
          .delete()
          .eq('key', key)
          .select()
          .single();
        
        return result;
      },
      'deleteByKey site_settings'
    );
  }

  async deleteByPrefix(prefix: string): Promise<number> {
    const result = await this.db.executeQuery(
      async (client) => {
        return client
          .from('site_settings')
          .delete()
          .like('key', `${prefix}%`)
          .select('key');
      },
      'deleteByPrefix site_settings'
    );

    return Array.isArray(result) ? result.length : 0;
  }

  async bulkUpsert(settings: CreateSiteSetting[]): Promise<SiteSetting[]> {
    const results: SiteSetting[] = [];
    
    for (const setting of settings) {
      const result = await this.upsert(setting);
      results.push(result);
    }
    
    return results;
  }

  async createBackup(): Promise<SettingsBackup> {
    const allSettings = await this.findAll(1000, 0); // Get all settings
    
    return {
      version: '1.0',
      timestamp: new Date(),
      settings: allSettings
    };
  }

  async restoreFromBackup(backup: SettingsBackup): Promise<void> {
    // Validate backup format
    if (!backup.version || !backup.settings || !Array.isArray(backup.settings)) {
      throw new DatabaseError('Invalid backup format');
    }

    // Clear existing settings
    await this.db.executeQuery(
      async (client) => {
        return client
          .from('site_settings')
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
      },
      'clearSettings site_settings'
    );

    // Restore settings
    const settingsToCreate = backup.settings.map(setting => ({
      key: setting.key,
      value: setting.value,
      category: setting.category,
      description: setting.description
    }));

    await this.bulkUpsert(settingsToCreate);
  }

  async getSettingsByKeys(keys: string[]): Promise<Record<string, any>> {
    const result = await this.db.executeArrayQuery(
      async (client) => {
        const result = await client
          .from('site_settings')
          .select('key, value')
          .in('key', keys);
        
        return result;
      },
      'getSettingsByKeys site_settings'
    );

    const settings: Record<string, any> = {};
    result.forEach((row: any) => {
      settings[row.key] = row.value;
    });
    
    return settings;
  }
}
