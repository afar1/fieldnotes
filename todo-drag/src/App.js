import React, { useState, useEffect, useRef, useCallback } from 'react';
import { DragDropContext, Draggable } from 'react-beautiful-dnd';
import './App.css';

import StrictModeDroppable from './components/StrictModeDroppable';
import SelectableItem from './components/SelectableItem';
import EditableItem from './components/EditableItem';
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

// Load initial state from localStorage with versioning
const loadInitialState = () => {
  try {
    const saved = localStorage.getItem('my-todos');
    if (!saved) return { ...DEFAULT_STATE, needsMigration: false };

    const parsed = JSON.parse(saved);
    if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_STATE, needsMigration: false };

    // Check version and migrate if needed
    if (!parsed.version || parsed.version !== CURRENT_VERSION) {
      return { 
        ...DEFAULT_STATE,
        columns: parsed.columns || DEFAULT_STATE.columns,
        needsMigration: true,
        oldData: parsed 
      };
    }

    // Validate each column's structure
    const validatedColumns = {
      do: validateColumnStructure(parsed.columns?.do, DEFAULT_STATE.columns.do),
      done: validateColumnStructure(parsed.columns?.done, DEFAULT_STATE.columns.done),
      ignore: validateColumnStructure(parsed.columns?.ignore, DEFAULT_STATE.columns.ignore),
      others: validateColumnStructure(parsed.columns?.others, DEFAULT_STATE.columns.others)
    };

    return {
      version: CURRENT_VERSION,
      columns: validatedColumns,
      needsMigration: false
    };
  } catch (error) {
    console.error('Error loading from localStorage:', error);
    return { ...DEFAULT_STATE, needsMigration: false };
  }
};

