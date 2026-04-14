import { editable as e } from '@theatre/r3f';

/**
 * Wrapper universal para hacer cualquier componente editable en Theatre.js
 * 
 * Ventajas:
 * - Soporta nombres jerárquicos (ej: "Models/Car" crea carpetas)
 * - Consistencia en toda la app
 * - Fácil de extender con hooks o lógica adicional
 * 
 * Uso:
 * <Editable name="Models/Hero" position={[0,0,0]}>
 *   <MyComponent />
 * </Editable>
 */
export default function Editable({ 
  name, 
  children,
  position,
  rotation,
  scale,
  visible = true,
  ...props 
}) {
  const EditableGroup = e.group;

  return (
    <EditableGroup
      theatreKey={name}
      position={position}
      rotation={rotation}
      scale={scale}
      visible={visible}
      {...props}
    >
      {children}
    </EditableGroup>
  );
}

/**
 * Variante para meshes individuales (si necesitas ref directa)
 */
export function EditableMesh({ 
  name, 
  children,
  ...props 
}) {
  const EditableMeshComponent = e.mesh;

  return (
    <EditableMeshComponent
      theatreKey={name}
      {...props}
    >
      {children}
    </EditableMeshComponent>
  );
}
