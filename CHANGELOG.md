# Changelog

All notable changes to `@hyze-cloud/sdk` are documented here. This project follows
[Semantic Versioning](https://semver.org/).

## [0.2.0] — 2026-09-23

The package was **renamed**: `@hyzecloud/sdk` → **`@hyze-cloud/sdk`**. Update both the install
command and the import; the old name stays on the registry but is frozen at `0.1.0` and will not
receive further releases.

### Fixed

- **The package now loads in Node.** `0.1.0` shipped extensionless ESM specifiers
  (`from "./client"`), which Bun resolves and Node does not — importing it threw
  `ERR_MODULE_NOT_FOUND`, even though the README promised Node 18+. Every relative specifier now
  carries `.js`, and `tsconfig` uses `module`/`moduleResolution: nodenext` so the compiler rejects
  the next one instead of shipping it.
- **Deploy history pointed at a route that does not exist.** `apps.builds()` called
  `GET /apps/{appId}/builds`, which answered 404 on the live API. It is now
  `apps.deployments()`, hitting `GET /apps/{appId}/deployments` with `page`/`limit`, typed from
  the route's real response shape. No caller received data from the old method, so nothing needs
  migrating beyond the method name.

### Added

- `check:api` — a drift check that fails when a route the SDK calls disappears from the API.
- CI on every pull request and a daily schedule.

## [0.1.0] — 2026-07-17

First release (as `@hyzecloud/sdk`). Superseded: it does not load in Node and its deploy-history
method targets a dead route.
