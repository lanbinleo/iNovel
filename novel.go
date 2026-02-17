package main

import (
	"strings"
	"time"

	"github.com/google/uuid"
)

type NovelSummary struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	Summary   string `json:"summary"`
	UpdatedAt string `json:"updated_at"`
}

type ChapterSummary struct {
	ID       string `json:"id"`
	Title    string `json:"title"`
	Outline  string `json:"outline"`
	OrderKey int    `json:"order_key"`
}

type ChapterContent struct {
	ID      string `json:"id"`
	Title   string `json:"title"`
	Outline string `json:"outline"`
	Content string `json:"content"`
}

func (a *App) ListNovels() ([]NovelSummary, error) {
	db, err := a.ensureDB()
	if err != nil {
		return []NovelSummary{}, nil
	}

	rows, err := db.Query(`SELECT id, title, summary, updated_at FROM novels ORDER BY updated_at DESC;`)
	if err != nil {
		return []NovelSummary{}, nil
	}
	defer rows.Close()

	var novels []NovelSummary
	for rows.Next() {
		var n NovelSummary
		var updatedAtStr string
		if err := rows.Scan(&n.ID, &n.Title, &n.Summary, &updatedAtStr); err != nil {
			continue
		}
		n.UpdatedAt = updatedAtStr
		novels = append(novels, n)
	}

	return novels, nil
}

