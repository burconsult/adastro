import { SettingsRepository, type SettingsBackup } from '../database/repositories/settings-repository.js';
import { DatabaseError } from '../database/connection.js';
import type { SettingsCategory, SettingDefinition, SettingsChangeEvent } from '../settings/types.js';
import { getAllSettingDefinitions, getCategoryList, SETTINGS_CATEGORY_META } from '../settings/registry.js';

export class SettingsService {
  private repository: SettingsRepository;
  private changeListeners: ((event: SettingsChangeEvent) => void)[] = [];

  // Predefined setting definitions
  private settingDefinitions: SettingDefinition[];

  constructor() {
    this.repository = new SettingsRepository();
    this.settingDefinitions = getAllSettingDefinitions();
  }

  private isVisibleInSettings(definition: SettingDefinition): boolean {
    return (definition.adminSurface ?? 'settings') === 'settings';
  }

  async initializeDefaultSettings(): Promise<void> {
    for (const definition of this.settingDefinitions) {
      const existing = await this.repository.findByKey(definition.key);
      if (!existing) {
        await this.repository.create({
          key: definition.key,
          value: definition.defaultValue,
          category: definition.category,
          description: definition.description
        });
      }
    }
  }

  async getSetting(key: string): Promise<any> {
    const setting = await this.repository.findByKey(key);
    if (!setting) {
      // Return default value if setting doesn't exist
      const definition = this.settingDefinitions.find(def => def.key === key);
      return definition?.defaultValue || null;
    }
    return setting.value;
  }

  async getSettings(keys: string[]): Promise<Record<string, any>> {
    const settings = await this.repository.getSettingsByKeys(keys);
    
    // Fill in default values for missing settings
    for (const key of keys) {
      if (!(key in settings)) {
        const definition = this.settingDefinitions.find(def => def.key === key);
        if (definition) {
          settings[key] = definition.defaultValue;
        }
      }
    }
    
    return settings;
  }

  async setSetting(key: string, value: any, userId?: string): Promise<void> {
    const definition = this.settingDefinitions.find(def => def.key === key);
    if (!definition) {
      throw new DatabaseError(`Unknown setting key: ${key}`);
    }

    const normalizedValue = this.normalizeSettingValue(definition, value);

    // Validate the value
    this.validateSettingValue(definition, normalizedValue);

    // Get old value for change tracking
    const oldValue = await this.getSetting(key);

    // Update or create the setting
    await this.repository.upsert({
      key,
      value: normalizedValue,
      category: definition.category,
      description: definition.description
    });

    // Emit change event
    this.emitChangeEvent({
      key,
      oldValue,
      newValue: normalizedValue,
      category: definition.category,
      timestamp: new Date(),
      userId
    });
  }

