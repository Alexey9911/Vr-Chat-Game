import { useFBO, useGLTF } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { editable as e } from '@theatre/r3f';
import { useCurrentSheet } from '@theatre/r3f';
import { types } from '@theatre/core';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useOptimizedGLTF } from '@/hooks/useOptimizedGLTF';

import vertexShader from './shaders/refractionVertex.glsl';
import fragmentShader from './shaders/refractionFragment.glsl';

export default function RefractionGLB({
  uniqueKey,
  modelPath,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = [1, 1, 1],
  visible = true,
  materialOverrides,
  useOptimizedLoader = true,
  warmupGpu = false,
  ...props
}) {
  const group = useRef();
  const { size, gl } = useThree();
  // Cached Vector3 for light position — avoids GC pressure from per-frame allocation
  const lightVec3 = useMemo(() => new THREE.Vector3(), []);
  
  // Use optimized loader if enabled
  const gltfData = useOptimizedLoader
    ? useOptimizedGLTF(modelPath, { 
        warmupGpu,
        enableMeshOpt: true,
      })
    : useGLTF(modelPath);
  
  const { scene } = gltfData;
  const EditableGroup = e.group;
  const sheet = useCurrentSheet();
  const defaultMetalness =
    materialOverrides && typeof materialOverrides.metalness === 'number'
      ? materialOverrides.metalness
      : 1;
  const defaultRoughness =
    materialOverrides && typeof materialOverrides.roughness === 'number'
      ? materialOverrides.roughness
      : 0.5;
  const defaultLight = useMemo(() => ({ x: -5.0, y: 1.0, z: -2.0 }), []);
  const [logoControls, setLogoControls] = useState({
    light: defaultLight,
    metalness: defaultMetalness,
    roughness: defaultRoughness,
  });
  const [modelTransform, setModelTransform] = useState({
    rotation: { x: rotation[0], y: rotation[1], z: rotation[2] },
  });

  const mainRenderTarget = useFBO();
  const backRenderTarget = useFBO();

  const shininess = 15.0;
  const diffuseness = 0.2;
  const fresnelPower = 8.0;
  const iorR = 1.15;
  const iorY = 1.16;
  const iorG = 1.18;
  const iorC = 1.22;
  const iorB = 1.22;
  const iorP = 1.22;
  const saturation = 1.1;
  const refraction = 0.25;

  const materialConfig = useMemo(
    () => ({
      light: defaultLight,
      metalness: types.number(1, { range: [0, 1], nudgeMultiplier: 0.01 }),
      roughness: types.number(0.5, { range: [0, 1], nudgeMultiplier: 0.01 }),
    }),
    [defaultLight]
  );

  useEffect(() => {
    if (!sheet) return;
    const obj = sheet.object(`${uniqueKey}/Material`, materialConfig, { reconfigure: true });
    obj.initialValue = {
      light: defaultLight,
      metalness: defaultMetalness,
      roughness: defaultRoughness,
    };
    const unsub = obj.onValuesChange((values) => {
      setLogoControls(values);
    });
    return () => unsub();
  }, [sheet, uniqueKey, materialConfig, defaultLight, defaultMetalness, defaultRoughness]);

  const modelConfig = useMemo(
    () => ({
      rotation: {
        x: types.number(0, { range: [-Math.PI, Math.PI], nudgeMultiplier: 0.01 }),
        y: types.number(0, { range: [-Math.PI, Math.PI], nudgeMultiplier: 0.01 }),
        z: types.number(0, { range: [-Math.PI, Math.PI], nudgeMultiplier: 0.01 }),
      },
    }),
    []
  );

  useEffect(() => {
    if (!sheet) return;
    const obj = sheet.object(`${uniqueKey}/3DModel`, modelConfig, { reconfigure: true });
    obj.initialValue = {
      rotation: { x: rotation[0], y: rotation[1], z: rotation[2] },
    };
    const unsub = obj.onValuesChange((values) => {
      setModelTransform(values);
    });
    return () => unsub();
  }, [sheet, uniqueKey, modelConfig, rotation]);

  const uniforms = useMemo(
    () => ({
      uTexture: {
        value: null,
      },
      uIorR: { value: 1.0 },
      uIorY: { value: 1.0 },
      uIorG: { value: 1.0 },
      uIorC: { value: 1.0 },
      uIorB: { value: 1.0 },
      uIorP: { value: 1.0 },
      uRefractPower: {
        value: 0.2,
      },
      uChromaticAberration: {
        value: 1.0,
      },
      uSaturation: { value: 0.0 },
      uShininess: { value: 40.0 },
      uDiffuseness: { value: 0.2 },
      uFresnelPower: { value: 8.0 },
      uLight: {
        value: new THREE.Vector3(-1.0, 1.0, 1.0),
      },
      winResolution: {
        value: new THREE.Vector2(size.width, size.height).multiplyScalar(
          Math.min(window.devicePixelRatio, 2)
        ),
      },
    }),
    [size]
  );

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms,
      }),
    [uniforms]
  );

  const glbScene = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((child) => {
      if (!child.isMesh) return;
      child.material = material;
      child.castShadow = true;
      child.receiveShadow = true;
      child.frustumCulled = false;
    });
    return clone;
  }, [scene, material]);

  useFrame((state) => {
    const { gl, scene: fullScene, camera } = state;

    if (!group.current) return;

    group.current.visible = false;

    const overrideMetalness =
      typeof logoControls.metalness === 'number'
        ? logoControls.metalness
        : materialOverrides && typeof materialOverrides.metalness === 'number'
        ? materialOverrides.metalness
        : null;
    const overrideRoughness =
      typeof logoControls.roughness === 'number'
        ? logoControls.roughness
        : materialOverrides && typeof materialOverrides.roughness === 'number'
        ? materialOverrides.roughness
        : null;

    const mappedDiffuseness =
      overrideMetalness === null
        ? diffuseness
        : Math.max(0, Math.min(1, 1 - overrideMetalness)) * 0.2;
    const mappedShininess =
      overrideRoughness === null
        ? shininess
        : Math.max(1, (1 - overrideRoughness) * 50 + 5);

    material.uniforms.uDiffuseness.value = mappedDiffuseness;
    material.uniforms.uShininess.value = mappedShininess;
    const lightSource =
      logoControls && logoControls.light ? logoControls.light : defaultLight;
    lightVec3.set(lightSource.x, lightSource.y, lightSource.z);
    material.uniforms.uLight.value = lightVec3;
    material.uniforms.uFresnelPower.value = fresnelPower;

    material.uniforms.uIorR.value = iorR;
    material.uniforms.uIorY.value = iorY;
    material.uniforms.uIorG.value = iorG;
    material.uniforms.uIorC.value = iorC;
    material.uniforms.uIorB.value = iorB;
    material.uniforms.uIorP.value = iorP;

    const satMin = 1.0;
    const satMax = 1.1;
    const satSpeed = 0.4;
    const satT = 0.5 + 0.5 * Math.sin(state.clock.elapsedTime * satSpeed);
    material.uniforms.uSaturation.value = satMin + (satMax - satMin) * satT;
    const caMin = 0.35;
    const caMax = 0.55;
    const caSpeed = 0.9;
    const caT = 0.5 + 0.5 * Math.sin(state.clock.elapsedTime * caSpeed);
    material.uniforms.uChromaticAberration.value = caMin + (caMax - caMin) * caT;
    material.uniforms.uRefractPower.value = refraction;

    gl.setRenderTarget(backRenderTarget);
    gl.render(fullScene, camera);

    material.uniforms.uTexture.value = backRenderTarget.texture;
    material.side = THREE.BackSide;

    group.current.visible = true;

    gl.setRenderTarget(mainRenderTarget);
    gl.render(fullScene, camera);

    material.uniforms.uTexture.value = mainRenderTarget.texture;
    material.side = THREE.FrontSide;

    gl.setRenderTarget(null);
  });

  return (
    <EditableGroup
      ref={group}
      theatreKey={uniqueKey}
      position={position}
      rotation={[
        modelTransform.rotation.x,
        modelTransform.rotation.y,
        modelTransform.rotation.z,
      ]}
      scale={scale}
      visible={visible}
      {...props}
    >
      <primitive object={glbScene} />
    </EditableGroup>
  );
}
