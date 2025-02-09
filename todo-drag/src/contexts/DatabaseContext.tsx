import React, { createContext, useContext, useEffect, useState } from 'react';
import { db, initializeDatabase } from '../services/database';
import type { TodoItem, Column, UserSettings } from '../services/database';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import MigrationProgress from '../components/MigrationProgress';
import { isMigrationComplete } from '../utils/migrationUtils';

interface DatabaseContextType {
  db: typeof db;
  isLoading: boolean;
  error: Error | null;
}

const DatabaseContext = createContext<DatabaseContextType | null>(null);

type MigrationStage = 'backup' | 'migration' | 'complete' | 'error';

export const DatabaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [migrationStage, setMigrationStage] = useState<MigrationStage | null>(
    !isMigrationComplete() ? 'backup' : null
  );

  const initDb = async () => {
    try {
      if (!isMigrationComplete()) {
        setMigrationStage('backup');
        // Small delay to show the backup stage
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        setMigrationStage('migration');
        await initializeDatabase();
        
        setMigrationStage('complete');
        // Small delay to show completion
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else {
        await initializeDatabase();
      }
      
      setIsLoading(false);
      setError(null);
      setMigrationStage(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to initialize database'));
      setMigrationStage('error');
      setIsLoading(false);
    }
  };

  useEffect(() => {
    initDb();
  }, []);

  // Show migration progress if we're migrating
  if (migrationStage) {
    return (
      <MigrationProgress
        stage={migrationStage}
        error={error?.message}
        onRetry={migrationStage === 'error' ? initDb : undefined}
      />
    );
  }

  if (error) {
    return (
      <ErrorMessage 
        message={`Error initializing database: ${error.message}`}
        onRetry={initDb}
      />
    );
  }

  if (isLoading) {
    return <LoadingSpinner message="Initializing database..." />;
  }

  return (
    <DatabaseContext.Provider value={{ db, isLoading, error }}>
      {children}
    </DatabaseContext.Provider>
  );
};

export const useDatabase = () => {
  const context = useContext(DatabaseContext);
  if (!context) {
    throw new Error('useDatabase must be used within a DatabaseProvider');
  }
  return context;
};

// Custom hooks for common database operations
export const useColumnItems = (columnId: string) => {
  const { db } = useDatabase();
  const [items, setItems] = useState<TodoItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadItems = async () => {
      try {
        const columnItems = await db.getItemsByColumn(columnId);
        setItems(columnItems);
      } catch (error) {
        console.error('Failed to load items:', error);
      } finally {
        setLoading(false);
      }
    };

    loadItems();
  }, [columnId, db]);

  return { items, loading };
};

export const useColumns = () => {
  const { db } = useDatabase();
  const [columns, setColumns] = useState<Column[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadColumns = async () => {
      try {
        const allColumns = await db.getAllColumns();
        setColumns(allColumns);
      } catch (error) {
        console.error('Failed to load columns:', error);
      } finally {
        setLoading(false);
      }
    };

    loadColumns();
  }, [db]);

  return { columns, loading };
};

export const useUserSettings = (userId: string) => {
  const { db } = useDatabase();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const userSettings = await db.getUserSettings(userId);
        setSettings(userSettings || null);
      } catch (error) {
        console.error('Failed to load user settings:', error);
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [userId, db]);

  const updateSettings = async (updates: Partial<UserSettings>) => {
    try {
      await db.updateUserSettings(userId, updates);
      const updatedSettings = await db.getUserSettings(userId);
      setSettings(updatedSettings || null);
    } catch (error) {
      console.error('Failed to update settings:', error);
      throw error;
    }
  };

  return { settings, loading, updateSettings };
}; 