export function ForgotPasswordPage() {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">Reset password</h1>
        <form className="auth-form">
          <div className="form-field">
            <label className="form-label" htmlFor="email">
              Email
            </label>
            <input
              className="form-input"
              id="email"
              name="email"
              type="email"
              autoComplete="email"
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
