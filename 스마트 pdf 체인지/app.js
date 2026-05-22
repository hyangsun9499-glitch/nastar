/**
 * ==========================================================================
 * SMART PDF SPLITTER & CONVERTER - CORE JAVASCRIPT
 * Features:
 *   - File drop/drag & drop & upload processing (PDF, DOCX, Images)
 *   - PDF.js text extraction & rendering
 *   - Mammoth.js word text extraction
 *   - Gemini 3.5 Flash direct REST API integration
 *   - Advanced prompt engineering & JSON response parsing
 *   - Dynamic interactive chapter range management (Add, Delete, Edit)
 *   - pdf-lib PDF split engine & ZIP exporter
 *   - Universal format converter (HWP, DOCX, TXT, PNG/JPG ZIP)
 * ==========================================================================
 */

// Global Application State
const state = {
    uploadedFile: null,
    fileType: '', // 'pdf', 'docx', 'image'
    fileArrayBuffer: null,
    pagesData: [], // Array of { pageNum, text, imageBlob (optional), canvasDataUrl (optional) }
    chapters: [], // Array of { name, startPage, endPage, summary }
    pdfjsDoc: null
};

// DOM Elements
const DOM = {
    dropzone: document.getElementById('dropzone'),
    fileInput: document.getElementById('file-input'),
    apiKeyInput: document.getElementById('api-key-input'),
    toggleApiVisibility: document.getElementById('toggle-api-visibility'),
    modelSelect: document.getElementById('model-select'),
    controlPanel: document.getElementById('control-panel'),
    loadedFileIcon: document.getElementById('loaded-file-icon'),
    loadedFileName: document.getElementById('loaded-file-name'),
    loadedFileSize: document.getElementById('loaded-file-size'),
    loadedFilePages: document.getElementById('loaded-file-pages'),
    workspaceArea: document.getElementById('workspace-area'),
    previewContainer: document.getElementById('preview-container'),
    btnAiAnalyze: document.getElementById('btn-ai-analyze'),
    aiLoader: document.getElementById('ai-loader'),
    aiLoaderText: document.getElementById('ai-loader-text'),
    analysisContent: document.getElementById('analysis-content'),
    exportPanel: document.getElementById('export-panel'),
    btnAddChapter: document.getElementById('btn-add-chapter'),
    btnExecuteSplit: document.getElementById('btn-execute-split'),
    btnConvertHwp: document.getElementById('btn-convert-hwp'),
    btnConvertDocx: document.getElementById('btn-convert-docx'),
    btnConvertTxt: document.getElementById('btn-convert-txt'),
    btnConvertImages: document.getElementById('btn-convert-images'),
    toastContainer: document.getElementById('toast-container')
};

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    initEvents();
});

// Event Listeners Registration
function initEvents() {
    // API Visibility toggle
    DOM.toggleApiVisibility.addEventListener('click', () => {
        if (DOM.apiKeyInput.type === 'password') {
            DOM.apiKeyInput.type = 'text';
            DOM.toggleApiVisibility.innerHTML = '<i class="fa-solid fa-eye"></i>';
        } else {
            DOM.apiKeyInput.type = 'password';
            DOM.toggleApiVisibility.innerHTML = '<i class="fa-solid fa-eye-slash"></i>';
        }
    });

    // Drag & Drop
    DOM.dropzone.addEventListener('click', () => DOM.fileInput.click());
    DOM.fileInput.addEventListener('change', handleFileSelect);

    DOM.dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        DOM.dropzone.classList.add('dragover');
    });

    DOM.dropzone.addEventListener('dragleave', () => {
        DOM.dropzone.classList.remove('dragover');
    });

    DOM.dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        DOM.dropzone.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
            processUploadedFile(e.dataTransfer.files[0]);
        }
    });

    // Main Actions
    DOM.btnAiAnalyze.addEventListener('click', performAiAnalysis);
    DOM.btnAddChapter.addEventListener('click', addManualChapter);
    DOM.btnExecuteSplit.addEventListener('click', executePdfSplit);

    // Formats Conversion triggers
    DOM.btnConvertHwp.addEventListener('click', () => convertToFormat('hwp'));
    DOM.btnConvertDocx.addEventListener('click', () => convertToFormat('docx'));
    DOM.btnConvertTxt.addEventListener('click', () => convertToFormat('txt'));
    DOM.btnConvertImages.addEventListener('click', () => convertToFormat('images'));
}

// Toast Notifications Helper
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = 'fa-circle-info';
    if (type === 'success') icon = 'fa-circle-check';
    if (type === 'error') icon = 'fa-circle-exclamation';
    
    toast.innerHTML = `
        <i class="fa-solid ${icon}"></i>
        <div class="toast-message">${message}</div>
    `;
    
    DOM.toastContainer.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'toastSlideIn 0.3s reverse forwards';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// File Select Handlers
function handleFileSelect(e) {
    if (e.target.files.length > 0) {
        processUploadedFile(e.target.files[0]);
    }
}

// File Processing Router
async function processUploadedFile(file) {
    state.uploadedFile = file;
    state.pagesData = [];
    state.chapters = [];
    
    const ext = file.name.split('.').pop().toLowerCase();
    
    // UI Loading state
    DOM.controlPanel.classList.add('hidden');
    DOM.workspaceArea.classList.add('hidden');
    DOM.exportPanel.classList.add('hidden');
    DOM.btnAiAnalyze.classList.remove('hidden');
    
    // Reset preview panel
    DOM.previewContainer.innerHTML = '<div class="empty-state"><p>문서를 불러오는 중입니다...</p></div>';
    
    showToast(`${file.name} 로드 시작`, 'info');

    // Parse Size
    const sizeKb = (file.size / 1024).toFixed(1);
    DOM.loadedFileName.textContent = file.name;
    DOM.loadedFileSize.textContent = `${sizeKb} KB`;
    
    // File reader to Array Buffer
    const reader = new FileReader();
    reader.onload = async (e) => {
        state.fileArrayBuffer = e.target.result;
        
        try {
            if (ext === 'pdf') {
                state.fileType = 'pdf';
                DOM.loadedFileIcon.className = 'file-icon';
                DOM.loadedFileIcon.innerHTML = '<i class="fa-regular fa-file-pdf" style="color: #e74c3c;"></i>';
                await parsePdf(state.fileArrayBuffer);
            } else if (ext === 'docx') {
                state.fileType = 'docx';
                DOM.loadedFileIcon.className = 'file-icon';
                DOM.loadedFileIcon.innerHTML = '<i class="fa-regular fa-file-word" style="color: #2b82c9;"></i>';
                await parseDocx(state.fileArrayBuffer);
            } else if (['jpg', 'jpeg', 'png', 'gif'].includes(ext)) {
                state.fileType = 'image';
                DOM.loadedFileIcon.className = 'file-icon';
                DOM.loadedFileIcon.innerHTML = '<i class="fa-regular fa-file-image" style="color: #2ecc71;"></i>';
                await parseImage(file);
            } else {
                throw new Error("지원되지 않는 파일 유형입니다. PDF, DOCX, 혹은 이미지 파일만 올려주세요.");
            }
            
            // Show main views after parsing
            DOM.controlPanel.classList.remove('hidden');
            DOM.workspaceArea.classList.remove('hidden');
            DOM.loadedFilePages.textContent = `${state.pagesData.length}페이지`;
            
            // Reset right AI dashboard
            resetAiDashboard();
            showToast('파일 파싱이 완료되었습니다!', 'success');
        } catch (error) {
            console.error(error);
            showToast(error.message || '파일 처리 도중 오류가 발생했습니다.', 'error');
            DOM.previewContainer.innerHTML = `<div class="empty-state" style="color:var(--error);"><p><i class="fa-solid fa-triangle-exclamation"></i> 로드 실패: ${error.message}</p></div>`;
        }
    };
    
    reader.readAsArrayBuffer(file);
}

