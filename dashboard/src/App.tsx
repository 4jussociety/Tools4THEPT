/**
 * 물리치료실 상황판 메인 앱 컴포넌트
 * 커스텀 훅과 하위 컴포넌트를 조합하여 전체 대시보드를 구성합니다.
 */

import { useState, useEffect } from 'react';
import { BedCard } from './components/BedCard';
import { BedModal } from './components/BedModal';
import { SettingsModal } from './components/SettingsModal';
import { TreatmentAddModal } from './components/TreatmentAddModal';
import { ReportTab } from './components/ReportTab';
import { LayoutObjectCard } from './components/LayoutObjectCard';
import { TransferClientModal } from './components/TransferClientModal';
import { FurniturePalette } from './components/FurniturePalette';
import { ZoomControls } from './components/ZoomControls';
import { AssignBedsModal } from './components/AssignBedsModal';
import { Portal } from './components/Portal';
import { ThePtLogo } from './components/ThePtLogo';
import { useAuth } from './hooks/useAuth';
import { useBeds } from './hooks/useBeds';
import { useLayoutEditor } from './hooks/useLayoutEditor';
import { useClientTransfer } from './hooks/useClientTransfer';
import { supabase } from './lib/supabase';
import { Settings, LayoutDashboard, FileText, Move, Save, RotateCw, Plus, Trash2, Home } from 'lucide-react';
import { Rnd } from 'react-rnd';
import { DndContext, DragOverlay, closestCenter } from '@dnd-kit/core';
import { StaffModeToolbar } from './components/StaffModeToolbar';

