package main

import "errors"

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
	return []AIProvider{}, nil
}

func (a *App) UpsertAIProvider(provider AIProvider) (AIProvider, error) {
	return AIProvider{}, errors.New("AI 功能已禁用")
}

func (a *App) DeleteAIProvider(id string) error {
	return errors.New("AI 功能已禁用")
}

func (a *App) SetDefaultAIProvider(id string) error {
	return errors.New("AI 功能已禁用")
}

func (a *App) GetDefaultAIProvider() (*AIProvider, error) {
	return nil, nil
}
