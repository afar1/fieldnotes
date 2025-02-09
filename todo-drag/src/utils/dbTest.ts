import { db } from '../services/database';

export const testDatabaseOperations = async () => {
  const results: { [key: string]: boolean } = {
    addItem: false,
    updateItem: false,
    deleteItem: false,
    getItems: false,
    columnOperations: false,
  };

  try {
    // Test adding an item
    console.log('Testing: Adding item...');
    const newItemId = await db.addItem({
      id: `test-${Date.now()}`,
      text: 'Test Item',
      columnId: 'do',
    });
    results.addItem = true;
    console.log('✅ Add item successful');

    // Test updating the item
    console.log('Testing: Updating item...');
    await db.updateItem(newItemId, {
      text: 'Updated Test Item',
    });
    const items = await db.getItemsByColumn('do');
    const updatedItem = items.find(item => item.id === newItemId);
    results.updateItem = updatedItem?.text === 'Updated Test Item';
    console.log('✅ Update item successful');

    // Test getting items
    console.log('Testing: Getting items...');
    const allItems = await db.getItemsByColumn('do');
    results.getItems = Array.isArray(allItems);
    console.log('✅ Get items successful');

    // Test column operations
    console.log('Testing: Column operations...');
    const columns = await db.getAllColumns();
    results.columnOperations = columns.length > 0;
    console.log('✅ Column operations successful');

    // Test deleting the item
    console.log('Testing: Deleting item...');
    await db.deleteItem(newItemId);
    const itemsAfterDelete = await db.getItemsByColumn('do');
    results.deleteItem = !itemsAfterDelete.some(item => item.id === newItemId);
    console.log('✅ Delete item successful');

    // Overall results
    console.log('\nTest Results:');
    Object.entries(results).forEach(([test, passed]) => {
      console.log(`${passed ? '✅' : '❌'} ${test}: ${passed ? 'PASSED' : 'FAILED'}`);
    });

    return {
      success: Object.values(results).every(result => result),
      results
    };
  } catch (error) {
    console.error('Database test failed:', error);
    return {
      success: false,
      error,
      results
    };
  }
}; 