func (a *App) CreateNovel(title string) (*NovelSummary, error) {
	db, err := a.ensureDB()
	if err != nil {
		return nil, err
	}

	trimmed := strings.TrimSpace(title)
	if trimmed == "" {
		trimmed = "未命名小说"
	}

	nowStr := time.Now().UTC().Format(time.RFC3339)
	novelID := uuid.NewString()

	tx, err := db.Begin()
	if err != nil {
		return nil, err
	}

	_, err = tx.Exec(
		`INSERT INTO novels (id, title, summary, meta_json, created_at, updated_at) VALUES (?, ?, '', '{}', ?, ?);`,
		novelID, trimmed, nowStr, nowStr,
	)
	if err != nil {
		tx.Rollback()
		return nil, err
	}

	chapterID := uuid.NewString()
	_, err = tx.Exec(
		`INSERT INTO chapters (id, novel_id, volume_id, title, outline, order_key, created_at, updated_at)
		 VALUES (?, ?, NULL, ?, '', ?, ?, ?);`,
		chapterID, novelID, "第1章", 1000, nowStr, nowStr,
	)
	if err != nil {
		tx.Rollback()
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return &NovelSummary{
		ID:        novelID,
		Title:     trimmed,
		Summary:   "",
		UpdatedAt: nowStr,
	}, nil
}

func (a *App) UpdateNovel(novelID string, title string, summary string) (*NovelSummary, error) {
	db, err := a.ensureDB()
	if err != nil {
		return nil, err
	}

	trimmed := strings.TrimSpace(title)
	if trimmed == "" {
		trimmed = "未命名小说"
	}
	trimmedSummary := strings.TrimSpace(summary)

	nowStr := time.Now().UTC().Format(time.RFC3339)
	_, err = db.Exec(
		`UPDATE novels SET title = ?, summary = ?, updated_at = ? WHERE id = ?;`,
		trimmed, trimmedSummary, nowStr, novelID,
	)
	if err != nil {
		return nil, err
	}

	return &NovelSummary{
		ID:        novelID,
		Title:     trimmed,
		Summary:   trimmedSummary,
		UpdatedAt: nowStr,
	}, nil
}

func (a *App) DeleteNovel(novelID string) error {
	db, err := a.ensureDB()
	if err != nil {
		return err
	}

	_, err = db.Exec(`DELETE FROM novels WHERE id = ?;`, novelID)
	return err
}

func (a *App) ListChapters(novelID string) ([]ChapterSummary, error) {
	db, err := a.ensureDB()
	if err != nil {
		return []ChapterSummary{}, nil
	}

	rows, err := db.Query(`
		SELECT id, title, outline, order_key
		FROM chapters
		WHERE novel_id = ?
		ORDER BY order_key ASC;
	`, novelID)
	if err != nil {
		return []ChapterSummary{}, nil
	}
	defer rows.Close()

	var chapters []ChapterSummary
	for rows.Next() {
		var c ChapterSummary
		if err := rows.Scan(&c.ID, &c.Title, &c.Outline, &c.OrderKey); err != nil {
			continue
		}
		chapters = append(chapters, c)
	}

	return chapters, nil
}

func (a *App) CreateChapter(novelID string, title string) (*ChapterSummary, error) {
	db, err := a.ensureDB()
	if err != nil {
		return nil, err
	}

	trimmed := strings.TrimSpace(title)
	if trimmed == "" {
		trimmed = "未命名章节"
	}

	var maxOrder int
	_ = db.QueryRow(`SELECT COALESCE(MAX(order_key), 0) FROM chapters WHERE novel_id = ?;`, novelID).Scan(&maxOrder)
	orderKey := 1000
	if maxOrder > 0 {
		orderKey = maxOrder + 1000
	}

	nowStr := time.Now().UTC().Format(time.RFC3339)
	chapterID := uuid.NewString()
	_, err = db.Exec(
		`INSERT INTO chapters (id, novel_id, volume_id, title, outline, order_key, created_at, updated_at)
		 VALUES (?, ?, NULL, ?, '', ?, ?, ?);`,
		chapterID, novelID, trimmed, orderKey, nowStr, nowStr,
	)
	if err != nil {
		return nil, err
	}

	_, _ = db.Exec(`UPDATE novels SET updated_at = ? WHERE id = ?;`, nowStr, novelID)

	return &ChapterSummary{
		ID:       chapterID,
		Title:    trimmed,
		Outline:  "",
		OrderKey: orderKey,
	}, nil
}

func (a *App) DeleteChapter(chapterID string) error {
	db, err := a.ensureDB()
	if err != nil {
		return err
	}

	nowStr := time.Now().UTC().Format(time.RFC3339)
	tx, err := db.Begin()
	if err != nil {
		return err
	}

	var novelID string
	if err := tx.QueryRow(`SELECT novel_id FROM chapters WHERE id = ?;`, chapterID).Scan(&novelID); err != nil {
		tx.Rollback()
		return err
	}

	if _, err := tx.Exec(`DELETE FROM chapters WHERE id = ?;`, chapterID); err != nil {
		tx.Rollback()
		return err
	}

	_, _ = tx.Exec(`UPDATE novels SET updated_at = ? WHERE id = ?;`, nowStr, novelID)

	return tx.Commit()
}

func (a *App) GetChapterContent(chapterID string) (*ChapterContent, error) {
	db, err := a.ensureDB()
	if err != nil {
		return nil, err
	}

	var title string
	var outline string
	if err := db.QueryRow(`SELECT title, outline FROM chapters WHERE id = ?;`, chapterID).Scan(&title, &outline); err != nil {
		return nil, err
	}

	rows, err := db.Query(`
		SELECT content FROM paragraphs
		WHERE chapter_id = ?
		ORDER BY order_key ASC;
	`, chapterID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var paragraphs []string
	for rows.Next() {
		var content string
		if err := rows.Scan(&content); err != nil {
			continue
		}
		paragraphs = append(paragraphs, content)
	}

	content := strings.Join(paragraphs, "\n\n")

	return &ChapterContent{
		ID:      chapterID,
		Title:   title,
		Outline: outline,
		Content: content,
	}, nil
}

func (a *App) SaveChapterContent(chapterID string, title string, outline string, content string) error {
	db, err := a.ensureDB()
	if err != nil {
		return err
	}

	trimmedTitle := strings.TrimSpace(title)
	if trimmedTitle == "" {
		trimmedTitle = "未命名章节"
	}

	normalized := normalizeNewlines(content)
	paragraphs := splitParagraphs(normalized)
	if len(paragraphs) == 0 {
		paragraphs = []string{""}
	}

	nowStr := time.Now().UTC().Format(time.RFC3339)

	tx, err := db.Begin()
	if err != nil {
		return err
	}

	var novelID string
	if err := tx.QueryRow(`SELECT novel_id FROM chapters WHERE id = ?;`, chapterID).Scan(&novelID); err != nil {
		tx.Rollback()
		return err
	}

	_, err = tx.Exec(`UPDATE chapters SET title = ?, outline = ?, updated_at = ? WHERE id = ?;`, trimmedTitle, outline, nowStr, chapterID)
	if err != nil {
		tx.Rollback()
		return err
	}

	if _, err := tx.Exec(`DELETE FROM paragraphs WHERE chapter_id = ?;`, chapterID); err != nil {
		tx.Rollback()
		return err
	}

	orderKey := 1000
	for _, p := range paragraphs {
		if strings.TrimSpace(p) == "" && len(paragraphs) > 1 {
			continue
		}
		_, err := tx.Exec(
			`INSERT INTO paragraphs (id, chapter_id, order_key, content, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?);`,
			uuid.NewString(), chapterID, orderKey, p, nowStr, nowStr,
		)
		if err != nil {
			tx.Rollback()
			return err
		}
		orderKey += 1000
	}

	_, _ = tx.Exec(`UPDATE novels SET updated_at = ? WHERE id = ?;`, nowStr, novelID)

	return tx.Commit()
}
