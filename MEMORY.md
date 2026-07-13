# Project Memory Note

This project is an AI API gateway/proxy built with Go 1.22+, Gin, GORM v2. It supports 40+ upstream providers via a relay layer (relay/channel). Frontend uses React 19, TypeScript, Rsbuild, Base UI, Tailwind CSS. Databases: SQLite, MySQL, PostgreSQL (all required). Cache: Redis + in-memory. Auth: JWT, WebAuthn/Passkeys, OAuth (GitHub, Discord, OIDC). Frontend package manager: Bun.

Architecture follows Router → Controller → Service → Model; key directories include relay/, middleware/, setting/, common/, dto/, constant/, types/, i18n/, oauth/, pkg/, web/. Backend i18n uses go-i18n/v2 (en, zh); frontend i18n uses i18next + react-i18next + browser-languagedetector with locales in web/default/src/i18n/locales/{lang}.json (flat JSON keys are English source strings).

Coding rules: keep code direct/readable, prefer early returns and clear branches, minimize nested functions, avoid single-use package-level helpers unless they represent reusable behavior, required interface, exported API, test fixture, or complex business logic; name any kept helper with a durable domain concept.

Current task: produce a concise memory note summarizing the conversation (i.e., this documentation).