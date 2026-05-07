import { useState } from 'react';
import { forgotPassword } from '../api/authApi';

type StatusMessage =
  | { type: 'success'; text: string }
  | { type: 'error'; text: string }
  | null;

export function ForgotPasswordPage() {
  const [statusMessage, setStatusMessage] = useState<StatusMessage>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  async function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatusMessage(null);
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get('email') ?? '').trim();
    if (!email) {
      setStatusMessage({ type: 'error', text: 'Email is required' });
      return;
    }
    try {
      setIsLoading(true);
      await forgotPassword(email);
      setStatusMessage({
        type: 'success',
        text: 'If an account exists, a password reset link will appear in demo notifications.',
      });
    } catch {
      setStatusMessage({
        type: 'error',
        text: 'Something went wrong. Please try again later.',
      });
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
