import './style.css';

// 导入Wails运行时
import { GetConfig, SetTheme, SetEditorWidth, WindowMinimize, WindowMaximize, WindowClose, ExportAsTxt, ExportAsImagePathWithName, SaveImageData, GetVersion, CheckUpdate, OpenURL, ListNovels, CreateNovel, UpdateNovel, DeleteNovel, ListChapters, CreateChapter, DeleteChapter, MoveChapter, GetChapterContent, SaveChapterContent, ImportNovelFromDialog } from '../wailsjs/go/main/App';

// 导入编辑器
import { Editor, createEditor } from './editor/Editor';

// 导入模态框
import { showInputModal, showConfirmModal, showExportPreview, getExportWidthValue, getExportWidthName, getExportThemeStyle, createExportWatermark } from './components/Modal';

// ============ 类型定义 ============
interface NovelSummary {
    id: string;
    title: string;
    summary: string;
    updated_at: string;
}

interface ChapterSummary {
    id: string;
    title: string;
    outline: string;
    order_key: number;
}

interface ChapterContent {
    id: string;
    title: string;
    outline: string;
    content: string;
}

interface Novel {
    id: string;
    title: string;
}

// ============ 全局状态 ============
let isDirty = false;
let autoSaveTimer: number | null = null;
const AUTO_SAVE_INTERVAL = 30000;
let editorWidthMode: 'narrow' | 'medium' | 'wide' = 'medium';
let currentTheme: 'light' | 'dark' = 'light';
let currentFontSize: 'small' | 'medium' | 'large' = 'medium';
let currentNovelId: string | null = null;
let currentChapterId: string | null = null;
let currentLibraryCategory: 'recent' | 'novel' = 'recent';
let novels: NovelSummary[] = [];
let chapters: ChapterSummary[] = [];
let editor: Editor;
let novelDirty = false;
let currentNovelSnapshot: { title: string; summary: string } | null = null;

// ============ DOM 元素 ============
const editorContainer = document.getElementById('editor') as HTMLDivElement;
const fileTitle = document.getElementById('file-title') as HTMLSpanElement;
const saveStatus = document.getElementById('save-status') as HTMLSpanElement;
const wordCount = document.getElementById('word-count') as HTMLSpanElement;
const saveBtn = document.getElementById('save-btn') as HTMLButtonElement;
const toggleSidebarBtn = document.getElementById('toggle-sidebar-btn') as HTMLButtonElement;
const libraryHomeBtn = document.getElementById('library-home-btn') as HTMLButtonElement;
const widthModeBtn = document.getElementById('width-mode-btn') as HTMLButtonElement;
const themeToggleBtn = document.getElementById('theme-toggle-btn') as HTMLButtonElement;
const fontSizeBtn = document.getElementById('font-size-btn') as HTMLButtonElement;
const fontSizePopup = document.getElementById('font-size-popup') as HTMLDivElement;
const sidebar = document.getElementById('sidebar') as HTMLDivElement;
const inspector = document.querySelector('.inspector') as HTMLDivElement;
const exportBtn = document.getElementById('export-btn') as HTMLButtonElement;
const exportPopup = document.getElementById('export-popup') as HTMLDivElement;
const versionText = document.getElementById('version-text') as HTMLSpanElement;
const versionLink = document.getElementById('version-link') as HTMLAnchorElement;
const updateBadge = document.getElementById('update-badge') as HTMLSpanElement;
const settingsBtn = document.getElementById('settings-btn') as HTMLButtonElement;
const settingsPage = document.getElementById('settings-page') as HTMLDivElement;
const settingsCloseBtn = document.getElementById('settings-close-btn') as HTMLButtonElement;
const libraryShell = document.getElementById('library-shell') as HTMLDivElement;
const writingView = document.getElementById('writing-view') as HTMLDivElement;
const editorView = document.getElementById('editor-view') as HTMLDivElement;
const chapterSidebar = document.getElementById('chapter-sidebar') as HTMLDivElement;
const libraryTitle = document.getElementById('library-title') as HTMLDivElement;
const librarySubtitle = document.getElementById('library-subtitle') as HTMLDivElement;
const libraryList = document.getElementById('library-list') as HTMLDivElement;
const novelList = document.getElementById('novel-list') as HTMLDivElement;
const chapterList = document.getElementById('chapter-list') as HTMLDivElement;
const newNovelBtn = document.getElementById('new-novel-btn') as HTMLButtonElement;
const newChapterBtn = document.getElementById('new-chapter-btn') as HTMLButtonElement;
const chapterTitleInput = document.getElementById('chapter-title-input') as HTMLInputElement;
const chapterOutlineInput = document.getElementById('chapter-outline-input') as HTMLTextAreaElement;
const chapterInfoTitle = document.getElementById('chapter-info-title') as HTMLSpanElement;
const chapterInfoWords = document.getElementById('chapter-info-words') as HTMLSpanElement;
const novelInfoTitle = document.getElementById('novel-info-title') as HTMLSpanElement;
const importBtn = document.getElementById('import-btn') as HTMLButtonElement;
const novelTitleInput = document.getElementById('novel-title-input') as HTMLInputElement;
const novelSummaryInput = document.getElementById('novel-summary-input') as HTMLTextAreaElement;
const novelSaveBtn = document.getElementById('novel-save-btn') as HTMLButtonElement;
const novelDeleteBtn = document.getElementById('novel-delete-btn') as HTMLButtonElement;
const chapterDeleteBtn = document.getElementById('chapter-delete-btn') as HTMLButtonElement;
const chapterMoveUpBtn = document.getElementById('chapter-move-up-btn') as HTMLButtonElement;
const chapterMoveDownBtn = document.getElementById('chapter-move-down-btn') as HTMLButtonElement;

