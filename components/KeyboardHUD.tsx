import React, { useMemo } from "react";
import { useKeyboardStore } from "../lib/useKeyboardStore";
import { useSkinStore } from "../lib/skins/skinStore";
import ChangeAdressConsole from "./changeAdressConsole/ChangeAdressConsole";

const KeyboardHUD: React.FC = () => {
  const { isKeyPressed } = useKeyboardStore();
  const activeSkinId = useSkinStore((s) => s.activeSkinId);

  const animationLabels = useMemo(() => {
    if (activeSkinId === 'elonmuskchibi') {
      return {
        anim2: 'Dance',
        anim3: 'Shuffle',
        anim4: 'Walk',
        anim5: 'Idle',
      };
    } else if (activeSkinId === 'ai16z') {
      return {
        anim2: '', // remove key 2 (walking) from HUD
        anim3: 'Hip Hop Dance',
        anim4: 'Breakdance',
        anim5: 'Dance',
      };
    } else if (activeSkinId === 'trumpskin') {
      return {
        anim2: 'Dance',
        anim3: 'Breakdance',
        anim4: 'Shuffle',
        anim5: 'Idle',
      };
    } else if (activeSkinId === 'elon') {
      return {
        anim2: 'Punch',
        anim3: 'Yes',
        anim4: 'Wave',
        anim5: 'Death',
      };
    } else {
      return {
        anim2: 'Punch',
        anim3: 'Yes',
        anim4: 'Wave',
        anim5: 'Death',
      };
    }
  }, [activeSkinId]);

  const KeyButton: React.FC<{
    keyCode: string;
    label: string;
    isEmpty?: boolean;
  }> = ({ keyCode, label, isEmpty = false }) => (
    <div
      className={`key-button ${isKeyPressed(keyCode) ? "pressed" : ""} ${
        isEmpty ? "empty" : ""
      }`}
    >
      {!isEmpty && label}
    </div>
  );

  return (
    <div className="controls-hud">
      <div className="controls-grid">
        {/* Row 1 */}
        <KeyButton keyCode="" label="" isEmpty={true} />
        <KeyButton keyCode="w" label="W" />
        <KeyButton keyCode="" label="" isEmpty={true} />

        {/* Row 2 */}
        <KeyButton keyCode="a" label="A" />
        <KeyButton keyCode="s" label="S" />
        <KeyButton keyCode="d" label="D" />
      </div>

      {/* SHIFT key (full width) — highlights yellow when held for sprint */}
      <div style={{ marginTop: 6 }}>
        <div className={`key-button key-space key-shift ${ isKeyPressed('shift') ? 'pressed' : '' }`}>
          SHIFT · Run
        </div>
      </div>

      {/* Space key (full width) */}
      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div className={`key-button key-space ${ isKeyPressed(' ') ? 'pressed' : '' }`}>
          SPACE
        </div>

        {/* Hints */}
        <div style={{ 
          marginTop: 6, 
          display: 'grid', 
          gridTemplateColumns: '1fr 1fr', 
          gap: '4px 12px', 
          fontSize: 10, 
          color: 'rgba(255,255,255,0.5)' 
        }}>
          <div>C – Skins</div>
          <div>M – Menu</div>
          <div>1 – Emote</div>
          <div>2 – Emote</div>
          <div>3 – Emote</div>
          <div>4 – Emote</div>
          <div>5 – Emote</div>
        </div>
      </div>
    </div>
  );
};

export default KeyboardHUD;
