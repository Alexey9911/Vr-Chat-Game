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
          style={{ fontSize: 30, width: 60, height: 60, opacity: isKeyPressed("w") ? 1 : 0.7, borderRadius: 12, border: '2px solid #fff', background: '#222a', color: '#fff' }}
          onTouchStart={handleTouchStart("w")}
          onTouchEnd={handleTouchEnd("w")}
          onTouchCancel={handleTouchEnd("w")}
        >↑</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'row', gap: 24 }}>
        <button
          style={{ fontSize: 30, width: 60, height: 60, opacity: isKeyPressed("a") ? 1 : 0.7, borderRadius: 12, border: '2px solid #fff', background: '#222a', color: '#fff' }}
          onTouchStart={handleTouchStart("a")}
          onTouchEnd={handleTouchEnd("a")}
          onTouchCancel={handleTouchEnd("a")}
        >←</button>
        <button
          style={{ fontSize: 30, width: 60, height: 60, opacity: isKeyPressed("d") ? 1 : 0.7, borderRadius: 12, border: '2px solid #fff', background: '#222a', color: '#fff' }}
          onTouchStart={handleTouchStart("d")}
          onTouchEnd={handleTouchEnd("d")}
          onTouchCancel={handleTouchEnd("d")}
        >→</button>
      </div>
      <div>
        <button
          style={{ fontSize: 30, width: 60, height: 60, opacity: isKeyPressed("s") ? 1 : 0.7, borderRadius: 12, border: '2px solid #fff', background: '#222a', color: '#fff' }}
          onTouchStart={handleTouchStart("s")}
          onTouchEnd={handleTouchEnd("s")}
          onTouchCancel={handleTouchEnd("s")}
        >↓</button>
      </div>
    </div>
  );
};

export default TouchControls;
