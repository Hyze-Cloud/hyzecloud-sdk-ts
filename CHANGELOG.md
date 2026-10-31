# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).

## [Unreleased]

## [0.3.0] - 2026-10-31

### Added
- `apps`: `deployment`, `deploymentLogs`, `buildProgress`, `cancelDeployment`, `retryDeployment`,
  `rollbackDeployment`, `rebuild`, `setAutoBackup`, `transfer` and `stats` (runtime stats for several apps).
- `apps`: custom domains with `listDomains`, `addDomain`, `verifyDomain` and `removeDomain`, with typed
  `AppDomain` responses (`status`, `sslStatus`, `cnameTarget`).
- `databases.statsMany` (runtime stats for several databases in one call).
- `tags` resource: `list`, `create`, `update`, `delete` and `setLinks`.
- Unit tests (`bun run test`): HTTP client (auth, base URL, query, errors) and one contract case per
  method (which HTTP method and path it calls), with a guard that fails if a new method has no case.

## [0.2.0] - 2026-09-17

Primeira versão publicada como `@hyze-cloud/sdk`: apps, databases, API keys, invoices, GitHub and plans.
