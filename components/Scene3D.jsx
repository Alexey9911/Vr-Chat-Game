import RemotePlayerAvatar from "./multiplayer/RemotePlayerAvatar";

import React from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useMultiplayerStore } from "../lib/multiplayerStore";
import { updateSpatialAudio, getActiveAudioPositions } from "../lib/audio/spatialAudioSystem";
import { getActiveAudioInstances } from "../lib/audio/musicSystem";
import { getActiveVoiceAudioMap, calculateVoiceVolume } from "../lib/audio/voiceChatSystem";

export default function Scene3D({ containerRef }) {
  // Multiplayer: get remote players from store
  const remotePlayers = useMultiplayerStore((s) => s.remotePlayers);
  const localPlayerId = useMultiplayerStore((s) => s.localPlayerId);
  const { camera } = useThree();

  useFrame(() => {
    // Build player array once per frame (shared by music + voice spatial audio)
    const remotePlayersArray = Array.from(remotePlayers.values());

    // Spatial Audio: Update volume based on distance (OPTIMIZED: skip if no music)
    const activeAudioInstances = getActiveAudioInstances();
    if (activeAudioInstances.size > 0) {
      const myPosition = { x: camera.position.x, z: camera.position.z };
      const audioPositions = getActiveAudioPositions(remotePlayersArray, activeAudioInstances);
      updateSpatialAudio(myPosition, audioPositions, performance.now());
    }

    // Voice Chat Spatial Audio: adjust peer audio volume by distance (12m range)
    const voiceAudioMap = getActiveVoiceAudioMap(remotePlayersArray);
    if (voiceAudioMap.size > 0) {
      const myPos = { x: camera.position.x, z: camera.position.z };
      voiceAudioMap.forEach(({ audioEl, position }) => {
        const dx = myPos.x - position.x;
        const dz = myPos.z - position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        audioEl.volume = calculateVoiceVolume(dist);
      });
    }
  });

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[10, 10, 5]}
        intensity={1}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={0.1}
        shadow-camera-far={50}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
      />

      {/* Floor — placeholder until Blender house model is ready */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.01, 0]}
        receiveShadow
      >
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial
          color="#2a2a2a"
          roughness={0.8}
          metalness={0.1}
        />
      </mesh>

      {/* ============================================= */}
      {/* MULTIPLAYER: Remote Player Avatars */}
      {/* ============================================= */}
      {Array.from(remotePlayers.values()).map((player) => (
        <RemotePlayerAvatar
          key={player.id}
          player={player}
          isLocal={player.id === localPlayerId}
        />
      ))}
    </>
  );
}
