// 文件树组件

import { showInputModal, showConfirmModal } from './Modal';

export interface FileTreeNode {
    name: string;
    path: string;
    is_dir: boolean;
    children?: FileTreeNode[];
}

export interface FileTreeOptions {
    container: HTMLElement;
    onFileSelect: (path: string) => void;
    onCreateFile: (dirPath: string, fileName: string) => Promise<string | null>;
    onCreateFolder: (parentPath: string, folderName: string) => Promise<string | null>;
    onDeleteFile: (path: string) => Promise<boolean>;
    onRenameFile: (oldPath: string, newName: string) => Promise<string | null>;
    onMoveFile?: (sourcePath: string, targetDir: string) => Promise<string | null>;
    onRefresh: () => void;
}

export class FileTree {
    private container: HTMLElement;
    private options: FileTreeOptions;
    private rootNodes: FileTreeNode[] = []; // 支持多根节点
    private expandedPaths: Set<string> = new Set();
    private selectedPath: string | null = null;
    private contextMenu: HTMLElement | null = null;
    private draggedNode: FileTreeNode | null = null;

    constructor(options: FileTreeOptions) {
        this.container = options.container;
        this.options = options;
        this.createContextMenu();
        this.setupGlobalClickHandler();
    }

    setData(node: FileTreeNode) {
        this.rootNodes = [node];
        this.expandedPaths.add(node.path); // 默认展开根目录
        this.render();
    }

    // 设置多个根节点
    setMultipleRoots(nodes: FileTreeNode[]) {
        this.rootNodes = nodes;
        // 默认展开所有根目录
        nodes.forEach(node => this.expandedPaths.add(node.path));
        this.render();
    }

    setSelectedPath(path: string) {
        this.selectedPath = path;
        this.render();
    }

    private render() {
        if (this.rootNodes.length === 0) {
            this.container.innerHTML = '<div class="file-tree-empty">选择工作空间开始</div>';
            return;
        }

        this.container.innerHTML = '';

        // 渲染所有根节点
        for (const node of this.rootNodes) {
            const tree = this.renderNode(node, 0, true);
            this.container.appendChild(tree);
        }
    }

