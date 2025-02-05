import React, { useState } from 'react';

const SelectableItem = ({ item, isSelected, isFocused, onClick, columnId }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [wasJustDragged, setWasJustDragged] = useState(false);

  // Guard against undefined item
  if (!item || !item.id) {
    console.warn('SelectableItem received undefined or invalid item');
    return null;
  }

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
      className={`todo-item ${isSelected ? 'selected' : ''} ${isFocused ? 'keyboard-focused' : ''}`}
      data-id={item.id}
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onMouseDown={() => setWasJustDragged(false)}
      onDragEnd={() => setWasJustDragged(true)}
      style={{
        display: 'inline-block',
        maxWidth: 'fit-content',
        position: 'relative',
        padding: '0 8px',
        cursor: 'pointer'
      }}
    >
      <span style={{ pointerEvents: 'auto', cursor: 'text' }}>{item.text}</span>
      {columnId === 'done' && item.completedAt && isHovered && (
        <span className="timestamp">{formatTimeAgo(item.completedAt)}</span>
      )}
    </div>
  );
};

export default SelectableItem;