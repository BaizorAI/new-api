package model

import (
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupHermesResultTestDB(t *testing.T) {
	t.Helper()

	originalDB := DB
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&HermesResult{}))
	DB = db

	t.Cleanup(func() {
		DB = originalDB
	})
}

func TestHermesResultsAreScopedByOwner(t *testing.T) {
	setupHermesResultTestDB(t)

	personal := []HermesResult{{
		Title:      "Personal report",
		FileName:   "personal-report.md",
		Href:       "/pg/hermes/files/personal-report.md",
		ResultType: HermesResultTypeReport,
		Source:     HermesResultSourceArtifact,
		CreatedBy:  7,
		UpdatedBy:  7,
	}}
	team := []HermesResult{{
		Title:      "Team deck",
		FileName:   "team-deck.pptx",
		Href:       "/pg/hermes/files/team-deck.pptx",
		ResultType: HermesResultTypePPT,
		Source:     HermesResultSourceArtifact,
		CreatedBy:  8,
		UpdatedBy:  8,
	}}

	require.NoError(t, ReplaceHermesResultsForConversation(7, 0, "conversation-1", personal))
	require.NoError(t, ReplaceHermesResultsForConversation(8, 4, "conversation-1", team))

	personalResults, err := ListHermesResults(HermesResultQuery{UserId: 7})
	require.NoError(t, err)
	require.Len(t, personalResults, 1)
	assert.Equal(t, "Personal report", personalResults[0].Title)
	assert.Equal(t, 0, personalResults[0].TeamId)

	teamResults, err := ListHermesResults(HermesResultQuery{UserId: 7, TeamId: 4})
	require.NoError(t, err)
	require.Len(t, teamResults, 1)
	assert.Equal(t, "Team deck", teamResults[0].Title)
	assert.Equal(t, 4, teamResults[0].TeamId)
	assert.NotEqual(t, personalResults[0].ResultKey, teamResults[0].ResultKey)
}

func TestListHermesResultsFiltersByTypeAndQuery(t *testing.T) {
	setupHermesResultTestDB(t)

	results := []HermesResult{
		{Title: "Quarterly report", FileName: "quarterly.md", Href: "/pg/hermes/files/quarterly.md", ResultType: HermesResultTypeReport, Source: HermesResultSourceArtifact},
		{Title: "Slides", FileName: "slides.pptx", Href: "/pg/hermes/files/slides.pptx", ResultType: HermesResultTypePPT, Source: HermesResultSourceArtifact},
		{Title: "Uploaded file", FileName: "source.csv", Href: "/pg/hermes/files/source.csv", ResultType: HermesResultTypeDocument, Source: HermesResultSourceAttachment},
	}
	require.NoError(t, ReplaceHermesResultsForConversation(7, 0, "conversation-2", results))

	reports, err := ListHermesResults(HermesResultQuery{UserId: 7, ResultType: HermesResultTypeReport})
	require.NoError(t, err)
	require.Len(t, reports, 1)
	assert.Equal(t, "Quarterly report", reports[0].Title)

	attachments, err := ListHermesResults(HermesResultQuery{UserId: 7, ResultType: HermesResultTypeAttachment})
	require.NoError(t, err)
	require.Len(t, attachments, 1)
	assert.Equal(t, HermesResultSourceAttachment, attachments[0].Source)

	queried, err := ListHermesResults(HermesResultQuery{UserId: 7, Query: "slides"})
	require.NoError(t, err)
	require.Len(t, queried, 1)
	assert.Equal(t, HermesResultTypePPT, queried[0].ResultType)
}

func TestHasAccessibleHermesResultHrefAllowsPersonalAndTeamMembers(t *testing.T) {
	setupHermesResultTestDB(t)
	require.NoError(t, DB.AutoMigrate(&Team{}, &TeamMember{}))
	require.NoError(t, DB.Create(&Team{Id: 9, Name: "team", OwnerId: 7, Status: TeamStatusEnabled}).Error)
	require.NoError(t, DB.Create(&TeamMember{TeamId: 9, UserId: 8, Role: TeamRoleMember, Status: TeamStatusEnabled}).Error)

	require.NoError(t, ReplaceHermesResultsForConversation(7, 0, "personal", []HermesResult{{
		Title:      "Personal root file",
		FileName:   "personal.md",
		Href:       "/pg/hermes/files/personal.md",
		ResultType: HermesResultTypeDocument,
		Source:     HermesResultSourceArtifact,
	}}))
	require.NoError(t, ReplaceHermesResultsForConversation(7, 9, "team", []HermesResult{{
		Title:      "Team root file",
		FileName:   "team.md",
		Href:       "/pg/hermes/files/team.md",
		ResultType: HermesResultTypeDocument,
		Source:     HermesResultSourceArtifact,
	}}))

	allowed, err := HasAccessibleHermesResultHref(7, []string{"/pg/hermes/files/personal.md"})
	require.NoError(t, err)
	assert.True(t, allowed)

	allowed, err = HasAccessibleHermesResultHref(8, []string{"/pg/hermes/files/team.md"})
	require.NoError(t, err)
	assert.True(t, allowed)

	allowed, err = HasAccessibleHermesResultHref(8, []string{"/pg/hermes/files/personal.md"})
	require.NoError(t, err)
	assert.False(t, allowed)

	allowed, err = HasAccessibleHermesResultHref(10, []string{"/pg/hermes/files/team.md"})
	require.NoError(t, err)
	assert.False(t, allowed)
}
