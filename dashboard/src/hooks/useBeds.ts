/**
 * 베드 상태 관리 및 고객 배정/퇴실 비즈니스 로직 커스텀 훅
 * 베드 CRUD, 실시간 구독, 치료 이력 연동, 신규 유저 온보딩을 담당합니다.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { BedData, TreatmentType, TreatmentItem } from '../types';
import * as bedsApi from '../lib/api/beds';
import * as treatmentsApi from '../lib/api/treatments';
import * as layoutApi from '../lib/api/layout';

export function useBeds(ownerId: string | null, isViewerMode: boolean) {
  const [beds, setBeds] = useState<BedData[]>([]);
  const [treatmentTypes, setTreatmentTypes] = useState<TreatmentType[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchBeds = useCallback(async () => {
    if (!ownerId) return;
    const { data, error } = await bedsApi.fetchBeds(ownerId);

    if (!error && data) {
      // 신규 사용자 온보딩: 베드가 0개면 기본 데이터 자동 세팅
      if (data.length === 0 && !isViewerMode) {
        await setupDefaultData();
        return;
      }

      const upgradedBeds = data.map(b =>
        b.width === 200 ? { ...b, width: 220 } : b
      );

      const sortedBeds = upgradedBeds.sort((a, b) =>
        String(a.bed_number).localeCompare(String(b.bed_number), undefined, { numeric: true, sensitivity: 'base' })
      );
      setBeds(sortedBeds);
    }
  }, [ownerId, isViewerMode]);

  const fetchTreatmentTypesData = useCallback(async () => {
    if (!ownerId) return;
    const { data, error } = await treatmentsApi.fetchTreatmentTypes(ownerId);
    if (!error && data) setTreatmentTypes(data);
  }, [ownerId]);

  // 신규 사용자 최초 로그인 시 기본 데이터 자동 생성
  const setupDefaultData = async () => {
    if (!ownerId) return;
    await Promise.all([
      bedsApi.insertDefaultBeds(ownerId),
      treatmentsApi.insertDefaultTreatmentTypes(ownerId),
      layoutApi.insertDefaultLayoutSettings(ownerId),
    ]);
    // 재조회
    await Promise.all([fetchBeds(), fetchTreatmentTypesData()]);
  };

  // 데이터 초기 로드 + Realtime 구독
  useEffect(() => {
    if (!ownerId) return;

    const loadData = async () => {
      setIsLoading(true);
      // Supabase 세션 정보가 헤더에 완전히 바인딩될 수 있도록 미세한 지연 시간(100ms)을 추가합니다.
      await new Promise(resolve => setTimeout(resolve, 100));
      await Promise.all([fetchBeds(), fetchTreatmentTypesData()]);
      setIsLoading(false);
    };
    loadData();

    const bedsChannel = supabase
      .channel(`beds:${ownerId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'beds', filter: `owner_id=eq.${ownerId}` }, (payload) => {
        if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
          const newBed = payload.new as BedData;
          setBeds(current => {
            const exists = current.find(b => b.id === newBed.id);
            const updated = exists
              ? current.map(b => b.id === newBed.id ? newBed : b)
              : [...current, newBed];

            return updated.sort((a, b) =>
              String(a.bed_number).localeCompare(String(b.bed_number), undefined, { numeric: true, sensitivity: 'base' })
            );
          });
        }
      })
      .subscribe();

    const typesChannel = supabase
      .channel(`treatment_types:${ownerId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'treatment_types', filter: `owner_id=eq.${ownerId}` }, () => {
        fetchTreatmentTypesData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(bedsChannel);
      supabase.removeChannel(typesChannel);
    };
  }, [ownerId, fetchBeds, fetchTreatmentTypesData]);

  // 베드 업데이트 (고객 배정, 퇴실, 치료 상태 변경 등 비즈니스 로직 포함)
  const handleUpdateBed = useCallback(async (updatedBed: BedData) => {
    const oldBed = beds.find(b => b.id === updatedBed.id);
    let historyId = updatedBed.current_history_id;

    if (oldBed && ownerId) {
      // 1. 고객 배정 (EMPTY -> IN_USE): 리포트 행 생성
      if (oldBed.status === 'EMPTY' && updatedBed.status === 'IN_USE') {
        const { data, error } = await treatmentsApi.createTreatmentHistory({
          clientName: updatedBed.client_name || '',
          bodyPart: updatedBed.body_part,
          clientMemo: updatedBed.client_memo,
          treatments: updatedBed.treatments,
          ownerId,
        });

        if (!error && data) {
          historyId = data.id;
          updatedBed.current_history_id = historyId;
        }
      }
      // 2. 퇴실 (IN_USE -> EMPTY/CLEANING): 리포트 마감
      else if (oldBed.status === 'IN_USE' && (updatedBed.status === 'EMPTY' || updatedBed.status === 'CLEANING')) {
        if (oldBed.current_history_id) {
          const finalTreatments = oldBed.treatments || [];
          const completed = finalTreatments.filter(t => t.status === 'COMPLETED');
          const incomplete = finalTreatments.filter(t => t.status !== 'COMPLETED');

          await treatmentsApi.updateTreatmentHistory(oldBed.current_history_id, {
            end_time: new Date().toISOString(),
            completed_treatments: completed,
            incomplete_treatments: incomplete,
            client_memo: oldBed.client_memo || null,
            status: '완료',
          });

          updatedBed.current_history_id = undefined;
          updatedBed.client_memo = '';
        }
      }
      // 3. 진행 중 업데이트 (치료 항목 상태 변경, 메모 변경 등)
      else if (oldBed.status === 'IN_USE' && updatedBed.status === 'IN_USE' && oldBed.current_history_id) {
        const completed = updatedBed.treatments.filter(t => t.status === 'COMPLETED');
        const incomplete = updatedBed.treatments.filter(t => t.status !== 'COMPLETED');

        await treatmentsApi.updateTreatmentHistory(oldBed.current_history_id, {
          client_name: updatedBed.client_name,
          body_part: updatedBed.body_part,
          client_memo: updatedBed.client_memo || null,
          completed_treatments: completed,
          incomplete_treatments: incomplete,
        });
      }
    }

    setBeds(current => current.map(b => b.id === updatedBed.id ? updatedBed : b));
    if (ownerId) {
      await bedsApi.upsertBed(updatedBed, ownerId);
    }
  }, [beds, ownerId]);

  // 치료 항목 즉시 추가 (TreatmentAddModal에서 호출)
  const handleAddTreatment = useCallback((bedId: string, treatment: TreatmentType) => {
    const targetBed = beds.find(b => b.id === bedId);
    if (!targetBed) return;

    const newTreatmentItem: TreatmentItem = {
      id: crypto.randomUUID(),
      name: treatment.name,
      durationMinutes: treatment.duration_minutes,
      status: 'WAITING',
    };

    const updatedBed = {
      ...targetBed,
      treatments: [...(targetBed.treatments || []), newTreatmentItem],
    };

    handleUpdateBed(updatedBed);
  }, [beds, handleUpdateBed]);

  return {
    beds,
    setBeds,
    treatmentTypes,
    isLoading,
    handleUpdateBed,
    handleAddTreatment,
    refetchTreatmentTypes: fetchTreatmentTypesData,
  };
}
