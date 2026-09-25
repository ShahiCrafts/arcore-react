import React from 'react';
import './ARControls.css';

function ARControls({
  arSupported,
  sessionActive,
  lastHit,
  onStartAR,
  onStopAR,
  onHitTest,
}) {
  return (
    <div className="ar-controls">
      <div className="controls-section">
        <h3>Session Control</h3>
        <div className="button-group">
          <button
            className="btn btn-primary"
            onClick={onStartAR}
            disabled={!arSupported || sessionActive}
          >
            ▶ Start AR
          </button>
          <button
            className="btn btn-danger"
            onClick={onStopAR}
            disabled={!sessionActive}
          >
            ⏹ Stop AR
          </button>
        </div>
      </div>

      <div className="controls-section">
        <h3>Interaction</h3>
        <button
          className={`btn btn-secondary full-width ${lastHit?.hit ? 'active' : ''}`}
          onClick={onHitTest}
          disabled={!sessionActive}
        >
          🎯 Hit Test at Center
        </button>
        {lastHit?.hit && (
          <div className="hit-info">
            ✓ Valid surface detected at center
            <br />
            Type: {lastHit.planeType || 'unknown'}
          </div>
        )}
      </div>

      <div className="status-line">
        <span>AR Support:</span>
        <span className={arSupported ? 'status-ok' : 'status-error'}>
          {arSupported === null ? '...' : arSupported ? '✓ Yes' : '✗ No'}
        </span>
      </div>

      <div className="status-line">
        <span>Session:</span>
        <span className={sessionActive ? 'status-ok' : 'status-error'}>
          {sessionActive ? '✓ Active' : '✗ Stopped'}
        </span>
      </div>
    </div>
  );
}

export default ARControls;
