# Sistema de Checkpoints — GTA SA Style

## Componentes Creados

### 1. `ZoneStore` (`lib/zoneStore.ts`)
- Estado global para zona actual: `'exterior' | 'interior' | 'balcon'`
- Maneja flag `isTransitioning` para prevenir múltiples teleports

### 2. `FadeOverlay` (`components/checkpoints/FadeOverlay.tsx`)
- Overlay negro con fade in/out
- Trigger callback cuando fade completa (momento de teleport)

### 3. `Checkpoint` (`components/checkpoints/Checkpoint.tsx`)
- Detecta proximidad del jugador cada frame
- Activa fade → teleport → zona change
- Acepta GLB custom o usa marker visual default (triángulo amarillo)

### 4. `CameraDebugHUD` (`components/CameraDebugHUD.tsx`)
- Toggle con **F8**
- Sliders para ajustar `camera.far` y `camera.near` en tiempo real
- Botones presets: Exterior (500) / Interior (100)

### 5. `teleportController` (`lib/teleportController.ts`)
- Sistema global de teleport
- Registrado en `useCameraControls.ts`
- Permite a checkpoints mover al jugador sin acoplar componentes

## Uso Básico

### Paso 1: Agregar FadeOverlay al root
```tsx
// pages/index.tsx o Canvas3D.tsx
import FadeOverlay from '../components/checkpoints/FadeOverlay'
import { useZoneStore } from '../lib/zoneStore'

function YourComponent() {
  const isTransitioning = useZoneStore(s => s.isTransitioning)
  
  return (
    <>
      {/* Tu contenido existente */}
      <FadeOverlay isActive={isTransitioning} />
    </>
  )
}
```

### Paso 2: Agregar Checkpoint en Scene3D
```tsx
// components/Scene3D.jsx
import Checkpoint from './checkpoints/Checkpoint'
import { teleportPlayer } from '../lib/teleportController'

// Dentro del componente Scene3D:
<Checkpoint
  position={[-50, 0, -80]} // Posición del checkpoint (puerta)
  targetPosition={[-50, 500, -80]} // Destino (interior arriba)
  targetRotation={Math.PI} // Rotación al llegar (radianes)
  triggerDistance={3} // Radio de activación
  targetZone="interior"
  onTeleport={teleportPlayer}
/>
```

### Paso 3: Usar GLB Custom (Opcional)
```tsx
<Checkpoint
  position={[-50, 0, -80]}
  targetPosition={[-50, 500, -80]}
  targetRotation={0}
  glbPath="/checkpoints/door_marker.glb" // Tu GLB custom
  triggerDistance={4}
  targetZone="interior"
  onTeleport={teleportPlayer}
/>
```

## Próximos Pasos

1. **Crear GLB de marker** en Blender:
   - Triángulo amarillo animado
   - Exportar con posición exacta donde quieres el checkpoint
   - Guardar en `/public/checkpoints/`

2. **Añadir interior rooms**:
   - Importar GLB en Y ~500+ (muy arriba)
   - Añadir collision meshes invisibles
   - Crear checkpoint de salida (interior → exterior)

3. **Optimizar camera.far**:
   - Usar `CameraDebugHUD` (F8) para encontrar valor óptimo
   - Implementar cambio dinámico basado en `currentZone`:
     ```tsx
     const currentZone = useZoneStore(s => s.currentZone)
     useEffect(() => {
       camera.far = currentZone === 'exterior' ? 500 : 100
       camera.updateProjectionMatrix()
     }, [currentZone, camera])
     ```

4. **Escaleras**:
   - Crear planos inclinados invisibles en Blender
   - Importar como collision mesh
   - Añadir a sistema de colisiones existente

## Debugging

- **F8**: Toggle CameraDebugHUD (ajustar far/near)
- **PositionDebug**: Muestra coordenadas actuales (ya existe)
- **Console logs**: Checkpoint muestra warnings si teleport no está listo

## Arquitectura

```
┌─────────────────┐
│  Checkpoint     │ ← Detecta proximidad
└────────┬────────┘
         ↓
┌─────────────────┐
│  ZoneStore      │ ← setTransitioning(true)
└────────┬────────┘
         ↓
┌─────────────────┐
│  FadeOverlay    │ ← Fade a negro
└────────┬────────┘
         ↓ (onFadeComplete after 500ms)
┌─────────────────┐
│ teleportPlayer  │ ← Mueve jugador
└────────┬────────┘
         ↓
┌─────────────────┐
│ setZone(new)    │ ← Actualiza zona
└────────┬────────┘
         ↓ (after 600ms total)
┌─────────────────┐
│setTransitioning │ ← false (permite siguiente teleport)
└─────────────────┘
```
