# GLB Compression (meshopt + KTX2/UASTC) + Loading Screen Gate

Plan enfocado en **reducir lag de GPU** al cargar el `alon_house` y todas las skins activas, y en **ocultar esa carga pesada detrás del Loading Screen + Lobby** (el resto sigue bajando mientras el usuario escribe su username).

> **Regla de oro**: convertimos solo lo pesado/sensible. Todo lo demás queda como está (no vale la pena inflar el bundle).

---

## 1. Qué es lo que vamos a hacer

### 1.1 Compresión de geometría: `meshopt`
- Cuantiza vertices (posiciones, UVs, normales, skin weights) → GLB sale 60–80% más chico.
- Decoder ya está en `hooks/useOptimizedGLTF.js` (`MeshoptDecoder`). **Hay que replicarlo en `useGLTFKtx2`** porque hoy solo setea el KTX2Loader.

### 1.2 Compresión de texturas: `KTX2` (UASTC mode)
KTX2 tiene dos modos posibles al encodear con `gltfpack`:

| Modo | Flag | Calidad | Tamaño | Uso aquí |
|------|------|---------|--------|----------|
| **ETC1S** (default) | `-tc` | **Mala** — distorsiona mucho las texturas de personajes y caras | Muy chico | ❌ NO — es la que al usuario nunca le funcionó |
| **UASTC** | `-tc -tu` | **Alta** — sin distorsión visible | Más grande que ETC1S (a veces más grande que PNG original) | ✅ SÍ — esta es la que usamos |

UASTC sube a VRAM directo, sin descompresión en CPU. Aunque el archivo pesa más, **el GPU carga instantáneo** (el cuello de botella al entrar).

### 1.3 Por qué no a todo
UASTC **infla** algunos GLB (sobre todo si tenían texturas chicas). Solo vale la pena en:
- **Escenas grandes con muchas texturas** (alon_house scene).
- **Skins** — son los que siempre están en pantalla y se notan cuando staggerean.

Todo lo demás (props chicos, audio, checkpoint meshes, colliders invisibles) → queda GLB normal.

---

## 2. Archivos target (y solo estos)

| Archivo actual | Sale como | Razón |
|----------------|-----------|-------|
| `public/alon_house/house_scene-v1.glb` | `house_scene-v1_ktx2.glb` | Escena pesada, lo más grande del proyecto |
| `public/alonskin-v1.glb` | `alonskin-v1_ktx2.glb` | Skin default |
| `public/elonmuskchibi-v1.glb` | `elonmuskchibi-v1_ktx2.glb` | Skin activa |
| `public/trumpskin-v1.glb` | `trumpskin-v1_ktx2.glb` | Skin activa |
| `public/alon_house/skins/chillhouse-v1.glb` | `chillhouse-v1_ktx2.glb` | Skin nueva |
| `public/alon_house/skins/tobaku-v1.glb` | `tobaku-v1_ktx2.glb` | Skin nueva |
| `public/alon_house/skins/unc-v1.glb` | `unc-v1_ktx2.glb` | Skin nueva |
| `public/alon_house/skins/pinguin-v1.glb` | `pinguin-v1_ktx2.glb` | Skin nueva |

**NO tocar**: `house_scene-v1.glb` original (lo dejamos por si hay que rollback), `checkpoint_entry_house.glb`, `collision house externo.glb`, `airdrop_paths.glb`, `orangie_paths.glb`, `ai16z-v1.glb` (disabled), resto.

---

## 3. CLI: `gltfpack` con UASTC

### Install (una sola vez)
```powershell
npm i -D gltfpack
```

`gltfpack` es el CLI oficial de meshoptimizer. Ya trae encoder KTX2 adentro (no hace falta instalar `basisu` ni `toktx` aparte).

### Comando base
```powershell
npx gltfpack -i <input.glb> -o <output_ktx2.glb> -cc -tc -tu
```

Flags:
- `-cc` → meshopt compression (geometría). El decoder ya lo tenemos.
- `-tc` → convierte texturas a KTX2.
- `-tu` → **fuerza UASTC** (la buena, sin distorsión). ← **clave, no olvidar**.

