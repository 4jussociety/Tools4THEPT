import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { format, parseISO } from 'date-fns';
import { Loader2, Clock, ChevronDown, ChevronUp, Sparkles, User, X, MessageSquare, HeartPulse } from 'lucide-react';
import clsx from 'clsx';

type Props = {
  clientId: string;
};

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

function VasGauge({ val, label, color = 'bg-indigo-500' }: { val: number; label: string; color?: string }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[9px] font-black text-gray-500">
        <span>{label}</span>
        <span className="font-mono text-gray-700 font-extrabold">{val}/10</span>
      </div>
      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200 flex">
        <div 
          className={clsx("h-full rounded-full transition-all duration-500", color)} 
          style={{ width: `${Math.min(100, Math.max(0, (val / 10) * 100))}%` }} 
        />
      </div>
    </div>
  );
}

export default function ClientChartingHistoryPanel({ clientId }: Props) {
  const [sessions, setSessions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);

  const fetchHistory = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select('*, results(*)')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setSessions(data);
      }
    } catch (err) {
      console.error('AI 차팅 이력 조회 실패:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [clientId]);

  const toggleExpand = (id: string) => {
    setExpandedSessionId(expandedSessionId === id ? null : id);
  };

  if (isLoading) {
    return (
      <div className="py-8 flex justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="py-12 text-center text-xs text-gray-400 font-bold bg-gray-50 rounded-xl border border-gray-100 border-dashed space-y-2">
        <Sparkles className="w-6 h-6 mx-auto text-gray-300 animate-pulse" />
        <p>저장된 AI 임상 차트 기록이 없습니다.</p>
        <p className="text-[10px] text-gray-400 font-medium">AI 음성 차팅 메뉴에서 이 고객을 지정하고 분석을 진행해 주세요.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1 custom-scrollbar">
      {sessions.map((session) => {
        const dateStr = format(parseISO(session.created_at), 'yyyy년 MM월 dd일 HH:mm');
        const durationMin = Math.floor(session.duration / 60);
        const durationSec = session.duration % 60;
        const result = session.results?.[0]; // 1:1 관계 결과 데이터
        const chartData = result?.chart_data || {};
        const mtRecord = chartData?.manual_rehab_record || chartData?.manual_therapy_record || {};
        const soapRecord = chartData?.clinical_record || {};
        const isExpanded = expandedSessionId === session.id;

        // 대화 기록 토글 상태를 개별 세션별로 관리하기 위한 로컬 상태는 불가능하므로, 
        // 챗 뷰어를 기본으로 노출하거나 혹은 컴포넌트 내부 접기/펴기 상태로 노출합니다.
        // 여기서는 아코디언 내부에 추가 서브 섹션으로 "대화 정제본 보기" 접이식 요소를 만듭니다.
        return (
          <div key={session.id} className="border border-gray-100 rounded-xl p-3 bg-white hover:border-indigo-200 transition shadow-sm space-y-2">
            <div className="flex justify-between items-start cursor-pointer" onClick={() => toggleExpand(session.id)}>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <span className="bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded text-[9px] font-black tracking-wider uppercase">
                    {session.profession?.toUpperCase() || 'PT'}
                  </span>
                  <span className="text-xs font-black text-gray-800">{dateStr}</span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-gray-400 font-bold">
                  <span className="flex items-center gap-0.5"><Clock size={11} /> {durationMin > 0 ? `${durationMin}분 ` : ''}{durationSec}초</span>
                  {session.status === 'completed' && <span className="text-green-600 font-black">AI 분석완료</span>}
                </div>
              </div>
              <button className="text-gray-400 hover:text-gray-600 p-0.5 cursor-pointer">
                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
            </div>

            {/* 수기기록 메모 */}
            {session.memo && (
              <div className="bg-slate-50 rounded-lg p-2.5 text-[11px] text-gray-600 leading-relaxed whitespace-pre-wrap">
                <span className="font-bold text-gray-700 block mb-0.5 text-[10px]">📝 추가 메모</span>
                {session.memo}
              </div>
            )}

            {/* 상세 펼침 영역 */}
            {isExpanded && result && (
              <div className="pt-2 border-t border-dashed border-slate-100 space-y-3.5 animate-in slide-in-from-top-1 duration-200">
                {/* 1. 도수재활세션 시행 기록 (Manual Rehab Record) */}
                {((mtRecord.techniques?.selected?.length > 0) || mtRecord.diagnosis) && (
                  <div className="bg-indigo-50/30 rounded-lg p-3 border border-indigo-100/50 space-y-3">
                    <h5 className="text-[11px] font-black text-indigo-900 flex items-center gap-1">💆‍♂️ 도수재활세션 시행 기록</h5>
                    <div className="grid grid-cols-2 gap-3 text-[10px]">
                      <div>
                        <span className="text-gray-400 block font-bold">진단명/부위</span>
                        <span className="text-gray-800 font-bold">{mtRecord.diagnosis || '경추부 통증 및 ROM 제한'}</span>
                      </div>
                      {mtRecord.cumulative_count !== undefined && (
                        <div>
                          <span className="text-gray-400 block font-bold">누적 세션 횟수</span>
                          <span className="text-gray-800 font-bold">{mtRecord.cumulative_count}회차</span>
                        </div>
                      )}
                      {mtRecord.techniques?.selected?.length > 0 && (
                        <div className="col-span-2">
                          <span className="text-gray-400 block font-bold">적용 기법</span>
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {mtRecord.techniques.selected.map((tech: string, i: number) => (
                              <span key={i} className="bg-indigo-100/80 text-indigo-700 font-black px-1.5 py-0.5 rounded text-[9px]">
                                {tech}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {mtRecord.treatment_regions?.length > 0 && (
                        <div className="col-span-2">
                          <span className="text-gray-400 block font-bold">재활 부위</span>
                          <span className="text-gray-800 font-bold">{mtRecord.treatment_regions.join(', ')}</span>
                        </div>
                      )}
                      
                      {/* VAS 평가 시각화 */}
                      {mtRecord.evaluation && (
                        <div className="col-span-2 bg-white/70 p-2.5 rounded-lg border border-indigo-100/20 space-y-2">
                          <div className="grid grid-cols-2 gap-3">
                            <VasGauge 
                              val={mtRecord.evaluation.pre_treatment?.pain_scale ?? 0} 
                              label="세션 전 통증 (VAS)" 
                              color="bg-amber-500" 
                            />
                            <VasGauge 
                              val={mtRecord.evaluation.post_treatment?.pain_scale ?? 0} 
                              label="세션 후 통증 (VAS)" 
                              color="bg-emerald-500" 
                            />
                          </div>
                          {mtRecord.evaluation.post_treatment?.client_reaction && (
                            <div className="pt-1.5 border-t border-slate-100 text-[10px]">
                              <span className="text-gray-400 block font-bold">재활세션 후 고객 반응</span>
                              <span className="text-gray-700 font-medium">{mtRecord.evaluation.post_treatment.client_reaction}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 2. 임상 SOAP 차트 (4분할 격자형 대시보드 구조) */}
                {Object.keys(soapRecord).length > 0 && (
                  <div className="bg-emerald-50/30 rounded-lg p-3 border border-emerald-100/50 space-y-2">
                    <h5 className="text-[11px] font-black text-emerald-900 flex items-center gap-1">🔬 임상 SOAP 진료 노트</h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[10px]">
                      <div className="bg-white/80 p-2 rounded-lg border border-emerald-100/10">
                        <span className="text-emerald-700 font-black block border-b border-emerald-100/30 pb-0.5 mb-1">S (주관적 호소)</span>
                        <p className="text-gray-700 leading-relaxed">
                          {soapRecord.subjective?.pain_description || soapRecord.subjective?.main_complaint || soapRecord.subjective?.chief_complaint || '-'}
                        </p>
                      </div>
                      <div className="bg-white/80 p-2 rounded-lg border border-emerald-100/10">
                        <span className="text-emerald-700 font-black block border-b border-emerald-100/30 pb-0.5 mb-1">O (객관적 평가)</span>
                        <p className="text-gray-700 leading-relaxed">
                          {soapRecord.objective?.physical_exam || soapRecord.objective?.physical_examination || soapRecord.objective?.observation_posture || '-'}
                        </p>
                      </div>
                      <div className="bg-white/80 p-2 rounded-lg border border-emerald-100/10">
                        <span className="text-emerald-700 font-black block border-b border-emerald-100/30 pb-0.5 mb-1">A (임상 추정)</span>
                        <p className="text-gray-700 leading-relaxed">
                          {soapRecord.assessment?.therapist_diagnosis || soapRecord.assessment?.ai_diagnosis_inferred || soapRecord.assessment?.clinical_impression || '-'}
                        </p>
                      </div>
                      <div className="bg-white/80 p-2 rounded-lg border border-emerald-100/10">
                        <span className="text-emerald-700 font-black block border-b border-emerald-100/30 pb-0.5 mb-1">P (향후 계획)</span>
                        <p className="text-gray-700 leading-relaxed">
                          {soapRecord.plan?.next_plan || soapRecord.plan?.treatment_performed || soapRecord.plan?.future_plan || '-'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. 환자용 홈 케어 가이드 */}
                {result.guide_content && (
                  <div className="bg-amber-50/40 rounded-lg p-3 border border-amber-100 space-y-2">
                    <h5 className="text-[11px] font-black text-amber-900 flex items-center gap-1">📋 환자용 홈 케어 가이드</h5>
                    <div className="bg-white/80 p-2.5 rounded-lg border border-amber-100/30 text-[10px] text-gray-700 leading-relaxed whitespace-pre-wrap font-medium">
                      {result.guide_content}
                    </div>
                  </div>
                )}

                {/* 4. 정제된 대화 텍스트 (화자 분리 챗 버블) */}
                {result.refined_transcript && (
                  <div className="space-y-1.5">
                    <details className="group/details">
                      <summary className="text-[10px] text-indigo-600 hover:text-indigo-800 font-black cursor-pointer list-none flex items-center gap-1 select-none">
                        <MessageSquare size={12} />
                        <span>정제된 대화 기록 보기</span>
                        <ChevronDown size={12} className="transition-transform group-open/details:rotate-180" />
                      </summary>
                      <div className="mt-2 bg-slate-50 rounded-lg p-2.5 border border-slate-100 max-h-[220px] overflow-y-auto space-y-2 custom-scrollbar">
                        {parseTranscript(result.refined_transcript).map((msg, idx) => {
                          const isInstructor = msg.speaker === '1' || msg.speaker.includes('치료사') || msg.speaker.includes('선생님');
                          return (
                            <div 
                              key={idx} 
                              className={clsx(
                                "flex flex-col max-w-[85%] text-[10px] p-2 rounded-xl leading-normal",
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
                    </details>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
