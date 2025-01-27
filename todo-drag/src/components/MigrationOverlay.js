import React, { useState, useEffect } from 'react';
import './MigrationOverlay.css';

const funMessages = [
  "Reticulating splines...",
  "Calibrating quantum entanglement...",
  "Aligning todo particles...",
  "Synchronizing parallel universes...",
  "Upgrading productivity matrix...",
  "Defragmenting task continuum...",
  "Optimizing procrastination algorithms...",
  "Recalculating life choices...",
  "Buffering motivation levels...",
  "Downloading productivity boost...",
];

const MigrationOverlay = ({ onComplete }) => {
  const [currentMessage, setCurrentMessage] = useState(funMessages[0]);

  useEffect(() => {
    let messageCount = 0;
    // Change message every 2 seconds
    const interval = setInterval(() => {
      messageCount++;
      setCurrentMessage(funMessages[messageCount % funMessages.length]);
    }, 2000);

    // Complete migration after showing a few messages
    const timeout = setTimeout(() => {
      onComplete();
    }, 6000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [onComplete]);

  return (
    <div className="migration-overlay">
      <div className="migration-content">
        <div className="spinner"></div>
        <h2>Upgrading Your Todo Universe</h2>
        <p>{currentMessage}</p>
      </div>
    </div>
  );
};

export default MigrationOverlay; 