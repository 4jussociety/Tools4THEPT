// 치료 항목 설정 모달 - 치료 항목의 추가/삭제를 관리합니다.
import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Settings } from 'lucide-react';
import type { TreatmentType } from '../types';
import { getWeightedLength, truncateByWeightedLength } from '../lib/utils/text';
import { addTreatmentType, deleteTreatmentType, fetchTreatmentTypes as fetchTypes_ } from '../lib/api/treatments';

interface SettingsModalProps {
  onClose: () => void;
  onUpdateTypes: () => void;
  ownerId: string;
}

export function SettingsModal({ onClose, onUpdateTypes, ownerId }: SettingsModalProps) {
  const [treatmentTypes, setTreatmentTypes] = useState<TreatmentType[]>([]);
  const [newName, setNewName] = useState('');
  const [newDuration, setNewDuration] = useState(15);
  const [loading, setLoading] = useState(false);

  const fetchTypes = async () => {
    if (!ownerId) return;
    const { data, error } = await fetchTypes_(ownerId);
    if (!error && data) setTreatmentTypes(data);
  };

  useEffect(() => {
    fetchTypes();
  }, [ownerId]);

  const handleNameChange = (val: string) => {
    setNewName(truncateByWeightedLength(val, 6.0));
  };

  const handleAdd = async () => {
    const trimmed = newName.trim();
    if (!trimmed || !ownerId) return;

    const score = getWeightedLength(trimmed);
    if (score > 6.0) {
      alert('치료명은 한글 4자 또는 영문 6자까지만 등록 가능합니다.');
      return;
    }

    setLoading(true);
    const { error } = await addTreatmentType(trimmed, newDuration, ownerId);
    if (error) {
      alert('추가 실패: ' + error.message);
    } else {
      setNewName('');
      setNewDuration(15);
      await fetchTypes();
      onUpdateTypes();
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('정말 삭제하시겠습니까?') || !ownerId) return;
    setLoading(true);
    const { error } = await deleteTreatmentType(id, ownerId);
    if (error) {
      alert('삭제 실패: ' + error.message);
    } else {
      await fetchTypes();
      onUpdateTypes();
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-lg h-[70vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div className="flex items-center gap-2">
            <Settings className="text-slate-600" size={24} />
            <h2 className="text-xl font-black text-slate-800">치료 항목 관리</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <X size={24} className="text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Add New Section */}
          <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
            <h3 className="text-sm font-bold text-blue-700 mb-3">새 치료 항목 추가</h3>
            <div className="flex gap-2">
              <div className="flex-1 flex flex-col">
                <input 
                  type="text" 
                  placeholder="치료명 (예: 도수, TENS)" 
                  className="w-full px-3 py-2 border border-blue-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={newName}
                  onChange={e => handleNameChange(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2 bg-white px-3 py-2 border border-blue-200 rounded-lg h-[38px]">
                <input 
                  type="number" 
                  className="w-12 text-sm focus:outline-none"
                  value={newDuration}
                  onChange={e => setNewDuration(parseInt(e.target.value) || 0)}
                />
                <span className="text-xs text-slate-400">분</span>
              </div>
              <button 
                onClick={handleAdd}
                disabled={loading || !newName.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors h-[38px]"
              >
                <Plus size={20} />
              </button>
            </div>
            {/* 자릿수 가이드라인 표시 */}
            <p className="text-[11px] text-slate-500 mt-2 flex justify-between items-center px-1">
              <span>* 한글 최대 4자 / 영문 최대 6자 제한 (공백 포함)</span>
              <span className={getWeightedLength(newName) >= 6.0 ? "text-red-500 font-bold" : "text-blue-600 font-medium"}>
                입력: {getWeightedLength(newName).toFixed(1)} / 6.0
              </span>
            </p>
          </div>

          {/* List Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-700">등록된 치료 항목 ({treatmentTypes.length})</h3>
            {treatmentTypes.length === 0 ? (
              <div className="text-center py-8 text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                등록된 치료 항목이 없습니다.
              </div>
            ) : (
              treatmentTypes.map(tt => (
                <div key={tt.id} className="flex justify-between items-center p-3 border border-slate-100 rounded-xl hover:bg-slate-50 transition-colors group">
                  <div>
                    <div className="font-bold text-slate-800">{tt.name}</div>
                    <div className="text-xs text-slate-400">{tt.duration_minutes}분</div>
                  </div>
                  <button 
                    onClick={() => handleDelete(tt.id)}
                    disabled={loading}
                    className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 text-center">
          <button 
            onClick={onClose}
            className="w-full py-3 bg-slate-800 text-white font-bold rounded-xl hover:bg-black transition-colors"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
