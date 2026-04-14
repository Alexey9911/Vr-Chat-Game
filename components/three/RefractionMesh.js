import { useFBO } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { v4 as uuidv4 } from 'uuid';

import vertexShader from './shaders/refractionVertex.glsl';
import fragmentShader from './shaders/refractionFragment.glsl';

export default function RefractionMesh() {
  const mesh = useRef();
  const { size } = useThree();

  const mainRenderTarget = useFBO();
  const backRenderTarget = useFBO();

  const light = { x: -1.0, y: 1.0, z: 1.0 };
  const diffuseness = 0.2;
  const shininess = 15.0;
  const fresnelPower = 8.0;
  const iorR = 1.15;
  const iorY = 1.16;
  const iorG = 1.18;
  const iorC = 1.22;
  const iorB = 1.22;
  const iorP = 1.22;
  const saturation = 1.14;
  const chromaticAberration = 0.5;
  const refraction = 0.25;

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

  useFrame((state) => {
    const { gl, scene, camera } = state;

    if (!mesh.current) return;

    mesh.current.visible = false;

    // Update uniforms from Leva controls
    mesh.current.material.uniforms.uDiffuseness.value = diffuseness;
    mesh.current.material.uniforms.uShininess.value = shininess;
    mesh.current.material.uniforms.uLight.value = new THREE.Vector3(
      light.x,
      light.y,
      light.z
    );
    mesh.current.material.uniforms.uFresnelPower.value = fresnelPower;

    mesh.current.material.uniforms.uIorR.value = iorR;
    mesh.current.material.uniforms.uIorY.value = iorY;
    mesh.current.material.uniforms.uIorG.value = iorG;
    mesh.current.material.uniforms.uIorC.value = iorC;
    mesh.current.material.uniforms.uIorB.value = iorB;
    mesh.current.material.uniforms.uIorP.value = iorP;

    mesh.current.material.uniforms.uSaturation.value = saturation;
    mesh.current.material.uniforms.uChromaticAberration.value = chromaticAberration;
    mesh.current.material.uniforms.uRefractPower.value = refraction;

    // Render backside
    gl.setRenderTarget(backRenderTarget);
    gl.render(scene, camera);

    mesh.current.material.uniforms.uTexture.value = backRenderTarget.texture;
    mesh.current.material.side = THREE.BackSide;

    mesh.current.visible = true;

    // Render frontside
    gl.setRenderTarget(mainRenderTarget);
    gl.render(scene, camera);

    mesh.current.material.uniforms.uTexture.value = mainRenderTarget.texture;
    mesh.current.material.side = THREE.FrontSide;

    gl.setRenderTarget(null);
  });

  return (
    <mesh ref={mesh}>
      <torusGeometry args={[3, 1, 32, 100]} />
      <shaderMaterial
        key={uuidv4()}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
      />
    </mesh>
  );
}
