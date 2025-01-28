import { STORAGE_KEYS, DEFAULT_STATE, CURRENT_VERSION, UI, ERRORS } from '../constants';

/**
 * Validates and sanitizes item text
 * @param {string} text - The text to sanitize
 * @returns {string} - Sanitized text
 */
export const sanitizeItemText = (text) => {
  if (typeof text !== 'string') return '';
  return text.trim().slice(0, UI.MAX_TODO_LENGTH);
};

/**
 * Generates a unique ID for a todo item
 * @returns {string} - Unique ID
 */
export const generateId = () => `id-${Date.now()}-${Math.random()}`;

/**
 * Formats a timestamp to show how long ago
 * @param {string} timestamp - ISO timestamp
 * @returns {string} - Formatted time ago string
 */
export const formatTimeAgo = (timestamp) => {
  const diff = new Date() - new Date(timestamp);
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d`;
  if (hours > 0) return `${hours}h`;
  return `${minutes}m`;
};

/**
 * Validates column structure
 * @param {Object} column - Column to validate
 * @param {Object} defaultColumn - Default column structure
 * @returns {Object} - Validated column
 */
export const validateColumnStructure = (column, defaultColumn) => {
  if (!column || typeof column !== 'object') return defaultColumn;
  
  return {
    id: column.id || defaultColumn.id,
    name: column.name || defaultColumn.name,
    items: Array.isArray(column.items) ? column.items.map(item => ({
      id: item.id || generateId(),
      text: typeof item.text === 'string' ? item.text : '',
      completedAt: item.completedAt || undefined
    })) : defaultColumn.items
  };
};

/**
 * Saves data to localStorage with error handling
 * @param {Object} columns - Columns data to save
 * @returns {boolean} - Success status
 */
export const saveToLocalStorage = (columns) => {
  try {
    if (!columns || typeof columns !== 'object') {
      throw new Error(ERRORS.INVALID_DATA);
    }
    const dataToSave = {
      version: CURRENT_VERSION,
      columns: columns
    };
    localStorage.setItem(STORAGE_KEYS.TODOS, JSON.stringify(dataToSave));
    return true;
  } catch (error) {
    console.error('Error saving to localStorage:', error);
    return false;
  }
};

/**
 * Loads data from localStorage with validation
 * @returns {Object} - Loaded and validated data
 */
export const loadFromLocalStorage = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.TODOS);
    if (!saved) return { ...DEFAULT_STATE, needsMigration: false };

    const parsed = JSON.parse(saved);
    if (!parsed || typeof parsed !== 'object') {
      throw new Error(ERRORS.INVALID_DATA);
    }

    return parsed;
  } catch (error) {
    console.error('Error loading from localStorage:', error);
    return { ...DEFAULT_STATE, needsMigration: false };
  }
};

/**
 * Creates a new todo item
 * @param {string} text - Todo text
 * @param {boolean} isDone - Whether the item is done
 * @returns {Object} - New todo item
 */
export const createTodoItem = (text, isDone = false) => ({
  id: generateId(),
  text: sanitizeItemText(text),
  completedAt: isDone ? new Date().toISOString() : undefined
});

/**
 * Checks if an item exists in a column
 * @param {Object} column - Column to check
 * @param {string} itemId - Item ID to find
 * @returns {boolean} - Whether item exists
 */
export const itemExistsInColumn = (column, itemId) => {
  return column?.items?.some(item => item.id === itemId) || false;
}; 