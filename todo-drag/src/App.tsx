import React, { useState, useCallback, useEffect } from 'react';
import { DragDropContext, Draggable } from 'react-beautiful-dnd';
import type { DraggableProvided } from 'react-beautiful-dnd';
import './App.css';

import StrictModeDroppable from './components/StrictModeDroppable';
import SelectableItem from './components/SelectableItem';
import ProTipTooltip from './components/ProTipTooltip';
import LoadingSpinner from './components/LoadingSpinner';
import ErrorMessage from './components/ErrorMessage';
import DatabaseTest from './components/DatabaseTest';
import Modal from './components/Modal';
import { useDatabase, useColumns, useColumnItems } from './contexts/DatabaseContext';
import useQuickAdd from './hooks/useQuickAdd';
import { useColumnToggles } from './hooks/useColumnToggles';
import useDragDrop from './hooks/useDragDrop';

function App() {
  const { db } = useDatabase();
  const { columns, loading: columnsLoading } = useColumns();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [focusedItemId, setFocusedItemId] = useState<string | null>(null);
  const { showDone, showIgnore, toggleDoDone, toggleIgnoreOthers } = useColumnToggles();
  const [isDbTestOpen, setIsDbTestOpen] = useState(false);
  
  // Load items for each column
  const { items: doItems, loading: doLoading } = useColumnItems('do');
  const { items: doneItems, loading: doneLoading } = useColumnItems('done');
  const { items: ignoreItems, loading: ignoreLoading } = useColumnItems('ignore');
  const { items: othersItems, loading: othersLoading } = useColumnItems('others');
  const { items: emberItems, loading: emberLoading } = useColumnItems('ember');

  const isLoading = columnsLoading || doLoading || doneLoading || ignoreLoading || othersLoading || emberLoading;

  // Initialize drag and drop handling
  const { isRbdDragging, handleDragStart, handleDragEnd } = useDragDrop();

  // Add debug event listeners
  useEffect(() => {
    const debugEvents = (eventName: string, event: any) => {
      console.log('🔍 USER ACTION:', {
        action: eventName,
        details: {
          element: event.target.tagName,
          text: event.target.textContent?.slice(0, 50),
          location: `${event.clientX}, ${event.clientY}`
        },
        time: new Date().toLocaleTimeString()
      });
    };

    // Simpler, focused event handlers
    const handleClick = (e: MouseEvent) => {
      console.log('👆 CLICK:', e.target);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      console.log('⌨️ KEY:', {
        key: e.key,
        ctrl: e.ctrlKey,
        cmd: e.metaKey,
        shift: e.shiftKey
      });
    };

    // Add listeners for basic interactions
    document.addEventListener('click', handleClick, true);
    document.addEventListener('keydown', handleKeyDown, true);

    console.log('🚀 Debug listeners active - try clicking or typing!');

    return () => {
      document.removeEventListener('click', handleClick, true);
      document.removeEventListener('keydown', handleKeyDown, true);
      console.log('🛑 Debug listeners removed');
    };
  }, []);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      console.log('🎹 Keyboard Event:', {
        key: event.key,
        ctrl: event.ctrlKey,
        cmd: event.metaKey,
        shift: event.shiftKey
      });

      // Ctrl/Cmd + Shift + D to toggle database test
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'd') {
        console.log('🎯 Database Test Shortcut Triggered!');
        event.preventDefault();
        event.stopPropagation();
        
        setIsDbTestOpen(prev => {
          const newState = !prev;
          console.log(`${newState ? '📂 Opening' : '📁 Closing'} database test modal`);
          return newState;
        });
      }
    };

    console.log('⚡ Keyboard shortcut listener active (Try Cmd/Ctrl + Shift + D)');
    document.addEventListener('keydown', handleKeyPress, { capture: true });
    
    return () => {
      document.removeEventListener('keydown', handleKeyPress, { capture: true });
    };
  }, []);

  // Handle item updates
  const handleUpdateItem = async (itemId: string, updates: any) => {
    try {
      await db.updateItem(itemId, updates);
    } catch (error) {
      console.error('Failed to update item:', error);
    }
  };

  // Handle item click
  const handleItemClick = useCallback((itemId: string) => {
    setSelectedIds(prev => {
      if (prev.includes(itemId)) {
        return prev.filter(id => id !== itemId);
      }
      return [...prev, itemId];
    });
  }, []);

  // Handle pro tip action
  const handleProTipAction = useCallback((action: string) => {
    console.log('Pro tip action:', action);
  }, []);

  if (isLoading) {
    return <LoadingSpinner message="Loading your items..." />;
  }

  const renderColumn = (
    columnId: string,
    title: string,
    items: any[],
    onClick?: () => void
  ) => (
    <StrictModeDroppable droppableId={columnId}>
      {(provided) => (
        <div
          ref={provided.innerRef}
          {...provided.droppableProps}
          className={`column ${focusedItemId === columnId ? 'keyboard-focused' : ''}`}
        >
          <h2 onClick={onClick}>{title}</h2>
          {items.map((item, index) => (
            <Draggable key={item.id} draggableId={item.id} index={index}>
              {(dragProvided: DraggableProvided) => (
                <div
                  ref={dragProvided.innerRef}
                  {...dragProvided.draggableProps}
                  {...dragProvided.dragHandleProps}
                >
                  <SelectableItem
                    item={item}
                    isSelected={selectedIds.includes(item.id)}
                    isFocused={focusedItemId === item.id}
                    onClick={() => handleItemClick(item.id)}
                    onUpdate={(updates) => handleUpdateItem(item.id, updates)}
                    columnId={columnId}
                  />
                </div>
              )}
            </Draggable>
          ))}
          {provided.placeholder}
        </div>
      )}
    </StrictModeDroppable>
  );

  return (
    <>
      <DragDropContext onDragStart={(start) => {
        console.log('[DEBUG DRAG] Started:', start);
        handleDragStart(start);
      }} onDragEnd={(result) => {
        console.log('[DEBUG DRAG] Ended:', result);
        handleDragEnd(result);
      }}>
        <div className={`app-container ${isRbdDragging ? 'dragging-in-progress' : ''}`}>
          <ProTipTooltip onAction={handleProTipAction} />
          
          <div className="columns">
            {/* DO/DONE Column */}
            {renderColumn(
              showDone ? 'done' : 'do',
              showDone ? 'DONE' : 'DO',
              showDone ? doneItems : doItems,
              toggleDoDone
            )}

            {/* IGNORE/OTHERS Column */}
            {renderColumn(
              showIgnore ? 'ignore' : 'others',
              showIgnore ? 'IGNORE' : 'OTHERS',
              showIgnore ? ignoreItems : othersItems,
              toggleIgnoreOthers
            )}

            {/* EMBER Column */}
            {renderColumn('ember', 'EMBER', emberItems)}
          </div>
        </div>
      </DragDropContext>

      {/* Database Test Modal */}
      <Modal
        isOpen={isDbTestOpen}
        onClose={() => {
          console.log('[DEBUG MODAL] Closing database test modal');
          setIsDbTestOpen(false);
        }}
        title="Database Tests"
      >
        <DatabaseTest />
      </Modal>

      {/* Debug indicator with more info */}
      <div style={{ 
        position: 'fixed', 
        bottom: 10, 
        left: 10, 
        padding: '8px',
        background: 'rgba(0,0,0,0.8)',
        color: '#fff',
        borderRadius: '4px',
        fontSize: '12px',
        fontFamily: 'monospace',
        maxWidth: '300px',
        zIndex: 9999
      }}>
        <div>Modal: {isDbTestOpen ? 'Open' : 'Closed'}</div>
        <div>Items: {doItems.length + doneItems.length + ignoreItems.length + othersItems.length + emberItems.length}</div>
        <div>Selected: {selectedIds.length}</div>
        <div style={{ fontSize: '10px', marginTop: '4px', opacity: 0.7 }}>
          Press Cmd/Ctrl + Shift + D for tests
        </div>
      </div>
    </>
  );
}

export default App; 