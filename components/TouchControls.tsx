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
        // Bottom-right corner as user requested. The `.hud-panel` function
        // icons no longer sit at bottom:8 on mobile — they moved up to
        // bottom:270 (CSS), so WASD can sit flush to the bottom again.
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

      {/* CHAT button — mobile has no Enter key, so we expose a dedicated tap
          that dispatches the `openChat` custom event listened to by ChatInput. */}
      <div style={{ marginTop: 6 }}>
        <button
          tabIndex={-1}
          onMouseDown={preventFocus}
          onPointerDown={preventFocus}
          onClick={() => window.dispatchEvent(new CustomEvent('openChat'))}
          style={{
            ...btnBase,
            width: 56,
            height: 44,
            fontSize: 20,
            background: '#10b98199',
            borderColor: '#10b981',
          }}
          aria-label="Open chat"
          title="Open chat"
        >💬</button>
      </div>
    </div>
  );
};

export default TouchControls;
