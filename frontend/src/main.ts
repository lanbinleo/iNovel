import './style.css';

// 导入Wails运行时
import { OpenFile, SaveFile, LoadFileContent, GetConfig, SetTheme, SetEditorWidth, CreateFile as WailsCreateFile, CreateFolder as WailsCreateFolder, DeleteFile as WailsDeleteFile, RenameFile as WailsRenameFile, MoveFile as WailsMoveFile, WindowMinimize, WindowMaximize, WindowClose, SaveWorkspace, OpenWorkspace, AddFolderToWorkspace, GetMultiFolderFileTree, ExportAsTxt, ExportAsImagePathWithName, SaveImageData, LoadWorkspaceFile, GetVersion, CheckUpdate, OpenURL } from '../wailsjs/go/main/App';

// 导入编辑器
import { Editor, createEditor } from './editor/Editor';

// 导入文件树
import { FileTree, FileTreeNode } from './components/FileTree';

// 导入模态框
import { showInputModal, showConfirmModal, showExportPreview, getExportWidthValue, getExportWidthName, getExportThemeStyle, createExportWatermark } from './components/Modal';

// ============ 类型定义 ============
interface FileInfo {
    path: string;
    title: string;
    content: string;
}

// ============ 全局状态 ============
let currentFile: FileInfo | null = null;
let isDirty = false;
let autoSaveTimer: number | null = null;
const AUTO_SAVE_INTERVAL = 30000;
let editorWidthMode: 'narrow' | 'medium' | 'wide' = 'medium';
let currentTheme: 'light' | 'dark' = 'light';
let currentFontSize: 'small' | 'medium' | 'large' = 'medium';
let currentWorkspace: { name: string; folders: string[] } = { name: '未命名工作空间', folders: [] };
let editor: Editor;
let fileTree: FileTree;

// ============ DOM 元素 ============
const editorContainer = document.getElementById('editor') as HTMLDivElement;
const fileTitle = document.getElementById('file-title') as HTMLSpanElement;
const saveStatus = document.getElementById('save-status') as HTMLSpanElement;
const wordCount = document.getElementById('word-count') as HTMLSpanElement;
const saveBtn = document.getElementById('save-btn') as HTMLButtonElement;
const newFileBtn = document.getElementById('new-file-btn') as HTMLButtonElement;
const openFileBtn = document.getElementById('open-file-btn') as HTMLButtonElement;
const toggleSidebarBtn = document.getElementById('toggle-sidebar-btn') as HTMLButtonElement;
const widthModeBtn = document.getElementById('width-mode-btn') as HTMLButtonElement;
const themeToggleBtn = document.getElementById('theme-toggle-btn') as HTMLButtonElement;
const fontSizeBtn = document.getElementById('font-size-btn') as HTMLButtonElement;
const fontSizePopup = document.getElementById('font-size-popup') as HTMLDivElement;
const sidebar = document.getElementById('sidebar') as HTMLDivElement;
const fileTreeContainer = document.getElementById('file-tree') as HTMLDivElement;
const workspaceNameSpan = document.getElementById('workspace-name') as HTMLSpanElement;
const openWorkspaceBtn = document.getElementById('open-workspace-btn') as HTMLButtonElement;
const saveWorkspaceBtn = document.getElementById('save-workspace-btn') as HTMLButtonElement;
const addFolderBtn = document.getElementById('add-folder-btn') as HTMLButtonElement;
const newFolderBtn = document.getElementById('new-folder-btn') as HTMLButtonElement;
const refreshTreeBtn = document.getElementById('refresh-tree-btn') as HTMLButtonElement;
const exportBtn = document.getElementById('export-btn') as HTMLButtonElement;
const exportPopup = document.getElementById('export-popup') as HTMLDivElement;
const versionText = document.getElementById('version-text') as HTMLSpanElement;
const versionLink = document.getElementById('version-link') as HTMLAnchorElement;
const updateBadge = document.getElementById('update-badge') as HTMLSpanElement;

// ============ 编辑器辅助功能 ============

function updateWordCount() {
    const count = editor.getWordCount();
    wordCount.textContent = `${count} 字`;
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
    if (currentFile && currentFile.path) {
        const fileName = currentFile.path.split(/[/\\]/).pop() || '未命名文档';
        fileTitle.textContent = fileName;
    } else {
        const content = editor.getPlainText();
        const firstLine = content.split('\n')[0].trim();
        fileTitle.textContent = firstLine.substring(0, 20) || '未命名文档';
    }
}

