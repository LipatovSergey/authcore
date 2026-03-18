# AuthCore Project Plan

## General Info

**Project:** AuthCore authentication service  
**Developer:** Solo developer learning project  
**Goal:** Build a production-ready auth service for a portfolio and for reuse in other projects  
**Repository:** https://github.com/[username]/authcore  
**License:** MIT

## Tech Stack

**Backend**

- Node.js 20+
- NestJS
- TypeScript with strict mode

**Database**

- PostgreSQL 17 as the main database
- Redis 7 planned for `v2.0.0` for rate limiting and cache
- TypeORM

**Infrastructure**

- Docker and Docker Compose
- Swagger / OpenAPI

**Testing**

- Jest
- Supertest for E2E HTTP tests

**Linting and Formatting**

- ESLint
- Prettier

## Architecture Decisions

### Database

**PostgreSQL**

- `users` table for user data
- `refresh_tokens` table for refresh token storage and audit
- `email_verification_tokens` table planned for `v1.1.0`

**Redis from `v2.0.0`**

- Cache and distributed rate limiting
- TTL-based automatic cleanup

**Migrations**

- Managed with TypeORM CLI
- Stored in git
- Used as the source of truth for schema changes

### Data Models

**MVP `v1.0.0` Users**

```typescript
{
  id: UUID
  email: string
  password_hash: string
  created_at: timestamp
  updated_at: timestamp
}
```

**MVP `v1.0.0` Refresh Tokens**

```typescript
{
  id: UUID
  user_id: UUID
  jti: string
  token_hash: string
  expires_at: timestamp
  created_at: timestamp
  revoked_at: timestamp | null
}
```

**Changes in `v1.1.0` Users**

```typescript
{
  id: UUID
  email: string
  password_hash: string
  is_email_verified: boolean
  email_verified_at: timestamp | null
  created_at: timestamp
  updated_at: timestamp
}
```

**New in `v1.1.0` Email Verification Tokens**

```typescript
{
  id: UUID
  user_id: UUID
  token_hash: string
  expires_at: timestamp
  used_at: timestamp | null
  created_at: timestamp
}
```

**Not Included Yet**

- `is_active` in `v1.1.0`
- `device_info` and `ip_address` in `v2.0.0`
- `role` in `v2.1.0`

### API Endpoints

**MVP `v1.0.0`**

```text
POST   /auth/register
POST   /auth/login
POST   /auth/refresh
POST   /auth/logout
POST   /auth/logout-all
GET    /auth/me
```

**Planned Later**

```text
GET    /auth/verify-email       (v1.1.0)
POST   /auth/resend-verification (v1.1.0)
POST   /auth/forgot-password    (v1.1.0)
POST   /auth/reset-password     (v1.1.0)
GET    /auth/sessions           (v2.0.0)
DELETE /auth/sessions/:id       (v2.0.0)
```

### API Format

**Success Response Example**

```json
{
  "access_token": "eyJhbGc...",
  "refresh_token": "eyJhbGc..."
}
```

**Error Response Example**

```json
{
  "message": "Invalid credentials",
  "statusCode": 401
}
```

**HTTP Status Codes**

- `200 OK` for login, refresh, logout, logout-all, and `/me`
- `201 Created` for registration
- `302 Found` or another redirect status for email verification redirect flow in `v1.1.0`
- `400 Bad Request` for invalid input
- `401 Unauthorized` for invalid credentials or invalid token
- `409 Conflict` when email already exists
- `500 Internal Server Error` for unexpected server errors

### Authentication and Security

**Token Model in MVP**

- Access token: JWT, 15 minutes, HS256
- Refresh token: JWT, 7 days, stored in PostgreSQL
- Refresh token rotation is atomic with a database transaction
- Access token is sent in `Authorization: Bearer`
- Refresh token is sent in the request body
- The project uses only JWT + refresh token auth

**Password Hashing**

- Argon2id
- Parameters come from env
- Passwords are never logged
- Hashing is used only through a hasher abstraction

**Validation**

- `class-validator` for DTOs
- Email format validation
- Minimum password length: 12
- No password trim
- Weak password deny-list is planned
- Config values are validated with Joi

**Rate Limiting in MVP**

- `@nestjs/throttler` with global `APP_GUARD`
- Default throttle comes from env
- Route overrides for `POST /auth/register`, `POST /auth/login`, and `POST /auth/refresh`
- In-memory storage in MVP

**Planned Later**

- HTTP-only cookies for refresh tokens in `v2.0.0`
- CSRF protection in `v2.0.0`
- Distributed rate limiting in `v2.0.0`
- Email verification in `v1.1.0`
- RS256 in `v2.1.0`

**Email Verification in `v1.1.0`**

- Email verification is mandatory before login is allowed
- Registration creates the user immediately in `users` with unverified status
- Verification link points directly to the backend auth service
- Verification is handled by `GET /auth/verify-email`
- Successful and failed verification outcomes use redirect-based responses
- Verification token is stateful, one-time use, and only its hash is stored in the database
- Resending verification invalidates the previous active token
- Email verification does not log the user in automatically

