document.addEventListener('DOMContentLoaded', () => {
    const dropZoneElement = document.getElementById('drop-zone');
    const inputElement = document.getElementById('file-input');
    const submitBtn = document.getElementById('submit-btn');
    const form = document.getElementById('upload-form');
    const loadingIndicator = document.getElementById('loading-indicator');
    const resultsSection = document.getElementById('results-section');
    
    // Multi-upload elements
    const memoInput = document.getElementById('memo-input');
    
    // Guide Modal elements
    const guideModal = document.getElementById('guide-modal');
    const openGuideBtn = document.getElementById('open-guide-btn');
    const closeGuideBtn = document.getElementById('close-guide-btn');
    
    // Elements for results
    const chartContent = document.getElementById('chart-content');
    const guideContent = document.getElementById('guide-content');
    const transcriptContent = document.getElementById('transcript-content');
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    const copyBtn = document.getElementById('copy-btn');
    const downloadCsvBtn = document.getElementById('download-csv-btn');
    
    let lastResultData = null; // Store last analysis result for export

    // Make drop zone interactive
    dropZoneElement.addEventListener('click', () => {
        inputElement.click();
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

    // Guide Modal logic
    openGuideBtn.addEventListener('click', () => {
        guideModal.classList.remove('hidden');
    });

    closeGuideBtn.addEventListener('click', () => {
        guideModal.classList.add('hidden');
    });

    window.addEventListener('click', (e) => {
        if (e.target === guideModal) {
            guideModal.classList.add('hidden');
        }
    });

    function updateThumbnail(dropZoneElement, file) {
        let promptElement = dropZoneElement.querySelector('.drop-zone__prompt');
        if (promptElement) {
            promptElement.innerHTML = `<strong>선택됨:</strong><br>${file.name}<br><small>(${Math.round(file.size / 1024 / 1024 * 100) / 100} MB)</small>`;
            promptElement.style.color = 'var(--primary)';
        }
    }



    // Tabs logic
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

    // Copy to clipboard logic
    copyBtn.addEventListener('click', () => {
        const activeTab = document.querySelector('.tab-content.active');
        if (!activeTab) return;

        // Get text content based on tab
        const textToCopy = activeTab.innerText;

        navigator.clipboard.writeText(textToCopy).then(() => {
            const originalContent = copyBtn.innerHTML;
            copyBtn.innerHTML = `
                <i data-lucide="check" size="16"></i>
                복사 완료!
            `;
            copyBtn.classList.add('success');
            lucide.createIcons();
            
            setTimeout(() => {
                copyBtn.innerHTML = originalContent;
                copyBtn.classList.remove('success');
                lucide.createIcons();
            }, 2000);
        }).catch(err => {
            console.error('복사 실패:', err);
            alert('복사 중 오류가 발생했습니다.');
        });
    });

    // Download CSV logic
    downloadCsvBtn.addEventListener('click', () => {
        if (!lastResultData) return;

        const rows = [
            ["항목", "내용"]
        ];

        // 1. Add chart items to rows (At the top)
        if (lastResultData.chart && lastResultData.chart.clinical_record) {
            const cr = lastResultData.chart.clinical_record;
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
        rows.push(["환자 가이드", lastResultData.guide]);
        rows.push(["보정 녹취록", lastResultData.transcript]);

        // CSV content generation (with BOM for Excel Korean support)
        let csvContent = "\uFEFF"; // Byte Order Mark
        rows.forEach(row => {
            const processedRow = row.map(val => {
                let cell = val === null || val === undefined ? "" : String(val);
                cell = cell.replace(/"/g, '""'); // Escape double quotes
                if (cell.search(/("|,|\n)/g) >= 0) {
                    cell = `"${cell}"`; // Wrap in quotes if needed
                }
                return cell;
            });
            csvContent += processedRow.join(",") + "\r\n";
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `analysis_result_${new Date().getTime()}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    // Form submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (!inputElement.files.length) return;

        const formData = new FormData(form);
        
        // UI updates
        submitBtn.disabled = true;
        dropZoneElement.style.pointerEvents = 'none';
        loadingIndicator.classList.remove('hidden');
        resultsSection.classList.add('hidden');

        try {
            const response = await fetch('/api/analyze', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (result.status === 'success') {
                const data = result.data;
                lastResultData = data; // Save for export
                
                // Render Chart (UI)
                renderChart(data.chart, chartContent);
                
                // Render Guide (Markdown)
                guideContent.innerHTML = marked.parse(data.guide);
                
                // Render Transcript
                transcriptContent.textContent = data.transcript;

                // Show results
                loadingIndicator.classList.add('hidden');
                resultsSection.classList.remove('hidden');
                
                // Reset form state for next upload if needed
                submitBtn.disabled = false;
                dropZoneElement.style.pointerEvents = 'auto';
            } else {
                alert('오류가 발생했습니다: ' + result.message);
                loadingIndicator.classList.add('hidden');
                submitBtn.disabled = false;
                dropZoneElement.style.pointerEvents = 'auto';
            }
            
        } catch (error) {
            alert('서버와 통신 중 오류가 발생했습니다.');
            console.error(error);
            loadingIndicator.classList.add('hidden');
            submitBtn.disabled = false;
            dropZoneElement.style.pointerEvents = 'auto';
        }
    });

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

        // 컨테이너 스타일을 마크다운 바디로 변경
        container.className = 'markdown-body';
        container.innerHTML = marked.parse(md);
    }
});
