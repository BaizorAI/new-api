// Deployment wizard CLI for annesc — guides through connecting a downstream
// baizor-new-api instance (annesc) to baizor.com as its upstream provider.
//
// Usage:
//
//	go run . -target http://annesc.local:3000
//
// The wizard walks through:
//  1. Checking annesc initialization status
//  2. Configuring the upstream baizor.com connection
//  3. Creating a channel on annesc that points to baizor.com
//  4. Syncing model metadata from baizor.com
//  5. Verifying the connection works
package main

import (
	"bufio"
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

// ----- config ---------------------------------------------------------------

type config struct {
	TargetURL string
}

// ----- api helpers ----------------------------------------------------------

func apiGet(baseURL, path string, out any) error {
	url := strings.TrimRight(baseURL, "/") + path
	resp, err := httpGet(url)
	if err != nil {
		return err
	}
	return json.Unmarshal(resp, out)
}

func apiPost(baseURL, path string, body any, out any) error {
	url := strings.TrimRight(baseURL, "/") + path
	payload, _ := json.Marshal(body)
	resp, err := httpPost(url, payload)
	if err != nil {
		return err
	}
	if out != nil {
		return json.Unmarshal(resp, out)
	}
	return nil
}

func httpGet(url string) ([]byte, error) {
	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		return nil, fmt.Errorf("GET %s: %w", url, err)
	}
	defer resp.Body.Close()
	return io.ReadAll(resp.Body)
}

func httpPost(url string, body []byte) ([]byte, error) {
	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Post(url, "application/json", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("POST %s: %w", url, err)
	}
	defer resp.Body.Close()
	return io.ReadAll(resp.Body)
}

// ----- JSON envelope helpers ------------------------------------------------

type apiResponse struct {
	Success bool            `json:"success"`
	Message string          `json:"message"`
	Data    json.RawMessage `json:"data"`
}

type setupStatus struct {
	Status       bool   `json:"status"`
	RootInit     bool   `json:"root_init"`
	DatabaseType string `json:"database_type"`
}

// ----- step helpers ---------------------------------------------------------

var stdin = bufio.NewReader(os.Stdin)

func readLine(prompt string) string {
	fmt.Print("  " + prompt + ": ")
	text, _ := stdin.ReadString('\n')
	return strings.TrimSpace(text)
}

func readPassword(prompt string) string {
	fmt.Print("  " + prompt + ": ")
	text, _ := stdin.ReadString('\n')
	return strings.TrimSpace(text)
}

// ----- color helpers --------------------------------------------------------

const (
	colorReset  = "\033[0m"
	colorGreen  = "\033[32m"
	colorYellow = "\033[33m"
	colorRed    = "\033[31m"
	colorCyan   = "\033[36m"
	colorBold   = "\033[1m"
)

func ok(msg string)    { fmt.Printf("  %s✓%s %s\n", colorGreen, colorReset, msg) }
func warn(msg string)   { fmt.Printf("  %s!%s %s\n", colorYellow, colorReset, msg) }
func fail(msg string)   { fmt.Printf("  %s✗%s %s\n", colorRed, colorReset, msg) }
func info(msg string)   { fmt.Printf("  %s·%s %s\n", colorCyan, colorReset, msg) }
func header(msg string) { fmt.Printf("\n%s%s%s\n", colorBold, msg, colorReset) }
func title(msg string) {
	fmt.Printf("\n%s═══ %s ═══%s\n", colorCyan, msg, colorReset)
}

// ----- steps ----------------------------------------------------------------

