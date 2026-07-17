package controller

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/BaizorAI/new-api/common"
	"github.com/BaizorAI/new-api/model"

	"github.com/gin-gonic/gin"
)

const (
	onlineDashboardKeyPrefix = "online:dashboard:"
	onlineRelayKeyPrefix     = "online:relay:"
	onlineDashboardTTL       = 60 * time.Second
	onlineRelayTTL           = 300 * time.Second
)

type onlineUser struct {
	Id       int    `json:"id"`
	Username string `json:"username"`
	Email    string `json:"email"`
	Group    string `json:"group"`
}

type onlineStatusResponse struct {
	DashboardUsers []onlineUser `json:"dashboard_users"`
	RelayUsers     []onlineUser `json:"relay_users"`
}

// RecordHeartbeat records a dashboard heartbeat for the authenticated user.
func RecordHeartbeat(c *gin.Context) {
	userId := c.GetInt("id")
	if userId <= 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"message": "unauthorized"})
		return
	}
	if !common.RedisEnabled || common.RDB == nil {
		c.JSON(http.StatusOK, gin.H{"success": true})
		return
	}
	key := fmt.Sprintf("%s%d", onlineDashboardKeyPrefix, userId)
	if err := common.RedisSet(key, "1", onlineDashboardTTL); err != nil {
		common.SysLog("failed to record heartbeat: " + err.Error())
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

// GetOnlineStatus returns counts and user lists for dashboard and relay users.
func GetOnlineStatus(c *gin.Context) {
	resp := onlineStatusResponse{
		DashboardUsers: []onlineUser{},
		RelayUsers:     []onlineUser{},
	}

	if !common.RedisEnabled || common.RDB == nil {
		c.JSON(http.StatusOK, gin.H{"success": true, "data": resp})
		return
	}

	resp.DashboardUsers = scanOnlineUsers(onlineDashboardKeyPrefix)
	resp.RelayUsers = scanOnlineUsers(onlineRelayKeyPrefix)

	c.JSON(http.StatusOK, gin.H{"success": true, "data": resp})
}

func scanOnlineUsers(keyPrefix string) []onlineUser {
	ctx := context.Background()
	var cursor uint64
	var userIds []int
	pattern := keyPrefix + "*"

	for {
		keys, nextCursor, err := common.RDB.Scan(ctx, cursor, pattern, 100).Result()
		if err != nil {
			common.SysLog(fmt.Sprintf("failed to scan redis keys (prefix=%s): %s", keyPrefix, err.Error()))
			break
		}
		for _, key := range keys {
			idStr := strings.TrimPrefix(key, keyPrefix)
			id, err := strconv.Atoi(idStr)
			if err != nil {
				continue
			}
			userIds = append(userIds, id)
		}
		cursor = nextCursor
		if cursor == 0 {
			break
		}
	}

	users := make([]onlineUser, 0, len(userIds))
	seen := make(map[int]bool, len(userIds))
	for _, id := range userIds {
		if seen[id] {
			continue
		}
		seen[id] = true
		cache, err := model.GetUserCache(id)
		if err != nil || cache == nil {
			users = append(users, onlineUser{Id: id, Username: fmt.Sprintf("User#%d", id)})
			continue
		}
		users = append(users, onlineUser{
			Id:       cache.Id,
			Username: cache.Username,
			Email:    cache.Email,
			Group:    cache.Group,
		})
	}

	return users
}

// RecordRelayActivity records a relay API call for the given user in Redis.
func RecordRelayActivity(userId int) {
	if userId <= 0 || !common.RedisEnabled || common.RDB == nil {
		return
	}
	key := fmt.Sprintf("%s%d", onlineRelayKeyPrefix, userId)
	if err := common.RedisSet(key, "1", onlineRelayTTL); err != nil {
		common.SysLog("failed to record relay activity: " + err.Error())
	}
}
