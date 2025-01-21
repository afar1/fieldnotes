import React, { useState } from 'react';

const SelectableItem = ({ isSelected, todo, onClick, onDoubleClick, columnId }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [wasJustDragged, setWasJustDragged] = useState(false);

  // Format the timestamp to show how long ago
  const formatTimeAgo = (timestamp) => {
    const diff = new Date() - new Date(timestamp);
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d`;
    if (hours > 0) return `${hours}h`;
    return `${minutes}m`;
  };

  // Handle click events
  const handleClick = (e) => {
    // If clicking the text directly and we weren't just dragging, treat as edit
    if (e.target.tagName.toLowerCase() === 'span' && !wasJustDragged) {
      onClick(e);
    }
    // Reset the drag state after handling the click
    setWasJustDragged(false);
  };

  return (
    <div
      className={`todo-item ${isSelected ? 'selected' : ''}`}
      data-id={todo.id}
      onClick={handleClick}
      onDoubleClick={onDoubleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onMouseDown={() => setWasJustDragged(false)}
      onDragEnd={() => setWasJustDragged(true)}
      style={{
        display: 'inline-block',
        maxWidth: 'fit-content',
        position: 'relative',
        padding: '0 8px',  // Add horizontal padding for larger clickable area
        cursor: 'pointer'
      }}
    >
      <span style={{ pointerEvents: 'auto', cursor: 'text' }}>{todo.text}</span>
      {columnId === 'done' && todo.completedAt && isHovered && (
        <span className="timestamp">{formatTimeAgo(todo.completedAt)}</span>
      )}
    </div>
  );
};

export default SelectableItem;