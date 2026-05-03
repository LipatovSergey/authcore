import { Link } from 'react-router-dom';

export function SignInPage() {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">Sign in</h1>
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
              autoComplete="current-password"
            />
          </div>
          <Link className="form-link" to="/forgot-password">
            Forgot password?
          </Link>
          <button className="form-submit-button" type="submit">
            Sign in
          </button>
        </form>
        <p className="auth-card-footer">
          Don't have an account? <Link to="/register">Create account</Link>
        </p>
      </div>
    </div>
  );
}