function App() {
  // Add state for migration
  const [isMigrating, setIsMigrating] = useState(false);
  const initialState = useRef(loadInitialState());
  
  // State declarations
  const [columns, setColumns] = useState(() => initialState.current.columns);
  const [editItemId, setEditItemId] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragEnd, setDragEnd] = useState({ x: 0, y: 0 });
  const [searchingColumn, setSearchingColumn] = useState(null);
  const [columnSearch, setColumnSearch] = useState({
    do: '',
    done: '',
    ignore: '',
    others: ''
  });

  const inputRef = useRef(null);
  const isUndoingRef = useRef(false);
  const [history, setHistory] = useState([]);
  
  // Add this state for tracking quick-add input
  const [quickAddColumn, setQuickAddColumn] = useState(null);

  // Add state to track if we've moved during drag
  const [hasMoved, setHasMoved] = useState(false);

  // Add state to track which column is being hovered
  const [hoveredColumn, setHoveredColumn] = useState(null);

  // Add state for tip action handler
  const [tipActionHandler, setTipActionHandler] = useState(null);

  // Add clipboard state for cut/copy operations
  const [clipboard, setClipboard] = useState([]);
  const [isCut, setIsCut] = useState(false);

  // Add state to track react-beautiful-dnd drag operations
  const [isRbdDragging, setIsRbdDragging] = useState(false);

  // Add state for keyboard focus
  const [keyboardFocusedColumn, setKeyboardFocusedColumn] = useState(null);

  // Add state for tracking drag start position
  const dragStartPos = useRef(null);

  // Add state for grid visibility
  const [showGrid, setShowGrid] = useState(false);

  // Add state for showing done items
  const [showDone, setShowDone] = useState(false);

  // Add state for DONE blink effect
  const [doneBlinking, setDoneBlinking] = useState(false);

  // Notify tip system of completed actions - moved to top
  const notifyTipAction = useCallback((action) => {
    if (tipActionHandler) {
      tipActionHandler(action);
    }
  }, [tipActionHandler]);

  // Save data to localStorage with validation and versioning
  const saveToLocalStorage = useCallback((columns) => {
    try {
      if (!columns || typeof columns !== 'object') {
        throw new Error('Invalid data structure');
      }
      const dataToSave = {
        version: CURRENT_VERSION,
        columns: columns
      };
      localStorage.setItem('my-todos', JSON.stringify(dataToSave));
    } catch (error) {
      console.error('Error saving to localStorage:', error);
    }
  }, []);

  // Handle new item submission
  const handleKeyDown = (e) => {
    // If user pressed Enter in the input
    if (e.key === 'Enter') {
      e.preventDefault();

      if (!e.target.value.trim()) return;

      const newValue = e.target.value.trim();
      // If multiline, handle that separately
      if (newValue.includes('\n')) {
        // Split by lines
        const lines = newValue.split('\n').map(line => line.trim()).filter(Boolean);
        addMultipleTodos(lines);
      } else {
        addTodo(newValue);
      }

      // Clear input
      e.target.value = '';
    }
  };

  // Handle paste of multiple lines
  const handlePaste = (e) => {
    const pastedText = e.clipboardData.getData('Text');
    if (pastedText && pastedText.includes('\n')) {
      e.preventDefault();
      const lines = pastedText.split('\n').map(line => line.trim()).filter(Boolean);
      addMultipleTodos(lines);
    }
  };

  const addMultipleTodos = (lines) => {
    setColumns(prev => {
      const newDoColumn = { ...prev.do };
      lines.forEach(line => {
        newDoColumn.items.push({
          id: `id-${Date.now()}-${Math.random()}`,
          text: line,
        });
      });
      return {
        ...prev,
        do: newDoColumn,
      };
    });
  };

  // Add single to-do
  const addTodo = (text) => {
    setColumns((prev) => {
      const newDoColumn = { ...prev.do };
      newDoColumn.items = [
        ...newDoColumn.items,
        {
          id: `id-${Date.now()}-${Math.random()}`,
          text,
        },
      ];
      return {
        ...prev,
        do: newDoColumn,
      };
    });
  };

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
  const getNextColumnId = (currentColumnId) => {
    const currentIndex = COLUMN_SEQUENCE.indexOf(currentColumnId);
    return COLUMN_SEQUENCE[(currentIndex + 1) % COLUMN_SEQUENCE.length];
  };

  // Get the previous column in sequence
  const getPreviousColumnId = (currentColumnId) => {
    const currentIndex = COLUMN_SEQUENCE.indexOf(currentColumnId);
    return COLUMN_SEQUENCE[(currentIndex - 1 + COLUMN_SEQUENCE.length) % COLUMN_SEQUENCE.length];
  };

  // Validate and sanitize item text
  const sanitizeItemText = (text) => {
    if (typeof text !== 'string') return '';
    return text.trim().slice(0, 1000); // Limit length to 1000 chars
  };

  // Update moveToNextColumn with validation
  const moveToNextColumn = (currentColumnId, itemIds, moveBackward = false) => {
    try {
      // Validate parameters
      if (!COLUMN_SEQUENCE.includes(currentColumnId)) {
        throw new Error(`Invalid column ID: ${currentColumnId}`);
      }
      if (!Array.isArray(itemIds) || itemIds.length === 0) {
        throw new Error('Invalid item IDs');
      }

      const targetColumnId = moveBackward ? 
        getPreviousColumnId(currentColumnId) : 
        getNextColumnId(currentColumnId);
      
      // If moving to DONE column, trigger blink
      if (targetColumnId === 'done') {
        setDoneBlinking(true);
        setTimeout(() => setDoneBlinking(false), 500);
      }

      setColumns(prev => {
        if (!prev || !prev[targetColumnId]) return prev;

        const updated = { ...prev };
        const itemsToMove = [];
        const now = new Date().toISOString();

        // Remove items from their current columns
        Object.keys(updated).forEach(columnId => {
          if (!updated[columnId]) return;

          const column = updated[columnId];
          const [selected, remaining] = column.items.reduce(
            ([sel, rem], item) => {
              if (itemIds.includes(item.id)) {
                return [[...sel, item], rem];
              }
              return [sel, [...rem, item]];
            },
            [[], []]
          );
          itemsToMove.push(...selected);
          updated[columnId] = {
            ...column,
            items: remaining
          };
        });

        // Process timestamps for moved items
        const processedItems = itemsToMove.map(item => ({
          ...item,
          completedAt: targetColumnId === 'done' ? 
            (item.completedAt || now) : undefined
        }));

        // Add items to target column
        const targetColumn = updated[targetColumnId];
        updated[targetColumnId] = {
          ...targetColumn,
          items: targetColumnId === 'done' 
            ? [...processedItems, ...targetColumn.items]
            : [...targetColumn.items, ...processedItems]
        };

        return updated;
      });

      notifyTipAction('cmd-click-move');
    } catch (error) {
      console.error('Error moving items:', error);
    }
  };

  // Function to handle search
  const handleColumnSearch = (columnId, searchText) => {
    setColumnSearch(prev => ({
      ...prev,
      [columnId]: searchText.toLowerCase()
    }));
    notifyTipAction('column-search');
  };

  // Function to filter items based on search
  const filterItems = (items, columnId) => {
    const searchText = columnSearch[columnId];
    if (!searchText) return items;

    return items.filter(item => 
      item.text.toLowerCase().includes(searchText)
    );
  };

  // Function to handle exiting search mode
  const exitSearch = (columnId) => {
    setSearchingColumn(null);
    setColumnSearch(prev => ({
      ...prev,
      [columnId]: ''
    }));
  };

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
  }, [getEffectiveColumn, columns, notifyTipAction]);

  // Handle quick-add input events
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
          // Only move to next column if tab was pressed on empty input
          const nextColumnId = getNextColumnId(columnId);
          setQuickAddColumn(nextColumnId);
        }
      } catch (error) {
        console.error('Error adding item:', error);
      }
    } else if (e.key === 'Tab' && e.target.value.trim() !== '') {
      // If tab with text, add the item but stay in same column
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
          e.target.value = '';
        }
      } catch (error) {
        console.error('Error adding item:', error);
      }
    } else if (e.key === 'Backspace' && e.target.value === '') {
      // If backspace is pressed on empty input, try to edit the last item in the column above
      const prevColumnId = getPreviousColumnId(columnId);
      const prevColumn = columns[prevColumnId];
      if (prevColumn && prevColumn.items.length > 0) {
        const lastItem = prevColumn.items[prevColumn.items.length - 1];
        startEditItem(lastItem);
        setQuickAddColumn(null);
      }
    }
  }, [columns, getNextColumnId, getPreviousColumnId, sanitizeItemText]);

  // Handle quick-add input blur
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

  // Clean up states when unmounting or when drag starts
  useEffect(() => {
    if (isDragging) {
      setQuickAddColumn(null);
    }
  }, [isDragging]);

  // Update useEffect to use the new save function
  useEffect(() => {
    saveToLocalStorage(columns);
  }, [columns]);

  // Update the quick-add input rendering
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
      } else if ((e.metaKey || e.ctrlKey) && !e.shiftKey) {
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
  }, [handleCut, handleCopy, handleClipboardPaste, getEffectiveColumn]);

  // Deleting a single item by ID
  const deleteItem = (colId, itemId) => {
    setColumns((prev) => {
      const col = { ...prev[colId] };
      col.items = col.items.filter((item) => item.id !== itemId);
      return { ...prev, [colId]: col };
    });
    // Also clear from selected if it was selected
    setSelectedIds((prevSelected) => prevSelected.filter((id) => id !== itemId));
  };

  // Enter edit mode for item
  const startEditItem = (item) => {
    setEditItemId(item.id);
    notifyTipAction('click-edit');
  };

  // Save changes to an edited item
  const saveEditItem = (colId, itemId, newText) => {
    if (!newText.trim()) {
      // if new text is empty, consider it a delete
      deleteItem(colId, itemId);
      setEditItemId(null);
      return;
    }
    setColumns((prev) => {
      const col = { ...prev[colId] };
      col.items = col.items.map((item) =>
        item.id === itemId ? { ...item, text: newText } : item
      );
      return {
        ...prev,
        [colId]: col,
      };
    });
    setEditItemId(null);
  };

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

  // Grid overlay component
  const GridOverlay = () => {
    const cells = [];
    for (let row = 0; row < 20; row++) {
      for (let col = 0; col < 20; col++) {
        cells.push(
          <div
            key={`${row}-${col}`}
            className="grid-cell"
            data-coord={`${row},${col}`}
          />
        );
      }
    }
    return <div className="grid-overlay">{cells}</div>;
  };

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

  // Handle migration completion
  const handleMigrationComplete = useCallback(() => {
    if (initialState.current.needsMigration && initialState.current.oldData) {
      const migrated = migrateData(initialState.current.oldData, initialState.current.oldData.version);
      setColumns(migrated.columns);
      saveToLocalStorage(migrated.columns);
    }
    setIsMigrating(false);
  }, []);

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

  // Render draggable item
  const renderDraggableItem = (provided, snapshot, item, columnId) => (
    <div
      ref={provided.innerRef}
      {...provided.draggableProps}
      {...provided.dragHandleProps}
      className={selectedIds.includes(item.id) ? 'selected' : ''}
      style={{
        ...provided.draggableProps.style,
        opacity: snapshot.isDragging ? 0.8 : 1,
      }}
    >
      {editItemId === item.id ? (
        <EditableItem
          item={item}
          onSave={(newText) => saveEditItem(columnId, item.id, newText)}
          onCancel={() => setEditItemId(null)}
        />
      ) : (
        <SelectableItem
          todo={item}
          isSelected={selectedIds.includes(item.id)}
          onClick={(e) => {
            if (e.shiftKey) {
              toggleSelection(item.id, e);
            } else if (e.metaKey || e.ctrlKey) {
              // Command/Ctrl+click to edit
              startEditItem(item);
            } else if (!isRbdDragging) {
              // Regular click moves to DONE from any column
              if (columnId !== 'done') {
                // Set the blink effect
                setDoneBlinking(true);
                setTimeout(() => setDoneBlinking(false), 500);
                
                // Move the item to DONE
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
              }
            }
          }}
          onDoubleClick={() => {
            // Remove double click since single click moves to DONE
            return;
          }}
          columnId={columnId}
        />
      )}
    </div>
  );

  return (
    <>
      {isMigrating && <MigrationOverlay onComplete={handleMigrationComplete} />}
      <DragDropContext 
        onDragStart={(start) => {
          setIsRbdDragging(true);
          // Store initial drag position
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
          <button 
            className="toggle-grid" 
            onClick={() => setShowGrid(!showGrid)}
          >
            {showGrid ? 'Hide Grid' : 'Show Grid'}
          </button>
          {showGrid && <GridOverlay />}
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
          
          {/* Center input area */}
          <div className="input-area">
            <textarea
              ref={inputRef}
              placeholder="Type a todo and press Enter (or paste multiple lines)"
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              rows={3}
            />
          </div>

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

            {/* IGNORE Column */}
            <div 
              className={`column ${keyboardFocusedColumn === 'ignore' ? 'keyboard-focused' : ''}`}
            >
              <h2 
                onClick={() => setSearchingColumn('ignore')}
                className={getEffectiveColumn() === 'ignore' ? 'hovered' : ''}
              >
                IGNORE
              </h2>
              <StrictModeDroppable droppableId="ignore">
                {(provided, snapshot) => (
                  <div
                    id="column-ignore"
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`droppable-area ${snapshot.isDraggingOver ? 'dragging-over' : ''}`}
                    onMouseEnter={() => handleColumnHover('ignore')}
                    onMouseLeave={() => handleColumnHover(null)}
                  >
                    {filterItems(columns.ignore.items, 'ignore').map((item, index) => (
                      <Draggable 
                        key={item.id} 
                        draggableId={item.id} 
                        index={index}
                      >
                        {(provided, snapshot) => renderDraggableItem(provided, snapshot, item, 'ignore')}
                      </Draggable>
                    ))}
                    {getEffectiveColumn() === 'ignore' && !quickAddColumn && (
                      <div 
                        className="cursor-line"
                        onClick={() => setQuickAddColumn('ignore')}
                      />
                    )}
                    {renderQuickAddInput('ignore')}
                    {provided.placeholder}
                  </div>
                )}
              </StrictModeDroppable>
            </div>

            {/* OTHERS Column */}
            <div 
              className={`column ${keyboardFocusedColumn === 'others' ? 'keyboard-focused' : ''}`}
            >
              <h2 
                onClick={() => setSearchingColumn('others')}
                className={getEffectiveColumn() === 'others' ? 'hovered' : ''}
              >
                OTHERS
              </h2>
              <StrictModeDroppable droppableId="others">
                {(provided, snapshot) => (
                  <div
                    id="column-others"
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`droppable-area ${snapshot.isDraggingOver ? 'dragging-over' : ''}`}
                    onMouseEnter={() => handleColumnHover('others')}
                    onMouseLeave={() => handleColumnHover(null)}
                  >
                    {filterItems(columns.others.items, 'others').map((item, index) => (
                      <Draggable 
                        key={item.id} 
                        draggableId={item.id} 
                        index={index}
                      >
                        {(provided, snapshot) => renderDraggableItem(provided, snapshot, item, 'others')}
                      </Draggable>
                    ))}
                    {getEffectiveColumn() === 'others' && !quickAddColumn && (
                      <div 
                        className="cursor-line"
                        onClick={() => setQuickAddColumn('others')}
                      />
                    )}
                    {renderQuickAddInput('others')}
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