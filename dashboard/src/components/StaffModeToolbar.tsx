/**
 * 스태프 모드 전용 상단 툴바 컴포넌트
 * 담당 구역 표시 및 전체/내 담당 필터 토글 기능을 제공합니다.
 */

import clsx from 'clsx';
import type { BedData } from '../types';

interface StaffModeToolbarProps {
  beds: BedData[];
  myBeds: string[];
  isFilterMyBeds: boolean;
  setIsFilterMyBeds: React.Dispatch<React.SetStateAction<boolean>>;
  onOpenAssignModal: () => void;
}

export function StaffModeToolbar({ beds, myBeds, isFilterMyBeds, setIsFilterMyBeds, onOpenAssignModal }: StaffModeToolbarProps) {
  return (
    <div className="mb-3 md:mb-4 flex items-center justify-between bg-white p-2.5 px-3 md:p-3 md:px-5 rounded-xl md:rounded-2xl border border-slate-200 shadow-sm gap-4">
      <div className="flex flex-wrap items-center gap-2 md:gap-3">
        <div className="flex items-center gap-1.5 md:gap-2">
          <div className="w-2 h-2 md:w-2.5 md:h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
          <span className="text-xs md:text-sm font-black text-slate-700">
            내 담당: {myBeds.length > 0 ? `${myBeds.map(id => beds.find(b => b.id === id)?.bed_number).filter(Boolean).join(', ')}` : '없음'}
          </span>
        </div>
        <button
          onClick={onOpenAssignModal}
          className="px-2 py-0.5 md:px-2.5 md:py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-[10px] md:text-[11px] font-black text-slate-600 transition-all active:scale-95 border border-slate-200 w-max"
        >
          ⚙️ 베드 변경
        </button>
      </div>
      <div className="flex items-center">
        <div className="flex bg-slate-100 p-0.5 rounded-lg md:rounded-xl border border-slate-200/50 shadow-inner flex-shrink-0">
          <button
            onClick={() => setIsFilterMyBeds(false)}
            className={clsx(
              "px-2.5 py-1 md:px-3 md:py-1.5 rounded-md md:rounded-lg text-[10px] md:text-xs font-black transition-all whitespace-nowrap active:scale-95",
              !isFilterMyBeds
                ? "bg-white text-slate-800 shadow-sm border border-slate-200/20"
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            전체 베드
          </button>
          <button
            onClick={() => setIsFilterMyBeds(true)}
            className={clsx(
              "px-2.5 py-1 md:px-3 md:py-1.5 rounded-md md:rounded-lg text-[10px] md:text-xs font-black transition-all whitespace-nowrap active:scale-95 flex items-center gap-1",
              isFilterMyBeds
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            🌟 내 담당
          </button>
        </div>
      </div>
    </div>
  );
}
