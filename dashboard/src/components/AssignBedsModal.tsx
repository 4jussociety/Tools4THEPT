/**
 * 스태프 모드 전용 담당 베드 설정 모달 컴포넌트
 * 본인이 담당하는 베드를 터치하여 지정할 수 있습니다.
 */

import clsx from 'clsx';
import type { BedData } from '../types';

interface AssignBedsModalProps {
  beds: BedData[];
  myBeds: string[];
  setMyBeds: React.Dispatch<React.SetStateAction<string[]>>;
  onClose: () => void;
  onComplete: () => void;
}

export function AssignBedsModal({ beds, myBeds, setMyBeds, onClose, onComplete }: AssignBedsModalProps) {
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 flex flex-col gap-6 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex flex-col gap-1 text-center">
          <h3 className="text-xl font-black text-slate-800">내 담당 베드 설정</h3>
          <p className="text-xs text-slate-500 font-medium">본인이 담당하는 베드를 터치하여 지정하세요.</p>
        </div>

        <div className="grid grid-cols-3 gap-2.5 my-2 max-h-[240px] overflow-y-auto pr-1 custom-scrollbar">
          {beds
            .sort((a, b) => {
              const numA = parseInt(a.bed_number, 10);
              const numB = parseInt(b.bed_number, 10);
              if (isNaN(numA) || isNaN(numB)) return a.bed_number.localeCompare(b.bed_number);
              return numA - numB;
            })
            .map(bed => {
              const isAssigned = myBeds.includes(bed.id);
              return (
                <button
                  key={bed.id}
                  onClick={() => {
                    if (isAssigned) {
                      setMyBeds(prev => prev.filter(id => id !== bed.id));
                    } else {
                      setMyBeds(prev => [...prev, bed.id]);
                    }
                  }}
                  className={clsx(
                    "p-3 rounded-2xl font-black text-sm transition-all border-2 active:scale-95 flex flex-col items-center justify-center gap-1 shadow-sm",
                    isAssigned
                      ? "bg-emerald-50 border-emerald-500 text-emerald-700"
                      : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100 hover:border-slate-300"
                  )}
                >
                  <span className="text-[10px] uppercase font-bold text-slate-400">BED</span>
                  <span className="text-lg">{bed.bed_number}</span>
                </button>
              );
            })}
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => {
              setMyBeds([]);
              onClose();
            }}
            className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-2xl transition-colors text-sm"
          >
            전체 초기화
          </button>
          <button
            onClick={onComplete}
            className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl shadow-md transition-colors text-sm"
          >
            설정 완료
          </button>
        </div>
      </div>
    </div>
  );
}
