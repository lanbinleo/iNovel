package main

import (
	"context"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/Masterminds/semver/v3"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// Version 应用版本号（构建时注入）
var Version = "0.2.0"

const githubRepoReleasesAPI = "https://api.github.com/repos/lanbinleo/iNovel/releases"

// App struct
type App struct {
	ctx context.Context
	db  *sql.DB
}

// FileInfo 文件信息
type FileInfo struct {
	Path    string `json:"path"`
	Title   string `json:"title"`
	Content string `json:"content"`
}

// RecentFile 最近文件记录
type RecentFile struct {
	Path      string `json:"path"`
	Title     string `json:"title"`
	UpdatedAt string `json:"updated_at"`
}

// Config 配置文件
type Config struct {
	RecentFiles       []RecentFile `json:"recent_files"`
	Theme             string       `json:"theme"`          // "notion-dark", "warm-light" 等
	ThemeFamily       string       `json:"theme_family"`   // "notion", "warm", "paper", "ink"
	ThemeMode         string       `json:"theme_mode"`     // "light" 或 "dark"
	LastWorkspace     string       `json:"last_workspace"` // 最近打开的工作空间路径
	EditorWidth       string       `json:"editor_width"`   // "narrow", "medium", "wide"
	EditorWidthNarrow int          `json:"editor_width_narrow"`
	EditorWidthMedium int          `json:"editor_width_medium"`
	EditorWidthWide   int          `json:"editor_width_wide"`
	EditorFont        string       `json:"editor_font"` // "serif" 或 "sans"
	FontSize          string       `json:"font_size"`   // "small", "medium", "large"
	FontSizeSmall     int          `json:"font_size_small"`
	FontSizeMedium    int          `json:"font_size_medium"`
	FontSizeLarge     int          `json:"font_size_large"`
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	if err := a.initDatabase(); err != nil {
		runtime.LogError(a.ctx, "db init failed: "+err.Error())
	}
}

// beforeClose is called when the window is about to close
func (a *App) beforeClose(ctx context.Context) bool {
	// 返回 false 允许关闭（隐藏到托盘）
	// 返回 true 阻止关闭
	return false
}

// getConfigPath 获取配置文件路径
func (a *App) getConfigPath() (string, error) {
	dataDir, err := getDataDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dataDir, "config.json"), nil
}

func splitTheme(theme string) (string, string) {
	theme = strings.TrimSpace(theme)
	if theme == "" {
		return "notion", "dark"
	}
	if theme == "light" {
		return "notion", "light"
	}
	if theme == "dark" {
		return "notion", "dark"
	}
	parts := strings.Split(theme, "-")
	if len(parts) >= 2 {
		family := strings.Join(parts[:len(parts)-1], "-")
		mode := parts[len(parts)-1]
		if family != "" && (mode == "light" || mode == "dark") {
			return family, mode
		}
	}
	return "notion", "dark"
}

func normalizeConfig(config *Config) {
	if config.RecentFiles == nil {
		config.RecentFiles = []RecentFile{}
	}
	if config.ThemeFamily == "" || config.ThemeMode == "" {
		family, mode := splitTheme(config.Theme)
		if config.ThemeFamily == "" {
			config.ThemeFamily = family
		}
		if config.ThemeMode == "" {
			config.ThemeMode = mode
		}
	}
	if config.ThemeMode != "light" && config.ThemeMode != "dark" {
		config.ThemeMode = "dark"
	}
	switch config.ThemeFamily {
	case "notion", "warm", "paper", "ink":
	default:
		config.ThemeFamily = "notion"
	}
	config.Theme = config.ThemeFamily + "-" + config.ThemeMode
	if config.EditorWidth == "" {
		config.EditorWidth = "medium"
	}
	if config.EditorWidthNarrow <= 0 {
		config.EditorWidthNarrow = 580
	}
	if config.EditorWidthMedium <= 0 {
		config.EditorWidthMedium = 720
	}
	if config.EditorWidthWide <= 0 {
		config.EditorWidthWide = 980
	}
	if config.EditorFont != "sans" && config.EditorFont != "serif" {
		config.EditorFont = "serif"
	}
	if config.FontSize == "" {
		config.FontSize = "medium"
	}
	if config.FontSizeSmall <= 0 {
		config.FontSizeSmall = 16
	}
	if config.FontSizeMedium <= 0 {
		config.FontSizeMedium = 18
	}
	if config.FontSizeLarge <= 0 {
		config.FontSizeLarge = 20
	}
}