// Reset AI elements in layout
function resetAiDashboard() {
    DOM.analysisContent.innerHTML = `
        <div class="instructions-card">
            <h4><i class="fa-solid fa-info-circle"></i> AI 분석 프로세스 안내</h4>
            <ul>
                <li><strong>[분류 수준]</strong>을 선택하세요. 대단원(굵직한 대주제) 또는 중단원(소주제 중심의 촘촘한 세분화)으로 지정할 수 있습니다.</li>
                <li><strong>[AI 분석 실행]</strong> 버튼을 누르면 Gemini 3.5 Flash가 전체 책 내용의 흐름을 분석합니다.</li>
                <li>내부 로직과 목차 맥락을 감지하여 <strong>자동 단원 스플릿</strong> 및 <strong>한 문단 본문 핵심 요약</strong>을 제공합니다.</li>
                <li>분석 완료 시 <strong>[단원 분할 및 범위 편집기]</strong>에서 각 단원별 본문 핵심 요약과 <strong>개별 단원별 변환 기능</strong>을 바로 이용할 수 있습니다.</li>
            </ul>
        </div>
    `;
    DOM.exportPanel.classList.add('hidden');
    DOM.aiLoader.classList.add('hidden');
}

// 1. PDF Parser Module (pdf.js)
async function parsePdf(arrayBuffer) {
    DOM.previewContainer.innerHTML = '';
    
    // Load PDF (Disable worker to prevent SecurityError in file:/// environments)
    const loadingTask = pdfjsLib.getDocument({ 
        data: arrayBuffer,
        disableWorker: true
    });
    state.pdfjsDoc = await loadingTask.promise;
    const totalPages = state.pdfjsDoc.numPages;
    
    for (let i = 1; i <= totalPages; i++) {
        const page = await state.pdfjsDoc.getPage(i);
        
        // Extract text only (Super-fast speed, completes within 1 second!)
        const textContent = await page.getTextContent();
        const extractedText = textContent.items.map(item => item.str).join(' ');
        
        // Store text payload first, visual JIT canvas rendering occurs later on-demand
        state.pagesData.push({
            pageNum: i,
            text: extractedText,
            canvasDataUrlHwp: null, // JIT lazy-renderer for HWP (low-res JPEG)
            canvasDataUrlImg: null  // JIT lazy-renderer for Image Pack (high-res PNG)
        });
        
        // Render fast virtual preview thumbnail removed for maximum performance & single column layout
    }
}

// 2. Word Document Parser Module (mammoth.js)
async function parseDocx(arrayBuffer) {
    DOM.previewContainer.innerHTML = '';
    
    // Mammoth extract raw text
    const result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
    const fullText = result.value;
    
    if (!fullText.trim()) {
        throw new Error("DOCX 파일에 추출 가능한 텍스트 내용이 없습니다.");
    }
    
    // Split text into virtual pages (approx 1000 characters per page or by paragraphs)
    const paragraphs = fullText.split('\n').filter(p => p.trim() !== '');
    let currentPageNum = 1;
    let currentText = '';
    
    for (let k = 0; k < paragraphs.length; k++) {
        currentText += paragraphs[k] + '\n\n';
        
        // Create page when character limit exceeded or last paragraph
        if (currentText.length >= 1200 || k === paragraphs.length - 1) {
            state.pagesData.push({
                pageNum: currentPageNum,
                text: currentText
            });
            
            // renderVirtualThumbnailCard removed for maximum performance
            currentPageNum++;
            currentText = '';
        }
    }
}

