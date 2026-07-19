import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Sparkles, History, Search, MessageSquare, Share2, Printer, ChevronDown } from 'lucide-react';
import { AudioUploadForm } from './components/AudioUploadForm';
import { ManualTherapyRecordForm } from './components/ManualTherapyRecordForm';
import { ClinicalSoapChart } from './components/ClinicalSoapChart';
import ClientChartingHistoryPanel from '../clients/ClientChartingHistoryPanel';
import type { SessionResult } from './types/charting';
import clsx from 'clsx';

interface ChatMessage {
  speaker: string;
  text: string;
}

function parseTranscript(text: string): ChatMessage[] {
  if (!text) return [];
  const lines = text.split('\n');
  const messages: ChatMessage[] = [];
  let currentSpeaker = '';
  let currentText: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('[화자 ') && trimmed.endsWith(']')) {
      if (currentSpeaker && currentText.length > 0) {
        messages.push({ speaker: currentSpeaker, text: currentText.join('\n').trim() });
      }
      currentSpeaker = trimmed.substring(5, trimmed.length - 1);
      currentText = [];
    } else if (trimmed) {
      currentText.push(trimmed);
    }
  }
  if (currentSpeaker && currentText.length > 0) {
    messages.push({ speaker: currentSpeaker, text: currentText.join('\n').trim() });
  }
  if (messages.length === 0 && text.trim()) {
    messages.push({ speaker: '1', text: text.trim() });
  }
  return messages;
}

