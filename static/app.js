// グローバル変数
let selectedFiles = [];
let conversionResults = [];
let vaultFiles = [];
let currentVaultPath = '';

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
const vaultFileList = document.getElementById('vault-file-list');
const vaultSearch = document.getElementById('vault-search');
const refreshVaultBtn = document.getElementById('refresh-vault-btn');
const documentTitle = document.getElementById('document-title');
const documentMeta = document.getElementById('document-meta');
const documentViewer = document.getElementById('document-viewer');
const historyList = document.getElementById('history-list');
const vaultStatus = document.getElementById('vault-status');

// 初期化
document.addEventListener('DOMContentLoaded', () => {
    setupTabs();
    setupDragAndDrop();
    setupFileInput();
    setupButtons();
    setupModal();
    setupVaultBrowser();
    loadVaultFiles();
    loadVaultStatus();
});

function setupTabs() {
    document.querySelectorAll('.tab-btn').forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.dataset.tab;
            document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.remove('active'));
            button.classList.add('active');
            document.getElementById(tabId).classList.add('active');
        });
    });
}

function setupVaultBrowser() {
    refreshVaultBtn.addEventListener('click', () => {
        loadVaultFiles();
        loadVaultStatus();
        if (currentVaultPath) {
            loadHistory(currentVaultPath);
        }
    });

    vaultSearch.addEventListener('input', () => renderVaultFileList());
}

async function loadVaultFiles() {
    vaultFileList.innerHTML = '<div class="muted">読み込み中...</div>';
    try {
        const response = await fetch('/api/vault/files');
        const data = await response.json();
        if (!response.ok || !data.success) {
            throw new Error(data.error || 'Vault一覧の取得に失敗しました');
        }
        vaultFiles = data.files || [];
        renderVaultFileList();
    } catch (error) {
        vaultFileList.innerHTML = `<div class="error-message">${escapeHtml(error.message)}</div>`;
    }
}

function renderVaultFileList() {
    const keyword = vaultSearch.value.trim().toLowerCase();
    const filtered = vaultFiles.filter(file => file.path.toLowerCase().includes(keyword));

    if (filtered.length === 0) {
        vaultFileList.innerHTML = '<div class="muted">表示できるMarkdownファイルがありません。</div>';
        return;
    }

    vaultFileList.innerHTML = filtered.map(file => `
        <button class="vault-file ${file.path === currentVaultPath ? 'active' : ''}" data-path="${escapeHtml(file.path)}">
            <span class="vault-file-name">📝 ${escapeHtml(file.name)}</span>
            <span class="vault-file-folder">${escapeHtml(file.folder || '/')}</span>
        </button>
    `).join('');

    document.querySelectorAll('.vault-file').forEach(button => {
        button.addEventListener('click', () => loadVaultFile(button.dataset.path));
    });
}

async function loadVaultFile(path) {
    currentVaultPath = path;
    renderVaultFileList();
    documentTitle.textContent = '読み込み中...';
    documentViewer.textContent = '';
    historyList.textContent = '履歴を読み込み中...';

    try {
        const response = await fetch(`/api/vault/file?path=${encodeURIComponent(path)}`);
        const data = await response.json();
        if (!response.ok || !data.success) {
            throw new Error(data.error || 'ファイルの取得に失敗しました');
        }

        documentTitle.textContent = data.path.split('/').pop();
        documentMeta.textContent = `${data.path} | ${formatFileSize(data.size)} | 更新: ${formatDateTime(data.modified)}`;
        documentViewer.classList.remove('empty');
        documentViewer.innerHTML = renderMarkdownLite(data.content);
        loadHistory(path);
    } catch (error) {
        documentTitle.textContent = '読み込みエラー';
        documentViewer.innerHTML = `<div class="error-message">${escapeHtml(error.message)}</div>`;
    }
}

async function loadHistory(path = '') {
    try {
        const url = path ? `/api/vault/history?path=${encodeURIComponent(path)}` : '/api/vault/history';
        const response = await fetch(url);
        const data = await response.json();
        if (!response.ok || !data.success) {
            throw new Error(data.error || '履歴の取得に失敗しました');
        }
        if (!data.git_available) {
            historyList.innerHTML = `<div class="muted">${escapeHtml(data.message || 'Git履歴は利用できません')}</div>`;
            return;
        }
        if (!data.commits || data.commits.length === 0) {
            historyList.innerHTML = '<div class="muted">このファイルのGit履歴はまだありません。</div>';
            return;
        }
        historyList.innerHTML = data.commits.map(commit => `
            <div class="commit-item">
                <code>${escapeHtml(commit.hash)}</code>
                <span class="commit-date">${escapeHtml(commit.date)}</span>
                <span class="commit-subject">${escapeHtml(commit.subject)}</span>
                <span class="commit-author">${escapeHtml(commit.author)}</span>
            </div>
        `).join('');
    } catch (error) {
        historyList.innerHTML = `<div class="error-message">${escapeHtml(error.message)}</div>`;
    }
}

