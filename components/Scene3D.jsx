import RemotePlayerAvatar from "./multiplayer/RemotePlayerAvatar";
import HouseScene from "./HouseScene";
import CheckpointEntryHouse from "./checkpoints/CheckpointEntryHouse";
import CheckpointExitHouse from "./checkpoints/CheckpointExitHouse";
import Room1 from "./rooms/Room1";

import React, { Suspense } from "react";
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
    // IMPORTANT: Exclude local player's own audio — they should hear their own music at full volume
    const activeAudioInstances = getActiveAudioInstances();
    if (activeAudioInstances.size > 0) {
      const myPosition = { x: camera.position.x, z: camera.position.z };
      const remoteOnly = remotePlayersArray.filter(p => p.id !== localPlayerId);
      const audioPositions = getActiveAudioPositions(remoteOnly, activeAudioInstances);
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

      {/* House scene from Blender (exterior + cars + decoration + dance + floating texts) */}
      <HouseScene />

      {/* Checkpoint: GTA SA style entry to house interior */}
      <Suspense fallback={null}>
        <CheckpointEntryHouse />
        <CheckpointExitHouse />
      </Suspense>

      {/* Interior rooms (loaded high above exterior) */}
      <Suspense fallback={null}>
        <Room1 />
      </Suspense>

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
