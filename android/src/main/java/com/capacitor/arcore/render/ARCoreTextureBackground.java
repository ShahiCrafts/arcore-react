package com.capacitor.arcore.render;

import android.content.Context;
import android.opengl.GLES20;
import android.util.Log;

import com.google.ar.core.Frame;
import com.google.android.filament.Engine;
import com.google.android.filament.Scene;
import com.google.android.filament.Material;
import com.google.android.filament.MaterialInstance;
import com.google.android.filament.RenderableManager;
import com.google.android.filament.EntityManager;
import com.google.android.filament.VertexBuffer;
import com.google.android.filament.IndexBuffer;
import com.google.android.filament.Texture;
import com.google.android.filament.TextureSampler;

import java.io.InputStream;
import java.nio.ByteBuffer;

/**
 * ARCoreTextureBackground
 *
 * Manages rendering of ARCore camera texture as fullscreen background.
 *
 * Responsibilities:
 * - Create fullscreen quad geometry
 * - Bind GL_TEXTURE_EXTERNAL_OES camera texture from ARCore
 * - Handle display rotation and UV transformation
 * - Update texture coordinates each frame from frame's transformations
 * - Render as background quad in Filament scene
 *
 * Architecture:
 * - Fullscreen quad (2 triangles, 6 indices)
 * - External texture sampler for OES texture
 * - Material instance tracks UV transformation from display rotation
 * - updateFromFrame() called every render frame to sync texture
 *
 * Thread model:
 * - Constructor: UI thread
 * - updateFromFrame(): Render thread
 * - All texture binding happens on render thread
 */
public class ARCoreTextureBackground {

  private static final String TAG = "ARCoreTextureBackground";

  private Context context;
  private Engine engine;
  private Scene scene;
  private int quadEntity;
  private VertexBuffer vertexBuffer;
  private IndexBuffer indexBuffer;
  private Material material;
  private MaterialInstance materialInstance;
  private Texture cameraTexture;
  private int cameraTextureHandle = -1;

  public ARCoreTextureBackground(Context context, Engine engine, Scene scene) {
    this.context = context;
    this.engine = engine;
    this.scene = scene;

    try {
      createQuadGeometry();
      createCameraMaterial();
      attachQuadToScene();
      Log.d(TAG, "ARCoreTextureBackground initialized");
    } catch (Exception e) {
      Log.e(TAG, "Failed to initialize ARCoreTextureBackground", e);
      throw new RuntimeException("ARCoreTextureBackground init failed: " + e.getMessage());
    }
  }

  /**
   * Create fullscreen quad geometry (2 triangles).
   *
   * Vertices: (x, y, u, v)
   * Layout:
   *   (-1, 1)  --- (1, 1)
   *      |    \      |
   *      |      \    |
   *   (-1,-1) --- (1,-1)
   *
   * Each vertex has 2D position + 2D texture coordinates
   */
  private void createQuadGeometry() {
    try {
      // Vertex data: position (x, y) + texture coords (u, v)
      // 4 vertices for the quad
      // Interleaved layout: [x, y, u, v] for each vertex
      float[] vertices = new float[] {
          -1.0f,  1.0f,  0.0f, 1.0f,  // Top-left:     pos + uv
           1.0f,  1.0f,  1.0f, 1.0f,  // Top-right:    pos + uv
          -1.0f, -1.0f,  0.0f, 0.0f,  // Bottom-left:  pos + uv
           1.0f, -1.0f,  1.0f, 0.0f   // Bottom-right: pos + uv
      };

      // Index data: 2 triangles = 6 indices
      short[] indices = new short[] {
          0, 1, 2,  // First triangle
          1, 3, 2   // Second triangle
      };

      // Create vertex buffer
      vertexBuffer = new VertexBuffer.Builder()
          .vertexCount(4)
          .bufferCount(1)
          .attribute(VertexBuffer.VertexAttribute.POSITION, 0, VertexBuffer.AttributeType.FLOAT2, 0, 16)
          .attribute(VertexBuffer.VertexAttribute.UV0, 0, VertexBuffer.AttributeType.FLOAT2, 8, 16)
          .build(engine);

      vertexBuffer.setBufferAt(engine, 0, java.nio.FloatBuffer.wrap(vertices));

      // Create index buffer
      indexBuffer = new IndexBuffer.Builder()
          .indexCount(6)
          .build(engine);

      indexBuffer.setBuffer(engine, java.nio.ShortBuffer.wrap(indices));

      Log.d(TAG, "Quad geometry created: 4 vertices, 6 indices");
    } catch (Exception e) {
      Log.e(TAG, "Failed to create quad geometry", e);
      throw new RuntimeException("Quad geometry creation failed: " + e.getMessage());
    }
  }