function App() {
  // ======== 커스텀 훅 ========
  const { session, isViewerMode, userMode, ownerId, isLoading: isAuthLoading } = useAuth();
  const { beds, setBeds, treatmentTypes, isLoading: isBedsLoading, handleUpdateBed, handleAddTreatment, refetchTreatmentTypes } = useBeds(ownerId, isViewerMode);
  const layout = useLayoutEditor(ownerId, beds, setBeds);
  const transfer = useClientTransfer(beds, setBeds);

  // ======== 로컬 UI 상태 ========
  const [selectedBedId, setSelectedBedId] = useState<string | null>(null);
  const [addTreatmentBedId, setAddTreatmentBedId] = useState<string | null>(null);
  const [transferSourceBedId, setTransferSourceBedId] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'report'>('dashboard');
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 모바일 전용 담당 베드 상태
  const [myBeds, setMyBeds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('my_assigned_beds') || '[]'); } catch { return []; }
  });
  const [isFilterMyBeds, setIsFilterMyBeds] = useState<boolean>(() => {
    return localStorage.getItem('is_filter_my_beds') === 'true';
  });
  const [isAssigningMyBeds, setIsAssigningMyBeds] = useState(false);

  // LocalStorage 자동 보존
  useEffect(() => { localStorage.setItem('my_assigned_beds', JSON.stringify(myBeds)); }, [myBeds]);
  useEffect(() => { localStorage.setItem('is_filter_my_beds', String(isFilterMyBeds)); }, [isFilterMyBeds]);

  // 뷰어 모드 초기 자동 맞춤
  useEffect(() => {
    if (isViewerMode && !isBedsLoading && beds.length > 0) {
      setTimeout(() => layout.handleAutoFit(), 400);
    }
  }, [isViewerMode, isBedsLoading, beds.length]);

  // ======== 포털(통합 로그인) 라우팅 ========
  const path = window.location.pathname;
  const isPortalPath = path === '/' || path === '/index.html' || path === '/login' || path === '/login/';
  if (isPortalPath) {
    return <Portal />;
  }

  // ======== 초기 로딩 가드 (auth 상태 확인 전 로그인 화면으로 튕기는 것 방지) ========
  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-bold">로딩 중...</p>
        </div>
      </div>
    );
  }

  // ======== 로그인 가드 (미로그인 시 통합계정 로그인으로 안내) ========
  if (!isViewerMode && !session) {
    return <Portal initialView="auth" />;
  }

  const selectedBed = beds.find(b => b.id === selectedBedId);

  return (
    <div className="min-h-screen bg-slate-100 p-2 sm:p-2.5 md:p-3">
      {/* ======== 헤더 ======== */}
      <header className="mb-2 md:mb-3 flex flex-col md:flex-row justify-between items-start md:items-center gap-2 md:gap-3 bg-white p-2 px-3 md:p-3 md:px-4 rounded-xl md:rounded-2xl shadow-sm border border-slate-200">
        <div className="flex flex-col gap-1.5 w-full md:w-auto">
          <div className="flex flex-row items-center justify-between md:justify-start gap-2 md:gap-4 w-full">
            <div className="flex items-center gap-1 sm:gap-2">
              <ThePtLogo className="text-slate-900" />
              <span className="text-xl md:text-3xl font-black text-slate-800 tracking-tight whitespace-nowrap">상황판</span>
            </div>
            <nav className="flex bg-slate-100 p-0.5 rounded-lg flex-shrink-0">
              <a
                href="/"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md font-bold text-xs md:text-sm transition-all whitespace-nowrap text-slate-500 hover:text-slate-700"
              >
                <Home size={16} className="md:w-[18px] md:h-[18px]" /> 포털 홈
              </a>
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-bold text-xs md:text-sm transition-all whitespace-nowrap ${activeTab === 'dashboard' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <LayoutDashboard size={16} className="md:w-[18px] md:h-[18px]" /> 상황판
              </button>
              <button
                onClick={() => setActiveTab('report')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-bold text-xs md:text-sm transition-all whitespace-nowrap ${activeTab === 'report' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <FileText size={16} className="md:w-[18px] md:h-[18px]" /> 리포트
              </button>
            </nav>
          </div>

          {/* 모드 배지 & 링크 복사 */}
          <div className="flex flex-col items-start gap-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              {userMode === 'viewer' ? (
                <>
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-[10px] md:text-xs font-black whitespace-nowrap">👁 뷰어 모드</span>
                  {session && (
                    <button
                      onClick={() => { window.location.href = '/app'; }}
                      className="text-[10px] bg-blue-50 border border-blue-100 text-blue-600 px-1.5 py-0.5 rounded font-black hover:bg-blue-100 transition-colors cursor-pointer"
                    >
                      ⚙️ 매니저 모드로 복귀
                    </button>
                  )}
                </>
              ) : userMode === 'staff' ? (
                <>
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-[10px] md:text-xs font-black whitespace-nowrap">🧑‍⚕️ 스태프 모드</span>
                  {session && (
                    <button
                      onClick={() => { window.location.href = '/app'; }}
                      className="text-[10px] bg-blue-50 border border-blue-100 text-blue-600 px-1.5 py-0.5 rounded font-black hover:bg-blue-100 transition-colors cursor-pointer"
                    >
                      ⚙️ 매니저 모드로 복귀
                    </button>
                  )}
                </>
              ) : (
                <>
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-800 border border-blue-200 rounded-lg text-[10px] md:text-xs font-black whitespace-nowrap">⚙️ 매니저 모드</span>
                  
                  {/* 직접 모드 전환 버튼 */}
                  <button
                    onClick={() => { window.location.href = `/app?mode=viewer&owner=${ownerId || ''}`; }}
                    className="text-[10px] bg-amber-50 border border-amber-100 text-amber-600 px-1.5 py-0.5 rounded font-black hover:bg-amber-100 transition-colors cursor-pointer"
                  >
                    👁 뷰어 모드 전환
                  </button>
                  <button
                    onClick={() => { window.location.href = `/app?mode=staff&owner=${ownerId || ''}`; }}
                    className="text-[10px] bg-emerald-50 border border-emerald-100 text-emerald-600 px-1.5 py-0.5 rounded font-black hover:bg-emerald-100 transition-colors cursor-pointer"
                  >
                    🧑‍⚕️ 스태프 모드 전환
                  </button>

                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(window.location.origin + `/app?mode=viewer&owner=${ownerId || ''}`);
                      alert('뷰어(읽기전용) 링크가 복사되었습니다!');
                    }}
                    className="text-left text-xs font-bold text-amber-500 hover:text-amber-700 transition-colors flex items-center gap-1 group w-max"
                  >
                    <span className="text-[10px] bg-amber-50 border border-amber-100 text-amber-600 px-1.5 py-0.5 rounded group-hover:bg-amber-100 font-black">🔗 뷰어링크 복사</span>
                  </button>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(window.location.origin + `/app?mode=staff&owner=${ownerId || ''}`);
                      alert('스태프(베드 조작 가능) 링크가 복사되었습니다!');
                    }}
                    className="text-left text-xs font-bold text-emerald-500 hover:text-emerald-700 transition-colors flex items-center gap-1 group w-max"
                  >
                    <span className="text-[10px] bg-emerald-50 border border-emerald-100 text-emerald-600 px-1.5 py-0.5 rounded group-hover:bg-emerald-100 font-black">🔗 스태프링크 복사</span>
                  </button>
                  <a href="https://thept.co.kr" target="_blank" rel="noopener noreferrer" className="text-left text-xs font-bold text-indigo-500 hover:text-indigo-700 transition-colors flex items-center gap-1 group w-max">
                    <span className="text-[10px] bg-indigo-50 border border-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded group-hover:bg-indigo-100 font-black">🌐 커뮤니티 바로가기</span>
                  </a>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6">
          {activeTab === 'dashboard' && userMode === 'manager' && (
            layout.isEditMode ? (
              <div className="flex gap-2 flex-shrink-0">
                <button onClick={() => layout.handleAddBed('GENERAL')} className="flex items-center gap-1.5 px-3 py-2 bg-blue-500 text-white rounded-xl font-bold hover:bg-blue-600 transition-all shadow-sm whitespace-nowrap text-sm">
                  <Plus size={16} /> 일반 베드 추가
                </button>
                <button onClick={() => layout.handleAddBed('SPECIAL')} className="flex items-center gap-1.5 px-3 py-2 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 transition-all shadow-sm whitespace-nowrap text-sm">
                  <Plus size={16} /> 치료 장비 추가
                </button>
                <button onClick={layout.toggleEditMode} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-300 transition-all shadow-sm whitespace-nowrap text-sm">
                  취소
                </button>
                <button onClick={layout.handleSaveLayout} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-all shadow-md active:scale-95 whitespace-nowrap">
                  <Save size={18} /> 배치 저장
                </button>
              </div>
            ) : (
              <button onClick={layout.toggleEditMode} className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all shadow-sm whitespace-nowrap flex-shrink-0" title="상황판 침대 배치를 변경합니다">
                <Move size={18} /> 배치 편집
              </button>
            )
          )}

          {userMode === 'manager' && (
            <button onClick={() => setIsSettingsOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-xl font-bold hover:bg-black transition-all shadow-md active:scale-95 whitespace-nowrap flex-shrink-0">
              <Settings size={18} /> 설정
            </button>
          )}

          {session && userMode === 'manager' && (
            <button onClick={() => supabase.auth.signOut()} className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors whitespace-nowrap">
              로그아웃
            </button>
          )}

          {userMode !== 'manager' && (
            <button
              onClick={() => {
                if (session) {
                  supabase.auth.signOut().then(() => {
                    window.location.href = '/';
                  });
                } else {
                  window.location.href = '/';
                }
              }}
              className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors whitespace-nowrap border border-slate-200 bg-white hover:bg-slate-50 rounded-xl shadow-sm cursor-pointer"
            >
              나가기
            </button>
          )}
        </div>
      </header>

      {/* ======== 스태프 모드 툴바 ======== */}
      {userMode === 'staff' && (
        <StaffModeToolbar
          beds={beds}
          myBeds={myBeds}
          isFilterMyBeds={isFilterMyBeds}
          setIsFilterMyBeds={setIsFilterMyBeds}
          onOpenAssignModal={() => setIsAssigningMyBeds(true)}
        />
      )}

      {/* ======== 메인 콘텐츠 ======== */}
      {activeTab === 'dashboard' ? (
        isBedsLoading ? (
          <div className="flex flex-col justify-center items-center h-64 text-slate-500 bg-white rounded-2xl border-2 border-dashed border-slate-200">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-3"></div>
            <p className="font-bold text-lg">데이터 로딩 중...</p>
          </div>
        ) : beds.length === 0 ? (
          <div className="flex flex-col justify-center items-center h-64 text-slate-500 bg-white rounded-2xl border-2 border-dashed border-slate-200">
            <p className="font-bold text-lg">등록된 베드가 없습니다.</p>
            <p className="text-sm text-slate-400 mt-1">페이지를 새로고침하거나 관리자에게 문의해 주세요.</p>
          </div>
        ) : userMode === 'staff' && isFilterMyBeds ? (
          /* 스태프 모드 - 담당 베드 그리드 */
          myBeds.length === 0 ? (
            <div className="flex-1 bg-white p-8 rounded-2xl border-2 border-dashed border-slate-200 text-center flex flex-col items-center justify-center gap-4 min-h-[300px]">
              <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
                <Settings size={32} />
              </div>
              <div className="flex flex-col gap-1">
                <p className="font-black text-lg text-slate-800">담당 베드가 지정되지 않았습니다</p>
                <p className="text-sm text-slate-500">⚙️ 구역 변경 단추를 눌러 전담 구역을 지정해 주세요.</p>
              </div>
              <button
                onClick={() => setIsAssigningMyBeds(true)}
                className="mt-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-md transition-all active:scale-95"
              >
                내 담당 구역 지정하기
              </button>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-3 bg-slate-200/50 rounded-2xl border border-slate-200 shadow-inner custom-scrollbar">
              <div className="grid grid-cols-2 gap-3 max-w-[480px] mx-auto w-full">
                {beds.filter(b => myBeds.includes(b.id)).map(bed => (
                  <div key={bed.id} className="w-full bg-white rounded-2xl shadow-sm border border-slate-200 relative overflow-hidden aspect-[11/16]">
                    <BedCard bed={bed} onUpdate={handleUpdateBed} onOpenModal={() => setSelectedBedId(bed.id)} onAddTreatmentClick={() => setAddTreatmentBedId(bed.id)} isEditMode={false} isViewerMode={false} forceVertical={true} isMobile={isMobile} onTransferClick={() => setTransferSourceBedId(bed.id)} />
                  </div>
                ))}
              </div>
            </div>
          )
        ) : (
          /* 일반 캔버스 모드 */
          <div className="relative flex-1 overflow-hidden bg-slate-200/50 rounded-2xl border border-slate-200 shadow-inner">
            <ZoomControls zoom={layout.zoom} setZoom={layout.setZoom} onAutoFit={layout.handleAutoFit} />
            {layout.isEditMode && <FurniturePalette onAddObject={layout.handleAddLayoutObject} />}

            <DndContext sensors={transfer.sensors} collisionDetection={closestCenter} onDragStart={transfer.handleDragStart} onDragEnd={transfer.handleDragEnd}>
              <div id="canvas-scroll-container" className="w-full h-full overflow-auto p-3 custom-scrollbar relative">
                <div style={{ width: (layout.isEditMode ? layout.canvasDraft.width : layout.canvasSize.width) * layout.zoom, height: (layout.isEditMode ? layout.canvasDraft.height : layout.canvasSize.height) * layout.zoom, transition: 'all 0.2s ease-out' }}>
                  <div style={{ transform: `scale(${layout.zoom})`, transformOrigin: '0 0', width: layout.isEditMode ? layout.canvasDraft.width : layout.canvasSize.width, height: layout.isEditMode ? layout.canvasDraft.height : layout.canvasSize.height }}>
                    {layout.isEditMode ? (
                      <Rnd
                        size={{ width: layout.canvasDraft.width, height: layout.canvasDraft.height }}
                        position={{ x: 0, y: 0 }}
                        disableDragging={true}
                        scale={layout.zoom}
                        onResizeStop={(_e, _direction, ref) => {
                          layout.setCanvasDraft({ width: parseInt(ref.style.width, 10), height: parseInt(ref.style.height, 10) });
                        }}
                        className="bg-white shadow-2xl border-2 border-blue-400 relative overflow-hidden"
                        style={{
                          backgroundImage: 'url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+PHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBmaWxsPSIjZmZmIi8+PHBhdGggZD0iTTQwIDBMMCAwTDAgNDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2YwZjBmMCIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9zdmc+")',
                          backgroundSize: '40px 40px',
                        }}
                      >
                        <div className="absolute top-2 right-2 bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-bold z-50 shadow-lg">
                          캔버스: {layout.canvasDraft.width} x {layout.canvasDraft.height}
                        </div>

                        {/* 가구 에디터 모드 */}
                        {layout.draftLayoutObjects.map(obj => (
                          <Rnd
                            key={obj.id}
                            bounds="parent"
                            size={{ width: obj.width, height: obj.height }}
                            position={{ x: obj.x_pos, y: obj.y_pos }}
                            scale={layout.zoom}
                            onDragStop={(_e, d) => layout.updateDraftLayoutObject(obj.id, { x_pos: d.x, y_pos: d.y })}
                            onResizeStop={(_e, _direction, ref, _delta, position) => {
                              layout.updateDraftLayoutObject(obj.id, { width: parseInt(ref.style.width, 10), height: parseInt(ref.style.height, 10), x_pos: position.x, y_pos: position.y });
                            }}
                            style={{ zIndex: obj.z_index }}
                            dragHandleClassName="drag-handle"
                            className="group"
                          >
                            <div className="absolute -top-10 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5 bg-white p-1 rounded-lg shadow-lg border border-slate-200 z-50 select-none">
                              {(obj.object_type === 'DESK' || obj.object_type === 'SOFA' || obj.object_type === 'PILLAR') && (
                                <input type="text" value={obj.name || ''} onChange={(e) => layout.updateDraftLayoutObject(obj.id, { name: e.target.value })} className="px-1.5 py-0.5 text-[11px] border border-slate-200 rounded w-20 font-bold text-slate-700 focus:outline-none focus:border-slate-500" placeholder="라벨명" />
                              )}
                              <button onClick={() => layout.changeZIndex(obj.id, 'up')} className="px-1.5 py-0.5 hover:bg-slate-100 rounded text-slate-600 text-[10px] font-bold" title="위로">UP</button>
                              <button onClick={() => layout.changeZIndex(obj.id, 'down')} className="px-1.5 py-0.5 hover:bg-slate-100 rounded text-slate-600 text-[10px] font-bold" title="아래로">DN</button>
                              <button onClick={() => layout.duplicateLayoutObject(obj.id)} className="p-1 hover:bg-slate-100 rounded text-slate-600" title="복제"><Plus size={14} /></button>
                              <button onClick={() => layout.handleDeleteLayoutObject(obj.id)} className="p-1 hover:bg-red-50 rounded text-red-500" title="삭제"><Trash2 size={14} /></button>
                            </div>
                            <div className="w-full h-full drag-handle cursor-move shadow-xl outline outline-2 outline-slate-400 outline-offset-2">
                              <LayoutObjectCard object={obj} isEditMode={true} />
                            </div>
                          </Rnd>
                        ))}

                        {/* 베드 에디터 모드 */}
                        {layout.layoutDraft.map(bed => (
                          <Rnd
                            key={bed.id}
                            bounds="parent"
                            size={{ width: bed.width, height: bed.height }}
                            position={{ x: bed.x_pos, y: bed.y_pos }}
                            scale={layout.zoom}
                            onDragStop={(_e, d) => layout.updateDraftLayout(bed.id, { x_pos: d.x, y_pos: d.y })}
                            enableResizing={false}
                            dragHandleClassName="drag-handle"
                            className="group"
                          >
                            <div className="absolute -top-10 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5 bg-white p-1 rounded-lg shadow-lg border border-slate-200 z-10 select-none">
                              {bed.bed_type === 'SPECIAL' && (
                                <input type="text" value={bed.bed_number} onChange={(e) => layout.updateDraftLayout(bed.id, { bed_number: e.target.value })} className="px-1.5 py-0.5 text-[11px] border border-purple-200 rounded w-20 font-bold text-purple-700 focus:outline-none focus:border-purple-500 bg-purple-50/50" placeholder="장비명" title="치료 장비명 변경" />
                              )}
                              <button onClick={() => layout.toggleDraftOrientation(bed.id)} className="p-1 hover:bg-slate-100 rounded text-slate-600" title="회전"><RotateCw size={14} /></button>
                              <button onClick={() => layout.handleDeleteBed(bed.id)} className="p-1 hover:bg-red-50 rounded text-red-500" title="삭제"><Trash2 size={14} /></button>
                            </div>
                            <div className="w-full h-full drag-handle cursor-move shadow-xl outline outline-2 outline-blue-400 outline-offset-2">
                              <BedCard bed={bed} onUpdate={handleUpdateBed} onOpenModal={() => {}} isEditMode={true} />
                            </div>
                          </Rnd>
                        ))}
                      </Rnd>
                    ) : (
                      <div className="bg-white shadow-sm border border-slate-200 relative" style={{ width: layout.canvasSize.width, height: layout.canvasSize.height }}>
                        {/* 가구 일반 모드 (배경) */}
                        {layout.layoutObjects.map(obj => (
                          <div key={obj.id} style={{ position: 'absolute', left: obj.x_pos, top: obj.y_pos, width: obj.width, height: obj.height, zIndex: obj.z_index, pointerEvents: 'none' }}>
                            <LayoutObjectCard object={obj} isEditMode={false} />
                          </div>
                        ))}

                        {/* 베드 일반 모드 */}
                        {beds.map(bed => (
                          <div key={bed.id} style={{ position: 'absolute', left: bed.x_pos, top: bed.y_pos, width: bed.width, height: bed.height }}>
                            <BedCard bed={bed} onUpdate={handleUpdateBed} onOpenModal={() => setSelectedBedId(bed.id)} onAddTreatmentClick={() => setAddTreatmentBedId(bed.id)} isEditMode={false} isViewerMode={userMode === 'viewer'} isMobile={isMobile} onTransferClick={() => setTransferSourceBedId(bed.id)} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <DragOverlay dropAnimation={null}>
                {transfer.activeDragBed ? (
                  <div style={{ width: transfer.activeDragBed.width, height: transfer.activeDragBed.height, transform: `scale(${layout.zoom})`, transformOrigin: '0 0' }}>
                    <BedCard bed={transfer.activeDragBed} onUpdate={() => {}} onOpenModal={() => {}} isEditMode={false} isDragOverlay={true} isViewerMode={userMode === 'viewer'} isMobile={isMobile} />
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          </div>
        )
      ) : (
        <ReportTab isViewerMode={isViewerMode} isStaffMode={userMode === 'staff'} ownerId={ownerId || ''} />
      )}

      {/* ======== 모달 레이어 ======== */}
      {selectedBed && (
        <BedModal bed={selectedBed} availableTreatments={treatmentTypes} onClose={() => setSelectedBedId(null)} onUpdate={handleUpdateBed} ownerId={ownerId || ''} />
      )}

      {addTreatmentBedId && (
        <TreatmentAddModal bed={beds.find(b => b.id === addTreatmentBedId)!} availableTreatments={treatmentTypes} onClose={() => setAddTreatmentBedId(null)} onAddTreatment={(tt) => { handleAddTreatment(addTreatmentBedId, tt); setAddTreatmentBedId(null); }} />
      )}

      {isSettingsOpen && (
        <SettingsModal onClose={() => setIsSettingsOpen(false)} onUpdateTypes={refetchTreatmentTypes} ownerId={ownerId || ''} />
      )}

      {isAssigningMyBeds && (
        <AssignBedsModal beds={beds} myBeds={myBeds} setMyBeds={setMyBeds} onClose={() => setIsAssigningMyBeds(false)} onComplete={() => { setIsAssigningMyBeds(false); setIsFilterMyBeds(true); }} />
      )}

      {transferSourceBedId && (
        <TransferClientModal
          beds={beds}
          sourceBedId={transferSourceBedId}
          isViewerMode={isViewerMode}
          onTransfer={(sourceId, targetId) => {
            transfer.handleManualTransfer(sourceId, targetId);
            setTransferSourceBedId(null);
          }}
          onClose={() => setTransferSourceBedId(null)}
        />
      )}


    </div>
  );
}

export default App;