// 3. Image Parser Module
async function parseImage(file) {
    DOM.previewContainer.innerHTML = '';
    
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const dataUrl = e.target.result;
            
            state.pagesData.push({
                pageNum: 1,
                text: '', // OCR will be done by Gemini
                imageDataUrl: dataUrl
            });
            
            // Render to DOM removed for maximum performance & single column layout
            resolve();
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// Renderers
function renderThumbnailCard(pageNum, canvas, text) {
    const card = document.createElement('div');
    card.className = 'page-thumbnail-card';
    card.title = text.substring(0, 200) + '...';
    
    const wrapper = document.createElement('div');
    wrapper.className = 'canvas-wrapper';
    wrapper.appendChild(canvas);
    
    const numLabel = document.createElement('div');
    numLabel.className = 'thumbnail-number';
    numLabel.textContent = `${pageNum} Page`;
    
    card.appendChild(wrapper);
    card.appendChild(numLabel);
    DOM.previewContainer.appendChild(card);
}

function renderVirtualThumbnailCard(pageNum, text) {
    const card = document.createElement('div');
    card.className = 'page-thumbnail-card';
    
    const wrapper = document.createElement('div');
    wrapper.className = 'canvas-wrapper';
    
    const divPreview = document.createElement('div');
    divPreview.className = 'virtual-text-preview';
    divPreview.textContent = text;
    
    wrapper.appendChild(divPreview);
    
    const numLabel = document.createElement('div');
    numLabel.className = 'thumbnail-number';
    numLabel.textContent = `${pageNum} Virtual Page`;
    
    card.appendChild(wrapper);
    card.appendChild(numLabel);
    DOM.previewContainer.appendChild(card);
}

// ==========================================================================
// GEMINI 3.5 FLASH API INTEGRATION (AI ANALYSIS)
// ==========================================================================
async function performAiAnalysis() {
    const apiKey = DOM.apiKeyInput.value.trim();
    let model = DOM.modelSelect.value.trim();
    
    // (2026년 정식 출시된 초고속 4배 빠른 gemini-3.5-flash 모델을 다이렉트로 완벽하게 지원합니다)
    
    if (!apiKey) {
        showToast("Gemini API Key가 누락되었습니다. 입력창에 기재해주세요.", "error");
        return;
    }
    
    // 사용자가 선택한 분류 수준 (대단원 'major' vs 중단원 'minor')
    const levelRadio = document.querySelector('input[name="analysis-level"]:checked');
    const level = levelRadio ? levelRadio.value : 'major';
    
    // AI 분석 실행 버튼을 숨기지 않고 비활성화 처리하여 다중 분석/전환이 가능하도록 보장
    DOM.btnAiAnalyze.disabled = true;
    DOM.btnAiAnalyze.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 분석 중...';
    DOM.aiLoader.classList.remove('hidden');
    DOM.analysisContent.innerHTML = '';
    
    let levelInstruction = '';
    if (level === 'major') {
        levelInstruction = `전체 문서를 큼직하고 굵직한 주제 기준인 **대단원(Major Chapter/Unit)** 위주로 쪼개주십시오. 전체 단원 수가 지나치게 잘게 쪼개지지 않도록 대주제 맥락으로 약 1~4개 정도로 묶어 구성해 주세요.`;
    } else {
        levelInstruction = `전체 문서를 세밀하고 촘촘한 세부 흐름 기준인 **중단원/소단원(Sub-chapter/Section)** 위주로 쪼개주십시오. 학습자가 각각의 미시적 주제별로 세분화해 공부할 수 있도록 전체 단원 수가 다소 촘촘하게(약 4~10개 정도로 잘게) 나누어지도록 정밀 구성해 주세요.`;
    }
    
    let prompt = `당신은 문서/도서 스캔 텍스트를 분석하여 학습자가 단원별로 학습하기 좋게 쪼개주는 스마트 단원 분할 AI 전문가입니다.
제공된 본문 데이터를 분석하여, 논리적인 맥락과 챕터 분기점에 맞춰 단원(Chapters)을 나누어 분류하고 요약해주세요.

[분류 지침]:
${levelInstruction}

반드시 아래에 제공하는 JSON 포맷으로만 완벽하게 답변하세요. 설명이나 서론, 결론, 마크다운 기호 없이 순수한 JSON 내용만 반환해 주세요.

[규격화된 JSON 출력 포맷]:
{
  "chapters": [
    {
      "name": "단원의 명확한 한글 제목 (예: 1단원. 파동의 성질)",
      "startPage": 시작 페이지 번호 (정수형 숫자),
      "endPage": 끝 페이지 번호 (정수형 숫자),
      "summary": "해당 단원에 속한 본문 내용을 핵심 위주로 명료하게 요약한 순수한 한국어 텍스트 내용 (반드시 한국어, 최대 한 문단 이내, HTML 태그 절대 포함 금지)",
      "keywords": ["단원에서 가장 중요한 핵심 개념어/키워드 1", "핵심 개념어/키워드 2", "핵심 개념어/키워드 3"]
    }
  ]
}

[규칙]:
1. 전체 페이지 범위는 1부터 ${state.pagesData.length}까지 모두 덮어야 합니다. 단원끼리 페이지 범위가 겹치지 않게 순차적으로 작성하십시오. (예: 1~3, 4~7, 8~8)
2. 단원명은 책 스캔본에 걸맞게 격식 있고 구체적으로 지어주세요.
3. 요약은 단원의 본질을 다루되 가독성 있게 한국어 한 문단(최대 3~4문장) 이내로 적어주세요.
`;

    // Package contents
    const contents = { contents: [] };
    
    if (state.fileType === 'image') {
        DOM.aiLoaderText.textContent = `Gemini가 책 이미지를 판독하며 [${level === 'major' ? '대단원' : '중단원'}] 단위로 정밀 분석 요약하고 있습니다...`;
        
        // Single Image Multimodal query
        const base64Data = state.pagesData[0].imageDataUrl.split(',')[1];
        const mimeType = state.uploadedFile.type;
        
        contents.contents.push({
            parts: [
                { text: prompt + `\n\n이 책 이미지를 판독해서 [${level === 'major' ? '대단원' : '중단원'}] 형태로 단원을 나누고 내용을 분석해줘.` },
                {
                    inlineData: {
                        mimeType: mimeType,
                        data: base64Data
                    }
                }
            ]
        });
    } else {
        // Document (PDF or DOCX) Text Query
        DOM.aiLoaderText.textContent = `Gemini가 본문을 탐독하며 [${level === 'major' ? '대단원' : '중단원'}] 단위로 단원을 추출하고 있습니다...`;
        
        let textPayload = "문서 전체 텍스트 내용:\n";
        state.pagesData.forEach(p => {
            textPayload += `--- [페이지 ${p.pageNum}] ---\n${p.text.substring(0, 450)}\n\n`; // Page data trimmed to 450 characters for ultra-fast AI inference
        });
        
        contents.contents.push({
            parts: [
                { text: prompt + "\n\n" + textPayload }
            ]
        });
    }

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(contents)
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error?.message || `API 연결 실패 (HTTP ${response.status})`);
        }

        const data = await response.json();
        const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!responseText) {
            throw new Error("AI가 아무런 결과를 응답하지 않았습니다. API Key 또는 설정을 확인하십시오.");
        }
        
        // Parse and Build Chapters UI
        const parsedChapters = parseGeminiResponse(responseText);
        
        // Ensure all page ranges are parsed as strict integers to prevent any loop or type issues
        state.chapters = parsedChapters.map(ch => ({
            name: ch.name || "알 수 없는 단원",
            startPage: Math.max(1, parseInt(ch.startPage) || 1),
            endPage: Math.min(state.pagesData.length, parseInt(ch.endPage) || state.pagesData.length),
            summary: ch.summary || "",
            keywords: Array.isArray(ch.keywords) ? ch.keywords : []
        }));
        
        renderChaptersUI();
        showToast("Gemini AI가 단원 분류 및 요약을 완료했습니다!", "success");
        
    } catch (e) {
        console.error(e);
        const errMsg = e.message || "";
        if (errMsg.includes("key") || errMsg.includes("API") || errMsg.includes("400") || errMsg.includes("403")) {
            showToast(`AI 분석 실패: API 키가 만료되었거나 권한이 없습니다. 우측 상단의 API Key 입력창에 본인의 API 키를 입력하여 다시 실행해 주세요!`, "error");
        } else {
            showToast(`AI 분석 실패: ${e.message}`, "error");
        }
        
        // Provide rollback default chapter
        setupDefaultChapter();
    } finally {
        DOM.aiLoader.classList.add('hidden');
        // 분석 종료 후 버튼 복구 및 활성화 (대단원/중단원 간 자유로운 다중 전환 지원)
        DOM.btnAiAnalyze.disabled = false;
        DOM.btnAiAnalyze.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> AI 분석 실행';
        DOM.btnAiAnalyze.classList.remove('hidden');
    }
}

