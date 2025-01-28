import React, { useState } from 'react';

// Human: Selectable item component that displays text with preserved formatting
// LLM: Component that handles multi-line text display and selection functionality
const SelectableItem = ({ todo, isSelected, onClick, columnId }) => {
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
    if (!wasJustDragged) {
      onClick(e);
    }
    setWasJustDragged(false);
  };

  // Format text to preserve line breaks and spaces
  const formatText = (text) => {
    return text.split('\n').map((line, i, arr) => (
      <React.Fragment key={i}>
        {line.split(' ').map((word, j) => (
          <React.Fragment key={j}>
            {word}
            {j < line.split(' ').length - 1 && ' '}
          </React.Fragment>
        ))}
        {i < arr.length - 1 && <br />}
      </React.Fragment>
    ));
  };

  return (
    <div
      className={`todo-item ${isSelected ? 'selected' : ''}`}
      data-id={todo.id}
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onMouseDown={() => setWasJustDragged(false)}
      onDragEnd={() => setWasJustDragged(true)}
      style={{
        display: 'block',
        width: '100%',
        position: 'relative',
        padding: '4px 8px',
        cursor: 'pointer',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        lineHeight: '1.5',
        backgroundColor: isSelected ? 'rgba(66, 153, 225, 0.1)' : 'transparent',
        borderRadius: '4px',
        transition: 'background-color 0.2s ease'
      }}
    >
      <span 
        style={{ 
          pointerEvents: 'auto',
          cursor: 'text',
          display: 'block',
          width: '100%'
        }}
      >
        {formatText(todo.text)}
      </span>
      {columnId === 'done' && todo.completedAt && isHovered && (
        <span 
          className="timestamp"
          style={{
            position: 'absolute',
            right: '8px',
            top: '4px',
            fontSize: '0.8em',
            color: '#666'
          }}
        >
          {formatTimeAgo(todo.completedAt)}
        </span>
      )}
    </div>
  );
};

export default SelectableItem; 