// loadConfig 加载配置
func (a *App) loadConfig() (*Config, error) {
	db, err := a.ensureDB()
	if err != nil {
		return &Config{RecentFiles: []RecentFile{}}, nil
	}

	config := Config{RecentFiles: []RecentFile{}}

	var theme sql.NullString
	var themeFamily sql.NullString
	var themeMode sql.NullString
	var editorWidth sql.NullString
	var editorWidthNarrow sql.NullInt64
	var editorWidthMedium sql.NullInt64
	var editorWidthWide sql.NullInt64
	var editorFont sql.NullString
	var fontSize sql.NullString
	var fontSizeSmall sql.NullInt64
	var fontSizeMedium sql.NullInt64
	var fontSizeLarge sql.NullInt64
	var lastWorkspace sql.NullString

	err = db.QueryRow(`SELECT theme, theme_family, theme_mode, editor_width, editor_width_narrow, editor_width_medium, editor_width_wide, editor_font, font_size, font_size_small, font_size_medium, font_size_large, last_workspace FROM app_config WHERE id = 1;`).Scan(&theme, &themeFamily, &themeMode, &editorWidth, &editorWidthNarrow, &editorWidthMedium, &editorWidthWide, &editorFont, &fontSize, &fontSizeSmall, &fontSizeMedium, &fontSizeLarge, &lastWorkspace)
	if err != nil {
		if err == sql.ErrNoRows {
			_, _ = db.Exec(`INSERT OR IGNORE INTO app_config (id, theme, theme_family, theme_mode, editor_width, editor_width_narrow, editor_width_medium, editor_width_wide, editor_font, font_size, font_size_small, font_size_medium, font_size_large, last_workspace) VALUES (1, 'notion-dark', 'notion', 'dark', 'medium', 580, 720, 980, 'serif', 'medium', 16, 18, 20, '');`)
			config.Theme = "notion-dark"
			config.ThemeFamily = "notion"
			config.ThemeMode = "dark"
			config.EditorWidth = "medium"
			config.EditorWidthNarrow = 580
			config.EditorWidthMedium = 720
			config.EditorWidthWide = 980
			config.EditorFont = "serif"
			config.FontSize = "medium"
			config.FontSizeSmall = 16
			config.FontSizeMedium = 18
			config.FontSizeLarge = 20
			config.LastWorkspace = ""
		} else {
			return &Config{RecentFiles: []RecentFile{}}, nil
		}
	} else {
		config.Theme = theme.String
		config.ThemeFamily = themeFamily.String
		config.ThemeMode = themeMode.String
		config.EditorWidth = editorWidth.String
		if editorWidthNarrow.Valid {
			config.EditorWidthNarrow = int(editorWidthNarrow.Int64)
		}
		if editorWidthMedium.Valid {
			config.EditorWidthMedium = int(editorWidthMedium.Int64)
		}
		if editorWidthWide.Valid {
			config.EditorWidthWide = int(editorWidthWide.Int64)
		}
		config.EditorFont = editorFont.String
		config.FontSize = fontSize.String
		if fontSizeSmall.Valid {
			config.FontSizeSmall = int(fontSizeSmall.Int64)
		}
		if fontSizeMedium.Valid {
			config.FontSizeMedium = int(fontSizeMedium.Int64)
		}
		if fontSizeLarge.Valid {
			config.FontSizeLarge = int(fontSizeLarge.Int64)
		}
		config.LastWorkspace = lastWorkspace.String
	}
	normalizeConfig(&config)

	rows, err := db.Query(`SELECT path, title, updated_at FROM recent_files ORDER BY updated_at DESC LIMIT 10;`)
	if err != nil {
		return &config, nil
	}
	defer rows.Close()

	for rows.Next() {
		var path string
		var title string
		var updatedAtStr string
		if err := rows.Scan(&path, &title, &updatedAtStr); err != nil {
			continue
		}
		config.RecentFiles = append(config.RecentFiles, RecentFile{
			Path:      path,
			Title:     title,
			UpdatedAt: updatedAtStr,
		})
	}

	return &config, nil
}

