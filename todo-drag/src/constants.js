// Version Control
export const CURRENT_VERSION = '1.0.1';

// Local Storage Keys
export const STORAGE_KEYS = {
  TODOS: 'my-todos',
  COMPLETED_TIPS: 'completed-tips'
};

// Column Configuration
export const COLUMNS = {
  DO: 'do',
  DONE: 'done',
  IGNORE: 'ignore',
  OTHERS: 'others'
};

// Column Navigation Sequence
export const COLUMN_SEQUENCE = [COLUMNS.DO, COLUMNS.IGNORE, COLUMNS.OTHERS];

// Default Column Structure
export const DEFAULT_COLUMNS = {
  [COLUMNS.DO]: {
    id: COLUMNS.DO,
    name: 'DO',
    items: [],
  },
  [COLUMNS.DONE]: {
    id: COLUMNS.DONE,
    name: 'DONE',
    items: [],
  },
  [COLUMNS.IGNORE]: {
    id: COLUMNS.IGNORE,
    name: 'IGNORE',
    items: [],
  },
  [COLUMNS.OTHERS]: {
    id: COLUMNS.OTHERS,
    name: 'OTHERS',
    items: [],
  },
};

// UI Constants
export const UI = {
  DRAG_THRESHOLD: 5,
  BLINK_DURATION: 500,
  MAX_TODO_LENGTH: 1000,
  MIN_DRAG_MOVEMENT: 2
};

// Error Messages
export const ERRORS = {
  INVALID_COLUMN: 'Invalid column ID',
  INVALID_ITEMS: 'Invalid item IDs',
  INVALID_DATA: 'Invalid data structure',
  STORAGE_ERROR: 'Error accessing local storage'
};

// Default State
export const DEFAULT_STATE = {
  version: CURRENT_VERSION,
  columns: DEFAULT_COLUMNS
}; 