/**
 * layout_settings / layout_objects 테이블 전용 DB 접근 함수 모음
 * 캔버스 설정 및 가구 구조물 배치 데이터의 CRUD를 담당합니다.
 */

import { supabase } from '../supabase';
import type { LayoutObject, LayoutSettings } from '../../types';

// ============================================
// 레이아웃 설정 (layout_settings)
// ============================================

/** 캔버스 레이아웃 설정을 조회합니다. */
export async function fetchLayoutSettings(ownerId: string) {
  const { data, error } = await supabase
    .from('layout_settings')
    .select('*')
    .eq('owner_id', ownerId)
    .limit(1)
    .single();
  return { data: data as LayoutSettings | null, error };
}

/** 캔버스 레이아웃 설정을 업데이트합니다. */
export async function updateLayoutSettings(
  ownerId: string,
  updates: Partial<Pick<LayoutSettings, 'canvas_width' | 'canvas_height' | 'zoom'>>
) {
  const { error } = await supabase
    .from('layout_settings')
    .update(updates)
    .eq('owner_id', ownerId);
  return { error };
}

/** 신규 유저 온보딩용 기본 레이아웃 설정을 생성합니다. */
export async function insertDefaultLayoutSettings(ownerId: string) {
  const { error } = await supabase.from('layout_settings').insert({
    id: `dashboard-${ownerId.slice(0, 8)}`,
    canvas_width: 2000,
    canvas_height: 1200,
    zoom: 1,
    owner_id: ownerId,
  });
  return { error };
}

// ============================================
// 레이아웃 오브젝트 (layout_objects)
// ============================================

/** 가구/구조물 목록을 조회합니다. */
export async function fetchLayoutObjects(ownerId: string) {
  const { data, error } = await supabase
    .from('layout_objects')
    .select('*')
    .eq('owner_id', ownerId);
  return { data: data as LayoutObject[] | null, error };
}

/** 가구/구조물을 upsert합니다. */
export async function upsertLayoutObject(obj: LayoutObject, ownerId: string) {
  const { error } = await supabase.from('layout_objects').upsert({
    id: obj.id,
    object_type: obj.object_type,
    name: obj.name || null,
    x_pos: Math.round(obj.x_pos),
    y_pos: Math.round(obj.y_pos),
    width: Math.round(obj.width),
    height: Math.round(obj.height),
    rotation: obj.rotation,
    z_index: obj.z_index,
    owner_id: ownerId,
  });
  return { error };
}

/** 가구/구조물을 삭제합니다. */
export async function deleteLayoutObject(id: string, ownerId: string) {
  const { error } = await supabase
    .from('layout_objects')
    .delete()
    .eq('id', id)
    .eq('owner_id', ownerId);
  return { error };
}
