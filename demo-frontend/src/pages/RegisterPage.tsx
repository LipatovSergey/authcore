import { useState } from 'react';
import { Link } from 'react-router-dom';
import { register } from '../api/authApi';
import { ApiError } from '../api/client';

type StatusMessage =
  | { type: 'success'; text: string }
  | { type: 'error'; text: string }
  | null;

export function RegisterPage() {
  const [statusMessage, setStatusMessage] = useState<StatusMessage>(null);
  async function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatusMessage(null);
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get('email') ?? '').trim();
    const password = String(formData.get('password') ?? '');
    const confirmPassword = String(formData.get('confirmPassword') ?? '');
    if (!email || !password || !confirmPassword) {
      setStatusMessage({ type: 'error', text: 'All fields are required.' });
      return;
    }
    if (password.length < 12) {
      setStatusMessage({
        type: 'error',
        text: 'Password must have at least 12 characters.',
      });
      return;
    }
    if (password !== confirmPassword) {
      setStatusMessage({ type: 'error', text: 'Passwords do not match.' });
      return;
    }

    try {
      await register({ email, password });
      setStatusMessage({
        type: 'success',
        text: 'Successful registration, check demo notifications for verification link.',
      });
    } catch (error) {
      let errorText = 'Something went wrong. Please try again later.';
      if (error instanceof ApiError) {
        if (error.status === 409) {
          errorText = 'User with such email already exists';
        }
        if (error.status === 400) {
          errorText = 'Some of credentials are invalid';
        }
      }
      setStatusMessage({
        type: 'error',
        text: errorText,
      });
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">Create account</h1>
        <form className="auth-form" onSubmit={handleSubmit}>
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
        {statusMessage && (
          <p className={`status-message status-message-${statusMessage.type}`}>
            {statusMessage.text}
          </p>
        )}
        <p className="auth-card-footer">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
