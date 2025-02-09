import React, { useState } from 'react';
import { testDatabaseOperations } from '../utils/dbTest';
import './DatabaseTest.css';

interface TestResults {
  success: boolean;
  results: { [key: string]: boolean };
  error?: any;
}

const DatabaseTest: React.FC = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<TestResults | null>(null);

  const runTests = async () => {
    setIsRunning(true);
    setResults(null);
    
    try {
      const testResults = await testDatabaseOperations();
      setResults(testResults);
    } catch (error) {
      setResults({
        success: false,
        results: {},
        error
      });
    } finally {
      setIsRunning(false);
    }
  };

  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const modKey = isMac ? '⌘' : 'Ctrl';

  return (
    <div className="database-test">
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
        <span className="keyboard-shortcut">
          {modKey} + Shift + D
        </span>
      </div>
      
      <button 
        className="test-button"
        onClick={runTests}
        disabled={isRunning}
      >
        {isRunning ? 'Running Tests...' : 'Run Database Tests'}
      </button>

      {results && (
        <div className="test-results">
          <h3>Test Results</h3>
          
          {results.error ? (
            <div className="error-message">
              Error: {results.error.message || 'Unknown error occurred'}
            </div>
          ) : (
            <>
              <div className={`overall-result ${results.success ? 'success' : 'failure'}`}>
                Overall: {results.success ? 'PASSED' : 'FAILED'}
              </div>
              
              <div className="individual-results">
                {Object.entries(results.results).map(([test, passed]) => (
                  <div key={test} className={`test-result ${passed ? 'success' : 'failure'}`}>
                    <span className="test-name">{test}:</span>
                    <span className="test-status">
                      {passed ? '✅ PASSED' : '❌ FAILED'}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default DatabaseTest; 