import React, { useState, useRef, useEffect } from 'react';

const SelectableItem = ({ item, isSelected, isFocused, onClick, onUpdate, columnId }) => {
  const [wasJustDragged, setWasJustDragged] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const inputRef = useRef(null);

  // Set initial edit text when item changes
  useEffect(() => {
    if (item && item.text) {
      setEditText(item.text);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // Only depend on item.text, not entire item object to avoid unnecessary re-runs
    // when other item properties change (e.g., completedAt, metadata)
  }, [item?.text]);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      // Move cursor to end of text
      const length = inputRef.current.value.length;
      inputRef.current.setSelectionRange(length, length);
    }
  }, [isEditing]);

  // Guard against undefined item
  if (!item || !item.id) {
    console.warn('SelectableItem received undefined or invalid item');
    return null;
  }

  // Format the completion date
  const formatCompletionDate = (timestamp) => {
    const completionDate = new Date(timestamp);
    const currentDate = new Date();
    const month = completionDate.getMonth() + 1;
    const day = completionDate.getDate();
    
    // Show year only if it's not the current year
    if (completionDate.getFullYear() !== currentDate.getFullYear()) {
      return `${month}/${day}/${completionDate.getFullYear().toString().slice(2)}`;
    }
    return `${month}/${day}`;
  };

  // Handle click events
  const handleClick = (e) => {
    if (wasJustDragged) {
      setWasJustDragged(false);
      return;
    }
    
    if (e.shiftKey || e.metaKey || e.ctrlKey) {
      onClick(e);
    } else {
      setIsEditing(true);
    }
  };

  // Handle edit completion
  const handleEditComplete = () => {
    setIsEditing(false);
    const trimmedText = editText.trim();
    if (trimmedText !== item.text && trimmedText !== '') {
      onUpdate(trimmedText);
    } else {
      setEditText(item.text);
    }
  };

  // Handle key press in edit mode
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === 'Escape') {
      handleEditComplete();
    }
  };

  return (
    <div
      className={`todo-item ${isSelected ? 'selected' : ''} ${isFocused ? 'keyboard-focused' : ''}`}
      data-id={item.id}
      onClick={handleClick}
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
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          onBlur={handleEditComplete}
          onKeyDown={handleKeyDown}
          className="edit-input"
          style={{
            minWidth: '200px',
            background: 'transparent',
            padding: '4px 8px',
            border: 'none',
            borderRadius: '3px'
          }}
        />
      ) : (
        <>
          <span style={{ pointerEvents: 'auto', cursor: 'text' }}>{item.text}</span>
          {columnId === 'done' && item.completedAt && (
            <span className="timestamp">{formatCompletionDate(item.completedAt)}</span>
          )}
        </>
      )}
    </div>
  );
};

export default SelectableItem;