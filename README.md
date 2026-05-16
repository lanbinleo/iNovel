# iNovel

iNovel 是一个基于 Wails v2 的 Windows 桌面小说写作器，面向长篇小说的书库、章节管理和沉浸式写作。

## 下载

当前发布包先支持 Windows x64：

- GitHub Releases: https://github.com/lanbinleo/iNovel/releases
- Windows 安装脚本：

```powershell
irm https://raw.githubusercontent.com/lanbinleo/iNovel/main/scripts/install.ps1 | iex
```

## 开发

```bash
# 开发模式
wails dev

# 生产构建
wails build
```

前端位于 `frontend/`，后端使用 Go。应用数据默认保存在 `~/.inovel/`。