### Comandos exactos para este proyecto
```powershell
# Alon House
npx gltfpack -i public/alon_house/house_scene-v1.glb -o public/alon_house/house_scene-v1_ktx2.glb -cc -tc -tu

# Skins raíz
npx gltfpack -i public/alonskin-v1.glb        -o public/alonskin-v1_ktx2.glb        -cc -tc -tu
npx gltfpack -i public/elonmuskchibi-v1.glb   -o public/elonmuskchibi-v1_ktx2.glb   -cc -tc -tu
npx gltfpack -i public/trumpskin-v1.glb       -o public/trumpskin-v1_ktx2.glb       -cc -tc -tu

# Skins nuevas
npx gltfpack -i public/alon_house/skins/chillhouse-v1.glb -o public/alon_house/skins/chillhouse-v1_ktx2.glb -cc -tc -tu
npx gltfpack -i public/alon_house/skins/tobaku-v1.glb     -o public/alon_house/skins/tobaku-v1_ktx2.glb     -cc -tc -tu
npx gltfpack -i public/alon_house/skins/unc-v1.glb        -o public/alon_house/skins/unc-v1_ktx2.glb        -cc -tc -tu
npx gltfpack -i public/alon_house/skins/pinguin-v1.glb    -o public/alon_house/skins/pinguin-v1_ktx2.glb    -cc -tc -tu
```

### Verificación post-conversión
```powershell
node scripts/inspect-glb.mjs public/alon_house/house_scene-v1_ktx2.glb
```
La lista de nodos/animaciones/meshes debe ser **idéntica** al original. Si falta algo, abortar y reintentar sin `-cc` (a veces quantiza animaciones raras).

---

## 4. Cambios de código necesarios

### 4.1 `useGLTFKtx2.ts` — añadir MeshoptDecoder
Hoy solo setea KTX2Loader. Con `-cc` el GLB también trae geometría meshopt, así que hay que setear el decoder o revienta al cargar.

```ts
// hooks/useGLTFKtx2.ts
import { useGLTF } from '@react-three/drei'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { useKtx2Loader } from './useKtx2Loader'

export function useGLTFKtx2(path: string) {
  const ktx2Loader = useKtx2Loader(true)
  return useGLTF(path, undefined, undefined, (loader) => {
    if (ktx2Loader) loader.setKTX2Loader(ktx2Loader)
    loader.setMeshoptDecoder(MeshoptDecoder)
  })
}
```

### 4.2 Actualizar paths de assets convertidos
- `components/HouseScene.jsx` → `/alon_house/house_scene-v1_ktx2.glb` + usar `useGLTFKtx2`.
- Cada avatar (`AlonAvatar.tsx`, `ElonMuskChibiAvatar.tsx`, `TrumpSkinAvatar.tsx`, `ChillHouseAvatar.tsx`, `TobakuAvatar.tsx`, `UncAvatar.tsx`, `PinguinAvatar.tsx`) → apuntar al `_ktx2.glb` y usar `useGLTFKtx2` en vez de `useGLTF`.
- `lib/skins/skinsConfig.ts` → actualizar `modelUrl` de cada skin al `_ktx2.glb`.
- `SkinPreviewCanvas.tsx` ya usa `useGLTFKtx2` si el path contiene `_ktx2` o termina en `.glb` (rama ya contempla ambos).

### 4.3 Preload
Cada avatar hace `useGLTF.preload('/ruta.glb')`. Cambiar al `_ktx2.glb`. Si preload no setea KTX2Loader/MeshoptDecoder, igual funciona porque el fetch ya queda cacheado; el parseo real lo hace el `useGLTFKtx2` del componente.

---

## 5. Loading Screen — gate al 65% sobre alon_house

### Estado actual
- `components/LoadingScreen/LoadingScreen.jsx` ya implementa el patrón completo del skill (`sceneProgress`, `isSceneLoaded`, `onIntroStart`, `onComplete`, pausa en 50%, fallback 8s).
- `components/Canvas3D.tsx` monta `<LoadingScreen />` **sin pasarle props** → la pantalla avanza sola sin sincronizarse con la carga real. Hay que conectarla.
- `components/three/Scene3D.js` ya tiene `ProgressReporter` con threshold 75%.