  async getSettingsByCategory(category: string): Promise<SettingsCategory> {
    const settings = await this.repository.findByCategory(category);
    const categoryDefinitions = this.settingDefinitions.filter((def) => (
      def.category === category && this.isVisibleInSettings(def)
    ));
    const categoryOrder = new Map(categoryDefinitions.map((definition, index) => [definition.key, index]));
    
    // Add missing settings with default values
    for (const definition of categoryDefinitions) {
      const exists = settings.find(s => s.key === definition.key);
      if (!exists) {
        settings.push({
          id: '',
          key: definition.key,
          value: definition.defaultValue,
          category: definition.category,
          description: definition.description,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
    }

    return {
      name: category,
      displayName: this.getCategoryDisplayName(category),
      description: this.getCategoryDescription(category),
      settings: settings.sort((a, b) => {
        const aOrder = categoryOrder.get(a.key);
        const bOrder = categoryOrder.get(b.key);
        if (aOrder !== undefined && bOrder !== undefined && aOrder !== bOrder) {
          return aOrder - bOrder;
        }
        if (aOrder !== undefined && bOrder === undefined) return -1;
        if (aOrder === undefined && bOrder !== undefined) return 1;
        return a.key.localeCompare(b.key);
      })
    };
  }

  private normalizeSettingValue(definition: SettingDefinition, value: any): any {
    switch (definition.type) {
      case 'boolean': {
        if (typeof value === 'boolean') return value;
        if (typeof value === 'string') {
          const lowered = value.toLowerCase();
          if (lowered === 'true' || lowered === '1' || lowered === 'on') return true;
          if (lowered === 'false' || lowered === '0' || lowered === 'off') return false;
        }
        return Boolean(value);
      }
      case 'number': {
        if (typeof value === 'number') return value;
        if (typeof value === 'string' && value.trim() !== '') {
          const parsed = Number(value);
          if (!Number.isNaN(parsed)) {
            return parsed;
          }
        }
        return value;
      }
      case 'array': {
        if (Array.isArray(value)) return value;
        if (typeof value === 'string') {
          try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed : value;
          } catch {
            return value;
          }
        }
        return value;
      }
      case 'json': {
        if (typeof value === 'object' && value !== null) return value;
        if (typeof value === 'string') {
          try {
            return JSON.parse(value);
          } catch {
            return value;
          }
        }
        return value;
      }
      default:
        return value;
    }
  }

  async getAllCategories(): Promise<SettingsCategory[]> {
    const categories = getCategoryList();
    const result: SettingsCategory[] = [];

    for (const category of categories) {
      const categoryData = await this.getSettingsByCategory(category);
      if (categoryData.settings.length > 0) {
        result.push(categoryData);
      }
    }

    return result;
  }

  async updateSettings(updates: Record<string, any>, userId?: string): Promise<void> {
    for (const [key, value] of Object.entries(updates)) {
      await this.setSetting(key, value, userId);
    }
  }

  async resetToDefaults(category?: string): Promise<void> {
    const definitions = category 
      ? this.settingDefinitions.filter(def => def.category === category)
      : this.settingDefinitions;

    for (const definition of definitions) {
      await this.setSetting(definition.key, definition.defaultValue);
    }
  }

  async createBackup(): Promise<SettingsBackup> {
    return this.repository.createBackup();
  }

  async restoreFromBackup(backup: SettingsBackup): Promise<void> {
    await this.repository.restoreFromBackup(backup);
  }

  async exportSettings(category?: string): Promise<Record<string, any>> {
    const settings = category 
      ? await this.repository.findByCategory(category)
      : await this.repository.findAll(1000, 0);

    const exported: Record<string, any> = {};
    settings.forEach(setting => {
      exported[setting.key] = setting.value;
    });

    return exported;
  }

  async getSettingsByPrefix(prefix: string): Promise<Record<string, any>> {
    const settings = await this.repository.findByPrefix(prefix);
    const exported: Record<string, any> = {};
    settings.forEach(setting => {
      exported[setting.key] = setting.value;
    });
    return exported;
  }

  async importSettings(settings: Record<string, any>, userId?: string): Promise<void> {
    for (const [key, value] of Object.entries(settings)) {
      try {
        await this.setSetting(key, value, userId);
      } catch (error) {
        console.warn(`Failed to import setting ${key}:`, error);
      }
    }
  }

  async deleteSettingsByPrefix(prefix: string): Promise<number> {
    return this.repository.deleteByPrefix(prefix);
  }

  getSettingDefinition(key: string): SettingDefinition | undefined {
    return this.settingDefinitions.find(def => def.key === key);
  }

  getAllSettingDefinitions(): SettingDefinition[] {
    return [...this.settingDefinitions];
  }

  onSettingsChange(listener: (event: SettingsChangeEvent) => void): void {
    this.changeListeners.push(listener);
  }

  private validateSettingValue(definition: SettingDefinition, value: any): void {
    const { validation } = definition;

    // Required validation
    if (validation?.required && (value === null || value === undefined || value === '')) {
      throw new DatabaseError(`Setting '${definition.key}' is required`);
    }

    // Type-specific validation (always validate types)
    switch (definition.type) {
      case 'string':
        if (typeof value !== 'string') {
          throw new DatabaseError(`Setting '${definition.key}' must be a string`);
        }
        if (validation?.min && value.length < validation.min) {
          throw new DatabaseError(`Setting '${definition.key}' must be at least ${validation.min} characters`);
        }
        if (validation?.max && value.length > validation.max) {
          throw new DatabaseError(`Setting '${definition.key}' must be at most ${validation.max} characters`);
        }
        if (validation?.pattern && !new RegExp(validation.pattern).test(value)) {
          throw new DatabaseError(`Setting '${definition.key}' format is invalid`);
        }
        if (validation?.options && !validation.options.includes(value)) {
          throw new DatabaseError(`Setting '${definition.key}' must be one of: ${validation.options.join(', ')}`);
        }
        break;

      case 'number':
        if (typeof value !== 'number' || isNaN(value)) {
          throw new DatabaseError(`Setting '${definition.key}' must be a number`);
        }
        if (validation?.min !== undefined && value < validation.min) {
          throw new DatabaseError(`Setting '${definition.key}' must be at least ${validation.min}`);
        }
        if (validation?.max !== undefined && value > validation.max) {
          throw new DatabaseError(`Setting '${definition.key}' must be at most ${validation.max}`);
        }
        break;

      case 'boolean':
        if (typeof value !== 'boolean') {
          throw new DatabaseError(`Setting '${definition.key}' must be a boolean`);
        }
        break;

      case 'array':
        if (!Array.isArray(value)) {
          throw new DatabaseError(`Setting '${definition.key}' must be an array`);
        }
        break;
    }
  }

  private getCategoryDisplayName(category: string): string {
    return SETTINGS_CATEGORY_META[category]?.displayName || category;
  }

  private getCategoryDescription(category: string): string {
    return SETTINGS_CATEGORY_META[category]?.description || '';
  }

  private emitChangeEvent(event: SettingsChangeEvent): void {
    this.changeListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in settings change listener:', error);
      }
    });
  }
}
