import React from 'react';
import { User, Activity, Stethoscope, ClipboardList, Dumbbell, Calendar, Info } from 'lucide-react';
import type { ChartData } from '../types/charting';

interface ClinicalSoapChartProps {
  chartData?: ChartData;
  guideContent?: string;
  refinedTranscript?: string;
}

export const ClinicalSoapChart: React.FC<ClinicalSoapChartProps> = ({
  chartData,
  guideContent,
  refinedTranscript,
}) => {
  const cr = chartData?.clinical_record || {};
  const rapport = chartData?.rapport_data;

  const renderSectionBox = (title: string, icon: React.ReactNode, data?: Record<string, any>) => {
    if (!data) return null;
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-2">
        <div className="flex items-center gap-2 font-bold text-gray-900 border-b border-gray-200 pb-2 text-xs">
          {icon}
          <span>{title}</span>
        </div>
        <div className="space-y-1.5 text-xs text-gray-700">
          {Object.entries(data).map(([k, v]) => (
            <div key={k} className="flex flex-col sm:flex-row sm:justify-between border-b border-gray-100 pb-1 gap-1">
              <span className="font-semibold text-gray-600 min-w-[120px]">{k}:</span>
              <span className="text-gray-900 flex-1">{Array.isArray(v) ? v.join(', ') : String(v || '언급 없음')}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* S: Subjective */}
        {renderSectionBox('S. 주관적 소견 (Subjective)', <User className="w-4 h-4 text-indigo-600" />, cr.subjective)}
        {/* O: Objective */}
        {renderSectionBox('O. 객관적 소견 (Objective)', <Activity className="w-4 h-4 text-emerald-600" />, cr.objective)}
        {/* A: Assessment */}
        {renderSectionBox('A. 임상 평가 및 진단 (Assessment)', <Stethoscope className="w-4 h-4 text-amber-600" />, cr.assessment)}
        {/* P: Plan */}
        {renderSectionBox('P. 치료 및 향후 계획 (Plan)', <ClipboardList className="w-4 h-4 text-purple-600" />, cr.plan)}
      </div>

      {/* Rapport Data */}
      {rapport && (
        <div className="bg-emerald-50/50 border border-emerald-200 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 font-bold text-emerald-900 border-b border-emerald-200 pb-2 text-xs">
            <Info className="w-4 h-4 text-emerald-600" />
            <span>🤝 라포 데이터 (Rapport & Preferences)</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
            {Object.entries(rapport).map(([k, v]) => (
              <div key={k} className="bg-white p-2.5 rounded-lg border border-emerald-100 space-y-0.5">
                <span className="font-bold text-emerald-800 block text-[11px]">{k}</span>
                <span className="text-gray-700">{Array.isArray(v) ? v.join(', ') : String(v || '언급 없음')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Client Guide & Transcript */}
      {guideContent && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
          <h4 className="font-bold text-gray-900 text-xs flex items-center gap-1.5 border-b pb-2">
            <Dumbbell className="w-4 h-4 text-indigo-600" />
            <span>고객 맞춤형 치료 가이드</span>
          </h4>
          <div className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed bg-gray-50 p-3 rounded-lg">
            {guideContent}
          </div>
        </div>
      )}
    </div>
  );
};
