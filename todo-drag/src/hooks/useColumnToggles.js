import { useCallback } from 'react';

export const useColumnToggles = (setShowDone, setShowIgnore, setIsMigrating) => {
  const toggleDoDone = useCallback(() => {
    setShowDone(prev => !prev);
  }, [setShowDone]);

  const toggleOthersIgnore = useCallback(() => {
    setShowIgnore(prev => !prev);
  }, [setShowIgnore]);

  const handleMigrationComplete = useCallback(() => {
    setIsMigrating(false);
  }, [setIsMigrating]);

  return {
    toggleDoDone,
    toggleOthersIgnore,
    handleMigrationComplete
  };
}; 