import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { format, parseISO } from 'date-fns';
import { Loader2, Clock, ChevronDown, ChevronUp, Sparkles, User, X, MessageSquare, HeartPulse } from 'lucide-react';
import clsx from 'clsx';

type Props = {
  clientId: string;
  selectedSessionId?: string;
  onSelectSession?: (result: any) => void;
  refreshKey?: number;
};

export default function ClientChartingHistoryPanel({ clientId, selectedSessionId, onSelectSession, refreshKey }: Props) {
  const [sessions, setSessions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchHistory = async (isFirstLoad = false) => {
    if (isFirstLoad) setIsLoading(true);
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
    fetchHistory(true);
  }, [clientId]);

  useEffect(() => {
    if (refreshKey !== undefined && refreshKey > 0) {
      fetchHistory(false);
    }
  }, [refreshKey]);

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
    <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1 custom-scrollbar">
      {sessions.map((session) => {
        const dateStr = format(parseISO(session.created_at), 'yyyy년 MM월 dd일 HH:mm');
        const durationMin = Math.floor(session.duration / 60);
        const durationSec = session.duration % 60;
        
        // 1:1 관계 결과 데이터에서 최신 등록된 results 행을 보장하도록 생성시간 정렬 적용
        const sortedResults = session.results 
          ? [...session.results].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) 
          : [];
        const result = sortedResults[0];
        
        const rawChartData = result?.chart_data || {};
        const chartData = typeof rawChartData === 'string' ? JSON.parse(rawChartData) : rawChartData;
        
        // 도수재활세션 기록지의 정식 필드명인 manual_therapy_record를 확실하게 우선 참조
        const mtRecord = chartData?.manual_therapy_record || chartData?.manual_rehab_record || {};
        const isSelected = selectedSessionId === session.id;

        const handleCardClick = () => {
          if (!result || !onSelectSession) return;
          onSelectSession({
            session_id: session.id,
            appointment_id: session.appointment_id,
            client_id: session.client_id,
            client_name: session.client_name,
            chart_number: mtRecord.chart_number || '',
            raw_transcript: result.raw_transcript,
            refined_transcript: result.refined_transcript,
            guide_content: result.guide_content,
            chart_data: chartData,
          });
        };

        return (
          <div
            key={session.id}
            onClick={handleCardClick}
            className={clsx(
              "border rounded-xl p-3 bg-white hover:bg-slate-50 transition shadow-sm space-y-2 cursor-pointer text-left",
              isSelected 
                ? "border-indigo-500 ring-1 ring-indigo-500 bg-indigo-50/20" 
                : "border-gray-100 hover:border-gray-300"
            )}
          >
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <span className={clsx(
                    "px-1.5 py-0.5 rounded text-[9px] font-black tracking-wider uppercase",
                    isSelected ? "bg-indigo-600 text-white" : "bg-indigo-50 text-indigo-600"
                  )}>
                    {session.profession?.toUpperCase() || 'PT'}
                  </span>
                  <span className="text-xs font-black text-gray-800">{dateStr}</span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-gray-400 font-bold">
                  <span className="flex items-center gap-0.5"><Clock size={11} /> {durationMin > 0 ? `${durationMin}분 ` : ''}{durationSec}초</span>
                  {session.status === 'completed' && <span className="text-emerald-600 font-black">분석 완료</span>}
                  {session.status === 'pending' && <span className="text-amber-500 font-black">분석 중</span>}
                  {session.status === 'failed' && <span className="text-rose-500 font-black">분석 실패</span>}
                </div>
              </div>
            </div>

            {/* 간단 요약 정보 */}
            {session.status === 'completed' && result && (
              <div className="text-[10px] text-gray-500 space-y-1 pt-1 border-t border-gray-100">
                {mtRecord.diagnosis && (
                  <div className="truncate">
                    <span className="font-bold text-gray-700">진단:</span> {mtRecord.diagnosis}
                  </div>
                )}
                {mtRecord.techniques?.selected?.length > 0 && (
                  <div className="truncate">
                    <span className="font-bold text-gray-700">기법:</span> {mtRecord.techniques.selected.join(', ')}
                  </div>
                )}
              </div>
            )}

            {/* 수기기록 메모 요약 */}
            {session.memo && (
              <div className="bg-slate-50/80 rounded-lg p-2 text-[10px] text-gray-500 leading-relaxed truncate">
                <span className="font-bold text-gray-600">메모: </span>
                {session.memo}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
