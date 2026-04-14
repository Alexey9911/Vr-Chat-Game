import { useGLTF } from '@react-three/drei';
import { editable as e } from '@theatre/r3f';
import { useCurrentSheet } from '@theatre/r3f';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { useOptimizedGLTF, optimizeTexture } from '@/hooks/useOptimizedGLTF';

/**
 * Component para cargar y animar modelos GLB/GLTF con Theatre.js
 * Optimizado con KTX2 compressed textures y GPU warmup
 * 
 * Uso:
 * <TheatreGLB 
 *   uniqueKey="MyModel" 
 *   modelPath="/models/my-model.glb"
 *   position={[0, 0, 0]}
 *   scale={[1, 1, 1]}
 *   useOptimizedLoader={true}  // Enable KTX2 + MeshOpt
 *   warmupGpu={false}           // Enable after loading screen
 * />
 */
export default function TheatreGLB({ 
  uniqueKey, 
  modelPath,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = [1, 1, 1],
  visible = true,
  enableAnimationControls = false,
  enableTransformControls = true,
  animationName,
  forcePlay = false,
  materialOverrides,
  bloomLayer,
  meshMaterialOverrides,
  useOptimizedLoader = true,
  warmupGpu = false,
  convertToBasicMaterial = false,
  ...props 
}) {
  const { gl } = useThree();
  
  // Use optimized loader if enabled, otherwise fallback to standard useGLTF
  const gltfData = useOptimizedLoader 
    ? useOptimizedGLTF(modelPath, { 
        warmupGpu, 
        convertToBasicMaterial,
        enableMeshOpt: true,
      })
    : useGLTF(modelPath);
  
  const { scene, animations } = gltfData;
  const EditableGroup = e.group;
  const sheet = useCurrentSheet();
  const groupRef = useRef();
  const glbRef = useRef();
  const reflectorInstancesRef = useRef([]);
  const reflectorParamsRef = useRef({});
  const [transform, setTransform] = useState({
    position: { x: position[0], y: position[1], z: position[2] },
    rotation: { x: rotation[0], y: rotation[1], z: rotation[2] },
    scale: { x: scale[0], y: scale[1], z: scale[2] },
  });
  const animValues = useRef({ play: true });
  const actionRef = useRef(null);
  const mixerRef = useRef(null);
  const activeClipRef = useRef(null);
  const activeRootRef = useRef(null);

  const preferredClip = useMemo(() => {
    if (!animations || animations.length === 0) return null;
    if (animationName) {
      const match = animations.find((clip) => clip.name === animationName);
      if (match) return match;
    }
    if (animations.length === 1) return animations[0];
    return [...animations].sort((a, b) => {
      if (b.duration !== a.duration) return b.duration - a.duration;
      return (b.tracks?.length || 0) - (a.tracks?.length || 0);
    })[0];
  }, [animationName, animations]);

  useEffect(() => {
    if (!enableAnimationControls || !sheet) return;
    if (process.env.NODE_ENV !== 'production') {
    }
    const obj = sheet.object(`${uniqueKey}/Animation`, {
      play: true,
    });
    obj.initialValue = { play: true };
    const unsub = obj.onValuesChange((values) => {
      animValues.current = values;
    });
    return () => unsub();
  }, [enableAnimationControls, sheet, uniqueKey]);

  useEffect(() => {
    if (!enableTransformControls || !sheet) return;
    const obj = sheet.object(`${uniqueKey}/Transform`, {
      position: { x: position[0], y: position[1], z: position[2] },
      rotation: { x: rotation[0], y: rotation[1], z: rotation[2] },
      scale: { x: scale[0], y: scale[1], z: scale[2] },
    });
    const unsub = obj.onValuesChange((values) => {
      setTransform(values);
    });
    return () => unsub();
  }, [enableTransformControls, sheet, uniqueKey, position, rotation, scale]);

  const resetAnimation = useCallback(() => {
    if (actionRef.current) {
      actionRef.current.stop();
      actionRef.current = null;
    }
    if (mixerRef.current) {
      mixerRef.current.stopAllAction();
      mixerRef.current = null;
    }
    activeClipRef.current = null;
    activeRootRef.current = null;
  }, []);

  const ensureAction = useCallback(() => {
    if (!enableAnimationControls || !preferredClip || !glbRef.current) return null;

    if (
      actionRef.current &&
      activeClipRef.current === preferredClip &&
      activeRootRef.current === glbRef.current
    ) {
      return actionRef.current;
    }

    resetAnimation();

    const mixer = new THREE.AnimationMixer(glbRef.current);
    const action = mixer.clipAction(preferredClip);
    mixerRef.current = mixer;
    actionRef.current = action;
    activeClipRef.current = preferredClip;
    activeRootRef.current = glbRef.current;

    if (process.env.NODE_ENV !== 'production') {
    }

    action.enabled = true;
    action.reset();
    action.setEffectiveWeight(1);
    action.setEffectiveTimeScale(1);
    action.setLoop(THREE.LoopPingPong, Infinity);
    action.play();

    if (process.env.NODE_ENV !== 'production') {
    }

    return action;
  }, [animations, enableAnimationControls, preferredClip, resetAnimation, uniqueKey]);

  useEffect(() => {
    if (!enableAnimationControls) {
      resetAnimation();
    }
    return () => resetAnimation();
  }, [enableAnimationControls, resetAnimation]);

  useFrame((state, delta) => {
    if (!enableAnimationControls) return;
    const action = ensureAction();
    if (mixerRef.current) {
      mixerRef.current.update(delta);
    }
    if (!action) return;
    action.paused = forcePlay ? false : animValues.current.play === false;
    if (process.env.NODE_ENV !== 'production') {
      if (Math.random() < 0.01) {
      }
    }
  });

  const { glbScene, reflectorTargets } = useMemo(() => {
    const clone = SkeletonUtils.clone(scene);
    const reflectors = [];
    const materialOverrideExclusions = new Set(['VRCaSe.004', 'Material.004']);

    // Ensure materials are unique per instance to avoid shared texture overrides
    clone.traverse((child) => {
      if (!child.isMesh || !child.material) return;
      if (Array.isArray(child.material)) {
        child.material = child.material.map((mat) => mat.clone());
      } else {
        child.material = child.material.clone();
      }
    });

    if (materialOverrides) {
      clone.traverse((child) => {
        if (!child.isMesh || !child.material) return;
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach((mat) => {
          if (materialOverrideExclusions.has(mat.name)) return;
          if ('color' in mat && materialOverrides.color) {
            mat.color = new THREE.Color(materialOverrides.color);
          }
          if ('metalness' in mat && typeof materialOverrides.metalness === 'number') {
            mat.metalness = materialOverrides.metalness;
          }
          if ('roughness' in mat && typeof materialOverrides.roughness === 'number') {
            mat.roughness = materialOverrides.roughness;
          }
          mat.needsUpdate = true;
        });
      });
    }

    if (meshMaterialOverrides) {
      clone.traverse((child) => {
        if (!child.isMesh || !child.material) return;
        const materialName = Array.isArray(child.material)
          ? child.material[0]?.name
          : child.material?.name;
        const override =
          meshMaterialOverrides[child.name] ||
          (materialName ? meshMaterialOverrides[materialName] : undefined);
        if (!override) return;
        if (override.type === 'reflector') {
          const baseMat = Array.isArray(child.material)
            ? child.material[0]
            : child.material;
          reflectors.push({
            name: child.name,
            geometry: child.geometry,
            position: child.position.clone(),
            rotation: child.rotation.clone(),
            scale: child.scale.clone(),
            baseMap: override.baseMap || baseMat.map || null,
            baseMapIntensity:
              typeof override.baseMapIntensity === 'number' ? override.baseMapIntensity : 1.0,
            params: override,
          });
        } else if (override.type === 'standard' || override.type === 'basic') {
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          mats.forEach((mat) => {
            if (override.map) {
              mat.map = override.map;
              mat.map.needsUpdate = true;
            }
            if (override.color) {
              mat.color = new THREE.Color(override.color);
            }
            if (typeof override.metalness === 'number' && 'metalness' in mat) {
              mat.metalness = override.metalness;
            }
            if (typeof override.roughness === 'number' && 'roughness' in mat) {
              mat.roughness = override.roughness;
            }
            if (typeof override.opacity === 'number') {
              mat.opacity = override.opacity;
              mat.transparent = override.opacity < 1;
            }
            if (typeof override.transparent === 'boolean') {
              mat.transparent = override.transparent;
            }
            if (typeof override.toneMapped === 'boolean') {
              mat.toneMapped = override.toneMapped;
            }
            mat.needsUpdate = true;
            child.material = mat;
          });
        }
      });
    }

    if (typeof bloomLayer === 'number') {
      clone.traverse((child) => {
        if (!child.isMesh) return;
        child.layers.enable(bloomLayer);
      });
    }

    return { glbScene: clone, reflectorTargets: reflectors };
  }, [scene, materialOverrides, bloomLayer, meshMaterialOverrides]);

  useEffect(() => {
    const map = {};
    reflectorTargets.forEach((item) => {
      map[item.name] = item.params;
    });
    reflectorParamsRef.current = map;
  }, [reflectorTargets]);

  useEffect(() => {
    if (!groupRef.current || reflectorTargets.length === 0) return;
    const created = reflectorTargets.map((item) => {
      const options = {
        clipBias: 0.003,
        textureWidth: item.params.resolution || 1024,
        textureHeight: item.params.resolution || 1024,
        color: new THREE.Color(item.params.color || '#ffffff').getHex(),
        recursion: 1,
        multisample: 0,
      };
      const reflector = new Reflector(item.geometry, options);
      if (Array.isArray(item.params.position)) {
        reflector.position.set(
          item.params.position[0],
          item.params.position[1],
          item.params.position[2]
        );
      } else {
        reflector.position.copy(item.position);
      }
      if (Array.isArray(item.params.rotation)) {
        reflector.rotation.set(
          item.params.rotation[0],
          item.params.rotation[1],
          item.params.rotation[2]
        );
      } else {
        reflector.rotation.copy(item.rotation);
      }
      if (Array.isArray(item.params.scale)) {
        reflector.scale.set(item.params.scale[0], item.params.scale[1], item.params.scale[2]);
      } else {
        reflector.scale.copy(item.scale);
      }
      const offset = typeof item.params.offset === 'number' ? item.params.offset : 0.002;
      reflector.position.y += offset;
      reflector.renderOrder = 1;

      if (reflector.material) {
        const material = reflector.material;
        material.transparent = true;
        material.depthWrite = false;
        material.side = THREE.FrontSide;
        material.blending = THREE.NormalBlending;

        const opacity = typeof item.params.opacity === 'number' ? item.params.opacity : 0.6;
        if (!material.uniforms?.u_opacity) {
          material.uniforms = material.uniforms || {};
          material.uniforms.u_opacity = { value: opacity };
        }

        material.onBeforeCompile = (shader) => {
          shader.uniforms.u_opacity = { value: opacity };
          if (item.baseMap) {
            shader.uniforms.u_baseMap = { value: item.baseMap };
            shader.uniforms.u_baseMapIntensity = { value: item.baseMapIntensity };
          }
          if (item.baseMap) {
            shader.vertexShader = shader.vertexShader.replace(
              'varying vec4 vUv;',
              'varying vec4 vUv; varying vec2 vUv2;'
            );
            shader.vertexShader = shader.vertexShader.replace(
              'vUv = textureMatrix * vec4( position, 1.0 );',
              'vUv = textureMatrix * vec4( position, 1.0 ); vUv2 = uv;'
            );
            shader.fragmentShader = shader.fragmentShader.replace(
              'varying vec4 vUv;',
              'varying vec4 vUv; varying vec2 vUv2;'
            );
            shader.fragmentShader = shader.fragmentShader.replace(
              'vec4 base = texture2DProj( tDiffuse, vUv );',
              'vec4 base = texture2DProj( tDiffuse, vUv ); vec4 baseTex = texture2D( u_baseMap, vUv2 );'
            );
          }
          shader.fragmentShader = `
            uniform float u_opacity;
            ${item.baseMap ? 'uniform sampler2D u_baseMap; uniform float u_baseMapIntensity;' : ''}
            ${shader.fragmentShader}
          `;
          shader.fragmentShader = shader.fragmentShader.replace(
            /gl_FragColor\\s*=\\s*vec4\\s*\\(\\s*blendOverlay\\s*\\(\\s*base\\.rgb\\s*,\\s*color\\s*\\)\\s*,\\s*1\\.0\\s*\\)\\s*;/,
            item.baseMap
              ? 'vec3 mixed = mix(baseTex.rgb, base.rgb, u_baseMapIntensity); gl_FragColor = vec4( blendOverlay( mixed, color ), u_opacity );'
              : 'gl_FragColor = vec4( blendOverlay( base.rgb, color ), u_opacity );'
          );
          material.userData = {
            ...(material.userData || {}),
            compiledShader: shader,
            opacityUniform: shader.uniforms.u_opacity,
          };
        };

        material.needsUpdate = true;
      }

      groupRef.current.add(reflector);
      return reflector;
    });
    reflectorInstancesRef.current = created;

    return () => {
      created.forEach((reflector) => {
        groupRef.current?.remove(reflector);
        if (reflector.material) reflector.material.dispose();
        if (reflector.geometry) reflector.geometry.dispose();
        if (reflector.getRenderTarget) {
          const rt = reflector.getRenderTarget();
          if (rt) rt.dispose();
        }
      });
      reflectorInstancesRef.current = [];
    };
  }, [reflectorTargets]);

  useFrame(() => {
    const instances = reflectorInstancesRef.current;
    if (!instances.length) return;
    instances.forEach((reflector) => {
      const params = reflectorParamsRef.current[reflector.name] || {};
      const opacity = typeof params.opacity === 'number' ? params.opacity : 0.6;
      const material = reflector.material;
      if (material?.userData?.opacityUniform) {
        material.userData.opacityUniform.value = opacity;
      }
      if (material?.uniforms?.u_opacity) {
        material.uniforms.u_opacity.value = opacity;
      }
    });
  });

  return (
    <EditableGroup
      ref={groupRef}
      theatreKey={uniqueKey}
      position={[
        transform.position.x,
        transform.position.y,
        transform.position.z,
      ]}
      rotation={[
        transform.rotation.x,
        transform.rotation.y,
        transform.rotation.z,
      ]}
      scale={[
        transform.scale.x,
        transform.scale.y,
        transform.scale.z,
      ]}
      visible={visible}
      {...props}
    >
      <primitive ref={glbRef} object={glbScene} />
    </EditableGroup>
  );
}

// Preload function (opcional, para mejorar performance)
export function preloadGLB(modelPath) {
  useGLTF.preload(modelPath);
}

