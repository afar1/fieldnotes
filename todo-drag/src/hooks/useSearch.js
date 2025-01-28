import { useState, useCallback } from 'react';
import { COLUMNS } from '../constants';

/**
 * Custom hook for search functionality
 * @param {Function} notifyTipAction - Function to notify tip system
 * @returns {Object} Search state and handlers
 */
export const useSearch = (notifyTipAction) => {
  const [searchingColumn, setSearchingColumn] = useState(null);
  const [columnSearch, setColumnSearch] = useState({
    [COLUMNS.DO]: '',
    [COLUMNS.DONE]: '',
    [COLUMNS.IGNORE]: '',
    [COLUMNS.OTHERS]: ''
  });

  /**
   * Handle column search
   * @param {string} columnId - Column ID
   * @param {string} searchText - Search text
   */
  const handleColumnSearch = useCallback((columnId, searchText) => {
    setColumnSearch(prev => ({
      ...prev,
      [columnId]: searchText.toLowerCase()
    }));
    notifyTipAction('column-search');
  }, [notifyTipAction]);

  /**
   * Filter items based on search
   * @param {Array} items - Items to filter
   * @param {string} columnId - Column ID
   * @returns {Array} Filtered items
   */
  const filterItems = useCallback((items, columnId) => {
    const searchText = columnSearch[columnId];
    if (!searchText) return items;

    return items.filter(item => 
      item.text.toLowerCase().includes(searchText)
    );
  }, [columnSearch]);

  /**
   * Exit search mode for a column
   * @param {string} columnId - Column ID
   */
  const exitSearch = useCallback((columnId) => {
    setSearchingColumn(null);
    setColumnSearch(prev => ({
      ...prev,
      [columnId]: ''
    }));
  }, []);

  return {
    searchingColumn,
    columnSearch,
    setSearchingColumn,
    handleColumnSearch,
    filterItems,
    exitSearch
  };
};

export default useSearch; 