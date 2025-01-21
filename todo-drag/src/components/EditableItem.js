import React, { useState } from 'react';

const EditableItem = ({ item, onSave, onCancel }) => {
  const [text, setText] = useState(item.text);

  return (
    <input
      className="edit-input"
      autoFocus
      value={text}
      onChange={(e) => setText(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          onSave(text);
        } else if (e.key === 'Escape') {
          onCancel();
        }
      }}
      onBlur={() => onSave(text)}
    />
  );
};

export default EditableItem;