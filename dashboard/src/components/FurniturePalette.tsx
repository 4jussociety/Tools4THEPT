// 편집 모드에서 화면 한편에 위치하여 드래그 앤 드롭 또는 클릭으로 가구를 추가하는 팔레트입니다.
// 다양한 구조물들의 썸네일 아이콘을 제공하여 직관적인 공간 설계를 돕습니다.
import { Grid2X2, DoorOpen, Presentation, Component, Square } from 'lucide-react';
import type { LayoutObjectType } from '../types';

interface FurniturePaletteProps {
  onAddObject: (type: LayoutObjectType) => void;
}

export function FurniturePalette({ onAddObject }: FurniturePaletteProps) {
  const paletteItems: { type: LayoutObjectType; label: string; icon: React.ReactNode; colorClass: string }[] = [
    { type: 'WALL', label: '벽면 구획', icon: <Grid2X2 size={20} />, colorClass: 'bg-slate-200 text-slate-700 hover:bg-slate-300' },
    { type: 'DESK', label: '안내 데스크', icon: <Presentation size={20} />, colorClass: 'bg-amber-100 text-amber-800 hover:bg-amber-200 border border-amber-200' },
    { type: 'SOFA', label: '대기 소파', icon: <Component size={20} />, colorClass: 'bg-sky-100 text-sky-800 hover:bg-sky-200 border border-sky-200' },
    { type: 'PILLAR', label: '기둥', icon: <Square size={20} className="fill-current" />, colorClass: 'bg-slate-500 text-white hover:bg-slate-600' },
    { type: 'DOOR', label: '출입구', icon: <DoorOpen size={20} />, colorClass: 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-300 dashed' },
  ];

  return (
    <div className="absolute right-4 top-20 bg-white/90 backdrop-blur-md p-3 rounded-2xl shadow-xl border border-slate-200/50 w-40 z-50 flex flex-col gap-2">
      <div className="text-xs font-black text-slate-400 mb-1 px-1 uppercase tracking-wider">가구 및 구조물</div>
      {paletteItems.map(item => (
        <button
          key={item.type}
          onClick={() => onAddObject(item.type)}
          className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl font-bold text-sm transition-all shadow-sm active:scale-95 touch-manipulation ${item.colorClass}`}
        >
          {item.icon}
          <span>{item.label}</span>
        </button>
      ))}
      <div className="text-[10px] text-slate-400 mt-2 px-1 leading-tight font-medium text-center">
        버튼을 누르면 캔버스<br/>중앙에 생성됩니다
      </div>
    </div>
  );
}
