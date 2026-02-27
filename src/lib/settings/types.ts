export interface SettingsCategory {
  name: string;
  displayName: string;
  description: string;
  settings: SiteSetting[];
}

export interface SiteSetting {
  id: string;
  key: string;
  value: any;
  category: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SettingDefinition {
  key: string;
  displayName: string;
  description: string;
  type: 'string' | 'number' | 'boolean' | 'json' | 'array';
  category: string;
  defaultValue: any;
  validation?: {
    required?: boolean;
    min?: number;
    max?: number;
    pattern?: string;
    options?: string[];
  };
}

export interface SettingsChangeEvent {
  key: string;
  oldValue: any;
  newValue: any;
  category: string;
  timestamp: Date;
  userId?: string;
}