### Project Structure

```text
authcore/
├── src/
│   ├── auth/
│   ├── users/
│   ├── config/
│   ├── database/
│   ├── app.module.ts
│   └── main.ts
├── test/
├── documentation/
├── docker-compose.yml
├── .env.example
├── package.json
├── tsconfig.json
└── README.md
```

## Development Environment

### Docker Compose

Current MVP setup uses PostgreSQL in Docker Compose.

### App Run Modes

- Local development: `pnpm start:dev`
- Production build: `pnpm build` then `pnpm start:prod`

### Argon2 Notes

- `argon2` is a native Node.js module
- Docker-first setup is the safest default
- If prebuilt binaries are not available, source build may be needed
- README should include troubleshooting notes for Argon2

### Environment Variables

Main required variables:

```bash
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=authcore_development

JWT_ACCESS_SECRET=your-secret-key
JWT_REFRESH_SECRET=another-secret-key
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

ARGON2_MEMORY_COST=19456
ARGON2_TIME_COST=2
ARGON2_PARALLELISM=1

THROTTLE_DEFAULT_LIMIT=60
THROTTLE_DEFAULT_TTL_MS=60000

PORT=3000
NODE_ENV=development
```

Redis variables are planned from `v2.0.0`.

### Env Validation

- `@nestjs/config` + Joi
- The app must fail fast if required variables are missing

## Testing

### MVP Test Scope

- E2E tests for main auth flows
- Separate E2E tests for throttling
- Test PostgreSQL database

### Main E2E Scenarios

```text
should register a new user
should login with valid credentials
should refresh access token
should logout and invalidate token
should reject invalid credentials
```

### Unit Tests

- Planned for `v1.1.0+`
- Focus on services and non-trivial logic

### Testing Approach

- Build the feature first, then add tests for MVP
- Use TDD for more critical features later

## Logging

### MVP

- Built-in NestJS `Logger`
- Output to stdout
- Levels used: `log`, `warn`, `error`, `debug`

### Main Logged Events

```text
User registered
User logged in
Token refreshed
User logged out
User logged out from all sessions
Failed login attempt
Invalid token
Unhandled errors
```

### Later

- Pino or Winston
- Structured JSON logs
- Better production log levels

## Documentation

### Swagger UI

- Generated from decorators
- Available at `/api`
- Supports Try it out
- Supports bearer auth
- Response DTO classes are allowed for OpenAPI schemas even if service output contracts still use TypeScript interfaces

### README

Should include:

- Getting Started
- Prerequisites
- Installation
- Running the app
- API docs link
- Environment variables
- Testing
- Architecture overview
- Troubleshooting
- License

### `.env.example`

- All required variables
- Simple comments
- Example values only, never real secrets

## Integration with Other Services

### Notes Service and Future Services

**Current approach:** clients verify JWT locally

How it works:

1. AuthCore issues an access token
2. Another service verifies the signature
3. Services share the JWT secret in the current model
4. The other service reads `userId` from the token

**Access Token Payload**

```json
{
  "sub": "user-uuid",
  "email": "user@example.com",
  "iat": 1234567890,
  "exp": 1234568790
}
```

**Later Options**

- Verify endpoint in AuthCore
- RS256 with public/private keys
- API Gateway

## Git Workflow

### Branching

- Work in `main`
- Commit and push often

### Versioning

- Git tags for releases: `v1.0.0`, `v1.1.0`, `v2.0.0`
- Semantic versioning
- GitHub Releases with change notes

### Commit Convention

```text
feat: add user registration endpoint
fix: resolve token expiration bug
refactor: extract JWT service
docs: update API documentation
test: add e2e tests for login
chore: update dependencies
```

## Roadmap

### MVP - `v1.0.0`

**Goal:** a minimal working auth service

**Week 1: Setup**

- [x] Initialize NestJS project
- [x] Docker Compose with PostgreSQL
- [x] TypeORM setup
- [x] Initial migrations for `users` and `refresh_tokens`
- [x] Module structure
- [x] Env variables and validation

**Week 2: Core Features**

- [x] Users module
- [x] Registration endpoint and DTO
- [x] Argon2id password hashing
- [x] Password policy
- [x] JWT generation
- [x] Login endpoint
- [x] Basic rate limiting for register and login
- [x] Basic error handling

**Week 3: Tokens and Guards**

- [x] Refresh token storage in PostgreSQL
- [x] Refresh endpoint
- [x] Auth guard
- [x] Logout
- [x] `GET /auth/me`

**Week 4: Polish and Release**

- [x] Validation pipes
- [x] Better error handling
- [x] Swagger setup and annotations
- [x] Main E2E tests
- [x] Throttling E2E tests
- [x] Basic logging
- [x] README
- [x] `.env.example`
- [x] Git tag `v1.0.0`

**Deliverables**

- Working auth API
- Swagger docs
- Docker Compose setup
- E2E tests
- README

