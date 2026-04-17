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

## FASE 1 — Casa Exterior ✅ COMPLETADA (2026-04-17)

### 1.1 Importar nuevo `house_scene-v1.glb` ✅
- [x] GLB colocado en `public/alon_house/house_scene-v1.glb`
- [x] Carga verificada en `components/HouseScene.jsx`
- [x] Offset aplicado en group: `OX=190.12, OY=1.1857, OZ=-88.67`

### 1.2 Spawn del Jugador ✅
- **Nuevo spawn**: `(-200.58, EYE_HEIGHT, -139.71)` rot `50.65°`
- **Archivo**: `hooks/useCameraControls.ts` (const `SPAWN_X`, `SPAWN_Z`, `SPAWN_ROT_DISPLAY`)

### 1.3 Checkpoint Entrada ✅
- **GLB separado**: `public/alon_house/checkpoint_entry_house.glb` (nodo `checkpoint_door_house_entry`)
- **Posición Blender**: `(-186.10, 11.36, 96.25)` + offset
- **Archivo**: `components/checkpoints/CheckpointEntryHouse.tsx` (const `CHECKPOINT_WORLD`)
- Mantiene shader gradient amarillo + bob animation

### 1.4 Colisiones Exterior (3 meshes en 1 GLB) ✅
- **GLB**: `public/alon_house/collision house externo.glb`
- **Meshes registrados**:
  - `casa_collision` (paredes de la casa)
  - `jardin_house_collision` (perimetro jardin con hueco de puerta, volumen solidify)
  - `exterior_calle_collision` (perímetro calle)
- **Componente**: `components/HouseExteriorCollision.jsx` (invisible, DoubleSide material)
- **Sistema**: `lib/collisionRef.ts` con API `registerCollisionMesh / getCollisionMeshes`
- **Raycast**: `hooks/useCameraControls.ts` usa `intersectObjects(collisionMeshes, false)`
- **Clamp exterior ELIMINADO** — colisiones 100% vía GLB, sin hardcoded boundaries

### 1.5 NPC Decorativo en Path Cuadrado ✅
- **GLB path**: `public/alon_house/orangie_paths.glb` — 4 planes `path 2/3/4/5`
- **NPC**: `Mesh_0.001` del `house_scene-v1.glb` (silla de ruedas)
- **Componente**: `components/OrangiePathNPC.jsx` — detach + reparent, interp lineal + yaw tangente
- **Velocidad**: 100 u/s
- **Texto flotante**: Billboard `Orangie` arriba del NPC, estilo cromado, follow camera

### 1.6 Textos 3D Flotantes ✅
- **GLB de referencia (solo lectura en terminal)**: `public/alon_house/texto_autos_casa.glb`
- **Planes → textos**:
  - `$AlonHouse` (alonverse, Text3D extrude, dorado, fontSize 8, bob rápido)
  - `Lamborghini Urus` / `BMW M4` / `Bananamobile` / `Corvette C8` (cybertruck, Billboard cromado)
- **Archivo**: `components/HouseScene.jsx` (array `FLOATING_TEXTS`)
- **Bob**: alonverse `speed 3.2 / amp 2.2`, cybertruck `speed 1.2 / amp 0.8`

### 1.7 Dancer char1 separado ✅ — `components/HouseScene.jsx` (HouseDancer)
- `Boom_Dance` + Armature + skin se perdieron al re-exportar la casa grande.
- Solución: GLB dedicado `public/alon_house/alon_skin_house-v1.glb` con `char1 + Armature + 10 animaciones`.
- `HouseDancer` en `components/HouseScene.jsx` carga el GLB separado y reproduce `Boom_Dance` loop.

### 1.8 Airdrops — InstancedMesh x N ✅ — `components/HouseAirdrops.jsx`
- **GLB guía**: `public/alon_house/airdrop_paths.glb` (planes `airdrop_1/_001/_002` y `airdrop_2/_001/_002`).
- **Source meshes** extraídos de `house_scene-v1.glb`:
  - `Mesh_0.003` (airdrop_1) — Y=8.19, scale=8.19
  - `Mesh_0.002` (airdrop_2) — Y=0.30, scale=7.67
