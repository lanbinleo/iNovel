// 自定义模态框组件

export interface ModalOptions {
    title: string;
    type: 'input' | 'confirm';
    placeholder?: string;
    defaultValue?: string;
    confirmText?: string;
    cancelText?: string;
    message?: string;
}

export interface ModalResult {
    confirmed: boolean;
    value?: string;
}

class ModalManager {
    private overlay: HTMLElement | null = null;
    private modal: HTMLElement | null = null;
    private resolvePromise: ((result: ModalResult) => void) | null = null;

    constructor() {
        this.createElements();
        this.setupEventListeners();
    }

    private createElements() {
        // 创建遮罩层
        this.overlay = document.createElement('div');
        this.overlay.className = 'modal-overlay hidden';

        // 创建模态框
        this.modal = document.createElement('div');
        this.modal.className = 'modal';

        this.overlay.appendChild(this.modal);
        document.body.appendChild(this.overlay);
    }

    private setupEventListeners() {
        // 移除点击遮罩关闭功能 - 只能通过按钮或 ESC 关闭

        // ESC 关闭
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !this.overlay?.classList.contains('hidden')) {
                this.close(false);
            }
        });
    }

    show(options: ModalOptions): Promise<ModalResult> {
        return new Promise((resolve) => {
            this.resolvePromise = resolve;

            if (!this.modal) return;

            const isInput = options.type === 'input';

            this.modal.innerHTML = `
                <div class="modal-header">
                    <span class="modal-title">${options.title}</span>
                </div>
                <div class="modal-body">
                    ${isInput
                        ? `<input type="text" class="modal-input" placeholder="${options.placeholder || ''}" value="${options.defaultValue || ''}" />`
                        : `<p class="modal-message">${options.message || ''}</p>`
                    }
                </div>
                <div class="modal-footer">
                    <button class="modal-btn modal-btn-cancel">${options.cancelText || '取消'}</button>
                    <button class="modal-btn modal-btn-confirm">${options.confirmText || '确定'}</button>
                </div>
            `;

            // 绑定按钮事件
            const cancelBtn = this.modal.querySelector('.modal-btn-cancel');
            const confirmBtn = this.modal.querySelector('.modal-btn-confirm');
            const input = this.modal.querySelector('.modal-input') as HTMLInputElement;

            cancelBtn?.addEventListener('click', () => this.close(false));
            confirmBtn?.addEventListener('click', () => this.close(true, input?.value));

            // Enter 确认
            if (input) {
                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        this.close(true, input.value);
                    }
                });
            }

            // 显示模态框
            this.overlay?.classList.remove('hidden');

            // 聚焦输入框
            if (input) {
                setTimeout(() => input.focus(), 50);
            }
        });
    }

    private close(confirmed: boolean, value?: string) {
        this.overlay?.classList.add('hidden');
        if (this.resolvePromise) {
            this.resolvePromise({ confirmed, value });
            this.resolvePromise = null;
        }
    }
}

// 单例
let modalInstance: ModalManager | null = null;

export function getModal(): ModalManager {
    if (!modalInstance) {
        modalInstance = new ModalManager();
    }
    return modalInstance;
}

// 便捷方法
export async function showInputModal(title: string, placeholder?: string, defaultValue?: string): Promise<string | null> {
    const result = await getModal().show({
        type: 'input',
        title,
        placeholder,
        defaultValue
    });
    return result.confirmed ? (result.value || '') : null;
}

export async function showConfirmModal(title: string, message: string): Promise<boolean> {
    const result = await getModal().show({
        type: 'confirm',
        title,
        message
    });
    return result.confirmed;
}

// ============ 导出预览模态框 ============

export type ExportWidth = 'phone' | 'tablet' | 'desktop';
export type ExportTheme = 'white' | 'yellow' | 'dark' | 'dark-yellow';

export interface ExportOptions {
    width: ExportWidth;
    theme: ExportTheme;
}

export interface ExportPreviewResult {
    confirmed: boolean;
    options?: ExportOptions;
}

const EXPORT_WIDTH_VALUES: Record<ExportWidth, number> = {
    phone: 375,
    tablet: 768,
    desktop: 1024
};

const EXPORT_WIDTH_NAMES: Record<ExportWidth, string> = {
    phone: '手机',
    tablet: '平板',
    desktop: '电脑'
};

const EXPORT_THEME_STYLES: Record<ExportTheme, { bg: string; text: string; name: string }> = {
    white: { bg: '#ffffff', text: '#333333', name: '白纸' },
    yellow: { bg: '#faf8f5', text: '#3d3a36', name: '黄纸' },
    dark: { bg: '#1a1a1a', text: '#e0e0e0', name: '暗黑' },
    'dark-yellow': { bg: '#2a2820', text: '#d0c8b8', name: '暗黄' }
};

// 创建导出水印元素
export function createExportWatermark(textColor: string): HTMLElement {
    const watermark = document.createElement('div');
    watermark.style.cssText = `
        margin-top: 3em;
        padding-top: 2em;
        text-align: center;
        font-size: 0.85em;
    `;
    watermark.innerHTML = `
        <div style="color: ${textColor}; opacity: 0.6; margin-bottom: 0.3em;">本文使用 iNovel 创作</div>
        <div style="color: ${textColor}; opacity: 0.35; font-size: 0.85em;">By Lanbinleo with ♥️ lanbinleo/iNovel</div>
    `;
    return watermark;
}

class ExportPreviewModal {
    private overlay: HTMLElement | null = null;
    private modal: HTMLElement | null = null;
    private previewContainer: HTMLElement | null = null;
    private resolvePromise: ((result: ExportPreviewResult) => void) | null = null;
    private currentOptions: ExportOptions = { width: 'phone', theme: 'yellow' };
    private content: string = '';

