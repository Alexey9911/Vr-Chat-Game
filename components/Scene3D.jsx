import RemotePlayerAvatar from "./multiplayer/RemotePlayerAvatar";
import HouseScene from "./HouseScene";
import VallasObject from "./VallasObject";
import VallasTexts from "./VallasTexts";
import HouseExteriorCollision from "./HouseExteriorCollision";
import CarsCollision from "./CarsCollision";
import OrangiePathNPC from "./OrangiePathNPC";
import HouseAirdrops from "./HouseAirdrops";
import CheckpointEntryHouse from "./checkpoints/CheckpointEntryHouse";
import CheckpointExitHouse from "./checkpoints/CheckpointExitHouse";
import CheckpointRoomsToBalcony from "./checkpoints/CheckpointRoomsToBalcony";
import CheckpointBalconyToRooms from "./checkpoints/CheckpointBalconyToRooms";
import HouseBalconyCollision from "./HouseBalconyCollision";
import Room1 from "./rooms/Room1";
import RoomLabels from "./rooms/RoomLabels";
import RoomMusic from "./rooms/RoomMusic";
import RoomDancer from "./rooms/RoomDancer";
import RoomGirl from "./rooms/RoomGirl";
import RoomIndians from "./rooms/RoomIndians";
import RoomCows from "./rooms/RoomCows";
import RoomsObjectsCollision from "./rooms/RoomsObjectsCollision";

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
    // FIX — Pass the FULL `remotePlayersArray` (which includes the local
    // player's self-entry from the multiplayer store) so spatial processes
    // BOTH local and remote audio instances uniformly. Matches elonpage1.
    //
    // Previously we filtered out the local player ("they should hear their
    // own music at full volume"). That filter meant spatial NEVER touched
    // the local player's YT ghost audio, so its volume stayed at the initial
    // AUDIO_VOLUME (0.5) — and `setYouTubeVolume` from the settings slider
    // then wrote a FLAT non-spatial value to every YT ghost, clobbering the
    // distance-based attenuation on remote ghosts as well. Result: YT played
    // at the same volume everywhere in the map, regardless of distance.
    //
    // With the filter removed, the local player's distance-to-self is ~0,
    // so `calculateVolumeFromDistance(0) = MAX_VOLUME` — they still hear
    // their own music at full volume, and remote YT ghosts now attenuate
    // correctly with distance, same as skin music.
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

      {/* House scene from Blender (exterior + cars + decoration + dance + floating texts) */}
      <HouseScene />
      <Suspense fallback={null}>
        <VallasObject />
      </Suspense>
      <VallasTexts />

      {/* Invisible collision meshes for exterior (casa + jardin w/ door hole + street perimeter) */}
      <Suspense fallback={null}>
        <HouseExteriorCollision />
      </Suspense>

      {/* Invisible collision meshes for 4 parked cars (loaded from physics_cars.glb, 0 draw calls) */}
      <Suspense fallback={null}>
        <CarsCollision />
      </Suspense>

      {/* Invisible collision slab for the exterior balcony (Plane.011).
          Thickened internally so sprinting players can't tunnel through. */}
      <Suspense fallback={null}>
        <HouseBalconyCollision />
      </Suspense>

      {/* Checkpoint + Interior rooms + NPCs — same Blender scene offset as HouseScene */}
      <group position={[190.12, 1.1857, -88.67]}>
        <Suspense fallback={null}>
          <CheckpointEntryHouse />
          <CheckpointExitHouse />
          {/* Rooms → balcony (c3). Visual mounted with ROOM_Y_OFFSET lift
              internally; trigger uses world coords from localPlayerLive. */}
          <CheckpointRoomsToBalcony />
          {/* Balcony → rooms (c4). Lives in the exterior Y range, so no lift. */}
          <CheckpointBalconyToRooms />
        </Suspense>
        <Suspense fallback={null}>
          <Room1 />
        </Suspense>
        <Suspense fallback={null}>
          <RoomLabels />
        </Suspense>
        <Suspense fallback={null}>
          <RoomMusic />
        </Suspense>
        <Suspense fallback={null}>
          <RoomDancer />
        </Suspense>
        <Suspense fallback={null}>
          <RoomGirl />
        </Suspense>
        <Suspense fallback={null}>
          <RoomIndians />
        </Suspense>
        <Suspense fallback={null}>
          <RoomCows />
        </Suspense>
        <Suspense fallback={null}>
          <RoomsObjectsCollision />
        </Suspense>
        <Suspense fallback={null}>
          <OrangiePathNPC />
        </Suspense>
        <Suspense fallback={null}>
          <HouseAirdrops />
        </Suspense>
      </group>

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
