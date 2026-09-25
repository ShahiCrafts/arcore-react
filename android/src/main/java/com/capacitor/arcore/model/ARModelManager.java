package com.capacitor.arcore.model;

import android.content.Context;
import android.util.Log;

import com.google.android.filament.Engine;
import com.google.android.filament.Scene;
import com.google.android.filament.TransformManager;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * ARModelManager
 *
 * Manages model metadata and state tracking.
 *
 * For this integration test, maintains:
 * - Model metadata (transforms, colors, anchors)
 * - Model-anchor associations
 * - Model instance lifecycle
 *
 * Future integration with gltfio for actual GLB loading.
 *
 * Thread model: Any thread safe
 * ModelID format: "model_N"
 */
public class ARModelManager {

  private static final String TAG = "ARModelManager";

  private final Context context;
  private final Engine filamentEngine;
  private final Scene filamentScene;
  private final TransformManager transformManager;

  // Model instances: modelId -> ModelInstance
  private final Map<String, ModelInstance> modelInstances = new HashMap<>();
  private final AtomicInteger modelCounter = new AtomicInteger(0);

  /**
   * Model instance representation.
   */
  private static class ModelInstance {
    String modelId;
    String anchorId;
    String modelPath;
    float scale;
    float[] rotationEuler;  // [x, y, z] in radians
    String color;

    ModelInstance(String modelId, String anchorId, String modelPath) {
      this.modelId = modelId;
      this.anchorId = anchorId;
      this.modelPath = modelPath;
      this.scale = 1.0f;
      this.rotationEuler = new float[]{0, 0, 0};
      this.color = "#ffffff";
    }
  }

  /**
   * Initialize model manager.
   */
  public ARModelManager(Context context, Engine filamentEngine, Scene filamentScene) {
    this.context = context;
    this.filamentEngine = filamentEngine;
    this.filamentScene = filamentScene;
    this.transformManager = filamentEngine.getTransformManager();
    Log.d(TAG, "ARModelManager initialized");
  }

  /**
   * Place a model at an anchor position.
   *
   * @param modelPath Path to GLB model
   * @param anchorId Anchor identifier
   * @param anchorPose 4x4 anchor pose matrix
   * @return ModelID, or null if placement failed
   */
  public synchronized String placeModel(String modelPath, String anchorId, float[] anchorPose) {
    try {
      String modelId = generateModelId();
      ModelInstance instance = new ModelInstance(modelId, anchorId, modelPath);
      modelInstances.put(modelId, instance);

      Log.d(TAG, "Model placed: " + modelId + " at anchor " + anchorId);
      return modelId;

    } catch (Exception e) {
      Log.e(TAG, "Failed to place model", e);
      return null;
    }
  }

  /**
   * Update model transform.
   *
   * @param modelId Model identifier
   * @param anchorPose New anchor pose (4x4 matrix)
   * @param rotationEuler Euler angles [x, y, z] in degrees
   * @param scale Uniform scale
   */
  public synchronized void setTransform(String modelId, float[] anchorPose,
                                        float[] rotationEuler, float scale) {
    try {
      ModelInstance instance = modelInstances.get(modelId);
      if (instance == null) {
        Log.w(TAG, "Model not found: " + modelId);
        return;
      }

      scale = Math.max(0.25f, Math.min(3.0f, scale));
      instance.scale = scale;

      if (rotationEuler != null) {
        instance.rotationEuler[0] = (float) Math.toRadians(rotationEuler[0]);
        instance.rotationEuler[1] = (float) Math.toRadians(rotationEuler[1]);
        instance.rotationEuler[2] = (float) Math.toRadians(rotationEuler[2]);
      }

      Log.d(TAG, "Transform updated: " + modelId + " scale=" + scale);

    } catch (Exception e) {
      Log.e(TAG, "Failed to update transform", e);
    }
  }

  /**
   * Set model color/material.
   *
   * @param modelId Model identifier
   * @param color Hex color string
   */
  public synchronized void setColor(String modelId, String color) {
    try {
      ModelInstance instance = modelInstances.get(modelId);
      if (instance == null) {
        Log.w(TAG, "Model not found: " + modelId);
        return;
      }

      instance.color = color;
      Log.d(TAG, "Color updated: " + modelId + " -> " + color);

    } catch (Exception e) {
      Log.e(TAG, "Failed to set color", e);
    }
  }

  /**
   * Remove a model instance.
   *
   * @param modelId Model identifier
   */
  public synchronized void removeModel(String modelId) {
    try {
      ModelInstance instance = modelInstances.remove(modelId);
      if (instance == null) {
        Log.w(TAG, "Model not found: " + modelId);
        return;
      }

      Log.d(TAG, "Model removed: " + modelId);

    } catch (Exception e) {
      Log.e(TAG, "Failed to remove model", e);
    }
  }

  /**
   * Clear all model instances.
   */
  public synchronized void clearAllModels() {
    modelInstances.clear();
    Log.d(TAG, "All models cleared");
  }

  /**
   * Cleanup all resources.
   */
  public synchronized void cleanup() {
    clearAllModels();
    Log.d(TAG, "ARModelManager cleanup complete");
  }

  /**
   * Get model count.
   */
  public synchronized int getModelCount() {
    return modelInstances.size();
  }

  /**
   * Generate unique model ID.
   */
  private String generateModelId() {
    return "model_" + modelCounter.incrementAndGet();
  }
}
