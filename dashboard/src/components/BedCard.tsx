/**
 * 베드 카드 컴포넌트: 고객 정보 표시, 치료 타이머, 드래그 앤 드롭 고객 이송 기능 포함
 */
import React, { useState, useEffect } from 'react';
import type { BedData, TreatmentItem } from '../types';
import { CheckCircle2, Plus, Star } from 'lucide-react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import clsx from 'clsx';

interface BedCardProps {
  bed: BedData;
  onUpdate: (updatedBed: BedData) => void;
  onOpenModal: () => void;
  onAddTreatmentClick?: () => void;
  isEditMode?: boolean;
  isDragOverlay?: boolean;
  isViewerMode?: boolean;
  forceVertical?: boolean;
  isMobile?: boolean;
  onTransferClick?: () => void;
  isMyBed?: boolean;
  onToggleMyBed?: (e: React.MouseEvent) => void;
}

export function BedCard({ bed, onUpdate, onOpenModal, onAddTreatmentClick, isEditMode, isDragOverlay, isViewerMode, forceVertical, isMobile, onTransferClick, isMyBed, onToggleMyBed }: BedCardProps) {
  const [now, setNow] = useState(new Date());

  // 드래그: 고객이 있는 베드만 드래그 가능 (일반 모드에서만)
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: `drag-${bed.id}`,
    data: { bed },
    disabled: isEditMode || isDragOverlay || bed.status === 'EMPTY' || isViewerMode || isMobile,
  });

  // 드롭: 비어있는 베드만 드롭 대상 (일반 모드에서만)
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `drop-${bed.id}`,
    data: { bed },
    disabled: isEditMode || isDragOverlay || bed.status !== 'EMPTY' || isViewerMode,
  });

  useEffect(() => {
    if (bed.status !== 'IN_USE') return;
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, [bed.status]);



  const handleTreatmentClick = (e: React.MouseEvent, treatment: TreatmentItem) => {
    e.stopPropagation();
    if (isEditMode || isViewerMode) return;

    let newTreatments = [...(bed.treatments || [])];

    if (treatment.status === 'WAITING') {
      const startTime = new Date();
      const endTime = new Date(startTime.getTime() + treatment.durationMinutes * 60000);
      newTreatments = newTreatments.map(t =>
        t.id === treatment.id
          ? { ...t, status: 'IN_PROGRESS' as const, startTime: startTime.toISOString(), endTime: endTime.toISOString() }
          : t
      );
    } else if (treatment.status === 'IN_PROGRESS') {
      newTreatments = newTreatments.map(t =>
        t.id === treatment.id
          ? { ...t, status: 'COMPLETED' as const }
          : t
      );
    }

    onUpdate({ ...bed, treatments: newTreatments });
  };

  const handleClearBed = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isEditMode || isViewerMode) return;
    onUpdate({ ...bed, status: 'EMPTY', client_name: '', body_part: '', current_history_id: undefined, treatments: [] });
  };

  const formatRemainingTime = (endTimeStr?: string | null) => {
    if (!endTimeStr) return '--:--';
    const end = new Date(endTimeStr).getTime();
    const diff = Math.max(0, Math.floor((end - now.getTime()) / 1000));
    const m = Math.floor(diff / 60);
    const s = diff % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getProgressPercent = (t: TreatmentItem) => {
    if (t.status !== 'IN_PROGRESS' || !t.startTime || !t.endTime) return 0;
    const start = new Date(t.startTime).getTime();
    const end = new Date(t.endTime).getTime();
    const total = end - start;
    if (total <= 0) return 100;
    const elapsed = now.getTime() - start;
    return Math.min(100, Math.max(0, (elapsed / total) * 100));
  };

  const isVertical = bed.orientation === 'vertical' || !!forceVertical;

  // 뱃지 글자 수(장비명 길이)에 따라 이름 영역이 뱃지와 겹치지 않도록 동적 패딩 설정
  const badgeTextLength = bed.bed_number.length;
  const dynamicHeaderPadding = badgeTextLength <= 2 
    ? 'pl-[38px]' 
    : badgeTextLength === 3 
      ? 'pl-[62px]' 
      : badgeTextLength === 4 
        ? 'pl-[76px]' 
        : badgeTextLength === 5 
          ? 'pl-[90px]'
          : 'pl-[104px]';

  return (
    <div
      ref={setDropRef}
      className={clsx(
        "relative rounded-2xl border-2 transition-all flex flex-col w-full h-full shadow-sm select-none overflow-hidden",
        bed.status === 'EMPTY'
          ? bed.bed_type === 'SPECIAL'
            ? "border-dashed border-purple-300 bg-purple-50 hover:border-purple-400 hover:bg-purple-100/50 cursor-pointer"
            : "border-dashed border-slate-300 bg-slate-50 hover:border-blue-400 hover:bg-blue-50 cursor-pointer"
          : bed.bed_type === 'SPECIAL'
            ? "border-purple-200 bg-white shadow-md ring-1 ring-purple-100/50"
            : "border-slate-200 bg-white shadow-md",
        isEditMode && "pointer-events-none",
        // 드래그 중인 원본 카드는 반투명 처리
        isDragging && !isDragOverlay && "opacity-30 scale-95",
        // 드래그 오버레이 카드는 약간 커지고 그림자 강화
        isDragOverlay && clsx("shadow-2xl scale-105 ring-2 ring-offset-2", bed.bed_type === 'SPECIAL' ? "ring-purple-500" : "ring-blue-500"),
        // 드롭 대상 위에 있을 때 강조 효과
        isOver && bed.status === 'EMPTY' && (
          bed.bed_type === 'SPECIAL'
            ? "border-purple-500 bg-purple-100/80 border-solid scale-[1.02] shadow-lg"
            : "border-blue-500 bg-blue-100 border-solid scale-[1.02] shadow-lg"
        )
      )}
      onClick={(isEditMode || isViewerMode) ? undefined : bed.status === 'EMPTY' ? onOpenModal : undefined}
    >
      {/* Signature Bed Number Badge (Dynamic sizing for Special device names) */}
      <div className={clsx(
        "absolute -top-1 -left-1 rounded-br-xl rounded-tl-xl flex items-center justify-center font-black text-xs shadow-md z-10 px-2.5 py-1 min-h-[32px] min-w-[32px] max-w-[120px] truncate",
        bed.status === 'EMPTY'
          ? bed.bed_type === 'SPECIAL'
            ? "bg-purple-500 text-white"
            : "bg-slate-400 text-white"
          : bed.bed_type === 'SPECIAL'
            ? "bg-purple-600 text-white"
            : "bg-blue-600 text-white",
        isOver && bed.status === 'EMPTY' && (bed.bed_type === 'SPECIAL' ? "bg-purple-600" : "bg-blue-600")
      )}
        title={bed.bed_number}
      >
        {bed.bed_number}
      </div>

      {bed.status === 'EMPTY' ? (
        <div className={clsx(
          "relative flex-1 flex flex-col items-center justify-center gap-2 w-full h-full",
          isOver
            ? bed.bed_type === 'SPECIAL' ? "text-purple-600" : "text-blue-600"
            : bed.bed_type === 'SPECIAL' ? "text-purple-500" : "text-slate-400"
        )}>
          {/* 빈 베드 상태일 때의 담당 베드 토글 별표 버튼 */}
          {!isViewerMode && !isEditMode && !isDragOverlay && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (onToggleMyBed) onToggleMyBed(e);
              }}
              className={clsx(
                "absolute top-2 right-2 p-1 rounded-xl transition-all hover:bg-slate-100 active:scale-90 z-20 border border-slate-200/50 bg-white/80 backdrop-blur-sm cursor-pointer shadow-sm",
                isMyBed ? "text-amber-500" : "text-slate-300 hover:text-slate-500"
              )}
              title={isMyBed ? "내 담당 베드 해제" : "내 담당 베드로 지정"}
            >
              <Star size={15} fill={isMyBed ? "currentColor" : "none"} />
            </button>
          )}

          <div className={clsx(
            "w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center transition-colors",
            isOver
              ? bed.bed_type === 'SPECIAL' ? "bg-purple-200" : "bg-blue-200"
              : bed.bed_type === 'SPECIAL' ? "bg-purple-100" : "bg-slate-200"
          )}>
            {!isViewerMode && <Plus size={20} className={bed.bed_type === 'SPECIAL' ? "text-purple-600" : "text-slate-500"} />}
          </div>
          <span className="font-bold text-sm md:text-base">
            {isOver ? '여기에 이송' : isViewerMode ? '대기 중' : '고객 배정'}
          </span>
        </div>
      ) : (
        <>
          {/* Header: Orientation-specific Layout */}
          <div className={clsx(
            "flex flex-col border-b border-slate-100 bg-slate-50/50 pr-2 md:pr-3 min-h-[40px] md:min-h-[44px]",
            isVertical ? "py-1 md:py-1.5 gap-1" : "py-[3px] gap-1"
          )}>
            {/* Row 1: Name & Memo (for Horizontal) / Name & Checkout (for both Vertical and Horizontal) */}
            <div className={clsx("flex flex-row justify-between items-center w-full min-w-0", dynamicHeaderPadding)}>
              {/* Name & Memo container */}
              <div className="flex items-center min-w-0 flex-1 gap-2">
                {/* Client Name - Drag Handle (모바일에서는 탭 시 이송 모달을 띄우는 버튼으로 작동) */}
                <div
                  ref={isViewerMode || isMobile ? undefined : setDragRef}
                  {...(isViewerMode || isMobile ? {} : listeners)}
                  {...attributes}
                  onClick={(e) => {
                    if (isMobile && onTransferClick) {
                      e.stopPropagation();
                      onTransferClick();
                    }
                  }}
                  className={clsx(
                    "relative flex items-center gap-1 md:gap-1.5 min-w-0 px-1.5 py-0.5 rounded-lg transition-colors group/name shrink-0",
                    !isViewerMode && !isMobile && "cursor-grab active:cursor-grabbing",
                    bed.bed_type === 'SPECIAL' ? "hover:bg-purple-50" : "hover:bg-blue-50"
                  )}
                  title={isMobile ? "터치하여 다른 베드로 고객을 이송할 수 있습니다" : "드래그하여 다른 베드로 고객을 이송할 수 있습니다"}
                >
                  <span className="text-base md:text-lg font-black text-slate-800 truncate tracking-tight">{bed.client_name}</span>
                </div>

                {/* Horizontal Case: Memo next to Name */}
                {!isVertical && bed.client_memo && (
                  <div
                    className="bg-amber-50/90 border border-amber-200/60 rounded-lg px-2 py-0.5 text-amber-700 font-bold text-[11px] flex items-center shadow-sm select-none hover:bg-amber-100 transition-colors truncate max-w-[200px] md:max-w-[300px]"
                    title={bed.client_memo}
                  >
                    <span className="truncate text-left">{bed.client_memo}</span>
                  </div>
                )}
              </div>

              {/* Action Buttons (My Bed Toggle Star & Checkout Button) */}
              <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                {!isViewerMode && !isEditMode && !isDragOverlay && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onToggleMyBed) onToggleMyBed(e);
                    }}
                    className={clsx(
                      "p-1 rounded-lg border border-slate-200/50 bg-white hover:bg-slate-50 transition-colors cursor-pointer shadow-sm",
                      isMyBed ? "text-amber-500" : "text-slate-400 hover:text-slate-600"
                    )}
                    title={isMyBed ? "내 담당 베드 해제" : "내 담당 베드로 지정"}
                  >
                    <Star size={15} fill={isMyBed ? "currentColor" : "none"} />
                  </button>
                )}

                {isVertical && !isViewerMode && (
                  <button
                    onClick={handleClearBed}
                    className="bg-white hover:bg-red-50 hover:text-red-600 border border-slate-200 text-slate-500 font-black rounded-md transition-colors shadow-sm shrink-0 px-2 md:px-2.5 py-0.5 md:py-1 text-xs"
                  >
                    퇴실
                  </button>
                )}
              </div>
            </div>

            {/* Row 2: Memo Banner (Vertical Case only) / Body Parts & Checkout (Horizontal Case only) */}
            {isVertical ? (
              bed.client_memo && (
                <div className="px-2 w-full mt-0.5">
                  <div
                    className="bg-amber-50/90 border border-amber-200/60 rounded-lg px-2 py-0.5 text-amber-700 font-bold text-[11px] flex items-center shadow-sm select-none hover:bg-amber-100 transition-colors"
                    title={bed.client_memo}
                  >
                    <span className="truncate flex-1 text-left">{bed.client_memo}</span>
                  </div>
                </div>
              )
            ) : (
              (bed.body_part || !isViewerMode) && (
                <div className="flex flex-row justify-between items-center w-full pl-[8px] mt-0.5 pr-2 md:pr-3">
                  {/* Body Parts */}
                  <div className="flex flex-wrap gap-0.5 md:gap-1 min-w-0">
                    {bed.body_part ? (
                      bed.body_part.split(', ').map((part, idx) => (
                        <span
                          key={idx}
                          className={clsx(
                            "text-[14px] md:text-[15px] tracking-tighter p-0 rounded border-2 font-black whitespace-nowrap w-[87px] h-[32px] min-h-[32px] text-center inline-flex items-center justify-center shrink-0",
                            idx === 0
                              ? "bg-orange-50 text-orange-700 border-orange-200"
                              : "bg-emerald-50 text-emerald-700 border-emerald-200"
                          )}
                        >
                          {part}
                        </span>
                      ))
                    ) : (
                      <div />
                    )}
                  </div>

                  {/* Horizontal Case: Checkout Button on Row 2 (Right) */}
                  {!isViewerMode && (
                    <button
                      onClick={handleClearBed}
                      className="bg-white hover:bg-red-50 hover:text-red-600 border border-slate-200 text-slate-500 font-black rounded-md transition-colors shadow-sm shrink-0 px-2 md:px-2.5 py-0.5 md:py-1 text-xs"
                    >
                      퇴실
                    </button>
                  )}
                </div>
              )
            )}

            {/* Row 3: Vertical Case Bottom Row: Body Parts (Full Width) */}
            {isVertical && bed.body_part && (
              <div className="grid grid-cols-2 gap-1 w-full px-2 mt-0.5">
                {bed.body_part.split(', ').map((part, idx) => (
                  <span
                    key={idx}
                    className={clsx(
                      "rounded border-2 font-black whitespace-nowrap text-[14px] md:text-[15px] tracking-tighter p-0 text-center inline-flex items-center justify-center shrink-0",
                      forceVertical ? "h-[26px] min-h-[26px]" : "h-[32px] min-h-[32px]",
                      isVertical ? "w-full" : "w-[87px]",
                      idx === 0
                        ? "bg-orange-50 text-orange-700 border-orange-200"
                        : "bg-emerald-50 text-emerald-700 border-emerald-200"
                    )}
                  >
                    {part}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Body: Auto-filling Treatment Buttons */}
          <div
            className={clsx(
              "flex-1 p-1.5 md:p-2 overflow-y-auto content-start custom-scrollbar grid gap-1.5 md:gap-2",
              isVertical ? "grid-cols-2" : ""
            )}
            style={isVertical ? undefined : { gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))' }}
          >
            {([...(bed.treatments || [])].sort((a, b) => {
              if (a.status === 'COMPLETED' && b.status !== 'COMPLETED') return 1;
              if (a.status !== 'COMPLETED' && b.status === 'COMPLETED') return -1;
              return 0;
            })).map((t) => {
              const isExpired = t.status === 'IN_PROGRESS' && t.endTime && new Date(t.endTime).getTime() <= now.getTime();

              // Clean up and find the body part index for styling
              const cleanPart = (p: string) => p.replace(' (Lt.)', '').replace(' (Rt.)', '').replace(' Lt.', '').replace(' Rt.', '').trim();
              const tPartClean = t.bodyPart ? cleanPart(t.bodyPart) : '';
              const partsList = bed.body_part ? bed.body_part.split(', ').map(p => cleanPart(p)) : [];
              const partIdx = t.bodyPart ? partsList.indexOf(tPartClean) : -1;

              // Base Tailwind color style selectors:
              let buttonStyleClass = "";
              let textStyleClass = "";

              if (t.status === 'WAITING') {
                if (partIdx === 0) {
                  buttonStyleClass = "border-orange-200 bg-orange-50/40 hover:bg-orange-100/50 hover:border-orange-400 text-orange-800";
                  textStyleClass = "text-orange-600/90";
                } else if (partIdx === 1) {
                  buttonStyleClass = "border-emerald-200 bg-emerald-50/40 hover:bg-emerald-100/50 hover:border-emerald-400 text-emerald-800";
                  textStyleClass = "text-emerald-600/90";
                } else {
                  buttonStyleClass = "border-slate-100 bg-white hover:border-blue-300 text-slate-700";
                  textStyleClass = "text-slate-400";
                }
              } else if (t.status === 'IN_PROGRESS' && !isExpired) {
                if (partIdx === 0) {
                  buttonStyleClass = "border-orange-500 bg-orange-500 text-white shadow-md shadow-orange-100/50 ring-2 ring-orange-200/50";
                  textStyleClass = "text-white";
                } else if (partIdx === 1) {
                  buttonStyleClass = "border-emerald-500 bg-emerald-500 text-white shadow-md shadow-emerald-100/50 ring-2 ring-emerald-200/50";
                  textStyleClass = "text-white";
                } else {
                  buttonStyleClass = "border-blue-500 bg-blue-600 text-white shadow-md";
                  textStyleClass = "text-white";
                }
              } else if (t.status === 'IN_PROGRESS' && isExpired) {
                buttonStyleClass = "border-red-500 bg-red-600 text-white animate-pulse shadow-md";
                textStyleClass = "text-white";
              } else if (t.status === 'COMPLETED') {
                buttonStyleClass = "border-green-100 bg-green-50/60 text-green-600 opacity-70";
                textStyleClass = "text-green-500";
              }

              return (
                <button
                  key={t.id}
                  onClick={(e) => handleTreatmentClick(e, t)}
                  disabled={t.status === 'COMPLETED'}
                  className={clsx(
                    "relative overflow-hidden w-full p-1 rounded-xl border-2 flex flex-col items-center justify-center gap-0.5 transition-all active:scale-95 touch-manipulation",
                    forceVertical ? "h-[50px] min-h-[50px]" : "h-[62px] min-h-[62px]",
                    buttonStyleClass
                  )}
                >
                  {/* Dynamic Progress Bar (Subtle Darkening Overlay) */}
                  {t.status === 'IN_PROGRESS' && !isExpired && (
                    <div
                      className="absolute top-0 left-0 bottom-0 bg-black/15 transition-all duration-1000 ease-linear pointer-events-none"
                      style={{ width: `${getProgressPercent(t)}%` }}
                    />
                  )}

                  <div className="flex items-center justify-center gap-0.5 w-full pointer-events-none z-10">
                    <span className="font-black text-[14px] md:text-[17px] truncate text-center">{t.name}</span>
                    {t.status === 'COMPLETED' && <CheckCircle2 size={12} className="shrink-0" />}
                  </div>

                  {(t.status === 'IN_PROGRESS' || t.status === 'WAITING') && (
                    <div className="pointer-events-none z-10">
                      <span className={clsx(
                        "text-[14px] md:text-[17px] font-black font-mono",
                        textStyleClass
                      )}>
                        {t.status === 'IN_PROGRESS'
                          ? formatRemainingTime(t.endTime)
                          : `${t.durationMinutes.toString().padStart(2, '0')}:00`}
                      </span>
                    </div>
                  )}
                </button>
              );
            })}

            {/* 치료 추가 + 버튼 */}
            {!isViewerMode && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (onAddTreatmentClick) {
                    onAddTreatmentClick();
                  } else {
                    onOpenModal();
                  }
                }}
                className={clsx(
                  "w-full p-1 md:p-1.5 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-400 text-slate-400 hover:text-slate-600 flex flex-col items-center justify-center gap-0.5 transition-all active:scale-95 touch-manipulation",
                  forceVertical ? "h-[50px] min-h-[50px]" : "h-[62px] min-h-[62px]"
                )}
                title="치료 추가"
              >
                <Plus size={16} className="shrink-0" />
                <span className="font-black text-[10px] md:text-[12px]">치료 추가</span>
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
