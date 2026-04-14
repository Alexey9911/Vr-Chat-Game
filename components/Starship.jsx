import React, { useRef, useEffect, useMemo } from "react";
import { useAnimations } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useGLTFKtx2 } from "../hooks/useGLTFKtx2";
import * as THREE from "three";
import { SkeletonUtils } from "three-stdlib";

export default function Starship(props) {
  const group = useRef();
  const elonGroup = useRef();
  
  // Importar modelos
  const { scene: starshipScene } = useGLTFKtx2("/starship_KTX2.glb");
  const elonGltf = useGLTFKtx2("/elonMusk2Anim_KTX2.glb");
  const elonScene = useMemo(() => SkeletonUtils.clone(elonGltf.scene), [elonGltf.scene]);
  const { actions } = useAnimations(elonGltf.animations, elonGroup);
  
  const speed = 0.15;
  const maxHeight = 100;
  const startY = -20;
  const elonOffsetY = 35; // Offset entre la nave y Elon

  // Inicializar posiciones
  useEffect(() => {
    if (group.current && elonGroup.current) {
      group.current.position.y = startY;
      elonGroup.current.position.y = startY + elonOffsetY;
    }
  }, []);

  useFrame(() => {
    if (group.current && elonGroup.current) {
      group.current.position.y += speed;
      elonGroup.current.position.y += speed;
      
      if (group.current.position.y >= maxHeight) {
        group.current.position.y = startY;
        elonGroup.current.position.y = startY + elonOffsetY;
      }
    }
  });

  // Configurar animación inicial (solo una vez)
  useEffect(() => {
    const names = Object.keys(actions || {});
    const action = actions?.['anim2'] || (names.length ? actions[names[0]] : undefined);
    if (action) {
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
      action.play();
    }
    
    return () => {
      // Limpiar animaciones al desmontar
      Object.values(actions).forEach(a => a?.stop());
    };
  }, [actions]);

  return (
    <group position={[0, -27, -30]}>
      <primitive scale={5} ref={group} object={starshipScene} {...props} />
      <primitive scale={2} ref={elonGroup} object={elonScene} {...props} />
    </group>
  );
}
