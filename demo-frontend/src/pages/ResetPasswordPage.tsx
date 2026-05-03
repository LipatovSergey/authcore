export function ResetPasswordPage() {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">Reset password</h1>
        <form className="auth-form">
          <div className="form-field">
            <label className="form-label" htmlFor="password">
              New password
            </label>
            <input
              className="form-input"
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
            />
          </div>
          <div className="form-field">
            <label className="form-label" htmlFor="confirm-password">
              Confirm password
            </label>
            <input
              className="form-input"
              id="confirm-password"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
            />
          </div>

          <button className="form-submit-button" type="submit">
            Reset password
          </button>
        </form>
      </div>
    </div>
  );
}
