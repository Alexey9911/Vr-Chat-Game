import React, { useRef, useEffect, useState, useMemo } from "react";
import { useAnimations } from "@react-three/drei";
import * as THREE from 'three';
import { useGLTFKtx2 } from "../hooks/useGLTFKtx2";
import { SkeletonUtils } from "three-stdlib";

export default function ModeloAnimado({ containerRef, ...props }) {
  const group = useRef();
  const gltf = useGLTFKtx2("/elonMusk2Anim_KTX2.glb");
  const scene = useMemo(() => SkeletonUtils.clone(gltf.scene), [gltf.scene]);
  const { actions } = useAnimations(gltf.animations, group);
  
  // Estado local - no sincronizado con otros usuarios
  const [elonAnimation, setElonAnimation] = useState('anim1');

  const originalColors = useRef(new Map());
  const activeAnimation = useRef('anim1');

  useEffect(() => {
    if (!actions || !actions[elonAnimation]) return;

    // Fade out the previous animation
    const prevAction = actions[activeAnimation.current];
    if (prevAction && prevAction !== actions[elonAnimation]) {
      prevAction.fadeOut(0.3);
    }

    // Get the new action and configure it
    const newAction = actions[elonAnimation];
    newAction.reset();

    if (elonAnimation === 'anim2') {
      // Play once and hold
      newAction.setLoop(THREE.LoopOnce, 1);
      newAction.clampWhenFinished = true;
    } else {
      // Loop indefinitely
      newAction.setLoop(THREE.LoopRepeat, Infinity);
    }

    newAction.fadeIn(0.3).play();

    // Update the active animation ref
    activeAnimation.current = elonAnimation;

  }, [actions, elonAnimation]);

  const handleClick = () => {
    setElonAnimation(prev => (prev === "anim1" ? "anim2" : "anim1"));
  };

  const handlePointerOver = () => {
    if (containerRef.current) containerRef.current.classList.add('cursor-pointer');

    scene.traverse(child => {
      if (child.isMesh && child.material) {
        const mat = child.material;
        if (!originalColors.current.has(mat)) {
          originalColors.current.set(mat, mat.color.clone());
        }
        mat.color.set(0xffffff); // cambia a blanco
        if (mat.emissive) mat.emissive.set(0xffffff); // más brillo si tiene emisivo
        if (mat.emissiveIntensity !== undefined) mat.emissiveIntensity = 0.05;
      }
    });
  };

  const handlePointerOut = () => {
    if (containerRef.current) containerRef.current.classList.remove('cursor-pointer');

    scene.traverse(child => {
      if (child.isMesh && child.material) {
        const mat = child.material;
        const originalColor = originalColors.current.get(mat);
        if (originalColor) {
          mat.color.copy(originalColor);
        }
        if (mat.emissive) mat.emissive.set(0x000000);
        if (mat.emissiveIntensity !== undefined) mat.emissiveIntensity = 1.0;
      }
    });
  };

  return (
    <group {...props}>
      <primitive ref={group} object={scene} />
      {/* Hitbox con dimensiones fijas para asegurar interactividad */}
      <mesh
        onClick={handleClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        position={[0, 1, 0]} // Posición estimada del centro del personaje
        visible={false}      // El hitbox es invisible
      >
        <boxGeometry args={[1.5, 2, 1.5]} /> {/* Tamaño generoso para cubrir el modelo */}
      </mesh>
    </group>
  );
}
