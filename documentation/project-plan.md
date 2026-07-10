# AuthCore Project Plan

## Overview

**Project:** AuthCore authentication service  
**Developer:** Solo learning / portfolio project  
**Goal:** Build a reusable, portfolio-ready standalone authentication service for JavaScript applications  
**License:** MIT

AuthCore is a backend-first standalone authentication service. It provides API-first auth flows and is designed to be used by separate client applications and future protected resource services. A small demo frontend is included as a reference browser client for manual testing and portfolio presentation.

The project also serves as practice for production-like development habits: issues, feature branches, pull requests, CI, Docker, deployment, and release discipline.

## Product Goals

- Provide a reusable standalone authentication service for JavaScript projects.
- Keep auth flows explicit, testable, and easy to reason about.
- Use PostgreSQL-backed state for security-sensitive token lifecycle decisions.
- Keep the backend independent from user-facing HTML pages.
- Include a demo frontend as a reference browser client, not as the core product.
- Support browser-oriented integration patterns without making AuthCore depend on one specific frontend.
- Leave room for future companion services that consume AuthCore-issued access tokens.
- Maintain a project structure that can grow without becoming hard to navigate.

## Stack

- Node.js 20+
- NestJS
- TypeScript
- PostgreSQL 17
- TypeORM migrations
- Redis
- Argon2id password hashing
- JWT access, refresh, email verification, and password reset tokens
- Jest + Supertest
- React + Vite demo frontend
- Docker Compose
- GitHub Actions CI
- Swagger / OpenAPI

## Architecture

Main backend modules:

- `auth` handles auth endpoints, DTOs, guards, token flows, and cleanup jobs.
- `users` handles user persistence and lifecycle data.
- `notifications` handles demo notification delivery and in-memory outbox access.
- `database/migrations` stores schema changes.
- `infrastructure/redis` owns the Redis client lifecycle for infrastructure-level integrations.
- `config` centralizes environment-based configuration.

Auth module organization:

- `auth/tokens` contains token-related services.
- `auth/cleanup` contains scheduled cleanup jobs.
- `auth/hashing` contains hashing implementation.
- `auth/entities` contains auth token entities.
- `auth/dto`, `auth/types`, and `auth/interfaces` contain API and internal contracts.

Conventions:

- Service and internal code: `camelCase`
- API JSON: `snake_case`
- Database columns: `snake_case`
- Schema changes are made through migrations, not synchronization.

## API Scope

Auth endpoints:

```text
POST   /auth/register
POST   /auth/login
POST   /auth/refresh
POST   /auth/logout
POST   /auth/logout-all
GET    /auth/me
GET    /auth/email-verification
POST   /auth/email-verification/resend
POST   /auth/forgot-password
POST   /auth/reset-password
```

Demo endpoints:

```text
GET    /demo/notifications-outbox
DELETE /demo/notifications-outbox
```

Swagger UI:

```text
GET /api
```

## Integration Modes

AuthCore should remain a standalone auth service, not a backend that is tightly coupled to one frontend. The project should support two integration modes:

Browser client mode:

- the demo frontend acts as a reference browser client;
- access tokens are used explicitly by the client for protected API calls;
- refresh token handling should move toward an HTTP-only cookie flow;
- CSRF protection should be applied to cookie-authenticated browser endpoints;
- frontend changes should demonstrate the intended browser integration pattern.

API / service client mode:

- non-browser clients may continue to use explicit token transport where appropriate;
- future protected resource services should validate AuthCore-issued access tokens;
- AuthCore should document the claims and validation rules expected by downstream services.

The browser mode and API/service mode should be documented separately so security trade-offs remain clear.

## Core Auth Model

Users:

- registration creates an unverified user immediately;
- login is blocked until email verification is completed;
- `unverified_expires_at` is the source of truth for abandoned unverified account cleanup;
- email verification clears `unverified_expires_at`;
- resend verification and forgot-password can extend the unverified user lifetime.

Tokens:

- access tokens are short-lived JWTs sent as `Authorization: Bearer <token>`;
- refresh tokens are persisted in PostgreSQL and use rotation;
- the current refresh flow accepts explicit refresh token transport;
- browser integrations should move toward HTTP-only refresh cookies with CSRF protection;
- email verification and password reset use JWT as transport plus stateful database records;
- raw verification/reset/refresh tokens are never stored;
- token hashes are stored in PostgreSQL;
- email verification and password reset tokens support expiration, one-time use, and revocation.

Security behavior:

- resend verification and forgot-password return generic `{ message: 'ok' }` responses to reduce account enumeration risk;
- password reset is allowed for unverified users;
- password reset does not verify email automatically;
- cleanup jobs remove stale lifecycle data after configurable retention windows.