- Dos `<instancedMesh>` (uno por tipo) → **2 draw calls totales** para N airdrops.
- Originales detach del scene graph (mismo patrón que `char1` y `Mesh_0.001`).
- **Fix crítico**: planes de Blender están tumbados (su +Z local = world +Y), la quat completa tumba al personaje. Solución: `yawOnlyQuat()` — extrae solo Y-euler de la quaternion, descarta X/Z tilt. Los airdrops quedan parados mirando la dirección configurada.

---

## FASE 2 — Interior Rooms 🚧

**Concepto**: rooms apiladas muy arriba en Y (estilo GTA San Andreas — dimensión separada). Cada room es un GLB independiente para organización limpia. Teleport vía checkpoints.

### 2.1 Importar GLBs interior
- [ ] Colocar cada room en `public/alon_house/rooms/<room_name>.glb`
- [ ] Componente por room (copiar patrón de `components/rooms/Room1.jsx`)
- [ ] Checkpoint salida hacia exterior (patrón de `CheckpointExitHouse.tsx`)

### 2.2 Performance: camera.far dinámico ✅ DECIDIDO

**Estrategia final acordada** (simple, sin LOD, sin occlusion culling avanzado):

| Zona | `camera.far` | Por qué |
|------|-------------|---------|
| **Exterior (alon house)** | **350** | Cubre toda la casa + calle desde cualquier esquina del mapa. Probado con leva. |
| **Interior (rooms)** | **200** o menos | Las rooms son pequeñas, nunca se ve todo de golpe. Menos work en GPU. |

**Ubicación de rooms en Blender**: `Y = 500+` (arriba de la casa, estilo GTA SA). Con `far=350` en exterior las rooms a Y=500 quedan fuera (distancia + ángulo) y no se renderizan. Reciprocal: al estar en room con far=200, la casa abajo queda fuera.

**Descartado**:
- `<Detailed>` LOD — innecesario porque al estar en room no se ve el exterior, y viceversa. Solo sumaría trabajo de exportar versiones bajas en Blender sin ganancia real.
- Occlusion culling manual (portals, BVH) — complicación innecesaria para zonas mutuamente exclusivas.
- Unload/streaming de GLBs — mundos pequeños, todo cabe en memoria sin problema.

**Comportamiento memoria**: los GLBs de rooms y exterior se cargan UNA vez al inicio y quedan en VRAM/RAM. Al bajar `far` el objeto sigue en memoria — solo no se rasteriza. Al cambiar de zona (checkpoint) solo se ajusta `far` + `updateProjectionMatrix()`. **Nada de re-cargar assets**.

**Trigger**:
- [ ] Al entrar a room via checkpoint → `camera.far = 200; camera.updateProjectionMatrix()`
- [ ] Al salir de room via checkpoint → `camera.far = 350; camera.updateProjectionMatrix()`
- Constantes en `lib/camera/cameraConstants.ts`
- Panel leva en `components/DebugCameraFar.tsx` se mantiene para futuro tuning, se puede desactivar con un flag env.

#### Referencia histórica (no implementar, solo contexto):
Se evalúo combinar `camera.far` con `<Detailed>` LOD, pero se descartó por simplicidad. Dos técnicas analizadas:

**A) `camera.far` dinámico por zona** (más fácil, alto impacto)
- Interior: `far = 500` (solo ves la room)
- Exterior: `far = 2000-3000` (ves toda la casa + calle)
- Trigger: al cruzar checkpoint se ajusta `camera.far` + `camera.updateProjectionMatrix()`
- Lo lejano se culled ANTES de dibujar — no se procesa vertex/fragment shader → ganancia grande.
- **Importante**: el objeto sigue en memoria, solo no se rasteriza. El CPU aun hace traversal del scene graph pero eso es micro comparado con shader work.

