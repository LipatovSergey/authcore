import { useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import { resetPassword } from '../api/authApi';
import { ApiError } from '../api/client';

type StatusMessage =
  | { type: 'success'; text: string }
  | { type: 'error'; text: string }
  | null;

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token: string | null = searchParams.get('token');
  const [statusMessage, setStatusMessage] = useState<StatusMessage>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  async function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      setStatusMessage({
        type: 'error',
        text: 'This password reset link is invalid. Please request a new one.',
      });
      return;
    }
    setStatusMessage(null);
    const formData = new FormData(event.currentTarget);
    const password = String(formData.get('password') ?? '');
    const confirmPassword = String(formData.get('confirmPassword') ?? '');
    if (!password || !confirmPassword) {
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
      setIsLoading(true);
      await resetPassword({ token, password });
      setStatusMessage({
        type: 'success',
        text: 'Password has been reset. You can now sign in.',
      });
    } catch (error) {
      let errorText = 'Something went wrong. Please try again later.';
      if (error instanceof ApiError) {
        if (error.status === 400) {
          errorText = 'Password does not meet the requirements.';
        }
        if (error.status === 401) {
          errorText =
            'This password reset link is invalid or expired. Please request a new one.';
        }
      }
      setStatusMessage({ type: 'error', text: errorText });
    } finally {
      setIsLoading(false);
    }
  }
  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">Reset password</h1>
        <form className="auth-form" onSubmit={handleSubmit}>
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

          <button
            className="form-submit-button"
            type="submit"
            disabled={isLoading}
          >
            Reset password
          </button>
        </form>
        {statusMessage && (
          <p className={`status-message status-message-${statusMessage.type}`}>
            {statusMessage.text}
          </p>
        )}
        {isLoading && <p>Is loading...</p>}
      </div>
    </div>
  );
}
