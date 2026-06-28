package model

import (
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupHermesExecutionTaskTestDB(t *testing.T) {
	t.Helper()

	originalDB := DB
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&HermesExecutionTask{}))
	DB = db

	t.Cleanup(func() {
		DB = originalDB
	})
}

func TestHermesExecutionTaskLifecycle(t *testing.T) {
	setupHermesExecutionTaskTestDB(t)

	task := &HermesExecutionTask{
		TaskId:         "hermes_test_1",
		UserId:         7,
		Title:          " Generate a report ",
		Status:         HermesExecutionTaskStatusQueued,
		RequestPayload: `{"stream":false}`,
	}
	require.NoError(t, CreateHermesExecutionTask(task))

	saved, err := GetHermesExecutionTaskByTaskID("hermes_test_1")
	require.NoError(t, err)
	require.NotNil(t, saved)
	assert.Equal(t, "Generate a report", saved.Title)
	assert.Equal(t, HermesExecutionTaskStatusQueued, saved.Status)

	require.NoError(t, UpdateHermesExecutionTaskStatus("hermes_test_1", HermesExecutionTaskStatusRunning, 35, ""))
	running, err := GetHermesExecutionTaskByTaskID("hermes_test_1")
	require.NoError(t, err)
	require.NotNil(t, running)
	assert.Equal(t, HermesExecutionTaskStatusRunning, running.Status)
	assert.Equal(t, 35, running.Progress)
	assert.NotZero(t, running.StartedAt)

	require.NoError(t, CompleteHermesExecutionTask("hermes_test_1", `{"choices":[{"message":{"content":"done"}}]}`))
	completed, err := GetHermesExecutionTaskByTaskID("hermes_test_1")
	require.NoError(t, err)
	require.NotNil(t, completed)
	assert.Equal(t, HermesExecutionTaskStatusSucceeded, completed.Status)
	assert.Equal(t, 100, completed.Progress)
	assert.NotZero(t, completed.FinishedAt)
	assert.Equal(t, "done", completed.ToResponse(true).ResponsePayload.(map[string]any)["choices"].([]any)[0].(map[string]any)["message"].(map[string]any)["content"])
}

func TestListHermesExecutionTasksScopesPersonalAndTeamTasks(t *testing.T) {
	setupHermesExecutionTaskTestDB(t)

	tasks := []HermesExecutionTask{
		{TaskId: "personal-user-7", UserId: 7, Title: "personal", Status: HermesExecutionTaskStatusSucceeded},
		{TaskId: "team-4-user-7", UserId: 7, TeamId: 4, Title: "team 4", Status: HermesExecutionTaskStatusSucceeded},
		{TaskId: "team-4-user-8", UserId: 8, TeamId: 4, Title: "team 4 other", Status: HermesExecutionTaskStatusSucceeded},
		{TaskId: "personal-user-8", UserId: 8, Title: "other", Status: HermesExecutionTaskStatusSucceeded},
	}
	require.NoError(t, DB.Create(&tasks).Error)

	personal, err := ListHermesExecutionTasks(7, 0, 50)
	require.NoError(t, err)
	require.Len(t, personal, 1)
	assert.Equal(t, "personal-user-7", personal[0].TaskId)

	team, err := ListHermesExecutionTasks(7, 4, 50)
	require.NoError(t, err)
	require.Len(t, team, 2)
	assert.ElementsMatch(t, []string{"team-4-user-7", "team-4-user-8"}, []string{team[0].TaskId, team[1].TaskId})
}
