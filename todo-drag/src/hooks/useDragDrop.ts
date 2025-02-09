import { useCallback, useState } from 'react';
import type { DropResult } from 'react-beautiful-dnd';
import { useDatabase } from '../contexts/DatabaseContext';

interface UseDragDropProps {
  onDragStateChange?: (isDragging: boolean) => void;
}

export const useDragDrop = ({ onDragStateChange }: UseDragDropProps = {}) => {
  const { db } = useDatabase();
  const [isRbdDragging, setIsRbdDragging] = useState(false);

  const handleDragStart = useCallback(() => {
    setIsRbdDragging(true);
    onDragStateChange?.(true);
  }, [onDragStateChange]);

  const handleDragEnd = useCallback(async (result: DropResult) => {
    setIsRbdDragging(false);
    onDragStateChange?.(false);

    const { destination, source, draggableId } = result;

    if (!destination) return;

    // Don't do anything if dropped in the same place
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    try {
      await db.updateItem(draggableId, {
        columnId: destination.droppableId,
        // You might want to update the order/index here as well
      });
    } catch (error) {
      console.error('Failed to update item after drag:', error);
      // You might want to show a user-friendly error message here
    }
  }, [db, onDragStateChange]);

  return {
    isRbdDragging,
    handleDragStart,
    handleDragEnd,
  };
};

export default useDragDrop; 