// ============ 编辑器辅助功能 ============

function updateWordCount() {
    const count = editor.getWordCount();
    wordCount.textContent = `${count} 字`;
    if (chapterInfoWords) {
        chapterInfoWords.textContent = `${count}`;
    }
}

function updateSaveStatus(saved: boolean) {
    isDirty = !saved;
    if (saved) {
        saveStatus.textContent = '·';
        saveStatus.className = 'save-status saved';
        saveStatus.title = '已保存';
    } else {
        saveStatus.textContent = '●';
        saveStatus.className = 'save-status unsaved';
        saveStatus.title = '未保存';
    }
}

function updateFileTitle() {
    if (currentChapterId) {
        const title = chapterTitleInput.value.trim();
        fileTitle.textContent = title || '未命名章节';
    } else if (currentNovelId) {
        const novel = novels.find(n => n.id === currentNovelId);
        fileTitle.textContent = novel?.title || '书库';
    } else {
        fileTitle.textContent = '书库';
    }
}

// ============ 小说与章节 ============

function showLibraryView() {
    libraryShell?.classList.remove('hidden');
    writingView?.classList.add('hidden');
    inspector?.classList.add('hidden');
    libraryHomeBtn?.classList.add('hidden');
}

function showEditorView() {
    libraryShell?.classList.add('hidden');
    writingView?.classList.remove('hidden');
    editorView?.classList.remove('hidden');
    inspector?.classList.add('hidden');
    libraryHomeBtn?.classList.remove('hidden');
    editor.focus();
}

function setChapterHeaderEnabled(enabled: boolean, placeholder: string) {
    chapterTitleInput.disabled = !enabled;
    chapterTitleInput.placeholder = placeholder;
    if (!enabled) {
        chapterTitleInput.value = '';
    }
    if (chapterOutlineInput) {
        chapterOutlineInput.disabled = !enabled;
        if (!enabled) {
            chapterOutlineInput.value = '';
        }
    }
    if (!enabled) {
        if (chapterInfoTitle) chapterInfoTitle.textContent = '-';
        if (chapterInfoWords) chapterInfoWords.textContent = '0';
    }
    if (chapterDeleteBtn) {
        chapterDeleteBtn.disabled = !enabled;
    }
    if (chapterMoveUpBtn) {
        chapterMoveUpBtn.disabled = !enabled;
    }
    if (chapterMoveDownBtn) {
        chapterMoveDownBtn.disabled = !enabled;
    }
}

function setNovelFields(novel: NovelSummary | null) {
    const enabled = !!novel;
    if (novelTitleInput) {
        novelTitleInput.disabled = !enabled;
        novelTitleInput.value = enabled ? novel!.title : '';
    }
    if (novelSummaryInput) {
        novelSummaryInput.disabled = !enabled;
        novelSummaryInput.value = enabled ? (novel!.summary || '') : '';
    }
    if (novelDeleteBtn) {
        novelDeleteBtn.disabled = !enabled;
    }
    currentNovelSnapshot = enabled
        ? { title: novel!.title, summary: novel!.summary || '' }
        : null;
    novelDirty = false;
    updateNovelSaveState();
}

function updateNovelSaveState() {
    if (novelSaveBtn) {
        novelSaveBtn.disabled = !currentNovelId || !novelDirty;
    }
}

