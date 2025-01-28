import React, { memo } from 'react';
import Column from './Column';
import { COLUMNS } from '../constants';

const DoDoneColumn = memo(({
  showDone,
  doneBlinking,
  onToggle,
  ...columnProps
}) => {
  const currentId = showDone ? COLUMNS.DONE : COLUMNS.DO;
  
  return (
    <div className="do-done-column">
      <h2 
        onClick={onToggle}
        className={columnProps.isEffectiveColumn ? 'hovered' : ''}
      >
        {showDone ? (
          <>
            <span className="done-text">DO</span> / <span className={doneBlinking ? 'blink-done' : ''}>DONE</span>
          </>
        ) : (
          <>
            DO / <span className={`done-text ${doneBlinking ? 'blink-done' : ''}`}>DONE</span>
          </>
        )}
      </h2>
      <Column
        {...columnProps}
        id={currentId}
        name={showDone ? 'DONE' : 'DO'}
        isKeyboardFocused={columnProps.isKeyboardFocused === currentId}
        isEffectiveColumn={columnProps.isEffectiveColumn === currentId}
      />
    </div>
  );
});

DoDoneColumn.displayName = 'DoDoneColumn';

export default DoDoneColumn; 