import React from 'react';

interface ThePtLogoProps {
  prefix?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function ThePtLogo({ prefix, className, style }: ThePtLogoProps) {
  return (
    <div 
      className={`flex items-baseline italic tracking-tighter ${className || ''}`}
      style={style}
    >
      {prefix && (
        <>
          <span className="font-black text-slate-800 leading-none mr-[2px]" style={{ fontSize: '1.2em' }}>{prefix}</span>
          <span className="font-bold text-slate-400 mr-[2px]" style={{ fontSize: '0.45em' }}>for</span>
        </>
      )}
      <span
        className="text-slate-900"
        style={{
          fontSize: '1.0em',
          fontFamily: "'Glacial Indifference', -apple-system, sans-serif",
          fontWeight: 'bold',
          lineHeight: 1,
          display: 'inline-block',
          position: 'relative',
        }}
      >
        THEPT
      </span>
    </div>
  );
}
