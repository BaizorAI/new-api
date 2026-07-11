# AI API Gateway

## Overview
A multi-provider AI API gateway and proxy server that aggregates LLM services (OpenAI, Anthropic, Google, etc.) through a unified REST interface.

## Backend Architecture
- **Language**: Go with Gin framework (router), GORM (ORM), and go-i18n (I18N)
- **Layered Design**: router → controller → service → model
- **Data Stores**: SQLite, MySQL, PostgreSQL (database); Redis (cache/session)
- **Auth**: JWT + OAuth (provider-level) for users and providers

## Relay System (Providers)
- **Provider Adapters**: each provider implements a common interface (`Provider`): `GetModels()`, `GetModel()`, `ListBalance()`, `ParseRequest()`, `Do()`, `BuildURL()`
- **Relay Manager** (`relay_manager.go`): singleton that discovers providers via reflection, holds a map of adapter instances, and dispatches requests to the right provider
- **Request Routing**: `proxy.go` extracts the model name from the request, looks it up in the Relay Manager’s internal map (model → provider), then calls the provider’s `Do()` method
- **Custom Providers**: users can add their own providers by implementing the interface and registering with the relay manager

## API Endpoints
- **User Management**: `/auth/register`, `/auth/login`, `/auth/refresh-token`, `/auth/reset-password`, etc.
- **Model Management**: `/models/:id`, `/keys`, `/user/settings`, `/user/kv` (key-value store)
- **Balance & Usage**: `/balance`, `/usage`
- **Provider & Relay**: `/providers`, `/relay/*path` (proxy to upstream APIs)
- **Admin**: `/admin/settings`, `/admin/keys`, etc.

## Frontend Architecture
- **Framework**: React + Bun (package manager) with TypeScript
- **Build Tool**: Bun (used instead of npm/yarn)
- **I18N**: i18next with locales: `en`, `zh`, `fr`, `ru`, `ja`, `vi`
- **Structure**: `web/default/` contains the main UI (components, hooks, routes, translations)

## Key Implementation Details
- Common JSON helpers live in `common/json.go`; all JSON parsing/serializing must go through these wrappers
- Early-return pattern preferred for readability; deep nesting discouraged
- Provider adapters are registered via reflection, enabling dynamic discovery
- Model lookup happens at request time, not compile-time

## Pending Tasks
- None identified at this time
