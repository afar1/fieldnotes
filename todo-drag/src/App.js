import React, { useState, useEffect, useRef, useCallback } from 'react';
import { DragDropContext, Draggable } from 'react-beautiful-dnd';
import './App.css';

import StrictModeDroppable from './components/StrictModeDroppable';
import SelectableItem from './components/SelectableItem';
import ProTipTooltip from './components/ProTipTooltip';
import MigrationOverlay from './components/MigrationOverlay';

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
  }
};

// Column sequence for navigation
const COLUMN_SEQUENCE = ['do', 'ignore', 'others'];

// Validate column structure
const validateColumnStructure = (column, defaultColumn) => {
  if (!column || typeof column !== 'object') return defaultColumn;
  
  return {
    id: column.id || defaultColumn.id,
    name: column.name || defaultColumn.name,
    items: Array.isArray(column.items) ? column.items.map(item => ({
      id: item.id || `id-${Date.now()}-${Math.random()}`,
      text: typeof item.text === 'string' ? item.text : '',
      completedAt: item.completedAt || undefined
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
    others: ''
  });
  const [history, setHistory] = useState([]);
  const isUndoingRef = useRef(false);
  const dragStartPos = useRef(null);
  
  const [quickAddColumn, setQuickAddColumn] = useState(null);
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

  // Notify tip system of completed actions
  const notifyTipAction = useCallback((action) => {
    if (tipActionHandler) {
      tipActionHandler(action);
    }
  }, [tipActionHandler]);

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

  // Update useEffect for localStorage with proper cleanup and error handling
  useEffect(() => {
    let isMounted = true;

    const saveData = async () => {
      if (!isUndoingRef.current && isMounted) {
        const savedSuccessfully = saveToLocalStorage(columns);
        if (!savedSuccessfully && isMounted) {
          console.warn('Failed to save to localStorage. Your changes may not persist.');
          // You could set some state here to show a user-facing error message if desired
        }
      }
    };

    saveData();

    // Attempt to save any pending changes before unmounting
    return () => {
      isMounted = false;
      if (!isUndoingRef.current) {
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

  // Add keyboard event listener for delete
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.length > 0) {
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
  }, [selectedIds]);

  // Get the next column in sequence
  const getNextColumnId = useCallback((currentColumnId) => {
    const currentIndex = COLUMN_SEQUENCE.indexOf(currentColumnId);
    return COLUMN_SEQUENCE[(currentIndex + 1) % COLUMN_SEQUENCE.length];
  }, []);

  // Get the previous column in sequence
  const getPreviousColumnId = useCallback((currentColumnId) => {
    const currentIndex = COLUMN_SEQUENCE.indexOf(currentColumnId);
    return COLUMN_SEQUENCE[(currentIndex - 1 + COLUMN_SEQUENCE.length) % COLUMN_SEQUENCE.length];
  }, []);

  // Enter edit mode for item
  const startEditItem = useCallback((item) => {
    notifyTipAction('click-edit');
  }, [notifyTipAction]);

  // Helper to find nearest column in drag direction
  const findNearestColumn = useCallback((source, dragEndClient) => {
    if (!dragStartPos.current || !dragEndClient) return null;

    // Calculate total drag movement
    const dragDelta = {
      x: dragEndClient.x - dragStartPos.current.x,
      y: dragEndClient.y - dragStartPos.current.y
    };

    // Reduce minimum drag threshold
    if (Math.abs(dragDelta.x) < 2) return null;

    // Get container offset
    const container = document.querySelector('.columns');
    if (!container) return null;

    // Get all column elements with adjusted positions
    const columns = COLUMN_SEQUENCE.map(id => ({
      id,
      element: document.getElementById(`column-${id}`),
      rect: document.getElementById(`column-${id}`).getBoundingClientRect()
    })).filter(col => col.element);

    // Get source column info
    const sourceCol = columns.find(col => col.id === source);
    if (!sourceCol) return null;

    // Determine drag direction
    const isDraggingRight = dragDelta.x > 0;

    // Filter columns based on direction and adjusted positions
    const possibleTargets = columns.filter(col => {
      if (isDraggingRight) {
        return dragEndClient.x >= col.rect.left && col.id !== source;
      } else {
        return dragEndClient.x <= col.rect.right && col.id !== source;
      }
    });

    if (possibleTargets.length === 0) return null;

    // Find nearest column based on distance to drag point
    return possibleTargets.reduce((nearest, current) => {
      if (!nearest) return current;

      const nearestDist = Math.min(
        Math.abs(nearest.rect.left - dragEndClient.x),
        Math.abs(nearest.rect.right - dragEndClient.x)
      );
      
      const currentDist = Math.min(
        Math.abs(current.rect.left - dragEndClient.x),
        Math.abs(current.rect.right - dragEndClient.x)
      );

      return currentDist < nearestDist ? current : nearest;
    }).id;
  }, []);

  // Handle migration completion
  const handleMigrationComplete = useCallback(() => {
    if (initialState.current.needsMigration && initialState.current.oldData) {
      const migrated = migrateData(initialState.current.oldData, initialState.current.oldData.version);
      setColumns(migrated.columns);
      saveToLocalStorage(migrated.columns);
    }
    setIsMigrating(false);
  }, [saveToLocalStorage]);

  // Show migration overlay if needed
  useEffect(() => {
    if (initialState.current.needsMigration) {
      setIsMigrating(true);
    }
  }, []);

  // Toggle between DO and DONE
  const toggleDoDone = () => {
    setShowDone(prev => !prev);
  };

  // Toggle between OTHERS and IGNORE
  const toggleOthersIgnore = () => {
    setShowIgnore(prev => !prev);
    setIgnoreBlinking(true);
    setTimeout(() => setIgnoreBlinking(false), 500);
  };

  // Update column search handling
  const handleColumnSearch = useCallback((columnId, searchText) => {
    setColumnSearch(prev => ({
      ...prev,
      [columnId]: searchText.toLowerCase()
    }));
    notifyTipAction('column-search');
  }, [notifyTipAction]);

  // Handle arrow key navigation
  const handleArrowNavigation = useCallback((e) => {
    // Only handle arrow keys when not in an input field
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      
    const currentColumn = getEffectiveColumn();
    if (!currentColumn) return;

    if (['ArrowUp', 'ArrowDown'].includes(e.key)) {
        e.preventDefault();
      
      // Get visible items in current column
      const currentItems = filterItems(columns[currentColumn].items, currentColumn);
      const currentIndex = focusedItemId 
        ? currentItems.findIndex(item => item.id === focusedItemId)
        : -1;
      
      switch (e.key) {
        case 'ArrowUp': {
          if (currentIndex > 0) {
            setFocusedItemId(currentItems[currentIndex - 1].id);
          } else if (currentIndex === -1 && currentItems.length > 0) {
            setFocusedItemId(currentItems[currentItems.length - 1].id);
          }
          break;
        }
        case 'ArrowDown': {
          if (currentIndex < currentItems.length - 1) {
            setFocusedItemId(currentItems[currentIndex + 1].id);
          } else if (currentIndex === -1 && currentItems.length > 0) {
            setFocusedItemId(currentItems[0].id);
          }
          break;
        }
        default:
          break;
      }
    }
  }, [columns, focusedItemId, getEffectiveColumn, filterItems]);

  // Add keyboard event listener for arrow navigation
  useEffect(() => {
    window.addEventListener('keydown', handleArrowNavigation);
    return () => window.removeEventListener('keydown', handleArrowNavigation);
  }, [handleArrowNavigation]);

  // Clear focused item when column changes
  useEffect(() => {
    setFocusedItemId(null);
  }, [hoveredColumn, keyboardFocusedColumn]);

  // Update renderDraggableItem to show focus state
  const renderDraggableItem = (provided, snapshot, item, columnId) => (
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
  );

  // Restore handleQuickAddKeyDown
  const handleQuickAddKeyDown = useCallback((e, columnId) => {
    if (e.key === 'Enter' || (e.key === 'Tab' && e.target.value.trim() === '')) {
      e.preventDefault();
      try {
        const sanitizedText = sanitizeItemText(e.target.value);
        if (sanitizedText) {
          setColumns(prev => {
            const updated = { ...prev };
            const newItem = {
              id: `id-${Date.now()}-${Math.random()}`,
              text: sanitizedText,
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
        }
          e.target.value = '';
        if (e.key === 'Tab' && e.target.value.trim() === '') {
          const nextColumnId = getNextColumnId(columnId);
          setQuickAddColumn(nextColumnId);
        }
      } catch (error) {
        console.error('Error adding item:', error);
      }
    } else if (e.key === 'Backspace' && e.target.value === '') {
      const prevColumnId = getPreviousColumnId(columnId);
      const prevColumn = columns[prevColumnId];
      if (prevColumn && prevColumn.items.length > 0) {
        const lastItem = prevColumn.items[prevColumn.items.length - 1];
        startEditItem(lastItem);
        setQuickAddColumn(null);
      }
    }
  }, [columns, sanitizeItemText, getNextColumnId, getPreviousColumnId, startEditItem]);

  // Restore handleQuickAddBlur
  const handleQuickAddBlur = useCallback((e) => {
    const sanitizedText = sanitizeItemText(e.target.value);
    if (sanitizedText && quickAddColumn) {
      setColumns(prev => {
        const updated = { ...prev };
        const newItem = {
          id: `id-${Date.now()}-${Math.random()}`,
          text: sanitizedText,
          completedAt: quickAddColumn === 'done' ? new Date().toISOString() : undefined
        };
        
        updated[quickAddColumn] = {
          ...updated[quickAddColumn],
          items: quickAddColumn === 'done' 
            ? [newItem, ...updated[quickAddColumn].items]
            : [...updated[quickAddColumn].items, newItem]
        };
        
        return updated;
      });
    }
    setQuickAddColumn(null);
  }, [quickAddColumn, sanitizeItemText]);

  // Restore renderQuickAddInput
  const renderQuickAddInput = useCallback((columnId) => {
    if (quickAddColumn !== columnId) return null;

    return (
      <input
        className="quick-add-input"
        autoFocus
        placeholder="Type and press Enter to add"
        onBlur={handleQuickAddBlur}
        onKeyDown={(e) => handleQuickAddKeyDown(e, columnId)}
        onClick={(e) => e.stopPropagation()} // Prevent click from bubbling
        style={{
          position: 'relative',
          display: 'inline-block',
          minWidth: '50px',
          maxWidth: 'calc(100% - 32px)'
        }}
      />
    );
  }, [quickAddColumn, handleQuickAddBlur, handleQuickAddKeyDown]);

  // Restore Cmd+A functionality
  useEffect(() => {
    const handleGlobalKeyPress = (e) => {
      // Ignore if we're in an input field or textarea
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      
      // Handle Command+A (or Ctrl+A) for selecting all items in hovered column
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a' && getEffectiveColumn()) {
        e.preventDefault(); // Prevent default select all
        // Select all items in the hovered column
        const columnItems = columns[getEffectiveColumn()]?.items || [];
        const itemIds = columnItems.map(item => item.id);
        setSelectedIds(itemIds);
        notifyTipAction('select-all');
        return;
      }
      
      // Only trigger for printable characters and ignore modifier keys
      if (getEffectiveColumn() && e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setQuickAddColumn(getEffectiveColumn());
        
        // Small delay to ensure input is focused before setting value
        setTimeout(() => {
          const input = document.querySelector('.quick-add-input');
          if (input) {
            input.value = e.key;
            input.focus();
          }
        }, 0);
      }
    };

    window.addEventListener('keypress', handleGlobalKeyPress);
    
    // Add keydown listener for Command+A
    const handleGlobalKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a' && getEffectiveColumn()) {
        e.preventDefault();
        const columnItems = columns[getEffectiveColumn()]?.items || [];
        const itemIds = columnItems.map(item => item.id);
        setSelectedIds(itemIds);
      }
    };
    
    window.addEventListener('keydown', handleGlobalKeyDown);

    return () => {
      window.removeEventListener('keypress', handleGlobalKeyPress);
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [getEffectiveColumn, columns, notifyTipAction, setSelectedIds]);

  // Add keyboard event listeners for cut/copy/paste and tab navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore if we're in an input field or textarea
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      
      if (e.key === 'Tab') {
        e.preventDefault();
        
        const currentColumn = getEffectiveColumn() || COLUMN_SEQUENCE[0];
        const currentIndex = COLUMN_SEQUENCE.indexOf(currentColumn);
        
        // Calculate next column index based on shift key
        const nextIndex = e.shiftKey
          ? (currentIndex - 1 + COLUMN_SEQUENCE.length) % COLUMN_SEQUENCE.length
          : (currentIndex + 1) % COLUMN_SEQUENCE.length;
        
        setKeyboardFocusedColumn(COLUMN_SEQUENCE[nextIndex]);
        
        // Scroll the column into view if needed
        const columnElement = document.getElementById(`column-${COLUMN_SEQUENCE[nextIndex]}`);
        if (columnElement) {
          columnElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [getEffectiveColumn]);

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
      Object.keys(updated).forEach(columnId => {
        updated[columnId] = {
          ...updated[columnId],
          items: updated[columnId].items.filter(item => !selectedIds.includes(item.id))
        };
      });
      return updated;
    });
    
    setSelectedIds([]);
    notifyTipAction('cut');
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
          </div>
        </div>
      </DragDropContext>
    </>
  );
}

export default App;