// 选区管理 - 保存和恢复光标位置

export interface SavedSelection {
    startOffset: number;
    endOffset: number;
}

// 获取光标在文本中的绝对偏移位置
export function getSelectionOffset(container: HTMLElement): SavedSelection | null {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return null;

    const range = selection.getRangeAt(0);

    // 计算起始偏移
    const preRange = document.createRange();
    preRange.selectNodeContents(container);
    preRange.setEnd(range.startContainer, range.startOffset);
    const startOffset = preRange.toString().length;

    // 计算结束偏移
    preRange.setEnd(range.endContainer, range.endOffset);
    const endOffset = preRange.toString().length;

    return { startOffset, endOffset };
}

// 根据偏移位置恢复光标
export function restoreSelection(container: HTMLElement, saved: SavedSelection): void {
    const selection = window.getSelection();
    if (!selection) return;

    const range = document.createRange();

    // 找到对应的节点和偏移
    const start = findNodeAndOffset(container, saved.startOffset);
    const end = findNodeAndOffset(container, saved.endOffset);

    if (start && end) {
        range.setStart(start.node, start.offset);
        range.setEnd(end.node, end.offset);
        selection.removeAllRanges();
        selection.addRange(range);
    }
}

// 在 DOM 树中找到对应偏移的节点
function findNodeAndOffset(container: HTMLElement, targetOffset: number): { node: Node; offset: number } | null {
    let currentOffset = 0;

    const walker = document.createTreeWalker(
        container,
        NodeFilter.SHOW_TEXT,
        null
    );

    let node: Node | null;
    while ((node = walker.nextNode())) {
        const textNode = node as Text;
        const nodeLength = textNode.length;

        if (currentOffset + nodeLength >= targetOffset) {
            return {
                node: textNode,
                offset: targetOffset - currentOffset
            };
        }

        currentOffset += nodeLength;
    }

    // 如果没找到，返回最后一个节点的末尾
    const lastChild = container.lastChild;
    if (lastChild) {
        if (lastChild.nodeType === Node.TEXT_NODE) {
            return { node: lastChild, offset: (lastChild as Text).length };
        }
    }

    return null;
}

// 将光标移到末尾
export function moveCursorToEnd(container: HTMLElement): void {
    const selection = window.getSelection();
    if (!selection) return;

    const range = document.createRange();
    range.selectNodeContents(container);
    range.collapse(false);

    selection.removeAllRanges();
    selection.addRange(range);
}

// 将光标移到指定位置
export function setCursorPosition(container: HTMLElement, offset: number): void {
    restoreSelection(container, { startOffset: offset, endOffset: offset });
}

// 获取当前光标位置（纯文本偏移）
export function getCursorPosition(container: HTMLElement): number {
    const saved = getSelectionOffset(container);
    return saved ? saved.startOffset : 0;
}

// 检查是否有选中的文本
export function hasSelection(): boolean {
    const selection = window.getSelection();
    return selection !== null && !selection.isCollapsed;
}

// 获取选中的文本
export function getSelectedText(): string {
    const selection = window.getSelection();
    return selection ? selection.toString() : '';
}
