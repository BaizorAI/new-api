package model

import (
	"errors"
	"strings"

	"github.com/BaizorAI/new-api/common"
	"gorm.io/gorm"
)

const (
	TeamStatusEnabled  = 1
	TeamStatusDisabled = 2

	TeamRoleOwner  = "owner"
	TeamRoleAdmin  = "admin"
	TeamRoleMember = "member"
	TeamRoleViewer = "viewer"
)

type Team struct {
	Id           int    `json:"id"`
	Name         string `json:"name" gorm:"type:varchar(64);index"`
	OwnerId      int    `json:"owner_id" gorm:"index"`
	Quota        int    `json:"quota" gorm:"type:int;default:0"`
	UsedQuota    int    `json:"used_quota" gorm:"type:int;default:0;column:used_quota"`
	RequestCount int    `json:"request_count" gorm:"type:int;default:0"`
	Status       int    `json:"status" gorm:"type:int;default:1"`
	CreatedAt    int64  `json:"created_at" gorm:"autoCreateTime;column:created_at"`
	UpdatedAt    int64  `json:"updated_at" gorm:"autoUpdateTime;column:updated_at"`
}

type TeamMember struct {
	Id        int    `json:"id"`
	TeamId    int    `json:"team_id" gorm:"uniqueIndex:idx_team_member;index"`
	UserId    int    `json:"user_id" gorm:"uniqueIndex:idx_team_member;index"`
	Role      string `json:"role" gorm:"type:varchar(16);default:'member'"`
	Status    int    `json:"status" gorm:"type:int;default:1"`
	CreatedAt int64  `json:"created_at" gorm:"autoCreateTime;column:created_at"`
	UpdatedAt int64  `json:"updated_at" gorm:"autoUpdateTime;column:updated_at"`
}

type TeamWithRole struct {
	Team
	Role string `json:"role"`
}

type TeamMemberInfo struct {
	TeamMember
	Username    string `json:"username"`
	DisplayName string `json:"display_name"`
	Email       string `json:"email"`
}

func NormalizeTeamRole(role string) string {
	switch strings.ToLower(strings.TrimSpace(role)) {
	case TeamRoleOwner:
		return TeamRoleOwner
	case TeamRoleAdmin:
		return TeamRoleAdmin
	case TeamRoleViewer:
		return TeamRoleViewer
	default:
		return TeamRoleMember
	}
}

func CanManageTeamRole(role string) bool {
	return role == TeamRoleOwner || role == TeamRoleAdmin
}

func CreateTeam(ownerId int, name string) (*Team, error) {
	name = strings.TrimSpace(name)
	if ownerId <= 0 {
		return nil, errors.New("user id is invalid")
	}
	if name == "" {
		return nil, errors.New("team name cannot be empty")
	}
	if len(name) > 64 {
		return nil, errors.New("team name is too long")
	}

	team := &Team{
		Name:    name,
		OwnerId: ownerId,
		Status:  TeamStatusEnabled,
	}
	err := DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(team).Error; err != nil {
			return err
		}
		member := &TeamMember{
			TeamId: team.Id,
			UserId: ownerId,
			Role:   TeamRoleOwner,
			Status: TeamStatusEnabled,
		}
		return tx.Create(member).Error
	})
	return team, err
}

func GetUserTeams(userId int) ([]TeamWithRole, error) {
	var teams []TeamWithRole
	err := DB.Table("teams").
		Select("teams.*, team_members.role").
		Joins("JOIN team_members ON team_members.team_id = teams.id").
		Where("team_members.user_id = ? AND team_members.status = ? AND teams.status = ?", userId, TeamStatusEnabled, TeamStatusEnabled).
		Order("teams.id desc").
		Scan(&teams).Error
	return teams, err
}

func GetTeamByIdForUser(teamId int, userId int) (*TeamWithRole, error) {
	var team TeamWithRole
	err := DB.Table("teams").
		Select("teams.*, team_members.role").
		Joins("JOIN team_members ON team_members.team_id = teams.id").
		Where("teams.id = ? AND team_members.user_id = ? AND team_members.status = ? AND teams.status = ?", teamId, userId, TeamStatusEnabled, TeamStatusEnabled).
		First(&team).Error
	return &team, err
}

func GetTeamById(teamId int) (*Team, error) {
	team := &Team{}
	err := DB.Where("id = ? AND status = ?", teamId, TeamStatusEnabled).First(team).Error
	return team, err
}

func GetTeamMember(teamId int, userId int) (*TeamMember, error) {
	member := &TeamMember{}
	err := DB.Where("team_id = ? AND user_id = ? AND status = ?", teamId, userId, TeamStatusEnabled).First(member).Error
	return member, err
}