// saveConfig 保存配置
func (a *App) saveConfig(config *Config) error {
	db, err := a.ensureDB()
	if err != nil {
		return err
	}
	normalizeConfig(config)
	_, err = db.Exec(
		`INSERT INTO app_config (id, theme, theme_family, theme_mode, editor_width, editor_width_narrow, editor_width_medium, editor_width_wide, editor_font, font_size, font_size_small, font_size_medium, font_size_large, last_workspace)
		 VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		 ON CONFLICT(id) DO UPDATE SET
		 theme = excluded.theme,
		 theme_family = excluded.theme_family,
		 theme_mode = excluded.theme_mode,
		 editor_width = excluded.editor_width,
		 editor_width_narrow = excluded.editor_width_narrow,
		 editor_width_medium = excluded.editor_width_medium,
		 editor_width_wide = excluded.editor_width_wide,
		 editor_font = excluded.editor_font,
		 font_size = excluded.font_size,
		 font_size_small = excluded.font_size_small,
		 font_size_medium = excluded.font_size_medium,
		 font_size_large = excluded.font_size_large,
		 last_workspace = excluded.last_workspace;`,
		config.Theme, config.ThemeFamily, config.ThemeMode, config.EditorWidth, config.EditorWidthNarrow, config.EditorWidthMedium, config.EditorWidthWide, config.EditorFont, config.FontSize, config.FontSizeSmall, config.FontSizeMedium, config.FontSizeLarge, config.LastWorkspace,
	)
	return err
}

// addToRecentFiles 添加到最近文件列表
func (a *App) addToRecentFiles(path string, title string) error {
	db, err := a.ensureDB()
	if err != nil {
		return err
	}

	tx, err := db.Begin()
	if err != nil {
		return err
	}

	_, err = tx.Exec(`DELETE FROM recent_files WHERE path = ?;`, path)
	if err != nil {
		tx.Rollback()
		return err
	}

	_, err = tx.Exec(
		`INSERT INTO recent_files (path, title, updated_at) VALUES (?, ?, ?);`,
		path, title, time.Now().UTC().Format(time.RFC3339),
	)
	if err != nil {
		tx.Rollback()
		return err
	}

	_, err = tx.Exec(`
		DELETE FROM recent_files
		WHERE path NOT IN (
			SELECT path FROM recent_files ORDER BY updated_at DESC LIMIT 10
		);
	`)
	if err != nil {
		tx.Rollback()
		return err
	}

	return tx.Commit()
}

// NewFile 创建新文件
func (a *App) NewFile() FileInfo {
	return FileInfo{
		Path:    "",
		Title:   "未命名",
		Content: "",
	}
}

// OpenFile 打开文件
func (a *App) OpenFile() (*FileInfo, error) {
	// 弹出文件选择对话框
	filePath, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "打开文件",
		Filters: []runtime.FileFilter{
			{
				DisplayName: "文本文件 (*.txt)",
				Pattern:     "*.txt",
			},
			{
				DisplayName: "所有文件 (*.*)",
				Pattern:     "*.*",
			},
		},
	})

	if err != nil {
		return nil, err
	}

	if filePath == "" {
		// 用户取消了选择
		return nil, nil
	}

	// 读取文件内容
	content, err := os.ReadFile(filePath)
	if err != nil {
		return nil, err
	}

	// 提取首行作为标题
	contentStr := string(content)
	title := filepath.Base(filePath)
	lines := splitLines(contentStr)
	if len(lines) > 0 && lines[0] != "" {
		title = lines[0]
		if len(title) > 50 {
			title = title[:50] + "..."
		}
	}

	// 添加到最近文件
	a.addToRecentFiles(filePath, title)

	return &FileInfo{
		Path:    filePath,
		Title:   title,
		Content: contentStr,
	}, nil
}

