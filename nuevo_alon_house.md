# Nuevo Alon House — Plan de Migración

**Fecha inicio**: 2026-04-17
**Contexto**: La Alon House fue agrandada significativamente en Blender y se agregó una calle exterior. Esto obliga a re-posicionar spawn, checkpoints, colisiones, textos flotantes, path de NPC decorativo, etc. Toda la lógica/código ya existe y funciona — solo hay que actualizar **valores de posiciones** leyendo los nuevos GLBs en terminal con `scripts/inspect-glb.mjs`.

**Base previa**: Ver `plan_casa_exterior.md` (estado anterior ya funcional con casa pequeña).

---

## Workflow General (repetir por cada paso)

1. Usuario pasa GLB nuevo → colocar en `public/alon_house/`
2. Leer posiciones con: `node scripts/inspect-glb.mjs public/alon_house/<archivo>.glb`
3. Extraer center/min/max de cada mesh relevante (nombres en Blender son la key)
4. Actualizar constantes en el código correspondiente
5. Probar en dev server (usuario corre `npm run dev` manualmente)
6. Marcar check ✅ con fecha

---

## FASE 1 — Casa Exterior (EN CURSO)

### 1.1 Importar nuevo `house_scene-v1.glb` ⏳ ESPERANDO GLB
- [ ] Usuario entrega GLB nuevo (casa grande + calle + arbustos + decoración)
- [ ] Reemplazar `public/alon_house/house_scene-v1.glb`
- [ ] Verificar carga en `components/HouseScene.jsx`
- [ ] Leer estructura con `inspect-glb.mjs` y documentar meshes encontrados

### 1.2 Actualizar Spawn del Jugador ⏳
- **Problema actual**: spawnea en la calle (fuera), debe spawnear dentro/frente a puerta
- [ ] Leer posición del plane spawn en GLB (si existe) o definir manualmente
- [ ] Actualizar constante de spawn exterior en `useCameraControls.ts` / `pages/index.tsx`
- **Valor previo**: `(-59.95, EYE_HEIGHT, -87.86) Rot:74.61°` → **cambiar**

### 1.3 Re-posicionar Checkpoint Entrada ⏳
- **Mesh objetivo**: `checkpoint_door_house_entry` (dentro del nuevo house_scene GLB)
- [ ] Extraer center + size del mesh con inspect-glb
- [ ] Actualizar `components/checkpoints/CheckpointEntryHouse.tsx`
- [ ] Ajustar trigger distance si el tamaño cambió
- [ ] Confirmar teleport destino sigue siendo room1 (Y~321)

### 1.4 Colisiones Exterior (3 colisiones en 1 GLB) ⏳
- **GLB dedicado**: Usuario entregará archivo con 3 meshes separados
  - `colision_exterior_calle` (perímetro exterior/calle)
  - `colision_arbustos` (arbustos que rodean casa)
  - `colision_casa` (pared/estructura de la casa)
- [ ] Leer posiciones/bounds con inspect-glb
- [ ] Registrar cada mesh en el sistema de colisión existente (`lib/collisionRef.ts`)
- [ ] Aplicar a cámara + jugador (mismo patrón que antes)
- [ ] Meshes `visible: false`

### 1.5 NPC Decorativo en Path Infinito ⏳
- **GLB path**: 4 planes en esquinas (uno por cada vuelta)
- [ ] Leer posiciones de los 4 planes con inspect-glb
- [ ] Crear componente `HousePatrolNPC` (similar a `HouseDancer`)
- [ ] Interpolación lineal entre waypoints, loop infinito, velocidad alta
- [ ] Rotación del modelo hacia el siguiente waypoint

### 1.6 Textos 3D Flotantes (re-posición) ⏳
- **Fuente**: Nuevos planes en Blender dentro del GLB, el **nombre del plane = texto** que debe mostrar
- [ ] Leer todos los planes tipo `texto_*` con inspect-glb
- [ ] Extraer posición + rotación + altura por plane
- [ ] Actualizar array de textos en `components/HouseScene.jsx` (sección `HouseFloatingText`)
- [ ] Mantener estilos previos: dorado para `$AlonHouse`, cromado para vehículos

---

## FASE 2 — Interior Rooms 🚧

### 2.1 Importar GLB interior (ya creado en Blender)
- [ ] Colocar en `public/alon_house/rooms/` (o similar)
- [ ] Checkpoint salida hacia exterior

### 2.2 LOD con drei (`<Detailed>` o `useLOD`)
- Renderizar lejos con menos calidad, cerca con alta
- Aplicar a exterior cuando estás en interior y viceversa
- Usar `camera.far` dinámico por zona (ya hay debug HUD en F8)

### 2.3 Música por room
- Integrar con `lib/audio/musicSystem.ts`
- Trigger al entrar en zona

### 2.4 InstancedMesh en room con NPC repetido
- NPC decorativo en filas/columnas con `<Instances>` de drei
- Único draw call, mejor performance

### 2.5 Basement + Escaleras + Segundo piso/terraza
- Plane inclinado como colisión (invisible), visual = escaleras
- Usar mismo workflow de planes-guía desde Blender

---

## FASE 3 — Extras Finales 🚧

### 3.1 Skins Jugador Adicionales
- Código ya existe, solo agregar GLBs
- Usuario pasará código de referencia

---

## Log de Progreso

| Fecha | Paso | Estado | Notas |
|-------|------|--------|-------|
| 2026-04-17 | Creación plan | ✅ | Plan inicial creado, esperando GLB nuevo de alon house |

---

## Notas Técnicas Clave

- **Script inspect-glb**: `scripts/inspect-glb.mjs` — imprime meshes con center/min/max/size. Es la fuente de verdad para posicionar todo.
- **Convención**: Nombres de meshes en Blender deben ser semánticos (`colision_*`, `texto_*`, `checkpoint_*`, `path_esquina_*`).
- **No tocar lógica**: Todo el código de colisiones, checkpoints, textos, HouseDancer ya funciona. Solo se actualizan **constantes de posición**.
- **Orden estricto**: GLB → inspect → actualizar constante → test. No modificar varios pasos a la vez.
