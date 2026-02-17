// 编辑器核心类 - Typora 风格所见即所得编辑器

import { markdownToHtml, htmlToMarkdown, getPlainText, isInFormat, convertMarkdownInPlace } from './MarkdownParser';
import { getSelectionOffset, restoreSelection, hasSelection } from './Selection';
import { createDefaultShortcuts, ShortcutManager } from './Shortcuts';

export interface EditorOptions {
    container: HTMLElement;
    onSave?: () => void;
    onChange?: (content: string) => void;
    onCursorMove?: () => void;
}

export class Editor {
    private container: HTMLElement;
    private content: string = ''; // 原始 Markdown 文本
    private isComposing: boolean = false; // 是否正在使用输入法
    private shortcutManager: ShortcutManager;
    private onChange?: (content: string) => void;
    private onCursorMove?: () => void;
    private debounceTimer: number | null = null;

    constructor(options: EditorOptions) {
        this.container = options.container;
        this.onChange = options.onChange;
        this.onCursorMove = options.onCursorMove;

        // 设置 contenteditable
        this.container.contentEditable = 'true';
        this.container.setAttribute('spellcheck', 'false');
        this.container.setAttribute('autocorrect', 'off');
        this.container.setAttribute('autocapitalize', 'off');

        // 创建快捷键管理器
        this.shortcutManager = createDefaultShortcuts({
            onSave: () => options.onSave?.(),
            onBold: () => this.toggleBold(),
            onItalic: () => this.toggleItalic()
        });

        // 绑定事件
        this.bindEvents();
    }

    // 设置内容（Markdown 格式）
    setContent(markdown: string): void {
        this.content = markdown;
        this.render();
    }

    // 获取内容（Markdown 格式）
    getContent(): string {
        // 从 HTML 转回 Markdown
        return htmlToMarkdown(this.container.innerHTML);
    }

    // 获取纯文本（用于字数统计）
    getPlainText(): string {
        return getPlainText(this.container.innerHTML);
    }

    // 获取字数
    getWordCount(): number {
        return this.getPlainText().length;
    }

    // 聚焦编辑器
    focus(): void {
        this.container.focus();
    }

    // 渲染 Markdown 为 HTML
    private render(): void {
        // 保存光标位置
        const savedSelection = getSelectionOffset(this.container);

        // 渲染 HTML
        if (this.content.trim()) {
            this.container.innerHTML = markdownToHtml(this.content);
        } else {
            this.container.innerHTML = '<p><br></p>';
        }

        // 恢复光标位置
        if (savedSelection) {
            restoreSelection(this.container, savedSelection);
        }
    }

    // 绑定事件
    private bindEvents(): void {
        // 输入事件
        this.container.addEventListener('input', (e) => this.handleInput(e as InputEvent));

        // 按键事件
        this.container.addEventListener('keydown', (e) => this.handleKeydown(e));

        // 输入法事件
        this.container.addEventListener('compositionstart', () => {
            this.isComposing = true;
        });

        this.container.addEventListener('compositionend', () => {
            this.isComposing = false;
            this.handleContentChange();
        });

        // 粘贴事件
        this.container.addEventListener('paste', (e) => this.handlePaste(e));

        // 光标移动
        this.container.addEventListener('click', () => {
            this.onCursorMove?.();
        });

        this.container.addEventListener('keyup', () => {
            this.onCursorMove?.();
        });
    }

    // 处理输入
    private handleInput(_e: InputEvent): void {
        // 如果正在使用输入法，等待 compositionend
        if (this.isComposing) return;

        this.handleContentChange();
    }

    // 处理内容变化
    private handleContentChange(): void {
        // 尝试实时转换 Markdown 语法
        convertMarkdownInPlace(this.container);

        // 使用防抖来避免频繁更新
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }

        this.debounceTimer = window.setTimeout(() => {
            this.content = this.getContent();
            this.onChange?.(this.content);
        }, 100);
    }

    // 处理按键
    private handleKeydown(e: KeyboardEvent): void {
        // 先检查快捷键
        if (this.shortcutManager.handleKeydown(e)) {
            return;
        }

        // 处理回车键 - 创建新段落
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            this.insertParagraph();
        }
    }

    // 处理粘贴
    private handlePaste(e: ClipboardEvent): void {
        e.preventDefault();

        // 获取纯文本
        const text = e.clipboardData?.getData('text/plain') || '';

        // 插入纯文本
        document.execCommand('insertText', false, text);
    }

    // 插入新段落
    private insertParagraph(): void {
        // 使用 execCommand 插入段落（浏览器会自动处理）
        document.execCommand('insertParagraph', false);

        // 触发变化
        this.handleContentChange();

        // 智能滚动
        // this.scrollToKeepCursorInView();
    }

    // 切换加粗
    toggleBold(): void {
        if (hasSelection()) {
            document.execCommand('bold', false);
            this.handleContentChange();
        } else {
            // 如果没有选中文本，插入 Markdown 标记
            document.execCommand('insertText', false, '****');
            // 将光标移到中间
            const selection = window.getSelection();
            if (selection && selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                range.setStart(range.startContainer, range.startOffset - 2);
                range.collapse(true);
                selection.removeAllRanges();
                selection.addRange(range);
            }
        }
    }

    // 切换斜体
    toggleItalic(): void {
        if (hasSelection()) {
            document.execCommand('italic', false);
            this.handleContentChange();
        } else {
            // 如果没有选中文本，插入 Markdown 标记
            document.execCommand('insertText', false, '**');
            // 将光标移到中间
            const selection = window.getSelection();
            if (selection && selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                range.setStart(range.startContainer, range.startOffset - 1);
                range.collapse(true);
                selection.removeAllRanges();
                selection.addRange(range);
            }
        }
    }

    // 检查当前是否是加粗状态
    isBold(): boolean {
        const selection = window.getSelection();
        return selection ? isInFormat(selection, 'bold') : false;
    }

    // 检查当前是否是斜体状态
    isItalic(): boolean {
        const selection = window.getSelection();
        return selection ? isInFormat(selection, 'italic') : false;
    }

    // 智能滚动：保持光标在视野中
    scrollToKeepCursorInView(): void {
        const selection = window.getSelection();
        if (!selection || !selection.rangeCount) return;

        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        const containerRect = this.container.getBoundingClientRect();

        // 计算光标相对于容器的位置
        const cursorY = rect.top - containerRect.top + this.container.scrollTop;

        // 目标：将光标保持在视口的上 1/3 处
        const targetScroll = cursorY - (containerRect.height / 3);

        // 平滑滚动
        this.container.scrollTo({
            top: Math.max(0, targetScroll),
            behavior: 'smooth'
        });
    }

    // 滚动到底部
    scrollToBottom(): void {
        this.container.scrollTop = this.container.scrollHeight;
    }

    // 清空内容
    clear(): void {
        this.content = '';
        this.container.innerHTML = '<p><br></p>';
    }

    // 销毁编辑器
    destroy(): void {
        this.container.contentEditable = 'false';
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
    }
}

// 创建编辑器实例
export function createEditor(options: EditorOptions): Editor {
    return new Editor(options);
}
