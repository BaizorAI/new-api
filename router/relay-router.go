package router

import (
	"github.com/BaizorAI/new-api/constant"
	"github.com/BaizorAI/new-api/controller"
	"github.com/BaizorAI/new-api/middleware"
	"github.com/BaizorAI/new-api/relay"
	"github.com/BaizorAI/new-api/types"

	"github.com/gin-gonic/gin"
)

func SetRelayRouter(router *gin.Engine) {
	router.Use(middleware.CORS())
	router.Use(middleware.DecompressRequestMiddleware())
	router.Use(middleware.BodyStorageCleanup()) // Clean request body storage
	router.Use(middleware.StatsMiddleware())
	// https://platform.openai.com/docs/api-reference/introduction
	modelsRouter := router.Group("/v1/models")
	modelsRouter.Use(middleware.RouteTag("relay"))
	modelsRouter.Use(middleware.TokenAuth())
	{
		modelsRouter.GET("", func(c *gin.Context) {
			switch {
			case c.GetHeader("x-api-key") != "" && c.GetHeader("anthropic-version") != "":
				controller.ListModels(c, constant.ChannelTypeAnthropic)
			case c.GetHeader("x-goog-api-key") != "" || c.Query("key") != "": // Gemini standalone compatibility
				controller.RetrieveModel(c, constant.ChannelTypeGemini)
			default:
				controller.ListModels(c, constant.ChannelTypeOpenAI)
			}
		})

		modelsRouter.GET("/:model", func(c *gin.Context) {
			switch {
			case c.GetHeader("x-api-key") != "" && c.GetHeader("anthropic-version") != "":
				controller.RetrieveModel(c, constant.ChannelTypeAnthropic)
			default:
				controller.RetrieveModel(c, constant.ChannelTypeOpenAI)
			}
		})
	}

	geminiRouter := router.Group("/v1beta/models")
	geminiRouter.Use(middleware.RouteTag("relay"))
	geminiRouter.Use(middleware.TokenAuth())
	{
		geminiRouter.GET("", func(c *gin.Context) {
			controller.ListModels(c, constant.ChannelTypeGemini)
		})
	}

	geminiCompatibleRouter := router.Group("/v1beta/openai/models")
	geminiCompatibleRouter.Use(middleware.RouteTag("relay"))
	geminiCompatibleRouter.Use(middleware.TokenAuth())
	{
		geminiCompatibleRouter.GET("", func(c *gin.Context) {
			controller.ListModels(c, constant.ChannelTypeOpenAI)
		})
	}

	playgroundRouter := router.Group("/pg")
	playgroundRouter.Use(middleware.RouteTag("relay"))
	playgroundRouter.Use(middleware.SystemPerformanceCheck())
	playgroundRouter.Use(middleware.UserAuth(), middleware.PlaygroundPathRewrite())
	playgroundRouter.Use(controller.ComfyuiSkillBypass())
	playgroundRouter.Use(middleware.Distribute())
	{
		playgroundRouter.POST("/chat/completions", controller.Playground)
		playgroundRouter.POST("/images/generations", controller.PlaygroundImage)
	}
	hermesFileRouter := router.Group("/pg/hermes")
	hermesFileRouter.Use(middleware.RouteTag("relay"))
	hermesFileRouter.Use(middleware.SystemPerformanceCheck())
	hermesFileRouter.Use(middleware.BrowserSessionAuth())
	{
		hermesFileRouter.GET("/files/*path", controller.HermesPlaygroundFile)
		hermesFileRouter.GET("/comfyui-files/*path", controller.HermesComfyuiFileProxy)
		hermesFileRouter.GET("/comfyui-workflows", controller.HermesComfyuiWorkflows)
		hermesFileRouter.GET("/comfyui-workflows/:name", controller.HermesComfyuiWorkflow)
	}
	hermesGatewayRouter := router.Group("/pg/hermes/gateway")
	hermesGatewayRouter.Use(middleware.RouteTag("relay"))
	hermesGatewayRouter.Use(middleware.SystemPerformanceCheck())
	{
		hermesGatewayRouter.POST("/execution-tasks", controller.CreateHermesGatewayExecutionTask)
		hermesGatewayRouter.GET("/execution-tasks/:task_id", controller.GetHermesGatewayExecutionTask)
	}
	hermesPlaygroundRouter := router.Group("/pg/hermes")
	hermesPlaygroundRouter.Use(middleware.RouteTag("relay"))
	hermesPlaygroundRouter.Use(middleware.SystemPerformanceCheck())
	hermesPlaygroundRouter.Use(middleware.UserAuth())
	{
		hermesPlaygroundRouter.GET("/skills", controller.HermesPlaygroundSkills)
		hermesPlaygroundRouter.POST("/skills", controller.HermesPlaygroundSkills)
		hermesPlaygroundRouter.PUT("/skills", controller.HermesPlaygroundSkills)
		hermesPlaygroundRouter.DELETE("/skills", controller.HermesPlaygroundSkills)
		hermesPlaygroundRouter.POST("/skills/promote", controller.HermesPromoteSkill)
		hermesPlaygroundRouter.GET("/skills/assets", controller.HermesPlaygroundSkillAssets)
		hermesPlaygroundRouter.POST("/skills/assets", controller.HermesPlaygroundSkillAssets)
		hermesPlaygroundRouter.DELETE("/skills/assets", controller.HermesPlaygroundSkillAssets)
		hermesPlaygroundRouter.PUT("/skills/assets", controller.HermesPlaygroundSkillAssets)
		hermesPlaygroundRouter.GET("/skills/assets/file", controller.HermesPlaygroundSkillAssetFile)
		hermesPlaygroundRouter.POST("/skills/generate", controller.HermesPlaygroundSkillGenerate)
		hermesPlaygroundRouter.GET("/toolsets", controller.HermesPlaygroundToolsets)
		hermesPlaygroundRouter.GET("/results", controller.ListHermesResults)
		hermesPlaygroundRouter.POST("/results/sync", controller.SyncHermesResults)
		hermesPlaygroundRouter.POST("/execution-tasks", controller.CreateHermesExecutionTask)
		hermesPlaygroundRouter.GET("/execution-tasks", controller.ListHermesExecutionTasks)
		hermesPlaygroundRouter.GET("/execution-tasks/:task_id", controller.GetHermesExecutionTask)
		hermesPlaygroundRouter.POST("/execution-tasks/:task_id/retry", controller.RetryHermesExecutionTask)
		hermesPlaygroundRouter.POST("/execution-tasks/:task_id/cancel", controller.CancelHermesExecutionTask)
		hermesPlaygroundRouter.DELETE("/execution-tasks/:task_id", controller.DeleteHermesExecutionTask)
		hermesPlaygroundRouter.GET("/platforms/weixin/status", middleware.HermesWeixinStatusRateLimit(), controller.HermesPlaygroundWeixinStatus)
		hermesPlaygroundRouter.POST("/platforms/weixin/qr", middleware.HermesWeixinActionRateLimit(), controller.HermesPlaygroundWeixinQR)
		hermesPlaygroundRouter.GET("/platforms/weixin/qr/:request_id", middleware.HermesWeixinStatusRateLimit(), controller.HermesPlaygroundWeixinQRStatus)
		hermesPlaygroundRouter.POST("/platforms/weixin/disconnect", middleware.HermesWeixinActionRateLimit(), controller.HermesPlaygroundWeixinDisconnect)
		hermesPlaygroundRouter.GET("/platforms/weixin/sessions", middleware.HermesWeixinStatusRateLimit(), controller.HermesPlaygroundWeixinSessions)
		hermesPlaygroundRouter.GET("/sessions/:session_id/messages", middleware.HermesWeixinStatusRateLimit(), controller.HermesPlaygroundSessionMessages)
	}
	relayV1Router := router.Group("/v1")
	relayV1Router.Use(middleware.RouteTag("relay"))
	relayV1Router.Use(middleware.SystemPerformanceCheck())
	relayV1Router.Use(middleware.TokenAuth())
	relayV1Router.Use(middleware.ModelRequestRateLimit())
	{
		// WebSocket routes use the unified Relay path.
		wsRouter := relayV1Router.Group("")
		wsRouter.Use(middleware.Distribute())
		wsRouter.GET("/realtime", func(c *gin.Context) {
			controller.Relay(c, types.RelayFormatOpenAIRealtime)
		})
		wsRouter.GET("/responses", func(c *gin.Context) {
			controller.Relay(c, types.RelayFormatOpenAIResponsesWS)
		})
	}
	{
		//http router
		httpRouter := relayV1Router.Group("")
		httpRouter.Use(middleware.Distribute())

		// claude related routes
		httpRouter.POST("/messages", func(c *gin.Context) {
			controller.Relay(c, types.RelayFormatClaude)
		})

		// chat related routes
		httpRouter.POST("/completions", func(c *gin.Context) {
			controller.Relay(c, types.RelayFormatOpenAI)
		})
		httpRouter.POST("/chat/completions", func(c *gin.Context) {
			controller.Relay(c, types.RelayFormatOpenAI)
		})

		// response related routes
		httpRouter.POST("/responses", func(c *gin.Context) {
			controller.Relay(c, types.RelayFormatOpenAIResponses)
		})
		httpRouter.POST("/responses/compact", func(c *gin.Context) {
			controller.Relay(c, types.RelayFormatOpenAIResponsesCompaction)
		})

		// image related routes
		httpRouter.POST("/edits", func(c *gin.Context) {
			controller.Relay(c, types.RelayFormatOpenAIImage)
		})
		httpRouter.POST("/images/generations", func(c *gin.Context) {
			controller.Relay(c, types.RelayFormatOpenAIImage)
		})
		httpRouter.POST("/images/edits", func(c *gin.Context) {
			controller.Relay(c, types.RelayFormatOpenAIImage)
		})

		// embedding related routes
		httpRouter.POST("/embeddings", func(c *gin.Context) {
			controller.Relay(c, types.RelayFormatEmbedding)
		})

		// audio related routes
		httpRouter.POST("/audio/transcriptions", func(c *gin.Context) {
			controller.Relay(c, types.RelayFormatOpenAIAudio)
		})
		httpRouter.POST("/audio/translations", func(c *gin.Context) {
			controller.Relay(c, types.RelayFormatOpenAIAudio)
		})
		httpRouter.POST("/audio/speech", func(c *gin.Context) {
			controller.Relay(c, types.RelayFormatOpenAIAudio)
		})

		// rerank related routes
		httpRouter.POST("/rerank", func(c *gin.Context) {
			controller.Relay(c, types.RelayFormatRerank)
		})

		// gemini relay routes
		httpRouter.POST("/engines/:model/embeddings", func(c *gin.Context) {
			controller.Relay(c, types.RelayFormatGemini)
		})
		httpRouter.POST("/models/*path", func(c *gin.Context) {
			controller.Relay(c, types.RelayFormatGemini)
		})

		// other relay routes
		httpRouter.POST("/moderations", func(c *gin.Context) {
			controller.Relay(c, types.RelayFormatOpenAI)
		})

		// OpenAI Files API
		httpRouter.POST("/files", controller.RelayFilesUpload)
		httpRouter.GET("/files", controller.RelayFilesList)
		httpRouter.GET("/files/:id", controller.RelayFilesRetrieve)
		httpRouter.DELETE("/files/:id", controller.RelayFilesDelete)
		httpRouter.GET("/files/:id/content", controller.RelayFilesContent)

		// not implemented
		httpRouter.POST("/images/variations", controller.RelayNotImplemented)
		httpRouter.POST("/fine-tunes", controller.RelayNotImplemented)
		httpRouter.GET("/fine-tunes", controller.RelayNotImplemented)
		httpRouter.GET("/fine-tunes/:id", controller.RelayNotImplemented)
		httpRouter.POST("/fine-tunes/:id/cancel", controller.RelayNotImplemented)
		httpRouter.GET("/fine-tunes/:id/events", controller.RelayNotImplemented)
		httpRouter.DELETE("/models/:model", controller.RelayNotImplemented)
	}

	relayMjRouter := router.Group("/mj")
	relayMjRouter.Use(middleware.RouteTag("relay"))
	relayMjRouter.Use(middleware.SystemPerformanceCheck())
	registerMjRouterGroup(relayMjRouter)

	relayMjModeRouter := router.Group("/:mode/mj")
	relayMjModeRouter.Use(middleware.RouteTag("relay"))
	relayMjModeRouter.Use(middleware.SystemPerformanceCheck())
	registerMjRouterGroup(relayMjModeRouter)
	//relayMjRouter.Use()

	relaySunoRouter := router.Group("/suno")
	relaySunoRouter.Use(middleware.RouteTag("relay"))
	relaySunoRouter.Use(middleware.SystemPerformanceCheck())
	relaySunoRouter.Use(middleware.TokenAuth(), middleware.Distribute())
	{
		relaySunoRouter.POST("/submit/:action", controller.RelayTask)
		relaySunoRouter.POST("/fetch", controller.RelayTaskFetch)
		relaySunoRouter.GET("/fetch/:id", controller.RelayTaskFetch)
	}

	relayGeminiRouter := router.Group("/v1beta")
	relayGeminiRouter.Use(middleware.RouteTag("relay"))
	relayGeminiRouter.Use(middleware.SystemPerformanceCheck())
	relayGeminiRouter.Use(middleware.TokenAuth())
	relayGeminiRouter.Use(middleware.ModelRequestRateLimit())
	relayGeminiRouter.Use(middleware.Distribute())
	{
		// Gemini API path format: /v1beta/models/{model_name}:{action}
		relayGeminiRouter.POST("/models/*path", func(c *gin.Context) {
			controller.Relay(c, types.RelayFormatGemini)
		})
	}
}

