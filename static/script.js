document.addEventListener('DOMContentLoaded', async () => {
    // Supabase 설정 및 초기화
    let supabase = null;
    
    // UI Elements
    const dropZoneElement = document.getElementById('drop-zone');
    const inputElement = document.getElementById('file-input');
    const submitBtn = document.getElementById('submit-btn');
    const form = document.getElementById('upload-form');
    const loadingIndicator = document.getElementById('loading-indicator');
    const resultsSection = document.getElementById('results-section');
    const memoInput = document.getElementById('memo-input');
    const professionSelect = document.getElementById('profession');
    
    // Auth Elements
    const userInfo = document.getElementById('user-info');
    const authButtons = document.getElementById('auth-buttons');
    const userEmailSpan = document.getElementById('user-email');
    const quotaRemaining = document.getElementById('quota-remaining');
    const quotaLimitVal = document.getElementById('quota-limit');
    const openLoginBtn = document.getElementById('open-login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const chargeBtn = document.getElementById('charge-btn');
    
    const authModal = document.getElementById('auth-modal');
    const closeAuthBtn = document.getElementById('close-auth-btn');
    const authForm = document.getElementById('auth-form');
    const authTitle = document.getElementById('auth-title');
    const authSubmitBtn = document.getElementById('auth-submit-btn');
    const toggleAuthModeBtn = document.getElementById('toggle-auth-mode-btn');
    const signupNameGroup = document.getElementById('signup-name-group');
    const signupProfessionGroup = document.getElementById('signup-profession-group');
    
    // History Elements
    const historyList = document.getElementById('history-list');
    const refreshHistoryBtn = document.getElementById('refresh-history-btn');
    
    // Guide Modal elements
    const guideModal = document.getElementById('guide-modal');
    const openGuideBtn = document.getElementById('open-guide-btn');
    const closeGuideBtn = document.getElementById('close-guide-btn');
    
    // Result elements
    const chartContent = document.getElementById('chart-content');
    const guideContent = document.getElementById('guide-content');
    const transcriptContent = document.getElementById('transcript-content');
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    const copyBtn = document.getElementById('copy-btn');
    const downloadCsvBtn = document.getElementById('download-csv-btn');
    
    let lastResultData = null; // Store last analysis result for export
    let isSignUpMode = false;
    let pollingInterval = null;

    // 1. Supabase Client 동적 초기화
    try {
        const configRes = await fetch('/api/config');
        const config = await configRes.json();
        
        if (config.supabase_url && config.supabase_anon_key && !config.supabase_url.includes("your-project")) {
            supabase = supabase.createClient(config.supabase_url, config.supabase_anon_key);
            console.log("Supabase Client initialized successfully.");
        } else {
            // 로컬 디버깅용 가짜 Supabase 클라이언트 Mocking (개발용 안전장치)
            console.warn("Warning: Using Mock Supabase Client because credentials are placeholder or missing.");
            setupMockSupabase();
        }
    } catch (err) {
        console.error("Failed to initialize Supabase:", err);
        setupMockSupabase();
    }

    // 2. 인증 상태 체크 및 UI 초기화
    initAuthListener();

    function setupMockSupabase() {
        // 백엔드에서 SUPABASE_JWT_SECRET이 비어있는 경우, 로컬 테스트를 유연하게 하기 위해 가짜 클라이언트를 흉내냅니다.
        let loggedInUser = localStorage.getItem('mock_user_email') || null;
        let mockToken = localStorage.getItem('mock_token') || null;
        
        supabase = {
            auth: {
                getSession: async () => {
                    if (loggedInUser && mockToken) {
                        return { data: { session: { access_token: mockToken, user: { email: loggedInUser } } } };
                    }
                    return { data: { session: null } };
                },
                signInWithPassword: async ({ email, password }) => {
                    localStorage.setItem('mock_user_email', email);
                    localStorage.setItem('mock_token', '00000000-0000-0000-0000-000000000000'); // Dummy UUID Token
                    loggedInUser = email;
                    mockToken = '00000000-0000-0000-0000-000000000000';
                    authListenerCallback();
                    return { data: { user: { email } }, error: null };
                },
                signUp: async ({ email, password, options }) => {
                    localStorage.setItem('mock_user_email', email);
                    localStorage.setItem('mock_token', '00000000-0000-0000-0000-000000000000');
                    loggedInUser = email;
                    mockToken = '00000000-0000-0000-0000-000000000000';
                    authListenerCallback();
                    return { data: { user: { email } }, error: null };
                },
                signOut: async () => {
                    localStorage.removeItem('mock_user_email');
                    localStorage.removeItem('mock_token');
                    loggedInUser = null;
                    mockToken = null;
                    authListenerCallback();
                    return { error: null };
                },
                onAuthStateChange: (callback) => {
                    authListenerCallback = () => {
                        if (loggedInUser && mockToken) {
                            callback("SIGNED_IN", { user: { email: loggedInUser }, access_token: mockToken });
                        } else {
                            callback("SIGNED_OUT", null);
                        }
                    };
                    // 최초 1회 실행
                    setTimeout(authListenerCallback, 100);
                    return { data: { subscription: { unsubscribe: () => {} } } };
                }
            }
        };
    }

    let authListenerCallback = () => {};

    // 인증 헤더 획득 함수
    async function getAuthHeaders() {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            return {
                'Authorization': `Bearer ${session.access_token}`
            };
        }
        return {};
    }

    function initAuthListener() {
        supabase.auth.onAuthStateChange(async (event, session) => {
            if (session) {
                // 로그인 완료 상태
                const user = session.user;
                userEmailSpan.textContent = user.email;
                userInfo.classList.remove('hidden');
                authButtons.classList.add('hidden');
                authModal.classList.add('hidden');
                
                // 서비스 활성화
                submitBtn.disabled = !inputElement.files.length;
                
                // 프로필 정보(Quota) 및 이력 로드
                await updateProfileInfo();
                await loadHistory();
            } else {
                // 로그아웃 상태
                userInfo.classList.add('hidden');
                authButtons.classList.remove('hidden');
                
                // 업로드 비활성화 및 화면 초기화
                submitBtn.disabled = true;
                resultsSection.classList.add('hidden');
                historyList.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 2rem 0; font-size: 0.9rem;">로그인 후 사용 이력을 불러옵니다.</div>`;
            }
        });
    }

    // 사용자 프로필 및 Quota 정보 업데이트
    async function updateProfileInfo() {
        try {
            const headers = await getAuthHeaders();
            const res = await fetch('/api/profile', { headers });
            
            if (res.ok) {
                const profile = await res.json();
                quotaRemaining.textContent = profile.quota_limit - profile.quota_used;
                quotaLimitVal.textContent = profile.quota_limit;
                
                // 만약 quota 소진 시 UI 경고
                if (profile.quota_limit - profile.quota_used <= 0) {
                    quotaRemaining.style.color = '#ef4444';
                } else {
                    quotaRemaining.style.color = 'var(--primary)';
                }
            }
        } catch (err) {
            console.error("Failed to load profile:", err);
        }
    }

    // 가상 충전 처리
    chargeBtn.addEventListener('click', async () => {
        try {
            const headers = await getAuthHeaders();
            const res = await fetch('/api/profile/charge', {
                method: 'POST',
                headers: {
                    ...headers,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ amount: 10 }) // 10회 추가
            });
            
            const result = await res.json();
            if (res.ok) {
                alert(result.message);
                await updateProfileInfo();
            } else {
                alert("충전에 실패했습니다: " + result.detail);
            }
        } catch (err) {
            console.error(err);
            alert("통신 중 오류가 발생했습니다.");
        }
    });

    // 3. 로그인 / 가입 모달 동작 제어
    openLoginBtn.addEventListener('click', () => {
        isSignUpMode = false;
        updateAuthModalUI();
        authModal.classList.remove('hidden');
    });

    closeAuthBtn.addEventListener('click', () => {
        authModal.classList.add('hidden');
    });

    toggleAuthModeBtn.addEventListener('click', () => {
        isSignUpMode = !isSignUpMode;
        updateAuthModalUI();
    });

    function updateAuthModalUI() {
        if (isSignUpMode) {
            authTitle.textContent = "회원가입";
            authSubmitBtn.textContent = "가입하기";
            toggleAuthModeBtn.textContent = "이미 계정이 있으신가요? 로그인";
            signupNameGroup.classList.remove('hidden');
            signupProfessionGroup.classList.remove('hidden');
        } else {
            authTitle.textContent = "로그인";
            authSubmitBtn.textContent = "로그인";
            toggleAuthModeBtn.textContent = "계정이 없으신가요? 회원가입";
            signupNameGroup.classList.add('hidden');
            signupProfessionGroup.classList.add('hidden');
        }
    }

    // 로그인 / 가입 폼 제출
    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('auth-email').value;
        const password = document.getElementById('auth-password').value;
        
        authSubmitBtn.disabled = true;
        authSubmitBtn.textContent = isSignUpMode ? "가입 중..." : "로그인 중...";

        try {
            if (isSignUpMode) {
                const name = document.getElementById('auth-name').value;
                const profession = document.getElementById('auth-profession').value;
                
                const { data, error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: { name, profession }
                    }
                });
                
                if (error) throw error;
                alert("회원가입 성공! 로그인 상태로 전환됩니다.");
            } else {
                const { data, error } = await supabase.auth.signInWithPassword({
                    email,
                    password
                });
                
                if (error) throw error;
            }
        } catch (err) {
            console.error(err);
            alert("인증 오류가 발생했습니다: " + err.message);
        } finally {
            authSubmitBtn.disabled = false;
            updateAuthModalUI();
        }
    });

    // 로그아웃
    logoutBtn.addEventListener('click', async () => {
        if (confirm("로그아웃 하시겠습니까?")) {
            await supabase.auth.signOut();
        }
    });

    // 4. 드래그 앤 드롭 파일 인터랙션
    dropZoneElement.addEventListener('click', () => {
        // 로그인 상태일 때만 인풋 활성화
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) {
                inputElement.click();
            } else {
                alert("로그인이 필요한 서비스입니다.");
                openLoginBtn.click();
            }
        });
    });

    inputElement.addEventListener('change', () => {
        if (inputElement.files.length) {
            updateThumbnail(dropZoneElement, inputElement.files[0]);
            submitBtn.disabled = false;
        } else {
            submitBtn.disabled = true;
        }
    });

    dropZoneElement.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZoneElement.classList.add('drop-zone--over');
    });

    ['dragleave', 'dragend'].forEach(type => {
        dropZoneElement.addEventListener(type, () => {
            dropZoneElement.classList.remove('drop-zone--over');
        });
    });

    dropZoneElement.addEventListener('drop', (e) => {
        e.preventDefault();
        if (e.dataTransfer.files.length) {
            inputElement.files = e.dataTransfer.files;
            updateThumbnail(dropZoneElement, e.dataTransfer.files[0]);
            submitBtn.disabled = false;
        }
        dropZoneElement.classList.remove('drop-zone--over');
    });

    function updateThumbnail(dropZoneElement, file) {
        let promptElement = dropZoneElement.querySelector('.drop-zone__prompt');
        if (promptElement) {
            promptElement.innerHTML = `<strong>선택됨:</strong><br>${file.name}<br><small>(${Math.round(file.size / 1024 / 1024 * 100) / 100} MB)</small>`;
            promptElement.style.color = 'var(--primary)';
        }
    }

    // 녹음 가이드 모달 인터랙션
    openGuideBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        guideModal.classList.remove('hidden');
    });

    closeGuideBtn.addEventListener('click', () => {
        guideModal.classList.add('hidden');
    });

    window.addEventListener('click', (e) => {
        if (e.target === guideModal) {
            guideModal.classList.add('hidden');
        }
        if (e.target === authModal) {
            authModal.classList.add('hidden');
        }
    });

    // 5. 비동기 업로드 및 폴링 메커니즘
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (!inputElement.files.length) return;
        
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            alert("로그인이 만료되었거나 로그인이 필요한 기능입니다.");
            openLoginBtn.click();
            return;
        }

        const formData = new FormData(form);
        
        // UI 잠금 및 로딩 상태
        submitBtn.disabled = true;
        dropZoneElement.style.pointerEvents = 'none';
        loadingIndicator.classList.remove('hidden');
        resultsSection.classList.add('hidden');

        try {
            const headers = await getAuthHeaders();
            const response = await fetch('/api/sessions/analyze', {
                method: 'POST',
                headers: headers,
                body: formData
            });

            const result = await response.json();

            if (response.ok && result.status === 'success') {
                const sessionId = result.session_id;
                // 이전 차팅 내역 새로고침
                await loadHistory();
                // 3초 간격 폴링 루프 가동
                startPollingSession(sessionId);
            } else {
                alert('오류 발생: ' + (result.detail || result.message || '서버 오류'));
                resetUploadUI();
            }
        } catch (error) {
            alert('서버와 통신 중 오류가 발생했습니다.');
            console.error(error);
            resetUploadUI();
        }
    });

    function resetUploadUI() {
        loadingIndicator.classList.add('hidden');
        submitBtn.disabled = false;
        dropZoneElement.style.pointerEvents = 'auto';
    }

    // 분석 작업 진행 상태 폴링 함수
    function startPollingSession(sessionId) {
        if (pollingInterval) clearInterval(pollingInterval);
        
        pollingInterval = setInterval(async () => {
            try {
                const headers = await getAuthHeaders();
                const res = await fetch(`/api/sessions/${sessionId}`, { headers });
                
                if (res.ok) {
                    const session = await res.json();
                    
                    // 과거 이력 리스트의 아이템 상태를 동기화
                    updateHistoryItemStatus(sessionId, session.status);
                    
                    if (session.status === 'completed') {
                        clearInterval(pollingInterval);
                        pollingInterval = null;
                        
                        // 결과 렌더링
                        lastResultData = session.results;
                        displayResults(session.results);
                        
                        // 사용량(Quota) 및 이력 리스트 정보 갱신
                        await updateProfileInfo();
                        await loadHistory();
                        
                        resetUploadUI();
                    } else if (session.status === 'failed') {
                        clearInterval(pollingInterval);
                        pollingInterval = null;
                        alert("AI 분석 도중 에러가 발생했습니다. 오디오 파일을 다시 확인해 주세요.");
                        await loadHistory();
                        resetUploadUI();
                    }
                } else {
                    console.error("Polling error: ", res.status);
                }
            } catch (err) {
                console.error("Polling fetch failed:", err);
            }
        }, 3000); // 3초 간격
    }

    // 6. 히스토리(이력) 목록 제어
    async function loadHistory() {
        try {
            const headers = await getAuthHeaders();
            const res = await fetch('/api/sessions', { headers });
            
            if (res.ok) {
                const sessions = await res.json();
                renderHistoryList(sessions);
            }
        } catch (err) {
            console.error("Failed to load history:", err);
        }
    }

    refreshHistoryBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        const originalText = refreshHistoryBtn.textContent;
        refreshHistoryBtn.textContent = "로드중...";
        refreshHistoryBtn.disabled = true;
        
        await loadHistory();
        
        refreshHistoryBtn.textContent = originalText;
        refreshHistoryBtn.disabled = false;
    });

    function renderHistoryList(sessions) {
        if (!sessions || sessions.length === 0) {
            historyList.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 2rem 0; font-size: 0.9rem;">분석된 이력이 없습니다.</div>`;
            return;
        }

        historyList.innerHTML = sessions.map(session => {
            const formattedDate = new Date(session.created_at).toLocaleString('ko-KR', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            const statusKor = {
                pending: '대기',
                processing: '분석중',
                completed: '완료',
                failed: '실패'
            }[session.status] || session.status;

            return `
                <div class="history-item" data-id="${session.id}">
                    <div class="history-meta">
                        <span class="history-patient" title="${session.patient_name}">${session.patient_name}</span>
                        <span class="status-badge status-${session.status}">${statusKor}</span>
                    </div>
                    <div class="history-meta" style="margin-top: 4px;">
                        <span>직군: ${session.profession.toUpperCase()}</span>
                        <span>${formattedDate}</span>
                    </div>
                </div>
            `;
        }).join('');

        // 각 이력 아이템 클릭 시 결과 로드 바인딩
        document.querySelectorAll('.history-item').forEach(item => {
            item.addEventListener('click', async () => {
                // 활성화 클래스 변경
                document.querySelectorAll('.history-item').forEach(el => el.classList.remove('active'));
                item.classList.add('active');
                
                const sessionId = item.getAttribute('data-id');
                await loadSessionDetail(sessionId);
            });
        });
    }

    function updateHistoryItemStatus(sessionId, status) {
        const item = document.querySelector(`.history-item[data-id="${sessionId}"]`);
        if (item) {
            const badge = item.querySelector('.status-badge');
            if (badge) {
                const statusKor = {
                    pending: '대기',
                    processing: '분석중',
                    completed: '완료',
                    failed: '실패'
                }[status] || status;
                
                badge.className = `status-badge status-${status}`;
                badge.textContent = statusKor;
            }
        }
    }

    // 개별 세션 데이터 상세 정보 조회 및 결과창 연동
    async function loadSessionDetail(sessionId) {
        try {
            const headers = await getAuthHeaders();
            const res = await fetch(`/api/sessions/${sessionId}`, { headers });
            
            if (res.ok) {
                const session = await res.json();
                
                // 만약 현재 이 세션이 분석 중인 경우 폴링 가동
                if (session.status === 'pending' || session.status === 'processing') {
                    // UI 잠그고 로더 실행
                    submitBtn.disabled = true;
                    dropZoneElement.style.pointerEvents = 'none';
                    loadingIndicator.classList.remove('hidden');
                    resultsSection.classList.add('hidden');
                    startPollingSession(sessionId);
                } else if (session.status === 'completed') {
                    lastResultData = session.results;
                    displayResults(session.results);
                    resultsSection.classList.remove('hidden');
                } else {
                    alert("해당 세션은 분석 도중 실패했습니다.");
                    resultsSection.classList.add('hidden');
                }
            }
        } catch (err) {
            console.error("Failed to load session details:", err);
        }
    }

    // 결과 렌더링 함수
    function displayResults(results) {
        if (!results) return;

        // 임상 차트 렌더링
        if (results.chart_data) {
            renderChart(results.chart_data, chartContent);
        }
        
        // 환자 가이드 렌더링 (Markdown -> HTML)
        if (results.guide_content) {
            guideContent.innerHTML = marked.parse(results.guide_content);
        }
        
        // 보정 녹취록 렌더링
        if (results.refined_transcript) {
            transcriptContent.textContent = results.refined_transcript;
        }

        // 결과창 숨김 해제
        resultsSection.classList.remove('hidden');
        lucide.createIcons();
    }

    // 7. 결과 탭 제어 로직
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active classes
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            // Add active class to clicked
            btn.classList.add('active');
            const tabId = btn.getAttribute('data-tab');
            document.getElementById(`tab-${tabId}`).classList.add('active');
        });
    });

    // 클립보드 복사 로직
    copyBtn.addEventListener('click', () => {
        const activeTab = document.querySelector('.tab-content.active');
        if (!activeTab) return;

        const textToCopy = activeTab.innerText;

        navigator.clipboard.writeText(textToCopy).then(() => {
            const originalContent = copyBtn.innerHTML;
            copyBtn.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                복사 완료!
            `;
            
            setTimeout(() => {
                copyBtn.innerHTML = originalContent;
            }, 2000);
        }).catch(err => {
            console.error('복사 실패:', err);
            alert('복사 중 오류가 발생했습니다.');
        });
    });

    // CSV 파일 다운로드 기능
    downloadCsvBtn.addEventListener('click', () => {
        if (!lastResultData) return;

        const rows = [
            ["항목", "내용"]
        ];

        // 1. Add chart items to rows
        if (lastResultData.chart_data && lastResultData.chart_data.clinical_record) {
            const cr = lastResultData.chart_data.clinical_record;
            const sections = {
                subjective: "S. 주관적 소견",
                objective: "O. 객관적 소견",
                assessment: "A. 평가",
                plan: "P. 계획"
            };

            for (const [secKey, secName] of Object.entries(sections)) {
                if (cr[secKey]) {
                    for (const [key, value] of Object.entries(cr[secKey])) {
                        const keyLabel = {
                            chief_complaint: '주호소',
                            pain_scale: '통증 척도',
                            aggravating_easing_factors: '악화/완화 요인',
                            precautions_contraindications: '주의/금기사항',
                            observation_posture: '시각적 관찰',
                            physical_examination: '기능 검사 및 평가',
                            therapist_diagnosis: '치료사 진단',
                            ai_diagnosis_inferred: 'AI 진단',
                            clinical_impression: '임상적 추론',
                            progress: '경과 및 호전도',
                            treatment_performed: '수행된 중재',
                            home_exercise: '자가 운동',
                            future_plan: '향후 계획'
                        }[key] || key;
                        
                        rows.push([`${secName} - ${keyLabel}`, Array.isArray(value) ? value.join(", ") : value]);
                    }
                }
            }
        }

        // 2. Add guide and transcript
        rows.push(["환자 가이드", lastResultData.guide_content || ""]);
        rows.push(["보정 녹취록", lastResultData.refined_transcript || ""]);

        // CSV content generation
        let csvContent = "\uFEFF"; // BOM
        rows.forEach(row => {
            const processedRow = row.map(val => {
                let cell = val === null || val === undefined ? "" : String(val);
                cell = cell.replace(/"/g, '""');
                if (cell.search(/("|,|\n)/g) >= 0) {
                    cell = `"${cell}"`;
                }
                return cell;
            });
            csvContent += processedRow.join(",") + "\r\n";
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `차팅결과_${new Date().getTime()}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    // 임상 차트(SOAP) 구조화 렌더링 헬퍼
    function renderChart(chartData, container) {
        const labels = {
            subjective: 'S. 주관적 소견 (Subjective)',
            chief_complaint: '주호소',
            pain_scale: '통증 척도',
            aggravating_easing_factors: '악화/완화 요인',
            precautions_contraindications: '주의/금기사항',
            objective: 'O. 객관적 소견 (Objective)',
            observation_posture: '시각적 관찰',
            physical_examination: '기능 검사 및 평가',
            assessment: 'A. 평가 (Assessment)',
            therapist_diagnosis: '치료사 진단 (음성 녹취 기반)',
            ai_diagnosis_inferred: 'AI 진단 (문맥 기반 추론)',
            clinical_impression: '임상적 추론',
            progress: '경과 및 호전도',
            plan: 'P. 치료 계획 (Plan)',
            treatment_performed: '수행된 중재',
            home_exercise: '자가 운동 (HEP)',
            future_plan: '향후 계획',
            rapport_data: '🤝 라포 데이터 (Rapport)',
            personal_background: '개인 배경 (가족/직업/취미 등)',
            patient_preferences: '환자 선호도',
            psychosocial_factors: '심리사회적 요인',
            compliance_attitude: '순응도 및 태도',
            upcoming_events: '향후 일정 (여행/행사 등)',
            follow_up_cues: '다음 방문 시 참고사항'
        };

        let md = "";

        const addSection = (titleKey, contentObj) => {
            if (!contentObj) return;
            md += `### ${labels[titleKey] || titleKey}\n`;
            for (const [key, value] of Object.entries(contentObj)) {
                const label = labels[key] || key;
                let valStr = "언급 없음";
                
                if (Array.isArray(value)) {
                    if (value.length > 0) {
                        valStr = value.join(", ");
                    }
                } else if (value && value !== "언급 없음") {
                    valStr = value;
                }
                
                md += `* **${label}**: ${valStr}\n`;
            }
            md += "\n";
        };

        if (chartData.clinical_record) {
            const cr = chartData.clinical_record;
            addSection('subjective', cr.subjective);
            addSection('objective', cr.objective);
            addSection('assessment', cr.assessment);
            addSection('plan', cr.plan);
        }

        md += `### 🚨 위험 징후 (Red Flags)\n`;
        if (chartData.red_flags_detected && chartData.red_flags_detected.length > 0) {
            chartData.red_flags_detected.forEach(v => {
                md += `* <span style="color: #ef4444; font-weight: bold;">${v}</span>\n`;
            });
        } else {
            md += `* 해당 없음\n`;
        }
        md += "\n";

        if (chartData.rapport_data) {
            addSection('rapport_data', chartData.rapport_data);
        }

        container.className = 'markdown-body';
        container.innerHTML = marked.parse(md);
    }
});
