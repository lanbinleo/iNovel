// 类型定义文件

export interface FileInfo {
    path: string;
    title: string;
    content: string;
}

export interface Config {
    recent_files: RecentFile[];
    theme: 'light' | 'dark';
    last_workspace: string;
    editor_width: 'narrow' | 'medium' | 'wide';
}

export interface RecentFile {
    path: string;
    title: string;
    updated_at: string;
}

export interface FileTreeNode {
    name: string;
    path: string;
    is_dir: boolean;
    children?: FileTreeNode[];
}