Redis is not required for `v1.0.0` and is moved to `v2.0.0`.

---

### Iteration 2 - `v1.1.0`

**Goal:** email verification and password reset

**Features**

- [ ] Email verification flow
  Add `email_verification_tokens`
  Add `POST /auth/verify-email`
  Send verification email
  Add `email_verified` to `users`
- [ ] Password reset flow
  Add `password_reset_tokens`
  Add `POST /auth/forgot-password`
  Add `POST /auth/reset-password`
  Send reset email
  Store only hashed reset tokens
  Add TTL and single-use behavior
- [ ] Better logging
  Add Pino or Winston
  Add structured logs
  Improve production log levels
- [ ] More tests
  Add unit tests
  Add E2E tests for new endpoints
  Target around 60% coverage
- [ ] Simplify response contracts
  Evaluate moving from output interfaces to response DTO classes as a single source of truth for TypeScript and Swagger
  Do not do this before MVP is complete

**Deliverables**

- Working email verification
- Working password reset
- Better logging
- Git tag `v1.1.0`

---

### Iteration 3 - `v2.0.0`

**Goal:** production-ready security

**Features**

- [ ] Multiple sessions
  Add `device_info` and `ip_address` to `refresh_tokens`
  Add `GET /auth/sessions`
  Add `DELETE /auth/sessions/:id`
- [ ] HTTP-only cookies
  Move refresh token to cookie
  Add CSRF protection
  Add secure cookie flag
- [ ] Distributed rate limiting
  Protect login
  Protect registration and reset endpoints
  Store counters in Redis
- [ ] Redis integration
  Add Redis to Docker Compose
  Add Redis client to the app
  Use Redis for rate limiting and cache
- [ ] Observability and audit
  Add correlation/request ID
  Add audit events
  Add basic security metrics
- [ ] Better security defaults
  Add Helmet
  Add CORS configuration
  Add request ID tracing

**Deliverables**

- Multiple sessions
- Cookie-based refresh flow
- Distributed rate limiting
- Git tag `v2.0.0`

---

### Iteration 4 - `v2.1.0`

**Goal:** advanced features

**Features**

- [ ] Roles and permissions
  Add `role` to `users`
  Add role guards
  Add admin endpoints
- [ ] RS256 for JWT
  Add private/public key pair
  Add public key endpoint
- [ ] Deployment
  Deploy to Railway, Render, or Fly.io
  Add CI/CD
  Add production env setup
  Keep Docker-first setup for Argon2 stability
  Add troubleshooting docs for Argon2 build fallback

**Deliverables**

- Working roles
- Audit logs
- RS256 JWT
- Deployment
- Git tag `v2.1.0`

---

### Future Ideas

- [ ] OAuth providers
- [ ] Two-factor authentication
- [ ] Provider-ready integration
- [ ] API keys for machine-to-machine auth
- [ ] Session management UI
- [ ] Metrics and monitoring
- [ ] GraphQL API

## Best Practices

### Code Style

- Use TypeScript strict mode
- Avoid `any`
- Use clear names
- Use `camelCase` for variables and functions
- Use `PascalCase` for classes
- Use `UPPER_CASE` for constants

### Security

- Never log passwords
- Never return passwords in API responses
- Always validate user input
- Keep secrets in environment variables
- Use HTTPS in production
- Keep access tokens short-lived
- Invalidate refresh tokens properly

### Database

- Always use migrations
- Do not edit production data manually
- Review generated SQL
- Test migrations in development
- Add indexes only for real query patterns
- Use transactions when an operation changes multiple records together

### Error Handling

- Do not swallow errors
- Do not return stack traces to users
- Log with useful context
- Return clear messages
- Use correct HTTP status codes

### Testing

- Use E2E tests for main API flows
- Use unit tests for complex logic
- Do not test trivial code
- Cover edge cases and error handling

## Non-Goals

### Not Part of This Project Right Now

- OAuth and social login
- Frontend
- API Gateway inside this project
- Horizontal scaling
- Distributed caching
- Advanced monitoring

## Related Projects

### Current

- `notes-service` as a separate notes service that integrates with AuthCore

### Planned

- API Gateway
- Background worker
- CLI tools

## Learning Resources

- NestJS Official Docs: https://docs.nestjs.com
- TypeORM Docs: https://typeorm.io
- JWT Best Practices: https://tools.ietf.org/html/rfc8725
- OWASP Authentication Cheat Sheet
- OWASP Top 10

## Support and Communication

### Git

- Repository: https://github.com/[username]/authcore
- Issues for bug tracking
- Discussions for questions

### Development

- Solo developer
- AI mentor and code review support during development

## License and Use

**License:** MIT

**Allowed**

- Commercial use
- Modification
- Distribution
- Private use

**Requirements**

- Keep attribution
- Include the license text

**Disclaimer**

- No warranty
- The author is not responsible for damages

---

**Last updated:** 2026-03-18  
**Plan version:** 1.1
