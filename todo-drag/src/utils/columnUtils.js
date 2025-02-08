import { COLUMN_SEQUENCE } from '../constants';

export const findNearestColumn = (sourceColumnId, clientPosition) => {
  const columns = document.querySelectorAll('.column');
  let nearestColumn = null;
  let shortestDistance = Infinity;

  columns.forEach(column => {
    const rect = column.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const distance = Math.sqrt(
      Math.pow(clientPosition.x - centerX, 2) + 
      Math.pow(clientPosition.y - centerY, 2)
    );

    if (distance < shortestDistance) {
      shortestDistance = distance;
      nearestColumn = column.id.replace('column-', '');
    }
  });

  return nearestColumn;
};

export const getPreviousColumnId = (currentColumnId) => {
  const index = COLUMN_SEQUENCE.indexOf(currentColumnId);
  if (index <= 0) return null;
  return COLUMN_SEQUENCE[index - 1];
};

export const startEditItem = (item, columns, setQuickAddColumn) => {
  const column = Object.entries(columns).find(([_, col]) => 
    col.items.some(i => i.id === item.id)
  )?.[0];
  
  if (column) {
    setQuickAddColumn(column);
  }
}; 