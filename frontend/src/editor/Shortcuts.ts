// 快捷键处理

export interface ShortcutHandler {
    key: string;
    ctrl?: boolean;
    shift?: boolean;
    alt?: boolean;
    handler: (e: KeyboardEvent) => void;
}

export class ShortcutManager {
    private shortcuts: ShortcutHandler[] = [];

    register(shortcut: ShortcutHandler): void {
        this.shortcuts.push(shortcut);
    }

    handleKeydown(e: KeyboardEvent): boolean {
        for (const shortcut of this.shortcuts) {
            if (this.matches(e, shortcut)) {
                e.preventDefault();
                shortcut.handler(e);
                return true;
            }
        }
        return false;
    }

    private matches(e: KeyboardEvent, shortcut: ShortcutHandler): boolean {
        const key = e.key.toLowerCase();
        const shortcutKey = shortcut.key.toLowerCase();

        if (key !== shortcutKey) return false;
        if (shortcut.ctrl && !e.ctrlKey) return false;
        if (shortcut.shift && !e.shiftKey) return false;
        if (shortcut.alt && !e.altKey) return false;

        // 如果快捷键没有要求 ctrl，但用户按了 ctrl，不匹配
        if (!shortcut.ctrl && e.ctrlKey && key !== 'control') return false;

        return true;
    }
}

// 创建默认快捷键管理器
export function createDefaultShortcuts(callbacks: {
    onSave: () => void;
    onBold: () => void;
    onItalic: () => void;
}): ShortcutManager {
    const manager = new ShortcutManager();

    // Ctrl+S 保存
    manager.register({
        key: 's',
        ctrl: true,
        handler: () => callbacks.onSave()
    });

    // Ctrl+B 加粗
    manager.register({
        key: 'b',
        ctrl: true,
        handler: () => callbacks.onBold()
    });

    // Ctrl+I 斜体
    manager.register({
        key: 'i',
        ctrl: true,
        handler: () => callbacks.onItalic()
    });

    return manager;
}
