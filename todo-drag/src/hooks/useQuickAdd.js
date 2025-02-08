import { useCallback, useRef, useEffect } from 'react';
import { sanitizeItemText } from '../utils/todoUtils';
import { COLUMN_SEQUENCE } from '../constants';

/**
 * Custom hook for quick-add functionality
 * @param {Object} params - Hook parameters
 * @param {Function} params.addTodo - Function to add a todo
 * @param {Function} params.startEditItem - Function to start editing an item
 * @param {Object} params.columns - Columns state
 * @param {Function} params.getPreviousColumnId - Function to get previous column ID
 * @param {string} params.quickAddColumn - Current quick-add column
 * @param {Function} params.setQuickAddColumn - Function to set quick-add column
 * @returns {Object} Quick-add state and handlers
 */
export const useQuickAdd = ({
  addTodo,
  columns,
  quickAddColumn,
  setQuickAddColumn
}) => {
  const quickAddInputRef = useRef(null);

  // Focus management effect
  useEffect(() => {
    if (quickAddColumn && quickAddInputRef.current) {
      try {
        quickAddInputRef.current.focus();
      } catch (error) {
        console.error('Error focusing quick add input:', error);
      }
    }
  }, [quickAddColumn]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      setQuickAddColumn(null);
    };
  }, [setQuickAddColumn]);

  const startEditItem = useCallback((item) => {
    const column = Object.entries(columns).find(([_, col]) => 
      col.items.some(i => i.id === item.id)
    )?.[0];
    
    if (column) {
      setQuickAddColumn(column);
    }
  }, [columns, setQuickAddColumn]);

  const getPreviousColumnId = useCallback((currentColumnId) => {
    const index = COLUMN_SEQUENCE.indexOf(currentColumnId);
    if (index <= 0) return null;
    return COLUMN_SEQUENCE[index - 1];
  }, []);

  /**
   * Handle quick-add key events
   * @param {Event} e - Keyboard event
   * @param {string} columnId - Current column ID
   */
  const handleQuickAddKeyDown = useCallback((e, columnId) => {
    try {
      if (e.key === 'Enter' || (e.key === 'Tab' && e.target.value.trim() === '')) {
        e.preventDefault();
        e.stopPropagation();
        
        const sanitizedText = sanitizeItemText(e.target.value);
        if (sanitizedText) {
          addTodo(sanitizedText, columnId);
        }
        
        if (e.target instanceof HTMLInputElement) {
          e.target.value = '';
        }
        
        if (e.key === 'Tab' && (!e.target.value || !e.target.value.trim())) {
          setQuickAddColumn(null);
        }
      } else if (e.key === 'Tab' && e.target.value.trim() !== '') {
        e.preventDefault();
        e.stopPropagation();
        
        const sanitizedText = sanitizeItemText(e.target.value);
        if (sanitizedText) {
          addTodo(sanitizedText, columnId);
          if (e.target instanceof HTMLInputElement) {
            e.target.value = '';
          }
        }
      } else if (e.key === 'Backspace' && (!e.target.value || e.target.value === '')) {
        const prevColumnId = getPreviousColumnId(columnId);
        const prevColumn = columns[prevColumnId];
        
        if (prevColumn?.items?.length > 0) {
          const lastItem = prevColumn.items[prevColumn.items.length - 1];
          startEditItem(lastItem);
          setQuickAddColumn(null);
        }
      }
    } catch (error) {
      console.error('Error in quick add key handler:', error);
      // Reset state on error
      setQuickAddColumn(null);
    }
  }, [addTodo, columns, getPreviousColumnId, startEditItem, setQuickAddColumn]);

  /**
   * Handle quick add blur
   * @param {Event} e - Blur event
   */
  const handleQuickAddBlur = useCallback((e) => {
    try {
      if (!e.target.value) {
        setQuickAddColumn(null);
        return;
      }

      const sanitizedText = sanitizeItemText(e.target.value);
      if (sanitizedText && quickAddColumn) {
        addTodo(sanitizedText, quickAddColumn);
      }
    } catch (error) {
      console.error('Error in quick add blur handler:', error);
    } finally {
      setQuickAddColumn(null);
    }
  }, [quickAddColumn, addTodo, setQuickAddColumn]);

  /**
   * Render quick-add input
   * @param {string} columnId - Column ID
   * @returns {JSX.Element|null} Quick-add input element
   */
  const renderQuickAddInput = useCallback((columnId) => {
    if (quickAddColumn !== columnId) return null;

    return (
      <input
        className="quick-add-input"
        autoFocus
        placeholder="Type and press Enter to add"
        onBlur={handleQuickAddBlur}
        onKeyDown={(e) => handleQuickAddKeyDown(e, columnId)}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          display: 'inline-block',
          minWidth: '50px',
          maxWidth: 'calc(100% - 32px)'
        }}
      />
    );
  }, [quickAddColumn, handleQuickAddBlur, handleQuickAddKeyDown]);

  return {
    quickAddInputRef,
    handleQuickAddKeyDown,
    handleQuickAddBlur,
    renderQuickAddInput,
    startEditItem,
    getPreviousColumnId
  };
};

export default useQuickAdd; 