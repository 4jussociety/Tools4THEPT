/**
 * 배율 조절 플로팅 컨트롤러 컴포넌트
 * 줌 인/아웃, 100% 복구, 화면 자동 맞춤 기능을 제공합니다.
 */

import { ZoomIn, ZoomOut, Maximize, Shrink } from 'lucide-react';

interface ZoomControlsProps {
  zoom: number;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
  onAutoFit: () => void;
}

export function ZoomControls({ zoom, setZoom, onAutoFit }: ZoomControlsProps) {
  return (
    <div className="absolute top-3 left-3 z-30 flex items-center gap-1 bg-white/90 backdrop-blur-md p-1 rounded-xl shadow-2xl border border-slate-200 ring-1 ring-black/5">
      <button
        onClick={() => setZoom(prev => Math.max(0.1, prev - 0.1))}
        className="p-1 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors"
        title="축소"
      >
        <ZoomOut size={16} />
      </button>
      <div className="px-1 min-w-[44px] text-center font-black text-slate-700 text-xs">
        {Math.round(zoom * 100)}%
      </div>
      <button
        onClick={() => setZoom(prev => Math.min(2, prev + 0.1))}
        className="p-1 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors"
        title="확대"
      >
        <ZoomIn size={16} />
      </button>
      <div className="w-px h-3 bg-slate-200 mx-0.5"></div>
      <button
        onClick={() => setZoom(1)}
        className="p-1 hover:bg-slate-100 rounded-lg text-blue-600 transition-colors"
        title="100% 복구"
      >
        <Maximize size={16} />
      </button>
      <div className="w-px h-3 bg-slate-200 mx-0.5"></div>
      <button
        onClick={onAutoFit}
        className="p-1 hover:bg-slate-100 rounded-lg text-green-600 transition-colors"
        title="화면 크기에 자동 맞춤"
      >
        <Shrink size={16} />
      </button>
    </div>
  );
}
