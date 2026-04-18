import React, { useState } from 'react';

const btnBase: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 72,
  height: 56,
  backgroundColor: 'rgba(255, 255, 255, 0.85)',
  border: '1px solid rgba(255, 255, 255, 0.5)',
  borderLeft: '5px solid #10b981',
  transform: 'skewX(-12deg)',
  cursor: 'pointer',
  overflow: 'hidden',
  transition: 'transform 0.25s ease, background-color 0.25s ease, box-shadow 0.25s ease',
  textDecoration: 'none',
  flexShrink: 0,
  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
};

const btnHover: React.CSSProperties = {
  transform: 'scale(1.1) skewX(-12deg)',
  backgroundColor: 'rgba(255, 255, 255, 1)',
  border: '1px solid #10b981',
  boxShadow: '0 6px 16px rgba(16, 185, 129, 0.35)',
};

function IconLink({ href, src, alt, noBorder }: { href: string; src: string; alt: string; noBorder?: boolean }) {
  const [hovered, setHovered] = useState(false);
  
  const baseStyle = noBorder ? {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 60,
    height: 60,
    cursor: 'pointer',
    transition: 'transform 0.25s ease',
    textDecoration: 'none',
    flexShrink: 0,
  } : btnBase;
  
  const hoverStyle = noBorder ? {
    transform: 'scale(1.18)',
  } : btnHover;
  
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{ ...(hovered ? { ...baseStyle, ...hoverStyle } : baseStyle) }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img 
        src={src} 
        alt={alt} 
        style={{ 
          width: noBorder ? 56 : 50, 
          height: noBorder ? 56 : 50, 
          objectFit: 'contain',
          transform: noBorder ? 'none' : 'skewX(12deg)',
          ...(noBorder && {
            border: '0.5px solid rgba(255,255,255,0.3)',
            borderRadius: '8px',
          })
        }} 
      />
    </a>
  );
}

const Navbar: React.FC = () => {
  return (
    <nav
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1100,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 16,
        padding: '12px 24px',
        pointerEvents: 'auto',
      }}
    >
      <IconLink href="https://pump.fun" src="/icons/pumpfun.png" alt="Pump Fun" />
      <IconLink href="https://x.com" src="/icons/twitter.png" alt="Twitter" />
    </nav>
  );
};

export default Navbar;
