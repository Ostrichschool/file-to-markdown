// グローバル変数
let selectedFiles = [];
let conversionResults = [];

// DOM要素
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const fileList = document.getElementById('file-list');
const fileListContent = document.getElementById('file-list-content');
const convertBtn = document.getElementById('convert-btn');
const clearBtn = document.getElementById('clear-btn');
const resultsContainer = document.getElementById('results');
const modal = document.getElementById('modal');
const modalFilename = document.getElementById('modal-filename');
const modalBody = document.getElementById('modal-body');
const closeBtn = document.getElementById('close-btn');

// 初期化
document.addEventListener('DOMContentLoaded', () => {
    setupDragAndDrop();
    setupFileInput();
    setupButtons();
    setupModal();
});

// ドラッグ＆ドロップ設定
function setupDragAndDrop() {
    // ドラッグエントリ時
    dropZone.addEventListener('dragenter', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.add('drag-over');
    });

    // ドラッグオーバー時
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.add('drag-over');
    });

    // ドラッグ離脱時
    dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('drag-over');
    });

    // ドロップ時
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('drag-over');
        
        const files = Array.from(e.dataTransfer.files);
        addFiles(files);
    });
}

// ファイル入力設定
function setupFileInput() {
    fileInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        addFiles(files);
        // 入力リセットで同じファイルを再度選択可能に
        fileInput.value = '';
    });
}

// ボタン設定
function setupButtons() {
    convertBtn.addEventListener('click', handleConvert);
    clearBtn.addEventListener('click', clearAll);
}

// モーダル設定
function setupModal() {
    closeBtn.addEventListener('click', closeModal);
    
    // モーダル外をクリックで閉じる
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });
    
    // Escapeキーで閉じる
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
            closeModal();
        }
    });
}

// ファイルを追加
function addFiles(files) {
    files.forEach(file => {
        // 重複チェック
        const exists = selectedFiles.some(f => f.name === file.name && f.size === file.size);
        if (!exists) {
            selectedFiles.push(file);
        }
    });
    updateFileList();
}

// ファイルリストを更新
function updateFileList() {
    if (selectedFiles.length === 0) {
        fileList.classList.add('hidden');
        convertBtn.disabled = true;
        return;
    }
    
    fileList.classList.remove('hidden');
    convertBtn.disabled = false;
    
    fileListContent.innerHTML = selectedFiles.map((file, index) => `
        <div class="file-list-item">
            <span class="file-icon">${getFileIcon(file.name)}</span>
            <span class="file-name" title="${file.name}">${file.name}</span>
            <span class="file-size">${formatFileSize(file.size)}</span>
        </div>
    `).join('');
}

// ファイル拡張子に応じたアイコンを取得
function getFileIcon(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const iconMap = {
        'pdf': '📄',
        'doc': '📝',
        'docx': '📝',
        'xls': '📊',
        'xlsx': '📊',
        'ppt': '📑',
        'pptx': '📑',
        'txt': '📃',
        'html': '🌐',
        'htm': '🌐',
        'jpg': '🖼️',
        'jpeg': '🖼️',
        'png': '🖼️',
        'gif': '🖼️',
        'mp4': '🎬',
        'mp3': '🎵',
        'zip': '📦',
        'json': '📋',
        'xml': '📋',
        'csv': '📊'
    };
    return iconMap[ext] || '📁';
}

// ファイルサイズをフォーマット
function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// 変換処理
async function handleConvert() {
    if (selectedFiles.length === 0) return;
    
    // UIを更新
    convertBtn.disabled = true;
    convertBtn.textContent = '変換中...';

    // ローディング表示
    resultsContainer.classList.remove('hidden');
    const loadingHtml = `
        <div class="loading" id="loading-indicator">
            <div class="spinner"></div>
            <p>ファイルを変換しています...</p>
        </div>
    `;
    resultsContainer.insertAdjacentHTML('afterbegin', loadingHtml);
    
    try {
        // 各ファイルを変換
        for (let i = 0; i < selectedFiles.length; i++) {
            const file = selectedFiles[i];
            await convertSingleFile(file, i + 1);
        }
    } catch (error) {
        console.error('変換エラー:', error);
        addResultError('変換処理中にエラーが発生しました', error.message);
    } finally {
        const loadingEl = document.getElementById('loading-indicator');
        if (loadingEl) loadingEl.remove();
        convertBtn.disabled = false;
        convertBtn.textContent = '変換実行';
        selectedFiles = [];
        updateFileList();
    }
}