    private renderNode(node: FileTreeNode, depth: number, isRoot: boolean = false): HTMLElement {
        const wrapper = document.createElement('div');
        wrapper.className = 'file-tree-node';

        const item = document.createElement('div');
        item.className = 'file-tree-item';
        item.style.paddingLeft = `${depth * 16 + 8}px`;

        if (this.selectedPath === node.path) {
            item.classList.add('selected');
        }

        // 图标
        const icon = document.createElement('span');
        icon.className = 'file-tree-icon';

        if (node.is_dir) {
            const isExpanded = this.expandedPaths.has(node.path);
            icon.innerHTML = isExpanded
                ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 9l6 6 6-6"/></svg>'
                : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 18l6-6-6-6"/></svg>';
        } else {
            icon.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
        }

        // 名称
        const name = document.createElement('span');
        name.className = 'file-tree-name';
        name.textContent = node.name;

        item.appendChild(icon);
        item.appendChild(name);

        // 点击事件
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            if (node.is_dir) {
                this.toggleExpand(node.path);
            } else {
                this.selectedPath = node.path;
                this.options.onFileSelect(node.path);
                this.render();
            }
        });

        // 右键菜单
        item.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.showContextMenu(e.clientX, e.clientY, node);
        });

        // 拖拽功能
        if (!isRoot) {
            item.draggable = true;

            item.addEventListener('dragstart', (e) => {
                this.draggedNode = node;
                item.classList.add('dragging');
                e.dataTransfer?.setData('text/plain', node.path);
            });

            item.addEventListener('dragend', () => {
                this.draggedNode = null;
                item.classList.remove('dragging');
                // 移除所有 drag-over 样式
                this.container.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
            });
        }

        // 文件夹可以接收拖拽
        if (node.is_dir) {
            item.addEventListener('dragover', (e) => {
                e.preventDefault();
                if (this.draggedNode && this.draggedNode.path !== node.path) {
                    item.classList.add('drag-over');
                }
            });

            item.addEventListener('dragleave', () => {
                item.classList.remove('drag-over');
            });

            item.addEventListener('drop', async (e) => {
                e.preventDefault();
                item.classList.remove('drag-over');

                if (this.draggedNode && this.options.onMoveFile) {
                    // 不能移动到自己或自己的子目录
                    if (this.draggedNode.path !== node.path && !node.path.startsWith(this.draggedNode.path + '/') && !node.path.startsWith(this.draggedNode.path + '\\')) {
                        const result = await this.options.onMoveFile(this.draggedNode.path, node.path);
                        if (result) {
                            this.options.onRefresh();
                        }
                    }
                }
            });
        }

        wrapper.appendChild(item);

        // 子节点
        if (node.is_dir && node.children && this.expandedPaths.has(node.path)) {
            const childrenContainer = document.createElement('div');
            childrenContainer.className = 'file-tree-children';

            // 排序：文件夹在前，文件在后
            const sorted = [...node.children].sort((a, b) => {
                if (a.is_dir && !b.is_dir) return -1;
                if (!a.is_dir && b.is_dir) return 1;
                return a.name.localeCompare(b.name);
            });

            for (const child of sorted) {
                childrenContainer.appendChild(this.renderNode(child, depth + 1, false));
            }

            wrapper.appendChild(childrenContainer);
        }

        return wrapper;
    }

    private toggleExpand(path: string) {
        if (this.expandedPaths.has(path)) {
            this.expandedPaths.delete(path);
        } else {
            this.expandedPaths.add(path);
        }
        this.render();
    }

    private createContextMenu() {
        this.contextMenu = document.createElement('div');
        this.contextMenu.className = 'file-tree-context-menu hidden';
        document.body.appendChild(this.contextMenu);
    }

    private showContextMenu(x: number, y: number, node: FileTreeNode) {
        if (!this.contextMenu) return;

        this.contextMenu.innerHTML = '';

        const items: { label: string; icon: string; action: () => void }[] = [];

        if (node.is_dir) {
            items.push({
                label: '新建文件',
                icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>',
                action: () => this.promptCreateFile(node.path)
            });
            items.push({
                label: '新建文件夹',
                icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>',
                action: () => this.promptCreateFolder(node.path)
            });
        }

        items.push({
            label: '重命名',
            icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>',
            action: () => this.promptRename(node)
        });

        items.push({
            label: '删除',
            icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
            action: () => this.promptDelete(node)
        });

        for (const item of items) {
            const menuItem = document.createElement('div');
            menuItem.className = 'context-menu-item';
            menuItem.innerHTML = `${item.icon}<span>${item.label}</span>`;
            menuItem.addEventListener('click', () => {
                this.hideContextMenu();
                item.action();
            });
            this.contextMenu.appendChild(menuItem);
        }

        // 定位
        this.contextMenu.style.left = `${x}px`;
        this.contextMenu.style.top = `${y}px`;
        this.contextMenu.classList.remove('hidden');

        // 确保菜单不超出视口
        const rect = this.contextMenu.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
            this.contextMenu.style.left = `${window.innerWidth - rect.width - 8}px`;
        }
        if (rect.bottom > window.innerHeight) {
            this.contextMenu.style.top = `${window.innerHeight - rect.height - 8}px`;
        }
    }

    private hideContextMenu() {
        if (this.contextMenu) {
            this.contextMenu.classList.add('hidden');
        }
    }

    private setupGlobalClickHandler() {
        document.addEventListener('click', () => this.hideContextMenu());
    }

    private async promptCreateFile(dirPath: string) {
        const fileName = await showInputModal('新建文件', '输入文件名');
        if (!fileName) return;

        const result = await this.options.onCreateFile(dirPath, fileName);
        if (result) {
            this.options.onRefresh();
        }
    }

    private async promptCreateFolder(parentPath: string) {
        const folderName = await showInputModal('新建文件夹', '输入文件夹名');
        if (!folderName) return;

        const result = await this.options.onCreateFolder(parentPath, folderName);
        if (result) {
            this.expandedPaths.add(parentPath);
            this.options.onRefresh();
        }
    }

    private async promptRename(node: FileTreeNode) {
        const newName = await showInputModal('重命名', '输入新名称', node.name);
        if (!newName || newName === node.name) return;

        const result = await this.options.onRenameFile(node.path, newName);
        if (result) {
            this.options.onRefresh();
        }
    }

    private async promptDelete(node: FileTreeNode) {
        const message = node.is_dir
            ? `确定要删除文件夹 "${node.name}" 吗？\n文件夹内的所有内容都会被删除。`
            : `确定要删除 "${node.name}" 吗？`;

        const confirmed = await showConfirmModal('删除确认', message);
        if (!confirmed) return;

        const success = await this.options.onDeleteFile(node.path);
        if (success) {
            if (this.selectedPath === node.path) {
                this.selectedPath = null;
            }
            this.options.onRefresh();
        }
    }
}