// SaveFile 保存文件
func (a *App) SaveFile(path string, content string) (string, error) {
	var filePath string

	if path == "" {
		// 新文件，弹出保存对话框
		// 使用首行作为默认文件名
		defaultName := "未命名.txt"
		lines := splitLines(content)
		if len(lines) > 0 && lines[0] != "" {
			defaultName = sanitizeFilename(lines[0]) + ".txt"
		}

		selectedPath, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
			Title:           "保存文件",
			DefaultFilename: defaultName,
			Filters: []runtime.FileFilter{
				{
					DisplayName: "文本文件 (*.txt)",
					Pattern:     "*.txt",
				},
				{
					DisplayName: "所有文件 (*.*)",
					Pattern:     "*.*",
				},
			},
		})

		if err != nil {
			return "", err
		}

		if selectedPath == "" {
			// 用户取消了保存
			return "", nil
		}

		filePath = selectedPath
	} else {
		filePath = path
	}

	// 写入文件
	if err := os.WriteFile(filePath, []byte(content), 0644); err != nil {
		return "", err
	}

	// 提取标题
	title := filepath.Base(filePath)
	lines := splitLines(content)
	if len(lines) > 0 && lines[0] != "" {
		title = lines[0]
		if len(title) > 50 {
			title = title[:50] + "..."
		}
	}

	// 添加到最近文件
	a.addToRecentFiles(filePath, title)

	return filePath, nil
}

// GetRecentFiles 获取最近文件列表
func (a *App) GetRecentFiles() ([]FileInfo, error) {
	db, err := a.ensureDB()
	if err != nil {
		return []FileInfo{}, nil
	}

	rows, err := db.Query(`SELECT path, title, updated_at FROM recent_files ORDER BY updated_at DESC LIMIT 10;`)
	if err != nil {
		return []FileInfo{}, nil
	}
	defer rows.Close()

	var files []FileInfo
	for rows.Next() {
		var path string
		var title string
		var updatedAtStr string
		if err := rows.Scan(&path, &title, &updatedAtStr); err != nil {
			continue
		}
		if _, err := os.Stat(path); os.IsNotExist(err) {
			continue
		}
		files = append(files, FileInfo{
			Path:    path,
			Title:   title,
			Content: "",
		})
	}

	return files, nil
}

// LoadFileContent 加载文件内容
func (a *App) LoadFileContent(path string) (*FileInfo, error) {
	content, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	// 提取标题
	contentStr := string(content)
	title := filepath.Base(path)
	lines := splitLines(contentStr)
	if len(lines) > 0 && lines[0] != "" {
		title = lines[0]
		if len(title) > 50 {
			title = title[:50] + "..."
		}
	}

	return &FileInfo{
		Path:    path,
		Title:   title,
		Content: contentStr,
	}, nil
}

// 辅助函数

// splitLines 分割行
func splitLines(s string) []string {
	var lines []string
	start := 0
	for i, r := range s {
		if r == '\n' {
			lines = append(lines, s[start:i])
			start = i + 1
		}
	}
	if start < len(s) {
		lines = append(lines, s[start:])
	}
	return lines
}

// sanitizeFilename 清理文件名（移除非法字符）
func sanitizeFilename(name string) string {
	// 移除路径分隔符和其他非法字符
	invalidChars := []rune{'/', '\\', ':', '*', '?', '"', '<', '>', '|'}
	result := []rune(name)

	for i, r := range result {
		for _, invalid := range invalidChars {
			if r == invalid {
				result[i] = '_'
				break
			}
		}
	}

	// 限制长度
	if len(result) > 50 {
		result = result[:50]
	}

	return string(result)
}