## Demo Frontend Strategy

The demo frontend should demonstrate the auth service from a client perspective:

- registration;
- login;
- profile access;
- logout;
- email verification result handling;
- resend verification;
- forgot password;
- reset password;
- demo notification outbox.

The frontend should remain small and focused. It should not become a full product UI or duplicate backend responsibilities. Its role is to prove the browser integration mode, including future HTTP-only refresh cookie and CSRF behavior.

## Protected Resource Service Direction

A future companion service, such as a small catalog or product service, can demonstrate AuthCore as a standalone auth provider in a multi-service setup.

The companion service should stay intentionally small:

- it should own a separate business domain, such as products;
- it should not duplicate AuthCore user, password, refresh token, or session logic;
- it should validate AuthCore-issued access tokens before serving protected endpoints;
- it should use token claims such as `sub` and future issuer/audience claims to identify the caller;
- it should run through Docker Compose with AuthCore, Redis, PostgreSQL, and the demo frontend.

The goal is to demonstrate service boundaries and token consumption, not to build a full e-commerce system.

## Testing Strategy

- E2E tests cover main HTTP auth flows.
- Integration tests cover service-level behavior for non-trivial flows.
- Tests run against a real PostgreSQL test database.
- Redis-backed behavior uses the test Redis database when needed.
- Test helpers are used for reusable fixtures.
- Cleanup behavior should be tested at the service level before testing scheduler orchestration.

Main commands:

```bash
pnpm test
pnpm test:e2e
pnpm test:integration
```

Full project verification:

```bash
pnpm lint:check
pnpm test
pnpm build
pnpm --filter demo-frontend lint
pnpm --filter demo-frontend build
```

## Development Workflow

Target workflow:

- create an issue for meaningful features, fixes, and refactors;
- create a feature/fix/refactor branch from `main`;
- open a pull request into `main`;
- require CI to pass before merge;
- keep `main` stable and deployable;
- delete feature branches after merge.

CI should cover:

- backend lint;
- backend migrations/tests/build;
- frontend lint/build.

## Deployment Direction

Local development:

- use Docker Compose for local PostgreSQL and Redis;
- keep development and test databases easy to bootstrap;
- keep env examples current.

Production-style deployment:

- build backend and frontend through Docker;
- run migrations before starting production services;
- keep deployment script simple and repeatable;
- keep secrets outside the repository.

## Roadmap

### Phase 1 - Core Auth MVP

- User registration
- Login
- Access token protection
- Refresh token rotation
- Logout current session
- Logout all sessions
- Protected profile endpoint
- Swagger documentation
- Integration and E2E tests

### Phase 2 - Email And Password Flows

- Email verification
- Email verification resend
- Password reset request
- Password reset confirmation
- Demo notification outbox
- Client redirect flow for verification/reset results

### Phase 3 - Lifecycle Cleanup

- Cleanup abandoned unverified users
- Cleanup stale email verification tokens
- Cleanup stale password reset tokens
- Cleanup stale refresh tokens
- Configurable retention policies
- UTC-based cleanup schedules

### Phase 4 - Demo And Developer Experience

- Demo React frontend
- Local Docker development setup
- CI through GitHub Actions
- Protected pull request workflow
- README and env example polish
- Production-like Docker deployment

### Phase 5 - Production Security Hardening

- Refresh token reuse detection
- Session listing and session revocation endpoints
- Distributed rate limiting with Redis

### Phase 6 - Browser Security Integration

- HTTP-only cookie refresh flow
- CSRF protection
- Demo frontend migration to browser cookie refresh behavior
- Browser auth documentation and trade-offs

### Phase 7 - Protected Resource Service Demo

- Minimal catalog or product service
- Access token validation outside AuthCore
- Docker Compose orchestration across services
- Documentation for downstream service JWT validation

### Phase 8 - General Production Hardening

- Helmet and CORS hardening
- Structured logging and request IDs
- Issuer/audience claims for service boundaries

### Phase 9 - Advanced Features

- Roles and permissions
- RS256 JWT signing
- Public key endpoint
- Production email provider integration
- Google OAuth login
- More complete client integration examples

## Non-Goals

- Full social login provider set beyond Google OAuth
- Full user-facing HTML pages served directly by the backend
- API gateway inside this project
- Full microservice platform or complete e-commerce product
- Distributed caching beyond explicitly planned Redis use cases
- Turning the demo frontend into a full product application
- Replacing mature identity platforms such as Keycloak/Auth0

## Related Work

- Demo frontend client for manual testing and portfolio presentation
- Future protected resource services can integrate with AuthCore as an external auth provider
- HTTP-only cookie and CSRF work should be treated as the browser integration track

---

**Last updated:** 2026-07-10  
**Plan version:** 1.3
