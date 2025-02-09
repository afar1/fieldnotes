import type { TodoItem, Column } from '../services/database';

interface LocalStorageData {
  version: string;
  columns: {
    [key: string]: {
      id: string;
      name: string;
      items: any[];
    };
  };
}

export const BACKUP_KEY = 'my-todos-backup';
export const MIGRATION_COMPLETE_KEY = 'indexeddb-migration-complete';

export const backupLocalStorage = () => {
  const data = localStorage.getItem('my-todos');
  if (data) {
    localStorage.setItem(BACKUP_KEY, data);
  }
};

export const restoreFromBackup = () => {
  const backup = localStorage.getItem(BACKUP_KEY);
  if (backup) {
    localStorage.setItem('my-todos', backup);
    return true;
  }
  return false;
};

export const validateLocalStorageData = (data: any): data is LocalStorageData => {
  if (!data || typeof data !== 'object') return false;
  if (typeof data.version !== 'string') return false;
  if (!data.columns || typeof data.columns !== 'object') return false;

  for (const columnId in data.columns) {
    const column = data.columns[columnId];
    if (!column || typeof column !== 'object') return false;
    if (typeof column.id !== 'string') return false;
    if (typeof column.name !== 'string') return false;
    if (!Array.isArray(column.items)) return false;
  }

  return true;
};

export const transformLocalStorageData = (data: LocalStorageData): {
  columns: Column[];
  items: TodoItem[];
} => {
  const columns: Column[] = [];
  const items: TodoItem[] = [];
  const timestamp = new Date().toISOString();

  for (const [columnId, column] of Object.entries(data.columns)) {
    // Transform column
    columns.push({
      id: columnId,
      name: column.name,
      createdAt: timestamp,
      updatedAt: timestamp
    });

    // Transform items
    column.items.forEach(item => {
      items.push({
        id: item.id || `id-${Date.now()}-${Math.random()}`,
        text: item.text || '',
        columnId,
        completedAt: item.completedAt,
        nextContact: item.nextContact,
        originalDays: item.originalDays,
        createdAt: timestamp,
        updatedAt: timestamp
      });
    });
  }

  return { columns, items };
};

export const markMigrationComplete = () => {
  localStorage.setItem(MIGRATION_COMPLETE_KEY, 'true');
};

export const isMigrationComplete = () => {
  return localStorage.getItem(MIGRATION_COMPLETE_KEY) === 'true';
};

export const cleanupAfterMigration = () => {
  // Don't remove the backup, but rename the original to indicate it's migrated
  localStorage.setItem('my-todos-migrated', localStorage.getItem('my-todos') || '');
  localStorage.removeItem('my-todos');
}; 