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

## 发布流程

- 发布前统一版本号：`VERSION`、`app.go` 中的 `Version`、前端显示版本、`frontend/package.json`、`frontend/package-lock.json`、`CHANGELOG` 等需要保持一致。
- 每次发布都要修改 `CHANGELOG`，并检查/更新 `README.md`。文档改动需要随代码一起提交并 push。
- 发布前读取 `.github/RELEASE_TEMPLATE.md`，release notes 使用这套固定模板；按版本内容填好 `New Features`、`Changes`、`Others`，并把下载链接中的 `$TAG` 替换为实际 tag。
- 当前打包产物先只支持 Windows。发布前本地执行验证和打包：`npm run build`、`go test ./...`、`wails build`，确认 `build/bin/iNovel.exe` 可生成。
- 发布准备提交后，使用本地 `gh` 命令创建 release PR，例如：`gh pr create --base main --head dev/x.x.x --title "Release x.x.x" --body-file .github/RELEASE_TEMPLATE.md`。
- 创建 PR 后等待云端检查和编译完成。等待期间可以继续完善仓库说明类文件，例如本文件的发布流程，但不要把未确认的功能改动混进 release PR。
- 云端通过后，用本地 `gh` 合并 PR，例如：`gh pr merge --merge`。如需保留发布线分支，不要使用会删除分支的参数。
- PR merge 后，在最新主线提交上创建并推送 tag：`git tag -a vx.x.x -m "Release vx.x.x"`，然后 `git push origin vx.x.x`。
- tag 推送会触发 `.github/workflows/release.yml`，云端会构建 Windows 包并创建 GitHub Release。Release 创建后检查附件、标题、模板内容和下载链接。
- 如果需要手动发布或修正 release，优先使用本地 `gh release` 命令完成，例如 `gh release view vx.x.x`、`gh release edit vx.x.x --notes-file .github/RELEASE_TEMPLATE.md`。

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
