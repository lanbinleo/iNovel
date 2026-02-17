// Markdown 解析器 - 实时渲染加粗和斜体

// 将 Markdown 文本转换为 HTML（用于渲染）
export function markdownToHtml(markdown: string): string {
    if (!markdown.trim()) {
        return '<p><br></p>';
    }

    // 按段落分割（两个或更多换行）
    const paragraphs = markdown.split(/\n\n+/);

    return paragraphs.map(paragraph => {
        if (!paragraph.trim()) return '';

        // 处理段落内的 Markdown 语法
        let html = escapeHtml(paragraph);

        // 加粗 **text** 或 __text__
        html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');

        // 斜体 *text* 或 _text_（注意不要匹配已被加粗的）
        html = html.replace(/(?<![*_])\*([^*]+)\*(?![*_])/g, '<em>$1</em>');
        html = html.replace(/(?<![*_])_([^_]+)_(?![*_])/g, '<em>$1</em>');

        // 处理单个换行（变成 <br>）
        html = html.replace(/\n/g, '<br>');

        return `<p>${html}</p>`;
    }).filter(p => p).join('');
}

// 将 HTML 转换回 Markdown（用于保存）
export function htmlToMarkdown(html: string): string {
    // 创建临时 DOM 解析
    const temp = document.createElement('div');
    temp.innerHTML = html;

    let markdown = '';

    const processNode = (node: Node): string => {
        if (node.nodeType === Node.TEXT_NODE) {
            return node.textContent || '';
        }

        if (node.nodeType !== Node.ELEMENT_NODE) {
            return '';
        }

        const element = node as Element;
        const tagName = element.tagName.toLowerCase();

        // 获取子内容
        let content = '';
        node.childNodes.forEach(child => {
            content += processNode(child);
        });

        switch (tagName) {
            case 'strong':
            case 'b':
                return `**${content}**`;
            case 'em':
            case 'i':
                return `*${content}*`;
            case 'p':
                return content + '\n\n';
            case 'br':
                return '\n';
            case 'div':
                return content + '\n\n';
            default:
                return content;
        }
    };

    temp.childNodes.forEach(node => {
        markdown += processNode(node);
    });

    return markdown.trim().replace(/\n{3,}/g, '\n\n');
}

// 转义 HTML 特殊字符
function escapeHtml(text: string): string {
    const map: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
    };
    return text.replace(/[&<>]/g, char => map[char] || char);
}

// 获取纯文本（用于字数统计）
export function getPlainText(html: string): string {
    const temp = document.createElement('div');
    temp.innerHTML = html;
    return temp.textContent || '';
}

// 检测光标是否在格式化文本中
export function isInFormat(selection: Selection, format: 'bold' | 'italic'): boolean {
    if (!selection.rangeCount) return false;

    const range = selection.getRangeAt(0);
    let node: Node | null = range.commonAncestorContainer;

    while (node && node !== document.body) {
        if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element;
            const tagName = element.tagName.toLowerCase();

            if (format === 'bold' && (tagName === 'strong' || tagName === 'b')) {
                return true;
            }
            if (format === 'italic' && (tagName === 'em' || tagName === 'i')) {
                return true;
            }
        }
        node = node.parentNode;
    }

    return false;
}

// 实时转换 Markdown 语法
export function convertMarkdownInPlace(_container: HTMLElement): boolean {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return false;

    const range = selection.getRangeAt(0);
    const textNode = range.startContainer;

    if (textNode.nodeType !== Node.TEXT_NODE) return false;

    const text = textNode.textContent || '';

    // 检测加粗语法 **text**
    const boldMatch = text.match(/\*\*([^*]+)\*\*/);
    if (boldMatch) {
        const start = text.indexOf(boldMatch[0]);
        const end = start + boldMatch[0].length;

        // 创建 strong 元素
        const before = text.substring(0, start);
        const content = boldMatch[1];
        const after = text.substring(end);

        const parent = textNode.parentNode;
        if (!parent) return false;

        // 替换文本节点
        const fragment = document.createDocumentFragment();
        if (before) fragment.appendChild(document.createTextNode(before));

        const strong = document.createElement('strong');
        strong.textContent = content;
        fragment.appendChild(strong);

        if (after) fragment.appendChild(document.createTextNode(after));

        parent.replaceChild(fragment, textNode);

        // 将光标移到 strong 元素后面
        const newRange = document.createRange();
        if (after) {
            newRange.setStart(strong.nextSibling!, 0);
        } else {
            newRange.setStartAfter(strong);
        }
        newRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(newRange);

        return true;
    }

    // 检测斜体语法 *text*（但不是 **）
    const italicMatch = text.match(/(?<!\*)\*([^*]+)\*(?!\*)/);
    if (italicMatch) {
        const start = text.indexOf(italicMatch[0]);
        const end = start + italicMatch[0].length;

        const before = text.substring(0, start);
        const content = italicMatch[1];
        const after = text.substring(end);

        const parent = textNode.parentNode;
        if (!parent) return false;

        const fragment = document.createDocumentFragment();
        if (before) fragment.appendChild(document.createTextNode(before));

        const em = document.createElement('em');
        em.textContent = content;
        fragment.appendChild(em);

        if (after) fragment.appendChild(document.createTextNode(after));

        parent.replaceChild(fragment, textNode);

        const newRange = document.createRange();
        if (after) {
            newRange.setStart(em.nextSibling!, 0);
        } else {
            newRange.setStartAfter(em);
        }
        newRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(newRange);

        return true;
    }

    return false;
}
