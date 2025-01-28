import React, { memo } from 'react';
import { Draggable } from 'react-beautiful-dnd';
import StrictModeDroppable from './StrictModeDroppable';
import SelectableItem from './SelectableItem';
import EditableItem from './EditableItem';

const Column = memo(({
  id,
  name,
  items,
  isKeyboardFocused,
  isEffectiveColumn,
  editItemId,
  selectedIds,
  isSearching,
  searchValue,
  quickAddColumn,
  onSearchChange,
  onSearchExit,
  onHeaderClick,
  onQuickAddClick,
  onItemClick,
  onItemEdit,
  onItemEditSave,
  onItemEditCancel,
  onColumnHover,
  renderQuickAddInput,
  isDraggingOver,
  filterItems
}) => {
  return (
    <div 
      className={`column ${isKeyboardFocused ? 'keyboard-focused' : ''}`}
    >
      {isSearching ? (
        <input
          className="column-search"
          placeholder={`Search in ${name}...`}
          value={searchValue}
          autoFocus
          onChange={(e) => onSearchChange(id, e.target.value)}
          onBlur={() => onSearchExit(id)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === 'Escape') {
              onSearchExit(id);
            }
          }}
        />
      ) : (
        <h2 
          onClick={() => onHeaderClick(id)}
          className={isEffectiveColumn ? 'hovered' : ''}
        >
          {name}
        </h2>
      )}
      <StrictModeDroppable droppableId={id}>
        {(provided, snapshot) => (
          <div
            id={`column-${id}`}
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`droppable-area ${isDraggingOver ? 'dragging-over' : ''}`}
            onMouseEnter={() => onColumnHover(id)}
            onMouseLeave={() => onColumnHover(null)}
          >
            {filterItems(items, id).map((item, index) => (
              <Draggable 
                key={item.id} 
                draggableId={item.id} 
                index={index}
              >
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    className={selectedIds.includes(item.id) ? 'selected' : ''}
                    style={{
                      ...provided.draggableProps.style,
                      opacity: snapshot.isDragging ? 0.8 : 1,
                    }}
                  >
                    {editItemId === item.id ? (
                      <EditableItem
                        item={item}
                        onSave={(newText) => onItemEditSave(id, item.id, newText)}
                        onCancel={onItemEditCancel}
                      />
                    ) : (
                      <SelectableItem
                        todo={item}
                        isSelected={selectedIds.includes(item.id)}
                        onClick={(e) => onItemClick(e, item, id)}
                        columnId={id}
                      />
                    )}
                  </div>
                )}
              </Draggable>
            ))}
            {isEffectiveColumn && !quickAddColumn && (
              <div 
                className="cursor-line"
                onClick={() => onQuickAddClick(id)}
              />
            )}
            {renderQuickAddInput(id)}
            {provided.placeholder}
          </div>
        )}
      </StrictModeDroppable>
    </div>
  );
});

Column.displayName = 'Column';

export default Column; 