import React, { useState, useEffect } from 'react';
import './ModelControls.css';

const AVAILABLE_MODELS = ['chair', 'sofa'];
const COLORS = [
  { name: 'White', hex: '#ffffff' },
  { name: 'Beige', hex: '#d4a574' },
  { name: 'Olive', hex: '#7d8b67' },
  { name: 'Charcoal', hex: '#4a4a4a' },
  { name: 'Terracotta', hex: '#c85a3a' },
  { name: 'Blue', hex: '#3b5bdb' },
];

function ModelControls({
  selectedModel,
  onSelectModel,
  models,
  onPlaceModel,
  onUpdateTransform,
  onUpdateColor,
  onRemoveModel,
}) {
  const [rotation, setRotation] = useState(0);
  const [scale, setScale] = useState(1);
  const currentModel = selectedModel ? models[selectedModel] : null;

  useEffect(() => {
    if (currentModel) {
      setRotation(currentModel.rotation?.y || 0);
      setScale(currentModel.scale || 1);
    }
  }, [currentModel]);

  const handleModelSelect = (modelName) => {
    onSelectModel(modelName);
  };

  const handlePlaceModel = () => {
    onPlaceModel();
  };

  const handleRotationChange = (e) => {
    const newRotation = parseFloat(e.target.value);
    setRotation(newRotation);
    if (currentModel) {
      onUpdateTransform(currentModel.id, {
        x: 0,
        y: newRotation,
        z: 0,
      }, scale);
    }
  };

  const handleScaleChange = (e) => {
    const newScale = parseFloat(e.target.value);
    setScale(newScale);
    if (currentModel) {
      onUpdateTransform(currentModel.id, {
        x: 0,
        y: rotation,
        z: 0,
      }, newScale);
    }
  };

  const handleColorChange = (colorHex) => {
    if (currentModel) {
      onUpdateColor(currentModel.id, colorHex);
    }
  };

  const handleRemoveModel = () => {
    if (currentModel) {
      onRemoveModel(currentModel.id);
    }
  };

  const placedModelCount = Object.keys(models).length;

  return (
    <div className="model-controls">
      {/* Model Selection */}
      <div className="controls-section">
        <h3>Model Selection</h3>
        <div className="model-buttons">
          {AVAILABLE_MODELS.map((model) => (
            <button
              key={model}
              className={`model-btn ${selectedModel === model ? 'active' : ''}`}
              onClick={() => handleModelSelect(model)}
            >
              {model.charAt(0).toUpperCase() + model.slice(1)}
            </button>
          ))}
        </div>
        <button
          className="btn btn-success full-width"
          onClick={handlePlaceModel}
          disabled={!selectedModel || !currentModel}
        >
          🎁 Place Model
        </button>
      </div>

      {/* Model Transform Controls */}
      {currentModel && (
        <>
          <div className="controls-section">
            <h3>Transform Controls</h3>

            {/* Rotation */}
            <div className="control-group">
              <label>Rotation (Y-axis)</label>
              <div className="slider-container">
                <input
                  type="range"
                  min="0"
                  max="360"
                  step="1"
                  value={rotation}
                  onChange={handleRotationChange}
                  className="slider"
                />
                <span className="value">{Math.round(rotation)}°</span>
              </div>
            </div>

            {/* Scale */}
            <div className="control-group">
              <label>Scale</label>
              <div className="slider-container">
                <input
                  type="range"
                  min="0.25"
                  max="3"
                  step="0.05"
                  value={scale}
                  onChange={handleScaleChange}
                  className="slider"
                />
                <span className="value">{scale.toFixed(2)}×</span>
              </div>
            </div>
          </div>

          {/* Color Controls */}
          <div className="controls-section">
            <h3>Material</h3>
            <div className="color-palette">
              {COLORS.map((color) => (
                <button
                  key={color.hex}
                  className={`color-swatch ${currentModel.color === color.hex ? 'active' : ''}`}
                  style={{ backgroundColor: color.hex }}
                  onClick={() => handleColorChange(color.hex)}
                  title={color.name}
                />
              ))}
            </div>
          </div>

          {/* Remove Button */}
          <div className="controls-section">
            <button
              className="btn btn-danger full-width"
              onClick={handleRemoveModel}
            >
              🗑 Remove Model
            </button>
          </div>
        </>
      )}

      {/* Placed Models Info */}
      <div className="model-info">
        <strong>Placed Models:</strong> {placedModelCount}
        {placedModelCount > 0 && (
          <div className="model-list">
            {Object.entries(models).map(([id, model]) => (
              <div key={id} className="model-item">
                <span className="model-id">{id}</span>
                <span className={`model-status ${selectedModel === id ? 'selected' : ''}`}>
                  {selectedModel === id ? '●' : '○'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default ModelControls;
