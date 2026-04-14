import { editable as e } from '@theatre/r3f';

/**
 * Wrapper component para registrar cualquier objeto en Theatre.js
 * 
 * Uso:
 * <TheatreObject uniqueKey="MyObject" position={[0,0,0]}>
 *   <mesh>
 *     <boxGeometry />
 *     <meshStandardMaterial />
 *   </mesh>
 * </TheatreObject>
 */
export default function TheatreObject({ 
  uniqueKey, 
  children,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = [1, 1, 1],
  visible = true,
  ...props 
}) {
  const EditableGroup = e.group;

  return (
    <EditableGroup
      theatreKey={uniqueKey}
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
