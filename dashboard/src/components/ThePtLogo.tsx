import React from 'react';

interface ThePtLogoProps {
  className?: string;
  style?: React.CSSProperties;
}

export function ThePtLogo({ className, style }: ThePtLogoProps) {
  return (
    <span
      className={`text-[2.0em] md:text-[2.8em] ${className || ''}`}
      style={{
        fontFamily: "'Glacial Indifference', -apple-system, sans-serif",
        fontWeight: 'bold',
        fontStyle: 'italic',
        letterSpacing: '0px',
        lineHeight: 1,
        display: 'inline-block',
        position: 'relative',
        top: '-0.09em',
        ...style
      }}
    >
      THEPT
    </span>
  );
}
