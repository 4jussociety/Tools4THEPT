// ChartListModal.tsx
// 예약 상세 페이지에서 해당 예약에 매핑된 차트 리스트를 조회하고 표시하는 모달 컴포넌트

import React, { useEffect, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface ChartItem {
  id: string;
  chart_number: string;
  created_at: string;
  // 필요에 따라 추가 필드 정의
}

interface ChartListModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointmentId: string;
}

export const ChartListModal: React.FC<ChartListModalProps> = ({ isOpen, onClose, appointmentId }) => {
  const [charts, setCharts] = useState<ChartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !appointmentId) return;
    const fetchCharts = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error } = await supabase.functions.invoke('chart-mapping/appointment', {
          body: { appointment_id: appointmentId },
        });
        if (error) throw error;
        // Edge Function returns { charts: [...] } or direct array
        const chartList = (data as any)?.charts ?? (Array.isArray(data) ? data : []);
        setCharts(chartList);
      } catch (e) {
        console.error(e);
        setError('차트 목록을 불러오는 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    };
    fetchCharts();
  }, [isOpen, appointmentId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">예약 차트 리스트</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full transition">
            <X className="w-5 h-5" />
          </button>
        </div>
        {loading && (
          <div className="flex justify-center py-4">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        )}
        {error && <p className="text-red-500 text-sm mb-2">{error}</p>}
        {!loading && charts.length === 0 && <p className="text-gray-600">등록된 차트가 없습니다.</p>}
        <ul className="space-y-2">
          {charts.map(chart => (
            <li key={chart.id} className="p-3 border rounded hover:bg-gray-50 cursor-pointer">
              <div className="flex justify-between items-center">
                <span className="font-medium">차트 번호: {chart.chart_number}</span>
                <span className="text-xs text-gray-500">{new Date(chart.created_at).toLocaleDateString()}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
