import React from 'react';
import './StatusPanel.css';

function StatusPanel({
  arSupported,
  sessionActive,
  tracking,
  surfaceDetected,
  lastHit,
  selectedModel,
  models,
}) {
  const selectedModelData = selectedModel ? models[selectedModel] : null;

  return (
    <div className="status-panel">
      <h3>📊 Status Panel</h3>
      <div className="status-grid">
        <div className="status-item">
          <span className="label">Platform</span>
          <span className="value">Android</span>
        </div>
        <div className="status-item">
          <span className="label">AR Support</span>
          <span className={`value ${arSupported ? 'ok' : 'error'}`}>
            {arSupported ? '✓ Yes' : '✗ No'}
          </span>
        </div>
        <div className="status-item">
          <span className="label">Session</span>
          <span className={`value ${sessionActive ? 'ok' : 'error'}`}>
            {sessionActive ? '● Active' : '○ Stopped'}
          </span>
        </div>
        <div className="status-item">
          <span className="label">Tracking</span>
          <span
            className={`value ${
              tracking === 'TRACKING' ? 'ok' : tracking === 'PAUSED' ? 'warning' : 'error'
            }`}
          >
            {tracking || 'Unknown'}
          </span>
        </div>
        <div className="status-item">
          <span className="label">Surface</span>
          <span className={`value ${surfaceDetected ? 'ok' : 'error'}`}>
            {surfaceDetected ? '✓ Detected' : '✗ Not detected'}
          </span>
        </div>
        <div className="status-item">
          <span className="label">Hit Result</span>
          <span className={`value ${lastHit?.hit ? 'ok' : 'error'}`}>
            {lastHit?.hit ? '✓ Valid' : '✗ None'}
          </span>
        </div>
        <div className="status-item">
          <span className="label">Models Placed</span>
          <span className="value">{Object.keys(models).length}</span>
        </div>
        {selectedModelData && (
          <>
            <div className="status-item">
              <span className="label">Selected Model</span>
              <span className="value">{selectedModel}</span>
            </div>
            <div className="status-item">
              <span className="label">Model ID</span>
              <span className="value mono">{selectedModelData.id}</span>
            </div>
            <div className="status-item">
              <span className="label">Anchor ID</span>
              <span className="value mono">{selectedModelData.anchorId || 'N/A'}</span>
            </div>
            <div className="status-item">
              <span className="label">Scale</span>
              <span className="value">{selectedModelData.scale?.toFixed(2)}×</span>
            </div>
            <div className="status-item">
              <span className="label">Rotation (Y)</span>
              <span className="value">{(selectedModelData.rotation?.y || 0).toFixed(0)}°</span>
            </div>
            <div className="status-item">
              <span className="label">Color</span>
              <div className="value-with-swatch">
                <div
                  className="color-swatch-small"
                  style={{ backgroundColor: selectedModelData.color }}
                />
                <span className="mono">{selectedModelData.color}</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default StatusPanel;