function renderNovelList() {
    if (!novelList) return;
    novelList.innerHTML = '';

    const recentItem = document.createElement('div');
    recentItem.className = 'sidebar-list-item library-category';
    if (currentLibraryCategory === 'recent') recentItem.classList.add('selected');

    const recentTitle = document.createElement('div');
    recentTitle.className = 'sidebar-list-title';
    recentTitle.textContent = 'Recent';

    const recentSub = document.createElement('div');
    recentSub.className = 'sidebar-list-sub';
    recentSub.textContent = '最近更新';

    recentItem.appendChild(recentTitle);
    recentItem.appendChild(recentSub);
    recentItem.addEventListener('click', () => selectRecent());
    novelList.appendChild(recentItem);

    if (novels.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'sidebar-list-empty';
        empty.textContent = '暂无小说';
        novelList.appendChild(empty);
        return;
    }

    for (const novel of novels) {
        const item = document.createElement('div');
        item.className = 'sidebar-list-item library-category';
        if (currentLibraryCategory === 'novel' && currentNovelId === novel.id) item.classList.add('selected');

        const title = document.createElement('div');
        title.className = 'sidebar-list-title';
        title.textContent = novel.title;

        const summary = document.createElement('div');
        summary.className = 'sidebar-list-sub';
        summary.textContent = novel.summary || '暂无简介';

        item.appendChild(title);
        item.appendChild(summary);
        item.addEventListener('click', () => selectNovel(novel.id));

        novelList.appendChild(item);
    }
}

function renderLibraryList() {
    if (!libraryList) return;
    if (libraryTitle) libraryTitle.textContent = 'Recent';
    if (librarySubtitle) librarySubtitle.textContent = novels.length > 0 ? '最近更新的小说' : '还没有小说';

    libraryList.innerHTML = '';
    if (novels.length === 0) {
        libraryList.innerHTML = '<div class="library-empty">还没有小说。可以从左侧新建，或从工具栏导入。</div>';
        return;
    }

    for (const novel of novels) {
        const item = document.createElement('button');
        item.className = 'library-list-item recent-novel-item';
        item.type = 'button';

        const title = document.createElement('div');
        title.className = 'library-list-title';
        title.textContent = novel.title || '未命名小说';

        const summary = document.createElement('div');
        summary.className = 'library-list-sub';
        summary.textContent = novel.summary || '暂无简介';

        const meta = document.createElement('div');
        meta.className = 'library-list-meta';
        meta.textContent = novel.updated_at ? `更新于 ${formatDate(novel.updated_at)}` : '最近更新';

        item.appendChild(title);
        item.appendChild(summary);
        item.appendChild(meta);
        item.addEventListener('click', () => selectNovel(novel.id));
        libraryList.appendChild(item);
    }
}

function renderChapterList() {
    if (!chapterList) return;
    chapterList.innerHTML = '';

    if (!currentNovelId) {
        chapterList.innerHTML = '<div class="sidebar-list-empty">请选择小说</div>';
        if (newChapterBtn) newChapterBtn.disabled = true;
        return;
    }

    if (newChapterBtn) newChapterBtn.disabled = false;

    if (chapters.length === 0) {
        chapterList.innerHTML = '<div class="sidebar-list-empty">暂无章节</div>';
        return;
    }

    chapters.forEach((chapter, index) => {
        const item = document.createElement('div');
        item.className = 'sidebar-list-item';
        if (currentChapterId === chapter.id) item.classList.add('selected');

        const title = document.createElement('div');
        title.className = 'sidebar-list-title';
        title.textContent = chapter.title || `第 ${index + 1} 章`;

        const outline = document.createElement('div');
        outline.className = 'sidebar-list-sub';
        outline.textContent = chapter.outline || `第 ${index + 1} 章`;

        item.appendChild(title);
        item.appendChild(outline);
        item.addEventListener('click', () => selectChapter(chapter.id));

        chapterList.appendChild(item);
    });

    updateChapterMoveState();
}

function formatDate(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
}

async function confirmDiscardIfDirty(): Promise<boolean> {
    if (!isDirty && !novelDirty) return true;
    const confirmed = await showConfirmModal('未保存', '当前内容未保存，是否继续？');
    if (confirmed) {
        updateSaveStatus(true);
        if (novelDirty && currentNovelSnapshot) {
            if (novelTitleInput) {
                novelTitleInput.value = currentNovelSnapshot.title;
            }
            if (novelSummaryInput) {
                novelSummaryInput.value = currentNovelSnapshot.summary;
            }
            if (novelInfoTitle) {
                novelInfoTitle.textContent = currentNovelSnapshot.title || '未命名小说';
            }
        }
        novelDirty = false;
        updateNovelSaveState();
    }
    return confirmed;
}

