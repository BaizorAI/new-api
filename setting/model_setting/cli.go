package model_setting

import "github.com/BaizorAI/new-api/setting/config"

// CliModelInfo holds the context and output token limits for a single model.
// Returned to the CLI on login so it can populate tool config files (e.g. codex
// config.toml [model_info] sections) without hard-coding model metadata.
type CliModelInfo struct {
	ContextWindow   int `json:"context_window"`
	MaxOutputTokens int `json:"max_output_tokens"`
}

// CliDefaultModelSettings defines which models and tool parameters the CLI
// should use by default. All fields are returned to the CLI on login.
type CliDefaultModelSettings struct {
	// Shared default model (used by both tools when their specific model is not set)
	Model string `json:"model"`

	// Legacy tier aliases kept for backward compatibility
	HaikuModel  string `json:"haiku_model"`
	SonnetModel string `json:"sonnet_model"`
	OpusModel   string `json:"opus_model"`

	// ── Codex parameters ──────────────────────────────────────────────────────
	// Model for codex (overrides Model when non-empty)
	CodexModel string `json:"codex_model"`
	// full_auto: run without interactive approval prompts ("full-auto" mode)
	CodexFullAuto bool `json:"codex_full_auto"`
	// reasoning_effort: "low" | "medium" | "high" — maps to -c reasoning_effort=...
	CodexReasoningEffort string `json:"codex_reasoning_effort"`

	// ── Claude parameters ─────────────────────────────────────────────────────
	// Model for claude (overrides Model when non-empty)
	ClaudeModel string `json:"claude_model"`
	// max_turns: maximum agentic turns before stopping (0 = unlimited)
	ClaudeMaxTurns int `json:"claude_max_turns"`
	// permission_mode: "default" | "acceptEdits" | "bypassPermissions"
	ClaudePermissionMode string `json:"claude_permission_mode"`

	// ── Model metadata ─────────────────────────────────────────────────────────
	// ModelInfo maps model names to their context/output token limits.
	// The CLI uses this to populate tool config files (e.g. codex [model_info]).
	// Keys are the model name as used by the tool (e.g. "huayu-v2").
	ModelInfo map[string]CliModelInfo `json:"model_info"`
}

var defaultCliDefaultModelSettings = CliDefaultModelSettings{
	Model:       "huayu-v2",
	HaikuModel:  "huayu-v2",
	SonnetModel: "huayu-v2",
	OpusModel:   "huayu-v2-max",

	CodexModel:           "",
	CodexFullAuto:        true,
	CodexReasoningEffort: "medium",

	ClaudeModel:          "",
	ClaudeMaxTurns:       0,
	ClaudePermissionMode: "bypassPermissions",

	ModelInfo: map[string]CliModelInfo{
		"huayu-v2":       {ContextWindow: 128000, MaxOutputTokens: 16384},
		"huayu-v2-max":   {ContextWindow: 128000, MaxOutputTokens: 16384},
		"huayu-v2-flash": {ContextWindow: 32768, MaxOutputTokens: 8192},
	},
}

var cliDefaultModelSettings = defaultCliDefaultModelSettings

func init() {
	config.GlobalConfig.Register("cli_default_model", &cliDefaultModelSettings)
}

// GetCliDefaultModelSettings returns the CLI default model settings.
func GetCliDefaultModelSettings() *CliDefaultModelSettings {
	return &cliDefaultModelSettings
}
