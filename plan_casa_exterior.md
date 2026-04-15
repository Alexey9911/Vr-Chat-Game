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

## Notas
- El GLB usa compresión Draco
- Visualmente todo está perfecto, solo falta optimización
- Ir poco a poco, verificar en cada paso