**B) `<Detailed>` de drei (LOD por objeto)** — reducir calidad al alejarse
- Cada objeto tiene N niveles de mesh (alto poly → mid → low). Drei auto-selecciona según distancia a cámara.
- **Problema**: hay que pre-generar LODs en Blender (decimate modifier) y exportar cada versión. Mucho trabajo para scene grande.
- **Alternativa**: `<SimplifiedGeometry>` de drei-community o usar `meshoptimizer` en build — no probado.
- **Veredicto**: solo vale la pena para objetos muy polígono (casa compleja, árboles densos). Airdrops/NPCs con pocos tris no necesitan LOD.

**¿Solo `camera.far` es suficiente?** — En la gran mayoría de casos **sí**. Si al alejarte más allá del far los objetos desaparecen limpio, ya ganaste performance (zero shader cost). Solo necesitas LOD si *dentro del far* tienes objetos muy pesados (millones de vértices) que aunque visibles de lejos no aportan detalle.

**Granularidad del LOD**: `<Detailed>` es **por objeto**, no por GLB completo. Tu escena es un GLB con muchos objetos — aplicas LOD solo a los más pesados (la casa, arbustos densos). Los demás (suelo, autos) no lo necesitan.

**Plan concreto**:
- [ ] Medir baseline: FPS actual con todo visible (usar `<Perf />` de r3f-perf).
- [ ] Probar `camera.far = 600` en exterior — ver si se nota el clipping.
- [ ] Ajustar Y de las rooms (super arriba) para que queden fuera del far del exterior y viceversa.
- [ ] Si FPS sigue bajo con casa visible completa: aplicar `<Detailed>` solo a meshes de polígono alto.
- [ ] Como fallback/complemento: **frustum culling manual** — meshes grandes con bounding box custom ya se cullean por defecto en three.js, verificar que las `boundingSphere` sean correctas.

**HUD F8 ya existente**: muestra posición + rotación cámara.

**Tuning con leva**: instalado `leva`, componente `components/DebugCameraFar.tsx` montado en `Canvas3D.tsx`. Panel top-right con sliders `near/far` + `showHelper` (CameraHelper wireframe). Valor 350 validado en vivo.

### 2.3 Música por room
- Integrar con `lib/audio/musicSystem.ts` (sistema existente)
- Trigger on-enter: detectar cruce de checkpoint → `playMusicInRoom(roomId)`
- Fade in/out al cambiar zona

### 2.4b Escaleras + Sótano (físicas)
- Plane inclinado como colisión (mesh invisible con `side: DoubleSide`)
- Escaleras = plane inclinado, el ray-cast vertical del jugador ajusta Y según la altura del hit
- Sótano = teleport por checkpoint o slope continuo según diseño

### 2.4 InstancedMesh — NPC interior clonado (FASE 2) ⏳
**Patrón**: mismo código que `HouseAirdrops.jsx` — extraer geometry+material de un mesh fuente del GLB de room, hacer 1 `InstancedMesh` con N transforms.
- [ ] Usuario entregará GLB con planes tipo `npc_1`, `npc_2`, ... en la room con música
- [ ] Copiar patrón de `yawOnlyQuat` si los planes están tumbados
- [ ] 1 draw call para todos los clones del NPC

### 2.5 Basement + Escaleras + Segundo piso/terraza
- Plane inclinado como colisión (invisible), visual = escaleras
- Usar mismo workflow de planes-guía desde Blender

---

## FASE 3 — Extras Finales 🚧

### 3.1 Skins Jugador Adicionales (EN CURSO) ⏳

**Referencia base**: `alonskin-v1.glb` — skin actual del jugador con animaciones. Lógica en `components/multiplayer/RemotePlayerAvatar.jsx` (y equivalente local).

**Convención para cada skin nueva**:
- Draco-compressed (mismo pipeline que alon)
- Misma altura/escala que `alonskin-v1` (ajustar solo si el personaje es notablemente alto/bajo)
- Mismas propiedades de material que alon

