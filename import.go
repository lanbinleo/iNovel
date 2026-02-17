package main

import (
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

type Novel struct {
	ID        string    `json:"id"`
	Title     string    `json:"title"`
	Summary   string    `json:"summary"`
	MetaJSON  string    `json:"meta_json"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (a *App) ImportNovelFromDialog() (*Novel, error) {
	filePath, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "导入小说文件",
		Filters: []runtime.FileFilter{
			{
				DisplayName: "文本/Markdown (*.txt;*.md)",
				Pattern:     "*.txt;*.md",
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
		return nil, nil
	}
	return a.ImportNovelFromPath(filePath)
}

func (a *App) ImportNovelFromPath(path string) (*Novel, error) {
	db, err := a.ensureDB()
	if err != nil {
		return nil, err
	}

	contentBytes, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	content := normalizeNewlines(string(contentBytes))

	novelTitle := strings.TrimSuffix(filepath.Base(path), filepath.Ext(path))
	if strings.TrimSpace(novelTitle) == "" {
		novelTitle = "未命名小说"
	}

	chapterTitle, body := extractChapterTitleAndBody(content)
	paragraphs := splitParagraphs(body)
	if len(paragraphs) == 0 {
		paragraphs = []string{""}
	}

	now := time.Now().UTC()
	nowStr := now.Format(time.RFC3339)
	novelID := uuid.NewString()
	chapterID := uuid.NewString()

	tx, err := db.Begin()
	if err != nil {
		return nil, err
	}

	_, err = tx.Exec(
		`INSERT INTO novels (id, title, summary, meta_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?);`,
		novelID, novelTitle, "", "{}", nowStr, nowStr,
	)
	if err != nil {
		tx.Rollback()
		return nil, err
	}

	_, err = tx.Exec(
		`INSERT INTO chapters (id, novel_id, volume_id, title, outline, order_key, created_at, updated_at)
		 VALUES (?, ?, NULL, ?, '', ?, ?, ?);`,
		chapterID, novelID, chapterTitle, 1000, nowStr, nowStr,
	)
	if err != nil {
		tx.Rollback()
		return nil, err
	}

	orderKey := 1000
	for _, p := range paragraphs {
		if strings.TrimSpace(p) == "" && len(paragraphs) > 1 {
			continue
		}
		_, err = tx.Exec(
			`INSERT INTO paragraphs (id, chapter_id, order_key, content, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?);`,
			uuid.NewString(), chapterID, orderKey, p, nowStr, nowStr,
		)
		if err != nil {
			tx.Rollback()
			return nil, err
		}
		orderKey += 1000
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return &Novel{
		ID:        novelID,
		Title:     novelTitle,
		Summary:   "",
		MetaJSON:  "{}",
		CreatedAt: now,
		UpdatedAt: now,
	}, nil
}

func normalizeNewlines(s string) string {
	s = strings.ReplaceAll(s, "\r\n", "\n")
	return strings.ReplaceAll(s, "\r", "\n")
}

func extractChapterTitleAndBody(content string) (string, string) {
	lines := splitLines(content)
	titleIndex := -1
	for i, line := range lines {
		if strings.TrimSpace(line) != "" {
			titleIndex = i
			break
		}
	}

	if titleIndex == -1 {
		return "第1章", ""
	}

	rawTitle := strings.TrimSpace(lines[titleIndex])
	rawTitle = strings.TrimLeft(rawTitle, "#")
	rawTitle = strings.TrimSpace(rawTitle)
	if rawTitle == "" {
		rawTitle = "第1章"
	}

	if titleIndex+1 >= len(lines) {
		return rawTitle, ""
	}

	body := strings.Join(lines[titleIndex+1:], "\n")
	return rawTitle, body
}

func splitParagraphs(content string) []string {
	lines := splitLines(content)
	var paragraphs []string
	var buf []string

	flush := func() {
		if len(buf) == 0 {
			return
		}
		paragraphs = append(paragraphs, strings.Join(buf, "\n"))
		buf = nil
	}

	for _, line := range lines {
		if strings.TrimSpace(line) == "" {
			flush()
			continue
		}
		buf = append(buf, line)
	}
	flush()

	return paragraphs
}
