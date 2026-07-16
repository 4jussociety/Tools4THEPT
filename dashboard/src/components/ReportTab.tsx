import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { TreatmentHistory } from '../types';
import { Download, Calendar, Search, RefreshCcw, CheckCircle2, AlertCircle, Trash2 } from 'lucide-react';

interface ReportTabProps {
  isViewerMode?: boolean;
  isStaffMode?: boolean;
  ownerId: string;
}

export function ReportTab({ isViewerMode = false, isStaffMode = false, ownerId }: ReportTabProps) {
  const [history, setHistory] = useState<TreatmentHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // 날짜 범위 선택 상태 (기본값: 한국 시간 기준 오늘 날짜 YYYY-MM-DD)
  const getTodayKST = () => {
    const now = new Date();
    // UTC 시간에 9시간을 더해 KST로 변환
    const kstOffset = 9 * 60 * 60 * 1000;
    const kstDate = new Date(now.getTime() + kstOffset);
    return kstDate.toISOString().split('T')[0];
  };

  const [startDate, setStartDate] = useState<string>(getTodayKST);
  const [endDate, setEndDate] = useState<string>(getTodayKST);

  const setQuickFilter = (type: 'today' | 'week' | 'month') => {
    const today = getTodayKST();
    setEndDate(today);
    
    if (type === 'today') {
      setStartDate(today);
    } else if (type === 'week') {
      const now = new Date();
      const oneWeekAgo = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
      const kstOffset = 9 * 60 * 60 * 1000;
      const kstDate = new Date(oneWeekAgo.getTime() + kstOffset);
      setStartDate(kstDate.toISOString().split('T')[0]);
    } else if (type === 'month') {
      const now = new Date();
      const oneMonthAgo = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);
      const kstOffset = 9 * 60 * 60 * 1000;
      const kstDate = new Date(oneMonthAgo.getTime() + kstOffset);
      setStartDate(kstDate.toISOString().split('T')[0]);
    }
  };

  useEffect(() => {
    if (!ownerId) return;

    // 300ms 디바운스 탑재하여 서버 부하 및 타이핑 렉 최소화
    const timer = setTimeout(() => {
      fetchHistory();
    }, 300);

    const channel = supabase
      .channel(`treatment_history:${ownerId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'treatment_history', filter: `owner_id=eq.${ownerId}` }, () => {
        fetchHistory();
      })
      .subscribe();

    return () => {
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [startDate, endDate, searchTerm, ownerId]);

  const fetchHistory = async () => {
    if (!ownerId) return;
    setIsLoading(true);
    
    let query = supabase
      .from('treatment_history')
      .select('*')
      .eq('owner_id', ownerId)
      .order('visit_time', { ascending: false });

    // 검색어가 있으면 날짜 필터링을 자동으로 해제하고 전체 기간에 대해 검색
    if (searchTerm.trim() !== '') {
      query = query.or(`client_name.ilike.%${searchTerm.trim()}%,body_part.ilike.%${searchTerm.trim()}%,client_memo.ilike.%${searchTerm.trim()}%`);
    } else if (startDate && endDate) {
      // 시작일의 00:00:00 KST ~ 종료일의 23:59:59 KST
      const startOfRange = `${startDate}T00:00:00+09:00`;
      const endOfRange = `${endDate}T23:59:59+09:00`;
      query = query.gte('visit_time', startOfRange).lte('visit_time', endOfRange);
    }

    const { data, error } = await query;
    
    if (!error && data) {
      setHistory(data as TreatmentHistory[]);
    } else {
      setHistory([]);
    }
    setIsLoading(false);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!ownerId) return;
    if (!window.confirm(`'${name}' 고객의 리포트 기록을 정말 삭제하시겠습니까?`)) return;
    
    const { error } = await supabase
      .from('treatment_history')
      .delete()
      .eq('id', id)
      .eq('owner_id', ownerId);
    
    if (error) {
      alert('삭제 중 오류가 발생했습니다: ' + error.message);
    } else {
      fetchHistory();
    }
  };


  const exportToCSV = () => {
    if (history.length === 0) return;

    let dateLabel = '';
    if (startDate === endDate) {
      const [y, m, d] = startDate.split('-');
      dateLabel = `${y}년 ${m}월 ${d}일`;
    } else {
      const [sy, sm, sd] = startDate.split('-');
      const [ey, em, ed] = endDate.split('-');
      dateLabel = `${sy}년 ${sm}월 ${sd}일 ~ ${ey}년 ${em}월 ${ed}일`;
    }

    const csvLines: string[] = [];
    csvLines.push(`"대상 기간","${dateLabel}"`);
    csvLines.push('');

    // 날짜별 그룹 생성
    const csvGrouped: Record<string, TreatmentHistory[]> = {};
    history.forEach((h) => {
      const dateStr = getKSTDateString(h.visit_time);
      if (!csvGrouped[dateStr]) {
        csvGrouped[dateStr] = [];
      }
      csvGrouped[dateStr].push(h);
    });
    const csvSortedDates = Object.keys(csvGrouped).sort((a, b) => b.localeCompare(a));

    csvSortedDates.forEach((dateStr) => {
      const records = csvGrouped[dateStr];
      const [y, m, d] = dateStr.split('-');
      
      const dateObj = new Date(dateStr);
      const days = ['일', '월', '화', '수', '목', '금', '토'];
      const dayOfWeek = days[dateObj.getDay()];

      // 날짜 구분 헤더 행
      csvLines.push(`"📅 ${y}년 ${m}월 ${d}일 (${dayOfWeek}요일)","총 ${records.length}건"`);
      
      // 테이블 헤더 (A열을 비워두어 B열부터 시작되도록 설정)
      const headers = ['', '번호', '고객이름', '부위', '특이사항 메모', '치료(완료)', '치료(미완료)', '배정시각', '종료시각'];
      csvLines.push(headers.map(h => `"${h}"`).join(','));

      // 데이터 행 추가 (A열을 비워두어 B열부터 시작되도록 설정)
      records.forEach((h, index) => {
        const row = [
          '',
          records.length - index,
          h.client_name,
          h.body_part || '-',
          h.client_memo || '-',
          (h.completed_treatments || []).map((t: any) => t.name).join(', '),
          (h.incomplete_treatments || []).map((t: any) => t.name).join(', '),
          formatTime(h.visit_time),
          h.end_time ? formatTime(h.end_time) : '-'
        ];
        csvLines.push(row.map(cell => `"${cell}"`).join(','));
      });

      csvLines.push(''); // 공백 행으로 섹션 구분
    });

    const csvContent = '\uFEFF' + csvLines.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `물리치료_방문리포트_${startDate}_${endDate}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getKSTDateString = (visitTime: string) => {
    const d = new Date(visitTime);
    const kstOffset = 9 * 60 * 60 * 1000;
    const kstDate = new Date(d.getTime() + kstOffset);
    return kstDate.toISOString().split('T')[0];
  };

  const groupedHistory = history.reduce((acc, item) => {
    const dateStr = getKSTDateString(item.visit_time);
    if (!acc[dateStr]) {
      acc[dateStr] = [];
    }
    acc[dateStr].push(item);
    return acc;
  }, {} as Record<string, TreatmentHistory[]>);

  const sortedDates = Object.keys(groupedHistory).sort((a, b) => b.localeCompare(a));

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2.5 w-full lg:w-auto">
          <div className="flex items-center gap-2 shrink-0">
            <Calendar className="text-blue-500 hidden sm:block" size={20} />
            <div className="flex items-center gap-1.5 bg-blue-50 px-2.5 py-1.5 rounded-xl border border-blue-100 shadow-inner">
              <input 
                type="date" 
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="bg-transparent border-none focus:ring-0 text-xs font-black text-blue-800 cursor-pointer p-0 w-[110px]"
              />
              <span className="text-xs font-bold text-blue-400">~</span>
              <input 
                type="date" 
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="bg-transparent border-none focus:ring-0 text-xs font-black text-blue-800 cursor-pointer p-0 w-[110px]"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-1">
            <button
              onClick={() => setQuickFilter('today')}
              className={`px-2 py-1 rounded-lg text-[10px] font-black transition-all border ${
                startDate === endDate && startDate === getTodayKST()
                  ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                  : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
              }`}
            >
              오늘
            </button>
            <button
              onClick={() => setQuickFilter('week')}
              className={`px-2 py-1 rounded-lg text-[10px] font-black transition-all border ${
                startDate === (() => {
                  const now = new Date();
                  const oneWeekAgo = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
                  const kstOffset = 9 * 60 * 60 * 1000;
                  const kstDate = new Date(oneWeekAgo.getTime() + kstOffset);
                  return kstDate.toISOString().split('T')[0];
                })() && endDate === getTodayKST()
                  ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                  : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
              }`}
            >
              최근 7일
            </button>
            <button
              onClick={() => setQuickFilter('month')}
              className={`px-2 py-1 rounded-lg text-[10px] font-black transition-all border ${
                startDate === (() => {
                  const now = new Date();
                  const oneMonthAgo = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);
                  const kstOffset = 9 * 60 * 60 * 1000;
                  const kstDate = new Date(oneMonthAgo.getTime() + kstOffset);
                  return kstDate.toISOString().split('T')[0];
                })() && endDate === getTodayKST()
                  ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                  : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
              }`}
            >
              최근 30일
            </button>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="고객명 검색..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-xs font-bold"
            />
          </div>
          
          <div className="flex items-center gap-1.5">
            <button 
              onClick={fetchHistory}
              className="p-2 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-colors"
              title="새로고침"
            >
              <RefreshCcw size={16} className={isLoading ? "animate-spin" : ""} />
            </button>
            <button 
              onClick={exportToCSV}
              disabled={history.length === 0}
              className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-xl font-black text-xs hover:bg-green-700 transition-all shadow-md active:scale-95 disabled:opacity-50"
            >
              <Download size={16} /> CSV
            </button>
          </div>
        </div>
      </div>

      {searchTerm.trim() !== '' && (
        <div className="bg-emerald-50/80 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-2xl flex items-center justify-between text-xs font-black shadow-sm animate-fade-in">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>💡 전체 기간(과거 기록 포함)에서 <strong>'{searchTerm}'</strong> 검색 결과 (총 {history.length}건)</span>
          </div>
          <button
            onClick={() => setSearchTerm('')}
            className="text-emerald-600 hover:text-emerald-800 hover:underline transition-all font-extrabold flex items-center gap-1"
          >
            검색 해제
          </button>
        </div>
      )}

      {isLoading && history.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-md p-8 text-center text-slate-400 font-bold">
          데이터를 불러오는 중...
        </div>
      ) : history.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-md p-8 text-center text-slate-400 font-bold">
          기록이 없습니다.
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {sortedDates.map((dateStr) => {
            const records = groupedHistory[dateStr];
            const [y, m, d] = dateStr.split('-');
            
            // 요일 계산
            const dateObj = new Date(dateStr);
            const days = ['일', '월', '화', '수', '목', '금', '토'];
            const dayOfWeek = days[dateObj.getDay()];

            return (
              <div key={dateStr} className="bg-white rounded-2xl border border-slate-200 shadow-md overflow-hidden animate-fade-in">
                {/* 날짜 구분 단 헤더 */}
                <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-slate-800">
                      📅 {y}년 {m}월 {d}일 ({dayOfWeek}요일)
                    </span>
                    <span className="text-[10px] font-black px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-100 rounded-full">
                      {records.length}건
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse table-fixed min-w-[900px]">
                    <thead>
                      <tr className="bg-slate-100/50 border-b border-slate-200">
                        <th className="w-[50px] px-3 py-2 text-xs font-black text-slate-600 uppercase text-center">No.</th>
                        <th className="w-[110px] px-3 py-2 text-xs font-black text-slate-600 uppercase">고객이름</th>
                        <th className="w-[110px] px-3 py-2 text-xs font-black text-slate-600 uppercase">부위</th>
                        <th className="w-[180px] px-3 py-2 text-xs font-black text-slate-600 uppercase">특이사항 메모</th>
                        <th className="w-[220px] px-3 py-2 text-xs font-black text-slate-600 uppercase">치료 항목 (완료)</th>
                        <th className="w-[220px] px-3 py-2 text-xs font-black text-slate-600 uppercase">치료 항목 (미완료)</th>
                        <th className="w-[130px] px-3 py-2 text-xs font-black text-slate-600 uppercase">배정/퇴실</th>
                        {!isViewerMode && !isStaffMode && <th className="w-[60px] px-3 py-2 text-xs font-black text-slate-600 uppercase text-center">관리</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {records.map((h, index) => (
                        <tr key={h.id} className="hover:bg-slate-50 transition-colors group">
                          <td className="px-3 py-1.5 text-center">
                            <span className="text-xs font-black font-mono text-slate-400">
                              {records.length - index}
                            </span>
                          </td>
                          <td className="px-3 py-1.5">
                            <span className="text-xs font-black text-slate-900 truncate block">{h.client_name}</span>
                          </td>
                          <td className="px-3 py-1.5">
                            <div className="flex flex-wrap gap-1">
                              {h.body_part ? (
                                h.body_part.split(', ').map((part, idx) => (
                                  <span key={idx} className="text-[10px] font-black px-1.5 py-0.5 bg-amber-100 text-amber-900 rounded border border-amber-200 whitespace-nowrap">
                                    {part}
                                  </span>
                                ))
                              ) : (
                                <span className="text-xs text-slate-300 font-bold">미지정</span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-1.5">
                            {h.client_memo ? (
                              <div className="flex items-center text-[11px] text-amber-800 bg-amber-50/70 border border-amber-200/50 rounded-lg px-2 py-1 font-bold shadow-sm select-none break-all whitespace-pre-wrap">
                                <span>{h.client_memo}</span>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-300 font-bold">-</span>
                            )}
                          </td>
                          <td className="px-3 py-1.5">
                            <div className="flex flex-wrap gap-1">
                              {(h.completed_treatments || []).length > 0 ? (
                                (h.completed_treatments || []).map((t: any) => (
                                  <span key={t.id} className="inline-flex items-center gap-0.5 text-[10px] font-black text-green-800 bg-green-50 px-1.5 py-0.5 rounded border border-green-100">
                                    <CheckCircle2 size={11} /> {t.name}(완)
                                  </span>
                                ))
                              ) : (
                                <span className="text-xs text-slate-300">-</span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-1.5">
                            <div className="flex flex-wrap gap-1">
                              {(h.incomplete_treatments || []).length > 0 ? (
                                (h.incomplete_treatments || []).map((t: any) => (
                                  <span key={t.id} className="inline-flex items-center gap-0.5 text-[10px] font-black text-red-800 bg-red-50 px-1.5 py-0.5 rounded border border-red-100">
                                    <AlertCircle size={11} /> {t.name}(미완)
                                  </span>
                                ))
                              ) : (
                                <span className="text-xs text-slate-300">-</span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-1.5">
                            <div className="text-[10px] text-slate-600 flex flex-col gap-0.5 font-bold">
                              <span className="font-mono">배정: {formatTime(h.visit_time)}</span>
                              <span className="font-mono text-blue-700 font-black">
                                {h.end_time ? `퇴실: ${formatTime(h.end_time)}` : '진행중...'}
                              </span>
                            </div>
                          </td>
                           {!isViewerMode && !isStaffMode && (
                            <td className="px-3 py-1.5 text-center">
                              <button 
                                onClick={() => handleDelete(h.id, h.client_name)}
                                className="p-1 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded transition-all opacity-0 group-hover:opacity-100"
                                title="기록 삭제"
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