export default function ChartingPage() {
  const [searchParams] = useSearchParams();
  const clientId = searchParams.get('client_id') || searchParams.get('clientId') || undefined;
  const initialTab = searchParams.get('tab') as 'upload' | 'manual-therapy' | 'soap' | 'history' | null;
  const appointmentId = searchParams.get('appointment_id') || undefined;
  const therapyDate = searchParams.get('date') || undefined;
  const therapyTime = searchParams.get('time') || undefined;
  
  // 중앙 영역 결과 확인용 서브 탭 상태
  const [activeTab, setActiveTab] = useState<'manual-therapy' | 'soap'>('manual-therapy');
  const [sessionResult, setSessionResult] = useState<SessionResult | null>(null);

  return (
    <div className="max-w-8xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Top Header */}
      <div className="bg-gradient-to-r from-gray-900 via-indigo-950 to-gray-900 rounded-2xl p-5 text-white shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="bg-indigo-500/20 text-indigo-300 text-xs font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider border border-indigo-500/30 inline-block mb-2">
            AI Clinical Charting Dashboard
          </span>
          <h1 className="text-xl md:text-2xl font-black flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-indigo-400" />
            <span>AI 음성 차팅 및 대시보드</span>
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            환자 히스토리와 오늘 세션의 AI 분석 결과(SOAP 차트, 재활기록, 가이드)를 원화면 스플릿 뷰로 즉시 모니터링합니다.
          </p>
        </div>
      </div>

      {/* Main Grid Container: 3분할 스플릿 뷰 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* [1] 좌측: 과거 기록 퀵 패널 (lg:col-span-3) */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3">
            <h3 className="text-xs font-black text-gray-900 flex items-center gap-1.5 border-b border-gray-100 pb-2">
              <History className="w-4 h-4 text-indigo-500" />
              <span>최근 차팅 히스토리 퀵패널</span>
            </h3>
            {clientId ? (
              <ClientChartingHistoryPanel clientId={clientId} />
            ) : (
              <div className="py-12 text-center text-xs text-gray-400 font-bold bg-gray-50 rounded-xl border border-dashed border-gray-200">
                <p>선택된 고객이 없습니다.</p>
                <p className="text-[10px] text-gray-400 font-medium mt-1">고객정보 연동 시 과거 이력이 여기에 표시됩니다.</p>
              </div>
            )}
          </div>
        </div>

        {/* [2] 중앙: 녹음 등록 & 오늘의 임상 분석 결과 (lg:col-span-5) */}
        <div className="lg:col-span-5 space-y-4">
          {/* 오디오 업로드 폼 */}
          <AudioUploadForm
            clientId={clientId}
            appointmentId={appointmentId}
            therapyDate={therapyDate}
            therapyTime={therapyTime}
            onAnalysisCompleted={(res) => {
              setSessionResult(res);
              setActiveTab('manual-therapy');
            }}
          />

          {/* 오늘 분석 결과 영역 */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="flex justify-between items-center border-b border-gray-200 bg-gray-50/50 px-4 py-2">
              <span className="text-xs font-black text-gray-900">오늘의 진료/재활 결과</span>
              <div className="flex bg-slate-200/80 p-0.5 rounded-lg">
                <button
                  onClick={() => setActiveTab('manual-therapy')}
                  disabled={!sessionResult}
                  className={clsx(
                    "px-2.5 py-1.5 rounded-md font-bold text-[10px] transition-all cursor-pointer disabled:opacity-40",
                    activeTab === 'manual-therapy' ? "bg-white text-indigo-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                  )}
                >
                  도수재활 기록지
                </button>
                <button
                  onClick={() => setActiveTab('soap')}
                  disabled={!sessionResult}
                  className={clsx(
                    "px-2.5 py-1.5 rounded-md font-bold text-[10px] transition-all cursor-pointer disabled:opacity-40",
                    activeTab === 'soap' ? "bg-white text-indigo-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                  )}
                >
                  임상 SOAP 차트
                </button>
              </div>
            </div>

            <div className="p-4">
              {!sessionResult ? (
                <div className="text-center py-12 text-gray-400 space-y-2">
                  <Sparkles className="w-8 h-8 mx-auto text-indigo-400 animate-pulse" />
                  <p className="text-xs font-semibold text-gray-600">음성 녹음 및 추가 메모를 등록해 주세요.</p>
                  <p className="text-[10px] text-gray-400">분석이 완성되면 도수재활세션 기록지와 임상 SOAP 차트가 이곳에 나타납니다.</p>
                </div>
              ) : activeTab === 'manual-therapy' ? (
                <ManualTherapyRecordForm sessionResult={sessionResult} />
              ) : (
                <ClinicalSoapChart
                  chartData={sessionResult.chart_data}
                  guideContent={sessionResult.guide_content}
                  refinedTranscript={sessionResult.refined_transcript}
                />
              )}
            </div>
          </div>
        </div>

        {/* [3] 우측: AI Insights & Share (lg:col-span-4) */}
        <div className="lg:col-span-4 space-y-4">
          {sessionResult ? (
            <>
              {/* 환자 케어 가이드 카드 */}
              {sessionResult.guide_content && (
                <div className="bg-amber-50/30 rounded-xl border border-amber-200 shadow-sm p-4 space-y-3">
                  <div className="flex justify-between items-center border-b border-amber-100 pb-2">
                    <h3 className="text-xs font-black text-amber-900 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-amber-500 animate-pulse" />
                      <span>📋 환자용 홈 케어 가이드</span>
                    </h3>
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(sessionResult.guide_content);
                          alert('가이드가 클립보드에 복사되었습니다.');
                        }}
                        className="p-1 text-amber-700 hover:bg-amber-100 rounded-md transition cursor-pointer"
                        title="복사"
                      >
                        <Share2 size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-amber-100/30 text-xs text-gray-700 leading-relaxed font-medium whitespace-pre-wrap">
                    {sessionResult.guide_content}
                  </div>
                </div>
              )}

              {/* 정제된 대화 챗 버블 */}
              {sessionResult.refined_transcript && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3">
                  <h3 className="text-xs font-black text-indigo-950 flex items-center gap-1.5 border-b border-gray-100 pb-2">
                    <MessageSquare className="w-4 h-4 text-indigo-500" />
                    <span>💬 정제된 대화 기록 (화자 분리)</span>
                  </h3>
                  <div className="bg-slate-50/50 rounded-lg p-3 border border-slate-100 max-h-[300px] overflow-y-auto space-y-3.5 custom-scrollbar">
                    {parseTranscript(sessionResult.refined_transcript).map((msg, idx) => {
                      const isInstructor = msg.speaker === '1' || msg.speaker.includes('치료사') || msg.speaker.includes('선생님');
                      return (
                        <div 
                          key={idx} 
                          className={clsx(
                            "flex flex-col max-w-[85%] text-[11px] p-2.5 rounded-xl leading-normal shadow-sm",
                            isInstructor 
                              ? "bg-indigo-50 border border-indigo-100/60 text-indigo-950 mr-auto rounded-tl-none" 
                              : "bg-emerald-50 border border-emerald-100/60 text-emerald-950 ml-auto rounded-tr-none"
                          )}
                        >
                          <span className="font-extrabold text-[8px] opacity-60 mb-0.5">
                            {isInstructor ? '👨‍⚕️ 치료사' : '👤 고객'}
                          </span>
                          <span className="font-medium whitespace-pre-wrap">{msg.text}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 text-center py-16 text-gray-400 space-y-2">
              <Sparkles className="w-8 h-8 mx-auto text-gray-300 animate-pulse" />
              <p className="text-xs font-bold text-gray-500">AI 분석이 시작되면</p>
              <p className="text-[10px] text-gray-400 leading-normal">정제된 대화 말풍선 기록과 환자용 홈 케어 가이드가 여기에 즉시 나타납니다.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
