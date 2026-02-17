package main

import (
	"database/sql"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
	_ "modernc.org/sqlite"
)

func getDataDir() (string, error) {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}

	dataDir := filepath.Join(homeDir, ".inovel")
	if err := os.MkdirAll(dataDir, 0755); err != nil {
		return "", err
	}

	return dataDir, nil
}

func getDatabasePath() (string, error) {
	dataDir, err := getDataDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dataDir, "library.db"), nil
}

func (a *App) initDatabase() error {
	if a.db != nil {
		return nil
	}

	dbPath, err := getDatabasePath()
	if err != nil {
		return err
	}

	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return err
	}
	db.SetMaxOpenConns(1)

	if err := applyMigrations(db); err != nil {
		db.Close()
		return err
	}

	if err := a.migrateLegacyConfig(db); err != nil && a.ctx != nil {
		runtime.LogError(a.ctx, "config migrate failed: "+err.Error())
	}

	a.db = db
	return nil
}

func (a *App) ensureDB() (*sql.DB, error) {
	if a.db != nil {
		return a.db, nil
	}
	if err := a.initDatabase(); err != nil {
		return nil, err
	}
	return a.db, nil
}

func applyMigrations(db *sql.DB) error {
	if _, err := db.Exec(`PRAGMA journal_mode=WAL;`); err != nil {
		return err
	}
	if _, err := db.Exec(`PRAGMA foreign_keys=ON;`); err != nil {
		return err
	}
	if _, err := db.Exec(`PRAGMA busy_timeout=5000;`); err != nil {
		return err
	}

	var version int
	if err := db.QueryRow(`PRAGMA user_version;`).Scan(&version); err != nil {
		return err
	}

	if version >= 1 {
		return nil
	}

	tx, err := db.Begin()
	if err != nil {
		return err
	}

	statements := []string{
		`CREATE TABLE IF NOT EXISTS app_config (
			id INTEGER PRIMARY KEY CHECK (id = 1),
			theme TEXT NOT NULL DEFAULT 'light',
			editor_width TEXT NOT NULL DEFAULT 'medium',
			last_workspace TEXT NOT NULL DEFAULT ''
		);`,
		`INSERT OR IGNORE INTO app_config (id, theme, editor_width, last_workspace) VALUES (1, 'light', 'medium', '');`,
		`CREATE TABLE IF NOT EXISTS recent_files (
			path TEXT PRIMARY KEY,
			title TEXT NOT NULL,
			updated_at TEXT NOT NULL
		);`,
		`CREATE TABLE IF NOT EXISTS novels (
			id TEXT PRIMARY KEY,
			title TEXT NOT NULL,
			summary TEXT NOT NULL DEFAULT '',
			meta_json TEXT NOT NULL DEFAULT '{}',
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL
		);`,
		`CREATE TABLE IF NOT EXISTS volumes (
			id TEXT PRIMARY KEY,
			novel_id TEXT NOT NULL,
			title TEXT NOT NULL,
			order_key INTEGER NOT NULL,
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL,
			FOREIGN KEY (novel_id) REFERENCES novels(id) ON DELETE CASCADE
		);`,
		`CREATE TABLE IF NOT EXISTS chapters (
			id TEXT PRIMARY KEY,
			novel_id TEXT NOT NULL,
			volume_id TEXT,
			title TEXT NOT NULL,
			outline TEXT NOT NULL DEFAULT '',
			order_key INTEGER NOT NULL,
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL,
			FOREIGN KEY (novel_id) REFERENCES novels(id) ON DELETE CASCADE,
			FOREIGN KEY (volume_id) REFERENCES volumes(id) ON DELETE SET NULL
		);`,
		`CREATE TABLE IF NOT EXISTS paragraphs (
			id TEXT PRIMARY KEY,
			chapter_id TEXT NOT NULL,
			order_key INTEGER NOT NULL,
			content TEXT NOT NULL,
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL,
			FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
		);`,
		`CREATE INDEX IF NOT EXISTS idx_paragraphs_chapter_order ON paragraphs(chapter_id, order_key);`,
		`CREATE TABLE IF NOT EXISTS ai_providers (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			provider TEXT NOT NULL,
			base_url TEXT NOT NULL DEFAULT '',
			api_key TEXT NOT NULL DEFAULT '',
			model TEXT NOT NULL DEFAULT '',
			is_default INTEGER NOT NULL DEFAULT 0,
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL
		);`,
	}

	for _, stmt := range statements {
		if _, err := tx.Exec(stmt); err != nil {
			tx.Rollback()
			return err
		}
	}

	if _, err := tx.Exec(`PRAGMA user_version = 1;`); err != nil {
		tx.Rollback()
		return err
	}

	if err := tx.Commit(); err != nil {
		return err
	}

	return nil
}

func (a *App) migrateLegacyConfig(db *sql.DB) error {
	configPath, err := a.getConfigPath()
	if err != nil {
		return err
	}
	data, err := os.ReadFile(configPath)
	if err != nil {
		return nil
	}

	var legacy Config
	if err := json.Unmarshal(data, &legacy); err != nil {
		return nil
	}

	var count int
	if err := db.QueryRow(`SELECT COUNT(1) FROM app_config WHERE id = 1;`).Scan(&count); err != nil {
		return err
	}

	if count == 0 {
		_, err = db.Exec(
			`INSERT INTO app_config (id, theme, editor_width, last_workspace) VALUES (1, ?, ?, ?);`,
			legacy.Theme, legacy.EditorWidth, legacy.LastWorkspace,
		)
		if err != nil {
			return err
		}
	} else {
		_, _ = db.Exec(
			`UPDATE app_config SET theme = ?, editor_width = ?, last_workspace = ? WHERE id = 1;`,
			legacy.Theme, legacy.EditorWidth, legacy.LastWorkspace,
		)
	}

	if len(legacy.RecentFiles) > 0 {
		tx, err := db.Begin()
		if err != nil {
			return err
		}
		for _, rf := range legacy.RecentFiles {
			updatedAtStr := strings.TrimSpace(rf.UpdatedAt)
			if updatedAtStr == "" {
				updatedAtStr = time.Now().UTC().Format(time.RFC3339)
			}
			_, err := tx.Exec(
				`INSERT OR REPLACE INTO recent_files (path, title, updated_at) VALUES (?, ?, ?);`,
				rf.Path, rf.Title, updatedAtStr,
			)
			if err != nil {
				tx.Rollback()
				return err
			}
		}
		if err := tx.Commit(); err != nil {
			return err
		}
	}

	return nil
}
