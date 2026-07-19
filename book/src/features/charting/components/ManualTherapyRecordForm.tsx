import React, { useState, useEffect } from 'react';
import { Save, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { ManualTherapyRecord, SessionResult } from '../types/charting';
import clsx from 'clsx';

interface ManualTherapyRecordFormProps {
  sessionResult: SessionResult;
  onSaved?: (updatedRecord: ManualTherapyRecord) => void;
}

export const ManualTherapyRecordForm: React.FC<ManualTherapyRecordFormProps> = ({
  sessionResult,
  onSaved,
}) => {
  const chartDataRaw = sessionResult.chart_data || {};
  const chartData = typeof chartDataRaw === 'string' ? JSON.parse(chartDataRaw) : chartDataRaw;
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

  // 데이터 동적 변경을 위한 useEffect 추가 (세션 전환 시 폼 상태 리셋)
  useEffect(() => {
    const rawChartData = sessionResult.chart_data || {};
    const currentChartData = typeof rawChartData === 'string' ? JSON.parse(rawChartData) : rawChartData;
    const currentMt = currentChartData.manual_therapy_record || {};
    const currentCr = currentChartData.clinical_record || {};
    const currentInferredDiag =
      currentCr.assessment?.therapist_diagnosis ||
      currentCr.assessment?.ai_diagnosis_inferred ||
      '';

    setClientName(sessionResult.client_name || '');
    setChartNumber(sessionResult.chart_number || '');
    setExecutionDate(sessionResult.execution_date || new Date().toISOString().substring(0, 10));
    setDiagnosis(currentMt.diagnosis || currentInferredDiag);
    setTherapistName(currentMt.therapist_name || '');
    setCumulativeCount(
      currentMt.cumulative_count !== undefined && currentMt.cumulative_count !== null
        ? currentMt.cumulative_count
        : ''
    );
    setSelectedTechniques(currentMt.techniques?.selected || []);
    setTechniqueDetails(currentMt.techniques?.details || '');
    setSelectedRegions(currentMt.treatment_regions || []);

    const curPreEval = currentMt.evaluation?.pre_treatment || {};
    const curPostEval = currentMt.evaluation?.post_treatment || {};

    setPreVas(
      curPreEval.pain_scale !== undefined && curPreEval.pain_scale !== null
        ? curPreEval.pain_scale
        : 5
    );
    setPreRom(curPreEval.rom_and_function || '');
    setPreSymptoms(curPreEval.symptoms || '');

    setPostVas(
      curPostEval.pain_scale !== undefined && curPostEval.pain_scale !== null
        ? curPostEval.pain_scale
        : 3
    );
    setPostRom(curPostEval.rom_and_function_changes || '');
    setPostReaction(curPostEval.client_reaction || '');

    const curOverall = currentMt.overall_effect || {};
    setOverallRating(curOverall.rating || '');
    setOverallDetails(curOverall.details || '');

    setSaveStatus({
      type: 'info',
      message: '과거 진료기록을 불러왔습니다. 수정 후 저장할 수 있습니다.',
    });
  }, [sessionResult]);

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
      const { data: existingList, error: selectErr } = await supabase
        .from('results')
        .select('id, chart_data')
        .eq('session_id', sessionResult.session_id)
        .order('created_at', { ascending: false });

      if (selectErr) throw selectErr;

      if (!existingList || existingList.length === 0) {
        // results 레코드가 아예 없는 경우: 새로 삽입(Insert)
        const { error: insertErr } = await supabase
          .from('results')
          .insert({
            session_id: sessionResult.session_id,
            chart_data: {
              manual_therapy_record: newRecord
            }
          });
        if (insertErr) throw insertErr;
      } else {
        // 이미 존재하는 경우: 최신 레코드를 가져와서 업데이트
        const targetResult = existingList[0];
        let updatedChartData = targetResult.chart_data || {};
        if (typeof updatedChartData === 'string') {
          updatedChartData = JSON.parse(updatedChartData);
        }

        updatedChartData.manual_therapy_record = newRecord;

        const { error: updateErr } = await supabase
          .from('results')
          .update({ chart_data: updatedChartData })
          .eq('id', targetResult.id);

        if (updateErr) throw updateErr;
      }

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
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 shadow-sm space-y-5 text-gray-800 text-xs font-sans max-w-full">
      {/* Header */}
      <div className="text-center border-b border-slate-200 pb-3 mb-4">
        <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center justify-center gap-1.5">
          <span>💆‍♂️ 도수재활세션 기록지</span>
        </h2>
        <p className="text-[10px] text-slate-500 font-bold tracking-wider uppercase">Manual Rehabilitation Session Record</p>
      </div>

      {/* 1. 고객 정보 */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3.5 shadow-sm">
        <h3 className="font-bold text-slate-900 border-l-2 border-indigo-500 pl-2 text-[11px] uppercase tracking-wider">1. 고객 기본 정보</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1">고객명</label>
            <input 
              type="text" 
              value={clientName} 
              onChange={(e) => setClientName(e.target.value)} 
              className="w-full bg-slate-50/50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-lg p-2 outline-none font-bold text-slate-800 transition" 
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1">차트번호</label>
            <input 
              type="text" 
              value={chartNumber} 
              onChange={(e) => setChartNumber(e.target.value)} 
              className="w-full bg-slate-50/50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-lg p-2 outline-none font-bold text-slate-800 transition" 
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1">시행일자</label>
            <input 
              type="date" 
              value={executionDate} 
              onChange={(e) => setExecutionDate(e.target.value)} 
              className="w-full bg-slate-50/50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-lg p-2 outline-none font-bold text-slate-800 transition" 
            />
          </div>
        </div>
        <div>
          <label className="block text-[10px] font-bold text-slate-500 mb-1">임상 진단명 / 적용 부위</label>
          <input 
            type="text" 
            value={diagnosis} 
            onChange={(e) => setDiagnosis(e.target.value)} 
            placeholder="상담 또는 분석에 의한 진단명을 입력하세요..." 
            className="w-full bg-slate-50/50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-lg p-2.5 outline-none font-bold text-slate-800 transition" 
          />
        </div>
      </div>

      {/* 2. 도수재활세션 시행 및 횟수 */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3.5 shadow-sm">
        <h3 className="font-bold text-slate-900 border-l-2 border-indigo-500 pl-2 text-[11px] uppercase tracking-wider">2. 세션 카운트 정보</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1">시행 담당자</label>
            <input 
              type="text" 
              value={therapistName} 
              onChange={(e) => setTherapistName(e.target.value)} 
              placeholder="담당 강사/치료사 성명" 
              className="w-full bg-slate-50/50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-lg p-2 outline-none font-bold text-slate-800 transition" 
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1">연도 누적 횟수</label>
            <div className="flex items-center gap-2">
              <input 
                type="number" 
                min="0" 
                value={cumulativeCount} 
                onChange={(e) => setCumulativeCount(e.target.value === '' ? '' : Number(e.target.value))} 
                placeholder="0" 
                className="w-full bg-slate-50/50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-lg p-2 outline-none font-bold text-slate-800 transition text-right" 
              />
              <span className="font-bold text-slate-500">회차</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. 시행기법 */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3.5 shadow-sm">
        <h3 className="font-bold text-slate-900 border-l-2 border-indigo-500 pl-2 text-[11px] uppercase tracking-wider">3. 임상 적용 기법</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {availableTechniques.map((tech) => {
            const isChecked = selectedTechniques.includes(tech);
            return (
              <label 
                key={tech} 
                className={clsx(
                  "border rounded-xl p-2.5 flex items-center gap-2 cursor-pointer transition select-none font-bold",
                  isChecked 
                    ? "border-indigo-500 bg-indigo-50/40 text-indigo-900" 
                    : "border-slate-200 hover:bg-slate-50 text-slate-600"
                )}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggleTechnique(tech)}
                  className="rounded accent-indigo-600"
                />
                <span className="text-[11px]">{tech}</span>
              </label>
            );
          })}
        </div>
        <div className="pt-2">
          <label className="block text-[10px] font-bold text-slate-500 mb-1">상세 프로토콜 및 수기 테크닉 세부내용</label>
          <input
            type="text"
            value={techniqueDetails}
            onChange={(e) => setTechniqueDetails(e.target.value)}
            placeholder="예: 경추 3-4번 관절 가동술 3세트 및 승모근 이완술 실시..."
            className="w-full bg-slate-50/50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-lg p-2.5 outline-none font-medium text-slate-800 transition"
          />
        </div>
      </div>

      {/* 4. 시행부위 */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 shadow-sm">
        <h3 className="font-bold text-slate-900 border-l-2 border-indigo-500 pl-2 text-[11px] uppercase tracking-wider">4. 세션 타겟 부위</h3>
        <div className="flex flex-wrap gap-1.5">
          {availableRegions.map((reg) => {
            const isChecked = selectedRegions.includes(reg);
            return (
              <button
                key={reg}
                type="button"
                onClick={() => toggleRegion(reg)}
                className={clsx(
                  "px-3 py-1.5 rounded-full font-bold text-[10px] border transition cursor-pointer",
                  isChecked 
                    ? "bg-indigo-600 text-white border-indigo-600 shadow-sm" 
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                )}
              >
                {reg}
              </button>
            );
          })}
        </div>
      </div>

      {/* 5. 세션효과 평가 */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4 shadow-sm">
        <h3 className="font-bold text-slate-900 border-l-2 border-indigo-500 pl-2 text-[11px] uppercase tracking-wider">5. 세션 효과 평가</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Pre */}
          <div className="border border-amber-200 rounded-xl p-3 bg-amber-50/10 space-y-3">
            <h4 className="font-black text-amber-800 text-[11px] border-b border-amber-100 pb-1.5 flex items-center gap-1.5">
              <span>🟠 세션 전 (Pre-Session)</span>
            </h4>
            <div>
              <div className="flex justify-between text-[11px] font-bold text-amber-900 mb-1">
                <span>통증 스케일 (VAS)</span>
                <span className="font-black">{preVas} / 10</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="10" 
                step="1" 
                value={preVas} 
                onChange={(e) => setPreVas(Number(e.target.value))} 
                className="w-full accent-amber-600 cursor-pointer" 
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-1">관절 가동 범위 (ROM) 및 제한 상태</label>
              <textarea 
                rows={2} 
                value={preRom} 
                onChange={(e) => setPreRom(e.target.value)} 
                placeholder="예: 굴곡 시 통증 발현, ROM 45도 제한" 
                className="w-full p-2 border border-slate-200 rounded-lg bg-white outline-none focus:border-amber-400 font-medium text-slate-700 transition" 
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-1">주요 자각 증상</label>
              <textarea 
                rows={2} 
                value={preSymptoms} 
                onChange={(e) => setPreSymptoms(e.target.value)} 
                placeholder="예: 아침 기상 시 목 부위 뻣뻣함 호소" 
                className="w-full p-2 border border-slate-200 rounded-lg bg-white outline-none focus:border-amber-400 font-medium text-slate-700 transition" 
              />
            </div>
          </div>

          {/* Post */}
          <div className="border border-emerald-200 rounded-xl p-3 bg-emerald-50/10 space-y-3">
            <h4 className="font-black text-emerald-800 text-[11px] border-b border-emerald-100 pb-1.5 flex items-center gap-1.5">
              <span>🟢 세션 후 (Post-Session)</span>
            </h4>
            <div>
              <div className="flex justify-between text-[11px] font-bold text-emerald-900 mb-1">
                <span>통증 스케일 (VAS)</span>
                <span className="font-black">{postVas} / 10</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="10" 
                step="1" 
                value={postVas} 
                onChange={(e) => setPostVas(Number(e.target.value))} 
                className="w-full accent-emerald-600 cursor-pointer" 
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-1">가동 범위 변화 및 호전도</label>
              <textarea 
                rows={2} 
                value={postRom} 
                onChange={(e) => setPostRom(e.target.value)} 
                placeholder="예: 세션 후 굴곡 통증 소실, ROM 80도로 회복" 
                className="w-full p-2 border border-slate-200 rounded-lg bg-white outline-none focus:border-emerald-400 font-medium text-slate-700 transition" 
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-1">고객 피드백 & 특이사항</label>
              <textarea 
                rows={2} 
                value={postReaction} 
                onChange={(e) => setPostReaction(e.target.value)} 
                placeholder="예: 목 회전 시 찌릿한 통증이 많이 완화되었다고 하심" 
                className="w-full p-2 border border-slate-200 rounded-lg bg-white outline-none focus:border-emerald-400 font-medium text-slate-700 transition" 
              />
            </div>
          </div>
        </div>
      </div>

      {/* 6. 종합 세션효과 평가 */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3.5 shadow-sm">
        <h3 className="font-bold text-slate-900 border-l-2 border-indigo-500 pl-2 text-[11px] uppercase tracking-wider">6. 종합 임상 평가</h3>
        <div className="flex flex-wrap gap-2 py-1">
          {['현저한 호전', '호전', '변화 없음', '악화', '평가 어려움'].map((rating) => {
            const isChecked = overallRating === rating;
            return (
              <label 
                key={rating} 
                className={clsx(
                  "border rounded-xl px-3 py-2 flex items-center gap-1.5 cursor-pointer transition select-none font-bold text-[11px]",
                  isChecked 
                    ? "border-indigo-500 bg-indigo-50/40 text-indigo-900 font-black" 
                    : "border-slate-200 hover:bg-slate-50 text-slate-600"
                )}
              >
                <input
                  type="radio"
                  name="overall_rating"
                  value={rating}
                  checked={isChecked}
                  onChange={(e) => setOverallRating(e.target.value)}
                  className="accent-indigo-600"
                />
                <span>{rating}</span>
              </label>
            );
          })}
        </div>
        <input
          type="text"
          value={overallDetails}
          onChange={(e) => setOverallDetails(e.target.value)}
          placeholder="종합 평가 소견 및 다음 세션 가이드를 간략히 적어주세요."
          className="w-full bg-slate-50/50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-lg p-2.5 outline-none font-medium text-slate-800 transition"
        />
      </div>

      {/* Save Action Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between border-t border-slate-200 pt-4 gap-3">
        <div className="flex items-center gap-1.5 text-[11px]">
          {saveStatus.type === 'success' && <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />}
          {saveStatus.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0" />}
          <span
            className={clsx(
              "font-bold",
              saveStatus.type === 'success' && 'text-emerald-600',
              saveStatus.type === 'error' && 'text-rose-600',
              saveStatus.type === 'info' && 'text-indigo-600'
            )}
          >
            {saveStatus.message}
          </span>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="w-full sm:w-auto flex items-center justify-center gap-1.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-bold px-5 py-3 rounded-xl transition shadow-md disabled:opacity-50 cursor-pointer text-xs"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          <span>도수재활세션 기록지 저장하기</span>
        </button>
      </div>
    </div>
  );
};
