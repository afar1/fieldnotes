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
    try {
      if (e.key !== 'Tab') return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      e.preventDefault();
      
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
      setKeyboardFocusedColumn(nextColumn);
      
      // Scroll the column into view if needed
      try {
        const columnElement = document.getElementById(`column-${nextColumn}`);
        if (columnElement) {
          columnElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      } catch (scrollError) {
        console.error('Error scrolling to column:', scrollError);
      }
    } catch (error) {
      console.error('Error in tab navigation:', error);
      // Reset focus on error
      setKeyboardFocusedColumn(null);
    }
  }, [getEffectiveColumn, setKeyboardFocusedColumn]);

  /**
   * Handle keyboard shortcuts
   */
  const handleKeyboardShortcuts = useCallback((e) => {
    try {
      // Ignore if in input field
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      // Only handle Command/Ctrl shortcuts
      if (!(e.metaKey || e.ctrlKey) || e.shiftKey) return;

      switch (e.key.toLowerCase()) {
        case 'x':
          e.preventDefault();
          e.stopPropagation();
          handleCut();
          break;
        case 'c':
          e.preventDefault();
          e.stopPropagation();
          handleCopy();
          break;
        case 'v':
          e.preventDefault();
          e.stopPropagation();
          handlePaste();
          break;
        case 'z':
          e.preventDefault();
          e.stopPropagation();
          handleUndo();
          break;
        default:
          break;
      }
    } catch (error) {
      console.error('Error in keyboard shortcuts:', error);
    }
  }, [handleCut, handleCopy, handlePaste, handleUndo]);

  // Add keyboard event listeners with cleanup
  useEffect(() => {
    let isMounted = true;

    const safeHandleTabNavigation = (e) => {
      if (isMounted) handleTabNavigation(e);
    };

    const safeHandleKeyboardShortcuts = (e) => {
      if (isMounted) handleKeyboardShortcuts(e);
    };

    window.addEventListener('keydown', safeHandleTabNavigation, true);
    window.addEventListener('keydown', safeHandleKeyboardShortcuts, true);
    
    return () => {
      isMounted = false;
      window.removeEventListener('keydown', safeHandleTabNavigation, true);
      window.removeEventListener('keydown', safeHandleKeyboardShortcuts, true);
    };
  }, [handleTabNavigation, handleKeyboardShortcuts]);

  return {
    handleTabNavigation,
    handleKeyboardShortcuts
  };
};

export default useKeyboardNavigation; 