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
    const formSection = document.getElementById('form-section');
    const newSessionBtn = document.getElementById('new-session-btn');
    const memoInput = document.getElementById('memo-input');
    const professionSelect = document.getElementById('profession');
    
    // Patient Elements
    const patientSelect = document.getElementById('patient-select');
    const patientSelectContainer = document.getElementById('patient-select-container');
    const patientSelectTrigger = document.getElementById('patient-select-trigger');
    const patientSearchInput = document.getElementById('patient-search-input');
    const patientSelectOptions = document.getElementById('patient-select-options');
    const selectedPatientCard = document.getElementById('selected-patient-card');
    const selectedPatientCardName = document.getElementById('selected-patient-card-name');
    const selectedPatientCardMeta = document.getElementById('selected-patient-card-meta');
    
    const openRegisterPatientBtn = document.getElementById('open-register-patient-btn');
    const patientRegisterModal = document.getElementById('patient-register-modal');
    const closePatientModalBtn = document.getElementById('close-patient-modal-btn');
    const patientRegisterForm = document.getElementById('patient-register-form');
    const patientNameInput = document.getElementById('patient-name');
    const patientBirthInput = document.getElementById('patient-birth');
    const patientGenderSelect = document.getElementById('patient-gender');
    const patientChartNumberInput = document.getElementById('patient-chart-number');
    const historyPatientFilter = document.getElementById('history-patient-filter');
    const historySearchInput = document.getElementById('history-search');
    
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
    let isLoggedIn = false;

    // Default Supabase Config (Fallback for 100% serverless static hosting)
    let supabaseUrl = "https://tjabxdtuotydkksqonkq.supabase.co";
    let supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRqYWJ4ZHR1b3R5ZGtrc3FvbmtxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1NTg2NjAsImV4cCI6MjA5NjEzNDY2MH0.TBKb0iU3au0kS-K7aEHn56111fJ3F1fVpbbQysdvhCg";

    // 1. Supabase Client 동적 초기화
    try {
        try {
            const configRes = await fetch('/api/config');
            if (configRes.ok) {
                const config = await configRes.json();
                if (config.supabase_url && config.supabase_anon_key && !config.supabase_url.includes("your-project")) {
                    supabaseUrl = config.supabase_url;
                    supabaseAnonKey = config.supabase_anon_key;
                }
            }
        } catch (err) {
            console.warn("Could not fetch /api/config, using default credentials:", err);
        }

        if (supabaseUrl && supabaseAnonKey) {
            supabase = window.supabase.createClient(supabaseUrl, supabaseAnonKey);
            console.log("Supabase Client initialized successfully.");
        } else {
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
                    setTimeout(authListenerCallback, 100);
                    return { data: { subscription: { unsubscribe: () => {} } } };
                }
            }
        };
    }

    let authListenerCallback = () => {};

    // Audio preprocessing helper (16kHz Mono WAV)
    async function preprocessAudioFile(file) {
        const arrayBuffer = await file.arrayBuffer();
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const decodedData = await audioCtx.decodeAudioData(arrayBuffer);
        
        const targetSampleRate = 16000;
        const offlineCtx = new OfflineAudioContext(
            1,
            Math.round(decodedData.duration * targetSampleRate),
            targetSampleRate
        );
        
        const source = offlineCtx.createBufferSource();
        source.buffer = decodedData;
        source.connect(offlineCtx.destination);
        source.start();
        
        const renderedBuffer = await offlineCtx.startRendering();
        
        // 16-bit PCM WAV encoding
        const buffer = renderedBuffer;
        const numOfChan = buffer.numberOfChannels;
        const sampleRate = buffer.sampleRate;
        const format = 1; // 1 = raw PCM
        const bitDepth = 16;
        
        const result = buffer.getChannelData(0);
        
        // Peak normalization to 0.95
        let maxVal = 0;
        for (let i = 0; i < result.length; i++) {
            const abs = Math.abs(result[i]);
            if (abs > maxVal) maxVal = abs;
        }
        if (maxVal > 0) {
            const scale = 0.95 / maxVal;
            for (let i = 0; i < result.length; i++) {
                result[i] *= scale;
            }
        }
        
        const bufferLength = result.length * 2;
        const wavBuffer = new ArrayBuffer(44 + bufferLength);
        const view = new DataView(wavBuffer);
        
        const writeString = (view, offset, string) => {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        };
        
        writeString(view, 0, 'RIFF');
        view.setUint32(4, 36 + bufferLength, true);
        writeString(view, 8, 'WAVE');
        writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, format, true);
        view.setUint16(22, numOfChan, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * numOfChan * (bitDepth / 8), true);
        view.setUint16(32, numOfChan * (bitDepth / 8), true);
        view.setUint16(34, bitDepth, true);
        writeString(view, 36, 'data');
        view.setUint32(40, bufferLength, true);
        
        // Float to 16-bit PCM
        let offset = 44;
        for (let i = 0; i < result.length; i++, offset += 2) {
            let s = Math.max(-1, Math.min(1, result[i]));
            view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        }
        
        return new Blob([view], { type: 'audio/wav' });
    }

    function switchWorkspaceState(state) {
        if (state === 'form') {
            if (formSection) formSection.classList.remove('hidden');
            if (loadingIndicator) loadingIndicator.classList.add('hidden');
            if (resultsSection) resultsSection.classList.add('hidden');
        } else if (state === 'loading') {
            if (formSection) formSection.classList.add('hidden');
            if (loadingIndicator) loadingIndicator.classList.remove('hidden');
            if (resultsSection) resultsSection.classList.add('hidden');
        } else if (state === 'results') {
            if (formSection) formSection.classList.add('hidden');
            if (loadingIndicator) loadingIndicator.classList.add('hidden');
            if (resultsSection) resultsSection.classList.remove('hidden');
        }
    }

    function initAuthListener() {
        supabase.auth.onAuthStateChange(async (event, session) => {
            if (session) {
                isLoggedIn = true;
                const user = session.user;
                userEmailSpan.textContent = user.email;
                userInfo.classList.remove('hidden');
                authButtons.classList.add('hidden');
                authModal.classList.add('hidden');
                
                submitBtn.disabled = !inputElement.files.length;
                switchWorkspaceState('form');
                
                await updateProfileInfo();
                await loadPatients();
                await loadHistory();
            } else {
                isLoggedIn = false;
                userInfo.classList.add('hidden');
                authButtons.classList.remove('hidden');
                
                submitBtn.disabled = true;
                switchWorkspaceState('form');
                historyList.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 2rem 0; font-size: 0.9rem;">로그인 후 사용 이력을 불러옵니다.</div>`;
                if (patientSelect) {
                    patientSelect.value = '';
                }
                if (patientSelectTrigger) {
                    patientSelectTrigger.textContent = '로그인 후 환자를 선택하거나 등록해 주세요.';
                }
                if (selectedPatientCard) {
                    selectedPatientCard.classList.add('hidden');
                }
                if (historyPatientFilter) {
                    historyPatientFilter.innerHTML = '<option value="">전체 환자 보기</option>';
                }
                if (historySearchInput) {
                    historySearchInput.value = '';
                }
                document.querySelectorAll('#history-status-chips .filter-chip').forEach((c, idx) => {
                    if (idx === 0) c.classList.add('active');
                    else c.classList.remove('active');
                });
            }
        });
    }

    // 초 단위를 시간/분 텍스트로 포매팅하는 헬퍼 함수
    function formatSecondsToTime(seconds) {
        if (seconds <= 0) return "0분";
        const totalMinutes = Math.ceil(seconds / 60);
        const h = Math.floor(totalMinutes / 60);
        const m = totalMinutes % 60;
        if (h > 0) {
            if (m > 0) {
                return `${h}시간 ${m}분`;
            }
            return `${h}시간`;
        }
        return `${m}분`;
    }

    // 브라우저에서 오디오 파일의 재생 시간을 비동기로 계산하는 헬퍼 함수
    function getAudioDuration(file) {
        return new Promise((resolve) => {
            const audio = document.createElement('audio');
            audio.src = URL.createObjectURL(file);
            audio.addEventListener('loadedmetadata', () => {
                const duration = audio.duration;
                URL.revokeObjectURL(audio.src);
                resolve(duration);
            });
            audio.addEventListener('error', (e) => {
                console.error("Failed to load audio metadata:", e);
                resolve(0);
            });
        });
    }

    // 사용자 프로필 및 Quota 정보 업데이트 (Supabase RLS 조회로 전면 변경)
    async function updateProfileInfo(retryCount = 0) {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const { data: profile, error } = await supabase
                .from('profiles')
                .select('tier, quota_limit, quota_used')
                .eq('id', session.user.id)
                .single();
            
            if (error || !profile) {
                // Profile may not exist yet right after signup (trigger timing)
                if (retryCount < 2) {
                    console.warn(`Profile not found, retrying in 1.5s... (attempt ${retryCount + 1})`);
                    await new Promise(r => setTimeout(r, 1500));
                    return updateProfileInfo(retryCount + 1);
                }
                throw error || new Error("Profile not found after retries");
            }

            const tier = profile.tier || 'free';
            const quotaInfo = document.getElementById('quota-info');
            
            if (tier === 'free') {
                const remaining = Math.max(0, profile.quota_limit - profile.quota_used);
                quotaInfo.innerHTML = `남은 횟수: <strong id="quota-remaining">${remaining}</strong> / <strong id="quota-limit">${profile.quota_limit}</strong>회 (최대 30분)`;
                
                const quotaRemainingEl = document.getElementById('quota-remaining');
                if (remaining <= 0) {
                    quotaRemainingEl.style.color = '#ef4444';
                } else {
                    quotaRemainingEl.style.color = 'var(--primary)';
                }
            } else {
                const remainingSeconds = Math.max(0, profile.quota_limit - profile.quota_used);
                const formattedRemaining = formatSecondsToTime(remainingSeconds);
                const formattedLimit = formatSecondsToTime(profile.quota_limit);
                const tierName = tier === 'basic' ? '베이직' : '프리미엄';
                
                quotaInfo.innerHTML = `남은 시간: <strong id="quota-remaining">${formattedRemaining}</strong> / <strong id="quota-limit">${formattedLimit}</strong> (${tierName})`;
                
                const quotaRemainingEl = document.getElementById('quota-remaining');
                if (remainingSeconds <= 0) {
                    quotaRemainingEl.style.color = '#ef4444';
                } else {
                    quotaRemainingEl.style.color = 'var(--primary)';
                }
            }
        } catch (err) {
            console.error("Failed to load profile:", err);
            // Show default free-tier values instead of 0/0
            const quotaInfo = document.getElementById('quota-info');
            if (quotaInfo) {
                quotaInfo.innerHTML = `남은 횟수: <strong id="quota-remaining" style="color: var(--text-muted);">-</strong> / <strong id="quota-limit">-</strong> (조회 실패)`;
            }
        }
    }

    const subModal = document.getElementById('subscription-modal');
    const closeSubBtn = document.getElementById('close-sub-btn');
    const subFreeBtn = document.getElementById('sub-free-btn');
    const subBasicBtn = document.getElementById('sub-basic-btn');
    const subPremiumBtn = document.getElementById('sub-premium-btn');
    const cancelSubSection = document.getElementById('cancel-sub-section');
    const cancelSubBtn = document.getElementById('cancel-sub-btn');

    // Close subscription modal
    closeSubBtn.addEventListener('click', () => {
        subModal.classList.add('hidden');
    });

    // Open & Setup Subscription Modal
    chargeBtn.addEventListener('click', async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                alert("로그인이 필요합니다.");
                openLoginBtn.click();
                return;
            }
            
            await setupSubscriptionModal(session.user.id);
            subModal.classList.remove('hidden');
        } catch (err) {
            console.error("Failed to load subscription modal:", err);
        }
    });

    async function setupSubscriptionModal(userId) {
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('tier, quota_used, subscription_id')
            .eq('id', userId)
            .single();
            
        if (error) throw error;
        
        const tier = profile?.tier || 'free';
        
        subFreeBtn.disabled = true;
        subFreeBtn.textContent = "사용 중";
        
        subBasicBtn.disabled = false;
        subBasicBtn.textContent = "구독하기";
        
        subPremiumBtn.disabled = false;
        subPremiumBtn.textContent = "구독하기";
        
        if (tier === 'free') {
            subFreeBtn.disabled = true;
            subFreeBtn.textContent = "사용 중";
            cancelSubSection.classList.add('hidden');
        } else if (tier === 'basic') {
            subFreeBtn.disabled = true;
            subFreeBtn.textContent = "무료 체험";
            subBasicBtn.disabled = true;
            subBasicBtn.textContent = "사용 중";
            cancelSubSection.classList.remove('hidden');
        } else if (tier === 'premium') {
            subFreeBtn.disabled = true;
            subFreeBtn.textContent = "무료 체험";
            subPremiumBtn.disabled = true;
            subPremiumBtn.textContent = "사용 중";
            cancelSubSection.classList.remove('hidden');
        }
        
        subBasicBtn.onclick = () => startMockPayment(userId, 'basic');
        subPremiumBtn.onclick = () => startMockPayment(userId, 'premium');
        cancelSubBtn.onclick = () => startMockCancel(userId, profile);
    }

    async function startMockPayment(userId, tier) {
        const priceText = tier === 'basic' ? '19,900원' : '29,900원';
        if (!confirm(`${tier.toUpperCase()} 요금제 (${priceText} / 월) 구독 결제를 진행하시겠습니까?\n(테스트 환경이므로 실제 결제창 대신 모의 결제 웹훅이 실행됩니다.)`)) {
            return;
        }
        
        subBasicBtn.disabled = true;
        subPremiumBtn.disabled = true;
        
        try {
            const merchantUid = `sub_${tier}_${userId}_${Date.now()}`;
            const webhookUrl = `${supabaseUrl}/functions/v1/payment-webhook`;
            
            const res = await fetch(webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    imp_uid: `imp_mock_${Date.now()}`,
                    merchant_uid: merchantUid,
                    status: 'paid',
                    customer_uid: `cust_mock_${userId}`
                })
            });
            
            const json = await res.json();
            if (res.ok && json.status === 'success') {
                alert(`${tier.toUpperCase()} 요금제 구독 및 반영에 성공했습니다!`);
                subModal.classList.add('hidden');
                await updateProfileInfo();
            } else {
                throw new Error(json.error || "웹훅 처리 실패");
            }
        } catch (err) {
            alert("구독 결제 실패: " + err.message);
            console.error(err);
        } finally {
            await setupSubscriptionModal(userId);
        }
    }

    async function startMockCancel(userId, profile) {
        if (!profile.subscription_id) return;
        
        const { data: subData, error: subErr } = await supabase
            .from('subscriptions')
            .select('merchant_uid, status')
            .eq('id', profile.subscription_id)
            .single();
            
        if (subErr || !subData) {
            alert("활성화된 구독 정보를 찾을 수 없습니다.");
            return;
        }
        
        const quotaUsed = profile.quota_used || 0;
        
        if (quotaUsed === 0) {
            if (confirm("결제 후 사용량이 0초이므로 전액 환불 및 즉시 구독 취소 처리가 가능합니다.\n진행하시겠습니까?")) {
                try {
                    const webhookUrl = `${supabaseUrl}/functions/v1/payment-webhook`;
                    const res = await fetch(webhookUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            imp_uid: `imp_mock_cancel_${Date.now()}`,
                            merchant_uid: subData.merchant_uid,
                            status: 'cancelled'
                        })
                    });
                    
                    const json = await res.json();
                    if (res.ok && json.status === 'success') {
                        alert("구독 환불 및 해지 처리가 정상 반영되었습니다. Free 등급으로 전환됩니다.");
                        subModal.classList.add('hidden');
                        await updateProfileInfo();
                    } else {
                        throw new Error(json.error || "웹훅 처리 실패");
                    }
                } catch (err) {
                    alert("구독 취소 실패: " + err.message);
                }
            }
        } else {
            if (confirm("이미 크레딧 사용 이력이 있어 환불은 불가합니다.\n이번 구독 주기 만료 후 갱신되지 않도록 예약 해지하시겠습니까?")) {
                try {
                    const { error } = await supabase
                        .from('subscriptions')
                        .update({ cancel_at_period_end: true })
                        .eq('id', profile.subscription_id);
                        
                    if (error) throw error;
                    
                    alert("구독 해지 예약이 정상 처리되었습니다. 만료일까지는 이용하실 수 있습니다.");
                    subModal.classList.add('hidden');
                    await updateProfileInfo();
                } catch (err) {
                    alert("해지 예약 실패: " + err.message);
                }
            }
        }
    }

    // 로그인 / 가입 모달 동작 제어
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
        try {
            await Promise.race([
                supabase.auth.signOut(),
                new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 1500))
            ]);
        } catch (err) {
            console.warn("SignOut API call skipped/failed/timeout:", err);
        } finally {
            localStorage.clear();
            sessionStorage.clear();
            localStorage.removeItem('mock_user_email');
            localStorage.removeItem('mock_token');
            window.location.reload();
        }
    });

    function updateThumbnail(dropZoneElement, file) {
        let thumbnailElement = dropZoneElement.querySelector(".drop-zone__thumb");

        if (dropZoneElement.querySelector(".drop-zone__prompt")) {
            dropZoneElement.querySelector(".drop-zone__prompt").style.display = "none";
        }

        if (!thumbnailElement) {
            thumbnailElement = document.createElement("div");
            thumbnailElement.className = "drop-zone__thumb";
            dropZoneElement.appendChild(thumbnailElement);
        }

        thumbnailElement.dataset.label = file.name;

        thumbnailElement.innerHTML = `
            <div class="drop-zone__thumb-icon">
                <i data-lucide="file-audio"></i>
            </div>
            <div class="drop-zone__thumb-label">${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)</div>
        `;
        lucide.createIcons();
    }

    // 드래그 앤 드롭 파일 인터랙션
    dropZoneElement.addEventListener('click', () => {
        if (isLoggedIn) {
            inputElement.click();
        } else {
            alert("로그인이 필요한 서비스입니다.");
            openLoginBtn.click();
        }
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

    // Patient Registration & List Management
    let allPatientsCached = [];

    function calculateAge(birthDateString) {
        const today = new Date();
        const birthDate = new Date(birthDateString);
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age;
    }

    async function loadPatients(selectedId = null) {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            let patients = [];

            // Try local API first, then fallback to direct Supabase SDK query
            try {
                const res = await fetch('/api/patients', {
                    headers: {
                        'Authorization': `Bearer ${session.access_token}`
                    }
                });
                if (!res.ok) throw new Error(`API returned ${res.status}`);
                patients = await res.json();
            } catch (apiErr) {
                console.warn("Local /api/patients failed, using Supabase SDK fallback:", apiErr.message);
                const { data, error } = await supabase
                    .from('patients')
                    .select('*')
                    .order('name');
                if (error) throw error;
                patients = data || [];
            }

            allPatientsCached = patients;
            renderCustomSelectOptions(allPatientsCached, selectedId);
            updateHistoryPatientFilter(allPatientsCached);
        } catch (err) {
            console.error("Failed to load patients:", err);
            // Even on total failure, show proper logged-in state
            allPatientsCached = [];
            renderCustomSelectOptions([], null);
        }
    }

    function renderCustomSelectOptions(patients, selectedId = null) {
        patientSelectOptions.innerHTML = '';
        
        if (!patients || patients.length === 0) {
            const div = document.createElement('div');
            div.className = 'custom-select-option disabled';
            div.textContent = '등록된 환자가 없습니다. 새 환자를 등록해 주세요.';
            patientSelectOptions.appendChild(div);
            
            patientSelectTrigger.textContent = '등록된 환자가 없습니다.';
            patientSelect.value = '';
            selectedPatientCard.classList.add('hidden');
            return;
        }

        let selectedPatient = null;

        patients.forEach(p => {
            const div = document.createElement('div');
            div.className = 'custom-select-option';
            if (selectedId && p.id === selectedId) {
                div.classList.add('selected');
                selectedPatient = p;
            }
            div.setAttribute('data-value', p.id);
            const chartInfo = p.chart_number ? ` [${p.chart_number}]` : '';
            div.textContent = `${p.name} (${p.birth_date})${chartInfo}`;

            div.addEventListener('click', () => {
                selectPatientItem(p);
            });

            patientSelectOptions.appendChild(div);
        });

        if (selectedPatient) {
            selectPatientItem(selectedPatient);
        } else {
            patientSelectTrigger.textContent = '환자를 선택해 주세요.';
            patientSelect.value = '';
            selectedPatientCard.classList.add('hidden');
        }
        lucide.createIcons();
    }

    function selectPatientItem(p) {
        document.querySelectorAll('.custom-select-option').forEach(el => el.classList.remove('selected'));
        const optionEl = document.querySelector(`.custom-select-option[data-value="${p.id}"]`);
        if (optionEl) optionEl.classList.add('selected');

        const chartInfo = p.chart_number ? ` [${p.chart_number}]` : '';
        patientSelectTrigger.textContent = `${p.name} (${p.birth_date})${chartInfo}`;
        patientSelect.value = p.id;
        
        selectedPatientCard.classList.remove('hidden');
        const age = calculateAge(p.birth_date);
        const genderKor = { M: '남성', F: '여성', Other: '기타' }[p.gender] || p.gender;
        const chartNo = p.chart_number ? ` (Chart: ${p.chart_number})` : ' (차트 번호 없음)';
        
        selectedPatientCardName.textContent = p.name;
        selectedPatientCardMeta.textContent = `만 ${age}세 • ${genderKor}${chartNo}`;

        patientSelectContainer.classList.remove('open');
        patientSearchInput.value = '';
        filterCustomSelectOptions('');
        lucide.createIcons();
    }

    function filterCustomSelectOptions(searchTerm) {
        const term = searchTerm.toLowerCase().trim();
        const options = patientSelectOptions.querySelectorAll('.custom-select-option:not(.disabled)');
        
        options.forEach(opt => {
            const text = opt.textContent.toLowerCase();
            if (text.includes(term)) {
                opt.style.display = 'block';
            } else {
                opt.style.display = 'none';
            }
        });
    }

    function updateHistoryPatientFilter(patients) {
        if (!historyPatientFilter) return;
        const currentVal = historyPatientFilter.value;
        historyPatientFilter.innerHTML = '<option value="">전체 환자 보기</option>';
        if (patients && patients.length > 0) {
            patients.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.id;
                opt.textContent = `${p.name} (${p.birth_date})`;
                if (currentVal && p.id === currentVal) {
                    opt.selected = true;
                }
                historyPatientFilter.appendChild(opt);
            });
        }
    }

    if (patientSelectTrigger) {
        patientSelectTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!isLoggedIn) {
                alert("로그인이 필요합니다.");
                openLoginBtn.click();
                return;
            }
            patientSelectContainer.classList.toggle('open');
            if (patientSelectContainer.classList.contains('open')) {
                patientSearchInput.focus();
            }
        });
    }

    if (patientSearchInput) {
        patientSearchInput.addEventListener('input', (e) => {
            filterCustomSelectOptions(e.target.value);
        });
        patientSearchInput.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }

    document.addEventListener('click', (e) => {
        if (patientSelectContainer && !patientSelectContainer.contains(e.target)) {
            patientSelectContainer.classList.remove('open');
        }
    });

    if (newSessionBtn) {
        newSessionBtn.addEventListener('click', () => {
            document.querySelectorAll('.history-item').forEach(el => el.classList.remove('active'));
            
            form.reset();
            if (patientSelect) patientSelect.value = '';
            if (patientSelectTrigger) {
                patientSelectTrigger.textContent = isLoggedIn ? '환자를 선택해 주세요.' : '로그인 후 환자를 선택하거나 등록해 주세요.';
            }
            if (selectedPatientCard) selectedPatientCard.classList.add('hidden');
            
            const thumbnailElement = dropZoneElement.querySelector('.drop-zone__thumb');
            if (thumbnailElement) {
                thumbnailElement.remove();
            }
            const promptElement = dropZoneElement.querySelector('.drop-zone__prompt');
            if (promptElement) {
                promptElement.style.display = 'block';
            }
            
            submitBtn.disabled = true;
            dropZoneElement.style.pointerEvents = 'auto';
            
            switchWorkspaceState('form');
        });
    }

    if (historyPatientFilter) {
        historyPatientFilter.addEventListener('change', () => {
            loadHistory();
        });
    }

    if (historySearchInput) {
        historySearchInput.addEventListener('input', () => {
            loadHistory();
        });
    }

    const statusChips = document.querySelectorAll('#history-status-chips .filter-chip');
    statusChips.forEach(chip => {
        chip.addEventListener('click', () => {
            statusChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            loadHistory();
        });
    });

    if (openRegisterPatientBtn) {
        openRegisterPatientBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!isLoggedIn) {
                alert("로그인이 필요합니다.");
                openLoginBtn.click();
                return;
            }
            patientRegisterModal.classList.remove('hidden');
        });
    }

    if (closePatientModalBtn) {
        closePatientModalBtn.addEventListener('click', () => {
            patientRegisterModal.classList.add('hidden');
        });
    }

    if (patientRegisterForm) {
        patientRegisterForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                alert("로그인이 필요한 기능입니다.");
                return;
            }

            const name = patientNameInput.value.trim();
            const birthDate = patientBirthInput.value;
            const gender = patientGenderSelect.value;
            const chartNumber = patientChartNumberInput.value.trim() || null;

            const submitBtnEl = document.getElementById('patient-submit-btn');
            if (submitBtnEl) {
                submitBtnEl.disabled = true;
                submitBtnEl.textContent = "등록 중...";
            }

            try {
                const res = await fetch('/api/patients', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session.access_token}`
                    },
                    body: JSON.stringify({
                        name: name,
                        birth_date: birthDate,
                        gender: gender,
                        chart_number: chartNumber
                    })
                });

                if (!res.ok) {
                    let errMsg = "등록 실패";
                    try {
                        const json = await res.json();
                        errMsg = json.detail || json.message || errMsg;
                    } catch (_) {}
                    throw new Error(errMsg);
                }

                const newPatient = await res.json();
                alert(`환자 "${name}" 등록이 완료되었습니다.`);
                
                patientRegisterForm.reset();
                patientRegisterModal.classList.add('hidden');

                await loadPatients(newPatient.id);

            } catch (err) {
                alert("환자 등록 오류: " + err.message);
            } finally {
                if (submitBtnEl) {
                    submitBtnEl.disabled = false;
                    submitBtnEl.textContent = "환자 등록 완료";
                }
            }
        });
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (!inputElement.files.length) return;

        const selectedPatientId = patientSelect.value;
        if (!selectedPatientId) {
            alert("대상 환자를 선택해 주세요.");
            return;
        }
        
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            alert("로그인이 만료되었거나 로그인이 필요한 기능입니다.");
            openLoginBtn.click();
            return;
        }

        const originalFile = inputElement.files[0];
        
        submitBtn.disabled = true;
        dropZoneElement.style.pointerEvents = 'none';

        try {
            const duration = await getAudioDuration(originalFile);
            if (duration <= 0) {
                throw new Error("올바르지 않은 오디오 파일이거나 오디오의 길이를 측정할 수 없습니다.");
            }

            const { data: profile, error: profileErr } = await supabase
                .from('profiles')
                .select('tier, quota_limit, quota_used')
                .eq('id', session.user.id)
                .single();

            if (profileErr || !profile) {
                throw new Error("사용자 프로필 정보를 불러올 수 없습니다.");
            }

            const tier = profile.tier || 'free';
            const remaining = profile.quota_limit - profile.quota_used;

            if (tier === 'free') {
                if (duration > 1800) {
                    throw new Error("무료 체험(Free) 등급은 1회 최대 30분까지만 업로드 및 분석이 가능합니다.");
                }
                if (remaining <= 0) {
                    throw new Error("무료 체험 분석 횟수(10회)를 모두 소진하셨습니다. 정기 구독 결제가 필요합니다.");
                }
            } else {
                if (duration > 7200) {
                    throw new Error("정기 구독 등급은 1회 최대 120분(2시간)까지만 분석이 가능합니다.");
                }
                const requiredSeconds = Math.ceil(duration / 60) * 60;
                if (remaining < requiredSeconds) {
                    const formattedRequired = formatSecondsToTime(requiredSeconds);
                    const formattedRemaining = formatSecondsToTime(remaining);
                    throw new Error(`남은 사용 시간이 부족합니다.\n(필요 시간: ${formattedRequired}, 보유 시간: ${formattedRemaining})`);
                }
            }

            switchWorkspaceState('loading');
            const loadingText = loadingIndicator.querySelector('.loading-text');

            let finalFile = originalFile;
            const originalName = originalFile.name || '';
            let fileExt = originalName.split('.').pop().toLowerCase() || 'wav';
            let contentType = originalFile.type || 'application/octet-stream';

            loadingText.innerHTML = "세션 정보를 생성하는 중...";
            const { data: sessionData, error: sessionErr } = await supabase
                .from('sessions')
                .insert({
                    user_id: session.user.id,
                    patient_id: selectedPatientId,
                    profession: professionSelect.value,
                    patient_name: originalFile.name,
                    status: 'pending',
                    memo: memoInput.value,
                    duration: Math.ceil(duration)
                })
                .select()
                .single();

            if (sessionErr || !sessionData) {
                throw new Error("세션 생성 실패: " + (sessionErr?.message || "알 수 없는 오류"));
            }

            const sessionId = sessionData.id;

            loadingText.innerHTML = "압축된 음성 파일을 업로드하는 중...";
            const storagePath = `${session.user.id}/${selectedPatientId}/${sessionId}_processed_audio.${fileExt}`;

            const { data: uploadData, error: uploadErr } = await supabase
                .storage
                .from('audio-records')
                .upload(storagePath, finalFile, {
                    contentType: contentType,
                    cacheControl: '3600',
                    upsert: true
                });

            if (uploadErr) {
                await supabase.from('sessions').delete().eq('id', sessionId);
                throw new Error("음성 파일 업로드 실패: " + uploadErr.message);
            }

            loadingText.innerHTML = "AI 분석을 시작하는 중...<br/><small>(약 1~2분 소요될 수 있습니다)</small>";
            let invokeData, invokeErr;

            const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            if (isLocalhost) {
                console.log("Localhost environment detected, calling local API mimic instead of remote Edge Function.");
                try {
                    const res = await fetch('/api/functions/analyze', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${session.access_token}`
                        },
                        body: JSON.stringify({ session_id: sessionId, duration: duration })
                    });
                    if (!res.ok) {
                        let errMsg = `HTTP error ${res.status}`;
                        try {
                            const errJson = await res.json();
                            errMsg = errJson.detail || JSON.stringify(errJson);
                        } catch (_) {
                            try {
                                errMsg = await res.text();
                            } catch (__) {}
                        }
                        invokeErr = { message: errMsg };
                    } else {
                        invokeData = await res.json();
                    }
                } catch (err) {
                    invokeErr = err;
                }
            } else {
                console.log("Remote environment detected, calling remote Supabase Edge Function.");
                const { data, error } = await supabase.functions.invoke('analyze', {
                    body: { session_id: sessionId, duration: duration }
                });
                invokeData = data;
                invokeErr = error;
            }

            if (invokeErr) {
                throw new Error("분석 요청 실패: " + invokeErr.message);
            }

            await loadHistory();
            startPollingSession(sessionId);

        } catch (error) {
            alert('오류 발생: ' + error.message);
            console.error(error);
            resetUploadUI();
        }
    });

    function resetUploadUI() {
        switchWorkspaceState('form');
        submitBtn.disabled = false;
        dropZoneElement.style.pointerEvents = 'auto';
    }

    function startPollingSession(sessionId) {
        if (pollingInterval) clearInterval(pollingInterval);
        
        pollingInterval = setInterval(async () => {
            try {
                const { data: session, error } = await supabase
                    .from('sessions')
                    .select('status')
                    .eq('id', sessionId)
                    .single();
                
                if (error) throw error;
                
                if (session) {
                    updateHistoryItemStatus(sessionId, session.status);
                    
                    if (session.status === 'completed') {
                        clearInterval(pollingInterval);
                        pollingInterval = null;
                        
                        await loadSessionDetail(sessionId);
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
                }
            } catch (err) {
                console.error("Polling fetch failed:", err);
            }
        }, 3000);
    }

    async function loadHistory() {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            let sessions = [];
            let joinFailed = false;

            // Primary query with patient join
            try {
                const { data, error } = await supabase
                    .from('sessions')
                    .select('id, patient_name, status, profession, created_at, patient_id, memo, patients(name)')
                    .eq('user_id', session.user.id)
                    .order('created_at', { ascending: false });
                
                if (error) throw error;
                sessions = data || [];
            } catch (joinErr) {
                // Fallback: PGRST200 schema cache miss or other join error
                console.warn("History join query failed, using fallback without join:", joinErr);
                joinFailed = true;
                const { data, error } = await supabase
                    .from('sessions')
                    .select('id, patient_name, status, profession, created_at, patient_id, memo')
                    .eq('user_id', session.user.id)
                    .order('created_at', { ascending: false });
                
                if (error) throw error;
                sessions = (data || []).map(s => {
                    // Map patient name from local cache
                    const cachedPatient = allPatientsCached.find(p => p.id === s.patient_id);
                    return { ...s, patients: cachedPatient ? { name: cachedPatient.name } : null };
                });
            }

            let filteredSessions = sessions;
            
            // 1. Patient select filter
            if (historyPatientFilter && historyPatientFilter.value) {
                const filterVal = historyPatientFilter.value;
                filteredSessions = filteredSessions.filter(s => s.patient_id === filterVal);
            }
            
            // 2. Status chips filter
            const activeStatusChip = document.querySelector('#history-status-chips .filter-chip.active');
            if (activeStatusChip) {
                const statusVal = activeStatusChip.getAttribute('data-status');
                if (statusVal && statusVal !== 'all') {
                    filteredSessions = filteredSessions.filter(s => s.status === statusVal);
                }
            }

            // 3. Search keyword filter
            if (historySearchInput && historySearchInput.value.trim()) {
                const keyword = historySearchInput.value.toLowerCase().trim();
                filteredSessions = filteredSessions.filter(s => {
                    const patName = (s.patients?.name || '').toLowerCase();
                    const memoText = (s.memo || '').toLowerCase();
                    const profText = (s.profession || '').toLowerCase();
                    const filename = (s.patient_name || '').toLowerCase();
                    return patName.includes(keyword) || memoText.includes(keyword) || profText.includes(keyword) || filename.includes(keyword);
                });
            }

            renderHistoryList(filteredSessions);
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

            const patientName = session.patients?.name || "미지정 환자";
            const tooltipText = `파일명: ${session.patient_name}`;
            
            const themeClass = {
                pt: 'pt-theme',
                ot: 'ot-theme',
                st: 'st-theme',
                rehab: 'rehab-theme'
            }[session.profession] || '';

            return `
                <div class="history-item ${themeClass}" data-id="${session.id}">
                    <div class="history-meta">
                        <span class="history-patient" title="${tooltipText}">${patientName}</span>
                        <span class="status-badge status-${session.status}">${statusKor}</span>
                    </div>
                    <div class="history-meta" style="margin-top: 4px;">
                        <span>직군: ${session.profession.toUpperCase()}</span>
                        <span>${formattedDate}</span>
                    </div>
                </div>
            `;
        }).join('');

        document.querySelectorAll('.history-item').forEach(item => {
            item.addEventListener('click', async () => {
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

    async function loadSessionDetail(sessionId) {
        try {
            const { data: session, error } = await supabase
                .from('sessions')
                .select('*')
                .eq('id', sessionId)
                .single();
            
            if (error) throw error;
            
            if (session) {
                const responseData = {
                    id: session.id,
                    patient_name: session.patient_name,
                    status: session.status,
                    profession: session.profession,
                    audio_url: session.audio_url,
                    memo: session.memo,
                    created_at: session.created_at,
                    results: null
                };
                
                if (session.status === 'pending' || session.status === 'processing') {
                    submitBtn.disabled = true;
                    dropZoneElement.style.pointerEvents = 'none';
                    switchWorkspaceState('loading');
                    startPollingSession(sessionId);
                } else if (session.status === 'completed') {
                    const { data: result, error: resultErr } = await supabase
                        .from('results')
                        .select('*')
                        .eq('session_id', sessionId)
                        .single();

                    if (resultErr) throw resultErr;
                       
                    if (result) {
                        let chartData = result.chart_data;
                        if (typeof chartData === 'string') {
                            try {
                                chartData = JSON.parse(chartData);
                            } catch (e) {
                                console.error("Error parsing chart json", e);
                            }
                        }
                        responseData.results = {
                            raw_transcript: result.raw_transcript,
                            refined_transcript: result.refined_transcript,
                            chart_data: chartData,
                            guide_content: result.guide_content
                        };
                        
                        lastResultData = responseData.results;
                        displayResults(responseData.results);
                        switchWorkspaceState('results');
                    }
                } else {
                    alert("해당 세션은 분석 도중 실패했습니다.");
                    switchWorkspaceState('form');
                }
            }
        } catch (err) {
            console.error("Failed to load session details:", err);
        }
    }

    function displayResults(results) {
        if (!results) return;

        if (results.chart_data) {
            renderChart(results.chart_data, chartContent);
        }
        
        if (results.guide_content) {
            guideContent.innerHTML = marked.parse(results.guide_content);
        }
        
        if (results.refined_transcript) {
            transcriptContent.textContent = results.refined_transcript;
        }

        resultsSection.classList.remove('hidden');
        lucide.createIcons();
    }

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            btn.classList.add('active');
            const tabId = btn.getAttribute('data-tab');
            document.getElementById(`tab-${tabId}`).classList.add('active');
        });
    });

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

    downloadCsvBtn.addEventListener('click', () => {
        if (!lastResultData) return;

        const rows = [
            ["항목", "내용"]
        ];

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

        rows.push(["환자 가이드", lastResultData.guide_content || ""]);
        rows.push(["보정 녹취록", lastResultData.refined_transcript || ""]);

        let csvContent = "\uFEFF";
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

    function renderChart(chartData, container) {
        container.innerHTML = '';
        container.className = 'chart-container';

        const labels = {
            chief_complaint: '주호소 (Chief Complaint)',
            pain_scale: '통증 척도 (Pain Scale)',
            aggravating_easing_factors: '악화/완화 요인',
            precautions_contraindications: '주의/금기사항',
            observation_posture: '시각적 관찰 (Observation)',
            physical_examination: '기능 검사 및 평가 (Exam)',
            therapist_diagnosis: '치료사 진단 (Voice-based)',
            ai_diagnosis_inferred: 'AI 진단 (Context-inferred)',
            clinical_impression: '임상적 추론 (Impression)',
            progress: '경과 및 호전도',
            treatment_performed: '수행된 중재 (Intervention)',
            home_exercise: '자가 운동 (HEP)',
            future_plan: '향후 계획'
        };

        const soapGrid = document.createElement('div');
        soapGrid.className = 'soap-card-grid';

        const createSoapBox = (type, title, iconName, dataObj) => {
            if (!dataObj) return null;
            
            const box = document.createElement('div');
            box.className = `soap-box soap-${type}`;

            const header = document.createElement('div');
            header.className = 'soap-box-header';
            header.innerHTML = `
                <div class="soap-icon-wrapper"><i data-lucide="${iconName}"></i></div>
                <div class="soap-box-title">${title}</div>
            `;
            box.appendChild(header);

            for (const [key, value] of Object.entries(dataObj)) {
                const label = labels[key] || key;
                let valStr = "언급 없음";
                
                if (Array.isArray(value)) {
                    if (value.length > 0) {
                        valStr = value.join(", ");
                    }
                } else if (value && value !== "언급 없음") {
                    valStr = value;
                }

                const row = document.createElement('div');
                row.className = 'soap-item-row';
                
                if (key === 'pain_scale' && valStr !== "언급 없음") {
                    const numericPain = parseInt(valStr.replace(/[^0-9]/g, '')) || 0;
                    const fillPercent = (Math.min(Math.max(numericPain, 0), 10) / 10) * 100;
                    
                    let pillColor = '#22c55e';
                    if (numericPain >= 7) pillColor = '#ef4444';
                    else if (numericPain >= 4) pillColor = '#eab308';
                    
                    row.innerHTML = `
                        <div class="soap-item-label">${label}</div>
                        <div class="pain-scale-badge-container">
                            <div class="pain-scale-track">
                                <div class="pain-scale-fill" style="width: ${fillPercent}%;"></div>
                            </div>
                            <span class="pain-scale-value-pill" style="background-color: ${pillColor};">VAS ${numericPain}</span>
                        </div>
                    `;
                } else {
                    row.innerHTML = `
                        <div class="soap-item-label">${label}</div>
                        <div class="soap-item-value">${valStr}</div>
                    `;
                }
                box.appendChild(row);
            }
            
            return box;
        };

        if (chartData.clinical_record) {
            const cr = chartData.clinical_record;
            
            const boxS = createSoapBox('s', 'S. 주관적 소견 (Subjective)', 'message-square', cr.subjective);
            const boxO = createSoapBox('o', 'O. 객관적 소견 (Objective)', 'activity', cr.objective);
            const boxA = createSoapBox('a', 'A. 평가 (Assessment)', 'brain', cr.assessment);
            const boxP = createSoapBox('p', 'P. 치료 계획 (Plan)', 'calendar', cr.plan);

            if (boxS) soapGrid.appendChild(boxS);
            if (boxO) soapGrid.appendChild(boxO);
            if (boxA) soapGrid.appendChild(boxA);
            if (boxP) soapGrid.appendChild(boxP);
        }

        container.appendChild(soapGrid);

        const redFlags = chartData.red_flags_detected || [];
        if (redFlags.length > 0) {
            const alarmBox = document.createElement('div');
            alarmBox.className = 'red-flags-alarm-box';
            
            const header = document.createElement('div');
            header.className = 'red-flags-header';
            header.innerHTML = `<i data-lucide="alert-triangle"></i><span>🚨 위험 징후 감지 (Red Flags)</span>`;
            alarmBox.appendChild(header);

            const list = document.createElement('ul');
            list.className = 'red-flags-list';
            redFlags.forEach(f => {
                const li = document.createElement('li');
                li.textContent = f;
                list.appendChild(li);
            });
            alarmBox.appendChild(list);
            container.appendChild(alarmBox);
        }

        if (chartData.rapport_data) {
            const rapportBox = document.createElement('div');
            rapportBox.className = 'soap-box soap-rapport';
            rapportBox.style.marginTop = '1.5rem';
            
            const header = document.createElement('div');
            header.className = 'soap-box-header';
            header.innerHTML = `
                <div class="soap-icon-wrapper" style="background: rgba(16, 185, 129, 0.15); color: #34d399;"><i data-lucide="users"></i></div>
                <div class="soap-box-title" style="color: #34d399;">🤝 라포 데이터 (Rapport & Preferences)</div>
            `;
            rapportBox.appendChild(header);

            const rapportLabels = {
                personal_background: '개인 배경 (가족/직업/취미 등)',
                patient_preferences: '환자 선호도',
                psychosocial_factors: '심리사회적 요인',
                compliance_attitude: '순응도 및 태도',
                upcoming_events: '향후 일정',
                follow_up_cues: '다음 방문 시 참고사항'
            };

            for (const [key, value] of Object.entries(chartData.rapport_data)) {
                const label = rapportLabels[key] || key;
                let valStr = "언급 없음";
                if (value && value !== "언급 없음") {
                    valStr = value;
                }

                const row = document.createElement('div');
                row.className = 'soap-item-row';
                row.innerHTML = `
                    <div class="soap-item-label">${label}</div>
                    <div class="soap-item-value">${valStr}</div>
                `;
                rapportBox.appendChild(row);
            }
            container.appendChild(rapportBox);
        }

        lucide.createIcons();
    }
});
