# Cursor Development Rules

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