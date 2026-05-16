# AGENTS.md

面向在本仓库工作的 Codex。默认用中文和 Leo 沟通，专有名词、API、命令、文件名保留原文。

## 协作方式

- 称呼用户为 Leo。
- Leo 偏好先把思路说清楚，再开始改代码。需求不明确时，直接指出不确定点，并给出可选做法。
- 当 Leo 说“开始干”时，说明方案已经足够明确。此时简短说明会改什么、用什么技术，然后直接动手。
- 如果 Leo 很确定，但现有代码、Git 状态或事实信息显示可能有风险，要提醒他。
- 回复要自然、简洁，像同事之间沟通。功能变化说清楚即可，不堆内部实现细节。
- 避免生硬口头禅、暴力比喻、医疗比喻、过度承诺和讨好式表达。

## Git 工作流

- 所有开发工作都通过 Git 管理。
- 当前发布线从 `dev/0.2.0` 开始。后续版本使用对应的 `dev/x.x.x` 分支。
- 发布线未完成前，相关改动留在同一个 `dev/x.x.x` 分支。
- 按功能或阶段组织改动。完成一段有意义的工作后提交一次 commit。
- 发布通过 PR 完成。已经评审过的 release PR 打开后，应继续推进到 merge，不长期搁置。
- 不覆盖 Leo 或其他人已有的无关改动。
- 改动保持聚焦；不要做无关重构、格式化或清理。

## 项目概览

这是一个基于 Wails v2 的 Windows 桌面小说写作器。

- 后端：Go
- 前端：TypeScript + Vanilla JS
- 编辑器：Typora 风格 `contenteditable` 所见即所得编辑器
- 配置目录：`~/.inovel/config.json`
- 工作空间文件：`.ins` JSON 文件

## 常用命令

```bash
# 开发模式
wails dev

# 构建生产版本
wails build

# 安装前端依赖
cd frontend && npm install

# 生成 Wails 绑定
wails generate module
```

## 代码入口

### Go 后端

- `main.go`：应用入口，配置 Wails 窗口。
- `app.go`：核心业务逻辑，包含文件、工作空间、文件树、窗口、导出和配置相关方法。

常见方法分组：

- 文件：`NewFile`, `OpenFile`, `SaveFile`, `LoadFileContent`
- 工作空间：`SaveWorkspace`, `OpenWorkspace`, `LoadWorkspaceFile`, `AddFolderToWorkspace`
- 文件树：`GetFileTree`, `GetMultiFolderFileTree`, `CreateFile`, `CreateFolder`, `DeleteFile`, `RenameFile`, `MoveFile`
- 窗口：`WindowMinimize`, `WindowMaximize`, `WindowClose`, `WindowQuit`, `WindowShow`
- 导出：`ExportAsTxt`, `ExportAsImagePath`, `SaveImageData`
- 配置：`GetConfig`, `SetTheme`, `SetEditorWidth`

### TypeScript 前端

```text
frontend/src/
├── main.ts
├── style.css
├── editor/
│   ├── Editor.ts
│   ├── MarkdownParser.ts
│   ├── Selection.ts
│   └── Shortcuts.ts
├── components/
│   ├── FileTree.ts
│   └── Modal.ts
└── styles/
    ├── themes.css
    ├── base.css
    ├── editor.css
    ├── file-tree.css
    └── modal.css
```

前端通过 `frontend/wailsjs/go/main/App` 调用 Go 方法。Wails 绑定由 `wails generate module` 生成。

## 关键数据结构

```go
type FileInfo struct {
    Path    string `json:"path"`
    Title   string `json:"title"`
    Content string `json:"content"`
}

type Workspace struct {
    Name    string   `json:"name"`
    Folders []string `json:"folders"`
}

type FileTreeNode struct {
    Name     string         `json:"name"`
    Path     string         `json:"path"`
    IsDir    bool           `json:"is_dir"`
    Children []FileTreeNode `json:"children,omitempty"`
}

type Config struct {
    RecentFiles   []RecentFile `json:"recent_files"`
    Theme         string       `json:"theme"`
    LastWorkspace string       `json:"last_workspace"`
    EditorWidth   string       `json:"editor_width"`
}
```

## 功能边界

- 编辑器支持 Markdown 实时渲染、中文首行缩进、标题行样式、快捷键和 30 秒自动保存。
- 主题支持亮色和暗色，变量定义在 `frontend/src/styles/themes.css`。
- 工作空间支持多文件夹，启动时会尝试加载上次工作空间。
- 文件树支持拖拽移动。
- 窗口为无边框窗口，自定义标题栏集成在工具栏。
- 导出支持 TXT 和长图，长图依赖 `html2canvas`。

## 改代码时的偏好

- 先读相关代码，再改文件。
- 只改和目标直接相关的内容。
- 保持现有风格，除非 Leo 明确要求调整。
- 新增抽象要有明确价值，单次使用的逻辑通常直接写在本地上下文。
- 修改后尽量用项目已有命令验证。无法验证时，在回复里说明原因。
