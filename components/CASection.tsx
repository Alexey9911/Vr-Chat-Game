import React from "react";
import ChangeAdressConsole from "./changeAdressConsole/ChangeAdressConsole";

const CASection: React.FC = () => {
  return (
    <div className="ca-section" style={{
      position: 'fixed',
      top: '30px',
      left: '30px',
      zIndex: 1000,
      background: 'rgba(15, 15, 20, 0.55)',
      padding: '16px 20px',
      backdropFilter: 'blur(10px)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      borderLeft: '4px solid #10b981',
      clipPath: 'polygon(0 0, 100% 0, 96% 100%, 0 100%)',
      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
      fontFamily: "'Burbank Big Condensed', 'Arial Black', Impact, sans-serif"
    }}>
      <h3 className="font-bold" style={{ color: 'white', textTransform: 'uppercase', marginBottom: '8px', fontSize: '18px' }}>CA:</h3>
      <ChangeAdressConsole text={""} />
    </div>
  );
};

export default CASection;
