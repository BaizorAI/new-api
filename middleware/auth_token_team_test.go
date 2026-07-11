package middleware

import (
	"net/http/httptest"
	"testing"

	"github.com/BaizorAI/new-api/common"
	"github.com/BaizorAI/new-api/constant"
	"github.com/BaizorAI/new-api/model"
	"github.com/BaizorAI/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupTokenTeamBillingTestDB(t *testing.T) {
	t.Helper()
	originalDB := model.DB
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.Team{}, &model.TeamMember{}))
	model.DB = db
	t.Cleanup(func() { model.DB = originalDB })
}

// TestSetupContextForTokenTeamBillingSwitch 验证团队令牌计费开关：
//   - 开启（默认）：token.TeamId>0 时把团队上下文写入请求，后续计费走团队钱包；
//   - 关闭：即使 token 属于团队，也不写入团队上下文，回退到创建者个人钱包。
func TestSetupContextForTokenTeamBillingSwitch(t *testing.T) {
	gin.SetMode(gin.TestMode)
	setupTokenTeamBillingTestDB(t)

	require.NoError(t, model.DB.Create(&model.Team{Id: 7, Name: "AIOT", OwnerId: 42, Quota: 1000, Status: model.TeamStatusEnabled}).Error)
	require.NoError(t, model.DB.Create(&model.TeamMember{TeamId: 7, UserId: 42, Role: model.TeamRoleOwner, Status: model.TeamStatusEnabled}).Error)

	original := operation_setting.GetGeneralSetting().TeamTokenBillTeamEnabled
	t.Cleanup(func() { operation_setting.GetGeneralSetting().TeamTokenBillTeamEnabled = original })

	newCtx := func() *gin.Context {
		rec := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(rec)
		return c
	}
	tok := &model.Token{Id: 1, UserId: 42, TeamId: 7, Key: "sk-test"}

	operation_setting.GetGeneralSetting().TeamTokenBillTeamEnabled = true
	cOn := newCtx()
	require.NoError(t, SetupContextForToken(cOn, tok))
	assert.Equal(t, 7, common.GetContextKeyInt(cOn, constant.ContextKeyTeamId), "开关开启时应绑定团队计费上下文")

	operation_setting.GetGeneralSetting().TeamTokenBillTeamEnabled = false
	cOff := newCtx()
	require.NoError(t, SetupContextForToken(cOff, tok))
	assert.Equal(t, 0, common.GetContextKeyInt(cOff, constant.ContextKeyTeamId), "开关关闭时不应绑定团队计费上下文")
}
