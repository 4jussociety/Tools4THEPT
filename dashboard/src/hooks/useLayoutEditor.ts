/**
 * 레이아웃 편집 모드 전체 상태 관리 커스텀 훅
 * 캔버스 크기, 베드 드래프트, 가구 드래프트, 편집 모드 토글, 저장을 담당합니다.
 */

import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { BedData, LayoutObject, LayoutObjectType, CanvasSize } from '../types';
import * as bedsApi from '../lib/api/beds';
import * as layoutApi from '../lib/api/layout';

export function useLayoutEditor(
  ownerId: string | null,
  beds: BedData[],
  setBeds: React.Dispatch<React.SetStateAction<BedData[]>>
) {
  const [canvasSize, setCanvasSize] = useState<CanvasSize>({ width: 2000, height: 1200 });
  const [zoom, setZoom] = useState(1);
  const [isEditMode, setIsEditMode] = useState(false);
  const [layoutObjects, setLayoutObjects] = useState<LayoutObject[]>([]);

  // 편집 모드 시의 임시 레이아웃 상태
  const [layoutDraft, setLayoutDraft] = useState<BedData[]>([]);
  const [draftLayoutObjects, setDraftLayoutObjects] = useState<LayoutObject[]>([]);
  const [deletedLayoutObjectIds, setDeletedLayoutObjectIds] = useState<string[]>([]);
  const [canvasDraft, setCanvasDraft] = useState<CanvasSize>({ width: 2000, height: 1200 });

  // 초기 데이터 로드
  useEffect(() => {
    if (!ownerId) return;

    const load = async () => {
      // Supabase 세션 정보가 헤더에 완전히 바인딩될 수 있도록 미세한 지연 시간(100ms)을 추가합니다.
      await new Promise(resolve => setTimeout(resolve, 100));

      // 레이아웃 설정 로드
      const { data: settingsData } = await layoutApi.fetchLayoutSettings(ownerId);
      if (settingsData) {
        setCanvasSize({ width: settingsData.canvas_width, height: settingsData.canvas_height });
        setCanvasDraft({ width: settingsData.canvas_width, height: settingsData.canvas_height });
        setZoom(settingsData.zoom || 1);
      }

      // 가구 오브젝트 로드
      const { data: objectsData } = await layoutApi.fetchLayoutObjects(ownerId);
      if (objectsData) {
        setLayoutObjects(objectsData);
      }
    };
    load();

    // Realtime 구독
    const configChannel = supabase
      .channel(`layout_settings:${ownerId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'layout_settings', filter: `owner_id=eq.${ownerId}` }, (payload) => {
        const newConfig = payload.new as { canvas_width: number; canvas_height: number; zoom?: number };
        setCanvasSize({ width: newConfig.canvas_width, height: newConfig.canvas_height });
        setZoom(newConfig.zoom || 1);
      })
      .subscribe();

    const layoutObjectsChannel = supabase
      .channel(`layout_objects:${ownerId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'layout_objects', filter: `owner_id=eq.${ownerId}` }, async () => {
        const { data } = await layoutApi.fetchLayoutObjects(ownerId);
        if (data) setLayoutObjects(data);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(configChannel);
      supabase.removeChannel(layoutObjectsChannel);
    };
  }, [ownerId]);

  const toggleEditMode = useCallback(() => {
    if (!isEditMode) {
      setLayoutDraft(JSON.parse(JSON.stringify(beds)));
      setDraftLayoutObjects(JSON.parse(JSON.stringify(layoutObjects)));
      setDeletedLayoutObjectIds([]);
      setCanvasDraft({ ...canvasSize });
    }
    setIsEditMode(!isEditMode);
  }, [isEditMode, beds, layoutObjects, canvasSize]);

  const handleSaveLayout = useCallback(async () => {
    if (!ownerId) return;
    setIsEditMode(false);

    // Optimistic UI update
    setBeds(layoutDraft);
    setLayoutObjects(draftLayoutObjects);
    setCanvasSize(canvasDraft);

    // DB Update - Canvas Size & Zoom
    await layoutApi.updateLayoutSettings(ownerId, {
      canvas_width: canvasDraft.width,
      canvas_height: canvasDraft.height,
      zoom: zoom,
    });

    // 삭제된 베드 처리
    const draftIds = layoutDraft.map(b => b.id);
    const deletedBeds = beds.filter(b => !draftIds.includes(b.id));
    for (const bed of deletedBeds) {
      const { error } = await bedsApi.deleteBed(bed.id, ownerId);
      if (error) console.error('Bed Delete DB Error:', error);
    }

    // 베드 Upsert
    for (const bed of layoutDraft) {
      const { error } = await bedsApi.upsertBed(bed, ownerId);
      if (error) console.error('Beds Upsert DB Error:', error);
    }

    // 삭제된 가구 처리
    if (deletedLayoutObjectIds.length > 0) {
      for (const id of deletedLayoutObjectIds) {
        const { error } = await layoutApi.deleteLayoutObject(id, ownerId);
        if (error) console.error('LayoutObject Delete DB Error:', error);
      }
      setDeletedLayoutObjectIds([]);
    }

    // 가구 Upsert
    for (const obj of draftLayoutObjects) {
      const { error } = await layoutApi.upsertLayoutObject(obj, ownerId);
      if (error) console.error('LayoutObject Upsert DB Error:', error);
    }
  }, [ownerId, layoutDraft, draftLayoutObjects, canvasDraft, zoom, beds, deletedLayoutObjectIds, setBeds]);

  const handleAddBed = useCallback((type: 'GENERAL' | 'SPECIAL') => {
    let bedNumber = '';
    if (type === 'GENERAL') {
      const allNumbers = layoutDraft
        .filter(b => b.bed_type === 'GENERAL' || !b.bed_type)
        .map(b => parseInt(b.bed_number, 10))
        .filter(n => !isNaN(n));
      let nextNumber = 1;
      while (allNumbers.includes(nextNumber)) {
        nextNumber++;
      }
      bedNumber = String(nextNumber);
    } else {
      const specialCount = layoutDraft.filter(b => b.bed_type === 'SPECIAL').length;
      bedNumber = `치료 장비 ${specialCount + 1}`;
    }

    const newBed: BedData = {
      id: `bed-${Date.now()}`,
      bed_number: bedNumber,
      bed_type: type,
      status: 'EMPTY',
      treatments: [],
      x_pos: Math.max(0, canvasDraft.width / 2 - 110),
      y_pos: Math.max(0, canvasDraft.height / 2 - 160),
      width: 220,
      height: 320,
      orientation: 'vertical',
      owner_id: ownerId || undefined,
    };
    setLayoutDraft(prev => [...prev, newBed]);
  }, [layoutDraft, canvasDraft, ownerId]);

  const handleDeleteBed = useCallback((id: string) => {
    const bedToDelete = layoutDraft.find(b => b.id === id);
    if (!bedToDelete) return;

    const hasClient = bedToDelete.status !== 'EMPTY';
    const confirmMessage = hasClient
      ? `${bedToDelete.bed_number}번 베드에는 현재 고객(${bedToDelete.client_name})이 배정되어 있습니다. 삭제하면 고객 데이터가 함께 소실됩니다. 정말 삭제하시겠습니까?`
      : `${bedToDelete.bed_number}번 베드를 정말 삭제하시겠습니까?`;

    if (window.confirm(confirmMessage)) {
      if (hasClient && !window.confirm("정말로 고객이 있는 베드를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.")) {
        return;
      }
      setLayoutDraft(prev => prev.filter(b => b.id !== id));
    }
  }, [layoutDraft]);

  const updateDraftLayout = useCallback((id: string, updates: Partial<BedData>) => {
    const roundedUpdates = { ...updates };
    if (roundedUpdates.x_pos !== undefined) roundedUpdates.x_pos = Math.round(roundedUpdates.x_pos);
    if (roundedUpdates.y_pos !== undefined) roundedUpdates.y_pos = Math.round(roundedUpdates.y_pos);
    if (roundedUpdates.width !== undefined) roundedUpdates.width = Math.round(roundedUpdates.width);
    if (roundedUpdates.height !== undefined) roundedUpdates.height = Math.round(roundedUpdates.height);

    setLayoutDraft(current => current.map(b => b.id === id ? { ...b, ...roundedUpdates } : b));
  }, []);

  const toggleDraftOrientation = useCallback((id: string) => {
    setLayoutDraft(current => current.map(b => {
      if (b.id === id) {
        return {
          ...b,
          orientation: b.orientation === 'vertical' ? 'horizontal' : 'vertical',
          width: b.height,
          height: b.width,
        };
      }
      return b;
    }));
  }, []);

  // --- 가구/구조물 편집 ---
  const handleAddLayoutObject = useCallback((type: LayoutObjectType) => {
    const defaultDims = {
      WALL: { w: 300, h: 24 },
      PILLAR: { w: 80, h: 80 },
      DESK: { w: 200, h: 80 },
      SOFA: { w: 160, h: 60 },
      DOOR: { w: 80, h: 80 },
    };
    const dims = defaultDims[type];

    const newObj: LayoutObject = {
      id: `obj-${Date.now()}`,
      object_type: type,
      x_pos: Math.round(Math.max(0, canvasDraft.width / 2 - dims.w / 2)),
      y_pos: Math.round(Math.max(0, canvasDraft.height / 2 - dims.h / 2)),
      width: dims.w,
      height: dims.h,
      rotation: 0,
      z_index: type === 'WALL' ? 5 : 10,
      owner_id: ownerId || undefined,
    };
    setDraftLayoutObjects(prev => [...prev, newObj]);
  }, [canvasDraft, ownerId]);

  const updateDraftLayoutObject = useCallback((id: string, updates: Partial<LayoutObject>) => {
    const roundedUpdates = { ...updates };
    if (roundedUpdates.x_pos !== undefined) roundedUpdates.x_pos = Math.round(roundedUpdates.x_pos);
    if (roundedUpdates.y_pos !== undefined) roundedUpdates.y_pos = Math.round(roundedUpdates.y_pos);
    if (roundedUpdates.width !== undefined) roundedUpdates.width = Math.round(roundedUpdates.width);
    if (roundedUpdates.height !== undefined) roundedUpdates.height = Math.round(roundedUpdates.height);

    setDraftLayoutObjects(current => current.map(o => o.id === id ? { ...o, ...roundedUpdates } : o));
  }, []);

  const handleDeleteLayoutObject = useCallback((id: string) => {
    setDraftLayoutObjects(current => current.filter(o => o.id !== id));
    if (layoutObjects.find(o => o.id === id)) {
      setDeletedLayoutObjectIds(prev => [...prev, id]);
    }
  }, [layoutObjects]);

  const changeZIndex = useCallback((id: string, direction: 'up' | 'down') => {
    setDraftLayoutObjects(current => current.map(o => {
      if (o.id === id) {
        return { ...o, z_index: o.z_index + (direction === 'up' ? 1 : -1) };
      }
      return o;
    }));
  }, []);

  const duplicateLayoutObject = useCallback((id: string) => {
    const objToCopy = draftLayoutObjects.find(o => o.id === id);
    if (!objToCopy) return;
    const newObj = {
      ...objToCopy,
      id: `obj-${Date.now()}`,
      x_pos: objToCopy.x_pos + 20,
      y_pos: objToCopy.y_pos + 20,
    };
    setDraftLayoutObjects(prev => [...prev, newObj]);
  }, [draftLayoutObjects]);

  const handleAutoFit = useCallback(() => {
    const container = document.getElementById('canvas-scroll-container');
    if (!container) return;

    const targetW = container.clientWidth - 64;
    const targetH = container.clientHeight - 64;

    const currentW = isEditMode ? canvasDraft.width : canvasSize.width;
    const currentH = isEditMode ? canvasDraft.height : canvasSize.height;

    if (currentW <= 0 || currentH <= 0) return;

    const scaleX = targetW / currentW;
    const scaleY = targetH / currentH;
    const fitScale = Math.min(scaleX, scaleY);

    setZoom(Math.max(0.1, Math.min(2, Math.round(fitScale * 100) / 100)));
  }, [isEditMode, canvasDraft, canvasSize]);

  return {
    canvasSize,
    canvasDraft,
    setCanvasDraft,
    zoom,
    setZoom,
    isEditMode,
    layoutObjects,
    layoutDraft,
    draftLayoutObjects,
    toggleEditMode,
    handleSaveLayout,
    handleAddBed,
    handleDeleteBed,
    updateDraftLayout,
    toggleDraftOrientation,
    handleAddLayoutObject,
    updateDraftLayoutObject,
    handleDeleteLayoutObject,
    changeZIndex,
    duplicateLayoutObject,
    handleAutoFit,
  };
}