### Cambios
1. **Bajar threshold a 65%** en `ProgressReporter` (user request explícito). Esto hace que `onLoaded` dispare antes → loading screen cierra antes mientras el resto baja en background.
2. **Cablear props** de `LoadingScreen` en `Canvas3D.tsx`:
   - `sceneProgress` ← viene de `useProgress().progress`.
   - `isSceneLoaded` ← true cuando progress ≥ 65.
   - `onIntroStart` → marca flag para warmup de GPU (opcional fase 2).
   - `onComplete` → `setDismissed(true)`.
3. **Gate pesado sobre alon_house**: `useGLTFKtx2('/alon_house/house_scene-v1_ktx2.glb')` es el asset dominante. `useProgress` ya suma el progreso de todos los loaders activos — como alon_house pesa más que el resto, domina la barra. No hay que hacer nada especial; solo asegurarse de que `HouseScene` esté dentro del `<Suspense>` del Canvas para que `useProgress` lo vea.
4. **Skins no bloquean el loading**: los avatares se cargan al renderizarse el jugador (post-lobby). Como `useProgress` tracca TODOS los fetches activos, y el loading cierra al 65%, las skins siguen bajando mientras el usuario escribe username. ✅

### Snippet final en `Canvas3D.tsx`
```tsx
const { progress } = useProgress()
const [dismissed, setDismissed] = useState(false)
const isSceneLoaded = progress >= 65

return (
  <>
    {!dismissed && (
      <LoadingScreen
        sceneProgress={progress}
        isSceneLoaded={isSceneLoaded}
        onComplete={() => setDismissed(true)}
        onIntroStart={() => {/* opcional: warmupGpu flag */}}
      />
    )}
    <Canvas>...</Canvas>
  </>
)
```

---

## 6. Orden de ejecución

1. ✅ Crear este .md (done).
2. ⏳ Instalar `gltfpack` (`npm i -D gltfpack`).
3. ⏳ Correr los 8 comandos de conversión de la sección 3.
4. ⏳ Verificar con `inspect-glb` que animations/nodes sigan intactos.
5. ⏳ Update `useGLTFKtx2.ts` (añadir MeshoptDecoder).
6. ⏳ Update paths en avatars + skinsConfig + HouseScene.
7. ⏳ Update threshold a 65% en `ProgressReporter` + cablear props en `Canvas3D.tsx`.
8. ⏳ Test en local (`npm run dev`).
9. ⏳ Medir: tamaño antes/después, FPS primer render, tiempo del loading screen.

---

## 7. Troubleshooting esperado

- **Animaciones se rompen tras `-cc`**: re-convertir sin `-cc` (solo `-tc -tu`). Pierdes reducción de geometría pero mantenés texturas UASTC.
- **Skin sale rosa/morada**: el material no encuentra la textura KTX2 (falta transcoder). Check que `public/ktx2/` tenga los archivos `basis_transcoder.js` + `.wasm`. Path en `useKtx2Loader.ts` apunta a `/ktx2/`.
- **Texturas invertidas**: añadir `texture.flipY = false` sobre texturas KTX2 (solo si se ven dadas vuelta).
- **Loading screen queda infinito**: `ProgressReporter` no está dentro del `<Canvas>`. Mover el componente al árbol de R3F.
- **Firefox se congela**: el Basis WASM transcoder bloquea el main thread (bug conocido que motivó `useOptimizedGLTF.js`). Si vuelve a pasar, cargar transcoder con `ktx2Loader.setWorkerLimit(2)` y verificar que esté en un worker.

---

## 8. Métricas a anotar tras la conversión

| Archivo | Antes (MB) | Después (MB) | Δ |
|---------|-----------|--------------|---|
| house_scene-v1 |  |  |  |
| alonskin-v1 |  |  |  |
| elonmuskchibi-v1 |  |  |  |
| trumpskin-v1 |  |  |  |
| chillhouse-v1 |  |  |  |
| tobaku-v1 |  |  |  |
| unc-v1 |  |  |  |
| pinguin-v1 |  |  |  |

Si el total sube más de 2× → considerar convertir solo el `house_scene` y dejar las skins en GLB normal.
