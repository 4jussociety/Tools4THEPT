// 특정 베드에 새로운 치료 항목을 즉각적으로 추가하기 위한 간편 선택 모달 컴포넌트입니다.
// 복잡한 고객 배정 폼 없이, 치료 항목 목록만 렌더링하여 빠른 추가를 지원합니다.
import { X, CheckCircle2 } from 'lucide-react';
import type { BedData, TreatmentType } from '../types';

interface TreatmentAddModalProps {
  bed: BedData;
  availableTreatments: TreatmentType[];
  onClose: () => void;
  onAddTreatment: (treatment: TreatmentType) => void;
}

export function TreatmentAddModal({ bed, availableTreatments, onClose, onAddTreatment }: TreatmentAddModalProps) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70] p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-sm flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div>
            <h2 className="text-lg font-black text-slate-800">치료 추가</h2>
            <div className="text-xs text-slate-500 font-bold">{bed.client_name} 님 ({bed.bed_number})</div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-200 rounded-full transition-colors self-start">
            <X size={20} className="text-slate-500" />
          </button>
        </div>
        
        <div className="p-4 overflow-y-auto max-h-[60vh]">
          {availableTreatments.length === 0 ? (
            <div className="text-center py-6 text-sm text-slate-400 font-bold">
              등록된 치료 항목이 없습니다.<br/>우측 상단의 설정에서 추가해주세요.
            </div>
          ) : (
            <div className="grid gap-2">
              {availableTreatments.map(tt => (
                <button
                  key={tt.id}
                  onClick={() => onAddTreatment(tt)}
                  className="flex items-center justify-between p-3 border border-slate-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all text-left group active:scale-[0.98]"
                >
                  <div>
                    <div className="font-bold text-slate-800 group-hover:text-blue-700 transition-colors">{tt.name}</div>
                    <div className="text-xs text-slate-500 font-bold">{tt.duration_minutes}분 소요</div>
                  </div>
                  <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center group-hover:bg-blue-500 group-hover:text-white text-transparent transition-colors">
                    <CheckCircle2 size={14} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
