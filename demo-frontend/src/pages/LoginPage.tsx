import { Link, useNavigate } from 'react-router-dom';
import { ApiError } from '../api/client';
import { useState } from 'react';
import { login } from '../api/authApi';
import { saveTokens } from '../auth/tokenStorage';

export function SignInPage() {
  const navigate = useNavigate();
  const [statusMessage, setStatusMessage] = useState(null);
  async function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatusMessage(null);
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get('email') ?? '').trim();
    const password = String(formData.get('password') ?? '');
    if (!email || !password) {
      setStatusMessage('All fields are required.');
      return;
    }
    try {
      const tokens = await login({ email, password });
      saveTokens(tokens);
      navigate('/me');
    } catch (error) {
      let errorText = 'Something went wrong. Please try again later.';
      if (error instanceof ApiError) {
        if (error.status === 401 && error.code === 'EMAIL_NOT_VERIFIED') {
          errorText = 'Email is not verified';
        } else if (error.status === 401 || error.status === 400) {
          errorText = 'Invalid email or password';
        }
      }
      setStatusMessage(errorText);
    }
  }
  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">Sign in</h1>
        <form onSubmit={handleSubmit} className="auth-form">
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
        {statusMessage && (
          <p className={`status-message status-message-error`}>
            {statusMessage}
          </p>
        )}
        <p className="auth-card-footer">
          Don't have an account? <Link to="/register">Create account</Link>
        </p>
      </div>
    </div>
  );
}