**Animaciones requeridas mínimas (por ahora)**:
1. **Idle** (pose de descanso, cuando no se mueve)
2. **Walk** (caminar, al moverse)
3. *(Later)* **Run/Sprint** — al mantener SHIFT. Cada skin viene con animación de correr por default desde la tool del usuario.
4. Emotes adicionales (los que vengan)

**⚠ Workflow conocido de la tool de emotes del usuario**:
- La tool asigna nombres de animación que **NO coinciden** con el emote real (bug conocido).
- Usuario va al three.js editor online → ve el mapping real `animation_name → emote_visible` → pasa al agente los nombres correctos.
- **Siempre verificar en terminal los nombres de animaciones del GLB** antes de asignarlas en el código:
  ```bash
  node -e "const{NodeIO}=require('@gltf-transform/core');new NodeIO().read('public/<skin>.glb').then(d=>console.log(d.getRoot().listAnimations().map(a=>a.getName())))"
  ```
  O más simple con `inspect-glb.mjs` si extiende para listar animaciones.

**Plan por cada skin entregada**:
- [ ] Colocar GLB en `public/` (pattern `<skinname>-v1.glb`)
- [ ] Listar animaciones en terminal → confirmar nombres exactos (el usuario se puede equivocar, la terminal es fuente de verdad)
- [ ] Registrar skin en sistema de skins existente con:
  - `idleClip: '<nombre idle>'`
  - `walkClip: '<nombre walk>'`
  - Altura/scale copiada de alon, ajustar si skin es altísima o chiquíta
- [ ] Probar transición idle↔walk al moverse
- [ ] Sprint (SHIFT) → LATER, fase separada cuando todas las skins estén base-funcionales

**Nota ⚠ puntos en nombres** aplica igual aquí: si algún clip se llama `Emote.001` o similar, usar regex al buscar el `AnimationClip` por nombre.

### 3.1.1 Skins integradas (abril 2026)

Ubicadas en `public/alon_house/skins/` (subcarpeta, no en `public/` raíz). Todas comparten rig `char1` tiny (24 joints), mismo scale que trumpskin/elonmuskchibi (internal 1.5× en avatar × external 5.0× en `RemotePlayerAvatar`).

Componentes creados en `components/multiplayer/`: `ChillHouseAvatar.tsx`, `TobakuAvatar.tsx`, `UncAvatar.tsx`, `PinguinAvatar.tsx`. Registrados en `lib/skins/skinsConfig.ts` y ruteo en `RemotePlayerAvatar.jsx`. Idle preview en `SkinPreviewCanvas.tsx` (`IDLE_CLIPS` map).

Emote keys se envían como clip-name crudo desde `useCameraControls.ts` (`SKIN_EMOTE_CLIPS`) y el avatar las pasa por su `animationMap` (sólo mapea `Idle`/`Run`/`Sprint`). Barra visual en `components/ui/EmoteBar.tsx` + `AudioButton.tsx` (`SKIN_EMOTE_KEYS`).

**Sprint (SHIFT)**: cada avatar ya registra `Sprint → <run clip>` en su `animationMap`, pero `useCameraControls` aún NO envía `'Sprint'` al sostener SHIFT. Activar cuando el usuario lo pida: cuando `isMoving && shiftPressed`, enviar `'Sprint'` en vez de `'Run'`.

**Música**: `SKIN_AUDIO_MAP` apunta a `/alonsong.mp3` como placeholder para las 4 nuevas. Reemplazar con pistas dedicadas cuando el usuario las entregue.

**Mapeos de animaciones** (verificados con `node scripts/inspect-glb.mjs <path>`):

