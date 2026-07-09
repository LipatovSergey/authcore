# Auth Token Structure Refactor

## Goal

Refactor auth token-related files from type-based folders into feature-based folders.

The current structure separates entities, services, and types:

```text
src/auth/
  entities/
  tokens/
  types/
```

This works, but token features have grown enough that related files are spread across multiple
folders. A feature-based structure should make token logic easier to navigate.

## Proposed Structure

```text
src/auth/
  tokens/
    email-verification/
      email-verification-token.entity.ts
      email-verification-tokens.service.ts
      email-verification-tokens.types.ts

    password-reset/
      password-reset-token.entity.ts
      password-reset-tokens.service.ts
      password-reset-tokens.types.ts

    refresh/
      refresh-token.entity.ts
      refresh-tokens.service.ts
      refresh-tokens.types.ts

    jwt/
      jwt-tokens.service.ts
      jwt-tokens.types.ts
```

Session management should stay separate:

```text
src/auth/
  sessions/
    session.entity.ts
    sessions.service.ts
    sessions.types.ts
```

## Rationale

- Each token type is now a small feature area, not just a single entity or helper.
- Service, entity, and type definitions for the same token should be close to each other.
- Navigation becomes easier when working on one token flow.
- Future token-specific code can be added without spreading files across several folders.

## Scope

- Move token entities into their matching token folders.
- Move token types into their matching token folders.
- Keep token services close to their entities and types.
- Move JWT-specific service and types into `tokens/jwt/`.
- Update imports.
- Keep behavior unchanged.
- Run tests after the refactor.

## Out of Scope

- Changing token behavior.
- Changing database schema.
- Changing migrations.
- Changing cleanup behavior.
- Adding session management.

## Suggested Timing

Do this as a separate refactor after session management is completed and stabilized.

Avoid combining this refactor with feature work, because moving files will create many import-only
changes and make review harder.
