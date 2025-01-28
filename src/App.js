import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { DragDropContext } from 'react-beautiful-dnd';
import Column from './components/Column';
import DoDoneColumn from './components/DoDoneColumn';
import useClipboard from './hooks/useClipboard';
import useSearch from './hooks/useSearch';
import useQuickAdd from './hooks/useQuickAdd';
import { COLUMNS, DEFAULT_COLUMNS } from './constants';
import { loadFromLocalStorage, saveToLocalStorage } from './utils/todoUtils';
import ErrorBoundary from './components/ErrorBoundary';

// Human: Main app component that manages the todo application state and layout
// LLM: Component orchestrates state management, drag-drop, and column interactions using custom hooks
const App = () => {
  // Core state
  const [columns, setColumns] = useState(() => loadFromLocalStorage() || DEFAULT_COLUMNS);
  const [selectedIds, setSelectedIds] = useState([]);
  const [editItemId, setEditItemId] = useState(null);
  const [effectiveColumn, setEffectiveColumn] = useState(null);
  const [keyboardFocusedColumn, setKeyboardFocusedColumn] = useState(null);
  const [showDone, setShowDone] = useState(false);
  const [doneBlinking, setDoneBlinking] = useState(false);

  // Custom hooks
  const {
    searchingColumn,
    columnSearch,
    setSearchingColumn,
    handleColumnSearch,
    filterItems,
    exitSearch
  } = useSearch((action) => {
    // Tip system notification handler
    console.log('Search action:', action);
  });

  const {
    clipboard,
    isCut,
    handleCopy,
    handleCut,
    handlePaste
  } = useClipboard({
    columns,
    setColumns,
    selectedIds,
    setSelectedIds,
    notifyTipAction: (action) => console.log('Clipboard action:', action)
  });

  const {
    quickAddColumn,
    setQuickAddColumn,
    handleQuickAddKeyDown,
    handleQuickAddBlur,
    renderQuickAddInput
  } = useQuickAdd({
    addTodo: (text, columnId) => {
      setColumns(prev => ({
        ...prev,
        [columnId]: {
          ...prev[columnId],
          items: [...prev[columnId].items, { id: `id-${Date.now()}`, text }]
        }
      }));
    },
    startEditItem: (item) => setEditItemId(item.id),
    columns,
    getPreviousColumnId: (currentId) => {
      const columnOrder = [COLUMNS.DO, COLUMNS.IGNORE, COLUMNS.OTHERS];
      const currentIndex = columnOrder.indexOf(currentId);
      return currentIndex > 0 ? columnOrder[currentIndex - 1] : null;
    }
  });

  // Persist state to localStorage
  useEffect(() => {
    saveToLocalStorage(columns);
  }, [columns]);

  // Handle drag end
  const onDragEnd = useCallback((result) => {
    if (!result.destination) return;

    const { source, destination } = result;
    setColumns(prev => {
      const updated = { ...prev };
      const [removed] = updated[source.droppableId].items.splice(source.index, 1);
      updated[destination.droppableId].items.splice(destination.index, 0, removed);
      return updated;
    });
  }, []);

  // Column event handlers
  const handleHeaderClick = useCallback((columnId) => {
    setSearchingColumn(columnId);
  }, [setSearchingColumn]);

  const handleQuickAddClick = useCallback((columnId) => {
    setQuickAddColumn(columnId);
  }, [setQuickAddColumn]);

  const handleItemClick = useCallback((e, item, columnId) => {
    if (e.metaKey || e.ctrlKey) {
      setEditItemId(item.id);
    } else {
      // Move to DONE column with blink effect
      setColumns(prev => {
        const sourceColumn = prev[columnId];
        const updatedSource = {
          ...sourceColumn,
          items: sourceColumn.items.filter(i => i.id !== item.id)
        };
        
        const doneColumn = prev[COLUMNS.DONE];
        const updatedDone = {
          ...doneColumn,
          items: [{ ...item, completedAt: new Date().toISOString() }, ...doneColumn.items]
        };

        return {
          ...prev,
          [columnId]: updatedSource,
          [COLUMNS.DONE]: updatedDone
        };
      });
      setDoneBlinking(true);
      setTimeout(() => setDoneBlinking(false), 1000);
    }
  }, []);

  const handleItemEditSave = useCallback((columnId, itemId, newText) => {
    setColumns(prev => ({
      ...prev,
      [columnId]: {
        ...prev[columnId],
        items: prev[columnId].items.map(item =>
          item.id === itemId ? { ...item, text: newText } : item
        )
      }
    }));
    setEditItemId(null);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyboard = (e) => {
      // Don't handle shortcuts when typing in an input
      if (e.target.tagName === 'INPUT') return;

      // Copy/Cut/Paste
      if (e.metaKey || e.ctrlKey) {
        switch (e.key) {
          case 'c':
            e.preventDefault();
            handleCopy();
            break;
          case 'x':
            e.preventDefault();
            handleCut();
            break;
          case 'v':
            e.preventDefault();
            if (effectiveColumn) {
              handlePaste(effectiveColumn);
            }
            break;
          case 'z':
            // Undo functionality could be added here
            break;
          default:
            break;
        }
      }

      // Column navigation
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        const columnOrder = [COLUMNS.DO, COLUMNS.IGNORE, COLUMNS.OTHERS];
        const currentIndex = columnOrder.indexOf(keyboardFocusedColumn);
        
        if (currentIndex === -1) {
          setKeyboardFocusedColumn(columnOrder[0]);
        } else {
          const nextIndex = e.key === 'ArrowLeft' 
            ? Math.max(0, currentIndex - 1)
            : Math.min(columnOrder.length - 1, currentIndex + 1);
          setKeyboardFocusedColumn(columnOrder[nextIndex]);
        }
      }

      // Quick add with keyboard
      if (e.key === 'Enter' && keyboardFocusedColumn && !editItemId) {
        e.preventDefault();
        setQuickAddColumn(keyboardFocusedColumn);
      }
    };

    window.addEventListener('keydown', handleKeyboard);
    return () => window.removeEventListener('keydown', handleKeyboard);
  }, [
    handleCopy,
    handleCut,
    handlePaste,
    effectiveColumn,
    keyboardFocusedColumn,
    editItemId,
    setQuickAddColumn
  ]);

  // Render
  return (
    <ErrorBoundary>
      <div className="app">
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="columns-container">
            <ErrorBoundary>
              <DoDoneColumn
                showDone={showDone}
                doneBlinking={doneBlinking}
                onToggle={() => setShowDone(prev => !prev)}
                items={columns[showDone ? COLUMNS.DONE : COLUMNS.DO].items}
                isKeyboardFocused={keyboardFocusedColumn}
                isEffectiveColumn={effectiveColumn}
                editItemId={editItemId}
                selectedIds={selectedIds}
                isSearching={searchingColumn === (showDone ? COLUMNS.DONE : COLUMNS.DO)}
                searchValue={columnSearch[showDone ? COLUMNS.DONE : COLUMNS.DO]}
                quickAddColumn={quickAddColumn}
                onSearchChange={handleColumnSearch}
                onSearchExit={exitSearch}
                onHeaderClick={handleHeaderClick}
                onQuickAddClick={handleQuickAddClick}
                onItemClick={handleItemClick}
                onItemEditSave={handleItemEditSave}
                onItemEditCancel={() => setEditItemId(null)}
                onColumnHover={setEffectiveColumn}
                renderQuickAddInput={renderQuickAddInput}
                filterItems={filterItems}
              />
            </ErrorBoundary>
            
            {[COLUMNS.IGNORE, COLUMNS.OTHERS].map(columnId => (
              <ErrorBoundary key={`error-${columnId}`}>
                <Column
                  key={columnId}
                  id={columnId}
                  name={columnId === COLUMNS.IGNORE ? 'IGNORE' : 'OTHERS'}
                  items={columns[columnId].items}
                  isKeyboardFocused={keyboardFocusedColumn === columnId}
                  isEffectiveColumn={effectiveColumn === columnId}
                  editItemId={editItemId}
                  selectedIds={selectedIds}
                  isSearching={searchingColumn === columnId}
                  searchValue={columnSearch[columnId]}
                  quickAddColumn={quickAddColumn}
                  onSearchChange={handleColumnSearch}
                  onSearchExit={exitSearch}
                  onHeaderClick={handleHeaderClick}
                  onQuickAddClick={handleQuickAddClick}
                  onItemClick={handleItemClick}
                  onItemEditSave={handleItemEditSave}
                  onItemEditCancel={() => setEditItemId(null)}
                  onColumnHover={setEffectiveColumn}
                  renderQuickAddInput={renderQuickAddInput}
                  filterItems={filterItems}
                />
              </ErrorBoundary>
            ))}
          </div>
        </DragDropContext>
      </div>
    </ErrorBoundary>
  );
};

export default App; 