// GetConfig 获取配置（暴露给前端）
func (a *App) GetConfig() (*Config, error) {
	config, err := a.loadConfig()
	if err != nil {
		return &Config{
			RecentFiles:       []RecentFile{},
			Theme:             "notion-dark",
			ThemeFamily:       "notion",
			ThemeMode:         "dark",
			EditorWidth:       "medium",
			EditorWidthNarrow: 580,
			EditorWidthMedium: 720,
			EditorWidthWide:   980,
			EditorFont:        "serif",
			FontSize:          "medium",
			FontSizeSmall:     16,
			FontSizeMedium:    18,
			FontSizeLarge:     20,
		}, nil
	}
	normalizeConfig(config)
	return config, nil
}

// SetTheme 设置主题
func (a *App) SetTheme(theme string) error {
	config, err := a.loadConfig()
	if err != nil {
		config = &Config{RecentFiles: []RecentFile{}}
	}
	family, mode := splitTheme(theme)
	config.Theme = theme
	config.ThemeFamily = family
	config.ThemeMode = mode
	return a.saveConfig(config)
}

// SetAppearance 设置主题家族和日夜模式
func (a *App) SetAppearance(themeFamily string, themeMode string) error {
	config, err := a.loadConfig()
	if err != nil {
		config = &Config{RecentFiles: []RecentFile{}}
	}
	config.ThemeFamily = themeFamily
	config.ThemeMode = themeMode
	return a.saveConfig(config)
}

// SetEditorWidth 设置编辑器宽度
func (a *App) SetEditorWidth(width string) error {
	config, err := a.loadConfig()
	if err != nil {
		config = &Config{RecentFiles: []RecentFile{}}
	}
	config.EditorWidth = width
	return a.saveConfig(config)
}

// SetEditorWidthValues 设置宽度档位对应的宽度
func (a *App) SetEditorWidthValues(narrow int, medium int, wide int) error {
	config, err := a.loadConfig()
	if err != nil {
		config = &Config{RecentFiles: []RecentFile{}}
	}
	config.EditorWidthNarrow = narrow
	config.EditorWidthMedium = medium
	config.EditorWidthWide = wide
	return a.saveConfig(config)
}

// SetEditorFont 设置编辑器正文字体
func (a *App) SetEditorFont(font string) error {
	config, err := a.loadConfig()
	if err != nil {
		config = &Config{RecentFiles: []RecentFile{}}
	}
	config.EditorFont = font
	return a.saveConfig(config)
}

// SetFontSize 设置当前字号档位
func (a *App) SetFontSize(size string) error {
	config, err := a.loadConfig()
	if err != nil {
		config = &Config{RecentFiles: []RecentFile{}}
	}
	config.FontSize = size
	return a.saveConfig(config)
}

// SetFontSizeValues 设置字号档位对应的字号
func (a *App) SetFontSizeValues(small int, medium int, large int) error {
	config, err := a.loadConfig()
	if err != nil {
		config = &Config{RecentFiles: []RecentFile{}}
	}
	config.FontSizeSmall = small
	config.FontSizeMedium = medium
	config.FontSizeLarge = large
	return a.saveConfig(config)
}

// ============ 工作空间和文件树 ============

// FileTreeNode 文件树节点
type FileTreeNode struct {
	Name     string         `json:"name"`
	Path     string         `json:"path"`
	IsDir    bool           `json:"is_dir"`
	Children []FileTreeNode `json:"children,omitempty"`
}

// SelectWorkspace 选择工作空间目录
func (a *App) SelectWorkspace() (string, error) {
	dirPath, err := runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "选择工作空间",
	})
	if err != nil {
		return "", err
	}
	if dirPath == "" {
		return "", nil
	}

	// 保存到配置
	config, err := a.loadConfig()
	if err != nil {
		config = &Config{RecentFiles: []RecentFile{}}
	}
	config.LastWorkspace = dirPath
	a.saveConfig(config)

	return dirPath, nil
}

// GetFileTree 获取文件树
func (a *App) GetFileTree(rootPath string) (*FileTreeNode, error) {
	info, err := os.Stat(rootPath)
	if err != nil {
		return nil, err
	}

	if !info.IsDir() {
		return nil, os.ErrInvalid
	}

	return a.buildFileTree(rootPath, info.Name(), 3) // 最多3层深度
}

