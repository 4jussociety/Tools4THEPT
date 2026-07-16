/**
 * 고객 이송(드래그 앤 드롭 + 모바일 터치) 상태 관리 커스텀 훅
 * 데스크톱 dnd-kit 드래그 이송과 모바일 롱프레스 터치 이송 모달을 담당합니다.
 */

import { useState, useCallback } from 'react';
import { PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { DragStartEvent, DragEndEvent } from '@dnd-kit/core';
import type { BedData } from '../types';
import { supabase } from '../lib/supabase';
import * as treatmentsApi from '../lib/api/treatments';
export function useClientTransfer(
  beds: BedData[],
  setBeds: React.Dispatch<React.SetStateAction<BedData[]>>
) {
  const [activeDragBed, setActiveDragBed] = useState<BedData | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 10, // 10px 이상 드래그해야 활성화 (클릭과 구분)
      },
    })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const dragData = event.active.data.current;
    if (dragData?.bed) {
      setActiveDragBed(dragData.bed as BedData);
    }
  }, []);

  // 공통 고객 이송 핵심 트랜잭션 로직 (드래그와 수동 모달 이송 양측에서 안전하게 호출)
  const executeTransfer = useCallback(async (sourceBed: BedData, targetBed: BedData) => {
    if (sourceBed.id === targetBed.id) return;
    if (targetBed.status !== 'EMPTY') return;

    // 치료 장비(SPECIAL) 베드로 이송될 때, 이름이 같은 치료 항목이 대기 중(WAITING)이면 타이머 자동 활성화
    let updatedTreatments = sourceBed.treatments ? [...sourceBed.treatments] : [];
    if (targetBed.bed_type === 'SPECIAL') {
      const equipmentName = targetBed.bed_number;
      updatedTreatments = updatedTreatments.map(t => {
        if (t.name === equipmentName && t.status === 'WAITING') {
          const startTime = new Date();
          const endTime = new Date(startTime.getTime() + t.durationMinutes * 60000);
          return {
            ...t,
            status: 'IN_PROGRESS' as const,
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
          };
        }
        return t;
      });
    }

    // Optimistic UI 업데이트
    setBeds(current => current.map(b => {
      if (b.id === sourceBed.id) {
        return {
          ...b,
          status: 'EMPTY' as const,
          client_name: '',
          body_part: '',
          client_memo: '',
          current_history_id: undefined,
          treatments: [],
        };
      }
      if (b.id === targetBed.id) {
        return {
          ...b,
          status: sourceBed.status,
          client_name: sourceBed.client_name,
          body_part: sourceBed.body_part,
          client_memo: sourceBed.client_memo,
          current_history_id: sourceBed.current_history_id,
          treatments: updatedTreatments,
        };
      }
      return b;
    }));

    try {
      const [sourceResult, targetResult] = await Promise.all([
        supabase.from('beds').update({
          status: 'EMPTY',
          client_name: null,
          body_part: null,
          client_memo: null,
          current_history_id: null,
          treatments: [],
        }).eq('id', sourceBed.id),
        supabase.from('beds').update({
          status: sourceBed.status,
          client_name: sourceBed.client_name || null,
          body_part: sourceBed.body_part || null,
          client_memo: sourceBed.client_memo || null,
          current_history_id: sourceBed.current_history_id || null,
          treatments: updatedTreatments,
        }).eq('id', targetBed.id),
      ]);

      if (sourceResult.error) console.error('Source Bed DB Update Error:', sourceResult.error);
      if (targetResult.error) console.error('Target Bed DB Update Error:', targetResult.error);

      // 치료 이력(treatment_history) 테이블의 데이터와도 실시간 연동 동기화
      if (sourceBed.current_history_id) {
        const completed = updatedTreatments.filter(t => t.status === 'COMPLETED');
        const incomplete = updatedTreatments.filter(t => t.status !== 'COMPLETED');

        const { error: historyError } = await treatmentsApi.updateTreatmentHistory(sourceBed.current_history_id, {
          completed_treatments: completed,
          incomplete_treatments: incomplete,
        });
        if (historyError) console.error('Treatment History Sync Error:', historyError);
      }
    } catch (err) {
      console.error('Fatal error during drag-and-drop DB transaction:', err);
    }
  }, [setBeds]);

  // 드래그 앤 드롭 이송 이벤트 핸들러
  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    setActiveDragBed(null);

    const { active, over } = event;
    if (!over) return;

    const sourceBed = active.data.current?.bed as BedData | undefined;
    const targetBed = over.data.current?.bed as BedData | undefined;

    if (!sourceBed || !targetBed) return;
    await executeTransfer(sourceBed, targetBed);
  }, [executeTransfer]);

  // 모바일 환경 등에서 단발 클릭(탭)을 통해 수동으로 이송을 수행하는 함수
  const handleManualTransfer = useCallback(async (sourceBedId: string, targetBedId: string) => {
    const sourceBed = beds.find(b => b.id === sourceBedId);
    const targetBed = beds.find(b => b.id === targetBedId);

    if (!sourceBed || !targetBed) return;
    await executeTransfer(sourceBed, targetBed);
  }, [beds, executeTransfer]);

  return {
    activeDragBed,
    sensors,
    handleDragStart,
    handleDragEnd,
    handleManualTransfer,
  };
}
