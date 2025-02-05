# Cursor Rules & Meeting Notes

## Meeting Notes (Date: Feb 5, 2024)

### Issues Addressed
1. Fixed runtime errors in `SelectableItem` component
   - Added null check for undefined items
   - Unified prop naming (`item` instead of `todo`)
   - Added proper keyboard focus handling
   - Added warning message for invalid items

2. Restored and Fixed Undo Functionality
   - Maintained `history` state for tracking changes
   - Implemented proper undo mechanism with `handleUndo`
   - Added Cmd/Ctrl + Z keyboard shortcut
   - Uses `isUndoingRef` to prevent infinite loops

### Current Component Structure

#### SelectableItem Component
```javascript
const SelectableItem = ({ item, isSelected, isFocused, onClick, columnId }) => {
  // Guards against undefined items
  if (!item || !item.id) {
    console.warn('SelectableItem received undefined or invalid item');
    return null;
  }
  // ... rest of component
}
```

### Key Features

1. **Undo System**
   - Tracks all column changes in history
   - Allows undoing with Cmd/Ctrl + Z
   - Prevents recursive updates with `isUndoingRef`
   - Maintains state consistency

2. **Item Selection**
   - Keyboard focus support
   - Mouse selection
   - Multi-select with shift-click
   - Drag selection

3. **Column Management**
   - DO/DONE toggle
   - OTHERS/IGNORE toggle
   - Column-specific search
   - Blinking effects on column changes

4. **Data Persistence**
   - LocalStorage saving
   - Version management
   - Data migration support
   - Data validation

### Current State Management
```javascript
// Core States
const [columns, setColumns] = useState(() => initialState.current.columns);
const [selectedIds, setSelectedIds] = useState([]);
const [history, setHistory] = useState([]);

// UI States
const [showDone, setShowDone] = useState(false);
const [showIgnore, setShowIgnore] = useState(false);
const [focusedItemId, setFocusedItemId] = useState(null);
```

### Known Issues & Solutions
1. ESLint warning about unused `history` variable
   - False positive due to usage in `handleUndo`
   - Can be safely ignored as history is used properly

2. SelectableItem undefined errors
   - Fixed with proper null checks
   - Added warning system for debugging
   - Improved prop interface

### Development Rules
1. Always maintain undo functionality
2. Guard against undefined items in components
3. Use consistent prop naming across components
4. Implement proper keyboard navigation support
5. Maintain data persistence with version control

### Next Steps
1. Consider adding error boundaries
2. Improve type checking
3. Consider adding tests for edge cases
4. Document component interfaces

## Pro Tips System Guidelines

### Adding New Features
1. When adding a new feature that includes user interactions (shortcuts, gestures, or workflows):
   - Add a corresponding pro tip to the `PRO_TIPS` array in `ProTipTooltip.js`
   - Keep tips concise and start with "Try"
   - Focus on one action per tip

### Pro Tip Writing Guidelines
1. Format:
   - Start with "Try"
   - Be concise (max 60 characters recommended)
   - Focus on user benefit
   - Use consistent terminology

2. When to Add Tips:
   - Keyboard shortcuts
   - Mouse gestures
   - Multi-step workflows
   - Hidden/non-obvious features

3. Style:
   - Use active voice
   - Be friendly but professional
   - Avoid technical jargon
   - Use platform-agnostic terms (e.g., "Cmd/Ctrl" instead of just "Cmd")

### Example Pro Tips:
```javascript
"Try hovering over a column and pressing Cmd+A to select all items"
"Try dragging with mouse to select multiple items"
"Try double-clicking an item to edit it"
```

## Implementation Details
- Tips rotate every 5 seconds
- Users can click to see next tip
- Tips fade in/out during rotation
- Position: bottom-left, semi-transparent
- Non-intrusive design with subtle animations 