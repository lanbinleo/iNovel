package main

import (
	"time"

	"github.com/google/uuid"
)

type AIProvider struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Provider  string `json:"provider"`
	BaseURL   string `json:"base_url"`
	APIKey    string `json:"api_key"`
	Model     string `json:"model"`
	IsDefault bool   `json:"is_default"`
}

func (a *App) ListAIProviders() ([]AIProvider, error) {
	db, err := a.ensureDB()
	if err != nil {
		return []AIProvider{}, nil
	}

	rows, err := db.Query(`
		SELECT id, name, provider, base_url, api_key, model, is_default
		FROM ai_providers
		ORDER BY is_default DESC, name ASC;
	`)
	if err != nil {
		return []AIProvider{}, nil
	}
	defer rows.Close()

	var providers []AIProvider
	for rows.Next() {
		var p AIProvider
		var isDefault int
		if err := rows.Scan(&p.ID, &p.Name, &p.Provider, &p.BaseURL, &p.APIKey, &p.Model, &isDefault); err != nil {
			continue
		}
		p.IsDefault = isDefault == 1
		providers = append(providers, p)
	}

	return providers, nil
}

func (a *App) UpsertAIProvider(provider AIProvider) (AIProvider, error) {
	db, err := a.ensureDB()
	if err != nil {
		return AIProvider{}, err
	}

	if provider.ID == "" {
		provider.ID = uuid.NewString()
	}

	now := time.Now().UTC().Format(time.RFC3339)

	tx, err := db.Begin()
	if err != nil {
		return AIProvider{}, err
	}

	if provider.IsDefault {
		if _, err := tx.Exec(`UPDATE ai_providers SET is_default = 0;`); err != nil {
			tx.Rollback()
			return AIProvider{}, err
		}
	}

	_, err = tx.Exec(`
		INSERT INTO ai_providers (id, name, provider, base_url, api_key, model, is_default, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
			name = excluded.name,
			provider = excluded.provider,
			base_url = excluded.base_url,
			api_key = excluded.api_key,
			model = excluded.model,
			is_default = excluded.is_default,
			updated_at = excluded.updated_at;
	`, provider.ID, provider.Name, provider.Provider, provider.BaseURL, provider.APIKey, provider.Model, boolToInt(provider.IsDefault), now, now)
	if err != nil {
		tx.Rollback()
		return AIProvider{}, err
	}

	if err := tx.Commit(); err != nil {
		return AIProvider{}, err
	}

	return provider, nil
}

func (a *App) DeleteAIProvider(id string) error {
	db, err := a.ensureDB()
	if err != nil {
		return err
	}
	_, err = db.Exec(`DELETE FROM ai_providers WHERE id = ?;`, id)
	return err
}

func (a *App) SetDefaultAIProvider(id string) error {
	db, err := a.ensureDB()
	if err != nil {
		return err
	}

	tx, err := db.Begin()
	if err != nil {
		return err
	}
	if _, err := tx.Exec(`UPDATE ai_providers SET is_default = 0;`); err != nil {
		tx.Rollback()
		return err
	}
	if _, err := tx.Exec(`UPDATE ai_providers SET is_default = 1 WHERE id = ?;`, id); err != nil {
		tx.Rollback()
		return err
	}
	return tx.Commit()
}

func (a *App) GetDefaultAIProvider() (*AIProvider, error) {
	db, err := a.ensureDB()
	if err != nil {
		return nil, err
	}

	row := db.QueryRow(`
		SELECT id, name, provider, base_url, api_key, model, is_default
		FROM ai_providers
		WHERE is_default = 1
		LIMIT 1;
	`)

	var p AIProvider
	var isDefault int
	if err := row.Scan(&p.ID, &p.Name, &p.Provider, &p.BaseURL, &p.APIKey, &p.Model, &isDefault); err != nil {
		return nil, nil
	}
	p.IsDefault = isDefault == 1
	return &p, nil
}

func boolToInt(v bool) int {
	if v {
		return 1
	}
	return 0
}
