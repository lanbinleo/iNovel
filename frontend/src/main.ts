import './style.css';

// 导入Wails运行时
import { GetConfig, SetTheme, SetAppearance, SetEditorWidth, SetEditorWidthValues, SetEditorFont, SetFontSize, SetFontSizeValues, WindowMinimize, WindowMaximize, WindowClose, ExportAsTxt, ExportAsImagePathWithName, SaveImageData, GetVersion, CheckUpdate, OpenURL, ListNovels, ListRecentChapters, CreateNovel, UpdateNovel, DeleteNovel, ListChapters, CreateChapter, DeleteChapter, MoveChapter, GetChapterContent, SaveChapterContent, ImportNovelFromDialog } from '../wailsjs/go/main/App';

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
    updated_at: string;
}

interface RecentChapterSummary {
    novel_id: string;
    novel_title: string;
    chapter_id: string;
    chapter_title: string;
    outline: string;
    updated_at: string;
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
const AUTO_SAVE_INTERVAL = 5000;
const DRAFT_PREFIX = 'inovel:draft:';
type ThemeFamily = 'notion' | 'warm' | 'paper' | 'ink';
type ThemeMode = 'light' | 'dark';
type ThemeName = `${ThemeFamily}-${ThemeMode}`;
type FontSizeMode = 'small' | 'medium' | 'large';
type EditorFontMode = 'serif' | 'sans';

let editorWidthMode: 'narrow' | 'medium' | 'wide' = 'medium';
let editorWidthValues: Record<'narrow' | 'medium' | 'wide', number> = {
    narrow: 580,
    medium: 720,
    wide: 980
};
let editorFontMode: EditorFontMode = 'serif';
let currentThemeFamily: ThemeFamily = 'notion';
let currentThemeMode: ThemeMode = 'dark';
let currentTheme: ThemeName = 'notion-dark';
let currentFontSize: FontSizeMode = 'medium';
let fontSizeValues: Record<FontSizeMode, number> = {
    small: 16,
    medium: 18,
    large: 20
};
let currentNovelId: string | null = null;
let currentChapterId: string | null = null;
let currentLibraryCategory: 'recent' | 'novel' = 'recent';
let novels: NovelSummary[] = [];
let chapters: ChapterSummary[] = [];
let recentChapters: RecentChapterSummary[] = [];
let editor: Editor;
let novelDirty = false;
let saveInFlight: Promise<boolean> | null = null;
let draggingChapterId: string | null = null;

// ============ DOM 元素 ============
const appRoot = document.getElementById('app') as HTMLDivElement;
const editorContainer = document.getElementById('editor') as HTMLDivElement;
const fileTitle = document.getElementById('file-title') as HTMLSpanElement;
const saveStatus = document.getElementById('save-status') as HTMLSpanElement;
const wordCount = document.getElementById('word-count') as HTMLSpanElement;
const saveBtn = document.getElementById('save-btn') as HTMLButtonElement;
const toggleSidebarBtn = document.getElementById('toggle-sidebar-btn') as HTMLButtonElement;
const libraryHomeBtn = document.getElementById('library-home-btn') as HTMLButtonElement;
const bookDetailBtn = document.getElementById('book-detail-btn') as HTMLButtonElement;
const widthModeBtn = document.getElementById('width-mode-btn') as HTMLButtonElement;
const themeToggleBtn = document.getElementById('theme-toggle-btn') as HTMLButtonElement;
const fontSizeBtn = document.getElementById('font-size-btn') as HTMLButtonElement;
const fontSizePopup = document.getElementById('font-size-popup') as HTMLDivElement;
const sidebar = document.getElementById('sidebar') as HTMLDivElement;
const exportBtn = document.getElementById('export-btn') as HTMLButtonElement;
const exportPopup = document.getElementById('export-popup') as HTMLDivElement;
const versionText = document.getElementById('version-text') as HTMLSpanElement;
const versionLink = document.getElementById('version-link') as HTMLAnchorElement;
const updateBadge = document.getElementById('update-badge') as HTMLSpanElement;
const settingsBtn = document.getElementById('settings-btn') as HTMLButtonElement;
const settingsPage = document.getElementById('settings-page') as HTMLDivElement;
const settingsCloseBtn = document.getElementById('settings-close-btn') as HTMLButtonElement;
const settingsNavItems = document.querySelectorAll<HTMLButtonElement>('.settings-nav-item');
const settingsPanels = document.querySelectorAll<HTMLElement>('[data-settings-panel]');
const themeFamilyButtons = document.querySelectorAll<HTMLButtonElement>('[data-theme-family]');
const themeModeButtons = document.querySelectorAll<HTMLButtonElement>('[data-theme-mode]');
const widthModeButtons = document.querySelectorAll<HTMLButtonElement>('[data-width-mode]');
const editorFontButtons = document.querySelectorAll<HTMLButtonElement>('[data-editor-font]');
const widthNarrowInput = document.getElementById('width-narrow-input') as HTMLInputElement;
const widthMediumInput = document.getElementById('width-medium-input') as HTMLInputElement;
const widthWideInput = document.getElementById('width-wide-input') as HTMLInputElement;
const fontSizeSmallInput = document.getElementById('font-size-small-input') as HTMLInputElement;
const fontSizeMediumInput = document.getElementById('font-size-medium-input') as HTMLInputElement;
const fontSizeLargeInput = document.getElementById('font-size-large-input') as HTMLInputElement;
const libraryShell = document.getElementById('library-shell') as HTMLDivElement;
const writingView = document.getElementById('writing-view') as HTMLDivElement;
const detailView = document.getElementById('detail-view') as HTMLDivElement;
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
const detailChapterNovel = document.getElementById('detail-chapter-novel') as HTMLSpanElement;
const detailChapterCount = document.getElementById('detail-chapter-count') as HTMLSpanElement;
const novelInfoTitle = document.getElementById('novel-info-title') as HTMLSpanElement;
const importBtn = document.getElementById('import-btn') as HTMLButtonElement;
const novelTitleInput = document.getElementById('novel-title-input') as HTMLInputElement;
const novelSummaryInput = document.getElementById('novel-summary-input') as HTMLTextAreaElement;
const novelSaveBtn = document.getElementById('novel-save-btn') as HTMLButtonElement;
const novelDeleteBtn = document.getElementById('novel-delete-btn') as HTMLButtonElement;
const chapterDeleteBtn = document.getElementById('chapter-delete-btn') as HTMLButtonElement;
const chapterMoveUpBtn = document.getElementById('chapter-move-up-btn') as HTMLButtonElement;
const chapterMoveDownBtn = document.getElementById('chapter-move-down-btn') as HTMLButtonElement;
const detailChapterList = document.getElementById('detail-chapter-list') as HTMLDivElement;
const contextMenu = document.getElementById('context-menu') as HTMLDivElement;

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

function updateSavingStatus() {
    saveStatus.textContent = '●';
    saveStatus.className = 'save-status saving';
    saveStatus.title = '保存中';
}

function getDraftKey(chapterId: string): string {
    return `${DRAFT_PREFIX}${chapterId}`;
}

function writeLocalDraft() {
    if (!currentChapterId) return;
    try {
        localStorage.setItem(getDraftKey(currentChapterId), JSON.stringify({
            title: chapterTitleInput.value,
            outline: chapterOutlineInput ? chapterOutlineInput.value : '',
            content: editor.getContent(),
            saved_at: new Date().toISOString()
        }));
    } catch (error) {
        console.error('写入本地草稿失败:', error);
    }
}

function readLocalDraft(chapterId: string): { title: string; outline: string; content: string; saved_at: string } | null {
    try {
        const raw = localStorage.getItem(getDraftKey(chapterId));
        return raw ? JSON.parse(raw) : null;
    } catch (error) {
        console.error('读取本地草稿失败:', error);
        return null;
    }
}

function clearLocalDraft(chapterId: string) {
    try {
        localStorage.removeItem(getDraftKey(chapterId));
    } catch (error) {
        console.error('清理本地草稿失败:', error);
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
    appRoot?.classList.remove('is-writing', 'is-detail');
    libraryShell?.classList.remove('hidden');
    writingView?.classList.add('hidden');
    detailView?.classList.add('hidden');
    libraryHomeBtn?.classList.add('hidden');
    bookDetailBtn?.classList.add('hidden');
    setBookDetailButtonMode('detail');
}

function showEditorView() {
    appRoot?.classList.add('is-writing');
    appRoot?.classList.remove('is-detail');
    libraryShell?.classList.add('hidden');
    writingView?.classList.remove('hidden');
    detailView?.classList.add('hidden');
    editorView?.classList.remove('hidden');
    libraryHomeBtn?.classList.remove('hidden');
    bookDetailBtn?.classList.remove('hidden');
    setBookDetailButtonMode('detail');
    editor.focus();
}

function showDetailView() {
    if (!currentNovelId) return;
    appRoot?.classList.add('is-detail');
    appRoot?.classList.remove('is-writing');
    refreshDetailView();
    libraryShell?.classList.add('hidden');
    writingView?.classList.add('hidden');
    detailView?.classList.remove('hidden');
    libraryHomeBtn?.classList.remove('hidden');
    bookDetailBtn?.classList.remove('hidden');
    setBookDetailButtonMode('back');
}

function setBookDetailButtonMode(mode: 'detail' | 'back') {
    if (!bookDetailBtn) return;
    if (mode === 'back') {
        bookDetailBtn.title = '返回写作';
        bookDetailBtn.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M19 12H5"/>
                <path d="M12 5l-7 7 7 7"/>
            </svg>
        `;
        return;
    }
    bookDetailBtn.title = '书籍详情';
    bookDetailBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="12" r="9"/>
            <path d="M12 10v6"/>
            <path d="M12 7h.01"/>
        </svg>
    `;
}

function refreshDetailView() {
    const novel = novels.find(n => n.id === currentNovelId);
    if (novelInfoTitle) {
        novelInfoTitle.textContent = novel?.title || '未命名小说';
    }
    if (detailChapterNovel) {
        detailChapterNovel.textContent = novel?.title || '未命名小说';
    }
    if (detailChapterCount) {
        detailChapterCount.textContent = `${chapters.length}`;
    }

    const chapter = chapters.find(c => c.id === currentChapterId);
    if (chapterInfoTitle) {
        chapterInfoTitle.textContent = chapterTitleInput.value.trim() || chapter?.title || '未选择章节';
    }
    if (chapterOutlineInput && currentChapterId && !chapterOutlineInput.value && chapter?.outline) {
        chapterOutlineInput.value = chapter.outline;
    }
    renderDetailChapterList();
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
        item.addEventListener('contextmenu', (event) => showNovelContextMenu(event, novel.id));

        novelList.appendChild(item);
    }
}

function renderLibraryList() {
    if (!libraryList) return;

    if (currentLibraryCategory === 'novel' && currentNovelId) {
        renderNovelChapterLibraryList();
        return;
    }

    if (libraryTitle) libraryTitle.textContent = 'Recent';
    if (librarySubtitle) librarySubtitle.textContent = recentChapters.length > 0 ? '最近更新的章节' : '还没有更新记录';

    libraryList.innerHTML = '';
    if (recentChapters.length === 0) {
        libraryList.innerHTML = '<div class="library-empty">还没有最近更新的章节。可以从左侧新建，或从工具栏导入。</div>';
        return;
    }

    for (const recent of recentChapters) {
        const item = document.createElement('button');
        item.className = 'library-list-item recent-novel-item';
        item.type = 'button';

        const title = document.createElement('div');
        title.className = 'library-list-title';
        title.textContent = recent.chapter_title || '未命名章节';

        const summary = document.createElement('div');
        summary.className = 'library-list-sub';
        summary.textContent = `${recent.novel_title || '未命名小说'} · ${recent.outline || '暂无梗概'}`;

        const meta = document.createElement('div');
        meta.className = 'library-list-meta';
        meta.textContent = recent.updated_at ? `更新于 ${formatDateTime(recent.updated_at)}` : '最近更新';

        item.appendChild(title);
        item.appendChild(summary);
        item.appendChild(meta);
        item.addEventListener('click', () => openRecentChapter(recent));
        item.addEventListener('contextmenu', (event) => showRecentChapterContextMenu(event, recent));
        libraryList.appendChild(item);
    }
}

function renderNovelChapterLibraryList() {
    if (!libraryList || !currentNovelId) return;
    const novel = novels.find(n => n.id === currentNovelId);
    if (libraryTitle) libraryTitle.textContent = novel?.title || '未命名小说';
    if (librarySubtitle) librarySubtitle.textContent = chapters.length > 0 ? `${chapters.length} 个章节` : '还没有章节';

    libraryList.innerHTML = '';
    if (chapters.length === 0) {
        libraryList.innerHTML = '<div class="library-empty">还没有章节。可以从左侧新建章节。</div>';
        return;
    }

    chapters.forEach((chapter, index) => {
        const item = document.createElement('button');
        item.className = 'library-list-item';
        item.type = 'button';

        const title = document.createElement('div');
        title.className = 'library-list-title';
        title.textContent = chapter.title || `第 ${index + 1} 章`;

        const summary = document.createElement('div');
        summary.className = 'library-list-sub';
        summary.textContent = chapter.outline || '暂无梗概';

        const meta = document.createElement('div');
        meta.className = 'library-list-meta';
        meta.textContent = chapter.updated_at ? `更新于 ${formatDateTime(chapter.updated_at)}` : '最近更新';

        item.appendChild(title);
        item.appendChild(summary);
        item.appendChild(meta);
        item.addEventListener('click', () => selectChapter(chapter.id));
        item.addEventListener('contextmenu', (event) => showChapterContextMenu(event, chapter.id));
        libraryList.appendChild(item);
    });
}

function renderChapterList() {
    if (!chapterList) return;
    chapterList.innerHTML = '';

    if (!currentNovelId) {
        chapterList.innerHTML = '<div class="sidebar-list-empty">请选择小说</div>';
        if (newChapterBtn) newChapterBtn.disabled = true;
        renderDetailChapterList();
        return;
    }

    if (newChapterBtn) newChapterBtn.disabled = false;

    if (chapters.length === 0) {
        chapterList.innerHTML = '<div class="sidebar-list-empty">暂无章节</div>';
        renderDetailChapterList();
        return;
    }

    chapters.forEach((chapter, index) => {
        const item = document.createElement('div');
        item.className = 'sidebar-list-item';
        item.draggable = true;
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
        item.addEventListener('contextmenu', (event) => showChapterContextMenu(event, chapter.id));
        addChapterDragEvents(item, chapter.id, index);

        chapterList.appendChild(item);
    });

    updateChapterMoveState();
    renderDetailChapterList();
}

function renderDetailChapterList() {
    if (!detailChapterList) return;
    detailChapterList.innerHTML = '';

    if (!currentNovelId) {
        detailChapterList.innerHTML = '<div class="sidebar-list-empty">请选择小说</div>';
        return;
    }

    if (chapters.length === 0) {
        detailChapterList.innerHTML = '<div class="sidebar-list-empty">暂无章节</div>';
        return;
    }

    chapters.forEach((chapter, index) => {
        const item = document.createElement('div');
        item.className = 'detail-chapter-item';
        item.draggable = true;
        if (currentChapterId === chapter.id) item.classList.add('selected');

        const number = document.createElement('div');
        number.className = 'detail-chapter-index';
        number.textContent = String(index + 1).padStart(2, '0');

        const main = document.createElement('div');
        main.className = 'detail-chapter-main';

        const title = document.createElement('div');
        title.className = 'detail-chapter-title';
        title.textContent = chapter.title || `第 ${index + 1} 章`;

        const outline = document.createElement('div');
        outline.className = 'detail-chapter-outline';
        outline.textContent = chapter.outline || '暂无梗概';

        const action = document.createElement('button');
        action.className = 'icon-btn detail-chapter-action';
        action.type = 'button';
        action.title = '进入编辑';
        action.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
        action.addEventListener('click', (event) => {
            event.stopPropagation();
            selectChapter(chapter.id);
        });

        main.appendChild(title);
        main.appendChild(outline);
        item.appendChild(number);
        item.appendChild(main);
        item.appendChild(action);
        item.addEventListener('click', () => selectChapter(chapter.id));
        item.addEventListener('contextmenu', (event) => showChapterContextMenu(event, chapter.id));
        addChapterDragEvents(item, chapter.id, index);
        detailChapterList.appendChild(item);
    });
}

function addChapterDragEvents(item: HTMLElement, chapterId: string, targetIndex: number) {
    item.addEventListener('dragstart', (event) => {
        draggingChapterId = chapterId;
        item.classList.add('dragging');
        event.dataTransfer?.setData('text/plain', chapterId);
        if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = 'move';
        }
    });
    item.addEventListener('dragend', () => {
        draggingChapterId = null;
        item.classList.remove('dragging');
    });
    item.addEventListener('dragover', (event) => {
        if (!draggingChapterId || draggingChapterId === chapterId) return;
        event.preventDefault();
        if (event.dataTransfer) {
            event.dataTransfer.dropEffect = 'move';
        }
    });
    item.addEventListener('drop', async (event) => {
        event.preventDefault();
        const sourceId = draggingChapterId || event.dataTransfer?.getData('text/plain');
        if (!sourceId || sourceId === chapterId) return;
        await moveChapterToIndex(sourceId, targetIndex);
    });
}

async function moveChapterToIndex(chapterId: string, targetIndex: number) {
    if (!currentNovelId) return;
    const sourceIndex = chapters.findIndex(chapter => chapter.id === chapterId);
    if (sourceIndex < 0 || sourceIndex === targetIndex) return;

    const direction = sourceIndex < targetIndex ? 'down' : 'up';
    const steps = Math.abs(targetIndex - sourceIndex);
    try {
        for (let i = 0; i < steps; i += 1) {
            const moved = await MoveChapter(chapterId, direction);
            if (!moved) break;
        }
        currentChapterId = chapterId;
        await loadChapters(currentNovelId);
        renderChapterList();
        renderDetailChapterList();
    } catch (error) {
        console.error('移动章节失败:', error);
        alert('移动章节失败: ' + error);
    }
}

function formatDateTime(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

async function confirmDiscardIfDirty(): Promise<boolean> {
    if (!isDirty && !novelDirty) return true;

    if (isDirty) {
        const saved = await saveCurrentChapter({ silent: true });
        if (!saved) {
            await showConfirmModal('保存失败', '当前章节还没有保存成功，请先手动保存。');
            return false;
        }
    }

    if (novelDirty) {
        const saved = await handleSaveNovel();
        if (!saved) {
            await showConfirmModal('保存失败', '作品信息还没有保存成功，请先手动保存。');
            return false;
        }
    }

    return true;
}

async function loadNovels() {
    try {
        const list = await ListNovels();
        novels = (list || []) as NovelSummary[];
        renderNovelList();
    } catch (error) {
        console.error('加载小说列表失败:', error);
    }
}

async function loadRecentChapters() {
    try {
        const list = await ListRecentChapters();
        recentChapters = (list || []) as RecentChapterSummary[];
        if (currentLibraryCategory === 'recent') {
            renderLibraryList();
        }
    } catch (error) {
        console.error('加载最近章节失败:', error);
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

async function openRecentChapter(recent: RecentChapterSummary) {
    if (currentChapterId !== recent.chapter_id) {
        const ok = await confirmDiscardIfDirty();
        if (!ok) return;
    }

    currentLibraryCategory = 'novel';
    currentNovelId = recent.novel_id;
    currentChapterId = null;
    await loadChapters(recent.novel_id);

    const novel = novels.find(n => n.id === recent.novel_id);
    if (novelInfoTitle) {
        novelInfoTitle.textContent = novel?.title || recent.novel_title || '-';
    }
    setNovelFields(novel || {
        id: recent.novel_id,
        title: recent.novel_title || '未命名小说',
        summary: '',
        updated_at: recent.updated_at || ''
    });

    renderNovelList();
    renderChapterList();
    await selectChapter(recent.chapter_id);
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
    renderChapterList();
    await loadRecentChapters();
    renderLibraryList();
    showLibraryView();
}

async function selectNovel(novelId: string) {
    if (currentNovelId !== novelId || isDirty || novelDirty) {
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
    renderLibraryList();
    editor.clear();
    updateWordCount();
    updateSaveStatus(true);
    setChapterHeaderEnabled(false, chapters.length > 0 ? '请选择章节' : '暂无章节');
    updateFileTitle();
    showLibraryView();
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
        const draft = readLocalDraft(chapterId);
        const draftApplied = !!draft && (draft.content !== (chapter.content || '') || draft.title !== (chapter.title || '') || draft.outline !== (chapter.outline || ''));
        if (draftApplied && draft) {
            chapterTitleInput.value = draft.title || chapterTitleInput.value;
            if (chapterOutlineInput) {
                chapterOutlineInput.value = draft.outline || '';
            }
            editor.setContent(draft.content || '');
            updateSaveStatus(false);
        }
        updateWordCount();
        if (!draftApplied) {
            updateSaveStatus(true);
        }
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
        return false;
    }
    const title = novelTitleInput ? novelTitleInput.value.trim() : '';
    const summary = novelSummaryInput ? novelSummaryInput.value.trim() : '';
    try {
        await UpdateNovel(currentNovelId, title || '未命名小说', summary);
        novelDirty = false;
        updateNovelSaveState();
        await loadNovels();
        await loadRecentChapters();
        if (novelInfoTitle) {
            novelInfoTitle.textContent = title || '未命名小说';
        }
        return true;
    } catch (error) {
        console.error('保存小说失败:', error);
        alert('保存小说失败: ' + error);
        return false;
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

async function saveCurrentChapter(options: { silent?: boolean } = {}): Promise<boolean> {
    if (saveInFlight) return saveInFlight;

    const content = editor.getContent();
    saveInFlight = (async () => {
        try {
            if (currentChapterId) {
                updateSavingStatus();
                const title = chapterTitleInput.value.trim() || '未命名章节';
                const outline = chapterOutlineInput ? chapterOutlineInput.value.trim() : '';
                await SaveChapterContent(currentChapterId, title, outline, content);
                clearLocalDraft(currentChapterId);
                if (currentNovelId) {
                    await loadChapters(currentNovelId);
                    await loadRecentChapters();
                    renderChapterList();
                }
                updateFileTitle();
                updateSaveStatus(true);
                refreshDetailView();
                return true;
            }
            if (!options.silent) {
                await showConfirmModal('提示', '请先选择章节');
            }
            return false;
        } catch (error) {
            console.error('保存失败:', error);
            if (!options.silent) {
                alert('保存失败: ' + error);
            }
            updateSaveStatus(false);
            return false;
        } finally {
            saveInFlight = null;
        }
    })();

    return saveInFlight;
}

async function handleSave() {
    await saveCurrentChapter();
}

function startAutoSave() {
    if (autoSaveTimer) clearInterval(autoSaveTimer);

    autoSaveTimer = window.setInterval(() => {
        if (isDirty && currentChapterId && editor.getPlainText().trim() !== '') {
            void saveCurrentChapter({ silent: true });
        }
    }, AUTO_SAVE_INTERVAL);
}

function toggleSidebar() {
    if (writingView && !writingView.classList.contains('hidden')) {
        chapterSidebar?.classList.toggle('hidden');
        return;
    }
    if (detailView && !detailView.classList.contains('hidden')) {
        return;
    }
    sidebar?.classList.toggle('hidden');
}

async function handleBookDetailClick() {
    if (detailView && !detailView.classList.contains('hidden')) {
        if (currentChapterId) {
            showEditorView();
        } else {
            await selectRecent();
        }
        return;
    }

    if (isDirty) {
        const saved = await saveCurrentChapter({ silent: true });
        if (!saved) {
            await showConfirmModal('保存失败', '当前章节还没有保存成功，请先手动保存。');
            return;
        }
    }
    showDetailView();
}

async function toggleWidthMode() {
    const modes: Array<'narrow' | 'medium' | 'wide'> = ['narrow', 'medium', 'wide'];
    const currentIndex = modes.indexOf(editorWidthMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    await setEditorWidthMode(modes[nextIndex]);
}

async function setEditorWidthMode(width: 'narrow' | 'medium' | 'wide', persist = true) {
    editorWidthMode = width;
    applyEditorWidthMode();
    if (!persist) return;
    try {
        await SetEditorWidth(editorWidthMode);
    } catch (error) {
        console.error('保存宽度配置失败:', error);
    }
}

function applyEditorWidthMode() {
    editorContainer.classList.remove('width-narrow', 'width-medium', 'width-wide');
    editorContainer.classList.add(`width-${editorWidthMode}`);
    widthModeButtons.forEach(button => {
        button.classList.toggle('active', button.getAttribute('data-width-mode') === editorWidthMode);
    });
}

function applyEditorWidthValues() {
    document.documentElement.style.setProperty('--editor-width-narrow', `${editorWidthValues.narrow}px`);
    document.documentElement.style.setProperty('--editor-width-medium', `${editorWidthValues.medium}px`);
    document.documentElement.style.setProperty('--editor-width-wide', `${editorWidthValues.wide}px`);
    if (widthNarrowInput) widthNarrowInput.value = String(editorWidthValues.narrow);
    if (widthMediumInput) widthMediumInput.value = String(editorWidthValues.medium);
    if (widthWideInput) widthWideInput.value = String(editorWidthValues.wide);
}

async function saveEditorWidthValuesFromSettings() {
    editorWidthValues = {
        narrow: readNumberInput(widthNarrowInput, editorWidthValues.narrow, 420, 900),
        medium: readNumberInput(widthMediumInput, editorWidthValues.medium, 520, 1100),
        wide: readNumberInput(widthWideInput, editorWidthValues.wide, 620, 1400)
    };
    applyEditorWidthValues();
    try {
        await SetEditorWidthValues(editorWidthValues.narrow, editorWidthValues.medium, editorWidthValues.wide);
    } catch (error) {
        console.error('保存宽度档位失败:', error);
    }
}

function applyEditorFont() {
    editorContainer.classList.remove('font-serif', 'font-sans');
    editorContainer.classList.add(`font-${editorFontMode}`);
    editorFontButtons.forEach(button => {
        button.classList.toggle('active', button.getAttribute('data-editor-font') === editorFontMode);
    });
}

async function setEditorFontMode(font: EditorFontMode) {
    editorFontMode = font;
    applyEditorFont();
    try {
        await SetEditorFont(font);
    } catch (error) {
        console.error('保存正文字体失败:', error);
    }
}

async function toggleTheme() {
    const nextMode: ThemeMode = currentThemeMode === 'light' ? 'dark' : 'light';
    applyTheme(currentThemeFamily, nextMode);
    try {
        await SetTheme(currentTheme);
    } catch (error) {
        console.error('保存主题配置失败:', error);
    }
}

function normalizeTheme(family: string | undefined, mode: string | undefined, theme: string | undefined): { family: ThemeFamily; mode: ThemeMode } {
    let nextFamily = family as ThemeFamily;
    let nextMode = mode as ThemeMode;

    if ((!nextFamily || !nextMode) && theme) {
        if (theme === 'light' || theme === 'dark') {
            nextFamily = 'notion';
            nextMode = theme;
        } else {
            const parts = theme.split('-');
            const maybeMode = parts[parts.length - 1] as ThemeMode;
            const maybeFamily = parts.slice(0, -1).join('-') as ThemeFamily;
            if (maybeFamily && (maybeMode === 'light' || maybeMode === 'dark')) {
                nextFamily = maybeFamily;
                nextMode = maybeMode;
            }
        }
    }

    if (!['notion', 'warm', 'paper', 'ink'].includes(nextFamily)) {
        nextFamily = 'notion';
    }
    if (nextMode !== 'light' && nextMode !== 'dark') {
        nextMode = 'dark';
    }

    return { family: nextFamily, mode: nextMode };
}

function applyTheme(family: ThemeFamily, mode: ThemeMode) {
    currentThemeFamily = family;
    currentThemeMode = mode;
    currentTheme = `${family}-${mode}`;
    document.documentElement.setAttribute('data-theme', currentTheme);
    document.documentElement.setAttribute('data-theme-family', family);
    document.documentElement.setAttribute('data-theme-mode', mode);

    // 更新主题按钮图标
    if (themeToggleBtn) {
        const svg = themeToggleBtn.querySelector('svg');
        if (svg) {
            if (mode === 'dark') {
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

    themeFamilyButtons.forEach(button => {
        button.classList.toggle('active', button.getAttribute('data-theme-family') === family);
    });
    themeModeButtons.forEach(button => {
        button.classList.toggle('active', button.getAttribute('data-theme-mode') === mode);
    });
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

async function setFontSize(size: FontSizeMode, persist = true) {
    currentFontSize = size;
    applyFontSize();
    fontSizePopup.classList.add('hidden');
    if (!persist) return;
    try {
        await SetFontSize(size);
    } catch (error) {
        console.error('保存字号配置失败:', error);
    }
}

function applyFontSize() {
    editorContainer.classList.remove('font-small', 'font-medium', 'font-large');
    editorContainer.classList.add(`font-${currentFontSize}`);
    fontSizePopup?.querySelectorAll('.popup-item').forEach(item => {
        item.classList.toggle('active', item.getAttribute('data-size') === currentFontSize);
    });
}

function applyFontSizeValues() {
    document.documentElement.style.setProperty('--editor-font-small', `${fontSizeValues.small}px`);
    document.documentElement.style.setProperty('--editor-font-medium', `${fontSizeValues.medium}px`);
    document.documentElement.style.setProperty('--editor-font-large', `${fontSizeValues.large}px`);
    if (fontSizeSmallInput) fontSizeSmallInput.value = String(fontSizeValues.small);
    if (fontSizeMediumInput) fontSizeMediumInput.value = String(fontSizeValues.medium);
    if (fontSizeLargeInput) fontSizeLargeInput.value = String(fontSizeValues.large);
    updateFontSizePopupLabels();
}

function updateFontSizePopupLabels() {
    fontSizePopup?.querySelectorAll<HTMLButtonElement>('.popup-item').forEach(item => {
        const size = item.getAttribute('data-size') as FontSizeMode;
        if (size && fontSizeValues[size]) {
            const label = size === 'small' ? '小' : size === 'medium' ? '中' : '大';
            item.textContent = `${label} ${fontSizeValues[size]}px`;
        }
    });
}

function readNumberInput(input: HTMLInputElement | null, fallback: number, min = 12, max = 36) {
    if (!input) return fallback;
    const value = Number(input.value);
    if (!Number.isFinite(value)) return fallback;
    return Math.min(max, Math.max(min, Math.round(value)));
}

async function saveFontSizeValuesFromSettings() {
    fontSizeValues = {
        small: readNumberInput(fontSizeSmallInput, fontSizeValues.small, 12, 30),
        medium: readNumberInput(fontSizeMediumInput, fontSizeValues.medium, 12, 32),
        large: readNumberInput(fontSizeLargeInput, fontSizeValues.large, 14, 36)
    };
    applyFontSizeValues();
    try {
        await SetFontSizeValues(fontSizeValues.small, fontSizeValues.medium, fontSizeValues.large);
    } catch (error) {
        console.error('保存字号档位失败:', error);
    }
}

// 点击外部关闭弹出菜单
document.addEventListener('click', (e) => {
    if (!fontSizeBtn.contains(e.target as Node) && !fontSizePopup.contains(e.target as Node)) {
        fontSizePopup.classList.add('hidden');
    }
    if (exportBtn && exportPopup && !exportBtn.contains(e.target as Node) && !exportPopup.contains(e.target as Node)) {
        exportPopup.classList.add('hidden');
    }
    hideContextMenu();
});

document.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    hideContextMenu();
});

window.addEventListener('beforeunload', () => {
    writeLocalDraft();
});

type ContextMenuItem = {
    label: string;
    disabled?: boolean;
    danger?: boolean;
    action: () => void | Promise<void>;
};

function showContextMenu(event: MouseEvent, items: ContextMenuItem[]) {
    if (!contextMenu) return;
    event.preventDefault();
    event.stopPropagation();
    contextMenu.innerHTML = '';

    for (const item of items) {
        const button = document.createElement('button');
        button.className = 'popup-item';
        if (item.danger) {
            button.classList.add('danger');
        }
        button.type = 'button';
        button.textContent = item.label;
        button.disabled = !!item.disabled;
        button.addEventListener('click', async () => {
            hideContextMenu();
            if (!item.disabled) {
                await item.action();
            }
        });
        contextMenu.appendChild(button);
    }

    contextMenu.classList.remove('hidden');
    const { innerWidth, innerHeight } = window;
    const rect = contextMenu.getBoundingClientRect();
    contextMenu.style.left = `${Math.min(event.clientX, innerWidth - rect.width - 8)}px`;
    contextMenu.style.top = `${Math.min(event.clientY, innerHeight - rect.height - 8)}px`;
}

function hideContextMenu() {
    contextMenu?.classList.add('hidden');
}

function showNovelContextMenu(event: MouseEvent, novelId: string) {
    showContextMenu(event, [
        { label: '书籍详情', action: () => openNovelDetail(novelId) },
        { label: '进入写作', action: () => openNovelForEditing(novelId) },
        { label: '新建章节', action: async () => { await selectNovel(novelId); await handleCreateChapter(); } },
        { label: '删除作品', danger: true, action: async () => { await selectNovel(novelId); await handleDeleteNovel(); } }
    ]);
}

function showRecentChapterContextMenu(event: MouseEvent, recent: RecentChapterSummary) {
    showContextMenu(event, [
        { label: '进入编辑', action: () => openRecentChapter(recent) },
        { label: '书籍详情', action: () => openNovelDetail(recent.novel_id) }
    ]);
}

function showChapterContextMenu(event: MouseEvent, chapterId: string) {
    const index = chapters.findIndex(chapter => chapter.id === chapterId);
    showContextMenu(event, [
        { label: '进入编辑', action: () => selectChapter(chapterId) },
        { label: '上移', disabled: index <= 0, action: () => runChapterAction(chapterId, () => handleMoveChapter('up')) },
        { label: '下移', disabled: index < 0 || index >= chapters.length - 1, action: () => runChapterAction(chapterId, () => handleMoveChapter('down')) },
        { label: '删除章节', danger: true, action: () => runChapterAction(chapterId, handleDeleteChapter) }
    ]);
}

function showChapterAreaContextMenu(event: MouseEvent) {
    if ((event.target as HTMLElement).closest('.sidebar-list-item, .detail-chapter-item')) return;
    showContextMenu(event, [
        { label: '新建章节', disabled: !currentNovelId, action: handleCreateChapter },
        { label: '书籍详情', disabled: !currentNovelId, action: () => { if (currentNovelId) showDetailView(); } }
    ]);
}

function showEditorContextMenu(event: MouseEvent) {
    showContextMenu(event, [
        { label: '复制', action: () => { document.execCommand('copy'); } },
        { label: '粘贴', action: pasteFromClipboard },
        { label: '粘贴为纯文本', action: pastePlainTextFromClipboard }
    ]);
}

async function runChapterAction(chapterId: string, action: () => Promise<unknown>) {
    if (currentChapterId !== chapterId) {
        const ok = await confirmDiscardIfDirty();
        if (!ok) return;
    }
    currentChapterId = chapterId;
    renderChapterList();
    renderDetailChapterList();
    await action();
}

async function openNovelForEditing(novelId: string) {
    if (currentNovelId !== novelId || isDirty || novelDirty) {
        const ok = await confirmDiscardIfDirty();
        if (!ok) return;
    }
    currentLibraryCategory = 'novel';
    currentNovelId = novelId;
    currentChapterId = null;
    await loadChapters(novelId);
    renderNovelList();
    if (chapters.length > 0) {
        await selectChapter(chapters[0].id);
    } else {
        showDetailView();
    }
}

async function openNovelDetail(novelId: string) {
    if (currentNovelId !== novelId || isDirty || novelDirty) {
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
    refreshDetailView();
    showDetailView();
}

async function pasteFromClipboard() {
    const ok = document.execCommand('paste');
    if (!ok) {
        await pastePlainTextFromClipboard();
    }
}

async function pastePlainTextFromClipboard() {
    try {
        const text = await navigator.clipboard.readText();
        if (text) {
            editor.focus();
            document.execCommand('insertText', false, text);
        }
    } catch (error) {
        console.error('读取剪贴板失败:', error);
    }
}

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
    syncSettingsControls();
}

function closeSettings() {
    settingsPage.classList.add('hidden');
}

function syncSettingsControls() {
    themeFamilyButtons.forEach(button => {
        button.classList.toggle('active', button.getAttribute('data-theme-family') === currentThemeFamily);
    });
    themeModeButtons.forEach(button => {
        button.classList.toggle('active', button.getAttribute('data-theme-mode') === currentThemeMode);
    });
    widthModeButtons.forEach(button => {
        button.classList.toggle('active', button.getAttribute('data-width-mode') === editorWidthMode);
    });
    editorFontButtons.forEach(button => {
        button.classList.toggle('active', button.getAttribute('data-editor-font') === editorFontMode);
    });
    applyEditorWidthValues();
    applyFontSizeValues();
}

function setSettingsTab(tab: string) {
    settingsNavItems.forEach(item => {
        item.classList.toggle('active', item.getAttribute('data-settings-tab') === tab);
    });
    settingsPanels.forEach(panel => {
        panel.classList.toggle('active', panel.getAttribute('data-settings-panel') === tab);
    });
}

async function setAppearance(family: ThemeFamily, mode: ThemeMode) {
    applyTheme(family, mode);
    try {
        await SetAppearance(family, mode);
    } catch (error) {
        console.error('保存外观配置失败:', error);
    }
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
if (bookDetailBtn) bookDetailBtn.addEventListener('click', handleBookDetailClick);
widthModeBtn.addEventListener('click', toggleWidthMode);
if (themeToggleBtn) themeToggleBtn.addEventListener('click', toggleTheme);
if (fontSizeBtn) fontSizeBtn.addEventListener('click', toggleFontSizePopup);
if (exportBtn) exportBtn.addEventListener('click', toggleExportPopup);
if (importBtn) importBtn.addEventListener('click', handleImportNovel);
if (settingsBtn) settingsBtn.addEventListener('click', openSettings);
if (settingsCloseBtn) settingsCloseBtn.addEventListener('click', closeSettings);
if (editorContainer) editorContainer.addEventListener('contextmenu', showEditorContextMenu);
if (chapterList) chapterList.addEventListener('contextmenu', showChapterAreaContextMenu);
if (detailChapterList) detailChapterList.addEventListener('contextmenu', showChapterAreaContextMenu);
settingsNavItems.forEach(item => {
    item.addEventListener('click', () => {
        const tab = item.getAttribute('data-settings-tab');
        if (tab) setSettingsTab(tab);
    });
});
themeFamilyButtons.forEach(button => {
    button.addEventListener('click', () => {
        const family = button.getAttribute('data-theme-family') as ThemeFamily;
        if (family) setAppearance(family, currentThemeMode);
    });
});
themeModeButtons.forEach(button => {
    button.addEventListener('click', () => {
        const mode = button.getAttribute('data-theme-mode') as ThemeMode;
        if (mode) setAppearance(currentThemeFamily, mode);
    });
});
widthModeButtons.forEach(button => {
    button.addEventListener('click', () => {
        const width = button.getAttribute('data-width-mode') as 'narrow' | 'medium' | 'wide';
        if (width) setEditorWidthMode(width);
    });
});
editorFontButtons.forEach(button => {
    button.addEventListener('click', () => {
        const font = button.getAttribute('data-editor-font') as EditorFontMode;
        if (font) setEditorFontMode(font);
    });
});
[widthNarrowInput, widthMediumInput, widthWideInput].forEach(input => {
    input?.addEventListener('change', saveEditorWidthValuesFromSettings);
});
[fontSizeSmallInput, fontSizeMediumInput, fontSizeLargeInput].forEach(input => {
    input?.addEventListener('change', saveFontSizeValuesFromSettings);
});
document.querySelectorAll<HTMLButtonElement>('.number-stepper-btn').forEach(button => {
    button.addEventListener('click', () => {
        const inputId = button.getAttribute('data-step-input');
        const delta = Number(button.getAttribute('data-step-delta') || 0);
        const input = inputId ? document.getElementById(inputId) as HTMLInputElement | null : null;
        if (!input || !Number.isFinite(delta)) return;
        const current = Number(input.value || 0);
        const min = Number(input.min || -Infinity);
        const max = Number(input.max || Infinity);
        const next = Math.min(max, Math.max(min, current + delta));
        input.value = String(next);
        input.dispatchEvent(new Event('change'));
    });
});
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
        writeLocalDraft();
        if (chapterInfoTitle) {
            chapterInfoTitle.textContent = chapterTitleInput.value.trim() || '未命名章节';
        }
    });
}
if (chapterOutlineInput) {
    chapterOutlineInput.addEventListener('input', () => {
        updateSaveStatus(false);
        writeLocalDraft();
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
if (closeBtn) closeBtn.addEventListener('click', async () => {
    if (isDirty) {
        const saved = await saveCurrentChapter({ silent: true });
        if (!saved) {
            await showConfirmModal('保存失败', '当前章节还没有保存成功，暂不关闭窗口。');
            return;
        }
    }
    WindowClose();
});

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
            writeLocalDraft();
        },
        onCursorMove: () => {}
    });

    setChapterHeaderEnabled(false, '请选择章节');
    setNovelFields(null);
    await loadNovels();
    await loadRecentChapters();
    if (novelInfoTitle) novelInfoTitle.textContent = '-';
    renderLibraryList();
    updateFileTitle();
    showLibraryView();

    try {
        const config = await GetConfig();
        if (config) {
            const normalizedTheme = normalizeTheme(config.theme_family, config.theme_mode, config.theme);
            applyTheme(normalizedTheme.family, normalizedTheme.mode);

            editorWidthMode = (config.editor_width as 'narrow' | 'medium' | 'wide') || 'medium';
            editorWidthValues = {
                narrow: config.editor_width_narrow || 580,
                medium: config.editor_width_medium || 720,
                wide: config.editor_width_wide || 980
            };
            editorFontMode = (config.editor_font as EditorFontMode) || 'serif';
            applyEditorWidthValues();
            applyEditorWidthMode();
            applyEditorFont();

            currentFontSize = (config.font_size as FontSizeMode) || 'medium';
            fontSizeValues = {
                small: config.font_size_small || 16,
                medium: config.font_size_medium || 18,
                large: config.font_size_large || 20
            };
            applyFontSizeValues();
            applyFontSize();
        }
    } catch (error) {
        console.error('加载配置失败:', error);
        applyTheme('notion', 'dark');
        applyEditorWidthValues();
        applyEditorWidthMode();
        applyEditorFont();
        applyFontSizeValues();
        applyFontSize();
    }

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
