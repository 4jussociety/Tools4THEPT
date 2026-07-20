/**
 * treatment_types / treatment_history 테이블 전용 DB 접근 함수 모음
 * 치료 항목 마스터 관리 및 방문 기반 이력 CRUD를 담당합니다.
 */

import { supabase } from '../supabase';
import type { TreatmentType, TreatmentHistory, TreatmentItem } from '../../types';

// ============================================
// 치료 항목 마스터 (treatment_types)
// ============================================

/** 치료 항목 목록을 조회합니다. */
export async function fetchTreatmentTypes(ownerId: string) {
  const { data, error } = await supabase
    .from('treatment_types')
    .select('*')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: true });
  return { data: data as TreatmentType[] | null, error };
}

/** 치료 항목을 추가합니다. */
export async function addTreatmentType(
  name: string,
  durationMinutes: number,
  ownerId: string
) {
  const { error } = await supabase
    .from('treatment_types')
    .insert([{ name, duration_minutes: durationMinutes, owner_id: ownerId }]);
  return { error };
}

/** 치료 항목을 삭제합니다. */
export async function deleteTreatmentType(id: string, ownerId: string) {
  const { error } = await supabase
    .from('treatment_types')
    .delete()
    .eq('id', id)
    .eq('owner_id', ownerId);
  return { error };
}

/** 신규 유저 온보딩용 기본 치료 항목 6개를 생성합니다. */
export async function insertDefaultTreatmentTypes(ownerId: string) {
  const defaultTypes = [
    { name: 'HP', duration_minutes: 15, owner_id: ownerId },
    { name: 'IR', duration_minutes: 15, owner_id: ownerId },
    { name: 'ICT', duration_minutes: 15, owner_id: ownerId },
    { name: '수기', duration_minutes: 10, owner_id: ownerId },
    { name: '견인', duration_minutes: 15, owner_id: ownerId },
    { name: 'TENS', duration_minutes: 15, owner_id: ownerId },
  ];
  const { error } = await supabase.from('treatment_types').insert(defaultTypes);
  return { error };
}

// ============================================
// 치료 이력 (treatment_history)
// ============================================

/** 치료 이력을 생성합니다 (고객 배정 시). */
export async function createTreatmentHistory(params: {
  clientName: string;
  bodyPart?: string;
  clientMemo?: string;
  treatments: TreatmentItem[];
  ownerId: string;
}) {
  const { data, error } = await supabase
    .from('treatment_history')
    .insert({
      client_name: params.clientName,
      body_part: params.bodyPart || null,
      client_memo: params.clientMemo || null,
      visit_time: new Date().toISOString(),
      incomplete_treatments: params.treatments,
      completed_treatments: [],
      status: '진행중',
      owner_id: params.ownerId,
    })
    .select()
    .single();
  return { data: data as TreatmentHistory | null, error };
}

/** 치료 이력을 업데이트합니다 (치료 진행 중 또는 퇴실 시). */
export async function updateTreatmentHistory(
  historyId: string,
  updates: Partial<{
    end_time: string;
    completed_treatments: TreatmentItem[];
    incomplete_treatments: TreatmentItem[];
    client_name: string;
    body_part: string;
    client_memo: string | null;
    status: string;
  }>
) {
  const { error } = await supabase
    .from('treatment_history')
    .update(updates)
    .eq('id', historyId);
  return { error };
}

/** 치료 이력을 삭제합니다. */
export async function deleteTreatmentHistory(id: string, ownerId: string) {
  const { error } = await supabase
    .from('treatment_history')
    .delete()
    .eq('id', id)
    .eq('owner_id', ownerId);
  return { error };
}

/** 최근 고객 이력을 조회합니다 (자동완성 제안용). */
export async function fetchRecentClients(ownerId: string, limit = 3000) {
  const { data, error } = await supabase
    .from('treatment_history')
    .select('*')
    .eq('owner_id', ownerId)
    .order('visit_time', { ascending: false })
    .limit(limit);
  return { data: data as TreatmentHistory[] | null, error };
}