| Skin | Idle (descanso) | Walk (mover) | Run/Sprint (prep.) | Emotes (key 2..N) |
|------|-----------------|--------------|--------------------|-------------------|
| `chillhouse` | `Confident_Strut` | `Walking` | `Shake_It_Off_Dance` | 1.`Running`, 2.`Boom_Dance`, 3.`Breakdance_1990`, 4.`Fall1`, 5.`Idle_3`, 6.`All_Night_Dance`, 7.`Wake_Up_and_Look_Up` |
| `tobaku` | `Breakdance_1990` | `Fall1` | `Burpee_Exercise` | 1.`Hip_Hop_Dance_3`, 2.`Idle_6`, 3.`Running`, 4.`Walking`, 5.`ymca_dance` |
| `unc` | `Denim_Pop_Dance` | `FunnyDancing_01` | `Fall1` | 1.`Breakdance_1990`, 2.`Climb_Attempt_and_Fall_1`, 3.`Idle_4`, 4.`Running`, 5.`Walking` |
| `pinguin` | `Walking` | `Breakdance_1990` | `All_Night_Dance` | 1.`Fall4`, 2.`FunnyDancing_02`, 3.`Hip_Hop_Dance_2`, 4.`Idle_03`, 5.`Running` |

**⚠ Nombres bugeados por la tool** (usuario vs GLB real):
- `Shake_it_Off_Dance` → **`Shake_It_Off_Dance`** (I mayúscula)
- `Burpee_Excercise` → **`Burpee_Exercise`** (una sola c)
- `Hip_Ho_dance_3` → **`Hip_Hop_Dance_3`**
- `Climb_Attemp_and_etc` → **`Climb_Attempt_and_Fall_1`**
- `Idle_03` (pinguin) vs `Idle_3` (chillhouse) — ojo, no son el mismo nombre entre skins.

Los nombres nunca tienen relación con la animación visible (por eso HUD dice "Emote 1/2/3…" genérico).

**Keys de teclado**: expandidas `2..8` (antes `2..6`) en `useCameraControls.ts` para soportar chillhouse con 7 emotes.

---

## Log de Progreso

| Fecha | Paso | Estado | Notas |
|-------|------|--------|-------|
| 2026-04-17 | Creación plan | ✅ | Plan inicial creado |
| 2026-04-17 | FASE 1 completa | ✅ | Spawn, checkpoint, colisiones (3 meshes GLB), NPC patrol con etiqueta, textos flotantes, dancer separado |
| 2026-04-17 | Bug pass-through jardín | ✅ | Fix con `side: DoubleSide` en material de colisión |
| 2026-04-17 | Bug `Mesh_0.001 NOT FOUND` | ✅ | GLTFLoader sanitiza `.` en nombres → fallback con regex `/^Mesh_0[._]?001$/i` |
| 2026-04-17 | Airdrops instanced | ✅ | `components/HouseAirdrops.jsx` — 2 draw calls, 6 instancias (3+3) |
| 2026-04-17 | Bug airdrops tumbados | ✅ | Planes Blender tumbados → `yawOnlyQuat()` extrae solo Y-euler |
| 2026-04-17 | FASE 1 100% cerrada | ✅ | Exterior completo: spawn, checkpoint, colisiones, NPC patrol, textos, dancer, airdrops |
| 2026-04-17 | Orangie label styling | ✅ | Bajado Y=16, color naranja `#FF8C1A` |
| 2026-04-17 | Leva install + DebugCameraFar | ✅ | Panel de tuning `near/far` en tiempo real. Valor 350 validado para exterior. |
| 2026-04-17 | camera.far strategy decidido | ✅ | 350 exterior, 200 rooms. Y=500+ en Blender. Sin LOD, sin occlusion culling. |
| 2026-04-17 | 4 skins nuevas integradas | ✅ | chillhouse, tobaku, unc, pinguin con idle/walk + emotes 1..N + Sprint preparado (no activo). Preview + EmoteBar + música placeholder. |

---

## Notas Técnicas Clave

