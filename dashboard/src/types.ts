/**
 * 물리치료실 상황판 전역 타입 정의
 * 모든 데이터 모델의 인터페이스와 유니온 타입을 정의합니다.
 */

// ============================================
// 상태 유니온 타입
// ============================================
export type BedStatus = 'EMPTY' | 'IN_USE' | 'CLEANING';
export type TreatmentStatus = 'WAITING' | 'IN_PROGRESS' | 'COMPLETED';
export type LayoutObjectType = 'WALL' | 'PILLAR' | 'DOOR' | 'DESK' | 'SOFA';

// ============================================
// 치료 관련 인터페이스
// ============================================
export interface TreatmentItem {
  id: string;
  name: string;
  durationMinutes: number;
  status: TreatmentStatus;
  startTime?: string;
  endTime?: string;
  bodyPart?: string; // 치료가 적용될 부위 명칭
}

export interface TreatmentType {
  id: string;
  name: string;
  duration_minutes: number;
  owner_id?: string;
}

// ============================================
// 베드(침상) 인터페이스
// ============================================
export interface BedData {
  id: string;
  bed_number: string;
  bed_type?: 'GENERAL' | 'SPECIAL';
  status: BedStatus;
  client_name?: string;
  body_part?: string;
  client_memo?: string;
  current_history_id?: string;
  treatments: TreatmentItem[];
  x_pos: number;
  y_pos: number;
  width: number;
  height: number;
  orientation: 'vertical' | 'horizontal';
  owner_id?: string;
}

// ============================================
// 치료 이력(리포트) 인터페이스
// ============================================
export interface TreatmentHistory {
  id: string;
  client_name: string;
  body_part: string;
  client_memo?: string;
  visit_time: string;
  end_time?: string;
  completed_treatments: TreatmentItem[];
  incomplete_treatments: TreatmentItem[];
  status: string;
  created_at: string;
  owner_id?: string;
}

// ============================================
// 레이아웃 관련 인터페이스
// ============================================
export interface LayoutObject {
  id: string;
  object_type: LayoutObjectType;
  name?: string;
  x_pos: number;
  y_pos: number;
  width: number;
  height: number;
  rotation: number;
  z_index: number;
  owner_id?: string;
}

export interface LayoutSettings {
  id: string;
  canvas_width: number;
  canvas_height: number;
  zoom: number;
  owner_id?: string;
  updated_at?: string;
}

// ============================================
// 앱 상태 관련 타입
// ============================================
export interface CanvasSize {
  width: number;
  height: number;
}
