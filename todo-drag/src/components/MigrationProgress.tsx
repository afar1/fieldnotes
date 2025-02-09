import React from 'react';
import './MigrationProgress.css';

interface MigrationProgressProps {
  stage: 'backup' | 'migration' | 'complete' | 'error';
  error?: string;
  onRetry?: () => void;
}

const MigrationProgress: React.FC<MigrationProgressProps> = ({
  stage,
  error,
  onRetry
}) => {
  const getStageMessage = () => {
    switch (stage) {
      case 'backup':
        return 'Backing up your data...';
      case 'migration':
        return 'Migrating your data to the new database...';
      case 'complete':
        return 'Migration complete! Loading your data...';
      case 'error':
        return `Migration failed: ${error}`;
      default:
        return 'Preparing migration...';
    }
  };

  return (
    <div className="migration-progress">
      <div className="migration-content">
        <h2>Database Update</h2>
        <p className="migration-message">{getStageMessage()}</p>
        
        {stage !== 'error' && (
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{
                width: stage === 'complete' ? '100%' : 
                      stage === 'migration' ? '66%' : 
                      stage === 'backup' ? '33%' : '0%'
              }}
            />
          </div>
        )}

        {stage === 'error' && onRetry && (
          <button className="retry-button" onClick={onRetry}>
            Try Again
          </button>
        )}

        <p className="migration-note">
          {stage !== 'error' 
            ? "Please don't close your browser during this process."
            : 'Your original data is safely backed up.'}
        </p>
      </div>
    </div>
  );
};

export default MigrationProgress; 