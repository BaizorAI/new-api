package model

import (
	"testing"

	"github.com/BaizorAI/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupTeamTestDB(t *testing.T) {
	t.Helper()

	originalDB := DB
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&User{}, &Team{}, &TeamMember{}))
	DB = db

	t.Cleanup(func() {
		DB = originalDB
	})
}

func TestSearchTeamMemberCandidates(t *testing.T) {
	setupTeamTestDB(t)

	team := Team{Name: "Search Team", OwnerId: 1, Status: TeamStatusEnabled}
	require.NoError(t, DB.Create(&team).Error)

	users := []User{
		{
			Username: "namehit", DisplayName: "Alpha", Email: "alpha@example.com",
			Password: "password", Status: common.UserStatusEnabled, AffCode: "aff-namehit",
		},
		{
			Username: "display-user", DisplayName: "Display Hit", Email: "display@example.com",
			Password: "password", Status: common.UserStatusEnabled, AffCode: "aff-display",
		},
		{
			Username: "email-user", DisplayName: "Mail User", Email: "mailhit@example.com",
			Password: "password", Status: common.UserStatusEnabled, AffCode: "aff-email",
		},
		{
			Username: "disabledhit", DisplayName: "Disabled", Email: "disabled@example.com",
			Password: "password", Status: common.UserStatusDisabled, AffCode: "aff-disabled",
		},
		{
			Username: "memberhit", DisplayName: "Existing Member", Email: "member@example.com",
			Password: "password", Status: common.UserStatusEnabled, AffCode: "aff-member",
		},
	}
	require.NoError(t, DB.Create(&users).Error)
	require.NoError(t, DB.Create(&TeamMember{
		TeamId: team.Id,
		UserId: users[4].Id,
		Role:   TeamRoleMember,
		Status: TeamStatusEnabled,
	}).Error)

	tests := []struct {
		name     string
		keyword  string
		expected string
	}{
		{name: "username", keyword: "namehit", expected: "namehit"},
		{name: "display name", keyword: "Display Hit", expected: "display-user"},
		{name: "email", keyword: "mailhit@example.com", expected: "email-user"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			candidates, err := SearchTeamMemberCandidates(team.Id, tt.keyword, 10)
			require.NoError(t, err)
			require.Len(t, candidates, 1)
			assert.Equal(t, tt.expected, candidates[0].Username)
		})
	}

	candidates, err := SearchTeamMemberCandidates(team.Id, "hit", 2)
	require.NoError(t, err)
	require.Len(t, candidates, 2)

	usernames := make([]string, 0, len(candidates))
	for _, candidate := range candidates {
		usernames = append(usernames, candidate.Username)
	}
	assert.NotContains(t, usernames, "disabledhit")
	assert.NotContains(t, usernames, "memberhit")

	emptyCandidates, err := SearchTeamMemberCandidates(team.Id, " ", 10)
	require.NoError(t, err)
	assert.Empty(t, emptyCandidates)
}

func TestUpdateTeamMemberRole(t *testing.T) {
	setupTeamTestDB(t)

	team := Team{Name: "Role Team", OwnerId: 1, Status: TeamStatusEnabled}
	require.NoError(t, DB.Create(&team).Error)

	owner := TeamMember{TeamId: team.Id, UserId: 1, Role: TeamRoleOwner, Status: TeamStatusEnabled}
	member := TeamMember{TeamId: team.Id, UserId: 2, Role: TeamRoleMember, Status: TeamStatusEnabled}
	require.NoError(t, DB.Create(&owner).Error)
	require.NoError(t, DB.Create(&member).Error)

	updated, err := UpdateTeamMemberRole(team.Id, member.UserId, TeamRoleAdmin)
	require.NoError(t, err)
	assert.Equal(t, TeamRoleAdmin, updated.Role)

	var saved TeamMember
	require.NoError(t, DB.Where("team_id = ? AND user_id = ?", team.Id, member.UserId).First(&saved).Error)
	assert.Equal(t, TeamRoleAdmin, saved.Role)

	_, err = UpdateTeamMemberRole(team.Id, member.UserId, TeamRoleOwner)
	require.Error(t, err)

	_, err = UpdateTeamMemberRole(team.Id, owner.UserId, TeamRoleViewer)
	require.Error(t, err)
}

func TestTransferUserQuotaToTeam(t *testing.T) {
	setupTeamTestDB(t)

	user := User{
		Username: "quota-user", Password: "password", Status: common.UserStatusEnabled,
		Quota: 50000, AffCode: "aff-quota-user",
	}
	require.NoError(t, DB.Create(&user).Error)
	team := Team{Name: "Quota Team", OwnerId: user.Id, Status: TeamStatusEnabled}
	require.NoError(t, DB.Create(&team).Error)

	require.NoError(t, TransferUserQuotaToTeam(user.Id, team.Id, 10000))

	var savedUser User
	require.NoError(t, DB.First(&savedUser, user.Id).Error)
	assert.Equal(t, 40000, savedUser.Quota)

	var savedTeam Team
	require.NoError(t, DB.First(&savedTeam, team.Id).Error)
	assert.Equal(t, 10000, savedTeam.Quota)

	err := TransferUserQuotaToTeam(user.Id, team.Id, 50000)
	require.Error(t, err)

	require.NoError(t, DB.First(&savedUser, user.Id).Error)
	assert.Equal(t, 40000, savedUser.Quota)
	require.NoError(t, DB.First(&savedTeam, team.Id).Error)
	assert.Equal(t, 10000, savedTeam.Quota)
}
