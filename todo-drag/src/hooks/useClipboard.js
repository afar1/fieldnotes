import { useState, useCallback } from 'react';
import { createTodoItem } from '../utils/todoUtils';
import { COLUMNS } from '../constants';

/**
 * Custom hook for clipboard operations
 * @param {Object} params - Hook parameters
 * @param {Object} params.columns - Columns state
 * @param {Function} params.setColumns - Function to update columns
 * @param {string[]} params.selectedIds - Array of selected item IDs
 * @param {Function} params.setSelectedIds - Function to update selected IDs
 * @param {Function} params.notifyTipAction - Function to notify tip system
 * @returns {Object} Clipboard handlers
 */
export const useClipboard = ({
  columns,
  setColumns,
  selectedIds,
  setSelectedIds,
  notifyTipAction
}) => {
  const [clipboard, setClipboard] = useState([]);
  const [isCut, setIsCut] = useState(false);

  /**
   * Handle copy operation
   */
  const handleCopy = useCallback(() => {
    if (selectedIds.length === 0) return;
    
    const itemsToCopy = [];
    Object.values(columns).forEach(column => {
      column.items.forEach(item => {
        if (selectedIds.includes(item.id)) {
          itemsToCopy.push({ 
            ...item, 
            originalId: item.id, 
            id: `id-${Date.now()}-${Math.random()}` 
          });
        }
      });
    });
    
    setClipboard(itemsToCopy);
    setIsCut(false);
    notifyTipAction('copy');
  }, [selectedIds, columns, notifyTipAction]);

  /**
   * Handle cut operation
   */
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
  }, [selectedIds, handleCopy, setColumns, setSelectedIds, notifyTipAction]);

  /**
   * Handle paste operation
   */
  const handlePaste = useCallback((targetColumnId) => {
    if (clipboard.length === 0 || !targetColumnId) return;
    
    setColumns(prev => {
      const updated = { ...prev };
      const targetColumn = updated[targetColumnId];
      
      // Create new items with fresh IDs
      const newItems = clipboard.map(item => ({
        ...item,
        id: `id-${Date.now()}-${Math.random()}`,
        completedAt: targetColumnId === COLUMNS.DONE ? 
          new Date().toISOString() : undefined
      }));
      
      updated[targetColumnId] = {
        ...targetColumn,
        items: targetColumnId === COLUMNS.DONE ? 
          [...newItems, ...targetColumn.items] :
          [...targetColumn.items, ...newItems]
      };
      
      return updated;
    });
    
    // Clear clipboard if this was a cut operation
    if (isCut) {
      setClipboard([]);
      setIsCut(false);
    }
    
    notifyTipAction('paste');
  }, [clipboard, isCut, setColumns, notifyTipAction]);

  return {
    clipboard,
    isCut,
    handleCopy,
    handleCut,
    handlePaste
  };
};

export default useClipboard; 