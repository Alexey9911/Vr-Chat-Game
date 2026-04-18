import React from "react";
import { useKeyboardStore } from "../lib/useKeyboardStore";

const TouchControls: React.FC = () => {
  const { addPressedKey, removePressedKey, isKeyPressed } = useKeyboardStore();

  const handleTouchStart = (key: string) => (e: React.TouchEvent) => {
    e.preventDefault();
    addPressedKey(key);
  };
  const handleTouchEnd = (key: string) => (e: React.TouchEvent) => {
    e.preventDefault();
    removePressedKey(key);
  };
  // Stop the button from taking keyboard focus on mouse/touch down — focus
  // gain would fire `focusin` on <button> which is still handled in
  // useCameraControls (although now narrowed to inputs only, this keeps the
  // HUD visually consistent and avoids any lingering blue focus ring).
  const preventFocus = (e: React.MouseEvent | React.PointerEvent) => {
    e.preventDefault();
  };
  const btnBase: React.CSSProperties = {
    fontSize: 26,
    width: 56,
    height: 56,
    borderRadius: 12,
    border: '2px solid #fff',
    background: '#222a',
    color: '#fff',
    touchAction: 'none',
    WebkitUserSelect: 'none',
    userSelect: 'none',
  };

  return (
    <div
      style={{
        position: 'fixed',
        right: 12,
        bottom: 16,
        zIndex: 2000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px',
        userSelect: 'none',
        pointerEvents: 'auto',
      }}
      className="touch-controls-ui"
    >
      <div>
        <button
          tabIndex={-1}
          onMouseDown={preventFocus}
          onPointerDown={preventFocus}
          style={{ ...btnBase, opacity: isKeyPressed("w") ? 1 : 0.7 }}
          onTouchStart={handleTouchStart("w")}
          onTouchEnd={handleTouchEnd("w")}
          onTouchCancel={handleTouchEnd("w")}
        >↑</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'row', gap: 20 }}>
        <button
          tabIndex={-1}
          onMouseDown={preventFocus}
          onPointerDown={preventFocus}
          style={{ ...btnBase, opacity: isKeyPressed("a") ? 1 : 0.7 }}
          onTouchStart={handleTouchStart("a")}
          onTouchEnd={handleTouchEnd("a")}
          onTouchCancel={handleTouchEnd("a")}
        >←</button>
        <button
          tabIndex={-1}
          onMouseDown={preventFocus}
          onPointerDown={preventFocus}
          style={{ ...btnBase, opacity: isKeyPressed("d") ? 1 : 0.7 }}
          onTouchStart={handleTouchStart("d")}
          onTouchEnd={handleTouchEnd("d")}
          onTouchCancel={handleTouchEnd("d")}
        >→</button>
      </div>
      <div>
        <button
          tabIndex={-1}
          onMouseDown={preventFocus}
          onPointerDown={preventFocus}
          style={{ ...btnBase, opacity: isKeyPressed("s") ? 1 : 0.7 }}
          onTouchStart={handleTouchStart("s")}
          onTouchEnd={handleTouchEnd("s")}
          onTouchCancel={handleTouchEnd("s")}
        >↓</button>
      </div>
    </div>
  );
};

export default TouchControls;