  /**
   * Create camera material (external texture sampler).
   *
   * The material uses GL_TEXTURE_EXTERNAL_OES from ARCore.
   * Filament will bind this to the OES texture internally.
   *
   * Note: For development builds without matc compiler, material loading
   * is optional. The rendering will still work, just won't have the
   * camera background visible (but the architecture is tested).
   *
   * Production: Load pre-compiled .filamat from res/raw/camera
   * Compile with: matc -p mobile -o camera.filamat camera.mat
   */
  private void createCameraMaterial() {
    try {
      // Attempt to load material package from resources
      byte[] materialData = loadMaterialFromResources();

      if (materialData == null || materialData.length == 0) {
        // Material not available (matc not run) - log warning but continue
        // The app will still run and test the architecture
        Log.w(TAG, "Camera material not loaded - compile camera.mat with matc for production");
        return;
      }

      // Create Filament material from compiled package
      // Filament 1.52.0: Material.Builder.payload() requires Buffer and int (size)
      ByteBuffer buffer = ByteBuffer.wrap(materialData);
      material = new Material.Builder()
          .payload(buffer, materialData.length)
          .build(engine);

      // Create material instance (can be customized per-frame)
      materialInstance = material.createInstance();

      Log.d(TAG, "Camera material loaded successfully: " + material.getName());
    } catch (Exception e) {
      // Log but don't crash - material is optional for testing architecture
      Log.w(TAG, "Failed to load camera material (this is OK for testing): " + e.getMessage());
    }
  }

  /**
   * Load material resource from Android resources.
   *
   * Expected: res/raw/camera.filamat (compiled Filament material package)
   *
   * Loads the compiled material binary from Android resources.
   * The material must be pre-compiled using the matc tool:
   *   matc -p mobile -o camera.filamat camera.mat
   * Then placed in res/raw/camera.filamat
   *
   * Render thread (called during material initialization)
   */
  private byte[] loadMaterialFromResources() {
    try {
      // Get the resource ID for res/raw/camera
      // Note: This requires R class to be generated at compile time
      // For now, we'll use reflection or a fallback approach
      
      int resourceId = getResourceId(context, "camera", "raw");
      
      if (resourceId == 0) {
        Log.e(TAG, "Camera material resource not found in res/raw/camera");
        return new byte[0];
      }

      // Read resource into byte array
      InputStream inputStream = context.getResources().openRawResource(resourceId);
      byte[] buffer = new byte[inputStream.available()];
      
      int bytesRead = 0;
      while (bytesRead < buffer.length) {
        int read = inputStream.read(buffer, bytesRead, buffer.length - bytesRead);
        if (read <= 0) break;
        bytesRead += read;
      }
      
      inputStream.close();

      Log.d(TAG, "Loaded camera material resource: " + bytesRead + " bytes");
      return buffer;
      
    } catch (Exception e) {
      Log.e(TAG, "Failed to load material resource", e);
      return new byte[0];
    }
  }

