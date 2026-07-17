import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileAudio, FileText, Sparkles, AlertCircle, HelpCircle, Search, User, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { SessionResult } from '../types/charting';
import { formatKST } from '@/lib/dateUtils';

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
  const [chunkStatuses, setChunkStatuses] = useState<{ [key: number]: string }>({});

  // WAV 파일 포맷 전용 정교한 헤더 복제 물리 슬라이싱 헬퍼 함수
  const sliceWavFile = (file: File, duration: number, chunkDurationSec = 1800): Promise<Blob[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const arrayBuffer = e.target?.result as ArrayBuffer;
          if (arrayBuffer.byteLength < 44) {
            resolve([file]); // 파일이 너무 작으면 슬라이싱 없이 반환
            return;
          }
          
          const header = arrayBuffer.slice(0, 44);
          const dataSize = arrayBuffer.byteLength - 44;
          const numChunks = Math.ceil(duration / chunkDurationSec);
          const chunkSize = Math.floor(dataSize / numChunks);
          
          const blobs: Blob[] = [];
          for (let i = 0; i < numChunks; i++) {
            const start = 44 + (i * chunkSize);
            const end = Math.min(start + chunkSize, arrayBuffer.byteLength);
            const chunkData = arrayBuffer.slice(start, end);
            
            // 새 WAV 바이너리 병합: [헤더] + [조각 데이터]
            const newFileBuffer = new Uint8Array(header.byteLength + chunkData.byteLength);
            newFileBuffer.set(new Uint8Array(header), 0);
            newFileBuffer.set(new Uint8Array(chunkData), header.byteLength);
            
            // 새 WAV 조각 크기에 맞춰 헤더의 크기 필드 재기록 (Little Endian)
            const chunkView = new DataView(newFileBuffer.buffer);
            chunkView.setUint32(4, 36 + chunkData.byteLength, true); // ChunkSize
            chunkView.setUint32(40, chunkData.byteLength, true);     // Subchunk2Size
            
            blobs.push(new Blob([newFileBuffer], { type: 'audio/wav' }));
          }
          resolve(blobs);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error("파일을 읽는 도중 에러가 발생했습니다."));
      reader.readAsArrayBuffer(file);
    });
  };

  // 고객 관리 연동 관련 상태 변수
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 최근 예약 매핑 관련 상태 변수
  const [recentAppointments, setRecentAppointments] = useState<any[]>([]);
  const [selectedAppId, setSelectedAppId] = useState<string>('today');
  const [manualDateTime, setManualDateTime] = useState<{ date: string; time: string } | null>(null);

  // 1-2. 고객 직접 선택 시 최근 예약 이력 5건 실시간 패치
  useEffect(() => {
    if (!selectedClient) {
      setRecentAppointments([]);
      setSelectedAppId('today');
      setManualDateTime(null);
      return;
    }
    
    // 만약 캘린더 연동으로 들어온 경우라면 조회를 스킵합니다.
    if (therapyDate) return;

    const fetchRecentAppointments = async () => {
      try {
        const { data, error } = await supabase
          .from('appointments')
          .select('id, start_time, note')
          .eq('client_id', selectedClient.id)
          .order('start_time', { ascending: false })
          .limit(5);
        if (!error && data) {
          setRecentAppointments(data);
        }
      } catch (err) {
        console.error('최근 예약 목록 조회 실패:', err);
      }
    };
    fetchRecentAppointments();
  }, [selectedClient, therapyDate]);

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
    setChunkStatuses({});
    if (onAnalysisStarted) onAnalysisStarted();

    let sessionSubscription: any = null;

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

      // 연동 예약 일시 또는 수동 드롭다운 일시 판별
      const targetAppId = appointmentId || (selectedAppId !== 'today' ? selectedAppId : null);
      const targetDate = therapyDate || (manualDateTime ? manualDateTime.date : formatKST(new Date(), 'yyyy-MM-dd'));
      const targetTime = therapyTime || (manualDateTime ? manualDateTime.time : formatKST(new Date(), 'HH:mm'));

      // 1. Sessions DB Insert (부모 세션 생성)
      const { data: sessionData, error: sessionErr } = await supabase
        .from('sessions')
        .insert({
          user_id: session.user.id,
          client_id: selectedClient.id,
          appointment_id: targetAppId || null,
          profession: profession,
          client_name: selectedClient.name,
          status: 'pending',
          memo: memo,
          duration: Math.ceil(duration),
          therapy_date: targetDate || null,
          therapy_time: targetTime || null,
        })
        .select()
        .single();

      if (sessionErr || !sessionData) {
        throw new Error('세션 생성 실패: ' + (sessionErr?.message || '알 수 없는 에러'));
      }

      const sessionId = sessionData.id;

      // 2. 오디오 청킹 및 포맷 분기 처리 (컨테이너 깨짐 방지)
      const fileExt = selectedFile.name.split('.').pop()?.toLowerCase() || 'wav';
      let chunks: Blob[] = [];
      
      if (fileExt === 'wav') {
        chunks = await sliceWavFile(selectedFile, duration, 1800);
        console.log(`[WAV Audio Slicing] Sliced into ${chunks.length} chunks.`);
      } else {
        if (duration > 18000) { // 5시간
          throw new Error("WAV가 아닌 포맷(M4A, MP3 등)은 5시간을 초과하여 업로드할 수 없습니다. WAV로 변환 후 올려주시거나 파일을 분할하여 등록해주세요.");
        }
        chunks = [selectedFile];
        console.log(`[Audio Upload] Non-WAV file detected. Uploading as a single chunk.`);
      }

      // 3. Realtime 구독 설정 (chunks 테이블 진행 상태 모니터링)
      sessionSubscription = supabase
        .channel(`session_chunks_${sessionId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'chunks',
            filter: `session_id=eq.${sessionId}`,
          },
          (payload: any) => {
            const updatedChunk = payload.new;
            if (updatedChunk) {
              setChunkStatuses((prev) => ({
                ...prev,
                [updatedChunk.segment_index]: updatedChunk.status,
              }));
            }
          }
        )
        .subscribe();

      // 4. 각 청크별 업로드 및 process-chunk 비동기 호출 실행
      const uploadPromises = chunks.map(async (chunkBlob, index) => {
        setChunkStatuses((prev) => ({ ...prev, [index]: 'uploading' }));
        const storagePath = `${session.user.id}/${sessionId}_chunk_${index}.${fileExt}`;

        // Storage 업로드
        const { error: uploadErr } = await supabase.storage
          .from('audio-records')
          .upload(storagePath, chunkBlob, {
            contentType: selectedFile.type || 'application/octet-stream',
            cacheControl: '3600',
            upsert: true,
          });

        if (uploadErr) {
          setChunkStatuses((prev) => ({ ...prev, [index]: 'failed' }));
          throw new Error(`청크 ${index} 업로드 실패: ${uploadErr.message}`);
        }

        // Public URL 가져오기
        const { data: urlData } = supabase.storage
          .from('audio-records')
          .getPublicUrl(storagePath);

        const publicUrl = urlData?.publicUrl;
        if (!publicUrl) {
          throw new Error(`청크 ${index} Public URL 획득 실패`);
        }

        // DB chunks에 등록
        const { data: dbChunk, error: chunkInsertErr } = await supabase
          .from('chunks')
          .insert({
            session_id: sessionId,
            segment_index: index,
            file_path: publicUrl,
            status: 'uploaded',
          })
          .select()
          .single();

        if (chunkInsertErr || !dbChunk) {
          throw new Error(`청크 ${index} DB 등록 실패: ${chunkInsertErr?.message}`);
        }

        setChunkStatuses((prev) => ({ ...prev, [index]: 'uploaded' }));

        // process-chunk Edge Function 트리거
        const { error: invokeErr } = await supabase.functions.invoke('process-chunk', {
          body: { chunk_id: dbChunk.id, file_path: publicUrl },
        });

        if (invokeErr) {
          throw new Error(`청크 ${index} Edge Function 호출 실패: ${invokeErr.message}`);
        }
      });

      // 모든 업로드 및 트리거 대기
      await Promise.all(uploadPromises);

      // 세션 상태를 'processing'으로 업데이트
      await supabase
        .from('sessions')
        .update({ status: 'processing' })
        .eq('id', sessionId);

      // If tied to appointment, auto-update appointment status to COMPLETED
      if (appointmentId) {
        await supabase
          .from('appointments')
          .update({ status: 'COMPLETED', session_id: sessionId })
          .eq('id', appointmentId);
      }

      // 5. 모든 청크 분석 결과가 완료될 때까지 대기 (폴링 방식으로 수신 체크)
      let allCompleted = false;
      let finalResultData: any = null;
      let retryCount = 0;
      const maxRetries = 120; // 최대 10분 대기 (5초 간격)

      while (!allCompleted && retryCount < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        retryCount++;

        // 세션 완료 여부 확인
        const { data: currentSession } = await supabase
          .from('sessions')
          .select('status')
          .eq('id', sessionId)
          .single();

        if (currentSession?.status === 'completed') {
          allCompleted = true;
          // 최종 결과 가져오기
          const { data: finalResult } = await supabase
            .from('results')
            .select('*')
            .eq('session_id', sessionId);

          if (finalResult && finalResult.length > 0) {
            // 여러 청크의 전사본과 차트 데이터를 종합 병합
            const rawTranscripts = finalResult.map(r => r.raw_transcript || '').join('\n\n');
            const refinedTranscripts = finalResult.map(r => r.refined_transcript || '').join('\n\n');
            const guides = finalResult.map(r => r.guide_content || '').join('\n\n');
            
            // SOAP 차트는 첫 번째 청크의 구조를 기반으로 병합 또는 수집
            const mergedChart = finalResult[0].chart_data || {};

            finalResultData = {
              session_id: sessionId,
              appointment_id: appointmentId,
              client_id: selectedClient.id,
              client_name: selectedClient.name,
              chart_number: selectedClient.chart_number || '',
              raw_transcript: rawTranscripts,
              refined_transcript: refinedTranscripts,
              guide_content: guides,
              chart_data: mergedChart,
            };
          }
        } else if (currentSession?.status === 'failed') {
          throw new Error('AI 분석 처리 중 오류가 발생하여 실패 처리되었습니다.');
        }
      }

      if (!allCompleted || !finalResultData) {
        throw new Error('AI 분석 처리 대기 시간을 초과했습니다. 잠시 후 히스토리에서 결과를 확인해 주세요.');
      }

      if (onAnalysisCompleted) {
        onAnalysisCompleted(finalResultData);
      }

    } catch (err: any) {
      console.error('Audio analysis error:', err);
      setErrorMessage(err.message || 'AI 분석 처리 중 에러가 발생했습니다.');
    } finally {
      setIsAnalyzing(false);
      if (sessionSubscription) {
        supabase.removeChannel(sessionSubscription);
      }
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
          <p className="text-xs text-gray-500">고객 음성 녹음과 수기 메모로 SOAP 및 도수재활세션 기록지를 자동 추출합니다.</p>
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
              {therapyDate ? (
                <div className="bg-indigo-50/70 border border-indigo-100 rounded-xl p-3 flex items-center justify-between text-xs text-indigo-900 font-medium mt-2">
                  <div className="flex items-center gap-2">
                    <span>📅</span>
                    <span>연동된 예약 일시</span>
                  </div>
                  <span className="font-bold bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded-lg">
                    {therapyDate} {therapyTime || ''}
                  </span>
                </div>
              ) : (
                <div className="bg-amber-50/70 border border-amber-200/60 rounded-xl p-3 space-y-2 text-xs mt-2">
                  <div className="flex justify-between items-center text-amber-900 font-bold">
                    <span>📅 차팅 세션 예약 매핑</span>
                    <span className="text-[10px] text-amber-500 font-medium">* 필수 선택</span>
                  </div>
                  <select
                    value={selectedAppId}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedAppId(val);
                      if (val === 'today' || val === '') {
                        setManualDateTime(null);
                      } else {
                        const matched = recentAppointments.find(a => a.id === val);
                        if (matched) {
                          const yyyyMMdd = matched.start_time.split('T')[0];
                          const hhmm = matched.start_time.split('T')[1].substring(0, 5);
                          setManualDateTime({ date: yyyyMMdd, time: hhmm });
                        }
                      }
                    }}
                    className="w-full bg-white border border-amber-200 rounded-lg p-2 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-amber-400 font-semibold"
                  >
                    <option value="today">☀️ 오늘 현재 일시로 새 차팅 생성</option>
                    {recentAppointments.map((app) => {
                      const dateStr = app.start_time.split('T')[0];
                      const timeStr = app.start_time.split('T')[1].substring(0, 5);
                      return (
                        <option key={app.id} value={app.id}>
                          {dateStr} {timeStr} ({app.note ? `${app.note.substring(0, 10)}...` : '재활세션 예약'})
                        </option>
                      );
                    })}
                  </select>
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
          <label className="block text-xs font-semibold text-gray-700 mb-1">재활 직군 선택</label>
          <select
            value={profession}
            onChange={(e) => setProfession(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-xs rounded-xl p-2.5 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer font-bold"
          >
            <option value="pt">물리재활 (PT)</option>
            <option value="ot">작업재활 (OT)</option>
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
            placeholder="수기로 작성한 세션내용(기법, 부위, VAS 등)을 기재하시면 AI 추출 정밀도가 대폭 향상됩니다..."
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

        {Object.keys(chunkStatuses).length > 0 && (
          <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 space-y-2 mt-4 animate-in fade-in duration-300">
            <h4 className="text-xs font-black text-gray-700 flex items-center gap-1.5">
              <span>📦</span>
              <span>세션 청크 분석 진행 현황</span>
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {Object.entries(chunkStatuses).map(([index, status]) => {
                let statusColor = 'bg-gray-100 text-gray-500';
                let statusLabel = '대기 중';
                if (status === 'uploading') {
                  statusColor = 'bg-blue-50 text-blue-600 border border-blue-200 animate-pulse';
                  statusLabel = '업로드 중';
                } else if (status === 'uploaded') {
                  statusColor = 'bg-blue-100 text-blue-800 border border-blue-200';
                  statusLabel = '업로드 완료';
                } else if (status === 'queued') {
                  statusColor = 'bg-amber-50 text-amber-600 border border-amber-200';
                  statusLabel = 'STT 대기';
                } else if (status === 'processing') {
                  statusColor = 'bg-amber-100 text-amber-800 border border-amber-300';
                  statusLabel = 'AI 분석 중';
                } else if (status === 'done') {
                  statusColor = 'bg-emerald-100 text-emerald-800 border border-emerald-300';
                  statusLabel = '완료';
                } else if (status === 'failed') {
                  statusColor = 'bg-rose-100 text-rose-800 border border-rose-300';
                  statusLabel = '실패';
                }

                return (
                  <div key={index} className={`flex items-center justify-between p-2 rounded-lg text-[10px] font-bold ${statusColor}`}>
                    <span>#{Number(index) + 1} 청크</span>
                    <span>{statusLabel}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </form>

      {/* Recording Guide Modal */}
      {showRecordingGuide && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[85vh] overflow-y-auto p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-base font-bold text-gray-900">📋 운동센터 도수재활세션 실전 상담 가이드</h3>
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
                  <li><strong>9. 재활세션 목적</strong>: "오늘 재활세션으로 이루고 싶은 구체적 목표는?"</li>
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
