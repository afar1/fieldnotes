/**
 * Compute a new position value for inserting or moving an item in a sorted list.
 * Uses 1000-step spacing to allow many insertions without renormalization.
 * 
 * @param index - Target index in the list (0 = top, length = bottom)
 * @param items - Array of items with position values, sorted by position descending
 * @returns New position value for the item
 */
export function computeNewPosition(
  index: number,
  items: { position: number }[]
): number {
  if (index === 0) {
    // Insert at top: add 1000 to the current top position
    const top = items.length ? items[0].position : 0;
    return top + 1000;
  }
  
  if (index >= items.length) {
    // Insert at bottom: subtract 1000 from the current bottom position
    const bottom = items[items.length - 1]?.position ?? 0;
    return Math.max(bottom - 1000, 0);
  }
  
  // Insert between neighbors: average the positions
  const prev = items[index - 1].position;
  const next = items[index].position;
  return Math.floor((prev + next) / 2);
}
