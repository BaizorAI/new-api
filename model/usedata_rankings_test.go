package model

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestGetRankingLogTotalsUsesConsumeLogs(t *testing.T) {
	truncateTables(t)

	require.NoError(t, DB.Create(&QuotaData{
		ModelName: "gpt-5.5",
		CreatedAt: 1000,
		TokenUsed: 999,
	}).Error)
	require.NoError(t, LOG_DB.Create(&Log{
		Type:             LogTypeConsume,
		ModelName:        "gpt-5.5",
		CreatedAt:        1000,
		PromptTokens:     10,
		CompletionTokens: 5,
	}).Error)
	require.NoError(t, LOG_DB.Create(&Log{
		Type:             LogTypeConsume,
		ModelName:        "gpt-5.5",
		CreatedAt:        1100,
		PromptTokens:     20,
		CompletionTokens: 1,
	}).Error)
	require.NoError(t, LOG_DB.Create(&Log{
		Type:             LogTypeConsume,
		ModelName:        "claude",
		CreatedAt:        1200,
		PromptTokens:     7,
		CompletionTokens: 3,
	}).Error)
	require.NoError(t, LOG_DB.Create(&Log{
		Type:             LogTypeManage,
		ModelName:        "gpt-5.5",
		CreatedAt:        1300,
		PromptTokens:     100,
		CompletionTokens: 100,
	}).Error)

	rows, err := GetRankingLogTotals(900, 2000)
	require.NoError(t, err)
	require.Equal(t, []RankingQuotaTotal{
		{ModelName: "gpt-5.5", TotalTokens: 36},
		{ModelName: "claude", TotalTokens: 10},
	}, rows)
}

func TestGetRankingLogBucketsAggregatesByLogTime(t *testing.T) {
	truncateTables(t)

	require.NoError(t, LOG_DB.Create(&Log{
		Type:             LogTypeConsume,
		ModelName:        "gpt-5.5",
		CreatedAt:        1000,
		PromptTokens:     10,
		CompletionTokens: 5,
	}).Error)
	require.NoError(t, LOG_DB.Create(&Log{
		Type:             LogTypeConsume,
		ModelName:        "gpt-5.5",
		CreatedAt:        1100,
		PromptTokens:     20,
		CompletionTokens: 1,
	}).Error)
	require.NoError(t, LOG_DB.Create(&Log{
		Type:             LogTypeConsume,
		ModelName:        "gpt-5.5",
		CreatedAt:        3700,
		PromptTokens:     3,
		CompletionTokens: 4,
	}).Error)

	rows, err := GetRankingLogBuckets(900, 4000, 3600)
	require.NoError(t, err)
	require.Equal(t, []RankingQuotaBucket{
		{ModelName: "gpt-5.5", Bucket: 0, Tokens: 36},
		{ModelName: "gpt-5.5", Bucket: 3600, Tokens: 7},
	}, rows)
}
