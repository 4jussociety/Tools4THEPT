// 벽면, 소파, 데스크 등 다양한 가구 타입에 맞춰 프리미엄 시각 디자인을 렌더링하는 컴포넌트입니다.
// 일반 모드에서는 클릭 이벤트를 차단하여 이송에 간섭하지 않도록 설계되었습니다.
import clsx from 'clsx';
import type { LayoutObject } from '../types';

interface LayoutObjectCardProps {
  object: LayoutObject;
  isEditMode?: boolean;
  isViewerMode?: boolean;
}

export function LayoutObjectCard({ object, isEditMode }: LayoutObjectCardProps) {
  // 가구 타입별 프리미엄 스타일 매핑
  const typeStyles = {
    WALL: "bg-slate-400 border-slate-500 rounded shadow-sm",
    PILLAR: "bg-slate-400 border-slate-500 rounded-md shadow-inner",
    DESK: "bg-amber-100/80 border-amber-200 rounded-2xl shadow-sm backdrop-blur-sm",
    SOFA: "bg-sky-50 border-sky-200 rounded-3xl shadow-sm",
    DOOR: "bg-white/40 border-t-[4px] border-l-[4px] border-slate-400 border-dashed rounded-tl-full backdrop-blur-sm"
  };

  const styleClass = typeStyles[object.object_type] || typeStyles.WALL;

  return (
    <div 
      className={clsx(
        "w-full h-full border overflow-hidden flex items-center justify-center transition-opacity relative",
        styleClass,
        !isEditMode && "pointer-events-none" // 일반 모드일 때는 클릭/드래그 차단 (비활성 레이어화)
      )}
    >
      {/* 라벨 텍스트가 있을 경우 가운데 출력 (편집 모드이거나 라벨이 있을 때) */}
      {(object.name || (object.object_type !== 'WALL' && object.object_type !== 'DOOR')) && (
        <span className={clsx(
          "font-bold text-center px-2 select-none",
          object.object_type === 'PILLAR' && "text-slate-100 text-sm opacity-60",
          object.object_type === 'DESK' && "text-amber-800 text-lg",
          object.object_type === 'SOFA' && "text-sky-700 text-base",
          object.object_type === 'WALL' && "text-slate-600 text-xs",
          object.object_type === 'DOOR' && "text-slate-500 text-sm absolute bottom-2 right-2"
        )}>
          {object.name || object.object_type}
        </span>
      )}
    </div>
  );
}
