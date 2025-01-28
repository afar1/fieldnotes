import { useState, useCallback, useEffect } from 'react';
import { 
  saveToLocalStorage, 
  loadFromLocalStorage, 
  createTodoItem,
  validateColumnStructure 
} from '../utils/todoUtils';
import { COLUMNS, DEFAULT_COLUMNS } from '../constants';

/**
 * Custom hook for managing todo state
 * @returns {Object} Todo state and methods
 */
export const useTodoState = () => {
  // Load initial state
  const [columns, setColumns] = useState(() => {
    const loaded = loadFromLocalStorage();
    // Validate each column's structure
    return {
      [COLUMNS.DO]: validateColumnStructure(loaded.columns?.do, DEFAULT_COLUMNS.do),
      [COLUMNS.DONE]: validateColumnStructure(loaded.columns?.done, DEFAULT_COLUMNS.done),
      [COLUMNS.IGNORE]: validateColumnStructure(loaded.columns?.ignore, DEFAULT_COLUMNS.ignore),
      [COLUMNS.OTHERS]: validateColumnStructure(loaded.columns?.others, DEFAULT_COLUMNS.others)
    };
  });

  // Save to localStorage whenever columns change
  useEffect(() => {
    saveToLocalStorage(columns);
  }, [columns]);

  /**
   * Add a single todo item
   * @param {string} text - Todo text
   * @param {string} columnId - Target column ID
   */
  const addTodo = useCallback((text, columnId = COLUMNS.DO) => {
    setColumns(prev => {
      const column = { ...prev[columnId] };
      const newItem = createTodoItem(text, columnId === COLUMNS.DONE);
      
      column.items = columnId === COLUMNS.DONE
        ? [newItem, ...column.items]
        : [...column.items, newItem];
      
      return { ...prev, [columnId]: column };
    });
  }, []);

  /**
   * Add multiple todo items
   * @param {string[]} items - Array of todo texts
   * @param {string} columnId - Target column ID
   */
  const addMultipleTodos = useCallback((items, columnId = COLUMNS.DO) => {
    setColumns(prev => {
      const column = { ...prev[columnId] };
      const newItems = items.map(text => createTodoItem(text, columnId === COLUMNS.DONE));
      
      column.items = columnId === COLUMNS.DONE
        ? [...newItems, ...column.items]
        : [...column.items, ...newItems];
      
      return { ...prev, [columnId]: column };
    });
  }, []);

  /**
   * Move items between columns
   * @param {string} sourceColumnId - Source column ID
   * @param {string} targetColumnId - Target column ID
   * @param {string[]} itemIds - Array of item IDs to move
   */
  const moveItems = useCallback((sourceColumnId, targetColumnId, itemIds) => {
    setColumns(prev => {
      const updated = { ...prev };
      const now = new Date().toISOString();

      // Remove items from source
      const sourceColumn = { ...updated[sourceColumnId] };
      const [itemsToMove, remainingItems] = sourceColumn.items.reduce(
        ([move, keep], item) => {
          if (itemIds.includes(item.id)) {
            return [[...move, item], keep];
          }
          return [move, [...keep, item]];
        },
        [[], []]
      );

      // Update timestamps if moving to DONE
      const processedItems = itemsToMove.map(item => ({
        ...item,
        completedAt: targetColumnId === COLUMNS.DONE ? now : undefined
      }));

      // Update source and target columns
      sourceColumn.items = remainingItems;
      const targetColumn = { ...updated[targetColumnId] };
      targetColumn.items = targetColumnId === COLUMNS.DONE
        ? [...processedItems, ...targetColumn.items]
        : [...targetColumn.items, ...processedItems];

      updated[sourceColumnId] = sourceColumn;
      updated[targetColumnId] = targetColumn;

      return updated;
    });
  }, []);

  /**
   * Delete items from any column
   * @param {string[]} itemIds - Array of item IDs to delete
   */
  const deleteItems = useCallback((itemIds) => {
    setColumns(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(columnId => {
        const column = { ...updated[columnId] };
        column.items = column.items.filter(item => !itemIds.includes(item.id));
        updated[columnId] = column;
      });
      return updated;
    });
  }, []);

  /**
   * Update an item's text
   * @param {string} columnId - Column ID
   * @param {string} itemId - Item ID
   * @param {string} newText - New text
   */
  const updateItemText = useCallback((columnId, itemId, newText) => {
    setColumns(prev => {
      const column = { ...prev[columnId] };
      column.items = column.items.map(item =>
        item.id === itemId ? { ...item, text: newText } : item
      );
      return { ...prev, [columnId]: column };
    });
  }, []);

  return {
    columns,
    setColumns,
    addTodo,
    addMultipleTodos,
    moveItems,
    deleteItems,
    updateItemText
  };
};

export default useTodoState; 