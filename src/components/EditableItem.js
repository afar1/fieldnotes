import React, { useState, useEffect, useRef } from 'react';

// Human: Enhanced editable item component with text editor capabilities
// LLM: Component that provides text editor-like functionality with line breaks and natural editing
const EditableItem = ({ item, onSave, onCancel }) => {
  const [text, setText] = useState(item.text);
  const textareaRef = useRef(null);

  // Auto-resize textarea as content changes
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [text]);

  // Handle initial focus and cursor position
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.selectionStart = textareaRef.current.value.length;
    }
  }, []);

  const handleKeyDown = (e) => {
    // Handle special keys
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      // Cmd/Ctrl + Enter to save
      e.preventDefault();
      onSave(text);
    } else if (e.key === 'Enter' && !e.shiftKey) {
      // Regular Enter for new line
      e.preventDefault();
      const cursorPosition = e.target.selectionStart;
      const textBeforeCursor = text.substring(0, cursorPosition);
      const textAfterCursor = text.substring(cursorPosition);
      setText(textBeforeCursor + '\n' + textAfterCursor);
      
      // Set cursor position after the new line
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = cursorPosition + 1;
          textareaRef.current.selectionEnd = cursorPosition + 1;
        }
      }, 0);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    } else if (e.key === 'Tab') {
      // Handle tab key for indentation
      e.preventDefault();
      const cursorPosition = e.target.selectionStart;
      const textBeforeCursor = text.substring(0, cursorPosition);
      const textAfterCursor = text.substring(cursorPosition);
      setText(textBeforeCursor + '  ' + textAfterCursor);
      
      // Set cursor position after the tab
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = cursorPosition + 2;
          textareaRef.current.selectionEnd = cursorPosition + 2;
        }
      }, 0);
    }
  };

  return (
    <textarea
      ref={textareaRef}
      className="edit-textarea"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={() => onSave(text)}
      style={{
        width: '100%',
        minHeight: '24px',
        padding: '4px 8px',
        border: '1px solid #ddd',
        borderRadius: '4px',
        fontFamily: 'inherit',
        fontSize: 'inherit',
        lineHeight: '1.5',
        resize: 'none',
        overflow: 'hidden',
        backgroundColor: '#fff',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      }}
    />
  );
};

export default EditableItem; 