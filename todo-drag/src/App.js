import React, { useState, useEffect, useRef, useCallback } from 'react';
import { DragDropContext, Draggable } from 'react-beautiful-dnd';
import './App.css';

import StrictModeDroppable from './components/StrictModeDroppable';
import SelectableItem from './components/SelectableItem';
import ProTipTooltip from './components/ProTipTooltip';
import MigrationOverlay from './components/MigrationOverlay';
import useQuickAdd from './hooks/useQuickAdd';
import { useColumnToggles } from './hooks/useColumnToggles';
import { findNearestColumn, getPreviousColumnId, startEditItem } from './utils/columnUtils';

// Define initial state outside component
const CURRENT_VERSION = '1.0.1';  // Increment this when data structure changes
const DEFAULT_STATE = {
  version: CURRENT_VERSION,
  columns: {
    do: {
      id: 'do',
      name: 'DO',
      items: [],
    },
    done: {
      id: 'done',
      name: 'DONE',
      items: [],
    },
    ignore: {
      id: 'ignore',
      name: 'IGNORE',
      items: [],
    },
    others: {
      id: 'others',
      name: 'OTHERS',
      items: [],
    },
    ember: {
      id: 'ember',
      name: 'EMBER',
      items: [],
    }
  }
};

// Column sequence for navigation
const COLUMN_SEQUENCE = ['do', 'ignore', 'others', 'ember'];

// Validate column structure
const validateColumnStructure = (column, defaultColumn) => {
  if (!column || typeof column !== 'object') return defaultColumn;
  
  return {
    id: column.id || defaultColumn.id,
    name: column.name || defaultColumn.name,
    items: Array.isArray(column.items) ? column.items.map(item => ({
      id: item.id || `id-${Date.now()}-${Math.random()}`,
      text: typeof item.text === 'string' ? item.text : '',
      completedAt: item.completedAt || undefined,
      nextContact: item.nextContact || (column.id === 'ember' ? 
        new Date(Date.now() + DEFAULT_RECONNECT_DAYS * 24 * 60 * 60 * 1000).toISOString() : 
        undefined),
      originalDays: item.originalDays || (column.id === 'ember' ? DEFAULT_RECONNECT_DAYS : undefined)
    })) : defaultColumn.items
  };
};

// Migrate data between versions
const migrateData = (oldData, oldVersion) => {
  let data = oldData;
  
  // Version migrations go here
  // Example:
  // if (oldVersion === '1.0.0') {
  //   // Migrate from 1.0.0 to 1.1.0
  //   data = {
  //     ...data,
  //     newField: defaultValue
  //   };
  //   oldVersion = '1.1.0';
  // }

  return {
    ...data,
    version: CURRENT_VERSION
  };
};

// Load initial state from localStorage with versioning and enhanced error recovery
const loadInitialState = () => {
  try {
    // Try to load from main storage first
    const saved = localStorage.getItem('my-todos');
    let parsed = null;

    if (saved) {
      try {
        parsed = JSON.parse(saved);
      } catch (parseError) {
        console.error('Error parsing main storage:', parseError);
        // Try to load from backup
        const backup = localStorage.getItem('my-todos-backup');
        if (backup) {
          try {
            parsed = JSON.parse(backup);
            // Restore main storage from backup
            localStorage.setItem('my-todos', backup);
          } catch (backupParseError) {
            console.error('Error parsing backup:', backupParseError);
          }
        }
      }
    }

    if (!parsed || typeof parsed !== 'object') {
      console.info('No valid saved data found, starting fresh');
      return { ...DEFAULT_STATE, needsMigration: false };
    }

    // Check version and migrate if needed
    if (!parsed.version || parsed.version !== CURRENT_VERSION) {
      console.info(`Data migration needed from version ${parsed.version || 'unknown'} to ${CURRENT_VERSION}`);
      return { 
        ...DEFAULT_STATE,
        columns: parsed.columns || DEFAULT_STATE.columns,
        needsMigration: true,
        oldData: parsed 
      };
    }

    // Deep validation of column structure
    const validatedColumns = {};
    let hasValidationErrors = false;

    for (const [key, defaultColumn] of Object.entries(DEFAULT_STATE.columns)) {
      try {
        validatedColumns[key] = validateColumnStructure(parsed.columns?.[key], defaultColumn);
      } catch (validationError) {
        console.error(`Validation error in column ${key}:`, validationError);
        validatedColumns[key] = defaultColumn;
        hasValidationErrors = true;
      }
    }

    // If we had validation errors but recovered, save the cleaned data
    if (hasValidationErrors) {
      const cleanedData = {
        version: CURRENT_VERSION,
        columns: validatedColumns,
        lastUpdated: new Date().toISOString()
      };
      localStorage.setItem('my-todos', JSON.stringify(cleanedData));
      localStorage.setItem('my-todos-backup', JSON.stringify(cleanedData));
    }

    return {
      version: CURRENT_VERSION,
      columns: validatedColumns,
      needsMigration: false,
      lastUpdated: parsed.lastUpdated || new Date().toISOString()
    };
  } catch (error) {
    console.error('Critical error loading from localStorage:', error);
    return { ...DEFAULT_STATE, needsMigration: false };
  }
};

// Add Ember-specific utilities
const DEFAULT_RECONNECT_DAYS = 30; // Default time until next reconnection

