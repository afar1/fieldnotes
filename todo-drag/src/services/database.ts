import Dexie from 'dexie';
import {
  backupLocalStorage,
  validateLocalStorageData,
  transformLocalStorageData,
  markMigrationComplete,
  isMigrationComplete,
  cleanupAfterMigration,
  restoreFromBackup
} from '../utils/migrationUtils';

// Define interfaces for our database tables
export interface TodoItem {
  id: string;
  text: string;
  columnId: string;
  completedAt?: string;
  nextContact?: string;
  originalDays?: number;
  userId?: string;  // Optional for now until we implement auth
  createdAt: string;
  updatedAt: string;
}

export interface Column {
  id: string;
  name: string;
  userId?: string;  // Optional for now until we implement auth
  createdAt: string;
  updatedAt: string;
}

export interface UserSettings {
  userId: string;
  theme: string;
  showDone: boolean;
  showIgnore: boolean;
  createdAt: string;
  updatedAt: string;
}

// Define our database class
class TodoDatabase extends Dexie {
  items!: Dexie.Table<TodoItem, string>;
  columns!: Dexie.Table<Column, string>;
  settings!: Dexie.Table<UserSettings, string>;

  constructor() {
    super('TodoDB');
    
    // Define tables and indexes
    this.version(1).stores({
      items: 'id, columnId, userId, updatedAt',
      columns: 'id, userId',
      settings: 'userId'
    });
  }

  // Helper method to initialize default columns if they don't exist
  async initializeDefaultColumns(): Promise<void> {
    const defaultColumns = ['do', 'done', 'ignore', 'others', 'ember'].map(id => ({
      id,
      name: id.toUpperCase(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }));

    // Check if columns exist
    const existingColumns = await this.columns.toArray();
    if (existingColumns.length === 0) {
      await this.columns.bulkAdd(defaultColumns);
    }
  }

  // Helper method to migrate data from localStorage
  async migrateFromLocalStorage(): Promise<void> {
    // Skip if migration is already complete
    if (isMigrationComplete()) {
      return;
    }

    try {
      // Backup existing localStorage data
      backupLocalStorage();

      const localData = localStorage.getItem('my-todos');
      if (!localData) return;

      const data = JSON.parse(localData);
      if (!validateLocalStorageData(data)) {
        throw new Error('Invalid localStorage data format');
      }

      // Transform the data
      const { columns, items } = transformLocalStorageData(data);

      // Start a transaction for atomic migration
      await this.transaction('rw', [this.items, this.columns], async () => {
        // Clear existing data
        await this.items.clear();
        await this.columns.clear();

        // Add new data
        await this.columns.bulkAdd(columns);
        await this.items.bulkAdd(items);
      });

      // Mark migration as complete and cleanup
      markMigrationComplete();
      cleanupAfterMigration();
    } catch (error) {
      console.error('Migration failed:', error);
      // Attempt to restore from backup
      if (restoreFromBackup()) {
        console.log('Restored from backup');
      }
      throw error;
    }
  }

  // CRUD operations for items
  async getItemsByColumn(columnId: string): Promise<TodoItem[]> {
    return this.items.where('columnId').equals(columnId).toArray();
  }

  async addItem(item: Omit<TodoItem, 'createdAt' | 'updatedAt'>): Promise<string> {
    const timestamp = new Date().toISOString();
    const itemWithTimestamps = {
      ...item,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    
    const id = await this.items.add(itemWithTimestamps);
    return id.toString();
  }

  async updateItem(id: string, updates: Partial<TodoItem>): Promise<void> {
    await this.items.update(id, {
      ...updates,
      updatedAt: new Date().toISOString()
    });
  }

  async deleteItem(id: string): Promise<void> {
    await this.items.delete(id);
  }

  // Column operations
  async getAllColumns(): Promise<Column[]> {
    return this.columns.toArray();
  }

  async updateColumn(id: string, updates: Partial<Column>): Promise<void> {
    await this.columns.update(id, {
      ...updates,
      updatedAt: new Date().toISOString()
    });
  }

  // Settings operations
  async getUserSettings(userId: string): Promise<UserSettings | undefined> {
    return this.settings.get(userId);
  }

  async updateUserSettings(userId: string, updates: Partial<UserSettings>): Promise<void> {
    const timestamp = new Date().toISOString();
    await this.settings.put({
      ...(await this.getUserSettings(userId) || {
        userId,
        theme: 'light',
        showDone: false,
        showIgnore: false,
        createdAt: timestamp
      }),
      ...updates,
      updatedAt: timestamp
    });
  }
}

// Create and export a single instance
export const db = new TodoDatabase();

// Initialize the database
export const initializeDatabase = async (): Promise<void> => {
  try {
    await db.initializeDefaultColumns();
    await db.migrateFromLocalStorage();
  } catch (error) {
    console.error('Database initialization failed:', error);
    throw error;
  }
}; 