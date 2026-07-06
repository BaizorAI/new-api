package model_setting

import "github.com/BaizorAI/new-api/setting/config"

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
}

var defaultCliDefaultModelSettings = CliDefaultModelSettings{
	Model:       "huazhen-v1",
	HaikuModel:  "huazhen-v1",
	SonnetModel: "huazhen-fable-5",
	OpusModel:   "huazhen-fable-5",

	CodexModel:           "",
	CodexFullAuto:        true,
	CodexReasoningEffort: "medium",

	ClaudeModel:          "",
	ClaudeMaxTurns:       0,
	ClaudePermissionMode: "bypassPermissions",
}

var cliDefaultModelSettings = defaultCliDefaultModelSettings

func init() {
	config.GlobalConfig.Register("cli_default_model", &cliDefaultModelSettings)
}

// GetCliDefaultModelSettings returns the CLI default model settings.
func GetCliDefaultModelSettings() *CliDefaultModelSettings {
	return &cliDefaultModelSettings
}