- **Script inspect-glb**: `scripts/inspect-glb.mjs` — imprime meshes con center/min/max/size. Es la fuente de verdad para posicionar todo.
- **Lectura rápida de GLB en terminal** (sin cargar en código): `node -e` inline lee JSON chunk del GLB y muestra `nodes[].name/translation/rotation/scale/mesh`. Útil para archivos-guía (planes solamente).
- **Convención**: Nombres de nodos Blender deben ser semánticos (`colision_*`, `texto_*`, `checkpoint_*`, `path_*`, `airdrop_*`).
- **No tocar lógica**: Todo el código de colisiones, checkpoints, textos, HouseDancer, OrangiePathNPC ya funciona. Solo se actualizan **constantes de posición**.
- **Orden estricto**: GLB → inspect → actualizar constante → test. No modificar varios pasos a la vez.
- **Offset Blender↔World**: `OX=190.12, OY=1.1857, OZ=-88.67`. Todo lo que lea coords Blender debe sumar este offset al montarse dentro del group con offset.
- **⚠ Puntos en nombres (`.`)**: `GLTFLoader` a veces sanitiza `.` en nombres (`Mesh_0.001` → `Mesh_0001` o mantiene el punto dependiendo de la versión). **Siempre** buscar con:
  1. `scene.getObjectByName('Mesh_0.001')` → si falla
  2. Variantes `Mesh_0_001`, `Mesh_0001`
  3. Fallback regex: `scene.traverse(o => /^Mesh_0[._]?001$/i.test(o.name))`
- **⚠ Ctrl+A Apply Transforms en Blender**: bakea rotación/escala dentro de los vértices del mesh. El nodo queda con `rotation = [0,0,0,1]` (identity) que glTF omite → en terminal aparece `r: undefined`. Es lo correcto para assets estáticos.
- **⚠ Mesh.clone(true) hereda `visible`**: si el mesh original se oculta con `visible=false` en otro componente, el clon también sale invisible. Mejor **detach (reparent)**: `src.parent.remove(src)` y reasignar a tu propio `<group>`. Patrón usado en `OrangiePathNPC`.
- **⚠ Material `side: DoubleSide` en colisiones**: Raycaster por defecto solo hit frontfaces. Si las normales apuntan inward/outward de forma inconsistente → pass-through unidireccional. Forzar DoubleSide en meshes de colisión.
- **⚠ Planes con rotación bakeada**: si el plane en Blender tiene rotation aplicada (Ctrl+A), el nodo sale sin rotation en GLB. La orientación está en la geometría. Para hacer match en three.js hay que rotar el group huésped, no el mesh.
- **⚠ Plane Blender → personaje erguido**: los planes en Blender están tumbados (su +Z local = world +Y). Si aplicas la quaternion cruda del plane a un mesh erguido, lo acuestas. Patrón: `yawOnlyQuat()` — extrae solo el componente Y del Euler `YXZ` y reconstruye quaternion. Ver `components/HouseAirdrops.jsx`.
- **InstancedMesh workflow** (patrón para clonar estaticos):
  1. `useGLTF` sobre el GLB fuente (probablemente ya cacheado).
  2. Localizar mesh fuente (con regex de dots).
  3. `src.parent.remove(src)` — detach para no renderizar el original.
  4. Extraer `src.geometry` + `src.material`.
  5. `<instancedMesh args={[geom, mat, count]} ref={ref}>`.
  6. Por cada instancia: `new Matrix4().compose(pos, quat, scale)` → `ref.current.setMatrixAt(i, m)`.
  7. `ref.current.instanceMatrix.needsUpdate = true`.
  Resultado: **1 draw call por tipo** sin importar N.
- **Performance tiers** (cuando InstancedMesh no alcanza):
  - NPCs con animación skinned distinta por instancia → `InstancedSkinnedMesh` (three-stdlib).
  - Miles de partículas con física → `GPUComputationRenderer`.
  - Variaciones de color/textura por instancia → `instanceColor` attribute o shader custom.
  - Para tu caso actual (3-10 clones estáticos) InstancedMesh básico basta sobradamente.
