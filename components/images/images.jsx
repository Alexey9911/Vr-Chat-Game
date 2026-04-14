import React from "react";
import { useTexture } from "@react-three/drei";

export default function FloatImage({ url, position = [0, 0, 0], scale = [1, 1, 1] }) {
  const texture = useTexture(url);

  return (
    <mesh 
      position={position} 
      scale={scale}
      rotation={[-Math.PI / 2, Math.PI / 2, Math.PI / 2]}
    >
      <planeGeometry args={[10, 10]} />
      <meshBasicMaterial map={texture} transparent
      side={2}
      />
    </mesh>
  );
}