// buildFileTree 递归构建文件树
func (a *App) buildFileTree(path string, name string, maxDepth int) (*FileTreeNode, error) {
	node := &FileTreeNode{
		Name:  name,
		Path:  path,
		IsDir: true,
	}

	if maxDepth <= 0 {
		return node, nil
	}

	entries, err := os.ReadDir(path)
	if err != nil {
		return node, nil // 无法读取目录，返回空节点
	}

	for _, entry := range entries {
		// 跳过隐藏文件
		if entry.Name()[0] == '.' {
			continue
		}

		childPath := filepath.Join(path, entry.Name())

		if entry.IsDir() {
			childNode, _ := a.buildFileTree(childPath, entry.Name(), maxDepth-1)
			if childNode != nil {
				node.Children = append(node.Children, *childNode)
			}
		} else {
			// 只显示 txt 和 md 文件
			ext := filepath.Ext(entry.Name())
			if ext == ".txt" || ext == ".md" {
				node.Children = append(node.Children, FileTreeNode{
					Name:  entry.Name(),
					Path:  childPath,
					IsDir: false,
				})
			}
		}
	}

	return node, nil
}

// CreateFile 创建新文件
func (a *App) CreateFile(dirPath string, fileName string) (string, error) {
	// 确保文件名有扩展名
	if filepath.Ext(fileName) == "" {
		fileName = fileName + ".txt"
	}

	filePath := filepath.Join(dirPath, fileName)

	// 检查文件是否已存在
	if _, err := os.Stat(filePath); err == nil {
		return "", os.ErrExist
	}

	// 创建空文件
	file, err := os.Create(filePath)
	if err != nil {
		return "", err
	}
	file.Close()

	return filePath, nil
}

// CreateFolder 创建新文件夹
func (a *App) CreateFolder(parentPath string, folderName string) (string, error) {
	folderPath := filepath.Join(parentPath, folderName)

	// 检查文件夹是否已存在
	if _, err := os.Stat(folderPath); err == nil {
		return "", os.ErrExist
	}

	if err := os.Mkdir(folderPath, 0755); err != nil {
		return "", err
	}

	return folderPath, nil
}

// DeleteFile 删除文件或文件夹
func (a *App) DeleteFile(path string) error {
	info, err := os.Stat(path)
	if err != nil {
		return err
	}

	if info.IsDir() {
		return os.RemoveAll(path)
	}
	return os.Remove(path)
}

// RenameFile 重命名文件或文件夹
func (a *App) RenameFile(oldPath string, newName string) (string, error) {
	dir := filepath.Dir(oldPath)
	newPath := filepath.Join(dir, newName)

	// 检查新路径是否已存在
	if _, err := os.Stat(newPath); err == nil {
		return "", os.ErrExist
	}

	if err := os.Rename(oldPath, newPath); err != nil {
		return "", err
	}

	return newPath, nil
}

// SetLastWorkspace 设置最后打开的工作空间
func (a *App) SetLastWorkspace(path string) error {
	config, err := a.loadConfig()
	if err != nil {
		config = &Config{RecentFiles: []RecentFile{}}
	}
	config.LastWorkspace = path
	return a.saveConfig(config)
}

// ============ 窗口控制 ============

// WindowMinimize 最小化窗口
func (a *App) WindowMinimize() {
	runtime.WindowMinimise(a.ctx)
}

// WindowMaximize 最大化/还原窗口
func (a *App) WindowMaximize() {
	runtime.WindowToggleMaximise(a.ctx)
}

// WindowClose 关闭窗口（隐藏到托盘）
func (a *App) WindowClose() {
	runtime.WindowHide(a.ctx)
}

// WindowQuit 完全退出应用
func (a *App) WindowQuit() {
	runtime.Quit(a.ctx)
}

// WindowShow 显示窗口
func (a *App) WindowShow() {
	runtime.WindowShow(a.ctx)
}