const calculateDaysFromNow = (date) => {
  const now = new Date();
  const targetDate = new Date(date);
  const diffTime = targetDate - now;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

const calculateOpacity = (daysFromNow) => {
  // Scale opacity from 1.0 (today) to 0.2 (furthest date)
  return Math.max(0.2, Math.min(1.0, 1 - (daysFromNow / (DEFAULT_RECONNECT_DAYS * 2))));
};

// Add this function before the App component
const startEmberEdit = (id, setEditingId) => {
  setEditingId(id);
};

function App() {
  const [isMigrating, setIsMigrating] = useState(false);
  const initialState = useRef(loadInitialState());
  
  // State declarations
  const [columns, setColumns] = useState(() => initialState.current.columns);
  const [selectedIds, setSelectedIds] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragEnd, setDragEnd] = useState({ x: 0, y: 0 });
  const [columnSearch, setColumnSearch] = useState({
    do: '',
    done: '',
    ignore: '',
    others: '',
    ember: ''  // Add ember search state
  });
  const [history, setHistory] = useState([]);
  const isUndoingRef = useRef(false);
  const dragStartPos = useRef(null);
  
  const [hasMoved, setHasMoved] = useState(false);
  const [hoveredColumn, setHoveredColumn] = useState(null);
  const [tipActionHandler, setTipActionHandler] = useState(null);
  const [clipboard, setClipboard] = useState([]);
  const [isCut, setIsCut] = useState(false);
  const [isRbdDragging, setIsRbdDragging] = useState(false);
  const [keyboardFocusedColumn, setKeyboardFocusedColumn] = useState(null);
  const [showDone, setShowDone] = useState(false);
  const [doneBlinking, setDoneBlinking] = useState(false);
  const [showIgnore, setShowIgnore] = useState(false);
  const [ignoreBlinking, setIgnoreBlinking] = useState(false);
  const [focusedItemId, setFocusedItemId] = useState(null);
  const [quickAddColumn, setQuickAddColumn] = useState(null);

  // Add new state for Ember
  const [emberHighlightedIndex, setEmberHighlightedIndex] = useState(-1);

  // Add new state for Ember editing
  const [emberEditingId, setEmberEditingId] = useState(null);
  const emberEditInputRef = useRef(null);

  // Add state for days editing
  const [emberDaysEditingId, setEmberDaysEditingId] = useState(null);
  const emberDaysInputRef = useRef(null);

  // Initialize column toggles
  const { toggleDoDone, toggleOthersIgnore, handleMigrationComplete } = useColumnToggles(
    setShowDone,
    setShowIgnore,
    setIsMigrating
  );

  // Notify tip system of completed actions
  const notifyTipAction = useCallback((action) => {
    if (tipActionHandler) {
      tipActionHandler(action);
    }
  }, [tipActionHandler]);

  // Handle column search
  const handleColumnSearch = useCallback((columnId, searchText) => {
    setColumnSearch(prev => ({
      ...prev,
      [columnId]: searchText
    }));
  }, []);

  // Save data to localStorage with validation, versioning, and error handling
  const saveToLocalStorage = useCallback((columns) => {
    try {
      if (!columns || typeof columns !== 'object') {
        throw new Error('Invalid data structure');
      }
      
      // Validate all columns before saving
      Object.entries(columns).forEach(([key, column]) => {
        if (!column || !column.items || !Array.isArray(column.items)) {
          throw new Error(`Invalid column structure for ${key}`);
        }
      });

      const dataToSave = {
        version: CURRENT_VERSION,
        columns: columns,
        lastUpdated: new Date().toISOString()
      };

      const serializedData = JSON.stringify(dataToSave);
      localStorage.setItem('my-todos', serializedData);

      // Optional: Save a backup copy
      localStorage.setItem('my-todos-backup', serializedData);

      return true;
    } catch (error) {
      console.error('Error saving to localStorage:', error);
      // Try to save to backup if main save fails
      try {
        const backupData = localStorage.getItem('my-todos-backup');
        if (backupData) {
          localStorage.setItem('my-todos', backupData);
        }
      } catch (backupError) {
        console.error('Backup recovery failed:', backupError);
      }
      return false;
    }
  }, []);

  // Wrap sanitizeItemText in useCallback
  const sanitizeItemText = useCallback((text) => {
    if (typeof text !== 'string') return '';
    return text.trim().slice(0, 1000); // Limit length to 1000 chars
  }, []);

  // Wrap filterItems in useCallback
  const filterItems = useCallback((items, columnId) => {
    const searchText = columnSearch[columnId];
    if (!searchText) return items;

    return items.filter(item => 
      item.text.toLowerCase().includes(searchText.toLowerCase())
    );
  }, [columnSearch]);

  // Handle Ember edit mode
  const handleEmberEditComplete = useCallback((itemId, newText) => {
    // Remove items that are empty or just whitespace
    if (!newText || !newText.trim()) {
      setColumns(prev => {
        const updated = { ...prev };
        const emberColumn = { ...updated.ember };
        emberColumn.items = emberColumn.items.filter(i => i.id !== itemId);
        updated.ember = emberColumn;
        return updated;
      });
    } else {
      setColumns(prev => {
        const updated = { ...prev };
        const emberColumn = { ...updated.ember };
        emberColumn.items = emberColumn.items.map(item => 
          item.id === itemId ? { ...item, text: newText } : item
        );
        updated.ember = emberColumn;
        return updated;
      });
    }
    setEmberEditingId(null);
  }, []);

  // Handle Ember reset with original days
  const handleEmberReset = useCallback((itemId) => {
    setColumns(prev => {
      const updated = { ...prev };
      const emberColumn = { ...updated.ember };
      emberColumn.items = emberColumn.items.map(item => 
        item.id === itemId ? 
          { 
            ...item, 
            nextContact: new Date(Date.now() + (item.originalDays || DEFAULT_RECONNECT_DAYS) * 24 * 60 * 60 * 1000).toISOString() 
          } : 
          item
      );
      updated.ember = emberColumn;
      return updated;
    });
  }, []);

  // Handle days editing with original days storage
  const handleEmberDaysEditComplete = useCallback((itemId, days) => {
    setColumns(prev => {
      const updated = { ...prev };
      const emberColumn = { ...updated.ember };
      emberColumn.items = emberColumn.items.map(item => 
        item.id === itemId ? 
          { 
            ...item, 
            nextContact: new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString(),
            originalDays: days
          } : 
          item
      );
      updated.ember = emberColumn;
      return updated;
    });
    setEmberDaysEditingId(null);
  }, []);

  // Add new Ember contact with original days
  const handleAddEmberContact = useCallback(() => {
    const newItemId = `id-${Date.now()}-${Math.random()}`;
    setColumns(prev => {
      const updated = { ...prev };
      const emberColumn = { ...updated.ember };
      const newItem = {
        id: newItemId,
        text: '',
        nextContact: new Date(Date.now() + DEFAULT_RECONNECT_DAYS * 24 * 60 * 60 * 1000).toISOString(),
        originalDays: DEFAULT_RECONNECT_DAYS
      };
      emberColumn.items = [newItem, ...emberColumn.items];  // Add to the beginning
      updated.ember = emberColumn;
      return updated;
    });
    // Set editing state and focus input immediately
    setEmberEditingId(newItemId);
    // Use a small timeout to ensure the input is rendered
    setTimeout(() => {
      if (emberEditInputRef.current) {
        emberEditInputRef.current.focus();
      }
    }, 0);
  }, []);

  // Add cleanup effect for Ember state
  useEffect(() => {
    return () => {
      setEmberHighlightedIndex(-1);
      setEmberEditingId(null);
      setEmberDaysEditingId(null);
    };
  }, []);

  // Handle Ember keyboard navigation
  useEffect(() => {
    const handleEmberKeyboard = (e) => {
      try {
        // Prevent handling if we're in an input field (except for Escape)
        if (e.target.tagName === 'INPUT' && e.key !== 'Escape') return;
        if (e.target.tagName === 'TEXTAREA') return;

        // Only handle keyboard events if we have a highlighted item or are in edit mode
        if (emberHighlightedIndex === -1 && !emberEditingId) return;
        
        // If in edit mode, handle Escape and Enter
        if (emberEditingId) {
          if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            // Always remove empty items when escaping
            setColumns(prev => {
              try {
                const item = prev.ember.items.find(i => i.id === emberEditingId);
                if (item && (!item.text || !item.text.trim())) {
                  const updated = { ...prev };
                  const emberColumn = { ...updated.ember };
                  emberColumn.items = emberColumn.items.filter(i => i.id !== emberEditingId);
                  updated.ember = emberColumn;
                  return updated;
                }
                return prev;
              } catch (error) {
                console.error('Error handling Escape in edit mode:', error);
                return prev;
              }
            });
            setEmberEditingId(null);
            setEmberHighlightedIndex(-1); // Clear highlight when escaping edit mode
            return;
          }
          if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            const input = emberEditInputRef.current;
            if (input) {
              if (!input.value.trim()) {
                // Remove empty items
                setColumns(prev => {
                  try {
                    const updated = { ...prev };
                    const emberColumn = { ...updated.ember };
                    emberColumn.items = emberColumn.items.filter(i => i.id !== emberEditingId);
                    updated.ember = emberColumn;
                    return updated;
                  } catch (error) {
                    console.error('Error handling Enter with empty input:', error);
                    return prev;
                  }
                });
              } else {
                handleEmberEditComplete(emberEditingId, input.value);
              }
            }
            setEmberEditingId(null);
            return;
          }
          return;
        }

        const emberItems = columns.ember.items;
        if (!emberItems?.length) return;

        switch (e.key.toLowerCase()) {
          case 'e':
            e.preventDefault();
            e.stopPropagation();
            if (emberHighlightedIndex >= 0 && emberHighlightedIndex < emberItems.length) {
              const item = emberItems[emberHighlightedIndex];
              handleEmberReset(item.id);
            }
            break;
          case 'enter':
            e.preventDefault();
            e.stopPropagation();
            if (emberHighlightedIndex >= 0 && emberHighlightedIndex < emberItems.length) {
              const item = emberItems[emberHighlightedIndex];
              startEmberEdit(item.id, setEmberEditingId);
            }
            break;
          case 'delete':        // Forward delete on Mac
          case 'del':          // Delete on some keyboards
          case 'backspace':    // Backspace
            if (emberHighlightedIndex >= 0 && emberHighlightedIndex < emberItems.length) {
              e.preventDefault();
              e.stopPropagation();
              const itemId = emberItems[emberHighlightedIndex].id;
              setColumns(prev => {
                try {
                  const updated = { ...prev };
                  const emberColumn = { ...updated.ember };
                  emberColumn.items = emberColumn.items.filter(i => i.id !== itemId);
                  updated.ember = emberColumn;
                  return updated;
                } catch (error) {
                  console.error('Error handling delete:', error);
                  return prev;
                }
              });
              // Adjust highlighted index if needed
              if (emberHighlightedIndex >= emberItems.length - 1) {
                setEmberHighlightedIndex(prev => Math.max(0, prev - 1));
              }
            }
            break;
          case 'escape':
            e.preventDefault();
            e.stopPropagation();
            // Clear highlight state when Escape is pressed
            setEmberHighlightedIndex(-1);
            break;
          case 'j':
            e.preventDefault();
            e.stopPropagation();
            setEmberHighlightedIndex(prev => 
              prev < emberItems.length - 1 ? prev + 1 : prev);
            break;
          case 'k':
            e.preventDefault();
            e.stopPropagation();
            setEmberHighlightedIndex(prev => 
              prev > 0 ? prev - 1 : prev);
            break;
          default:
            break;
        }
      } catch (error) {
        console.error('Error in Ember keyboard handler:', error);
        // Reset state on error
        setEmberHighlightedIndex(-1);
        setEmberEditingId(null);
      }
    };

    // Use capture phase to ensure our handler runs first
    window.addEventListener('keydown', handleEmberKeyboard, true);
    return () => window.removeEventListener('keydown', handleEmberKeyboard, true);
  }, [
    columns,
    emberEditingId,
    emberHighlightedIndex,
    handleEmberEditComplete,
    handleEmberReset,
    setEmberEditingId,
    setEmberHighlightedIndex
  ]);

  // Update localStorage save effect to include ember column data
  useEffect(() => {
    let isMounted = true;

    const saveData = async () => {
      if (!isUndoingRef.current && isMounted) {
        const savedSuccessfully = saveToLocalStorage(columns);
        if (!savedSuccessfully && isMounted) {
          console.warn('Failed to save to localStorage. Your changes may not persist.');
        }
      }
    };

    saveData();

    return () => {
      isMounted = false;
      if (!isUndoingRef.current) {
        // Ensure final state is saved before unmounting
        saveToLocalStorage(columns);
      }
    };
  }, [columns, saveToLocalStorage, isUndoingRef]);

  // Update history when columns change
  useEffect(() => {
    if (!isUndoingRef.current) {
      setHistory(prev => [...prev, JSON.stringify(columns)]);
    }
  }, [columns]);

  // Handle undo
  const handleUndo = useCallback(() => {
    setHistory(prev => {
      if (prev.length < 2) return prev; // Need at least 2 items to undo (current + previous)
      
      const newHistory = prev.slice(0, -1);
      isUndoingRef.current = true;
      
      // Restore the previous state
      const previousState = JSON.parse(newHistory[newHistory.length - 1]);
      setColumns(previousState);
      
      // Reset the undo flag after a short delay
      setTimeout(() => {
        isUndoingRef.current = false;
      }, 0);
      
      return newHistory;
    });
  }, [setColumns]);

  // Add keyboard shortcut for undo
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        handleUndo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo]);

  // Handle item selection
  const toggleSelection = (itemId, e) => {
    if (e.shiftKey) {
      setSelectedIds(prev => {
        if (prev.includes(itemId)) {
          return prev.filter(id => id !== itemId);
        } else {
          return [...prev, itemId];
        }
      });
    } else {
      // If not holding shift, either add to selection or make it the only selection
      setSelectedIds(prev => {
        if (prev.includes(itemId)) {
          return prev.length === 1 ? [] : [itemId];
        } else {
          return [itemId];
        }
      });
    }
  };

  // Update hover handling to clear keyboard focus only when mouse moves
  const handleColumnHover = useCallback((columnId) => {
    // Only prevent hover updates during drag operations
    if (isDragging) return;
    
    // Only clear keyboard focus if the mouse actually moved
    if (columnId !== hoveredColumn) {
      setKeyboardFocusedColumn(null);
    }
    setHoveredColumn(columnId);
  }, [isDragging, hoveredColumn]);

  // Get effective column (keyboard focus takes precedence over hover)
  const getEffectiveColumn = useCallback(() => {
    return keyboardFocusedColumn || hoveredColumn;
  }, [keyboardFocusedColumn, hoveredColumn]);

  // Handle mouse movement to clear keyboard focus and handle drag selection
  const handleMouseMove = useCallback((e) => {
    // Clear keyboard focus when mouse moves significantly
    if (keyboardFocusedColumn) {
      const movementThreshold = 5;
      if (Math.abs(e.movementX) > movementThreshold || Math.abs(e.movementY) > movementThreshold) {
        setKeyboardFocusedColumn(null);
      }
    }

    if (!isDragging || isRbdDragging) return;
    
    setDragEnd({ x: e.clientX, y: e.clientY });
    
    // Calculate selection box coordinates
    const box = {
      left: Math.min(dragStart.x, e.clientX),
      right: Math.max(dragStart.x, e.clientX),
      top: Math.min(dragStart.y, e.clientY),
      bottom: Math.max(dragStart.y, e.clientY)
    };

    // Only update selection if we've moved enough to consider it a drag
    const hasDraggedEnough = Math.abs(dragStart.x - e.clientX) > 5 || Math.abs(dragStart.y - e.clientY) > 5;
    
    if (hasDraggedEnough) {
      // Get all todo items that are currently visible
      const items = Array.from(document.querySelectorAll('.todo-item:not([style*="display: none"]'));
      
      // Determine which items intersect with the selection box
      const intersectingIds = items
        .filter(item => {
          const rect = item.getBoundingClientRect();
          return !(rect.right < box.left || 
                  rect.left > box.right || 
                  rect.bottom < box.top || 
                  rect.top > box.bottom);
        })
        .map(item => item.getAttribute('data-id'))
        .filter(Boolean);

      // Update selection based on shift key
      setSelectedIds(prev => {
        const baseSelection = e.shiftKey ? prev : [];
        return Array.from(new Set([...baseSelection, ...intersectingIds]));
      });
      
      if (!hasMoved) {
        setHasMoved(true);
      }
    }
  }, [isDragging, isRbdDragging, dragStart, hasMoved, keyboardFocusedColumn, setKeyboardFocusedColumn, setDragEnd, setSelectedIds, setHasMoved]);

  // Handle drag select start
  const handleMouseDown = (e) => {
    // Only handle left clicks on the container and not on interactive elements
    if (e.button !== 0 || 
        !e.target.closest('.app-container') || 
        isRbdDragging ||
        e.target.closest('input, textarea, [role="button"]')) return;
    
    // Clear selection if not holding shift
    if (!e.shiftKey) {
      setSelectedIds([]);
    }
    
    setIsDragging(true);
    setHasMoved(false);
    setDragStart({ x: e.clientX, y: e.clientY });
    setDragEnd({ x: e.clientX, y: e.clientY });
  };

  // Handle drag select end
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Add mouse event listeners
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Clean up drag state on unmount
  useEffect(() => {
    return () => {
      setIsDragging(false);
      setHasMoved(false);
    };
  }, []);

  // Handle keyboard navigation and shortcuts
  useEffect(() => {
    const handleKeyboard = (e) => {
      try {
        // Don't handle if we're in an input field
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        const currentColumn = getEffectiveColumn();
        if (!currentColumn) return;

        // Get visible items in current column
        const currentItems = filterItems(columns[currentColumn].items, currentColumn);
        if (!currentItems?.length) return;

        const currentIndex = focusedItemId 
          ? currentItems.findIndex(item => item.id === focusedItemId)
          : -1;

        switch (e.key.toLowerCase()) {
          case 'j':
          case 'arrowdown': {
            e.preventDefault();
            e.stopPropagation();
            let newIndex = currentIndex;
            if (currentIndex < currentItems.length - 1) {
              newIndex = currentIndex + 1;
            } else if (currentIndex === -1) {
              newIndex = 0;
            }
            if (newIndex !== currentIndex) {
              setFocusedItemId(currentItems[newIndex].id);
              // If in Ember column, also update highlight
              if (currentColumn === 'ember') {
                setEmberHighlightedIndex(newIndex);
              }
            }
            break;
          }
          case 'k':
          case 'arrowup': {
            e.preventDefault();
            e.stopPropagation();
            let newIndex = currentIndex;
            if (currentIndex > 0) {
              newIndex = currentIndex - 1;
            } else if (currentIndex === -1) {
              newIndex = currentItems.length - 1;
            }
            if (newIndex !== currentIndex) {
              setFocusedItemId(currentItems[newIndex].id);
              // If in Ember column, also update highlight
              if (currentColumn === 'ember') {
                setEmberHighlightedIndex(newIndex);
              }
            }
            break;
          }
          case 'd':
          case 'delete':
          case 'backspace': {
            // Only handle if we have a focused item or selected items
            if (!focusedItemId && selectedIds.length === 0) return;
            
            e.preventDefault();
            e.stopPropagation();
            
            try {
              setColumns(prev => {
                const updated = { ...prev };
                const col = { ...updated[currentColumn] };
                
                // Determine which items to delete
                const itemsToDelete = selectedIds.length > 0 
                  ? selectedIds 
                  : [focusedItemId];
                
                // Find the index of the first item to be deleted
                const firstDeleteIndex = currentItems.findIndex(
                  item => itemsToDelete.includes(item.id)
                );
                
                // Remove the items
                col.items = col.items.filter(
                  item => !itemsToDelete.includes(item.id)
                );
                updated[currentColumn] = col;

                // Update focus to next available item
                const remainingItems = filterItems(col.items, currentColumn);
                if (remainingItems.length > 0) {
                  const nextIndex = Math.min(firstDeleteIndex, remainingItems.length - 1);
                  const nextItem = remainingItems[nextIndex];
                  
                  // Schedule focus update after state change
                  setTimeout(() => {
                    setFocusedItemId(nextItem.id);
                    if (currentColumn === 'ember') {
                      setEmberHighlightedIndex(nextIndex);
                    }
                  }, 0);
                } else {
                  // No items left, clear focus
                  setTimeout(() => {
                    setFocusedItemId(null);
                    if (currentColumn === 'ember') {
                      setEmberHighlightedIndex(-1);
                    }
                  }, 0);
                }

                return updated;
              });

              // Clear selection after delete
              setSelectedIds([]);
              
            } catch (error) {
              console.error('Error during delete operation:', error);
              // Provide user feedback
              // You might want to add a toast notification system here
            }
            break;
          }
          case 'escape': {
            e.preventDefault();
            e.stopPropagation();
            setFocusedItemId(null);
            setSelectedIds([]);
            if (currentColumn === 'ember') {
              setEmberHighlightedIndex(-1);
            }
            break;
          }
          default: {
            // Handle any other keys if needed
            break;
          }
        }
      } catch (error) {
        console.error('Error in keyboard handler:', error);
        // Reset state on error
        setFocusedItemId(null);
        setEmberHighlightedIndex(-1);
        setSelectedIds([]);
      }
    };

    window.addEventListener('keydown', handleKeyboard);
    return () => window.removeEventListener('keydown', handleKeyboard);
  }, [
    columns,
    focusedItemId,
    selectedIds,
    getEffectiveColumn,
    filterItems,
    setFocusedItemId,
    setEmberHighlightedIndex,
    setSelectedIds,
    setColumns
  ]);

  // Add keyboard event listener for delete
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't handle if we're in an input field
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      
      // Don't handle delete if we have a highlighted Ember item
      if (emberHighlightedIndex >= 0) return;
      
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.length > 0) {
        e.preventDefault();
        e.stopPropagation();
        // Delete all selected items
        setColumns(prev => {
          const updated = { ...prev };
          // Remove selected items from all columns
          Object.keys(updated).forEach((colId) => {
            const col = { ...updated[colId] };
            col.items = col.items.filter(item => !selectedIds.includes(item.id));
            updated[colId] = col;
          });
          return updated;
        });
        // Clear selection after delete
        setSelectedIds([]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIds, emberHighlightedIndex, setColumns, setSelectedIds]);

  // Add keyboard event listeners for cut/copy/paste and tab navigation
  useEffect(() => {
    let isMounted = true;

    const handleKeyDown = (e) => {
      try {
        // Ignore if in input field or textarea
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        if (e.key === 'Tab') {
          e.preventDefault();
          e.stopPropagation();
          
          const currentColumn = getEffectiveColumn() || COLUMN_SEQUENCE[0];
          if (!COLUMN_SEQUENCE.includes(currentColumn)) {
            console.error('Invalid column:', currentColumn);
            return;
          }

          const currentIndex = COLUMN_SEQUENCE.indexOf(currentColumn);
          
          // Calculate next column index based on shift key
          const nextIndex = e.shiftKey
            ? (currentIndex - 1 + COLUMN_SEQUENCE.length) % COLUMN_SEQUENCE.length
            : (currentIndex + 1) % COLUMN_SEQUENCE.length;
          
          const nextColumn = COLUMN_SEQUENCE[nextIndex];
          if (isMounted) {
            setKeyboardFocusedColumn(nextColumn);
          }
          
          // If moving to Ember column, add new contact
          if (nextColumn === 'ember') {
            handleAddEmberContact();
          }
          
          // Scroll the column into view if needed
          try {
            const columnElement = document.getElementById(`column-${nextColumn}`);
            if (columnElement) {
              columnElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
          } catch (scrollError) {
            console.error('Error scrolling to column:', scrollError);
          }
        }
      } catch (error) {
        console.error('Error in keyboard handler:', error);
        // Reset state on error
        if (isMounted) {
          setKeyboardFocusedColumn(null);
        }
      }
    };

    const handleGlobalKeyPress = (e) => {
      try {
        // Ignore if in input field or textarea
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        
        // Handle Command+A (or Ctrl+A) for selecting all items in hovered column
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a' && getEffectiveColumn()) {
          e.preventDefault();
          e.stopPropagation();
          
          const column = getEffectiveColumn();
          if (!column) return;

          const columnItems = columns[column]?.items;
          if (!columnItems?.length) return;

          const itemIds = columnItems.map(item => item.id);
          if (isMounted) {
            setSelectedIds(itemIds);
            notifyTipAction('select-all');
          }
          return;
        }
        
        // Only trigger for printable characters and ignore modifier keys
        if (getEffectiveColumn() && e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
          e.preventDefault();
          e.stopPropagation();
          
          if (isMounted) {
            setQuickAddColumn(getEffectiveColumn());
          }
          
          // Small delay to ensure input is focused
          setTimeout(() => {
            if (!isMounted) return;
            try {
              const input = document.querySelector('.quick-add-input');
              if (input) {
                input.value = e.key;
                input.focus();
              }
            } catch (focusError) {
              console.error('Error focusing quick add input:', focusError);
            }
          }, 0);
        }
      } catch (error) {
        console.error('Error in global key press handler:', error);
        // Reset state on error
        if (isMounted) {
          setQuickAddColumn(null);
          setSelectedIds([]);
        }
      }
    };

    window.addEventListener('keypress', handleGlobalKeyPress, true);
    window.addEventListener('keydown', handleKeyDown, true);

    return () => {
      isMounted = false;
      window.removeEventListener('keypress', handleGlobalKeyPress, true);
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [
    getEffectiveColumn,
    columns,
    notifyTipAction,
    setSelectedIds,
    setQuickAddColumn,
    setKeyboardFocusedColumn,
    handleAddEmberContact
  ]);

  // Handle copy operation
  const handleCopy = useCallback(() => {
    if (selectedIds.length === 0) return;
    
    const itemsToCopy = [];
    Object.values(columns).forEach(column => {
      column.items.forEach(item => {
        if (selectedIds.includes(item.id)) {
          itemsToCopy.push({ ...item, originalId: item.id, id: `id-${Date.now()}-${Math.random()}` });
        }
      });
    });
    
    setClipboard(itemsToCopy);
    setIsCut(false);
    notifyTipAction('copy');
  }, [selectedIds, columns, notifyTipAction]);

  // Handle cut operation
  const handleCut = useCallback(() => {
    if (selectedIds.length === 0) return;
    
    handleCopy();
    setIsCut(true);
    
    // Remove cut items
    setColumns(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach((colId) => {
        updated[colId] = {
          ...updated[colId],
          items: updated[colId].items.filter(item => !selectedIds.includes(item.id))
        };
      });
      
      setSelectedIds([]);
      notifyTipAction('cut');
      return updated;
    });
  }, [selectedIds, handleCopy, notifyTipAction]);

  // Handle paste operation
  const handleClipboardPaste = useCallback(() => {
    const targetColumn = getEffectiveColumn();
    if (clipboard.length === 0 || !targetColumn) return;
    
    setColumns(prev => {
      const updated = { ...prev };
      const targetColumnData = updated[targetColumn];
      
      // Create new items with fresh IDs
      const newItems = clipboard.map(item => ({
        ...item,
        id: `id-${Date.now()}-${Math.random()}`,
        completedAt: targetColumn === 'done' ? new Date().toISOString() : undefined
      }));
      
      updated[targetColumn] = {
        ...targetColumnData,
        items: targetColumn === 'done' ? 
          [...newItems, ...targetColumnData.items] :
          [...targetColumnData.items, ...newItems]
      };
      
      return updated;
    });
    
    // Clear clipboard if this was a cut operation
    if (isCut) {
      setClipboard([]);
      setIsCut(false);
    }
    
    notifyTipAction('paste');
  }, [clipboard, getEffectiveColumn, isCut, notifyTipAction]);

  // Add keyboard event listeners for cut/copy/paste
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore if we're in an input field or textarea
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey) {
        switch (e.key.toLowerCase()) {
          case 'x':
            e.preventDefault();
            handleCut();
            break;
          case 'c':
            e.preventDefault();
            handleCopy();
            break;
          case 'v':
            e.preventDefault();
            handleClipboardPaste();
            break;
          default:
            break;
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleCut, handleCopy, handleClipboardPaste]);

  // Update renderEmberItem to include days editing
  const renderEmberItem = (item, index) => {
    const daysFromNow = calculateDaysFromNow(item.nextContact);
    const opacity = calculateOpacity(daysFromNow);
    const isEditing = emberEditingId === item.id;
    const isDaysEditing = emberDaysEditingId === item.id;
    
    return (
      <div
        key={item.id}
        className={`ember-item ${index === emberHighlightedIndex ? 'highlighted' : ''} ${isEditing ? 'editing' : ''}`}
        style={{ 
          opacity,
          backgroundColor: index === emberHighlightedIndex ? '#2a2a2a' : 'transparent'
        }}
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey) {
            handleEmberReset(item.id);
          } else if (!item.text) {
            // Start editing if item is unnamed
            startEmberEdit(item.id, setEmberEditingId);
          }
        }}
      >
        {isEditing ? (
          <input
            ref={emberEditInputRef}
            defaultValue={item.text}
            onBlur={(e) => handleEmberEditComplete(item.id, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                handleEmberEditComplete(item.id, e.target.value);
                setEmberDaysEditingId(item.id);
                setTimeout(() => {
                  if (emberDaysInputRef.current) {
                    emberDaysInputRef.current.focus();
                    emberDaysInputRef.current.select();
                  }
                }, 0);
              } else if (e.key === 'Escape') {
                setEmberEditingId(null);
              }
            }}
          />
        ) : (
          <>
            <span 
              onClick={(e) => {
                e.stopPropagation();
                startEmberEdit(item.id, setEmberEditingId);
              }}
              style={{
                cursor: 'text',
                color: item.text ? 'inherit' : '#666'
              }}
            >
              {item.text || '<unnamed>'}
            </span>
            {isDaysEditing ? (
              <input
                ref={emberDaysInputRef}
                className="ember-days-edit"
                defaultValue={daysFromNow}
                onBlur={(e) => {
                  const days = parseInt(e.target.value, 10);
                  if (!isNaN(days) && days > 0) {
                    handleEmberDaysEditComplete(item.id, days);
                  } else {
                    setEmberDaysEditingId(null);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === 'Tab') {
                    e.preventDefault();
                    const days = parseInt(e.target.value, 10);
                    if (!isNaN(days) && days > 0) {
                      handleEmberDaysEditComplete(item.id, days);
                    } else {
                      setEmberDaysEditingId(null);
                    }
                  } else if (e.key === 'Escape') {
                    setEmberDaysEditingId(null);
                  }
                }}
              />
            ) : (
              <span 
                style={{ color: '#666' }}
                onClick={(e) => {
                  e.stopPropagation();
                  setEmberDaysEditingId(item.id);
                  setTimeout(() => {
                    if (emberDaysInputRef.current) {
                      emberDaysInputRef.current.focus();
                      emberDaysInputRef.current.select();
                    }
                  }, 0);
                }}
              >
                {daysFromNow}d
              </span>
            )}
          </>
        )}
      </div>
    );
  };

  // Add todo handler
  const addTodo = useCallback((text, columnId) => {
    setColumns(prev => {
      const updated = { ...prev };
      const newItem = {
        id: `id-${Date.now()}-${Math.random()}`,
        text: text,
        completedAt: columnId === 'done' ? new Date().toISOString() : undefined
      };
      
      updated[columnId] = {
        ...updated[columnId],
        items: columnId === 'done' 
          ? [newItem, ...updated[columnId].items]
          : [...updated[columnId].items, newItem]
      };
      
      return updated;
    });
  }, []);

  // Initialize quick add functionality
  const {
    quickAddInputRef,
    handleQuickAddKeyDown,
    handleQuickAddBlur,
    renderQuickAddInput,
    startEditItem,
    getPreviousColumnId
  } = useQuickAdd({
    addTodo,
    columns,
    quickAddColumn,
    setQuickAddColumn
  });

  // Update renderDraggableItem to show focus state
  const renderDraggableItem = useCallback((provided, snapshot, item, columnId) => (
    <div
      ref={provided.innerRef}
      {...provided.draggableProps}
      {...provided.dragHandleProps}
      className={`todo-item-wrapper ${selectedIds.includes(item.id) ? 'selected' : ''} ${focusedItemId === item.id ? 'keyboard-focused' : ''}`}
      data-id={item.id}
    >
      <SelectableItem
        item={item}
        isSelected={selectedIds.includes(item.id)}
        isFocused={focusedItemId === item.id}
        onClick={(e) => {
          if (e.shiftKey) {
            toggleSelection(item.id, e);
          } else if (e.metaKey || e.ctrlKey) {
            // Command/Ctrl+click to move to DONE from any column
            if (columnId !== 'done') {
              setDoneBlinking(true);
              setTimeout(() => setDoneBlinking(false), 500);
              
              setColumns(prev => {
                const updated = { ...prev };
                const now = new Date().toISOString();
                
                // Remove item from current column
                const sourceColumn = { ...updated[columnId] };
                const [movedItem] = sourceColumn.items.filter(i => i.id === item.id);
                sourceColumn.items = sourceColumn.items.filter(i => i.id !== item.id);
                updated[columnId] = sourceColumn;

                // Add to DONE column with timestamp
                const doneColumn = { ...updated.done };
                doneColumn.items = [
                  { ...movedItem, completedAt: now },
                  ...doneColumn.items
                ];
                updated.done = doneColumn;
                
                return updated;
              });
              setSelectedIds([]);
              notifyTipAction('cmd-click-move');
            }
          } else {
            // Regular click just focuses the item
            setFocusedItemId(item.id);
          }
        }}
        onUpdate={(newText) => {
          setColumns(prev => {
            const updated = { ...prev };
            const column = { ...updated[columnId] };
            column.items = column.items.map(i => 
              i.id === item.id ? { ...i, text: newText } : i
            );
            updated[columnId] = column;
            return updated;
          });
        }}
        columnId={columnId}
      />
    </div>
  ), [selectedIds, focusedItemId, setColumns, setSelectedIds, setFocusedItemId, setDoneBlinking, notifyTipAction]);

  return (
    <>
      {isMigrating && <MigrationOverlay onComplete={handleMigrationComplete} />}
      <DragDropContext 
        onDragStart={(start) => {
          setIsRbdDragging(true);
          if (start.client) {
            dragStartPos.current = start.client;
          }
        }}
        onDragEnd={(result) => {
          setIsRbdDragging(false);
          if (!result) return;

          const { source } = result;
          let finalDestination = result.destination;

          // If no destination, try to find nearest column
          if (!finalDestination && result.client) {
            const predictedColumn = findNearestColumn(source.droppableId, result.client);
            if (predictedColumn) {
              finalDestination = {
                droppableId: predictedColumn,
                index: 0  // Add to top of predicted column
              };
            }
          }

          // Reset drag tracking
          dragStartPos.current = null;

          // Validate source and destination
          if (!source || !COLUMN_SEQUENCE.includes(source.droppableId)) {
            throw new Error('Invalid source');
          }

          // If no destination or same location, no action needed
          if (!finalDestination || 
              (finalDestination.droppableId === source.droppableId && 
               finalDestination.index === source.index)) {
            return;
          }

          // Validate destination
          if (!COLUMN_SEQUENCE.includes(finalDestination.droppableId)) {
            throw new Error('Invalid destination');
          }

          setColumns(prev => {
            if (!prev || !prev[source.droppableId] || !prev[finalDestination.droppableId]) {
              return prev;
            }

            const updated = { ...prev };
            const sourceColumn = { ...updated[source.droppableId] };
            const destColumn = { ...updated[finalDestination.droppableId] };

            // Find the item being moved
            const [movedItem] = sourceColumn.items.splice(source.index, 1);
            if (!movedItem) return prev;

            // Update timestamp if moving to DONE column
            const updatedItem = {
              ...movedItem,
              completedAt: finalDestination.droppableId === 'done' ? 
                (movedItem.completedAt || new Date().toISOString()) : undefined
            };

            // Insert at new position
            destColumn.items.splice(finalDestination.index, 0, updatedItem);

            updated[source.droppableId] = sourceColumn;
            updated[finalDestination.droppableId] = destColumn;

            return updated;
          });

          if (finalDestination && finalDestination.droppableId !== source.droppableId) {
            notifyTipAction('drag-move');
          }
        }}
      >
        <div 
          className={`app-container ${isRbdDragging ? 'dragging-in-progress' : ''}`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
        >
          <ProTipTooltip onAction={setTipActionHandler} />
          
          {/* Show selection box while dragging but not during item drag */}
          {isDragging && !isRbdDragging && (
            <div
              className="selection-box"
              style={{
                position: 'fixed',
                left: Math.min(dragStart.x, dragEnd.x),
                top: Math.min(dragStart.y, dragEnd.y),
                width: Math.abs(dragEnd.x - dragStart.x),
                height: Math.abs(dragEnd.y - dragStart.y),
              }}
            />
          )}
          
          <div className="columns">
            {/* DO/DONE Column */}
            <div 
              className={`column ${keyboardFocusedColumn === (showDone ? 'done' : 'do') ? 'keyboard-focused' : ''}`}
            >
              <h2 
                onClick={toggleDoDone}
                className={getEffectiveColumn() === (showDone ? 'done' : 'do') ? 'hovered' : ''}
              >
                {showDone ? (
                  <>
                    <span className="done-text">DO</span> / <span className={doneBlinking ? 'blink-done' : ''}>DONE</span>
                  </>
                ) : (
                  <>
                    DO / <span className={`done-text ${doneBlinking ? 'blink-done' : ''}`}>DONE</span>
                  </>
                )}
              </h2>
              <input
                className="column-search"
                placeholder="🔍"
                value={columnSearch[showDone ? 'done' : 'do']}
                onChange={(e) => handleColumnSearch(showDone ? 'done' : 'do', e.target.value)}
              />
              <StrictModeDroppable droppableId={showDone ? 'done' : 'do'}>
                {(provided, snapshot) => (
                  <div
                    id={`column-${showDone ? 'done' : 'do'}`}
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`droppable-area ${snapshot.isDraggingOver ? 'dragging-over' : ''}`}
                    onMouseEnter={() => handleColumnHover(showDone ? 'done' : 'do')}
                    onMouseLeave={() => handleColumnHover(null)}
                  >
                    {filterItems(columns[showDone ? 'done' : 'do'].items, showDone ? 'done' : 'do').map((item, index) => (
                      <Draggable 
                        key={item.id} 
                        draggableId={item.id} 
                        index={index}
                      >
                        {(provided, snapshot) => renderDraggableItem(provided, snapshot, item, showDone ? 'done' : 'do')}
                      </Draggable>
                    ))}
                    {getEffectiveColumn() === (showDone ? 'done' : 'do') && !quickAddColumn && (
                      <div 
                        className="cursor-line"
                        onClick={() => setQuickAddColumn(showDone ? 'done' : 'do')}
                      />
                    )}
                    {renderQuickAddInput(showDone ? 'done' : 'do')}
                    {provided.placeholder}
                  </div>
                )}
              </StrictModeDroppable>
            </div>

            {/* OTHERS/IGNORE Column */}
            <div 
              className={`column ${keyboardFocusedColumn === (showIgnore ? 'ignore' : 'others') ? 'keyboard-focused' : ''}`}
            >
              <h2 
                onClick={toggleOthersIgnore}
                className={getEffectiveColumn() === (showIgnore ? 'ignore' : 'others') ? 'hovered' : ''}
              >
                {showIgnore ? (
                  <>
                    <span className="ignore-text">OTHERS</span> / <span className={ignoreBlinking ? 'blink-ignore' : ''}>IGNORE</span>
                  </>
                ) : (
                  <>
                    OTHERS / <span className={`ignore-text ${ignoreBlinking ? 'blink-ignore' : ''}`}>IGNORE</span>
                  </>
                )}
              </h2>
              <input
                className="column-search"
                placeholder="🔍"
                value={columnSearch[showIgnore ? 'ignore' : 'others']}
                onChange={(e) => handleColumnSearch(showIgnore ? 'ignore' : 'others', e.target.value)}
              />
              <StrictModeDroppable droppableId={showIgnore ? 'ignore' : 'others'}>
                {(provided, snapshot) => (
                  <div
                    id={`column-${showIgnore ? 'ignore' : 'others'}`}
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`droppable-area ${snapshot.isDraggingOver ? 'dragging-over' : ''}`}
                    onMouseEnter={() => handleColumnHover(showIgnore ? 'ignore' : 'others')}
                    onMouseLeave={() => handleColumnHover(null)}
                  >
                    {filterItems(columns[showIgnore ? 'ignore' : 'others'].items, showIgnore ? 'ignore' : 'others').map((item, index) => (
                      <Draggable 
                        key={item.id} 
                        draggableId={item.id} 
                        index={index}
                      >
                        {(provided, snapshot) => renderDraggableItem(provided, snapshot, item, showIgnore ? 'ignore' : 'others')}
                      </Draggable>
                    ))}
                    {getEffectiveColumn() === (showIgnore ? 'ignore' : 'others') && !quickAddColumn && (
                      <div 
                        className="cursor-line"
                        onClick={() => setQuickAddColumn(showIgnore ? 'ignore' : 'others')}
                      />
                    )}
                    {renderQuickAddInput(showIgnore ? 'ignore' : 'others')}
                    {provided.placeholder}
                  </div>
                )}
              </StrictModeDroppable>
            </div>

            {/* Ember Column */}
            <div 
              className={`column ${keyboardFocusedColumn === 'ember' ? 'keyboard-focused' : ''}`}
              style={{ minWidth: '250px' }}
            >
              <h2 className={getEffectiveColumn() === 'ember' ? 'hovered' : ''}>
                EMBER
              </h2>
              <input
                className="column-search"
                placeholder="🔍"
                value={columnSearch.ember}
                onChange={(e) => handleColumnSearch('ember', e.target.value)}
              />
              <div
                id="column-ember"
                className="droppable-area"
                onMouseEnter={() => handleColumnHover('ember')}
                onMouseLeave={() => handleColumnHover(null)}
                onClick={(e) => {
                  // Only trigger if clicking the empty space (not on items)
                  if (e.target === e.currentTarget) {
                    handleAddEmberContact();
                  }
                }}
              >
                {filterItems([...columns.ember.items]
                  .sort((a, b) => new Date(a.nextContact) - new Date(b.nextContact)), 'ember')
                  .map((item, index) => renderEmberItem(item, index))}
              </div>
            </div>
          </div>
        </div>
      </DragDropContext>
    </>
  );
}

export default App;