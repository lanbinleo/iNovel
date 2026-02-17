# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

这是一个基于 Wails v2 的小说写作器桌面应用（Windows），使用 Go 作为后端，TypeScript + Vanilla JS 作为前端。采用 Typora 风格的所见即所得编辑器。

## 常用命令

```bash
# 开发模式（热重载）
wails dev

# 构建生产版本
wails build

# 前端依赖安装（在 frontend 目录）
cd frontend && npm install

# 生成 Wails 绑定
wails generate module
```

## 架构

### 后端 (Go)

- `main.go` - 应用入口，配置 Wails 窗口（1400x900，无边框）
- `app.go` - 核心业务逻辑：
  - 文件操作：`NewFile`, `OpenFile`, `SaveFile`, `LoadFileContent`
  - 工作空间：`SaveWorkspace`, `OpenWorkspace`, `LoadWorkspaceFile`, `AddFolderToWorkspace`
  - 文件树：`GetFileTree`, `GetMultiFolderFileTree`, `CreateFile`, `CreateFolder`, `DeleteFile`, `RenameFile`, `MoveFile`
  - 窗口控制：`WindowMinimize`, `WindowMaximize`, `WindowClose`, `WindowQuit`, `WindowShow`
  - 导出：`ExportAsTxt`, `ExportAsImagePath`, `SaveImageData`
  - 配置：`GetConfig`, `SetTheme`, `SetEditorWidth`
  - 配置存储在 `~/.inovel/config.json`

### 前端 (TypeScript)

```
frontend/src/
├── main.ts              # 主入口，状态管理，事件绑定
├── style.css            # 样式入口（导入其他样式）
├── editor/
│   ├── Editor.ts        # Typora 风格编辑器核心
│   ├── MarkdownParser.ts # Markdown 实时解析
│   ├── Selection.ts     # 光标/选区管理
│   └── Shortcuts.ts     # 快捷键处理
├── components/
│   ├── FileTree.ts      # 文件树组件（支持多根节点、拖拽）
│   └── Modal.ts         # 自定义模态框
└── styles/
    ├── themes.css       # 主题 CSS 变量（亮/暗）
    ├── base.css         # 基础布局样式
    ├── editor.css       # 编辑器样式
    ├── file-tree.css    # 文件树样式
    └── modal.css        # 模态框样式
```

### Wails 绑定

前端通过 `frontend/wailsjs/go/main/App` 导入调用 Go 方法，这些绑定由 Wails 自动生成。

## 关键数据结构

```go
// 文件信息
type FileInfo struct {
    Path    string `json:"path"`
    Title   string `json:"title"`
    Content string `json:"content"`
}

// 工作空间（.ins 文件）
type Workspace struct {
    Name    string   `json:"name"`
    Folders []string `json:"folders"`
}

// 文件树节点
type FileTreeNode struct {
    Name     string         `json:"name"`
    Path     string         `json:"path"`
    IsDir    bool           `json:"is_dir"`
    Children []FileTreeNode `json:"children,omitempty"`
}

// 配置
type Config struct {
    RecentFiles   []RecentFile `json:"recent_files"`
    Theme         string       `json:"theme"`          // "light", "dark"
    LastWorkspace string       `json:"last_workspace"` // .ins 文件路径
    EditorWidth   string       `json:"editor_width"`   // "narrow", "medium", "wide"
}
```

## 编辑器特性

- **Typora 风格**：contenteditable div，实时 Markdown 渲染
- **中文排版**：首行缩进 2em，段间距 0.8em
- **第一行标题**：自动加粗放大（1.5em）
- **快捷键**：Ctrl+S 保存，Ctrl+B 加粗，Ctrl+I 斜体
- **智能滚动**：光标保持在视野上方 1/3 处
- **30秒自动保存**
- **宽度模式**：窄/中/宽三档切换
- **字体大小**：小/中/大三档切换

## 主题系统

- 亮色/暗色主题切换
- CSS 变量定义在 `themes.css`
- 主题偏好保存到配置文件

## 工作空间

- `.ins` 文件格式（JSON）
- 支持多文件夹
- 启动时自动加载上次的工作空间
- 文件树支持拖拽移动

## 窗口特性

- 无边框窗口（Frameless）
- 自定义标题栏集成在工具栏
- 关闭时隐藏而非退出（HideWindowOnClose）
- 单实例锁定（再次启动显示已有窗口）

## 导出功能

- 导出为 TXT 文件
- 导出为长图（使用 html2canvas）
