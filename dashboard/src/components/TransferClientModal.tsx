/**
 * 모바일 롱프레스 고객 이송 모달 컴포넌트
 * 고객을 다른 빈 베드로 이송하기 위한 터치 기반 모달 인터페이스입니다.
 */

import type { BedData } from '../types';

interface TransferClientModalProps {
  beds: BedData[];
  sourceBedId: string;
  onTransfer: (sourceId: string, targetId: string) => void;
  onClose: () => void;
  isViewerMode?: boolean;
}

export function TransferClientModal({ beds, sourceBedId, onTransfer, onClose, isViewerMode }: TransferClientModalProps) {
  const sourceBed = beds.find(b => b.id === sourceBedId);
  if (!sourceBed) return null;

  const emptyBeds = beds
    .filter(b => b.status === 'EMPTY' && b.id !== sourceBedId)
    .sort((a, b) => {
      const numA = parseInt(a.bed_number, 10);
      const numB = parseInt(b.bed_number, 10);
      if (isNaN(numA) || isNaN(numB)) return a.bed_number.localeCompare(b.bed_number);
      return numA - numB;
    });

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 flex flex-col gap-6 animate-in slide-in-from-bottom sm:zoom-in-95 duration-200">
        <div className="flex flex-col gap-1 text-center">
          <div className="mx-auto w-12 h-1.5 bg-slate-200 rounded-full mb-2 sm:hidden"></div>
          <h3 className="text-xl font-black text-slate-800 flex items-center justify-center gap-2">
            <span>🔄 고객 다른 베드로 이송</span>
          </h3>
          <p className="text-xs text-slate-500 font-medium mt-1">
            <span className="text-blue-600 font-black">[{sourceBed.bed_number}번 베드]</span>의{" "}
            <span className="text-slate-800 font-black">{sourceBed.client_name}</span> 고객을 이송할 목적지 베드를 선택하세요.
          </p>
        </div>

        {emptyBeds.length === 0 ? (
          <div className="bg-slate-50 p-6 rounded-2xl text-center text-slate-500 font-bold border border-slate-200">
            ⚠️ 이송할 수 있는 비어있는 베드가 없습니다.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <span className="text-xs font-black text-slate-400 uppercase tracking-wider pl-1">이송 가능한 빈 베드 목록</span>
            <div className="grid grid-cols-3 gap-2.5 max-h-[220px] overflow-y-auto pr-1 custom-scrollbar">
              {emptyBeds.map(bed => (
                <button
                  key={bed.id}
                  onClick={() => {
                    if (isViewerMode) {
                      alert("뷰어 모드(읽기 전용)에서는 고객을 이송할 수 없습니다.");
                      return;
                    }
                    onTransfer(sourceBed.id, bed.id);
                  }}
                  className="p-3 bg-blue-50 border-2 border-blue-200 hover:border-blue-400 text-blue-700 rounded-2xl font-black text-sm transition-all active:scale-95 shadow-sm flex flex-col items-center justify-center gap-1"
                >
                  <span className="text-[10px] uppercase font-bold text-blue-400">BED</span>
                  <span className="text-lg">{bed.bed_number}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black rounded-2xl transition-colors text-sm"
        >
          이송 취소
        </button>
      </div>
    </div>
  );
}