// 単一ファイルの変換
async function convertSingleFile(file, index) {
    const formData = new FormData();
    formData.append('file', file);
    
    try {
        const response = await fetch('/api/convert', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            conversionResults.push({
                filename: file.name,
                success: true,
                markdown: data.markdown,
                originalLength: data.original_length || 0,
                conversionTime: data.conversion_time || 0
            });
            addResultSuccess(file.name, data.markdown.length, data.conversion_time || 0);
        } else {
            throw new Error(data.error || '変換に失敗しました');
        }
    } catch (error) {
        console.error(`ファイル変換エラー (${file.name}):`, error);
        conversionResults.push({
            filename: file.name,
            success: false,
            error: error.message
        });
        addResultError(file.name, error.message);
    }
}

// 成功結果を追加
function addResultSuccess(filename, markdownLength, conversionTime) {
    const resultId = 'result-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    const resultHtml = `
        <div class="result-item success" id="${resultId}">
            <div class="result-header">
                <span class="result-filename">${getFileIcon(filename)} ${filename}</span>
                <span class="result-status status-success">成功</span>
            </div>
            <div class="result-details">
                マークダウン文字数: ${markdownLength.toLocaleString()} | 変換時間: ${formatTime(conversionTime)}
            </div>
            <div class="result-actions">
                <button class="btn-small btn-preview" onclick="previewMarkdown('${resultId}')">プレビュー</button>
                <button class="btn-small btn-download" onclick="downloadMarkdown('${resultId}')">ダウンロード</button>
            </div>
        </div>
    `;
    resultsContainer.insertAdjacentHTML('afterbegin', resultHtml);
}

// エラー結果を追加
function addResultError(filename, errorMessage) {
    const resultId = 'result-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    const resultHtml = `
        <div class="result-item error" id="${resultId}">
            <div class="result-header">
                <span class="result-filename">${getFileIcon(filename)} ${filename}</span>
                <span class="result-status status-error">失敗</span>
            </div>
            <div class="result-details">
                エラー: ${errorMessage}
            </div>
        </div>
    `;
    resultsContainer.insertAdjacentHTML('afterbegin', resultHtml);
}

// 時間をフォーマット
function formatTime(seconds) {
    if (seconds < 1) {
        return (seconds * 1000).toFixed(0) + 'ms';
    }
    return seconds.toFixed(2) + 's';
}

// マークダウンプレビュー
function previewMarkdown(resultId) {
    // 対応する結果を探す
    let result;
    if (resultId.startsWith('result-')) {
        // resultIdからインデックスを抽出するのは難しいため、ファイル名で検索
        const resultElement = document.getElementById(resultId);
        if (resultElement) {
            const filename = resultElement.querySelector('.result-filename').textContent.replace(/^[^\s]+\s/, '');
            result = conversionResults.find(r => r.filename === filename && r.success);
        }
    }
    
    if (!result) {
        alert('プレビューデータが見つかりませんでした');
        return;
    }
    
    modalFilename.textContent = result.filename;
    modalBody.innerHTML = `<pre>${escapeHtml(result.markdown)}</pre>`;
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

// HTMLをエスケープ
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// マークダウンダウンロード
function downloadMarkdown(resultId) {
    let result;
    const resultElement = document.getElementById(resultId);
    if (resultElement) {
        const filename = resultElement.querySelector('.result-filename').textContent.replace(/^[^\s]+\s/, '');
        result = conversionResults.find(r => r.filename === filename && r.success);
    }
    
    if (!result) {
        alert('ダウンロードデータが見つかりませんでした');
        return;
    }
    
    // .md拡張子で保存
    const mdFilename = result.filename.replace(/\.[^/.]+$/, '') + '.md';
    const blob = new Blob([result.markdown], { type: 'text/markdown; charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = mdFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// モーダルを閉じる
function closeModal() {
    modal.classList.add('hidden');
    document.body.style.overflow = '';
}

// すべてクリア
function clearAll() {
    selectedFiles = [];
    conversionResults = [];
    updateFileList();
    resultsContainer.innerHTML = '';
}