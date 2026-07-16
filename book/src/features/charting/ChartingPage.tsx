import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Sparkles, History, Search } from 'lucide-react';
import { AudioUploadForm } from './components/AudioUploadForm';
import { ManualTherapyRecordForm } from './components/ManualTherapyRecordForm';
import { ClinicalSoapChart } from './components/ClinicalSoapChart';
import type { SessionResult } from './types/charting';

export default function ChartingPage() {
  const [searchParams] = useSearchParams();
  const clientId = searchParams.get('client_id') || searchParams.get('clientId') || undefined;
  const [activeTab, setActiveTab] = useState<'upload' | 'manual-therapy' | 'soap'>('upload');
  const [sessionResult, setSessionResult] = useState<SessionResult | null>(null);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Top Header */}
      <div className="bg-gradient-to-r from-gray-900 via-indigo-950 to-gray-900 rounded-2xl p-6 text-white shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="bg-indigo-500/20 text-indigo-300 text-xs font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider border border-indigo-500/30 inline-block mb-2">
            AI Clinical Charting System
          </span>
          <h1 className="text-xl md:text-2xl font-black flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-indigo-400" />
            <span>AI 음성 차팅 및 도수치료 시행기록</span>
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            녹음 및 수기 메모 분석으로 SOAP 차트와 1화면 콤팩트 도수치료 시행기록지를 즉시 추출합니다.
          </p>
        </div>
      </div>

      {/* Main Grid Container */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side: Upload Form & Guide */}
        <div className="lg:col-span-5 space-y-4">
          <AudioUploadForm
            clientId={clientId}
            onAnalysisCompleted={(res) => {
              setSessionResult(res);
              setActiveTab('manual-therapy');
            }}
          />
        </div>

        {/* Right Side: Tab Viewers */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {/* View Tabs */}
            <div className="flex border-b border-gray-200 bg-gray-50/50">
              <button
                onClick={() => setActiveTab('upload')}
                className={`py-3 px-4 font-bold text-xs border-b-2 transition ${
                  activeTab === 'upload'
                    ? 'border-indigo-600 text-indigo-600 bg-white'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                업로드 안내
              </button>
              <button
                onClick={() => setActiveTab('manual-therapy')}
                disabled={!sessionResult}
                className={`py-3 px-4 font-bold text-xs border-b-2 transition disabled:opacity-40 disabled:cursor-not-allowed ${
                  activeTab === 'manual-therapy'
                    ? 'border-indigo-600 text-indigo-600 bg-white'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                도수치료 시행기록지
              </button>
              <button
                onClick={() => setActiveTab('soap')}
                disabled={!sessionResult}
                className={`py-3 px-4 font-bold text-xs border-b-2 transition disabled:opacity-40 disabled:cursor-not-allowed ${
                  activeTab === 'soap'
                    ? 'border-indigo-600 text-indigo-600 bg-white'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                임상 SOAP 차트
              </button>
            </div>

            <div className="p-4">
              {!sessionResult && activeTab === 'upload' && (
                <div className="text-center py-12 text-gray-400 space-y-2">
                  <Sparkles className="w-8 h-8 mx-auto text-indigo-400 animate-pulse" />
                  <p className="text-xs font-semibold text-gray-600">왼쪽 폼에서 음성 파일과 추가 메모를 등록하여 AI 분석을 실행하세요.</p>
                  <p className="text-[11px] text-gray-400">분석이 완성되면 도수치료 시행기록지와 SOAP 임상 결과가 여기에 표시됩니다.</p>
                </div>
              )}

              {sessionResult && activeTab === 'manual-therapy' && (
                <ManualTherapyRecordForm sessionResult={sessionResult} />
              )}

              {sessionResult && activeTab === 'soap' && (
                <ClinicalSoapChart
                  chartData={sessionResult.chart_data}
                  guideContent={sessionResult.guide_content}
                  refinedTranscript={sessionResult.refined_transcript}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