// ============ 文件操作 ============

async function handleNewFile() {
    if (isDirty) {
        const confirmed = await showConfirmModal('未保存', '当前文件未保存，是否继续？');
        if (!confirmed) return;
    }

    editor.clear();
    currentFile = null;
    updateFileTitle();
    updateWordCount();
    updateSaveStatus(true);
    editor.focus();
}

async function handleSave() {
    const content = editor.getContent();

    try {
        const path = currentFile?.path || '';
        const savedPath = await SaveFile(path, content);

        if (!savedPath) return;

        const firstLine = content.split('\n')[0].trim() || '未命名';
        currentFile = {
            path: savedPath,
            title: firstLine,
            content: content
        };

        updateFileTitle();
        updateSaveStatus(true);
    } catch (error) {
        console.error('保存失败:', error);
        alert('保存失败: ' + error);
    }
}

async function handleOpen() {
    if (isDirty) {
        const confirmed = await showConfirmModal('未保存', '当前文件未保存，是否继续？');
        if (!confirmed) return;
    }

    try {
        const fileInfo = await OpenFile();
        if (fileInfo) {
            currentFile = fileInfo;
            editor.setContent(fileInfo.content);
            updateFileTitle();
            updateWordCount();
            updateSaveStatus(true);
        }
    } catch (error) {
        console.error('打开文件失败:', error);
        alert('打开文件失败: ' + error);
    }
}

function startAutoSave() {
    if (autoSaveTimer) clearInterval(autoSaveTimer);

    autoSaveTimer = window.setInterval(() => {
        if (isDirty && editor.getPlainText().trim() !== '') {
            handleSave();
        }
    }, AUTO_SAVE_INTERVAL);
}