async function loadNovels() {
    try {
        const list = await ListNovels();
        novels = (list || []) as NovelSummary[];
        renderNovelList();
        if (currentLibraryCategory === 'recent') {
            renderLibraryList();
        }
    } catch (error) {
        console.error('加载小说列表失败:', error);
    }
}

async function loadChapters(novelId: string) {
    try {
        const list = await ListChapters(novelId);
        chapters = (list || []) as ChapterSummary[];
        renderChapterList();
    } catch (error) {
        console.error('加载章节列表失败:', error);
    }
}

async function selectRecent() {
    if (currentChapterId || currentNovelId) {
        const ok = await confirmDiscardIfDirty();
        if (!ok) return;
    }

    currentLibraryCategory = 'recent';
    currentNovelId = null;
    currentChapterId = null;
    chapters = [];
    editor.clear();
    updateWordCount();
    updateSaveStatus(true);
    setChapterHeaderEnabled(false, '请选择章节');
    setNovelFields(null);
    if (novelInfoTitle) novelInfoTitle.textContent = '-';
    updateFileTitle();
    renderNovelList();
    renderLibraryList();
    showLibraryView();
}

async function selectNovel(novelId: string) {
    if (currentNovelId !== novelId) {
        const ok = await confirmDiscardIfDirty();
        if (!ok) return;
    }

    currentLibraryCategory = 'novel';
    currentNovelId = novelId;
    currentChapterId = null;
    await loadChapters(novelId);

    const novel = novels.find(n => n.id === novelId);
    if (novelInfoTitle) {
        novelInfoTitle.textContent = novel ? novel.title : '-';
    }
    setNovelFields(novel || null);

    renderNovelList();
    renderChapterList();
    showLibraryView();
    showEditorView();

    if (chapters.length > 0) {
        await selectChapter(chapters[0].id);
    } else {
        editor.clear();
        updateWordCount();
        updateSaveStatus(true);
        setChapterHeaderEnabled(false, '暂无章节');
        updateFileTitle();
    }
}

async function selectChapter(chapterId: string) {
    if (currentChapterId !== chapterId) {
        const ok = await confirmDiscardIfDirty();
        if (!ok) return;
    }

    try {
        const content = await GetChapterContent(chapterId);
        if (!content) return;

        currentChapterId = chapterId;

        const chapter = content as ChapterContent;
        setChapterHeaderEnabled(true, '章节标题');
        chapterTitleInput.value = chapter.title || '未命名章节';
        if (chapterOutlineInput) {
            chapterOutlineInput.value = chapter.outline || '';
        }
        editor.setContent(chapter.content || '');
        updateWordCount();
        updateSaveStatus(true);
        updateFileTitle();
        if (chapterInfoTitle) {
            chapterInfoTitle.textContent = chapter.title || '未命名章节';
        }
        renderChapterList();
        showEditorView();
    } catch (error) {
        console.error('加载章节失败:', error);
    }
}

function updateChapterMoveState() {
    if (!currentChapterId || chapters.length === 0) {
        if (chapterMoveUpBtn) chapterMoveUpBtn.disabled = true;
        if (chapterMoveDownBtn) chapterMoveDownBtn.disabled = true;
        return;
    }
    const index = chapters.findIndex(c => c.id === currentChapterId);
    if (chapterMoveUpBtn) chapterMoveUpBtn.disabled = index <= 0;
    if (chapterMoveDownBtn) chapterMoveDownBtn.disabled = index < 0 || index >= chapters.length - 1;
}

async function handleCreateNovel() {
    const ok = await confirmDiscardIfDirty();
    if (!ok) return;

    const title = await showInputModal('新建小说', '输入小说标题');
    if (title === null) return;

    try {
        const novel = await CreateNovel(title);
        await loadNovels();
        if (novel && (novel as NovelSummary).id) {
            await selectNovel((novel as NovelSummary).id);
        }
    } catch (error) {
        console.error('创建小说失败:', error);
        alert('创建小说失败: ' + error);
    }
}