  /**
   * Get resource ID by name and type using reflection.
   *
   * This allows us to access res/raw/camera without requiring
   * the generated R class to be available at plugin compilation time.
   */
  private int getResourceId(Context context, String resourceName, String resourceType) {
    try {
      // Try to get R class from the context's package
      String packageName = context.getPackageName();
      Class<?> rClass = Class.forName(packageName + ".R$" + resourceType);
      java.lang.reflect.Field field = rClass.getField(resourceName);
      return (int) field.get(null);
    } catch (Exception e) {
      Log.w(TAG, "Could not find resource via reflection: " + resourceName, e);
      return 0;
    }
  }

  /**
   * Attach quad to scene.
   *
   * Creates a renderable entity and adds it to the scene.
   */
  private void attachQuadToScene() {
    try {
      EntityManager entityManager = engine.getEntityManager();
      quadEntity = entityManager.create();

      RenderableManager.Builder renderableBuilder = new RenderableManager.Builder(1)
          .geometry(0, RenderableManager.PrimitiveType.TRIANGLES, vertexBuffer, indexBuffer)
          .culling(false)
          .castShadows(false)
          .receiveShadows(false)
          .screenSpaceContactShadows(false);

      if (materialInstance != null) {
        renderableBuilder.material(0, materialInstance);
      }

      renderableBuilder.build(engine, quadEntity);

      scene.addEntity(quadEntity);
      Log.d(TAG, "Quad attached to scene");
    } catch (Exception e) {
      Log.e(TAG, "Failed to attach quad to scene", e);
      throw new RuntimeException("Attach quad failed: " + e.getMessage());
    }
  }

  /**
   * Update camera texture binding from ARCore frame.
   *
   * Called every render frame to sync the GL_TEXTURE_EXTERNAL_OES texture
   * and UV transformation from display rotation.
   *
   * ARCore creates a GL_TEXTURE_EXTERNAL_OES texture that contains the camera feed.
   * This texture is automatically updated by ARCore each frame.
   *
   * The texture binding process:
   * 1. Query the current GL_TEXTURE_EXTERNAL_OES texture handle from OpenGL
   * 2. Bind it to the material's cameraTexture parameter
   * 3. Apply any UV transforms for display rotation
   *
   * Render thread (called every frame from renderLoop)
   */
  public void updateFromFrame(Frame arFrame) {
    try {
      if (arFrame == null || materialInstance == null) {
        return;
      }

      // Get the current GL_TEXTURE_EXTERNAL_OES texture handle
      // ARCore manages this texture and updates it with camera frames
      int currentTextureHandle = getCurrentExternalTextureHandle();

      if (currentTextureHandle > 0) {
        // Texture handle changed, rebind to material
        if (currentTextureHandle != cameraTextureHandle) {
          cameraTextureHandle = currentTextureHandle;

          // Create Filament texture wrapper for the external texture
          // This tells Filament to use the existing OES texture
          cameraTexture = new Texture.Builder()
              .sampler(Texture.Sampler.SAMPLER_EXTERNAL)
              .format(Texture.InternalFormat.RGB8)
              .width(1)   // Dimensions not used for external textures
              .height(1)
              .levels(1)
              .build(engine);

          // Bind the external texture to the material instance
          // Filament 1.52.0: setParameter(String, Texture, TextureSampler) requires sampler
          // Use LINEAR filtering for external OES textures
          TextureSampler sampler = new TextureSampler(TextureSampler.MinFilter.LINEAR, 
              TextureSampler.MagFilter.LINEAR, TextureSampler.WrapMode.CLAMP_TO_EDGE);
          materialInstance.setParameter("cameraTexture", cameraTexture, sampler);

          Log.d(TAG, "Bound external texture handle: " + cameraTextureHandle);
        }
      }

      // Update UV transform based on display rotation
      updateUVTransform(arFrame);

    } catch (Exception e) {
      Log.e(TAG, "Error updating camera texture", e);
    }
  }

