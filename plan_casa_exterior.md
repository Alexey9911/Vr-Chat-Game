# Plan Casa Exterior — Optimización GLB

Archivo: `public/alon_house/house_scene-v1.glb` (Draco compressed)

## Objetivos

### 1. InstancedMesh — Suelos (Floor_Modular) ✅ COMPLETADO
- gltf.report ya mergeó los 16 Floor_Modular en `floor_main` (1 draw call)
- No necesita InstancedMesh — mesh merging es más eficiente para estáticos
- De 80 draws → 11 draws tras optimización

### 2. InstancedMesh — Árboles y Arbustos ✅ COMPLETADO
- gltf.report ya optimizó hedges/grass en el GLB
- Mismo resultado que InstancedMesh para objetos estáticos

### 3. Skin Decoración — Animación Baile Loop ✅ COMPLETADO
- `char1` (skinned mesh) + `Armature` en el GLB de la casa
- Original char1/Armature oculto en la escena principal
- Clone con `SkeletonUtils.clone()` + `useAnimations` para mixer propio
- Animación `Boom_Dance` en loop infinito (`LoopRepeat`, `clampWhenFinished=false`)
- Componente: `components/HouseScene.jsx` → `HouseDancer`

### 4. Texto 3D Flotante en Planes Guía ✅ COMPLETADO
- Posiciones extraídas de `plane_texto_flotante.glb` accessor min/max
- `$AlonHouse` → estilo dorado (alonverse) en `[-197.08, 42.63, 87.67]`
- `Bananamobile` → estilo cromado (cybertruck) en `[-247.82, 23.02, 71.73]`
- `Cybertruck` → estilo cromado en `[-243.83, 23.02, 102.84]`
- `Lamborghini` → estilo cromado en `[-231.83, 23.02, 136.31]`
- Billboard + Text (drei) con `sin()` loop vertical
- Font: `/font1.json`, outline, emissive glow

## 5. Sistema de Checkpoints — Entrar/Salir Casa (GTA SA Style) 🚧 EN PROGRESO

### Checkpoint de Entrada a Casa ✅ IMPLEMENTADO
- **GLB**: `public/alon_house/checkpoint_entry_house.glb`
- **Posición GLB**: Center (-175.84, 9.60, 86.21), Size 0x12.91x8.20
- **Shader**: Gradient amarillo con opacity 0.35 arriba → 1.0 abajo (GTA SA style)
- **Trigger distance**: 8 unidades
- **Teleport destino**: (-141.60, ~321, 87.89) → room1 floor level
- **Componente**: `components/checkpoints/CheckpointEntryHouse.tsx`

### Checkpoint de Salida (Interior → Exterior) ✅ IMPLEMENTADO
- **Posición**: Cerca de room1 floor edge (-141.60, 321, 87.89)
- **Teleport destino**: Exterior spawn (-59.95, EYE_HEIGHT, -87.86) Rot:74.61°
- **Componente**: `components/checkpoints/CheckpointExitHouse.tsx`

### Infraestructura ✅ IMPLEMENTADO
- `lib/zoneStore.ts` — Zustand store para zona actual (exterior/interior/balcon)
- `lib/teleportController.ts` — Global teleport function registration
- `components/checkpoints/FadeOverlay.tsx` — CSS fade a negro
- `useCameraControls.ts` — Zone-aware ground check, boundaries, maxStep skip
- `pages/index.tsx` — FadeOverlay integrado
  
### Optimización Camera Rendering ✅ DEBUG HUD LISTO
- **CameraDebugHUD** (F8): Slider en tiempo real para ajustar `camera.far`
- **Presets**: Exterior (500) / Interior (100)
- **TODO**: Implementar cambio dinámico basado en zona actual

### Posiciones
- **Exterior spawn**: X:-59.95, Z:-87.86, Rot:74.61° (display) = 254.61° (internal)
- **Interior**: room1 center (-141.60, 341.43, 87.89), floor ~Y:311
- **Checkpoint door**: (-175.84, 9.60, 86.21)
- **Checkpoint balcón**: TBD

## 6. Interior — Rooms & Escaleras 🚧 PENDIENTE

### Estructura Interior
- **Ubicación**: Muy arriba (Y ~500+) para que camera.far lo oculte desde exterior
- **Habitaciones**: 3 rooms + sótano opcional
- **Escaleras**: 
  - Planos invisibles inclinados desde Blender
  - Importados como collision mesh
  - Sin librería de físicas adicional — usar collision slope existente
  - El personaje sube naturalmente si la inclinación es correcta
  
### Collision Meshes (Blender → GLB)
- **Escaleras**: Planos inclinados invisibles (`visible: false`)
- **Pisos separados**: Un mesh por habitación para evitar glitches
- **Paredes**: Envueltas como en exterior (`colisiones` mesh)
- **Naming convention**: `colisiones_interior`, `escaleras_01`, `escaleras_02`, etc.

### Decoración
- **NPCs estáticos**: Modelos 3D de humanos (no skins jugables)
- **Props**: Sin interactividad, solo visual
- **GLBs separados**: Fácil de cargar/descargar según zona

## 7. Optimizaciones Multiplayer 🚧 PENDIENTE

### Performance
- **Camera.far dinámico**: Cambia según zona (exterior/interior)
- **Spatial audio range**: Ya ajustado (120 units música, 80 units voz)
- **GLB mesh merging**: Ya optimizado en gltf.report
- **Posible mejora**: Deno KV backend para state sync si necesario

### Audio Spatial
- **Problema potencial**: Jugadores en interior/exterior muy separados
- **Solución**: Verificar si distance check funciona correctamente con Y diferencial grande
- **Alternativa**: Desactivar audio espacial entre zonas diferentes

## Notas Técnicas
- **Camera.far**: Es distancia esférica 3D desde cámara, no solo horizontal/vertical
- **Escaleras**: Inclinación óptima ~30-40° para que personaje suba naturalmente
- **Checkpoints**: Solo teleport + fade, sin cargar/descargar escenas (todo en memoria)
- **GLB compression**: Mantener Draco para todos los assets nuevos
- **Testing**: CameraDebugHUD con sliders para ajustar far/near en tiempo real
