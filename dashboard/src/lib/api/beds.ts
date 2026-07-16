/**
 * beds 테이블 전용 DB 접근 함수 모음
 * 베드의 조회, 생성, 수정, 삭제 및 온보딩 초기 데이터 생성을 담당합니다.
 */

import { supabase } from '../supabase';
import type { BedData } from '../../types';

/** 특정 owner의 전체 베드 목록을 조회합니다. */
export async function fetchBeds(ownerId: string) {
  const { data, error } = await supabase
    .from('beds')
    .select('*')
    .eq('owner_id', ownerId);
  return { data: data as BedData[] | null, error };
}

/** 다수의 베드 정보를 한 번에 bulk upsert(생성 또는 업데이트)합니다. */
export async function upsertBeds(bedsList: BedData[], ownerId: string) {
  if (bedsList.length === 0) return { error: null };
  
  const payload = bedsList.map(bed => ({
    id: bed.id,
    bed_number: bed.bed_number,
    bed_type: bed.bed_type || 'GENERAL',
    status: bed.status,
    client_name: bed.client_name || null,
    body_part: bed.body_part || null,
    // client_memo: bed.client_memo || null, // 원격 DB beds 테이블에 client_memo 컬럼이 누락된 스키마 호환성 우회
    current_history_id: bed.current_history_id || null,
    treatments: bed.treatments || [],
    x_pos: Math.round(bed.x_pos),
    y_pos: Math.round(bed.y_pos),
    width: Math.round(bed.width),
    height: Math.round(bed.height),
    orientation: bed.orientation,
    owner_id: ownerId,
  }));

  const { error } = await supabase
    .from('beds')
    .upsert(payload, { onConflict: 'id' });
  
  return { error };
}

/** 단일 베드 정보를 upsert합니다. */
export async function upsertBed(bed: BedData, ownerId: string) {
  return upsertBeds([bed], ownerId);
}

/** 베드의 상태만 부분 업데이트합니다. */
export async function updateBedStatus(
  bedId: string,
  updates: Partial<BedData>
) {
  const { error } = await supabase
    .from('beds')
    .update(updates)
    .eq('id', bedId);
  return { error };
}

/** 베드를 삭제합니다. */
export async function deleteBed(bedId: string, ownerId: string) {
  const { error } = await supabase
    .from('beds')
    .delete()
    .eq('id', bedId)
    .eq('owner_id', ownerId);
  return { error };
}

/** 신규 유저 온보딩용 기본 베드 10개를 생성합니다. */
export async function insertDefaultBeds(ownerId: string) {
  const defaultBeds = Array.from({ length: 10 }, (_, i) => ({
    id: `bed-${ownerId.slice(0, 8)}-${i + 1}`,
    bed_number: String(i + 1),
    bed_type: 'GENERAL',
    status: 'EMPTY',
    treatments: [] as BedData['treatments'],
    x_pos: (i % 5) * 220 + 50,
    y_pos: Math.floor(i / 5) * 370 + 50,
    width: 220,
    height: 320,
    orientation: 'vertical',
    owner_id: ownerId,
  }));
  const { error } = await supabase.from('beds').insert(defaultBeds);
  return { error };
}