func GetTeamForToken(teamId int, userId int) (*Team, *TeamMember, error) {
	team, err := GetTeamById(teamId)
	if err != nil {
		return nil, nil, err
	}
	member, err := GetTeamMember(teamId, userId)
	if err != nil {
		return nil, nil, err
	}
	return team, member, nil
}

func ListTeamMembers(teamId int) ([]TeamMemberInfo, error) {
	var members []TeamMemberInfo
	err := DB.Table("team_members").
		Select("team_members.*, users.username, users.display_name, users.email").
		Joins("JOIN users ON users.id = team_members.user_id").
		Where("team_members.team_id = ? AND team_members.status = ?", teamId, TeamStatusEnabled).
		Order("team_members.id asc").
		Scan(&members).Error
	return members, err
}

func AddTeamMemberByUsernameOrEmail(teamId int, identifier string, role string) (*TeamMember, error) {
	identifier = strings.TrimSpace(identifier)
	if identifier == "" {
		return nil, errors.New("member username or email cannot be empty")
	}
	role = NormalizeTeamRole(role)
	if role == TeamRoleOwner {
		role = TeamRoleAdmin
	}

	user := &User{}
	if err := DB.Where("username = ? OR email = ?", identifier, identifier).First(user).Error; err != nil {
		return nil, err
	}
	member := &TeamMember{}
	err := DB.Transaction(func(tx *gorm.DB) error {
		err := tx.Where("team_id = ? AND user_id = ?", teamId, user.Id).First(member).Error
		if err == nil {
			member.Role = role
			member.Status = TeamStatusEnabled
			return tx.Model(member).Select("role", "status").Updates(member).Error
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		member.TeamId = teamId
		member.UserId = user.Id
		member.Role = role
		member.Status = TeamStatusEnabled
		return tx.Create(member).Error
	})
	return member, err
}

func RemoveTeamMember(teamId int, userId int) error {
	return DB.Model(&TeamMember{}).
		Where("team_id = ? AND user_id = ? AND role <> ?", teamId, userId, TeamRoleOwner).
		Update("status", TeamStatusDisabled).Error
}

func ListTeamTokens(teamId int) ([]*Token, error) {
	var tokens []*Token
	err := DB.Where("team_id = ?", teamId).Order("id desc").Find(&tokens).Error
	return tokens, err
}

func CountTeamTokens(teamId int) (int64, error) {
	var total int64
	err := DB.Model(&Token{}).Where("team_id = ?", teamId).Count(&total).Error
	return total, err
}

func GetTeamTokenById(teamId int, tokenId int) (*Token, error) {
	token := &Token{}
	err := DB.Where("id = ? AND team_id = ?", tokenId, teamId).First(token).Error
	return token, err
}

func GetTeamQuota(teamId int) (int, error) {
	var quota int
	err := DB.Model(&Team{}).Where("id = ?", teamId).Select("quota").Find(&quota).Error
	return quota, err
}

func IncreaseTeamQuota(teamId int, quota int) error {
	if quota < 0 {
		return errors.New("quota cannot be negative")
	}
	return DB.Model(&Team{}).Where("id = ?", teamId).Update("quota", gorm.Expr("quota + ?", quota)).Error
}

func DecreaseTeamQuota(teamId int, quota int) error {
	if quota < 0 {
		return errors.New("quota cannot be negative")
	}
	return DB.Model(&Team{}).Where("id = ?", teamId).Update("quota", gorm.Expr("quota - ?", quota)).Error
}

func TransferUserQuotaToTeam(userId int, teamId int, quota int) error {
	if quota <= 0 {
		return errors.New("quota must be greater than zero")
	}
	userQuota, err := GetUserQuota(userId, false)
	if err != nil {
		return err
	}
	if userQuota < quota {
		return errors.New("user quota is not enough")
	}
	err = DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&User{}).Where("id = ?", userId).Update("quota", gorm.Expr("quota - ?", quota)).Error; err != nil {
			return err
		}
		return tx.Model(&Team{}).Where("id = ?", teamId).Update("quota", gorm.Expr("quota + ?", quota)).Error
	})
	if err != nil {
		return err
	}
	return updateUserQuotaCache(userId, userQuota-quota)
}

func UpdateTeamUsedQuotaAndRequestCount(teamId int, quota int) {
	err := DB.Model(&Team{}).Where("id = ?", teamId).Updates(
		map[string]interface{}{
			"used_quota":    gorm.Expr("used_quota + ?", quota),
			"request_count": gorm.Expr("request_count + ?", 1),
		},
	).Error
	if err != nil {
		common.SysLog("failed to update team used quota and request count: " + err.Error())
	}
}
