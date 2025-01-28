import { useCallback, useEffect } from 'react';
import { COLUMN_SEQUENCE } from '../constants';

/**
 * Custom hook for keyboard navigation
 * @param {Object} params - Hook parameters
 * @param {Function} params.setKeyboardFocusedColumn - Function to set focused column
 * @param {Function} params.getEffectiveColumn - Function to get current effective column
 * @param {Function} params.handleCut - Cut handler
 * @param {Function} params.handleCopy - Copy handler
 * @param {Function} params.handlePaste - Paste handler
 * @param {Function} params.handleUndo - Undo handler
 * @returns {Object} Keyboard navigation handlers
 */
export const useKeyboardNavigation = ({
  setKeyboardFocusedColumn,
  getEffectiveColumn,
  handleCut,
  handleCopy,
  handlePaste,
  handleUndo
}) => {
  /**
   * Handle tab navigation between columns
   */
  const handleTabNavigation = useCallback((e) => {
    if (e.key !== 'Tab') return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

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
  }, [getEffectiveColumn, setKeyboardFocusedColumn]);

  /**
   * Handle keyboard shortcuts
   */
  const handleKeyboardShortcuts = useCallback((e) => {
    // Ignore if in input field
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
          handlePaste();
          break;
        case 'z':
          e.preventDefault();
          handleUndo();
          break;
        default:
          break;
      }
    }
  }, [handleCut, handleCopy, handlePaste, handleUndo]);

  // Add keyboard event listeners
  useEffect(() => {
    window.addEventListener('keydown', handleTabNavigation);
    window.addEventListener('keydown', handleKeyboardShortcuts);
    
    return () => {
      window.removeEventListener('keydown', handleTabNavigation);
      window.removeEventListener('keydown', handleKeyboardShortcuts);
    };
  }, [handleTabNavigation, handleKeyboardShortcuts]);

  return {
    handleTabNavigation,
    handleKeyboardShortcuts
  };
};

export default useKeyboardNavigation; 