function toggleSidebar() {
    sidebar.classList.toggle('hidden');
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

// ============ 导出功能 ============

function toggleExportPopup() {
    const rect = exportBtn.getBoundingClientRect();
    exportPopup.style.top = `${rect.bottom + 4}px`;
    exportPopup.style.right = `${window.innerWidth - rect.right}px`;
    exportPopup.classList.toggle('hidden');
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

// ============ 工作空间和文件树 ============

async function handleOpenWorkspace() {
    try {
        const workspace = await OpenWorkspace();
        if (workspace) {
            currentWorkspace = workspace;
            updateWorkspaceDisplay();
            await refreshFileTree();
        }
    } catch (error) {
        console.error('打开工作空间失败:', error);
    }
}

async function handleSaveWorkspace() {
    try {
        const name = await showInputModal('保存工作空间', '输入工作空间名称', currentWorkspace.name);
        if (!name) return;

        currentWorkspace.name = name;
        const path = await SaveWorkspace(currentWorkspace);
        if (path) {
            updateWorkspaceDisplay();
        }
    } catch (error) {
        console.error('保存工作空间失败:', error);
    }
}

async function handleAddFolder() {
    try {
        const folderPath = await AddFolderToWorkspace();
        if (folderPath) {
            // 检查是否已存在
            if (!currentWorkspace.folders.includes(folderPath)) {
                currentWorkspace.folders.push(folderPath);
                await refreshFileTree();
            }
        }
    } catch (error) {
        console.error('添加文件夹失败:', error);
    }
}

function updateWorkspaceDisplay() {
    if (workspaceNameSpan) {
        workspaceNameSpan.textContent = currentWorkspace.name || '未命名工作空间';
    }
}

async function refreshFileTree() {
    if (currentWorkspace.folders.length === 0) {
        fileTree.setMultipleRoots([]);
        return;
    }

    try {
        const trees = await GetMultiFolderFileTree(currentWorkspace.folders);
        if (trees) {
            fileTree.setMultipleRoots(trees as FileTreeNode[]);
        }
    } catch (error) {
        console.error('加载文件树失败:', error);
    }
}

async function handleFileSelect(path: string) {
    if (isDirty) {
        const confirmed = await showConfirmModal('未保存', '当前文件未保存，是否继续？');
        if (!confirmed) return;
    }

    try {
        const loadedFile = await LoadFileContent(path);
        if (loadedFile) {
            currentFile = loadedFile;
            editor.setContent(loadedFile.content);
            updateFileTitle();
            updateWordCount();
            updateSaveStatus(true);
            fileTree.setSelectedPath(path);
        }
    } catch (error) {
        console.error('加载文件失败:', error);
        alert('加载文件失败: ' + error);
    }
}

async function handleCreateFile(dirPath: string, fileName: string): Promise<string | null> {
    try {
        const path = await WailsCreateFile(dirPath, fileName);
        return path || null;
    } catch (error) {
        console.error('创建文件失败:', error);
        alert('创建文件失败: ' + error);
        return null;
    }
}

async function handleCreateFolder(parentPath: string, folderName: string): Promise<string | null> {
    try {
        const path = await WailsCreateFolder(parentPath, folderName);
        return path || null;
    } catch (error) {
        console.error('创建文件夹失败:', error);
        alert('创建文件夹失败: ' + error);
        return null;
    }
}

async function handleDeleteFile(path: string): Promise<boolean> {
    try {
        await WailsDeleteFile(path);
        return true;
    } catch (error) {
        console.error('删除失败:', error);
        alert('删除失败: ' + error);
        return false;
    }
}

async function handleRenameFile(oldPath: string, newName: string): Promise<string | null> {
    try {
        const newPath = await WailsRenameFile(oldPath, newName);
        return newPath || null;
    } catch (error) {
        console.error('重命名失败:', error);
        alert('重命名失败: ' + error);
        return null;
    }
}

async function handleMoveFile(sourcePath: string, targetDir: string): Promise<string | null> {
    try {
        const newPath = await WailsMoveFile(sourcePath, targetDir);
        return newPath || null;
    } catch (error) {
        console.error('移动失败:', error);
        alert('移动失败: ' + error);
        return null;
    }
}

async function handleNewFolderInWorkspace() {
    if (currentWorkspace.folders.length === 0) {
        await showConfirmModal('提示', '请先添加文件夹到工作空间');
        return;
    }
    const folderName = await showInputModal('新建文件夹', '输入文件夹名');
    if (!folderName) return;

    // 在第一个文件夹中创建
    const result = await handleCreateFolder(currentWorkspace.folders[0], folderName);
    if (result) {
        await refreshFileTree();
    }
}

// ============ 事件监听 ============

saveBtn.addEventListener('click', handleSave);
newFileBtn.addEventListener('click', handleNewFile);
openFileBtn.addEventListener('click', handleOpen);
toggleSidebarBtn.addEventListener('click', toggleSidebar);
widthModeBtn.addEventListener('click', toggleWidthMode);
if (themeToggleBtn) themeToggleBtn.addEventListener('click', toggleTheme);
if (fontSizeBtn) fontSizeBtn.addEventListener('click', toggleFontSizePopup);
if (openWorkspaceBtn) openWorkspaceBtn.addEventListener('click', handleOpenWorkspace);
if (saveWorkspaceBtn) saveWorkspaceBtn.addEventListener('click', handleSaveWorkspace);
if (addFolderBtn) addFolderBtn.addEventListener('click', handleAddFolder);
if (newFolderBtn) newFolderBtn.addEventListener('click', handleNewFolderInWorkspace);
if (refreshTreeBtn) refreshTreeBtn.addEventListener('click', refreshFileTree);
if (exportBtn) exportBtn.addEventListener('click', toggleExportPopup);

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

    // 初始化文件树
    fileTree = new FileTree({
        container: fileTreeContainer,
        onFileSelect: handleFileSelect,
        onCreateFile: handleCreateFile,
        onCreateFolder: handleCreateFolder,
        onDeleteFile: handleDeleteFile,
        onRenameFile: handleRenameFile,
        onMoveFile: handleMoveFile,
        onRefresh: refreshFileTree
    });

    try {
        const config = await GetConfig();
        if (config) {
            currentTheme = (config.theme as 'light' | 'dark') || 'light';
            applyTheme(currentTheme);

            editorWidthMode = (config.editor_width as 'narrow' | 'medium' | 'wide') || 'medium';
            editorContainer.classList.add(`width-${editorWidthMode}`);

            // 加载上次的工作空间
            if (config.last_workspace) {
                try {
                    const workspace = await LoadWorkspaceFile(config.last_workspace);
                    if (workspace) {
                        currentWorkspace = workspace;
                        updateWorkspaceDisplay();
                        await refreshFileTree();
                    }
                } catch (e) {
                    console.error('加载上次工作空间失败:', e);
                }
            }
        }
    } catch (error) {
        console.error('加载配置失败:', error);
        applyTheme('light');
        editorContainer.classList.add('width-medium');
    }

    // 默认字体大小
    editorContainer.classList.add('font-medium');

    startAutoSave();
    editor.focus();

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