// WindowIsMaximized 检查窗口是否最大化
func (a *App) WindowIsMaximized() bool {
	return runtime.WindowIsMaximised(a.ctx)
}

// ============ 工作空间 (.ins 文件) ============

// Workspace 工作空间配置
type Workspace struct {
	Name    string   `json:"name"`
	Folders []string `json:"folders"` // 多个文件夹路径
}

// SaveWorkspace 保存工作空间配置到 .ins 文件
func (a *App) SaveWorkspace(workspace Workspace) (string, error) {
	// 弹出保存对话框
	savePath, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:           "保存工作空间",
		DefaultFilename: workspace.Name + ".ins",
		Filters: []runtime.FileFilter{
			{
				DisplayName: "INovelSpace 工作空间 (*.ins)",
				Pattern:     "*.ins",
			},
		},
	})

	if err != nil {
		return "", err
	}

	if savePath == "" {
		return "", nil
	}

	// 序列化为 JSON
	data, err := json.MarshalIndent(workspace, "", "  ")
	if err != nil {
		return "", err
	}

	// 写入文件
	if err := os.WriteFile(savePath, data, 0644); err != nil {
		return "", err
	}

	return savePath, nil
}

// OpenWorkspace 打开 .ins 工作空间文件
func (a *App) OpenWorkspace() (*Workspace, error) {
	// 弹出文件选择对话框
	filePath, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "打开工作空间",
		Filters: []runtime.FileFilter{
			{
				DisplayName: "INovelSpace 工作空间 (*.ins)",
				Pattern:     "*.ins",
			},
		},
	})

	if err != nil {
		return nil, err
	}

	if filePath == "" {
		return nil, nil
	}

	return a.LoadWorkspaceFile(filePath)
}

// LoadWorkspaceFile 加载指定路径的工作空间文件
func (a *App) LoadWorkspaceFile(filePath string) (*Workspace, error) {
	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, err
	}

	var workspace Workspace
	if err := json.Unmarshal(data, &workspace); err != nil {
		return nil, err
	}

	// 保存到最近工作空间
	config, _ := a.loadConfig()
	if config != nil {
		config.LastWorkspace = filePath
		a.saveConfig(config)
	}

	return &workspace, nil
}

// AddFolderToWorkspace 添加文件夹到工作空间
func (a *App) AddFolderToWorkspace() (string, error) {
	dirPath, err := runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "添加文件夹",
	})
	if err != nil {
		return "", err
	}
	return dirPath, nil
}

// GetMultiFolderFileTree 获取多文件夹的文件树
func (a *App) GetMultiFolderFileTree(folders []string) ([]FileTreeNode, error) {
	var trees []FileTreeNode

	for _, folder := range folders {
		info, err := os.Stat(folder)
		if err != nil {
			continue
		}

		if !info.IsDir() {
			continue
		}

		tree, err := a.buildFileTree(folder, info.Name(), 3)
		if err != nil {
			continue
		}

		trees = append(trees, *tree)
	}

	return trees, nil
}

// MoveFile 移动文件或文件夹
func (a *App) MoveFile(sourcePath string, targetDir string) (string, error) {
	// 获取源文件名
	fileName := filepath.Base(sourcePath)
	newPath := filepath.Join(targetDir, fileName)

	// 检查目标是否已存在
	if _, err := os.Stat(newPath); err == nil {
		return "", os.ErrExist
	}

	// 移动文件
	if err := os.Rename(sourcePath, newPath); err != nil {
		return "", err
	}

	return newPath, nil
}

// ============ 导出功能 ============

// ExportAsTxt 导出为 txt 文件
func (a *App) ExportAsTxt(content string) (string, error) {
	// 使用首行作为默认文件名
	defaultName := "导出.txt"
	lines := splitLines(content)
	if len(lines) > 0 && lines[0] != "" {
		defaultName = sanitizeFilename(lines[0]) + ".txt"
	}

	savePath, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:           "导出为 TXT",
		DefaultFilename: defaultName,
		Filters: []runtime.FileFilter{
			{
				DisplayName: "文本文件 (*.txt)",
				Pattern:     "*.txt",
			},
		},
	})

	if err != nil {
		return "", err
	}

	if savePath == "" {
		return "", nil
	}

	if err := os.WriteFile(savePath, []byte(content), 0644); err != nil {
		return "", err
	}

	return savePath, nil
}

