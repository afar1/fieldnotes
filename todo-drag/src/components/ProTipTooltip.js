import React, { useState, useEffect, useCallback } from 'react';
import './ProTipTooltip.css';

const TIPS_CONFIG = {
  selectAll: {
    text: "Try hovering over a column and pressing Cmd+A to select all items",
    check: (action) => action === 'select-all',
  },
  quickAdd: {
    text: "Try hovering over a column and start typing to quick-add",
    check: (action) => action === 'quick-add',
  },
  clickEdit: {
    text: "Try clicking an item to edit it",
    check: (action) => action === 'click-edit',
  },
  cmdClick: {
    text: "Try Cmd+Click (Ctrl+Click) to move an item to the next column",
    check: (action) => action === 'cmd-click-move',
  },
  dragMove: {
    text: "Try dragging items between columns",
    check: (action) => action === 'drag-move',
  },
  columnSearch: {
    text: "Try hovering a column and clicking its title to search",
    check: (action) => action === 'column-search',
  },
};

const ProTipTooltip = ({ onAction }) => {
  const [currentTipKey, setCurrentTipKey] = useState(Object.keys(TIPS_CONFIG)[0]);
  const [isVisible, setIsVisible] = useState(true);
  const [completedTips, setCompletedTips] = useState(() => {
    try {
      const saved = localStorage.getItem('completed-tips');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Save completed tips to localStorage
  useEffect(() => {
    localStorage.setItem('completed-tips', JSON.stringify(completedTips));
  }, [completedTips]);

  const getNextTip = useCallback(() => {
    const availableTips = Object.entries(TIPS_CONFIG)
      .filter(([key]) => (completedTips[key] || 0) < 2);
    
    if (availableTips.length === 0) return null;

    const currentIndex = availableTips.findIndex(([key]) => key === currentTipKey);
    const nextIndex = (currentIndex + 1) % availableTips.length;
    return availableTips[nextIndex][0];
  }, [currentTipKey, completedTips]);

  const rotateTip = useCallback(() => {
    const nextTip = getNextTip();
    if (!nextTip) {
      setIsVisible(false);
      return;
    }

    setIsVisible(false);
    setTimeout(() => {
      setCurrentTipKey(nextTip);
      setIsVisible(true);
    }, 800);
  }, [getNextTip]);

  // Handle action completion and auto-rotate
  useEffect(() => {
    if (!onAction) return;

    const handleAction = (action) => {
      const currentTip = TIPS_CONFIG[currentTipKey];
      if (currentTip.check(action)) {
        setCompletedTips(prev => {
          const count = (prev[currentTipKey] || 0) + 1;
          return { ...prev, [currentTipKey]: count };
        });
        // Auto-rotate 3 seconds after completing the action
        setTimeout(rotateTip, 3000);
      }
    };

    onAction(handleAction);
    return () => onAction(null);
  }, [currentTipKey, onAction, rotateTip]);

  // Only show tip if it hasn't been completed twice
  useEffect(() => {
    if ((completedTips[currentTipKey] || 0) >= 2) {
      rotateTip();
    }
  }, [completedTips, currentTipKey, rotateTip]);

  // Don't render if no tips available
  if (!TIPS_CONFIG[currentTipKey] || Object.keys(completedTips).length === Object.keys(TIPS_CONFIG).length) {
    return null;
  }

  return (
    <div 
      className="pro-tip-footer"
      onClick={() => {
        rotateTip();
        // Reset visibility to trigger fade animation
        setIsVisible(v => !v);
        setTimeout(() => setIsVisible(true), 0);
      }}
      title="Click to see next tip"
    >
      <div className={`pro-tip-tooltip ${isVisible ? 'visible' : 'hidden'}`}>
        <span className="tip-prefix">💡 </span>
        {TIPS_CONFIG[currentTipKey].text}
      </div>
    </div>
  );
};

export default ProTipTooltip; 