async function loadVaultStatus() {
    try {
        const response = await fetch('/api/vault/status');
        const data = await response.json();
        if (!response.ok || !data.success) {
            throw new Error(data.error || 'Git状態の取得に失敗しました');
        }
        if (!data.git_available) {
            vaultStatus.innerHTML = `⚠️ ${escapeHtml(data.message || 'Git管理されていません')}`;
            vaultStatus.className = 'status-panel warning';
            return;
        }
        if (!data.changes || data.changes.length === 0) {
            vaultStatus.innerHTML = '✅ Git状態: 未コミットの変更はありません';
            vaultStatus.className = 'status-panel ok';
            return;
        }
        vaultStatus.innerHTML = `⚠️ 未コミットの変更: ${data.changes.length}件`;
        vaultStatus.className = 'status-panel warning';
    } catch (error) {
        vaultStatus.innerHTML = `⚠️ ${escapeHtml(error.message)}`;
        vaultStatus.className = 'status-panel warning';
    }
}

function renderMarkdownLite(markdown) {
    const escaped = escapeHtml(markdown);
    return escaped
        .replace(/^### (.*)$/gm, '<h3>$1</h3>')
        .replace(/^## (.*)$/gm, '<h2>$1</h2>')
        .replace(/^# (.*)$/gm, '<h1>$1</h1>')
        .replace(/^---$/gm, '<hr>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>');
}

function formatDateTime(value) {
    if (!value) return '';
    return value.replace('T', ' ');
}

// ドラッグ＆ドロップ設定
function setupDragAndDrop() {
    if (!dropZone) return;
    dropZone.addEventListener('dragenter', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('drag-over');
    });

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
    if (!fileInput) return;
    fileInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        addFiles(files);
        fileInput.value = '';
    });
}

// ボタン設定
function setupButtons() {
    if (convertBtn) convertBtn.addEventListener('click', handleConvert);
    if (clearBtn) clearBtn.addEventListener('click', clearAll);
}

// モーダル設定
function setupModal() {
    closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modal.classList.contains('hidden')) closeModal();
    });
}

// ファイルを追加
function addFiles(files) {
    files.forEach(file => {
        const exists = selectedFiles.some(f => f.name === file.name && f.size === file.size);
        if (!exists) selectedFiles.push(file);
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
    fileListContent.innerHTML = selectedFiles.map((file) => `
        <div class="file-list-item">
            <span class="file-icon">${getFileIcon(file.name)}</span>
            <span class="file-name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</span>
            <span class="file-size">${formatFileSize(file.size)}</span>
        </div>
    `).join('');
}

// ファイル拡張子に応じたアイコンを取得
function getFileIcon(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const iconMap = {
        'pdf': '📄', 'doc': '📝', 'docx': '📝', 'xls': '📊', 'xlsx': '📊',
        'ppt': '📑', 'pptx': '📑', 'txt': '📃', 'html': '🌐', 'htm': '🌐',
        'jpg': '🖼️', 'jpeg': '🖼️', 'png': '🖼️', 'gif': '🖼️', 'mp4': '🎬',
        'mp3': '🎵', 'zip': '📦', 'json': '📋', 'xml': '📋', 'csv': '📊', 'md': '📝'
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
    convertBtn.disabled = true;
    convertBtn.textContent = '変換中...';

    resultsContainer.classList.remove('hidden');
    const loadingHtml = `
        <div class="loading" id="loading-indicator">
            <div class="spinner"></div>
            <p>ファイルを変換しています...</p>
        </div>
    `;
    resultsContainer.insertAdjacentHTML('afterbegin', loadingHtml);

    try {
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
        const response = await fetch('/api/convert', { method: 'POST', body: formData });
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
        conversionResults.push({ filename: file.name, success: false, error: error.message });
        addResultError(file.name, error.message);
    }
}

// 成功結果を追加
function addResultSuccess(filename, markdownLength, conversionTime) {
    const resultId = 'result-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    const resultHtml = `
        <div class="result-item success" id="${resultId}">
            <div class="result-header">
                <span class="result-filename">${getFileIcon(filename)} ${escapeHtml(filename)}</span>
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
                <span class="result-filename">${getFileIcon(filename)} ${escapeHtml(filename)}</span>
                <span class="result-status status-error">失敗</span>
            </div>
            <div class="result-details">エラー: ${escapeHtml(errorMessage)}</div>
        </div>
    `;
    resultsContainer.insertAdjacentHTML('afterbegin', resultHtml);
}

// 時間をフォーマット
function formatTime(seconds) {
    if (seconds < 1) return (seconds * 1000).toFixed(0) + 'ms';
    return seconds.toFixed(2) + 's';
}

// マークダウンプレビュー
function previewMarkdown(resultId) {
    let result;
    const resultElement = document.getElementById(resultId);
    if (resultElement) {
        const filename = resultElement.querySelector('.result-filename').textContent.replace(/^[^\s]+\s/, '');
        result = conversionResults.find(r => r.filename === filename && r.success);
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
    div.textContent = text ?? '';
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