    constructor() {
        this.createElements();
        this.setupEventListeners();
    }

    private createElements() {
        this.overlay = document.createElement('div');
        this.overlay.className = 'export-preview-overlay hidden';

        this.modal = document.createElement('div');
        this.modal.className = 'export-preview-modal';

        this.overlay.appendChild(this.modal);
        document.body.appendChild(this.overlay);
    }

    private setupEventListeners() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !this.overlay?.classList.contains('hidden')) {
                this.close(false);
            }
        });
    }

    show(content: string): Promise<ExportPreviewResult> {
        return new Promise((resolve) => {
            this.resolvePromise = resolve;
            this.content = content;
            this.currentOptions = { width: 'phone', theme: 'yellow' };

            if (!this.modal) return;

            this.modal.innerHTML = `
                <div class="export-preview-header">
                    <span class="export-preview-title">导出预览</span>
                    <button class="export-preview-close">&times;</button>
                </div>
                <div class="export-preview-body">
                    <div class="export-preview-options">
                        <div class="export-option-group">
                            <label class="export-option-label">宽度</label>
                            <div class="export-option-buttons">
                                <button class="export-option-btn active" data-width="phone">手机</button>
                                <button class="export-option-btn" data-width="tablet">平板</button>
                                <button class="export-option-btn" data-width="desktop">电脑</button>
                            </div>
                        </div>
                        <div class="export-option-group">
                            <label class="export-option-label">主题</label>
                            <div class="export-option-buttons">
                                <button class="export-option-btn" data-theme="white">白纸</button>
                                <button class="export-option-btn active" data-theme="yellow">黄纸</button>
                                <button class="export-option-btn" data-theme="dark">暗黑</button>
                                <button class="export-option-btn" data-theme="dark-yellow">暗黄</button>
                            </div>
                        </div>
                    </div>
                    <div class="export-preview-area">
                        <div class="export-preview-scroll">
                            <div class="export-preview-content"></div>
                        </div>
                    </div>
                </div>
                <div class="export-preview-footer">
                    <button class="modal-btn modal-btn-cancel">取消</button>
                    <button class="modal-btn modal-btn-confirm">导出</button>
                </div>
            `;

            this.previewContainer = this.modal.querySelector('.export-preview-content');
            this.bindEvents();
            this.updatePreview();

            this.overlay?.classList.remove('hidden');
        });
    }

    private bindEvents() {
        if (!this.modal) return;

        // 关闭按钮
        const closeBtn = this.modal.querySelector('.export-preview-close');
        closeBtn?.addEventListener('click', () => this.close(false));

        // 取消/确认按钮
        const cancelBtn = this.modal.querySelector('.modal-btn-cancel');
        const confirmBtn = this.modal.querySelector('.modal-btn-confirm');
        cancelBtn?.addEventListener('click', () => this.close(false));
        confirmBtn?.addEventListener('click', () => this.close(true));

        // 宽度选项
        this.modal.querySelectorAll('[data-width]').forEach(btn => {
            btn.addEventListener('click', () => {
                const width = btn.getAttribute('data-width') as ExportWidth;
                this.currentOptions.width = width;
                this.modal?.querySelectorAll('[data-width]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.updatePreview();
            });
        });

        // 主题选项
        this.modal.querySelectorAll('[data-theme]').forEach(btn => {
            btn.addEventListener('click', () => {
                const theme = btn.getAttribute('data-theme') as ExportTheme;
                this.currentOptions.theme = theme;
                this.modal?.querySelectorAll('[data-theme]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.updatePreview();
            });
        });
    }

    private updatePreview() {
        if (!this.previewContainer) return;

        const width = EXPORT_WIDTH_VALUES[this.currentOptions.width];
        const theme = EXPORT_THEME_STYLES[this.currentOptions.theme];

        // 设置预览容器样式，宽度使用max-width限制
        this.previewContainer.style.width = `${width}px`;
        this.previewContainer.style.backgroundColor = theme.bg;
        this.previewContainer.style.color = theme.text;

        // 渲染内容（过滤空行）
        const lines = this.content.split('\n').filter(line => line.trim() !== '');
        this.previewContainer.innerHTML = '';

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
            this.previewContainer?.appendChild(p);
        });

        // 添加水印
        this.previewContainer?.appendChild(createExportWatermark(theme.text));
    }

    private close(confirmed: boolean) {
        this.overlay?.classList.add('hidden');
        if (this.resolvePromise) {
            this.resolvePromise({
                confirmed,
                options: confirmed ? this.currentOptions : undefined
            });
            this.resolvePromise = null;
        }
    }

    getWidthValue(width: ExportWidth): number {
        return EXPORT_WIDTH_VALUES[width];
    }

    getThemeStyle(theme: ExportTheme): { bg: string; text: string; name: string } {
        return EXPORT_THEME_STYLES[theme];
    }
}

let exportPreviewInstance: ExportPreviewModal | null = null;

export function getExportPreviewModal(): ExportPreviewModal {
    if (!exportPreviewInstance) {
        exportPreviewInstance = new ExportPreviewModal();
    }
    return exportPreviewInstance;
}

export async function showExportPreview(content: string): Promise<ExportPreviewResult> {
    return getExportPreviewModal().show(content);
}

export function getExportWidthValue(width: ExportWidth): number {
    return EXPORT_WIDTH_VALUES[width];
}

export function getExportWidthName(width: ExportWidth): string {
    return EXPORT_WIDTH_NAMES[width];
}

export function getExportThemeStyle(theme: ExportTheme): { bg: string; text: string; name: string } {
    return EXPORT_THEME_STYLES[theme];
}