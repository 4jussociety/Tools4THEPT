import { useState, useEffect } from 'react';
import type { BedData, TreatmentItem, TreatmentType, TreatmentHistory } from '../types';
import { X, Play, CheckCircle2, Plus, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import { supabase } from '../lib/supabase';

interface BedModalProps {
  bed: BedData;
  availableTreatments: TreatmentType[];
  onClose: () => void;
  onUpdate: (updatedBed: BedData) => void;
  ownerId: string;
}

interface BodyPartInfo {
  part: string;
  side: 'none' | 'left' | 'right';
}

const PRESET_PARTS = ['목', '어깨', '엘보', '손목', '손', '등', '허리', '무릎', '발목', '발'];

export function BedModal({ bed, availableTreatments, onClose, onUpdate, ownerId }: BedModalProps) {
  const [clientName, setClientName] = useState(bed.client_name || '');
  const [clientMemo, setClientMemo] = useState(bed.client_memo || '');
  const [historySuggestions, setHistorySuggestions] = useState<TreatmentHistory[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);

  // 부위 정보 파싱 ( (Lt.), (Rt.) 대응)
  const parseBodyParts = (raw: string): BodyPartInfo[] => {
    if (!raw) return [];
    return raw.split(', ').map(p => {
      let side: any = 'none';
      let cleanPart = p;
      if (p.includes(' (Lt.)')) { side = 'left'; cleanPart = p.replace(' (Lt.)', ''); }
      else if (p.includes(' (Rt.)')) { side = 'right'; cleanPart = p.replace(' (Rt.)', ''); }
      else if (p.includes(' Lt.')) { side = 'left'; cleanPart = p.replace(' Lt.', ''); }
      else if (p.includes(' Rt.')) { side = 'right'; cleanPart = p.replace(' Rt.', ''); }
      return { part: cleanPart.trim(), side };
    }).filter(bp => bp.part !== '');
  };

  const [bodyParts, setBodyParts] = useState<BodyPartInfo[]>(() => parseBodyParts(bed.body_part || ''));
  const [activeFocusPart, setActiveFocusPart] = useState<string | null>(() => {
    const parsed = parseBodyParts(bed.body_part || '');
    return parsed.length > 0 ? parsed[0].part : null;
  });
  const [localTreatments, setLocalTreatments] = useState<TreatmentItem[]>(bed.treatments || []);
  const [now, setNow] = useState(new Date());

  const matchedSuggestions = clientName.trim()
    ? historySuggestions.filter(item =>
      item.client_name.toLowerCase().includes(clientName.trim().toLowerCase())
    ).slice(0, 5)
    : [];

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchRecentClients = async () => {
      if (!ownerId) return;
      try {
        const { data, error } = await supabase
          .from('treatment_history')
          .select('*')
          .eq('owner_id', ownerId)
          .order('visit_time', { ascending: false })
          .limit(3000);

        if (!error && data) {
          const uniqueList: TreatmentHistory[] = [];
          const seenNames = new Set<string>();
          for (const record of data) {
            const name = record.client_name?.trim();
            if (name && !seenNames.has(name)) {
              seenNames.add(name);
              uniqueList.push(record as TreatmentHistory);
            }
          }
          setHistorySuggestions(uniqueList);
        }
      } catch (e) {
        console.error('Error fetching recent clients:', e);
      }
    };
    fetchRecentClients();
  }, [ownerId]);

  const handleTogglePart = (part: string) => {
    const existsIdx = bodyParts.findIndex(bp => bp.part === part);
    if (existsIdx > -1) {
      // 이미 선택되어 있는 경우
      if (activeFocusPart === part) {
        // 활성화되어 있는 부위면 삭제(토글 오프)
        const updated = bodyParts.filter(bp => bp.part !== part);
        setBodyParts(updated);
        setActiveFocusPart(updated.length > 0 ? updated[0].part : null);
      } else {
        // 이미 선택되어 있지만 활성화되어 있지 않으면 활성화만 해줌 (포커스 전환)
        setActiveFocusPart(part);
      }
    } else {
      // 새로 선택하는 부위 (최대 2개 제한)
      if (bodyParts.length >= 2) return;
      setBodyParts(prev => [...prev, { part, side: 'none' }]);
      setActiveFocusPart(part);
    }
  };

  const handleSideChange = (part: string, side: 'none' | 'left' | 'right') => {
    setBodyParts(prev => prev.map(bp =>
      bp.part === part ? { ...bp, side } : bp
    ));
  };

  const handleAddTreatment = (name: string, durationMinutes: number) => {
    const newTreatment: TreatmentItem = {
      id: Math.random().toString(36).substring(7),
      name,
      durationMinutes,
      status: 'WAITING',
      bodyPart: activeFocusPart || undefined
    };
    setLocalTreatments(prev => [...prev, newTreatment]);
  };

  const handleRemoveTreatment = (tId: string) => {
    setLocalTreatments(prev => prev.filter(t => t.id !== tId));
  };

  const handleStartIndividual = (tId: string) => {
    const currentTime = new Date();
    setLocalTreatments(prev => prev.map(t => {
      if (t.id === tId) {
        const endTime = new Date(currentTime.getTime() + t.durationMinutes * 60000);
        return {
          ...t,
          status: 'IN_PROGRESS' as const,
          startTime: currentTime.toISOString(),
          endTime: endTime.toISOString()
        };
      }
      return t;
    }));
  };

  const handleCompleteIndividual = (tId: string) => {
    setLocalTreatments(prev => prev.map(t =>
      t.id === tId ? { ...t, status: 'COMPLETED' as const } : t
    ));
  };

  const handleFinalSubmit = () => {
    // 부위 정보 문자열로 병합 ( (Lt.), (Rt.) )
    const bodyPartString = bodyParts
      .filter(bp => bp.part.trim())
      .map(bp => {
        const sideSuffix = bp.side === 'left' ? ' (Lt.)' : bp.side === 'right' ? ' (Rt.)' : '';
        return `${bp.part.trim()}${sideSuffix}`;
      })
      .join(', ');

    onUpdate({
      ...bed,
      client_name: clientName,
      body_part: bodyPartString,
      client_memo: clientMemo,
      treatments: localTreatments,
      status: localTreatments.length > 0 ? 'IN_USE' : 'EMPTY'
    });
    onClose();
  };

  const handleSetCleaning = () => {
    onUpdate({ ...bed, status: 'CLEANING' });
    onClose();
  };

  const getRemainingMinutes = (t: TreatmentItem) => {
    if (t.status === 'WAITING') return t.durationMinutes;
    if (t.status === 'COMPLETED') return 0;
    if (t.endTime) {
      const end = new Date(t.endTime).getTime();
      const remain = Math.max(0, Math.floor((end - now.getTime()) / 1000));
      return Math.ceil(remain / 60);
    }
    return t.durationMinutes;
  };

  const formatLastVisitDate = (visitTimeStr: string) => {
    const visitDate = new Date(visitTimeStr);
    const today = new Date();
    const visitDay = new Date(visitDate.getFullYear(), visitDate.getMonth(), visitDate.getDate());
    const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    const diffMs = todayDay.getTime() - visitDay.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return '오늘';
    if (diffDays === 1) return '어제';
    if (diffDays < 7) return `${diffDays}일 전`;
    return `${visitDate.getFullYear() % 100}.${(visitDate.getMonth() + 1).toString().padStart(2, '0')}.${visitDate.getDate().toString().padStart(2, '0')}`;
  };

  const handleSelectSuggestion = (item: TreatmentHistory) => {
    setClientName(item.client_name);
    setClientMemo(item.client_memo || '');

    if (item.body_part) {
      const parsed = parseBodyParts(item.body_part);
      setBodyParts(parsed);
      setActiveFocusPart(parsed.length > 0 ? parsed[0].part : null);
    } else {
      setBodyParts([]);
      setActiveFocusPart(null);
    }

    const merged = [
      ...(item.completed_treatments || []),
      ...(item.incomplete_treatments || [])
    ];

    const mappedTreatments: TreatmentItem[] = merged.map((t: any) => {
      const original = availableTreatments.find(at => at.name === t.name);
      return {
        id: Math.random().toString(36).substring(7),
        name: t.name,
        durationMinutes: original?.duration_minutes || t.durationMinutes || 15,
        status: 'WAITING' as const,
        bodyPart: t.bodyPart || undefined
      };
    });

    setLocalTreatments(mappedTreatments);
    setShowDropdown(false);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 backdrop-blur-sm">
      <div className="bg-white rounded-t-3xl sm:rounded-2xl w-full max-w-2xl h-[92vh] sm:h-[85vh] overflow-hidden flex flex-col shadow-2xl transition-all animate-in slide-in-from-bottom sm:zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex justify-between items-center px-4 py-3.5 sm:px-5 sm:py-4 border-b border-slate-200">
          <h2 className="text-lg sm:text-xl font-black text-slate-800 tracking-tight">
            Bed {bed.bed_number.toString().padStart(2, '0')} 베드 관리
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-full transition-colors active:scale-90">
            <X size={20} className="text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 custom-scrollbar">
          {/* Client Info & Memo Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3.5 sm:mb-4">
            <div className="relative">
              <label className="block text-xs sm:text-xs font-black text-slate-500 uppercase tracking-wider mb-1">고객명</label>
              <input
                type="text"
                value={clientName}
                onChange={e => setClientName(e.target.value)}
                onFocus={() => setShowDropdown(true)}
                onBlur={() => setShowDropdown(false)}
                placeholder="고객명을 입력하세요"
                className="w-full px-3 py-2 sm:py-1.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none font-bold text-slate-800 placeholder-slate-400 text-sm"
              />
              {showDropdown && matchedSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden divide-y divide-slate-100 max-h-[250px] overflow-y-auto custom-scrollbar animate-in fade-in slide-in-from-top-2 duration-150">
                  {matchedSuggestions.map(item => (
                    <button
                      key={item.id}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleSelectSuggestion(item);
                      }}
                      className="w-full px-4 py-2.5 hover:bg-blue-50/50 cursor-pointer flex flex-col items-start transition-all text-left"
                    >
                      <div className="flex justify-between items-center w-full">
                        <span className="text-xs font-black text-slate-800">{item.client_name}</span>
                        <span className="text-[10px] text-slate-400 font-bold font-mono">
                          {formatLastVisitDate(item.visit_time)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 w-full text-[11px] text-slate-400 font-bold truncate">
                        {item.body_part && (
                          <span className="bg-amber-50 text-amber-600 px-1 py-0.5 rounded border border-amber-100 text-[10px] shrink-0 font-black">
                            {item.body_part}
                          </span>
                        )}
                        <span className="truncate">
                          {(item.completed_treatments || []).map((t: any) => t.name).join(', ') || '치료 기록 없음'}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs sm:text-xs font-black text-slate-500 uppercase tracking-wider mb-1">고객 특이사항 (메모)</label>
              <textarea
                value={clientMemo}
                onChange={e => setClientMemo(e.target.value)}
                placeholder="예: 낙상 주의, 우측 어깨 중점 치료, 온열 추가 등"
                rows={1}
                className="w-full px-3 py-2 sm:py-1.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none font-bold text-slate-800 placeholder-slate-400 resize-none min-h-[38px] text-sm"
              />
            </div>
          </div>

          {/* 치료 부위 선택 영역 (최대 2개 제한) */}
          <div className="mb-4 sm:mb-5 bg-slate-50/50 p-3 sm:p-4 rounded-2xl border border-slate-200">
            <label className="block text-xs sm:text-xs font-black text-slate-500 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>치료 부위 선택</span>
              <span className="text-slate-400 text-xs font-normal">최대 2개 선택 가능</span>
            </label>

            {/* 10개 프리셋 칩 목록 */}
            <div className="flex flex-wrap gap-1.5 mb-2.5">
              {PRESET_PARTS.map(part => {
                const partIdx = bodyParts.findIndex(bp => bp.part === part);
                const isSelected = partIdx > -1;
                const isFocused = activeFocusPart === part;
                const isLimitReached = bodyParts.length >= 2 && !isSelected;

                let chipColorClass = "bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300 shadow-sm";
                if (isSelected) {
                  if (partIdx === 0) {
                    chipColorClass = isFocused
                      ? "bg-orange-500 text-white border-orange-500 shadow-md ring-2 ring-orange-200 font-extrabold"
                      : "bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100/70 font-extrabold";
                  } else {
                    chipColorClass = isFocused
                      ? "bg-emerald-500 text-white border-emerald-500 shadow-md ring-2 ring-emerald-200 font-extrabold"
                      : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100/70 font-extrabold";
                  }
                }

                return (
                  <button
                    key={part}
                    type="button"
                    disabled={isLimitReached}
                    onClick={() => handleTogglePart(part)}
                    className={clsx(
                      "px-2.5 py-1 text-xs rounded-xl border transition-all active:scale-95",
                      chipColorClass,
                      isLimitReached && "bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed opacity-50 shadow-none hover:bg-slate-100 hover:border-slate-200"
                    )}
                  >
                    {part}
                  </button>
                );
              })}
            </div>

            {/* 현재 활성 포커스 안내 가이드 */}
            {bodyParts.length > 0 && activeFocusPart && (
              <div className="mt-2 text-xs font-black px-3 py-2 rounded-xl flex items-center gap-1.5 transition-all border shadow-sm" style={{
                backgroundColor: bodyParts.findIndex(bp => bp.part === activeFocusPart) === 0 ? 'rgba(249, 115, 22, 0.06)' : 'rgba(16, 185, 129, 0.06)',
                color: bodyParts.findIndex(bp => bp.part === activeFocusPart) === 0 ? 'rgb(234, 88, 12)' : 'rgb(5, 150, 105)',
                borderColor: bodyParts.findIndex(bp => bp.part === activeFocusPart) === 0 ? 'rgba(249, 115, 22, 0.25)' : 'rgba(16, 185, 129, 0.25)',
              }}>
                <span className="animate-pulse text-sm">💡</span>
                <span>
                  현재 <strong className="underline decoration-2">{activeFocusPart}</strong> 부위에 적용할 치료를 선택하고 있습니다.
                </span>
              </div>
            )}

            {/* 선택된 부위의 세부 방향 설정 영역 */}
            {bodyParts.length > 0 ? (
              <div className="space-y-2 mt-3">
                {bodyParts.map((bp, idx) => {
                  const isFocused = activeFocusPart === bp.part;

                  return (
                    <div
                      key={bp.part}
                      onClick={() => setActiveFocusPart(bp.part)}
                      className={clsx(
                        "flex flex-row items-center justify-between p-2 bg-white rounded-xl border shadow-sm gap-1.5 transition-all cursor-pointer",
                        isFocused
                          ? idx === 0
                            ? "border-orange-400 bg-orange-50/10 ring-2 ring-orange-100 shadow-md scale-[1.01]"
                            : "border-emerald-400 bg-emerald-50/10 ring-2 ring-emerald-100 shadow-md scale-[1.01]"
                          : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/30"
                      )}
                    >
                      <div className="flex items-center gap-1 shrink-0">
                        <span className={clsx(
                          "w-3.5 h-3.5 rounded-full text-white flex items-center justify-center text-[8px] font-bold shadow-sm shrink-0",
                          idx === 0 ? "bg-orange-500" : "bg-emerald-500"
                        )}>
                          {idx + 1}
                        </span>
                        <span className="font-extrabold text-slate-800 text-xs flex items-center gap-1 shrink-0">
                          {bp.part}
                          {isFocused && (
                            <span className={clsx(
                              "text-[8px] border rounded px-1 py-0.1 font-black shrink-0 uppercase tracking-wider animate-pulse",
                              idx === 0
                                ? "bg-orange-100 text-orange-700 border-orange-200"
                                : "bg-emerald-100 text-emerald-700 border-emerald-200"
                            )}>
                              편집
                            </span>
                          )}
                        </span>
                      </div>

                      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        {/* 방향 조작 패널 */}
                        <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 gap-0.5">
                          <button
                            type="button"
                            onClick={() => handleSideChange(bp.part, 'left')}
                            className={clsx(
                              "px-2 py-0.5 text-[10px] sm:text-xs font-bold rounded-md transition-all text-center whitespace-nowrap",
                              bp.side === 'left'
                                ? idx === 0
                                  ? "bg-orange-500 text-white shadow-sm font-extrabold"
                                  : "bg-emerald-500 text-white shadow-sm font-extrabold"
                                : "text-slate-600 hover:bg-slate-200"
                            )}
                          >
                            <span className="inline sm:hidden">좌</span>
                            <span className="hidden sm:inline">왼쪽 (Lt)</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSideChange(bp.part, 'right')}
                            className={clsx(
                              "px-2 py-0.5 text-[10px] sm:text-xs font-bold rounded-md transition-all text-center whitespace-nowrap",
                              bp.side === 'right'
                                ? idx === 0
                                  ? "bg-orange-500 text-white shadow-sm font-extrabold"
                                  : "bg-emerald-500 text-white shadow-sm font-extrabold"
                                : "text-slate-600 hover:bg-slate-200"
                            )}
                          >
                            <span className="inline sm:hidden">우</span>
                            <span className="hidden sm:inline">오른쪽 (Rt)</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSideChange(bp.part, 'none')}
                            className={clsx(
                              "px-2 py-0.5 text-[10px] sm:text-xs font-bold rounded-md transition-all text-center whitespace-nowrap",
                              bp.side === 'none'
                                ? idx === 0
                                  ? "bg-orange-500 text-white shadow-sm font-extrabold"
                                  : "bg-emerald-500 text-white shadow-sm font-extrabold"
                                : "text-slate-600 hover:bg-slate-200"
                            )}
                          >
                            <span className="inline sm:hidden">양쪽</span>
                            <span className="hidden sm:inline">양쪽 (생략)</span>
                          </button>
                        </div>

                        {/* 삭제 버튼 */}
                        <button
                          type="button"
                          onClick={() => handleTogglePart(bp.part)}
                          className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                          title="부위 취소"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-3 text-[11px] text-slate-400 bg-white border border-slate-200 border-dashed rounded-xl">
                치료받을 부위 칩을 위에서 선택해 주세요.
              </div>
            )}
          </div>

          <div className="mb-4 sm:mb-5">
            <h3 className="text-sm sm:text-base font-black text-slate-800 mb-2 sm:mb-2.5">치료 추가</h3>
            <div className="grid grid-cols-4 gap-1.5">
              {availableTreatments.map(at => (
                <button
                  key={at.id}
                  onClick={() => handleAddTreatment(at.name, at.duration_minutes)}
                  className="flex items-center justify-center gap-1 p-2 border border-slate-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:border-slate-200 text-[11px] sm:text-xs font-black text-slate-700 active:scale-95"
                  disabled={!clientName.trim()}
                >
                  <Plus size={12} className="text-slate-400 shrink-0" />
                  <span className="truncate">{at.name}</span>
                </button>
              ))}
            </div>
            {!clientName.trim() && (
              <p className="text-xs text-red-500 mt-1.5 font-medium">※ 고객명을 먼저 입력해야 치료를 추가할 수 있습니다.</p>
            )}
          </div>

          <div className="mb-3">
            <h3 className="text-sm sm:text-base font-black text-slate-800 mb-2 sm:mb-2.5">치료 항목 리스트</h3>
            {localTreatments.length === 0 ? (
              <div className="text-center py-5 text-slate-400 bg-slate-50 rounded-2xl border border-slate-200 border-dashed text-xs">
                배정된 치료가 없습니다.
              </div>
            ) : (
              <div className="space-y-1.5 sm:space-y-2">
                {localTreatments.map((t, idx) => (
                  <div key={t.id} className="flex items-center justify-between p-2.5 bg-white border border-slate-200 rounded-xl shadow-sm gap-1.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center font-black text-slate-600 text-[11px] shrink-0">
                        {idx + 1}
                      </div>
                      <div className="min-w-0">
                        <div className="font-extrabold text-slate-800 text-xs sm:text-sm truncate flex items-center gap-1.5">
                          <span>{t.name}</span>
                          {t.bodyPart && (
                            <span className={clsx(
                              "text-[9px] font-black px-1 py-0.2 rounded border shrink-0",
                              bodyParts.findIndex(bp => bp.part === t.bodyPart) === 0
                                ? "bg-orange-50 text-orange-700 border-orange-200"
                                : "bg-emerald-50 text-emerald-700 border-emerald-200"
                            )}>
                              {t.bodyPart}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] sm:text-[11px] text-slate-400 font-medium">{t.durationMinutes}분 (잔여: {getRemainingMinutes(t)}분)</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {t.status === 'WAITING' && (
                        <button
                          onClick={() => handleStartIndividual(t.id)}
                          className="flex items-center gap-0.5 px-2 py-1 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-lg text-[11px] font-black transition-colors"
                        >
                          <Play size={12} /> 시작
                        </button>
                      )}
                      {t.status === 'IN_PROGRESS' && (
                        <button
                          onClick={() => handleCompleteIndividual(t.id)}
                          className="flex items-center gap-0.5 px-2 py-1 bg-green-100 text-green-700 hover:bg-green-200 rounded-lg text-[11px] font-black transition-colors"
                        >
                          <CheckCircle2 size={12} /> 완료
                        </button>
                      )}
                      {t.status === 'COMPLETED' && (
                        <span className="px-2 py-1 bg-slate-100 text-slate-500 rounded-lg text-[11px] font-bold flex items-center gap-0.5">
                          <CheckCircle2 size={12} /> 완료됨
                        </span>
                      )}
                      <button
                        onClick={() => handleRemoveTreatment(t.id)}
                        className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 sm:px-5 sm:py-3.5 border-t border-slate-200 bg-slate-50 flex flex-row justify-between items-center rounded-b-2xl gap-2.5">
          <button
            onClick={handleSetCleaning}
            className="px-3 sm:px-4 py-2 bg-amber-100 text-amber-700 font-bold rounded-xl hover:bg-amber-200 transition-colors text-xs sm:text-xs shrink-0 active:scale-95"
          >
            청소 대기
          </button>

          <div className="flex gap-1.5 sm:gap-2 w-full justify-end">
            <button
              onClick={onClose}
              className="px-3 sm:px-4 py-2 bg-slate-400 text-white font-bold rounded-xl hover:bg-slate-500 transition-colors text-xs sm:text-xs active:scale-95"
            >
              취소
            </button>
            <button
              onClick={handleFinalSubmit}
              className="px-4 sm:px-5 py-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-lg text-xs sm:text-xs active:scale-95"
            >
              {bed.status === 'EMPTY' ? '고객 배정' : '변경사항 저장'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
