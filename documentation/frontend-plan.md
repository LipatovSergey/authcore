# AuthCore Demo Frontend Plan

  ## Goal

  Build a small React + Vite + TypeScript frontend for AuthCore.

  The frontend is not a separate large product. Its purpose is to demonstrate that the backend auth service works end-to-end:

  - registration
  - email verification
  - login
  - protected profile
  - refresh token flow
  - logout / logout all
  - forgot password
  - reset password
  - demo notifications outbox

  Keep implementation simple, readable, and portfolio-friendly.

  ## Backend Context

  Backend: NestJS AuthCore API.

  Expected local backend URL:

  VITE_API_BASE_URL=http://localhost:3000

  Backend CORS expects frontend origin:

  FRONTEND_ORIGIN=http://localhost:5173

  Backend demo notification outbox must be enabled:

  ENABLE_DEMO_NOTIFICATIONS_OUTBOX=true

  Important backend endpoints:

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

  GET    /demo/notifications-outbox
  DELETE /demo/notifications-outbox

  Email verification link is opened through the backend and redirects to frontend:

  EMAIL_VERIFICATION_RESULT_URL=http://localhost:5173/email-verification-result

  Password reset link should point directly to frontend:

  PASSWORD_RESET_PAGE_URL=http://localhost:5173/reset-password

  ## Tech Stack

  Use:

  - React
  - Vite
  - TypeScript
  - React Router
  - plain CSS or CSS modules

  Avoid overengineering:

  - no Redux
  - no heavy UI framework
  - no complex auth abstraction
  - no SSR
  - no backend changes unless absolutely necessary

  ## Suggested Repository Layout

  If frontend lives inside the same repo, use:

  authcore/
    src/                  # existing backend
    test/
    demo-frontend/
      src/
        api/
        auth/
        components/
        pages/
        styles/

  If creating a separate repo, keep the same internal frontend structure.

  ## Frontend Routes

  Implement these routes:

  /                         Home / navigation
  /register                 Register form
  /login                    Login form
  /me                       Protected profile page
  /forgot-password          Forgot password form
  /reset-password           Reset password form, reads token from query params
  /email-verification-result Reads status from query params
  /demo/notifications       Demo notifications outbox

  ## API Client

  Create a small fetch wrapper:

  Responsibilities:

  - prepend VITE_API_BASE_URL
  - send JSON body
  - parse JSON response
  - attach Authorization: Bearer <accessToken> when needed
  - handle non-2xx responses consistently

  Keep it simple. Example behavior:

  - return response body on success
  - throw an error with status/message on failure

  ## Token Storage Policy

  For demo purposes, use localStorage or memory + localStorage.

  Recommended for this project:

  - store access_token in memory/localStorage
  - store refresh_token in localStorage
  - add README note that this is a demo tradeoff

  Reason: backend currently returns refresh token in response body, not as httpOnly cookie. The frontend should match current
  backend design instead of redesigning auth storage now.

  ## Auth State

  Create a small auth module/context.

  Minimum state:

  accessToken: string | null
  refreshToken: string | null
  user: User | null
  isAuthenticated: boolean

  Minimum actions:

  login(email, password)
  logout()
  logoutAll()
  refresh()
  loadProfile()

  Behavior:

  - after login, save tokens and fetch /auth/me
  - /me requires access token
  - logout calls backend /auth/logout, then clears local state
  - logout all calls backend /auth/logout-all, then clears local state
  - if /auth/me returns 401, optionally try refresh once
  - if refresh fails, clear auth state

  ## Pages

  ### Home

  Show simple navigation and current auth status.

  Links:

  - Register
  - Login
  - Profile
  - Forgot password
  - Demo notifications

  ### Register

  Form:

  - email
  - password

  On success:

  - show message: “Registration successful. Check demo notifications outbox for verification link.”
  - link to /demo/notifications

  Do not auto-login after registration because backend requires email verification first.

  ### Email Verification Result

  Reads:

  ?status=verified
  ?status=already_verified
  ?status=invalid

  Display clear messages:

  - verified: email verified, user can login
  - already_verified: email already verified
  - invalid: verification link is invalid or expired

  Add link to login.

  ### Demo Notifications Outbox

  Call:

  GET /demo/notifications-outbox
  DELETE /demo/notifications-outbox

  Display messages:

  - type
  - recipient
  - createdAt
  - clickable link

  This page is important for demo because backend does not send real emails.

  Add refresh button and clear button.

  ### Login

  Form:

  - email
  - password

  On success:

  - store tokens
  - fetch profile
  - navigate to /me

  Handle common errors:

  - invalid credentials
  - email is not verified

  If email not verified:

  - show hint to check notifications outbox
  - optionally show resend verification form/link

  ### Profile /me

  Protected page.

  Show:

  - user id
  - email
  - created_at
  - updated_at

  Buttons:

  - logout
  - logout all
  - refresh profile

  If not authenticated, redirect or show link to login.

  ### Forgot Password

  Form:

  - email

  Always show generic success message:

  “Если аккаунт существует, ссылка для сброса пароля появится в demo notifications outbox.”

  Do not reveal whether email exists.

  ### Reset Password

  Read token from query params:

  /reset-password?token=...

  Form:

  - new password

  On success:

  - show success message
  - link to login

  Important behavior:

  - password reset does not verify email
  - if user is still unverified, login should still fail until email verification

  ## Styling Direction

  Keep UI simple but intentional.

  Avoid spending too much time on design.

  Suggested style:

  - clean dashboard/auth-panel layout
  - readable typography
  - visible status messages
  - clear distinction between normal auth pages and demo outbox

  No need for animations unless quick.

  ## README Updates

  Add frontend run instructions.

  Backend env should include:

  FRONTEND_ORIGIN=http://localhost:5173
  EMAIL_VERIFICATION_RESULT_URL=http://localhost:5173/email-verification-result
  PASSWORD_RESET_PAGE_URL=http://localhost:5173/reset-password
  ENABLE_DEMO_NOTIFICATIONS_OUTBOX=true

  Frontend env:

  VITE_API_BASE_URL=http://localhost:3000

  Add note:

  - demo frontend stores tokens in browser storage for simplicity
  - production apps should evaluate storage strategy carefully
  - demo notifications outbox replaces real email delivery

  ## Implementation Order

  1. Scaffold React + Vite + TypeScript frontend.
  2. Add routing and base layout.
  3. Add API client.
  4. Add auth token storage helpers.
  5. Implement register page.
  6. Implement demo notifications outbox.
  7. Implement email verification result page.
  8. Implement login page.
  9. Implement auth context/state.
  10. Implement profile page.
  11. Implement logout/logout-all.
  12. Implement forgot password page.
  13. Implement reset password page.
  14. Add refresh-token handling.
  15. Polish UX messages.
  16. Update README.
  17. Manually test full flows.

  ## Manual Test Scenarios

  ### Registration + Verification + Login

  1. Register new user.
  2. Open demo notifications outbox.
  3. Click email verification link.
  4. Confirm frontend result page shows verified.
  5. Login.
  6. Open /me.

  ### Unverified Login Block

  1. Register new user.
  2. Try login before verification.
  3. Confirm login fails with email verification message.

  ### Resend Verification

  1. Register user.
  2. Trigger resend verification if frontend implements it.
  3. Confirm previous link becomes invalid if tested manually.
  4. Confirm new link verifies email.

  ### Forgot + Reset Password

  1. Request forgot password.
  2. Open demo notifications outbox.
  3. Click reset password link.
  4. Set new password.
  5. Login with new password.

  ### Reset Password Does Not Verify Email

  1. Register user but do not verify email.
  2. Request password reset.
  3. Reset password.
  4. Try login.
  5. Confirm login is still blocked until email verification.

  ### Logout

  1. Login.
  2. Logout current session.
  3. Confirm local auth state is cleared.
  4. Confirm protected page is no longer accessible.

  ### Logout All

  1. Login.
  2. Call logout all.
  3. Confirm local auth state is cleared.
  4. Refresh token should no longer work.

  ## Scope Control

  Do not add:

  - real SMTP
  - OAuth
  - password strength meter
  - admin panel
  - complex role system
  - refresh token cookies
  - deployment pipeline

  Those are future improvements, not required for this demo frontend.
