import { useState, useCallback } from 'react';
import { sanitizeItemText } from '../utils/todoUtils';
import { COLUMNS } from '../constants';

/**
 * Custom hook for quick-add functionality
 * @param {Object} params - Hook parameters
 * @param {Function} params.addTodo - Function to add a todo
 * @param {Function} params.startEditItem - Function to start editing an item
 * @param {Object} params.columns - Columns state
 * @param {Function} params.getPreviousColumnId - Function to get previous column ID
 * @returns {Object} Quick-add state and handlers
 */
export const useQuickAdd = ({
  addTodo,
  startEditItem,
  columns,
  getPreviousColumnId
}) => {
  const [quickAddColumn, setQuickAddColumn] = useState(null);

  /**
   * Handle quick-add key events
   * @param {Event} e - Keyboard event
   * @param {string} columnId - Current column ID
   */
  const handleQuickAddKeyDown = useCallback((e, columnId) => {
    if (e.key === 'Enter' || (e.key === 'Tab' && e.target.value.trim() === '')) {
      e.preventDefault();
      try {
        const sanitizedText = sanitizeItemText(e.target.value);
        if (sanitizedText) {
          addTodo(sanitizedText, columnId);
        }
        e.target.value = '';
        if (e.key === 'Tab' && e.target.value.trim() === '') {
          // Only move to next column if tab was pressed on empty input
          setQuickAddColumn(null);
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
          addTodo(sanitizedText, columnId);
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
  }, [addTodo, columns, getPreviousColumnId, startEditItem]);

  /**
   * Handle quick-add blur
   * @param {Event} e - Blur event
   */
  const handleQuickAddBlur = useCallback((e) => {
    const sanitizedText = sanitizeItemText(e.target.value);
    if (sanitizedText && quickAddColumn) {
      addTodo(sanitizedText, quickAddColumn);
    }
    setQuickAddColumn(null);
  }, [quickAddColumn, addTodo]);

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
    quickAddColumn,
    setQuickAddColumn,
    handleQuickAddKeyDown,
    handleQuickAddBlur,
    renderQuickAddInput
  };
};

export default useQuickAdd; 