// ExportAsImagePath 获取导出图片的保存路径
func (a *App) ExportAsImagePath() (string, error) {
	return a.ExportAsImagePathWithName("导出.png")
}

// ExportAsImagePathWithName 获取导出图片的保存路径（带默认文件名）
func (a *App) ExportAsImagePathWithName(defaultName string) (string, error) {
	savePath, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:           "导出为图片",
		DefaultFilename: defaultName,
		Filters: []runtime.FileFilter{
			{
				DisplayName: "PNG 图片 (*.png)",
				Pattern:     "*.png",
			},
		},
	})

	if err != nil {
		return "", err
	}

	return savePath, nil
}

// SaveImageData 保存图片数据到指定路径
func (a *App) SaveImageData(path string, base64Data string) error {
	// 解码 base64 数据
	data, err := base64.StdEncoding.DecodeString(base64Data)
	if err != nil {
		return err
	}

	return os.WriteFile(path, data, 0644)
}

// ============ 版本和更新 ============

// GetVersion 获取当前版本号
func (a *App) GetVersion() string {
	return Version
}

// UpdateInfo 更新信息
type UpdateInfo struct {
	HasUpdate      bool   `json:"has_update"`
	LatestVersion  string `json:"latest_version"`
	CurrentVersion string `json:"current_version"`
	ReleaseURL     string `json:"release_url"`
}

// CheckUpdate 检查更新（仅检查稳定版本，忽略 prerelease）
func (a *App) CheckUpdate() (*UpdateInfo, error) {
	client := &http.Client{Timeout: 10 * time.Second}

	// 获取所有 releases
	resp, err := client.Get(githubRepoReleasesAPI)
	if err != nil {
		return &UpdateInfo{
			HasUpdate:      false,
			CurrentVersion: Version,
		}, nil
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return &UpdateInfo{
			HasUpdate:      false,
			CurrentVersion: Version,
		}, nil
	}

	var releases []struct {
		TagName    string `json:"tag_name"`
		HTMLURL    string `json:"html_url"`
		Prerelease bool   `json:"prerelease"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&releases); err != nil {
		return &UpdateInfo{
			HasUpdate:      false,
			CurrentVersion: Version,
		}, nil
	}

	// 解析当前版本
	currentVersion, err := parseVersion(Version)
	if err != nil {
		return &UpdateInfo{
			HasUpdate:      false,
			CurrentVersion: Version,
		}, nil
	}

	// 找到最新的稳定版本
	var latestStable *semver.Version
	var latestReleaseURL string

	for _, release := range releases {
		// 跳过预发布版本
		if release.Prerelease {
			continue
		}

		version, err := parseVersion(release.TagName)
		if err != nil {
			continue
		}

		if latestStable == nil || version.GreaterThan(latestStable) {
			latestStable = version
			latestReleaseURL = release.HTMLURL
		}
	}

	if latestStable == nil {
		// 没有找到稳定版本
		return &UpdateInfo{
			HasUpdate:      false,
			CurrentVersion: Version,
		}, nil
	}

	hasUpdate := latestStable.GreaterThan(currentVersion)

	return &UpdateInfo{
		HasUpdate:      hasUpdate,
		LatestVersion:  "v" + latestStable.String(),
		CurrentVersion: Version,
		ReleaseURL:     latestReleaseURL,
	}, nil
}

// parseVersion 解析版本号，支持带 v 前缀的版本
func parseVersion(versionStr string) (*semver.Version, error) {
	// 去掉 v 前缀
	cleanVersion := strings.TrimPrefix(versionStr, "v")
	return semver.NewVersion(cleanVersion)
}

// OpenURL 在默认浏览器中打开 URL
func (a *App) OpenURL(url string) {
	runtime.BrowserOpenURL(a.ctx, url)
}
