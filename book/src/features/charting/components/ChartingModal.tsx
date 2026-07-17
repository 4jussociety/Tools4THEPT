import React, { useState, useEffect } from 'react';
import { FileText, Activity, Layers, X } from 'lucide-react';
import { AudioUploadForm } from './AudioUploadForm';
import { ManualTherapyRecordForm } from './ManualTherapyRecordForm';
import { ClinicalSoapChart } from './ClinicalSoapChart';
import type { SessionResult } from '../types/charting';

interface ChartingModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientId?: string;
  clientName?: string;
  chartNumber?: string;
  appointmentId?: string;
  initialResult?: SessionResult | null;
}

export const ChartingModal: React.FC<ChartingModalProps> = ({
  isOpen,
  onClose,
  clientId,
  clientName,
  chartNumber,
  appointmentId,
  initialResult,
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'manual-therapy' | 'soap'>('upload');
  const [sessionResult, setSessionResult] = useState<SessionResult | null>(initialResult || null);

  useEffect(() => {
    if (initialResult) {
      setSessionResult(initialResult);
      setActiveTab('manual-therapy');
    } else {
      setActiveTab('upload');
    }
  }, [initialResult, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden border border-gray-100">
        {/* Top Header Bar */}
        <div className="bg-gray-900 text-white px-6 py-4 flex justify-between items-center">
          <div>
            <h2 className="text-base font-bold flex items-center gap-2">
              <Activity className="w-5 h-5 text-indigo-400" />
              <span>AI 음성 & 도수재활세션 기록 연동</span>
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              고객: <span className="text-white font-semibold">{clientName || '미선택'}</span> {chartNumber && `(차트: ${chartNumber})`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-gray-200 bg-gray-50 px-6">
          <button
            onClick={() => setActiveTab('upload')}
            className={`py-3 px-4 font-semibold text-xs border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'upload'
                ? 'border-indigo-600 text-indigo-600 bg-white'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>1. 음성 분석 업로드</span>
          </button>

          <button
            onClick={() => setActiveTab('manual-therapy')}
            disabled={!sessionResult}
            className={`py-3 px-4 font-semibold text-xs border-b-2 transition flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed ${
              activeTab === 'manual-therapy'
                ? 'border-indigo-600 text-indigo-600 bg-white'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>2. 도수재활세션 기록지</span>
          </button>

          <button
            onClick={() => setActiveTab('soap')}
            disabled={!sessionResult}
            className={`py-3 px-4 font-semibold text-xs border-b-2 transition flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed ${
              activeTab === 'soap'
                ? 'border-indigo-600 text-indigo-600 bg-white'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>3. 임상 SOAP 차트</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {activeTab === 'upload' && (
            <AudioUploadForm
              clientId={clientId}
              appointmentId={appointmentId}
              onAnalysisCompleted={(res) => {
                const mergedResult: SessionResult = {
                  ...res,
                  client_name: clientName,
                  chart_number: chartNumber,
                };
                setSessionResult(mergedResult);
                setActiveTab('manual-therapy');
              }}
            />
          )}

          {activeTab === 'manual-therapy' && sessionResult && (
            <ManualTherapyRecordForm
              sessionResult={{
                ...sessionResult,
                client_name: sessionResult.client_name || clientName,
                chart_number: sessionResult.chart_number || chartNumber,
              }}
            />
          )}

          {activeTab === 'soap' && sessionResult && (
            <ClinicalSoapChart
              chartData={sessionResult.chart_data}
              guideContent={sessionResult.guide_content}
              refinedTranscript={sessionResult.refined_transcript}
            />
          )}
        </div>
      </div>
    </div>
  );
};