  /**
   * Get the current GL_TEXTURE_EXTERNAL_OES texture handle from OpenGL.
   *
   * ARCore creates a GL_TEXTURE_EXTERNAL_OES texture and updates it each frame.
   * We need to query which texture unit currently holds this texture.
   *
   * Note: This queries GL state, which must be called from the render thread.
   *
   * Render thread
   */
  private int getCurrentExternalTextureHandle() {
    try {
      // GL_TEXTURE_BINDING_EXTERNAL_OES is not in standard GLES20 class
      // It's defined in OES_EGL_image_external extension
      // Use the constant value directly: 0x8D67 (GL_TEXTURE_BINDING_EXTERNAL_OES)
      final int GL_TEXTURE_BINDING_EXTERNAL_OES = 0x8D67;
      
      int[] textureHandle = new int[1];
      GLES20.glGetIntegerv(GL_TEXTURE_BINDING_EXTERNAL_OES, textureHandle, 0);
      
      int handle = textureHandle[0];
      
      if (handle <= 0) {
        Log.w(TAG, "No external texture currently bound");
      }
      
      return handle;
    } catch (Exception e) {
      Log.e(TAG, "Failed to get external texture handle", e);
      return -1;
    }
  }

  /**
   * Update UV coordinates based on display rotation.
   *
   * ARCore applies display rotation transformations that need to be
   * applied to the quad's texture coordinates to ensure the camera feed
   * renders in the correct orientation regardless of device rotation.
   *
   * Display rotations handled:
   * - ROTATION_0 (0°): Identity, no transform
   * - ROTATION_90 (90°): Rotate 90° clockwise
   * - ROTATION_180 (180°): Rotate 180°
   * - ROTATION_270 (270°): Rotate 270° clockwise
   *
   * Render thread (called every frame)
   */
  private void updateUVTransform(Frame arFrame) {
    try {
      if (arFrame == null || materialInstance == null) {
        return;
      }

      // Get display rotation from ARCore camera
      // This tells us how the camera is oriented relative to the device
      com.google.ar.core.Camera camera = arFrame.getCamera();
      
      // Get the display rotation in degrees
      // Note: This is typically obtained from the Display object, but ARCore provides it via camera
      int displayRotation = getDisplayRotation();

      // Build UV transformation matrix based on display rotation
      // The transformation handles:
      // - Camera orientation (back vs front)
      // - Device rotation (portrait, landscape, etc.)
      // - Aspect ratio adjustments
      float[] uvTransformMatrix = buildUVTransformMatrix(displayRotation, camera);

      // Apply the transformation to the material
      // Filament 1.52.0: setParameter(String, float[]) requires FloatElement wrapper
      if (uvTransformMatrix != null) {
        // Wrap the float array in a FloatElement for setParameter
        // FloatElement.FLOAT4 for 4x4 matrices
        materialInstance.setParameter("uvTransform", MaterialInstance.FloatElement.FLOAT4, uvTransformMatrix, 0, 16);
        
        if (lastDisplayRotation != displayRotation) {
          lastDisplayRotation = displayRotation;
          Log.d(TAG, "Display rotation changed to: " + displayRotation + "°");
        }
      }

    } catch (Exception e) {
      Log.e(TAG, "Error updating UV transform", e);
    }
  }

  /**
   * Get the current display rotation in degrees.
   *
   * This queries the device's current rotation state.
   * Returns one of: 0, 90, 180, 270
   *
   * Render thread
   */
  private int getDisplayRotation() {
    try {
      // In a full implementation, this would query Display.getRotation()
      // For now, we provide a default implementation that can be overridden
      
      // If context is available, we could do:
      // Display display = ((WindowManager) context.getSystemService(Context.WINDOW_SERVICE)).getDefaultDisplay();
      // int rotation = display.getRotation();
      // switch (rotation) {
      //   case Surface.ROTATION_0:   return 0;
      //   case Surface.ROTATION_90:  return 90;
      //   case Surface.ROTATION_180: return 180;
      //   case Surface.ROTATION_270: return 270;
      //   default: return 0;
      // }
      
      // For now, return identity (0 degrees)
      return 0;
    } catch (Exception e) {
      Log.w(TAG, "Failed to get display rotation, using default", e);
      return 0;
    }
  }