async function handleSaveNovel() {
    if (!currentNovelId) {
        await showConfirmModal('提示', '请先选择小说');
        return;
    }
    const title = novelTitleInput ? novelTitleInput.value.trim() : '';
    const summary = novelSummaryInput ? novelSummaryInput.value.trim() : '';
    try {
        await UpdateNovel(currentNovelId, title || '未命名小说', summary);
        novelDirty = false;
        updateNovelSaveState();
        currentNovelSnapshot = { title: title || '未命名小说', summary: summary || '' };
        await loadNovels();
        if (novelInfoTitle) {
            novelInfoTitle.textContent = title || '未命名小说';
        }
    } catch (error) {
        console.error('保存小说失败:', error);
        alert('保存小说失败: ' + error);
    }
}

async function handleDeleteNovel() {
    if (!currentNovelId) {
        await showConfirmModal('提示', '请先选择小说');
        return;
    }
    const ok = await confirmDiscardIfDirty();
    if (!ok) return;

    const name = novelTitleInput?.value.trim() || '未命名小说';
    const confirmed = await showConfirmModal('删除小说', `确定删除《${name}》？此操作不可恢复。`);
    if (!confirmed) return;

    try {
        await DeleteNovel(currentNovelId);
        currentNovelId = null;
        currentChapterId = null;
        editor.clear();
        updateWordCount();
        updateSaveStatus(true);
        setChapterHeaderEnabled(false, '请选择章节');
        updateFileTitle();
        if (novelInfoTitle) novelInfoTitle.textContent = '-';
        setNovelFields(null);
        await loadNovels();
        if (novels.length > 0) {
            await selectRecent();
        } else {
            currentLibraryCategory = 'recent';
            renderNovelList();
            renderLibraryList();
            showLibraryView();
        }
    } catch (error) {
        console.error('删除小说失败:', error);
        alert('删除小说失败: ' + error);
    }
}

async function handleCreateChapter() {
    if (!currentNovelId) {
        await showConfirmModal('提示', '请先选择小说');
        return;
    }
    const ok = await confirmDiscardIfDirty();
    if (!ok) return;
    const title = await showInputModal('新建章节', '输入章节标题', '第1章');
    if (title === null) return;

    try {
        const chapter = await CreateChapter(currentNovelId, title);
        await loadChapters(currentNovelId);
        if (chapter && (chapter as ChapterSummary).id) {
            await selectChapter((chapter as ChapterSummary).id);
        }
    } catch (error) {
        console.error('创建章节失败:', error);
        alert('创建章节失败: ' + error);
    }
}

async function handleDeleteChapter() {
    if (!currentNovelId || !currentChapterId) {
        await showConfirmModal('提示', '请先选择章节');
        return;
    }
    const ok = await confirmDiscardIfDirty();
    if (!ok) return;

    const chapter = chapters.find(c => c.id === currentChapterId);
    const name = chapter?.title || '未命名章节';
    const confirmed = await showConfirmModal('删除章节', `确定删除《${name}》？此操作不可恢复。`);
    if (!confirmed) return;

    try {
        await DeleteChapter(currentChapterId);
        currentChapterId = null;
        await loadChapters(currentNovelId);
        if (chapters.length > 0) {
            await selectChapter(chapters[0].id);
        } else {
            editor.clear();
            updateWordCount();
            updateSaveStatus(true);
            setChapterHeaderEnabled(false, '暂无章节');
            updateFileTitle();
            renderChapterList();
            showEditorView();
        }
    } catch (error) {
        console.error('删除章节失败:', error);
        alert('删除章节失败: ' + error);
    }
}

async function handleMoveChapter(direction: 'up' | 'down') {
    if (!currentChapterId) {
        await showConfirmModal('提示', '请先选择章节');
        return;
    }
    try {
        const moved = await MoveChapter(currentChapterId, direction);
        if (!moved) {
            updateChapterMoveState();
            return;
        }
        if (currentNovelId) {
            await loadChapters(currentNovelId);
            renderChapterList();
        }
    } catch (error) {
        console.error('移动章节失败:', error);
        alert('移动章节失败: ' + error);
    }
}

async function handleImportNovel() {
    const ok = await confirmDiscardIfDirty();
    if (!ok) return;

    try {
        const novel = await ImportNovelFromDialog();
        if (novel && (novel as Novel).id) {
            await loadNovels();
            await selectNovel((novel as Novel).id);
        }
    } catch (error) {
        console.error('导入失败:', error);
        alert('导入失败: ' + error);
    }
}

async function handleSave() {
    const content = editor.getContent();

    try {
        if (currentChapterId) {
            const title = chapterTitleInput.value.trim() || '未命名章节';
            const outline = chapterOutlineInput ? chapterOutlineInput.value.trim() : '';
            await SaveChapterContent(currentChapterId, title, outline, content);
            if (currentNovelId) {
                await loadChapters(currentNovelId);
                renderChapterList();
            }
            updateFileTitle();
            updateSaveStatus(true);
            return;
        }
        await showConfirmModal('提示', '请先选择章节');
    } catch (error) {
        console.error('保存失败:', error);
        alert('保存失败: ' + error);
    }
}