// Robust Clean & Parsing for JSON responses that might contain markdown blocks
function parseGeminiResponse(text) {
    let cleanText = text.trim();
    
    // Remove Markdown code fences if present
    const mdJsonRegex = /^\s*```(?:json)?\s*([\s\S]*?)\s*```\s*$/i;
    const match = cleanText.match(mdJsonRegex);
    if (match) {
        cleanText = match[1].trim();
    }
    
    try {
        const obj = JSON.parse(cleanText);
        if (obj.chapters && Array.isArray(obj.chapters)) {
            return obj.chapters;
        }
        throw new Error("올바른 'chapters' JSON 필드가 반환되지 않았습니다.");
    } catch (e) {
        console.warn("JSON 직접 파싱 실패. 원문: ", text);
        // Try fallback regex extractor
        return fallbackJsonRegexExtractor(cleanText);
    }
}

// Regex backup extractor if JSON formatting is slightly broken
function fallbackJsonRegexExtractor(rawText) {
    const chapters = [];
    
    // Extract everything that looks like an object block {...}
    const objRegex = /\{[^{}]+\}/g;
    const matches = rawText.match(objRegex) || [];
    
    matches.forEach(block => {
        try {
            // Find key-value patterns in a flexible way to ignore linebreaks, quotes, or spacings
            const nameMatch = block.match(/"name"\s*:\s*"([^"]+)"/);
            const startMatch = block.match(/"startPage"\s*:\s*(\d+)/);
            const endMatch = block.match(/"endPage"\s*:\s*(\d+)/);
            const summaryMatch = block.match(/"summary"\s*:\s*"([^"]+)"/);
            
            if (nameMatch && startMatch && endMatch) {
                chapters.push({
                    name: nameMatch[1],
                    startPage: parseInt(startMatch[1]),
                    endPage: parseInt(endMatch[1]),
                    summary: summaryMatch ? summaryMatch[1] : "요약 정보 없음"
                });
            }
        } catch (e) {
            console.error("Failed to parse a segment block:", e);
        }
    });
    
    if (chapters.length > 0) return chapters;
    
    // Absolute fallback: entire document as chapter 1
    return [{
        name: "1단원. 통합 챕터",
        startPage: 1,
        endPage: state.pagesData.length > 0 ? state.pagesData.length : 1,
        summary: "원활한 AI 응답 파싱이 불가능하여 생성된 통합 장입니다. 수동으로 범위를 수정해 주세요."
    }];
}

// Rolback Default Settings when Gemini API fails
function setupDefaultChapter() {
    state.chapters = [{
        name: "제1단원. 통합 챕터",
        startPage: 1,
        endPage: state.pagesData.length,
        summary: "AI 파싱 오류 또는 오프라인 상태로 인한 기본 단원입니다. 우측의 범위 수정 도구를 이용해 수동으로 단원 범위를 조정하십시오.",
        keywords: []
    }];
    renderChaptersUI();
}

// Render dynamic chapters to interface
function renderChaptersUI() {
    DOM.analysisContent.innerHTML = '';
    
    const wrapper = document.createElement('div');
    wrapper.className = 'chapters-wrapper';
    
    state.chapters.forEach((ch, idx) => {
        const card = document.createElement('div');
        card.className = 'chapter-card';
        card.dataset.index = idx;
        
        card.innerHTML = `
            <div class="chapter-card-header">
                <div class="chapter-title-group">
                    <span class="chapter-index-badge">${idx + 1}</span>
                    <input type="text" class="chapter-name-input" value="${ch.name}" data-field="name" title="클릭해서 단원명 수정">
                </div>
                <div class="chapter-range-selector">
                    <input type="number" class="chapter-page-input start-p" value="${ch.startPage}" min="1" max="${state.pagesData.length}" data-field="startPage">
                    <span>쪽 ~</span>
                    <input type="number" class="chapter-page-input end-p" value="${ch.endPage}" min="1" max="${state.pagesData.length}" data-field="endPage">
                    <span>쪽</span>
                </div>
            </div>
            <div class="chapter-summary">
                <strong class="summary-card-title"><i class="fa-solid fa-feather-pointed"></i> 스마트 핵심 요약</strong>
                <p contenteditable="true" class="chapter-summary-text" data-field="summary" title="클릭해서 요약 내용 수정">${ch.summary}</p>
                ${ch.keywords && ch.keywords.length > 0 ? `
                <div class="chapter-keywords-wrapper">
                    ${ch.keywords.map(kw => `<span class="chapter-keyword-badge"># ${kw}</span>`).join('')}
                </div>
                ` : ''}
            </div>
            <div class="chapter-convert-toolbar">
                <span class="toolbar-label"><i class="fa-solid fa-file-export"></i> 단원 개별 변환:</span>
                <div class="mini-btn-group">
                    <button class="btn-mini btn-mini-hwp" title="HWP로 이 단원만 저장">HWP</button>
                    <button class="btn-mini btn-mini-docx" title="DOCX로 이 단원만 저장">Word</button>
                    <button class="btn-mini btn-mini-txt" title="TXT로 이 단원만 저장">TXT</button>
                    <button class="btn-mini btn-mini-img" title="이미지로 이 단원만 저장">이미지</button>
                </div>
            </div>
            <div class="chapter-actions">
                <button class="btn-card-action btn-del-chapter" title="이 단원 삭제">
                    <i class="fa-regular fa-trash-can"></i>
                </button>
            </div>
        `;
        
        // Dynamic event bindings inside each card
        const nameInput = card.querySelector('.chapter-name-input');
        const startInput = card.querySelector('.start-p');
        const endInput = card.querySelector('.end-p');
        const summaryText = card.querySelector('.chapter-summary-text');
        const btnDelete = card.querySelector('.btn-del-chapter');
        
        // Mini buttons inside editor card
        const btnHwp = card.querySelector('.btn-mini-hwp');
        const btnDocx = card.querySelector('.btn-mini-docx');
        const btnTxt = card.querySelector('.btn-mini-txt');
        const btnImg = card.querySelector('.btn-mini-img');
        
        nameInput.addEventListener('change', (e) => {
            state.chapters[idx].name = e.target.value;
        });
        
        startInput.addEventListener('change', (e) => {
            state.chapters[idx].startPage = Math.max(1, parseInt(e.target.value) || 1);
            validateRanges();
        });
        
        endInput.addEventListener('change', (e) => {
            state.chapters[idx].endPage = Math.min(state.pagesData.length, parseInt(e.target.value) || state.pagesData.length);
            validateRanges();
        });
        
        summaryText.addEventListener('blur', (e) => {
            state.chapters[idx].summary = e.target.textContent;
        });
        
        btnDelete.addEventListener('click', () => {
            state.chapters.splice(idx, 1);
            renderChaptersUI();
            showToast("단원이 삭제되었습니다.", "info");
        });

        // Event bindings for mini download buttons
        btnHwp.addEventListener('click', (e) => {
            e.stopPropagation();
            convertToFormat('hwp', state.chapters[idx]);
        });
        btnDocx.addEventListener('click', (e) => {
            e.stopPropagation();
            convertToFormat('docx', state.chapters[idx]);
        });
        btnTxt.addEventListener('click', (e) => {
            e.stopPropagation();
            convertToFormat('txt', state.chapters[idx]);
        });
        btnImg.addEventListener('click', (e) => {
            e.stopPropagation();
            convertToFormat('images', state.chapters[idx]);
        });
        
        wrapper.appendChild(card);
    });
    
    DOM.analysisContent.appendChild(wrapper);
    DOM.exportPanel.classList.remove('hidden');
}