func stepCheckStatus(cfg *config) string {
	title("Step 1/5: Check annesc status")

	var resp apiResponse
	if err := apiGet(cfg.TargetURL, "/api/setup", &resp); err != nil {
		fail("Cannot reach annesc at " + cfg.TargetURL)
		fmt.Printf("    Error: %v\n", err)
		os.Exit(1)
	}

	var status setupStatus
	if err := json.Unmarshal(resp.Data, &status); err != nil {
		// Try decoding directly into resp.Data
		if resp.Success {
			// Already initialized or status API returned differently
		}
	}

	if status.Status {
		ok("annesc is already initialized")
		info(fmt.Sprintf("Database type: %s", status.DatabaseType))
		info(fmt.Sprintf("Root user: %v", status.RootInit))
		return "initialized"
	}

	warn("annesc is NOT initialized yet")
	info(fmt.Sprintf("Database type: %s", status.DatabaseType))
	info(fmt.Sprintf("Root user: %v", status.RootInit))

	if !status.RootInit {
		header("  Let's create the root admin account first:")
		username := readLine("Admin username (max 12 chars)")
		password := readPassword("Admin password (min 8 chars)")
		confirm := readPassword("Confirm password")

		if password != confirm {
			fail("Passwords do not match")
			os.Exit(1)
		}
		if len(username) == 0 || len(username) > 12 {
			fail("Username must be 1-12 characters")
			os.Exit(1)
		}
		if len(password) < 8 {
			fail("Password must be at least 8 characters")
			os.Exit(1)
		}

		payload := map[string]any{
			"username":           username,
			"password":           password,
			"confirmPassword":    confirm,
			"SelfUseModeEnabled": true,
			"DemoSiteEnabled":    false,
		}

		var initResp apiResponse
		if err := apiPost(cfg.TargetURL, "/api/setup", payload, &initResp); err != nil {
			fail("Failed to initialize: " + err.Error())
			os.Exit(1)
		}
		if !initResp.Success {
			fail("Initialization failed: " + initResp.Message)
			os.Exit(1)
		}
		ok("annesc initialized successfully")
		return "fresh"
	}

	// Root exists but setup not completed — this is unusual, try to complete setup
	warn("Root exists but setup not marked complete — attempting to finish setup")
	payload := map[string]any{
		"SelfUseModeEnabled": true,
		"DemoSiteEnabled":    false,
	}
	var initResp apiResponse
	_ = apiPost(cfg.TargetURL, "/api/setup", payload, &initResp)
	return "resumed"
}

func stepConfigUpstream(cfg *config) (upstreamURL, apiKey string) {
	title("Step 2/5: Configure upstream baizor.com")

	upstreamURL = readLine("baizor.com URL (e.g. https://baizor.com)")
	if upstreamURL == "" {
		upstreamURL = "https://baizor.com"
		info("Using default: " + upstreamURL)
	}

	apiKey = readPassword("API Key from baizor.com (sk-...)")
	if apiKey == "" {
		fail("API Key is required")
		os.Exit(1)
	}

	// Save site-level configuration on annesc
	options := map[string]string{
		"site.downstream.enabled":      "true",
		"site.downstream.upstream_url": upstreamURL,
	}
	for k, v := range options {
		payload := map[string]string{"key": k, "value": v}
		var resp apiResponse
		if err := apiPost(cfg.TargetURL, "/api/option/", payload, &resp); err != nil {
			warn(fmt.Sprintf("Could not save option %s: %v", k, err))
		}
	}
	ok("Upstream configuration saved")
	return upstreamURL, apiKey
}

func stepCreateChannel(cfg *config, upstreamURL, apiKey string) int {
	title("Step 3/5: Create upstream channel")

	// First, try to fetch models from upstream to verify connectivity
	info("Testing connection to " + upstreamURL + "/v1/models ...")
	modelsURL := strings.TrimRight(upstreamURL, "/") + "/v1/models"
	req, _ := http.NewRequest("GET", modelsURL, nil)
	req.Header.Set("Authorization", "Bearer "+apiKey)
	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		fail("Cannot reach upstream: " + err.Error())
		info("Check that " + upstreamURL + " is reachable and the API key is valid")
		os.Exit(1)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		body, _ := io.ReadAll(resp.Body)
		fail(fmt.Sprintf("Upstream returned HTTP %d: %s", resp.StatusCode, string(body)))
		os.Exit(1)
	}
	ok("Upstream connection verified")

	// Parse model list from upstream
	var modelsResp struct {
		Data []struct {
			ID string `json:"id"`
		} `json:"data"`
	}
	body, _ := io.ReadAll(resp.Body)
	_ = json.Unmarshal(body, &modelsResp)

	modelNames := make([]string, 0, len(modelsResp.Data))
	for _, m := range modelsResp.Data {
		if m.ID != "" {
			modelNames = append(modelNames, m.ID)
		}
	}
	info(fmt.Sprintf("Found %d models on upstream", len(modelNames)))

	// Ask which models to include
	fmt.Println()
	fmt.Printf("  Available models (%d total):\n", len(modelNames))
	displayCount := len(modelNames)
	if displayCount > 20 {
		displayCount = 20
	}
	for _, name := range modelNames[:displayCount] {
		info("  - " + name)
	}
	if len(modelNames) > 20 {
		info(fmt.Sprintf("  ... and %d more", len(modelNames)-20))
	}

	selectedModels := readLine("Models to include (comma-separated, or 'all' for all)")
	if selectedModels == "" || selectedModels == "all" {
		selectedModels = strings.Join(modelNames, ",")
	}

	channelName := readLine("Channel name (default: baizor-upstream)")
	if channelName == "" {
		channelName = "baizor-upstream"
	}

	// Create channel via annesc API
	// Channel type 1 = OpenAI, type 8 = Custom
	channelPayload := map[string]any{
		"name":       channelName,
		"type":       1, // OpenAI
		"key":        apiKey,
		"base_url":   upstreamURL,
		"models":     selectedModels,
		"group":      "default",
		"status":     1,
		"priority":   10,
	}

	var channelResp apiResponse
	if err := apiPost(cfg.TargetURL, "/api/channel/", channelPayload, &channelResp); err != nil {
		warn("Could not create channel via API: " + err.Error())
		info("You can manually create the channel in the annesc admin panel:")
		info("  Type: OpenAI")
		info("  Base URL: " + upstreamURL)
		info("  Key: <your API key>")
		info("  Models: " + selectedModels)
		return 0
	}
	if !channelResp.Success {
		warn("Channel creation failed: " + channelResp.Message)
		info("You can manually create the channel in the annesc admin panel")
		return 0
	}

	ok("Channel '" + channelName + "' created successfully")
	return 1
}

