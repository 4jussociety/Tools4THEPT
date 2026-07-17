import React, { useState, useEffect } from 'react';
import { Save, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { ManualTherapyRecord, SessionResult } from '../types/charting';

interface ManualTherapyRecordFormProps {
  sessionResult: SessionResult;
  onSaved?: (updatedRecord: ManualTherapyRecord) => void;
}

export const ManualTherapyRecordForm: React.FC<ManualTherapyRecordFormProps> = ({
  sessionResult,
  onSaved,
}) => {
  const chartData = sessionResult.chart_data || {};
  const initialMt = chartData.manual_therapy_record || {};
  const cr = chartData.clinical_record || {};
  const inferredDiag =
    cr.assessment?.therapist_diagnosis ||
    cr.assessment?.ai_diagnosis_inferred ||
    '';

  // State Management
  const [clientName, setClientName] = useState(sessionResult.client_name || '');
  const [chartNumber, setChartNumber] = useState(sessionResult.chart_number || '');
  const [executionDate, setExecutionDate] = useState(sessionResult.execution_date || new Date().toISOString().substring(0, 10));
  const [diagnosis, setDiagnosis] = useState(initialMt.diagnosis || inferredDiag);
  const [therapistName, setTherapistName] = useState(initialMt.therapist_name || '');
  const [cumulativeCount, setCumulativeCount] = useState<number | ''>(
    initialMt.cumulative_count !== undefined && initialMt.cumulative_count !== null
      ? initialMt.cumulative_count
      : ''
  );

  // Techniques
  const availableTechniques = [
    '연부조직가동술',
    '관절가동술',
    '근막이완술',
    '신경가동술',
    '근에너지기법',
    '스트레칭',
    '근력강화운동',
  ];
  const [selectedTechniques, setSelectedTechniques] = useState<string[]>(
    initialMt.techniques?.selected || []
  );
  const [techniqueDetails, setTechniqueDetails] = useState(
    initialMt.techniques?.details || ''
  );

  // Regions
  const availableRegions = [
    '경추부',
    '흉추부',
    '요추부',
    '골반부',
    '견관절',
    '주관절',
    '손목 및 수부',
    '고관절',
    '슬관절',
    '족관절 및 족부',
  ];
  const [selectedRegions, setSelectedRegions] = useState<string[]>(
    initialMt.treatment_regions || []
  );

  // Pre / Post Evaluation
  const preEval = initialMt.evaluation?.pre_treatment || {};
  const postEval = initialMt.evaluation?.post_treatment || {};

  const [preVas, setPreVas] = useState<number>(
    preEval.pain_scale !== undefined && preEval.pain_scale !== null
      ? preEval.pain_scale
      : 5
  );
  const [preRom, setPreRom] = useState(preEval.rom_and_function || '');
  const [preSymptoms, setPreSymptoms] = useState(preEval.symptoms || '');

  const [postVas, setPostVas] = useState<number>(
    postEval.pain_scale !== undefined && postEval.pain_scale !== null
      ? postEval.pain_scale
      : 3
  );
  const [postRom, setPostRom] = useState(postEval.rom_and_function_changes || '');
  const [postReaction, setPostReaction] = useState(postEval.client_reaction || '');

  // Overall Effect
  const overall = initialMt.overall_effect || {};
  const [overallRating, setOverallRating] = useState<string>(overall.rating || '');
  const [overallDetails, setOverallDetails] = useState(overall.details || '');

  // Status
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ type: 'info' | 'success' | 'error'; message: string }>({
    type: 'info',
    message: '내용을 확인하고 수정한 뒤 저장해 주세요.',
  });

  const toggleTechnique = (tech: string) => {
    setSelectedTechniques((prev) =>
      prev.includes(tech) ? prev.filter((t) => t !== tech) : [...prev, tech]
    );
  };

  const toggleRegion = (reg: string) => {
    setSelectedRegions((prev) =>
      prev.includes(reg) ? prev.filter((r) => r !== reg) : [...prev, reg]
    );
  };

  const handleSave = async () => {
    if (!sessionResult.session_id) {
      setSaveStatus({ type: 'error', message: '저장할 세션 ID가 유효하지 않습니다.' });
      return;
    }

    setIsSaving(true);
    setSaveStatus({ type: 'info', message: 'Supabase에 기록을 저장 중입니다...' });

    const newRecord: ManualTherapyRecord = {
      client_name: clientName,
      chart_number: chartNumber,
      execution_date: executionDate,
      diagnosis: diagnosis.trim(),
      therapist_name: therapistName.trim(),
      cumulative_count: cumulativeCount !== '' ? Number(cumulativeCount) : null,
      techniques: {
        selected: selectedTechniques,
        details: techniqueDetails.trim(),
      },
      treatment_regions: selectedRegions,
      evaluation: {
        pre_treatment: {
          pain_scale: preVas,
          rom_and_function: preRom.trim(),
          symptoms: preSymptoms.trim(),
        },
        post_treatment: {
          pain_scale: postVas,
          rom_and_function_changes: postRom.trim(),
          client_reaction: postReaction.trim(),
        },
      },
      overall_effect: {
        rating: overallRating || null,
        details: overallDetails.trim(),
      },
    };

    try {
      const { data: existing, error: selectErr } = await supabase
        .from('results')
        .select('chart_data')
        .eq('session_id', sessionResult.session_id)
        .single();

      if (selectErr) throw selectErr;

      let updatedChartData = existing?.chart_data || {};
      if (typeof updatedChartData === 'string') {
        updatedChartData = JSON.parse(updatedChartData);
      }

      updatedChartData.manual_therapy_record = newRecord;

      const { error: updateErr } = await supabase
        .from('results')
        .update({ chart_data: updatedChartData })
        .eq('session_id', sessionResult.session_id);

      if (updateErr) throw updateErr;

      setSaveStatus({
        type: 'success',
        message: '도수재활세션 기록지가 성공적으로 저장되었습니다.',
      });

      if (onSaved) {
        onSaved(newRecord);
      }
    } catch (err: any) {
      console.error('Failed to save manual therapy record:', err);
      setSaveStatus({
        type: 'error',
        message: '저장 오류: ' + (err.message || '알 수 없는 에러'),
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white border border-gray-300 rounded-lg p-4 shadow-sm text-gray-800 text-xs font-sans max-w-full">
      {/* Header */}
      <div className="text-center border-b-2 border-gray-900 pb-1 mb-3">
        <h2 className="text-base font-bold text-gray-900 tracking-wide">도수재활세션 기록지</h2>
        <p className="text-[10px] text-gray-500 uppercase tracking-widest">Manual Rehab Session Record</p>
      </div>

        {/* 1. 고객 정보 (1줄 6열 정렬) */}
        <div>
          <h3 className="font-bold text-gray-900 border-b border-gray-700 pb-0.5 mb-1 text-[11px]">1. 고객 정보</h3>
          <div className="grid grid-cols-6 border-t border-l border-gray-300">
            <div className="bg-gray-50 font-semibold text-gray-700 p-1 text-center border-r border-b border-gray-300 flex items-center justify-center">고객명</div>
            <div className="p-1 border-r border-b border-gray-300">
              <input type="text" value={clientName} onChange={(e) => setClientName(e.target.value)} className="w-full bg-transparent px-1 border border-transparent focus:border-indigo-500 focus:bg-gray-100 rounded outline-none" />
            </div>
            <div className="bg-gray-50 font-semibold text-gray-700 p-1 text-center border-r border-b border-gray-300 flex items-center justify-center">차트번호</div>
            <div className="p-1 border-r border-b border-gray-300">
              <input type="text" value={chartNumber} onChange={(e) => setChartNumber(e.target.value)} className="w-full bg-transparent px-1 border border-transparent focus:border-indigo-500 focus:bg-gray-100 rounded outline-none" />
            </div>
            <div className="bg-gray-50 font-semibold text-gray-700 p-1 text-center border-r border-b border-gray-300 flex items-center justify-center">시행일</div>
            <div className="p-1 border-r border-b border-gray-300">
              <input type="date" value={executionDate} onChange={(e) => setExecutionDate(e.target.value)} className="w-full bg-transparent px-1 border border-transparent focus:border-indigo-500 focus:bg-gray-100 rounded outline-none" />
            </div>

            <div className="bg-gray-50 font-semibold text-gray-700 p-1 text-center border-r border-b border-gray-300 flex items-center justify-center">진단명</div>
            <div className="col-span-5 p-1 border-r border-b border-gray-300">
              <input type="text" value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} placeholder="진단명 입력" className="w-full bg-transparent px-1 border border-transparent focus:border-indigo-500 focus:bg-gray-100 rounded outline-none" />
            </div>
          </div>
        </div>

        {/* 2. 도수재활세션 시행 및 횟수 */}
        <div>
          <h3 className="font-bold text-gray-900 border-b border-gray-700 pb-0.5 mb-1 text-[11px]">2. 도수재활세션 시행 및 횟수</h3>
          <div className="grid grid-cols-4 border-t border-l border-gray-300">
            <div className="bg-gray-50 font-semibold text-gray-700 p-1 text-center border-r border-b border-gray-300 flex items-center justify-center">시행자 성명</div>
            <div className="p-1 border-r border-b border-gray-300">
              <input type="text" value={therapistName} onChange={(e) => setTherapistName(e.target.value)} placeholder="강사 성명" className="w-full bg-transparent px-1 border border-transparent focus:border-indigo-500 focus:bg-gray-100 rounded outline-none" />
            </div>
            <div className="bg-gray-50 font-semibold text-gray-700 p-1 text-center border-r border-b border-gray-300 flex items-center justify-center">연도 누적 횟수</div>
            <div className="p-1 border-r border-b border-gray-300 flex items-center gap-1">
              <input type="number" min="0" value={cumulativeCount} onChange={(e) => setCumulativeCount(e.target.value === '' ? '' : Number(e.target.value))} placeholder="누적" className="w-full bg-transparent px-1 border border-transparent focus:border-indigo-500 focus:bg-gray-100 rounded outline-none" />
              <span>회</span>
            </div>
          </div>
        </div>

        {/* 3. 시행기법 */}
        <div>
          <h3 className="font-bold text-gray-900 border-b border-gray-700 pb-0.5 mb-1 text-[11px]">3. 시행기법</h3>
          <div className="grid grid-cols-4 gap-1 py-1">
            {availableTechniques.map((tech) => (
              <label key={tech} className="flex items-center gap-1 cursor-pointer select-none text-[11px]">
                <input
                  type="checkbox"
                  checked={selectedTechniques.includes(tech)}
                  onChange={() => toggleTechnique(tech)}
                  className="rounded accent-indigo-600"
                />
                <span>{tech}</span>
              </label>
            ))}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="font-semibold text-gray-700 whitespace-nowrap">구체적 기법:</span>
            <input
              type="text"
              value={techniqueDetails}
              onChange={(e) => setTechniqueDetails(e.target.value)}
              placeholder="구체적인 시행 기술이나 프로토콜 입력"
              className="flex-1 bg-gray-50 border border-gray-200 rounded px-2 py-0.5 text-xs outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* 4. 시행부위 */}
        <div>
          <h3 className="font-bold text-gray-900 border-b border-gray-700 pb-0.5 mb-1 text-[11px]">4. 시행부위</h3>
          <div className="grid grid-cols-5 gap-1 py-1">
            {availableRegions.map((reg) => (
              <label key={reg} className="flex items-center gap-1 cursor-pointer select-none text-[11px]">
                <input
                  type="checkbox"
                  checked={selectedRegions.includes(reg)}
                  onChange={() => toggleRegion(reg)}
                  className="rounded accent-indigo-600"
                />
                <span>{reg}</span>
              </label>
            ))}
          </div>
        </div>

        {/* 5. 세션효과 평가 */}
        <div>
          <h3 className="font-bold text-gray-900 border-b border-gray-700 pb-0.5 mb-1 text-[11px]">5. 세션효과 평가 (세션 전 / 세션 후 비교)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Pre */}
            <div className="border border-indigo-200 rounded p-2 bg-indigo-50/30">
              <h4 className="font-bold text-indigo-900 border-b border-indigo-200 pb-0.5 mb-2">세션 전 (Pre-Session)</h4>
              <div className="mb-2">
                <div className="flex justify-between text-xs font-medium mb-1">
                  <span>통증 정도 (VAS Score: 0~10)</span>
                  <span className="font-bold text-indigo-600">{preVas}점</span>
                </div>
                <input type="range" min="0" max="10" step="1" value={preVas} onChange={(e) => setPreVas(Number(e.target.value))} className="w-full accent-indigo-600 cursor-pointer" />
              </div>
              <div className="mb-2">
                <label className="block text-[11px] font-semibold text-gray-700 mb-0.5">관절가동범위 및 기능 상태</label>
                <textarea rows={2} value={preRom} onChange={(e) => setPreRom(e.target.value)} placeholder="세션 전 ROM 제한 상태나 기능 검사 수치 입력" className="w-full p-1.5 border border-gray-200 rounded bg-white outline-none focus:border-indigo-500 text-xs" />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-0.5">주요 증상 및 제한사항</label>
                <textarea rows={2} value={preSymptoms} onChange={(e) => setPreSymptoms(e.target.value)} placeholder="고객의 주호소 증상 및 일상생활 제한 요인" className="w-full p-1.5 border border-gray-200 rounded bg-white outline-none focus:border-indigo-500 text-xs" />
              </div>
            </div>

            {/* Post */}
            <div className="border border-emerald-200 rounded p-2 bg-emerald-50/30">
              <h4 className="font-bold text-emerald-900 border-b border-emerald-200 pb-0.5 mb-2">세션 후 (Post-Session)</h4>
              <div className="mb-2">
                <div className="flex justify-between text-xs font-medium mb-1">
                  <span>통증 정도 (VAS Score: 0~10)</span>
                  <span className="font-bold text-emerald-600">{postVas}점</span>
                </div>
                <input type="range" min="0" max="10" step="1" value={postVas} onChange={(e) => setPostVas(Number(e.target.value))} className="w-full accent-emerald-600 cursor-pointer" />
              </div>
              <div className="mb-2">
                <label className="block text-[11px] font-semibold text-gray-700 mb-0.5">관절가동범위 및 기능 변화</label>
                <textarea rows={2} value={postRom} onChange={(e) => setPostRom(e.target.value)} placeholder="세션 후 즉각적인 ROM 증가 수치 및 기능 호전 변화" className="w-full p-1.5 border border-gray-200 rounded bg-white outline-none focus:border-emerald-500 text-xs" />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-0.5">고객 주관적 반응 및 호전도</label>
                <textarea rows={2} value={postReaction} onChange={(e) => setPostReaction(e.target.value)} placeholder="세션 후 고객이 직접 표현한 피드백 및 상태" className="w-full p-1.5 border border-gray-200 rounded bg-white outline-none focus:border-emerald-500 text-xs" />
              </div>
            </div>
          </div>
        </div>

        {/* 6. 종합 세션효과 평가 */}
        <div>
          <h3 className="font-bold text-gray-900 border-b border-gray-700 pb-0.5 mb-1 text-[11px]">6. 종합 세션효과 평가</h3>
          <div className="flex flex-wrap gap-3 py-1">
            {['현저한 호전', '호전', '변화 없음', '악화', '평가 어려움'].map((rating) => (
              <label key={rating} className="flex items-center gap-1 cursor-pointer text-[11px]">
                <input
                  type="radio"
                  name="overall_rating"
                  value={rating}
                  checked={overallRating === rating}
                  onChange={(e) => setOverallRating(e.target.value)}
                  className="accent-indigo-600"
                />
                <span>{rating}</span>
              </label>
            ))}
          </div>
          <input
            type="text"
            value={overallDetails}
            onChange={(e) => setOverallDetails(e.target.value)}
            placeholder="종합 평가 소견 및 향후 세션 방향"
            className="w-full mt-1 bg-gray-50 border border-gray-200 rounded px-2 py-1 text-xs outline-none focus:border-indigo-500"
          />
        </div>

        {/* Save Action Bar */}
        <div className="flex items-center justify-between border-t border-gray-200 pt-3 mt-4">
          <div className="flex items-center gap-1.5 text-xs">
            {saveStatus.type === 'success' && <CheckCircle className="w-4 h-4 text-emerald-500" />}
            {saveStatus.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-500" />}
            <span
              className={
                saveStatus.type === 'success'
                  ? 'text-emerald-600 font-medium'
                  : saveStatus.type === 'error'
                  ? 'text-rose-600 font-medium'
                  : 'text-gray-500'
              }
            >
              {saveStatus.message}
            </span>
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold px-4 py-2 rounded-lg transition shadow-sm disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>도수재활세션 기록지 저장하기</span>
          </button>
        </div>
      </div>
    );
};
