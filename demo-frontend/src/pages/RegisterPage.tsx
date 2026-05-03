import { Link } from 'react-router-dom';

export function RegisterPage() {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">Create account</h1>
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
          <div className="form-field">
            <label className="form-label" htmlFor="password">
              Password
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
            Create account
          </button>
        </form>
        <p className="auth-card-footer">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
