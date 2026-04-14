import React from "react";
import { useGLTFKtx2 } from "../hooks/useGLTFKtx2";

export default function Cybertruck(props) {
  const { scene } = useGLTFKtx2("/cybertruckDraco_KTX2.glb");
  return <primitive object={scene.clone()} {...props} />;
}
