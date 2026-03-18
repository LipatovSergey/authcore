## Final Email Verification Implementation for AuthCore

### Approach

* **Mandatory email verification**
* **Login is blocked** until email is verified
* **Stateful one-time token**
* **Separate verification tokens table**
* **Token stored as hash**
* **Resend invalidates previous token**

---

## Entities

### User

* `email`
* `passwordHash`
* `isEmailVerified`
* `emailVerifiedAt`

### EmailVerificationToken

* `userId`
* `tokenHash`
* `expiresAt`
* `usedAt`

---

## Flow

### Register

* create user with `isEmailVerified = false`
* create verification token
* store token hash
* send email with verification link

### Verify Email

* receive token
* find record by hash
* check token is not expired
* check token is not used
* set `isEmailVerified = true`
* set `emailVerifiedAt`
* mark token as used

### Login

* if `isEmailVerified = false` → reject
* if `isEmailVerified = true` → proceed with normal login flow

### Resend Verification

* check cooldown / rate limit
* invalidate previous active token
* create new token
* send new email

---

## Rules

* one active verification token per user
* token is one-time use
* token has TTL
* only token hash is stored in DB
* old token becomes invalid after resend
* unverified user cannot log in

---

## Behavior Recommendations

* create user immediately in `users`
* store as **unverified**
* optionally clean up old unverified accounts with a background job

---

## Architecture Separation

* **Auth module** — register, login, verify, resend
* **Verification service** — token generation, hashing, validation, invalidation
* **Mail service** — email sending only
* **User service/repository** — update verification status

---

## Final Model

**registered user != active user**
**verified email = account activation**