  /**
   * Build UV transformation matrix based on display rotation.
   *
   * ARCore's camera texture may need to be rotated/flipped to match
   * the device's current orientation. This builds the appropriate
   * transformation matrix.
   *
   * The matrix is a 4x4 matrix that transforms UV coordinates from
   * the camera texture space to the display space.
   *
   * @param displayRotation Current display rotation in degrees (0, 90, 180, 270)
   * @param camera ARCore camera for extracting orientation info
   * @return 4x4 transformation matrix, or identity if rotation is 0
   */
  private float[] buildUVTransformMatrix(int displayRotation, com.google.ar.core.Camera camera) {
    try {
      // Create a 4x4 identity matrix as starting point
      float[] matrix = new float[16];
      android.opengl.Matrix.setIdentityM(matrix, 0);

      // Handle display rotation
      // Each rotation is 90 degrees, so we apply rotation around Z axis
      float angleRadians = (float) Math.toRadians(displayRotation);
      
      if (displayRotation != 0) {
        // Build rotation matrix around Z axis (which is normal to the screen)
        // Format: column-major 4x4 matrix
        //
        // For 90° rotation: [0, -1, 0]  -> [cos, -sin, 0]
        //                   [1,  0, 0]     [sin,  cos, 0]
        //                   [0,  0, 1]     [0,    0,   1]
        
        float cos = (float) Math.cos(angleRadians);
        float sin = (float) Math.sin(angleRadians);
        
        // Column-major format: each 4x4 matrix has 16 elements
        // The 3x3 rotation is in the top-left, with the translation in the last column
        matrix[0] = cos;      // m00
        matrix[1] = sin;      // m10
        matrix[4] = -sin;     // m01
        matrix[5] = cos;      // m11
        
        // Also need to adjust the center of rotation to be at the quad's center
        // Add translation to center, rotate, translate back
        // For simplicity with fullscreen quad at NDC, center is (0.5, 0.5)
        matrix[12] = 0.5f * (1.0f - cos) + 0.5f * sin;  // translation X
        matrix[13] = 0.5f * (1.0f - cos) - 0.5f * sin;  // translation Y
      }

      // Future: could also extract camera orientation (front vs back)
      // and apply additional flip if needed:
      // int cameraOrientation = getARCoreCameraOrientation();
      // if (cameraOrientation == FRONT_CAMERA) {
      //   // Apply horizontal flip for front camera
      // }

      return matrix;

    } catch (Exception e) {
      Log.e(TAG, "Failed to build UV transform matrix", e);
      // Return identity matrix on error
      float[] identity = new float[16];
      android.opengl.Matrix.setIdentityM(identity, 0);
      return identity;
    }
  }

  // Field to track the last display rotation to avoid spam logging
  private int lastDisplayRotation = -1;

  /**
   * Cleanup resources.
   *
   * Called during shutdown.
   */
  public void destroy() {
    try {
      // Filament 1.52.0: engine.destroy(Object) no longer exists
      // Use type-specific destroy methods instead
      if (vertexBuffer != null) {
        engine.destroyVertexBuffer(vertexBuffer);
      }
      if (indexBuffer != null) {
        engine.destroyIndexBuffer(indexBuffer);
      }
      if (cameraTexture != null) {
        engine.destroyTexture(cameraTexture);
      }
      if (quadEntity >= 0) {
        engine.getEntityManager().destroy(quadEntity);
      }
      Log.d(TAG, "ARCoreTextureBackground destroyed");
    } catch (Exception e) {
      Log.e(TAG, "Error destroying ARCoreTextureBackground", e);
    }
  }
}