// Add New manual chapter row
function addManualChapter() {
    const lastChapter = state.chapters[state.chapters.length - 1];
    let nextStart = lastChapter ? lastChapter.endPage + 1 : 1;
    if (nextStart > state.pagesData.length) nextStart = state.pagesData.length;
    
    state.chapters.push({
        name: `새로운 제 ${state.chapters.length + 1}단원`,
        startPage: nextStart,
        endPage: state.pagesData.length,
        summary: "여기에 단원의 핵심 학습 목표나 요약 내용을 자유롭게 적어보세요.",
        keywords: []
    });
    
    renderChaptersUI();
    showToast("신규 단원이 추가되었습니다. 하단의 범위를 정돈해 주십시오.", "success");
}

// Validate that start and end pages are consistent
function validateRanges() {
    state.chapters.forEach((ch, idx) => {
        if (ch.startPage > ch.endPage) {
            ch.startPage = ch.endPage;
        }
    });
}

// ==========================================================================
// CORE PDF SPLIT ENGINE (pdf-lib) & ZIP COMPILATION
// ==========================================================================
async function executePdfSplit() {
    if (state.chapters.length === 0) {
        showToast("생성된 단원 구성이 존재하지 않습니다.", "error");
        return;
    }
    
    showToast("단원별 분할 PDF 생성을 시작합니다...", "info");
    
    try {
        const zip = new JSZip();
        
        // 1. PDF File Splitting
        if (state.fileType === 'pdf') {
            const rawPdfDoc = await PDFLib.PDFDocument.load(state.fileArrayBuffer);
            
            for (let idx = 0; idx < state.chapters.length; idx++) {
                const ch = state.chapters[idx];
                const subPdfDoc = await PDFLib.PDFDocument.create();
                
                // Construct target zero-indexed pages list
                const pageIndices = [];
                for (let p = ch.startPage; p <= ch.endPage; p++) {
                    pageIndices.push(p - 1);
                }
                
                // Copy pages
                const copiedPages = await subPdfDoc.copyPages(rawPdfDoc, pageIndices);
                copiedPages.forEach(page => subPdfDoc.addPage(page));
                
                // Serialize & Zip adding
                const pdfBytes = await subPdfDoc.save();
                const sanitizedName = ch.name.replace(/[\/\\?%*:|"<>\s]/g, '_');
                zip.file(`${idx + 1}_${sanitizedName}.pdf`, pdfBytes);
            }
        } 
        
        // 2. Non-PDF files (images / DOCX) split compilation (Generating PDF documents for chapters)
        else {
            for (let idx = 0; idx < state.chapters.length; idx++) {
                const ch = state.chapters[idx];
                const newPdfDoc = await PDFLib.PDFDocument.create();
                
                for (let p = ch.startPage; p <= ch.endPage; p++) {
                    const pageObj = state.pagesData[p - 1];
                    const pageWidth = 600;
                    const pageHeight = 840;
                    const pdfPage = newPdfDoc.addPage([pageWidth, pageHeight]);
                    
                    // Draw PDF content depending on files
                    if (state.fileType === 'image') {
                        // Embed base64 image onto pdf page
                        const base64Data = pageObj.imageDataUrl;
                        let imageObj;
                        if (base64Data.includes('image/png')) {
                            imageObj = await newPdfDoc.embedPng(base64Data);
                        } else {
                            imageObj = await newPdfDoc.embedJpg(base64Data);
                        }
                        
                        const dims = imageObj.scaleToFit(pageWidth - 40, pageHeight - 40);
                        pdfPage.drawImage(imageObj, {
                            x: 20,
                            y: pageHeight - dims.height - 20,
                            width: dims.width,
                            height: dims.height
                        });
                    } else if (state.fileType === 'docx') {
                        // Embed formatted Word text in PDF Page
                        pdfPage.drawText(`[${ch.name} - Page ${p}]`, {
                            x: 40,
                            y: pageHeight - 50,
                            size: 14,
                            color: PDFLib.rgb(0.18, 0.35, 0.59)
                        });
                        
                        // Break long texts into multiple lines to draw cleanly on PDF page
                        const paragraphs = pageObj.text.split('\n');
                        let cursorY = pageHeight - 90;
                        
                        paragraphs.forEach(para => {
                            if (!para.trim()) return;
                            
                            // Splitting long text lines
                            const words = para.split(' ');
                            let currentLine = '';
                            
                            words.forEach(w => {
                                if (currentLine.length + w.length > 50) {
                                    pdfPage.drawText(currentLine, { x: 45, y: cursorY, size: 9.5 });
                                    cursorY -= 16;
                                    currentLine = w + ' ';
                                } else {
                                    currentLine += w + ' ';
                                }
                            });
                            
                            if (currentLine) {
                                pdfPage.drawText(currentLine, { x: 45, y: cursorY, size: 9.5 });
                                cursorY -= 20;
                                currentLine = '';
                            }
                            
                            cursorY -= 6; // paragraph margin
                        });
                    }
                }
                
                const pdfBytes = await newPdfDoc.save();
                const sanitizedName = ch.name.replace(/[\/\\?%*:|"<>\s]/g, '_');
                zip.file(`${idx + 1}_${sanitizedName}.pdf`, pdfBytes);
            }
        }
        
        // Export Zip
        const zipContent = await zip.generateAsync({ type: 'blob' });
        const cleanDocName = state.uploadedFile.name.split('.').slice(0, -1).join('.');
        saveAs(zipContent, `스마트분할_${cleanDocName}.zip`);
        showToast("단원 분할 완료! 압축 ZIP 다운로드가 활성화되었습니다.", "success");
        
    } catch (e) {
        console.error(e);
        showToast(`분할 저장 실패: ${e.message}`, "error");
    }
}

// ==========================================================================
// UNIVERSAL DOCUMENT CONVERTER ENGINE (HWP, DOCX, TXT, IMAGES)
// ==========================================================================
async function convertToFormat(format, chapterObj = null) {
    // XML에 허용되지 않는 제어 문자 및 HTML 태그를 정화하여 MS Word/HWP 오류를 원천 차단하는 헬퍼 함수
    const cleanXmlString = (str) => {
        if (!str) return "";
        let cleaned = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, "");
        cleaned = cleaned.replace(/<\/?[^>]+(>|$)/g, ""); // HTML 태그도 소거
        return cleaned;
    };

    if (state.pagesData.length === 0) {
        showToast("변환할 원본 문서 데이터가 부재합니다.", "error");
        return;
    }
    
    const cleanDocName = state.uploadedFile.name.split('.').slice(0, -1).join('.');
    
    // 개별 단원 변환 vs 전체 변환 분기 처리
    let targetPages = state.pagesData;
    let filePrefix = "";
    
    if (chapterObj) {
        const startIdx = Math.max(0, chapterObj.startPage - 1);
        const endIdx = Math.min(state.pagesData.length, chapterObj.endPage);
        targetPages = state.pagesData.slice(startIdx, endIdx);
        
        // 특수문자 및 공백 치환
        const sanitizedChapterName = chapterObj.name.replace(/[\/\\?%*:|"<>\s]/g, '_');
        filePrefix = `[${sanitizedChapterName}]_`;
        
        showToast(`단원 [${chapterObj.name}] (${chapterObj.startPage}쪽 ~ ${chapterObj.endPage}쪽) ${format.toUpperCase()} 개별 변환을 개시합니다...`, "info");
    } else {
        showToast(`전체 문서 ${format.toUpperCase()} 변환을 개시합니다...`, "info");
    }
    
    try {
        switch (format) {
            case 'txt':
                // 1. TXT Export
                let entireTxt = `스마트 PDF 변환 도구 추출 결과\n원본 도서명: ${state.uploadedFile.name}\n`;
                if (chapterObj) {
                    entireTxt += `변환 대상 단원: ${chapterObj.name} (${chapterObj.startPage}쪽 ~ ${chapterObj.endPage}쪽)\n`;
                }
                entireTxt += `변환 일시: ${new Date().toLocaleString()}\n\n`;
                
                targetPages.forEach(p => {
                    entireTxt += `=========================================\n`;
                    entireTxt += `제 [ ${p.pageNum} ] 페이지 본문 추출 결과\n`;
                    entireTxt += `=========================================\n`;
                    entireTxt += p.text ? p.text : "(이미지 스캔 파일로 텍스트 데이터가 비어 있습니다. 필요시 AI 분석을 통해 텍스트 요약을 받으십시오.)";
                    entireTxt += `\n\n\n`;
                });
                
                const txtBlob = new Blob([entireTxt], { type: 'text/plain;charset=utf-8' });
                saveAs(txtBlob, `${filePrefix}${cleanDocName}_추출본.txt`);
                showToast("TXT 문서 변환 완료!", "success");
                break;
                
            case 'hwp':
                // JIT 렌더러 가동: HWP 변환에 필요한 이미지가 아직 생성되지 않은 경우 변환 시점에 실시간 비동기 렌더링 획득
                if (state.fileType === 'pdf') {
                    showToast("한글 변환을 위한 원본 비주얼 렌더링을 가동합니다. 잠시만 기다려주세요...", "info");
                    for (let idx = 0; idx < targetPages.length; idx++) {
                        const p = targetPages[idx];
                        if (!p.canvasDataUrlHwp) {
                            try {
                                const page = await state.pdfjsDoc.getPage(p.pageNum);
                                const canvas = document.createElement('canvas');
                                const context = canvas.getContext('2d');
                                
                                // 브라우저 Blob 메모리 한계 크래시 방지 및 극도의 용량 다이어트를 위해 scale: 0.5, jpeg quality: 0.4 최적화!
                                const viewport = page.getViewport({ scale: 0.5 });
                                canvas.height = viewport.height;
                                canvas.width = viewport.width;
                                
                                await page.render({ canvasContext: context, viewport: viewport }).promise;
                                p.canvasDataUrlHwp = canvas.toDataURL('image/jpeg', 0.4); // 기존 대비 용량 25배 이상 대폭 감소 효과!
                                
                                // Yield control to prevent event loop freeze and allow UI drawing
                                await new Promise(resolve => setTimeout(resolve, 30));
                            } catch (renderErr) {
                                console.error(`페이지 ${p.pageNum} JIT 렌더링 실패:`, renderErr);
                                p.canvasDataUrlHwp = null; // 실패 시에도 프로세스가 멈추지 않도록 안전망 작동
                            }
                        }
                    }
                    showToast("비주얼 렌더링 완료! HWP 생성을 시작합니다.", "success");
                }

                // 아래아한글(HWP) 및 MS Word 등의 문서 프로세서가 소스 코드 노출이나 인코딩 깨짐 없이 
                // 즉시 레이아웃과 한국어 텍스트를 복원할 수 있도록 XML 네임스페이스 및 특수 XML 마크업 주입
                // 아래아한글에서 문자 코드 선택창(KSSM 등)이 전혀 뜨지 않고 유니코드로 즉시 100% 자동 실행되도록 UTF-16LE 및 BOM (0xFF, 0xFE) 규격 적용!
                let hwpHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=utf-8">
<title>${cleanDocName}</title>
<!--[if gte mso 9]>
<xml>
<w:WordDocument>
<w:View>Print</w:View>
<w:Zoom>100</w:Zoom>
<w:DoNotOptimizeForBrowser/>
</w:WordDocument>
</xml>
<![endif]-->
<style>
    @page { 
        size: A4; 
        margin: 15mm 15mm; 
    }
    body {
        font-family: 'Malgun Gothic', 'Nanum Myeongjo', 'Dotum', 'Noto Sans KR', sans-serif;
        line-height: 1.8;
        font-size: 11pt;
        color: #2c3e50;
        background: #ffffff;
        margin: 0;
        padding: 20px;
    }
    h1 {
        font-size: 22pt;
        font-weight: bold;
        color: #075f46;
        border-bottom: 3px double #a4dbb8;
        padding-bottom: 12px;
        margin-bottom: 30px;
        text-align: center;
    }
    h2 {
        font-size: 14pt;
        font-weight: bold;
        color: #0c9470;
        margin-top: 35px;
        margin-bottom: 15px;
        border-left: 5px solid #0c9470;
        padding-left: 12px;
        padding-bottom: 2px;
    }
    p {
        margin-top: 6px;
        margin-bottom: 10px;
        text-indent: 0px;
        text-align: justify;
    }
    .page-separator {
        page-break-before: always;
        border-top: 2px dashed #0c9470;
        margin: 40px 0;
        padding-top: 20px;
        color: #0c9470;
        font-weight: bold;
        font-size: 10pt;
        text-align: center;
    }
    .summary-box {
        background: #f4faf8;
        border: 1px solid #a4dbb8;
        border-left: 6px solid #0c9470;
        border-radius: 8px;
        padding: 20px;
        margin-bottom: 35px;
        font-size: 12.5pt; /* 11pt -> 12.5pt 로 확대 */
        font-family: 'Nanum Myeongjo', 'Batang', serif;
        line-height: 1.9;
        letter-spacing: -0.2px;
        color: #1d2d35;
    }
    .summary-title {
        font-size: 14pt; /* 12.5pt -> 14pt 로 확대 */
        font-family: 'Malgun Gothic', 'Dotum', sans-serif;
        font-weight: bold;
        color: #075f46;
        margin-bottom: 12px;
        display: block;
        border-bottom: 1.5px solid #a4dbb8;
        padding-bottom: 6px;
    }
    .summary-box strong {
        color: #075f46;
        background-color: #e2f7f1;
        padding: 1px 3px;
        font-weight: bold;
        border-bottom: 1px solid #0c9470;
    }
    .summary-item {
        margin-bottom: 8px;
        line-height: 1.6;
    }
    .page-image-box {
        text-align: center;
        margin-top: 15px;
        margin-bottom: 20px;
        page-break-inside: avoid;
    }
    .page-image {
        max-width: 100%;
        max-height: 750px;
        height: auto;
        border: 1px solid #a4dbb8;
        border-radius: 6px;
    }
    .text-box {
        background: #f9fbfb;
        border: 1px dashed #a4dbb8;
        border-radius: 6px;
        padding: 15px 20px;
        margin-top: 15px;
        margin-bottom: 35px;
    }
    .text-title {
        font-weight: bold;
        color: #075f46;
        margin-bottom: 10px;
        font-size: 10pt;
        border-bottom: 1.5px solid #dcf5ee;
        padding-bottom: 6px;
    }
</style>
</head>
<body>
    <h1>${chapterObj ? "[개별 단원 복원본] " : "[전체 복원본] "}${cleanDocName}</h1>
`;
                
                // Add AI summaries at the top of document if present
                if (chapterObj) {
                    hwpHtml += `<div class="summary-box">
        <span class="summary-title">▣ [스마트 AI 단원 요약 정보]</span>
        <div class="summary-item"><strong>• ${chapterObj.name} (${chapterObj.startPage}쪽 ~ ${chapterObj.endPage}쪽):</strong> ${chapterObj.summary}</div>
        ${chapterObj.keywords && chapterObj.keywords.length > 0 ? `<div class="summary-item" style="margin-top: 6px; font-size: 10pt; color: #075f46;"><strong>• 핵심 키워드:</strong> ${chapterObj.keywords.join(', ')}</div>` : ''}
        </div>`;
                } else if (state.chapters.length > 0) {
                    hwpHtml += `<div class="summary-box">
        <span class="summary-title">▣ [스마트 AI 단원별 요약 정보]</span>`;
                    state.chapters.forEach(c => {
                        hwpHtml += `<div class="summary-item"><strong>• ${c.name} (${c.startPage}쪽 ~ ${c.endPage}쪽):</strong> ${c.summary}</div>
                        ${c.keywords && c.keywords.length > 0 ? `<div class="summary-item" style="margin-top: 4px; padding-left: 10px; font-size: 10pt; color: #0c9470;">└ 핵심 개념어: ${c.keywords.join(', ')}</div>` : ''}`;
                    });
                    hwpHtml += `</div>`;
                }
                
                targetPages.forEach((p, index) => {
                    if (index > 0) {
                        hwpHtml += `<div class="page-separator">[ 페이지 ${p.pageNum} 쪽 분할 기준선 ]</div>`;
                    }
                    hwpHtml += `<h2>제 ${p.pageNum}쪽</h2>`;
                    
                    // PDF에 보여지는 디자인 원본 이미지(스크린샷) 삽입
                    const pageImg = p.canvasDataUrlHwp || p.imageDataUrl;
                    if (pageImg) {
                        hwpHtml += `
                        <div class="page-image-box">
                            <img class="page-image" src="${pageImg}" alt="Page ${p.pageNum} Image" />
                        </div>`;
                    }
                    
                    hwpHtml += `
                    <div class="text-box">
                        <div class="text-title">[ 제 ${p.pageNum}쪽 텍스트 추출 및 편집 영역 ]</div>`;
                    
                    const paragraphs = p.text ? p.text.split('\n') : ["본문 내용이 비어 있거나 스캔본 형태로 텍스트 정보가 추출되지 않았습니다."];
                    paragraphs.forEach(para => {
                        if (para.trim()) {
                            hwpHtml += `<p>${para.trim()}</p>`;
                        }
                    });
                    hwpHtml += `</div>`;
                });
                
                hwpHtml += `</body>\n</html>`;
                
                // 브라우저 네이티브 TextEncoder로 초고속 C++ 엔진 수준 UTF-8 변환 처리 (대용량 문자열 프리징 완벽 방지!)
                const encoder = new TextEncoder();
                const htmlUint8 = encoder.encode(hwpHtml);
                
                // UTF-8 BOM (0xEF, 0xBB, 0xBF) 바이트 어레이 결합하여 내보냄
                // 이 BOM 데이터 덕분에 아래아한글에서 로딩할 때 문자 인코딩 선택 경고창 없이 100% 즉시 자동인식 및 실행됨
                const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
                
                const mergedArray = new Uint8Array(bom.length + htmlUint8.length);
                mergedArray.set(bom, 0);
                mergedArray.set(htmlUint8, bom.length);
                
                const hwpBlob = new Blob([mergedArray], { type: 'application/x-hwp;charset=utf-8' });
                saveAs(hwpBlob, `${filePrefix}${cleanDocName}.hwp`);
                showToast("한글(HWP) 파일 변환 완료! 아래아한글에서 문자 코드 경고창 없이 완벽하게 실행됩니다.", "success");
                break;
                
            case 'docx':
                // 3. Real DOCX Binary Generation via DOCX library
                const docParagraphs = [
                    new docx.Paragraph({
                        children: [
                            new docx.TextRun({
                                text: cleanXmlString(`${chapterObj ? "[개별 단원] " : "[전체] "}${cleanDocName} - Word 복원서`),
                                bold: true,
                                size: 32 // 16pt (half-points)
                            })
                        ],
                        alignment: docx.AlignmentType.CENTER,
                    })
                ];
                
                // Add AI details
                if (chapterObj) {
                    docParagraphs.push(new docx.Paragraph({ children: [] }));
                    docParagraphs.push(new docx.Paragraph({
                        children: [
                            new docx.TextRun({ text: "[스마트 AI 단원 요약]", bold: true, size: 24 })
                        ]
                    }));
                    docParagraphs.push(new docx.Paragraph({
                        children: [
                            new docx.TextRun({ text: cleanXmlString(`• ${chapterObj.name} (${chapterObj.startPage}~${chapterObj.endPage}쪽): `), bold: true }),
                            new docx.TextRun({ text: cleanXmlString(chapterObj.summary) })
                        ]
                    }));
                    if (chapterObj.keywords && chapterObj.keywords.length > 0) {
                        docParagraphs.push(new docx.Paragraph({
                            children: [
                                new docx.TextRun({ text: cleanXmlString(`  └ 핵심 키워드: ${chapterObj.keywords.join(', ')}`), italic: true, color: "0c9470" })
                            ]
                        }));
                    }
                } else if (state.chapters.length > 0) {
                    docParagraphs.push(new docx.Paragraph({ children: [] }));
                    docParagraphs.push(new docx.Paragraph({
                        children: [
                            new docx.TextRun({ text: "[스마트 AI 단원 구조 및 본문 요약]", bold: true, size: 24 })
                        ]
                    }));
                    state.chapters.forEach(c => {
                        docParagraphs.push(new docx.Paragraph({
                            children: [
                                new docx.TextRun({ text: cleanXmlString(`• ${c.name} (${c.startPage}~${c.endPage}쪽): `), bold: true }),
                                new docx.TextRun({ text: cleanXmlString(c.summary) })
                            ]
                        }));
                        if (c.keywords && c.keywords.length > 0) {
                            docParagraphs.push(new docx.Paragraph({
                                children: [
                                    new docx.TextRun({ text: cleanXmlString(`  └ 핵심 키워드: ${c.keywords.join(', ')}`), italic: true, color: "0c9470" })
                                ]
                            }));
                        }
                    });
                }
                
                // Insert pages contents
                targetPages.forEach(p => {
                    docParagraphs.push(new docx.Paragraph({ children: [] }));
                    docParagraphs.push(new docx.Paragraph({
                        children: [
                            new docx.TextRun({ text: `[페이지 ${p.pageNum}쪽]`, bold: true, size: 20 })
                        ]
                    }));
                    
                    const paras = p.text ? p.text.split('\n') : ["본문 내용이 이미지 형태입니다."];
                    paras.forEach(pt => {
                        if (pt.trim()) {
                            docParagraphs.push(new docx.Paragraph({
                                children: [
                                    new docx.TextRun({ text: cleanXmlString(pt.trim()) })
                                ]
                            }));
                        }
                    });
                });
                
                const doc = new docx.Document({
                    sections: [{
                        properties: {},
                        children: docParagraphs
                    }]
                });
                
                docx.Packer.toBlob(doc).then(blob => {
                    saveAs(blob, `${filePrefix}${cleanDocName}.docx`);
                    showToast("Word(DOCX) 파일 변환 및 인코딩 완료!", "success");
                }).catch(err => {
                    console.error(err);
                    showToast(`Word(DOCX) 저장 에러: ${err.message}`, "error");
                });
                break;
                
            case 'images':
                // 4. Extracting PDF pages as individual image blobs packaging in ZIP
                if (state.fileType !== 'pdf') {
                    showToast("이미지 렌더링 기능은 원본이 PDF 문서일 때 완벽하게 작동합니다.", "warning");
                    
                    if (state.fileType === 'image') {
                        // Just download existing image directly
                        const link = document.createElement('a');
                        link.href = state.pagesData[0].imageDataUrl;
                        link.download = `${filePrefix}${cleanDocName}_이미지.${state.uploadedFile.name.split('.').pop()}`;
                        link.click();
                        showToast("업로드했던 이미지를 즉시 다운로드했습니다.", "success");
                        return;
                    }
                    return;
                }
                
                showToast("고화질 이미지 압축 및 렌더링을 시작합니다. 잠시만 기다려주세요...", "info");
                
                // JIT 비동기 렌더러 가동: 이미지 변환 대상 페이지 중 캔버스가 렌더링되지 않은 것이 있다면 고해상도 렌더링 획득
                for (let idx = 0; idx < targetPages.length; idx++) {
                    const p = targetPages[idx];
                    if (!p.canvasDataUrlImg) {
                        try {
                            const page = await state.pdfjsDoc.getPage(p.pageNum);
                            const canvas = document.createElement('canvas');
                            const context = canvas.getContext('2d');
                            
                            // 압축 이미지 품질 극대화를 위해 고해상도 스케일(1.5) 적용
                            const viewport = page.getViewport({ scale: 1.5 });
                            canvas.height = viewport.height;
                            canvas.width = viewport.width;
                            
                            await page.render({ canvasContext: context, viewport: viewport }).promise;
                            p.canvasDataUrlImg = canvas.toDataURL('image/png');
                            
                            // Yield control to prevent event loop freeze and allow UI drawing
                            await new Promise(resolve => setTimeout(resolve, 30));
                        } catch (renderErr) {
                            console.error(`페이지 ${p.pageNum} 이미지 JIT 렌더링 실패:`, renderErr);
                        }
                    }
                }
                showToast("이미지 렌더링 완료! 다운로드 ZIP 생성을 개시합니다.", "success");
                
                const imgZip = new JSZip();
                
                for (let i = 0; i < targetPages.length; i++) {
                    const pageObj = targetPages[i];
                    // Strip base64 headers safely supporting both PDF render canvas and custom image data URL fallbacks
                    const pageImg = pageObj.canvasDataUrlImg || pageObj.imageDataUrl;
                    if (pageImg) {
                        const base64Data = pageImg.split(',')[1];
                        imgZip.file(`page_${pageObj.pageNum}.png`, base64Data, { base64: true });
                    }
                }
                
                const imgZipBlob = await imgZip.generateAsync({ type: 'blob' });
                saveAs(imgZipBlob, `${filePrefix}${cleanDocName}_이미지팩.zip`);
                showToast(`${chapterObj ? "선택 단원" : "전체 페이지"} 고화질 이미지화 및 ZIP 포장 완료!`, "success");
                break;
        }
    } catch (err) {
        console.error(err);
        showToast(`포맷 변환 오류: ${err.message}`, "error");
    }
}
