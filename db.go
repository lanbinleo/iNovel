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

	if version < 1 {
		tx, err := db.Begin()
		if err != nil {
			return err
		}

		statements := []string{
			`CREATE TABLE IF NOT EXISTS app_config (
				id INTEGER PRIMARY KEY CHECK (id = 1),
				theme TEXT NOT NULL DEFAULT 'notion-dark',
				theme_family TEXT NOT NULL DEFAULT 'notion',
				theme_mode TEXT NOT NULL DEFAULT 'dark',
				editor_width TEXT NOT NULL DEFAULT 'medium',
				editor_width_narrow INTEGER NOT NULL DEFAULT 580,
				editor_width_medium INTEGER NOT NULL DEFAULT 720,
				editor_width_wide INTEGER NOT NULL DEFAULT 980,
				editor_font TEXT NOT NULL DEFAULT 'serif',
				font_size TEXT NOT NULL DEFAULT 'medium',
				font_size_small INTEGER NOT NULL DEFAULT 16,
				font_size_medium INTEGER NOT NULL DEFAULT 18,
				font_size_large INTEGER NOT NULL DEFAULT 20,
				last_workspace TEXT NOT NULL DEFAULT ''
			);`,
			`INSERT OR IGNORE INTO app_config (id, theme, theme_family, theme_mode, editor_width, editor_width_narrow, editor_width_medium, editor_width_wide, editor_font, font_size, font_size_small, font_size_medium, font_size_large, last_workspace) VALUES (1, 'notion-dark', 'notion', 'dark', 'medium', 580, 720, 980, 'serif', 'medium', 16, 18, 20, '');`,
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
		version = 1
	}

	if version < 2 {
		if err := migrateAppConfigV2(db); err != nil {
			return err
		}
		if _, err := db.Exec(`PRAGMA user_version = 2;`); err != nil {
			return err
		}
		version = 2
	}

	if version < 3 {
		if err := migrateAppConfigV3(db); err != nil {
			return err
		}
		if _, err := db.Exec(`PRAGMA user_version = 3;`); err != nil {
			return err
		}
	}

	return nil
}

func migrateAppConfigV2(db *sql.DB) error {
	columns := map[string]bool{}
	rows, err := db.Query(`PRAGMA table_info(app_config);`)
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var cid int
		var name string
		var columnType string
		var notNull int
		var defaultValue sql.NullString
		var pk int
		if err := rows.Scan(&cid, &name, &columnType, &notNull, &defaultValue, &pk); err != nil {
			return err
		}
		columns[name] = true
	}

	addColumn := func(name string, definition string) error {
		if columns[name] {
			return nil
		}
		_, err := db.Exec(`ALTER TABLE app_config ADD COLUMN ` + definition + `;`)
		return err
	}

	if err := addColumn("theme_family", `theme_family TEXT NOT NULL DEFAULT 'notion'`); err != nil {
		return err
	}
	if err := addColumn("theme_mode", `theme_mode TEXT NOT NULL DEFAULT 'dark'`); err != nil {
		return err
	}
	if err := addColumn("font_size", `font_size TEXT NOT NULL DEFAULT 'medium'`); err != nil {
		return err
	}
	if err := addColumn("font_size_small", `font_size_small INTEGER NOT NULL DEFAULT 16`); err != nil {
		return err
	}
	if err := addColumn("font_size_medium", `font_size_medium INTEGER NOT NULL DEFAULT 18`); err != nil {
		return err
	}
	if err := addColumn("font_size_large", `font_size_large INTEGER NOT NULL DEFAULT 20`); err != nil {
		return err
	}

	_, err = db.Exec(`
		UPDATE app_config
		SET
			theme = CASE
				WHEN theme = 'light' THEN 'notion-light'
				WHEN theme = 'dark' THEN 'notion-dark'
				WHEN theme = '' THEN 'notion-dark'
				ELSE theme
			END,
			theme_family = CASE
				WHEN theme IN ('light', 'dark', '') THEN 'notion'
				WHEN substr(theme, -6) = '-light' THEN substr(theme, 1, length(theme) - 6)
				WHEN substr(theme, -5) = '-dark' THEN substr(theme, 1, length(theme) - 5)
				ELSE theme_family
			END,
			theme_mode = CASE
				WHEN theme = 'light' THEN 'light'
				WHEN theme = 'dark' THEN 'dark'
				WHEN theme = '' THEN 'dark'
				WHEN substr(theme, -5) = 'light' THEN 'light'
				WHEN substr(theme, -4) = 'dark' THEN 'dark'
				ELSE theme_mode
			END
		WHERE id = 1;
	`)
	return err
}

func migrateAppConfigV3(db *sql.DB) error {
	return addAppConfigColumns(db, map[string]string{
		"editor_width_narrow": `editor_width_narrow INTEGER NOT NULL DEFAULT 580`,
		"editor_width_medium": `editor_width_medium INTEGER NOT NULL DEFAULT 720`,
		"editor_width_wide":   `editor_width_wide INTEGER NOT NULL DEFAULT 980`,
		"editor_font":         `editor_font TEXT NOT NULL DEFAULT 'serif'`,
	})
}

func addAppConfigColumns(db *sql.DB, definitions map[string]string) error {
	columns := map[string]bool{}
	rows, err := db.Query(`PRAGMA table_info(app_config);`)
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var cid int
		var name string
		var columnType string
		var notNull int
		var defaultValue sql.NullString
		var pk int
		if err := rows.Scan(&cid, &name, &columnType, &notNull, &defaultValue, &pk); err != nil {
			return err
		}
		columns[name] = true
	}

	for name, definition := range definitions {
		if columns[name] {
			continue
		}
		if _, err := db.Exec(`ALTER TABLE app_config ADD COLUMN ` + definition + `;`); err != nil {
			return err
		}
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
		normalizeConfig(&legacy)
		_, err = db.Exec(
			`INSERT INTO app_config (id, theme, theme_family, theme_mode, editor_width, editor_width_narrow, editor_width_medium, editor_width_wide, editor_font, font_size, font_size_small, font_size_medium, font_size_large, last_workspace) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
			legacy.Theme, legacy.ThemeFamily, legacy.ThemeMode, legacy.EditorWidth, legacy.EditorWidthNarrow, legacy.EditorWidthMedium, legacy.EditorWidthWide, legacy.EditorFont, legacy.FontSize, legacy.FontSizeSmall, legacy.FontSizeMedium, legacy.FontSizeLarge, legacy.LastWorkspace,
		)
		if err != nil {
			return err
		}
	} else {
		normalizeConfig(&legacy)
		_, _ = db.Exec(
			`UPDATE app_config SET theme = ?, theme_family = ?, theme_mode = ?, editor_width = ?, editor_width_narrow = ?, editor_width_medium = ?, editor_width_wide = ?, editor_font = ?, font_size = ?, font_size_small = ?, font_size_medium = ?, font_size_large = ?, last_workspace = ? WHERE id = 1;`,
			legacy.Theme, legacy.ThemeFamily, legacy.ThemeMode, legacy.EditorWidth, legacy.EditorWidthNarrow, legacy.EditorWidthMedium, legacy.EditorWidthWide, legacy.EditorFont, legacy.FontSize, legacy.FontSizeSmall, legacy.FontSizeMedium, legacy.FontSizeLarge, legacy.LastWorkspace,
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