function startAutoSave() {
    if (autoSaveTimer) clearInterval(autoSaveTimer);

    autoSaveTimer = window.setInterval(() => {
        if (isDirty && currentChapterId && editor.getPlainText().trim() !== '') {
            handleSave();
        }
    }, AUTO_SAVE_INTERVAL);
}

function toggleSidebar() {
    if (writingView && !writingView.classList.contains('hidden')) {
        chapterSidebar?.classList.toggle('hidden');
        return;
    }
    sidebar?.classList.toggle('hidden');
}

async function toggleWidthMode() {
    const modes: Array<'narrow' | 'medium' | 'wide'> = ['narrow', 'medium', 'wide'];
    const currentIndex = modes.indexOf(editorWidthMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    editorWidthMode = modes[nextIndex];

    editorContainer.classList.remove('width-narrow', 'width-medium', 'width-wide');
    editorContainer.classList.add(`width-${editorWidthMode}`);

    try {
        await SetEditorWidth(editorWidthMode);
    } catch (error) {
        console.error('保存宽度配置失败:', error);
    }
}

async function toggleTheme() {
    currentTheme = currentTheme === 'light' ? 'dark' : 'light';
    applyTheme(currentTheme);

    try {
        await SetTheme(currentTheme);
    } catch (error) {
        console.error('保存主题配置失败:', error);
    }
}

function applyTheme(theme: 'light' | 'dark') {
    document.documentElement.setAttribute('data-theme', theme);

    // 更新主题按钮图标
    if (themeToggleBtn) {
        const svg = themeToggleBtn.querySelector('svg');
        if (svg) {
            if (theme === 'dark') {
                svg.innerHTML = `
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                `;
            } else {
                svg.innerHTML = `
                    <circle cx="12" cy="12" r="5"/>
                    <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
                `;
            }
        }
    }
}

// 字体大小功能
function toggleFontSizePopup() {
    const rect = fontSizeBtn.getBoundingClientRect();
    fontSizePopup.style.top = `${rect.bottom + 4}px`;
    fontSizePopup.style.right = `${window.innerWidth - rect.right}px`;
    fontSizePopup.classList.toggle('hidden');

    // 更新选中状态
    fontSizePopup.querySelectorAll('.popup-item').forEach(item => {
        const size = item.getAttribute('data-size');
        item.classList.toggle('active', size === currentFontSize);
    });
}

function setFontSize(size: 'small' | 'medium' | 'large') {
    currentFontSize = size;
    editorContainer.classList.remove('font-small', 'font-medium', 'font-large');
    editorContainer.classList.add(`font-${size}`);
    fontSizePopup.classList.add('hidden');
}

// 点击外部关闭弹出菜单
document.addEventListener('click', (e) => {
    if (!fontSizeBtn.contains(e.target as Node) && !fontSizePopup.contains(e.target as Node)) {
        fontSizePopup.classList.add('hidden');
    }
    if (exportBtn && exportPopup && !exportBtn.contains(e.target as Node) && !exportPopup.contains(e.target as Node)) {
        exportPopup.classList.add('hidden');
    }
});

settingsPage?.addEventListener('click', (e) => {
    if (e.target === settingsPage) {
        closeSettings();
    }
});

// ============ 导出功能 ============

function toggleExportPopup() {
    const rect = exportBtn.getBoundingClientRect();
    exportPopup.style.top = `${rect.bottom + 4}px`;
    exportPopup.style.right = `${window.innerWidth - rect.right}px`;
    exportPopup.classList.toggle('hidden');
}

// ============ 设置页面 ============

function openSettings() {
    settingsPage.classList.remove('hidden');
}

function closeSettings() {
    settingsPage.classList.add('hidden');
}

async function handleExportTxt() {
    exportPopup.classList.add('hidden');
    const content = editor.getContent();
    if (!content.trim()) {
        await showConfirmModal('提示', '没有内容可导出');
        return;
    }

    try {
        const path = await ExportAsTxt(content);
        if (path) {
            await showConfirmModal('导出成功', `文件已保存到：${path}`);
        }
    } catch (error) {
        console.error('导出失败:', error);
        alert('导出失败: ' + error);
    }
}

async function handleExportImage() {
    exportPopup.classList.add('hidden');
    const content = editor.getContent();
    if (!content.trim()) {
        await showConfirmModal('提示', '没有内容可导出');
        return;
    }

    try {
        // 显示导出预览模态框
        const result = await showExportPreview(content);
        if (!result.confirmed || !result.options) return;

        const { width, theme } = result.options;
        const widthValue = getExportWidthValue(width);
        const widthName = getExportWidthName(width);
        const themeStyle = getExportThemeStyle(theme);

        // 生成文件名：{标题}_{datetime}_{宽度}_文本导出.png
        const now = new Date();
        const datetime = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
        const firstLine = content.split('\n')[0].trim() || '未命名';
        const safeTitle = firstLine.replace(/[/\\:*?"<>|]/g, '_').substring(0, 30);
        const defaultFileName = `${safeTitle}_${datetime}_${widthName}_文本导出.png`;

        // 弹出保存对话框（使用生成的文件名）
        const savePath = await ExportAsImagePathWithName(defaultFileName);
        if (!savePath) return;

        // 根据保存路径修改文件名（如果用户没改的话）
        const finalPath = savePath.endsWith('.png') ? savePath : savePath + '.png';

        // 创建临时渲染容器
        const renderContainer = document.createElement('div');
        renderContainer.className = 'export-render-container';
        renderContainer.style.cssText = `
            position: fixed;
            left: -9999px;
            top: 0;
            width: ${widthValue}px;
            padding: 40px 30px;
            background: ${themeStyle.bg};
            font-family: 'Crimson Pro', 'Noto Serif SC', serif;
            font-size: 16px;
            line-height: 2;
            color: ${themeStyle.text};
        `;

        // 渲染内容（过滤空行）
        const lines = content.split('\n').filter(line => line.trim() !== '');
        lines.forEach((line, index) => {
            const p = document.createElement('p');
            if (index === 0) {
                // 标题样式
                p.style.cssText = `
                    margin: 0 0 1.2em 0;
                    text-indent: 0;
                    font-size: 1.5em;
                    font-weight: 600;
                    line-height: 1.4;
                `;
            } else {
                // 正文样式
                p.style.cssText = `
                    margin: 0 0 0.8em 0;
                    text-indent: 2em;
                `;
            }
            p.textContent = line;
            renderContainer.appendChild(p);
        });

        // 添加水印
        renderContainer.appendChild(createExportWatermark(themeStyle.text));

        document.body.appendChild(renderContainer);

        // 使用 html2canvas
        const { default: html2canvas } = await import('html2canvas');
        const canvas = await html2canvas(renderContainer, {
            scale: 2,
            useCORS: true,
            backgroundColor: themeStyle.bg
        });

        document.body.removeChild(renderContainer);

        // 转换为 blob 并保存
        canvas.toBlob(async (blob) => {
            if (!blob) {
                alert('生成图片失败');
                return;
            }

            // 转换为 base64
            const reader = new FileReader();
            reader.onloadend = async () => {
                const base64 = (reader.result as string).split(',')[1];
                try {
                    await SaveImageData(finalPath, base64);
                    await showConfirmModal('导出成功', `图片已保存到：${finalPath}`);
                } catch (error) {
                    console.error('保存图片失败:', error);
                    alert('保存图片失败: ' + error);
                }
            };
            reader.readAsDataURL(blob);
        }, 'image/png');

    } catch (error) {
        console.error('导出图片失败:', error);
        alert('导出图片失败: ' + error);
    }
}

// ============ 事件监听 ============

saveBtn.addEventListener('click', handleSave);
toggleSidebarBtn.addEventListener('click', toggleSidebar);
if (libraryHomeBtn) libraryHomeBtn.addEventListener('click', () => selectRecent());
widthModeBtn.addEventListener('click', toggleWidthMode);
if (themeToggleBtn) themeToggleBtn.addEventListener('click', toggleTheme);
if (fontSizeBtn) fontSizeBtn.addEventListener('click', toggleFontSizePopup);
if (exportBtn) exportBtn.addEventListener('click', toggleExportPopup);
if (importBtn) importBtn.addEventListener('click', handleImportNovel);
if (settingsBtn) settingsBtn.addEventListener('click', openSettings);
if (settingsCloseBtn) settingsCloseBtn.addEventListener('click', closeSettings);
if (newNovelBtn) newNovelBtn.addEventListener('click', handleCreateNovel);
if (newChapterBtn) newChapterBtn.addEventListener('click', handleCreateChapter);
if (novelSaveBtn) novelSaveBtn.addEventListener('click', handleSaveNovel);
if (novelDeleteBtn) novelDeleteBtn.addEventListener('click', handleDeleteNovel);
if (chapterDeleteBtn) chapterDeleteBtn.addEventListener('click', handleDeleteChapter);
if (chapterMoveUpBtn) chapterMoveUpBtn.addEventListener('click', () => handleMoveChapter('up'));
if (chapterMoveDownBtn) chapterMoveDownBtn.addEventListener('click', () => handleMoveChapter('down'));
if (chapterTitleInput) {
    chapterTitleInput.addEventListener('input', () => {
        updateFileTitle();
        updateSaveStatus(false);
        if (chapterInfoTitle) {
            chapterInfoTitle.textContent = chapterTitleInput.value.trim() || '未命名章节';
        }
    });
}
if (chapterOutlineInput) {
    chapterOutlineInput.addEventListener('input', () => {
        updateSaveStatus(false);
    });
}
if (novelTitleInput) {
    novelTitleInput.addEventListener('input', () => {
        novelDirty = true;
        updateNovelSaveState();
        if (novelInfoTitle) {
            novelInfoTitle.textContent = novelTitleInput.value.trim() || '未命名小说';
        }
    });
}
if (novelSummaryInput) {
    novelSummaryInput.addEventListener('input', () => {
        novelDirty = true;
        updateNovelSaveState();
    });
}

// 导出选项
exportPopup?.querySelectorAll('.popup-item').forEach(item => {
    item.addEventListener('click', () => {
        const exportType = item.getAttribute('data-export');
        if (exportType === 'txt') handleExportTxt();
        else if (exportType === 'image') handleExportImage();
    });
});

// 窗口控制按钮
const minimizeBtn = document.getElementById('minimize-btn');
const maximizeBtn = document.getElementById('maximize-btn');
const closeBtn = document.getElementById('close-btn');

if (minimizeBtn) minimizeBtn.addEventListener('click', () => WindowMinimize());
if (maximizeBtn) maximizeBtn.addEventListener('click', () => WindowMaximize());
if (closeBtn) closeBtn.addEventListener('click', () => WindowClose());

// 字体大小选项
fontSizePopup?.querySelectorAll('.popup-item').forEach(item => {
    item.addEventListener('click', () => {
        const size = item.getAttribute('data-size') as 'small' | 'medium' | 'large';
        if (size) setFontSize(size);
    });
});

// ============ 初始化 ============
async function init() {
    editor = createEditor({
        container: editorContainer,
        onSave: handleSave,
        onChange: (_content) => {
            updateWordCount();
            updateSaveStatus(false);
            updateFileTitle();
        },
        onCursorMove: () => {}
    });

    setChapterHeaderEnabled(false, '请选择章节');
    setNovelFields(null);
    await loadNovels();
    if (novelInfoTitle) novelInfoTitle.textContent = '-';
    renderLibraryList();
    updateFileTitle();
    showLibraryView();

    try {
        const config = await GetConfig();
        if (config) {
            currentTheme = (config.theme as 'light' | 'dark') || 'light';
            applyTheme(currentTheme);

            editorWidthMode = (config.editor_width as 'narrow' | 'medium' | 'wide') || 'medium';
            editorContainer.classList.add(`width-${editorWidthMode}`);
        }
    } catch (error) {
        console.error('加载配置失败:', error);
        applyTheme('light');
        editorContainer.classList.add('width-medium');
    }

    // 默认字体大小
    editorContainer.classList.add('font-medium');

    startAutoSave();

    // 初始化版本信息和检查更新
    initVersionInfo();

    console.log('iNovel已启动');
}

// ============ 版本和更新 ============

let releaseUrl = 'https://github.com/lanbinleo/iNovel';

async function initVersionInfo() {
    try {
        // 获取当前版本
        const version = await GetVersion();
        if (versionText) {
            versionText.textContent = `v${version}`;
        }

        // 设置 GitHub 链接点击事件
        if (versionLink) {
            versionLink.addEventListener('click', (e) => {
                e.preventDefault();
                OpenURL(releaseUrl);
            });
        }

        // 检查更新
        const updateInfo = await CheckUpdate();
        if (updateInfo && updateInfo.has_update) {
            if (updateBadge) {
                updateBadge.classList.remove('hidden');
            }
            if (updateInfo.release_url) {
                releaseUrl = updateInfo.release_url;
            }
            if (versionLink) {
                versionLink.title = `新版本可用: ${updateInfo.latest_version}`;
            }
        }
    } catch (error) {
        console.error('版本检查失败:', error);
    }
}

init();
