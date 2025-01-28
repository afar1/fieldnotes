import { useState, useCallback, useRef } from 'react';
import { UI } from '../constants';

/**
 * Custom hook for drag and drop functionality
 * @param {Object} params - Hook parameters
 * @param {Function} params.setSelectedIds - Function to set selected IDs
 * @param {Function} params.setColumns - Function to update columns
 * @param {Function} params.notifyTipAction - Function to notify tip system
 * @returns {Object} Drag and drop handlers and state
 */
export const useDragAndDrop = ({
  setSelectedIds,
  setColumns,
  notifyTipAction
}) => {
  // State for drag operations
  const [isDragging, setIsDragging] = useState(false);
  const [isRbdDragging, setIsRbdDragging] = useState(false);
  const [hasMoved, setHasMoved] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragEnd, setDragEnd] = useState({ x: 0, y: 0 });
  const dragStartPos = useRef(null);

  /**
   * Handle mouse movement during drag
   */
  const handleMouseMove = useCallback((e) => {
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
    const hasDraggedEnough = 
      Math.abs(dragStart.x - e.clientX) > UI.DRAG_THRESHOLD || 
      Math.abs(dragStart.y - e.clientY) > UI.DRAG_THRESHOLD;
    
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
  }, [isDragging, isRbdDragging, dragStart, hasMoved, setSelectedIds]);

  /**
   * Handle drag start
   */
  const handleMouseDown = useCallback((e) => {
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
  }, [isRbdDragging, setSelectedIds]);

  /**
   * Handle drag end
   */
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  /**
   * Find nearest column during drag
   */
  const findNearestColumn = useCallback((source, dragEndClient) => {
    if (!dragStartPos.current || !dragEndClient) return null;

    // Calculate total drag movement
    const dragDelta = {
      x: dragEndClient.x - dragStartPos.current.x,
      y: dragEndClient.y - dragStartPos.current.y
    };

    // Check minimum drag threshold
    if (Math.abs(dragDelta.x) < UI.MIN_DRAG_MOVEMENT) return null;

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

    // Determine drag direction and filter possible targets
    const isDraggingRight = dragDelta.x > 0;
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

  return {
    isDragging,
    isRbdDragging,
    hasMoved,
    dragStart,
    dragEnd,
    dragStartPos,
    setIsDragging,
    setIsRbdDragging,
    setHasMoved,
    handleMouseMove,
    handleMouseDown,
    handleMouseUp,
    findNearestColumn
  };
};

export default useDragAndDrop; 