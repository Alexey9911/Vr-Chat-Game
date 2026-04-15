import React, { useState } from 'react';

const btnBase: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 60,
  height: 60,
  borderRadius: '50%',
  backgroundColor: 'rgba(255,255,255,0.1)',
  border: '2px solid rgba(255,255,255,0.3)',
  cursor: 'pointer',
  overflow: 'hidden',
  transition: 'transform 0.25s ease, background-color 0.25s ease',
  textDecoration: 'none',
  flexShrink: 0,
};

const btnHover: React.CSSProperties = {
  transform: 'scale(1.18)',
  backgroundColor: 'rgba(255,255,255,0.22)',
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
          width: noBorder ? 52 : 44, 
          height: noBorder ? 52 : 44, 
          objectFit: 'contain',
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
      <IconLink href="#" src="/icons/pumpfun.png" alt="Pump Fun" />
      <IconLink href="https://x.com/HatoETH" src="/icons/twitter.png" alt="Twitter" />
    </nav>
  );
};

export default Navbar;