func stepSyncModels(cfg *config, upstreamURL string) {
	title("Step 4/5: Sync model metadata")

	// Set SYNC_UPSTREAM_BASE is not possible via API — suggest env var
	info("For automatic model metadata sync, set this env var on annesc:")
	fmt.Printf("    %sSYNC_UPSTREAM_BASE=%s%s\n", colorBold, upstreamURL, colorReset)
	info("Then trigger sync via annesc admin panel: Models → Sync Upstream")

	// Try to trigger model sync from the upstream metadata endpoint
	metaURL := strings.TrimRight(upstreamURL, "/") + "/api/newapi/models.json"
	info("Checking metadata endpoint: " + metaURL)
	body, err := httpGet(metaURL)
	if err != nil {
		warn("Metadata endpoint not available: " + err.Error())
		info("This is optional — model list was already fetched via /v1/models")
		return
	}

	var metaResp struct {
		Success bool `json:"success"`
		Data    []struct {
			ModelName string `json:"model_name"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &metaResp); err != nil {
		warn("Unexpected metadata format: " + err.Error())
		return
	}
	if metaResp.Success {
		ok(fmt.Sprintf("Metadata endpoint OK — %d models available for sync", len(metaResp.Data)))
	}
}

func stepVerify(cfg *config, upstreamURL string) {
	title("Step 5/5: Verify deployment")

	info("Checking annesc status...")
	var resp apiResponse
	if err := apiGet(cfg.TargetURL, "/api/status", &resp); err != nil {
		fail("annesc status check failed: " + err.Error())
		return
	}
	if resp.Success {
		ok("annesc is running normally")
	} else {
		warn("annesc status returned: " + resp.Message)
	}

	info("Upstream: " + upstreamURL)

	fmt.Println()
	header("Deployment complete! Next steps:")
	info("1. Log in to annesc admin panel at " + cfg.TargetURL)
	info("2. Go to Channels → verify the upstream channel is enabled")
	info("3. Go to Models → view synced models")
	info("4. Set SYNC_UPSTREAM_BASE=" + upstreamURL + " in annesc environment")
	info("5. Restart annesc to apply environment changes")
	fmt.Println()
}

// ----- main -----------------------------------------------------------------

func main() {
	targetURL := flag.String("target", "http://localhost:3000", "annesc instance URL")
	flag.Parse()

	cfg := &config{TargetURL: strings.TrimRight(*targetURL, "/")}

	fmt.Println()
	fmt.Printf("%s%s%s\n", colorBold, "═══ annesc Deployment Wizard ═══", colorReset)
	fmt.Printf("  Target: %s\n", cfg.TargetURL)
	fmt.Println("  This wizard will configure annesc to use baizor.com as upstream.")
	fmt.Println()

	// Step 1: Check annesc status, initialize if needed
	stepCheckStatus(cfg)

	// Step 2: Configure upstream connection
	upstreamURL, apiKey := stepConfigUpstream(cfg)

	// Step 3: Create channel pointing to baizor.com
	stepCreateChannel(cfg, upstreamURL, apiKey)

	// Step 4: Sync model metadata
	stepSyncModels(cfg, upstreamURL)

	// Step 5: Verify
	stepVerify(cfg, upstreamURL)
}