func registerMjRouterGroup(relayMjRouter *gin.RouterGroup) {
	relayMjRouter.GET("/image/:id", relay.RelayMidjourneyImage)
	relayMjRouter.Use(middleware.TokenAuth(), middleware.Distribute())
	{
		relayMjRouter.POST("/submit/action", controller.RelayMidjourney)
		relayMjRouter.POST("/submit/shorten", controller.RelayMidjourney)
		relayMjRouter.POST("/submit/modal", controller.RelayMidjourney)
		relayMjRouter.POST("/submit/imagine", controller.RelayMidjourney)
		relayMjRouter.POST("/submit/change", controller.RelayMidjourney)
		relayMjRouter.POST("/submit/simple-change", controller.RelayMidjourney)
		relayMjRouter.POST("/submit/describe", controller.RelayMidjourney)
		relayMjRouter.POST("/submit/blend", controller.RelayMidjourney)
		relayMjRouter.POST("/submit/edits", controller.RelayMidjourney)
		relayMjRouter.POST("/submit/video", controller.RelayMidjourney)
		//relayMjRouter.POST("/notify", controller.RelayMidjourney)
		relayMjRouter.GET("/task/:id/fetch", controller.RelayMidjourney)
		relayMjRouter.GET("/task/:id/image-seed", controller.RelayMidjourney)
		relayMjRouter.POST("/task/list-by-condition", controller.RelayMidjourney)
		relayMjRouter.POST("/insight-face/swap", controller.RelayMidjourney)
		relayMjRouter.POST("/submit/upload-discord-images", controller.RelayMidjourney)
	}
}
