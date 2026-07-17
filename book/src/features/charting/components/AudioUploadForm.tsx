import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileAudio, FileText, Sparkles, AlertCircle, HelpCircle, Search, User, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { SessionResult } from '../types/charting';

interface AudioUploadFormProps {
  clientId?: string;
  appointmentId?: string;
  therapyDate?: string;
  therapyTime?: string;
  onAnalysisStarted?: () => void;
  onAnalysisCompleted?: (result: SessionResult) => void;
}

export const AudioUploadForm: React.FC<AudioUploadFormProps> = ({
  clientId,
  appointmentId,
  therapyDate,
  therapyTime,
  onAnalysisStarted,
  onAnalysisCompleted,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [memo, setMemo] = useState('');
  const [profession, setProfession] = useState('pt');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showRecordingGuide, setShowRecordingGuide] = useState(false);

  // 고객 관리 연동 관련 상태 변수
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 1. 컴포넌트 마운트 시 고객 리스트 조회
  useEffect(() => {
    const fetchClients = async () => {
      try {
        const { data, error } = await supabase
          .from('clients')
          .select('id, name, phone, birth_date, chart_number')
          .order('name', { ascending: true });
        if (!error && data) {
          setClients(data);
        }
      } catch (err) {
        console.error('고객 목록 조회 실패:', err);
      }
    };
    fetchClients();
  }, []);

  // 2. 외부 props로 전달받은 clientId가 있을 시 자동 선택 처리
  useEffect(() => {
    if (clientId && clients.length > 0) {
      const match = clients.find(c => c.id === clientId);
      if (match) {
        setSelectedClient(match);
      }
    }
  }, [clientId, clients]);

  // 3. 외부 드롭다운 영역 클릭 감지 및 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowClientDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 검색어 필터링된 고객 목록
  const filteredClients = clientSearchQuery.trim() === ''
    ? clients
    : clients.filter(c => 
        (c.name && c.name.toLowerCase().includes(clientSearchQuery.toLowerCase())) ||
        (c.phone && c.phone.includes(clientSearchQuery))
      );

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setErrorMessage(null);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
      setErrorMessage(null);
    }
  };

  const getAudioDuration = (file: File): Promise<number> => {
    return new Promise((resolve) => {
      const audio = document.createElement('audio');
      audio.preload = 'metadata';
      audio.onloadedmetadata = () => {
        window.URL.revokeObjectURL(audio.src);
        resolve(audio.duration || 0);
      };
      audio.onerror = () => resolve(0);
      audio.src = URL.createObjectURL(file);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient) {
      setErrorMessage('차팅 기록을 남길 고객을 검색 후 선택해 주세요.');
      return;
    }
    if (!selectedFile) {
      setErrorMessage('분석할 음성 파일을 등록해 주세요.');
      return;
    }

    setIsAnalyzing(true);
    setErrorMessage(null);
    if (onAnalysisStarted) onAnalysisStarted();

    try {
      const { data: authData } = await supabase.auth.getSession();
      const session = authData.session;
      if (!session) {
        throw new Error('로그인이 필요한 기능입니다.');
      }

      const duration = await getAudioDuration(selectedFile);
      if (duration <= 0) {
        throw new Error('올바르지 않은 오디오 파일이거나 오디오 길이를 측정할 수 없습니다.');
      }

      // 1. Sessions DB Insert (고객정보 연동하여 삽입)
      const { data: sessionData, error: sessionErr } = await supabase
        .from('sessions')
        .insert({
          user_id: session.user.id,
          client_id: selectedClient.id,
          appointment_id: appointmentId || null,
          profession: profession,
          client_name: selectedClient.name,
          status: 'pending',
          memo: memo,
          duration: Math.ceil(duration),
          therapy_date: therapyDate || null,
          therapy_time: therapyTime || null,
        })
        .select()
        .single();

      if (sessionErr || !sessionData) {
        throw new Error('세션 생성 실패: ' + (sessionErr?.message || '알 수 없는 에러'));
      }

      const sessionId = sessionData.id;

      // 2. Storage Upload
      const fileExt = selectedFile.name.split('.').pop()?.toLowerCase() || 'wav';
      const storagePath = `${session.user.id}/${selectedClient.id}/${sessionId}_processed_audio.${fileExt}`;

      const { error: uploadErr } = await supabase.storage
        .from('audio-records')
        .upload(storagePath, selectedFile, {
          contentType: selectedFile.type || 'application/octet-stream',
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadErr) {
        await supabase.from('sessions').delete().eq('id', sessionId);
        throw new Error('음성 파일 업로드 실패: ' + uploadErr.message);
      }

      // 3. Trigger Analysis (FastAPI local or Edge Function)
      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      let resultData: any;

      if (isLocalhost) {
        const res = await fetch('/api/functions/analyze', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ session_id: sessionId, duration: duration }),
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error('AI 분석 요청 실패: ' + errText);
        }
        resultData = await res.json();
      } else {
        const { data, error } = await supabase.functions.invoke('analyze', {
          body: { session_id: sessionId, duration: duration },
        });
        if (error) throw error;
        resultData = data;
      }

      // If tied to appointment, auto-update appointment status to COMPLETED
      if (appointmentId) {
        await supabase
          .from('appointments')
          .update({ status: 'COMPLETED', session_id: sessionId })
          .eq('id', appointmentId);
      }

      // Fetch completed result record
      const { data: finalResult } = await supabase
        .from('results')
        .select('*')
        .eq('session_id', sessionId)
        .single();

      if (onAnalysisCompleted && finalResult) {
        onAnalysisCompleted({
          session_id: sessionId,
          appointment_id: appointmentId,
          client_id: selectedClient.id,
          client_name: selectedClient.name,
          chart_number: selectedClient.chart_number || '',
          raw_transcript: finalResult.raw_transcript,
          refined_transcript: finalResult.refined_transcript,
          guide_content: finalResult.guide_content,
          chart_data: finalResult.chart_data,
        });
      }
    } catch (err: any) {
      console.error('Audio analysis error:', err);
      setErrorMessage(err.message || 'AI 분석 처리 중 에러가 발생했습니다.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
      <div className="flex justify-between items-center border-b pb-3">
        <div>
          <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-600" />
            <span>AI 음성 차팅 분석</span>
          </h3>
          <p className="text-xs text-gray-500">고객 음성 녹음과 수기 메모로 SOAP 및 도수치료 기록지를 자동 추출합니다.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowRecordingGuide(true)}
          className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1 font-semibold"
        >
          <HelpCircle className="w-4 h-4" />
          <span>녹음 가이드</span>
        </button>
      </div>

      {errorMessage && (
        <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-lg">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 고객 선택 영역 */}
        <div>
          {selectedClient ? (
            <>
              <div className="bg-indigo-50/70 border border-indigo-200/60 rounded-xl p-3 flex items-center justify-between shadow-sm animate-in fade-in duration-300">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">
                    <User size={16} />
                  </div>
                  <div>
                    <p className="text-xs font-black text-gray-900">{selectedClient.name} 고객님</p>
                    <p className="text-[10px] font-bold text-gray-500">
                      {selectedClient.phone || '연락처 없음'} {selectedClient.chart_number ? `· 차트번호: ${selectedClient.chart_number}` : ''}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedClient(null);
                    setErrorMessage(null);
                  }}
                  className="text-gray-400 hover:text-red-500 p-1.5 transition-colors cursor-pointer"
                  title="고객 변경"
                >
                  <X size={16} />
                </button>
              </div>
              {therapyDate && (
                <div className="bg-indigo-50/70 border border-indigo-100 rounded-xl p-3 flex items-center justify-between text-xs text-indigo-900 font-medium mt-2">
                  <div className="flex items-center gap-2">
                    <span>📅</span>
                    <span>연동된 예약 일시</span>
                  </div>
                  <span className="font-bold bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded-lg">
                    {therapyDate} {therapyTime || ''}
                  </span>
                </div>
              )}
            </>
          ) : (
            <div className="relative" ref={dropdownRef}>
              <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1">
                <Search className="w-3.5 h-3.5 text-indigo-500" />
                <span>차팅 대상 고객 검색 <span className="text-red-500">*</span></span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="이름 또는 전화번호로 검색..."
                  value={clientSearchQuery}
                  onChange={(e) => {
                    setClientSearchQuery(e.target.value);
                    setShowClientDropdown(true);
                  }}
                  onFocus={() => setShowClientDropdown(true)}
                  className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-xs rounded-xl p-2.5 pl-9 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all font-bold"
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              </div>

              {showClientDropdown && (
                <div className="absolute z-30 w-full mt-1.5 bg-white border border-gray-200 rounded-xl shadow-xl max-h-48 overflow-y-auto divide-y divide-gray-100 custom-scrollbar">
                  {filteredClients.length > 0 ? (
                    filteredClients.map(c => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setSelectedClient(c);
                          setClientSearchQuery('');
                          setShowClientDropdown(false);
                          setErrorMessage(null);
                        }}
                        className="w-full text-left px-4 py-2.5 hover:bg-indigo-50/50 flex items-center justify-between text-xs transition cursor-pointer"
                      >
                        <div className="font-bold text-gray-800">{c.name}</div>
                        <div className="text-[10px] text-gray-400 font-medium">{c.phone || '연락처 없음'}</div>
                      </button>
                    ))
                  ) : (
                    <div className="px-4 py-3 text-xs text-gray-400 text-center font-semibold">검색 결과가 없습니다.</div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">치료 직군 선택</label>
          <select
            value={profession}
            onChange={(e) => setProfession(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-xs rounded-xl p-2.5 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer font-bold"
          >
            <option value="pt">물리치료 (PT)</option>
            <option value="ot">작업치료 (OT)</option>
            <option value="st">언어재활 (ST)</option>
            <option value="rehab">기타 재활</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">1. 음성 파일 업로드 (Audio)</label>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-gray-300 hover:border-indigo-500 bg-gray-50/50 rounded-xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2"
          >
            <FileAudio className="w-8 h-8 text-indigo-500" />
            {selectedFile ? (
              <div className="text-xs font-semibold text-gray-800">
                선택된 파일: <span className="text-indigo-600">{selectedFile.name}</span> ({(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)
              </div>
            ) : (
              <div className="text-xs text-gray-500">
                <span className="font-semibold text-indigo-600">음성 파일 선택</span> 또는 여기로 드래그 앤 드롭 하세요.
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1">
            <FileText className="w-3.5 h-3.5" />
            <span>2. 수기기록 추가 메모 (선택)</span>
          </label>
          <textarea
            rows={3}
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="수기로 작성한 치료내용(기법, 부위, VAS 등)을 기재하시면 AI 추출 정밀도가 대폭 향상됩니다..."
            className="w-full bg-gray-50 border border-gray-300 text-gray-900 text-xs rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <button
          type="submit"
          disabled={isAnalyzing || !selectedFile}
          className="w-full bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-bold py-3 px-4 rounded-xl shadow transition flex items-center justify-center gap-2 text-sm disabled:opacity-50"
        >
          {isAnalyzing ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>AI 음성 분석 진행 중... (약 1분 소요)</span>
            </>
          ) : (
            <>
              <Upload className="w-4 h-4" />
              <span>AI 분석 시작하기</span>
            </>
          )}
        </button>
      </form>

      {/* Recording Guide Modal */}
      {showRecordingGuide && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[85vh] overflow-y-auto p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-base font-bold text-gray-900">📋 RE;MOVE Center 도수치료 실전 문진 가이드</h3>
              <button
                onClick={() => setShowRecordingGuide(false)}
                className="text-gray-400 hover:text-gray-600 text-lg font-bold"
              >
                &times;
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="border p-3 rounded-lg bg-indigo-50/40 space-y-2">
                <h4 className="font-bold text-indigo-900 border-b pb-1">PART 1. 고정 루틴 (통증 기본 & 검사)</h4>
                <ul className="space-y-1.5 list-disc list-inside text-gray-700">
                  <li><strong>1. 부위/시기/동반증상</strong>: "어디가 언제부터 아프신가요?"</li>
                  <li><strong>2. 악화/완화요인</strong>: "어떤 자세에서 더 유독 아프신가요?"</li>
                  <li><strong>3. 불편함의 느낌</strong>: "찌릿한가요, 묵직하게 쑤시나요?"</li>
                  <li><strong>4. 방사통 경로</strong>: "팔 다리 밑으로 퍼지는 느낌이 있나요?"</li>
                  <li><strong>5. 통증 크기(VAS)</strong>: "0~10점 중 평균 몇 점 정도 될까요?"</li>
                </ul>
              </div>

              <div className="border p-3 rounded-lg bg-emerald-50/40 space-y-2">
                <h4 className="font-bold text-emerald-900 border-b pb-1">PART 2. 라이프스타일 & 목적</h4>
                <ul className="space-y-1.5 list-disc list-inside text-gray-700">
                  <li><strong>6. 일중 변동</strong>: "아침에 뻣뻣한가요, 저녁에 힘드신가요?"</li>
                  <li><strong>7. 병력 & 수면</strong>: "수술 이력이나 수면 시간은 어떠신가요?"</li>
                  <li><strong>8. 라이프스타일</strong>: "평소 하시는 일과 주로 취하는 자세는?"</li>
                  <li><strong>9. 치료 목적</strong>: "오늘 치료로 이루고 싶은 구체적 목표는?"</li>
                </ul>
              </div>
            </div>
            <div className="text-right pt-2 border-t">
              <button
                onClick={() => setShowRecordingGuide(false)}
                className="bg-indigo-600 text-white font-semibold px-4 py-2 rounded-lg text-xs hover:bg-indigo-700"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
