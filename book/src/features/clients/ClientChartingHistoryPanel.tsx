import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { format, parseISO } from 'date-fns';
import { Loader2, Clock, ChevronDown, ChevronUp, Sparkles, User, X } from 'lucide-react';

type Props = {
  clientId: string;
};

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
        const mtRecord = chartData?.manual_therapy_record || {};
        const soapRecord = chartData?.clinical_record || {};
        const isExpanded = expandedSessionId === session.id;

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
                {/* 1. 도수재활세션 시행 기록 (Manual Therapy Record) */}
                {mtRecord.techniques?.selected?.length > 0 && (
                  <div className="bg-indigo-50/30 rounded-lg p-3 border border-indigo-100/50 space-y-2">
                    <h5 className="text-[11px] font-black text-indigo-900 flex items-center gap-1">💆‍♂️ 도수재활세션 시행 기록</h5>
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
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
                      {mtRecord.treatment_regions?.length > 0 && (
                        <div className="col-span-2">
                          <span className="text-gray-400 block font-bold">재활 부위</span>
                          <span className="text-gray-800 font-bold">{mtRecord.treatment_regions.join(', ')}</span>
                        </div>
                      )}
                      {mtRecord.evaluation && (
                        <div className="col-span-2 grid grid-cols-2 gap-2 bg-white/70 p-2 rounded border border-indigo-100/20 mt-1">
                          <div>
                            <span className="text-gray-400 block font-bold">세션 전 VAS</span>
                            <span className="text-amber-600 font-black text-xs">{mtRecord.evaluation.pre_treatment?.pain_scale ?? '-'} / 10</span>
                          </div>
                          <div>
                            <span className="text-gray-400 block font-bold">세션 후 VAS</span>
                            <span className="text-emerald-600 font-black text-xs">{mtRecord.evaluation.post_treatment?.pain_scale ?? '-'} / 10</span>
                          </div>
                          {mtRecord.evaluation.post_treatment?.client_reaction && (
                            <div className="col-span-2">
                              <span className="text-gray-400 block font-bold">재활세션 후 고객 반응</span>
                              <span className="text-gray-700 font-medium">{mtRecord.evaluation.post_treatment.client_reaction}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 2. 임상 SOAP 차트 */}
                {Object.keys(soapRecord).length > 0 && (
                  <div className="bg-emerald-50/30 rounded-lg p-3 border border-emerald-100/50 space-y-2">
                    <h5 className="text-[11px] font-black text-emerald-900 flex items-center gap-1">🔬 임상 SOAP 진료 노트</h5>
                    <div className="space-y-1.5 text-[10px]">
                      {soapRecord.subjective && (
                        <div>
                          <span className="text-emerald-700 font-black">S (주관적 호소)</span>
                          <p className="text-gray-700 pl-1">{soapRecord.subjective.pain_description || soapRecord.subjective.main_complaint || '-'}</p>
                        </div>
                      )}
                      {soapRecord.objective && (
                        <div>
                          <span className="text-emerald-700 font-black">O (객관적 평가)</span>
                          <p className="text-gray-700 pl-1">{soapRecord.objective.physical_exam || '-'}</p>
                        </div>
                      )}
                      {soapRecord.assessment && (
                        <div>
                          <span className="text-emerald-700 font-black">A (임상 추정)</span>
                          <p className="text-gray-700 pl-1">{soapRecord.assessment.therapist_diagnosis || soapRecord.assessment.ai_diagnosis_inferred || '-'}</p>
                        </div>
                      )}
                      {soapRecord.plan && (
                        <div>
                          <span className="text-emerald-700 font-black">P (향후 계획)</span>
                          <p className="text-gray-700 pl-1">{soapRecord.plan.next_plan || '-'}</p>
                        </div>
                      )}
                    </div>
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
