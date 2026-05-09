import { useState } from 'react';
import { Link } from 'react-router-dom';
import { register, resendEmailVerification } from '../api/authApi';
import { ApiError } from '../api/client';
import { LoadingOverlay } from '../components/LoadingOverlay';

type StatusMessage =
  | { type: 'success'; text: string }
  | { type: 'error'; text: string }
  | null;

export function RegisterPage() {
  const [statusMessage, setStatusMessage] = useState<StatusMessage>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);
  const [showVerificationPanel, setShowVerificationPanel] =
    useState<boolean>(false);
  const [isRequestingVerificationLink, setIsRequestingVerificationLink] =
    useState<boolean>(false);
  const [verificationRequestMessage, setVerificationRequestMessage] =
    useState<StatusMessage>(null);

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
      setIsLoading(true);
      await register({ email, password });
      setRegisteredEmail(email);
      setShowVerificationPanel(true);
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
    } finally {
      setIsLoading(false);
    }
  }

  async function handleResendVerification() {
    if (!registeredEmail) {
      setVerificationRequestMessage({
        type: 'error',
        text: 'Could not request a new verification link. Please try again later.',
      });
      return;
    }

    try {
      setIsRequestingVerificationLink(true);
      setVerificationRequestMessage(null);
      await resendEmailVerification(registeredEmail);
      setVerificationRequestMessage({
        type: 'success',
        text: 'If a new verification link was created, it will appear in demo notifications.',
      });
    } catch {
      setVerificationRequestMessage({
        type: 'error',
        text: 'Could not request a new verification link. Please try again later.',
      });
    } finally {
      setIsRequestingVerificationLink(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        {(isLoading || isRequestingVerificationLink) && <LoadingOverlay />}
        <h1 className="auth-card-title">Create account</h1>
        {!showVerificationPanel && (
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
            {statusMessage && (
              <p
                className={`status-message status-message-${statusMessage.type}`}
              >
                {statusMessage.text}
              </p>
            )}
            <button
              className="button form-submit-button"
              type="submit"
              disabled={isLoading}
            >
              Create account
            </button>
            <p className="auth-card-footer">
              Already have an account?
              <Link className="link auth-card-footer-link" to="/login">
                Sign in
              </Link>
            </p>
          </form>
        )}
        {showVerificationPanel && (
          <div className="verification-panel">
            <p className="verification-panel-text">
              Registration successful. A verification link has been created.
              Check notifications. If you need another link, request a new one
              below.
              <button
                type="button"
                className="link link-button"
                onClick={handleResendVerification}
                disabled={isRequestingVerificationLink}
              >
                Request a new link.
              </button>
            </p>

            {verificationRequestMessage && (
              <p
                className={`status-message status-message-${verificationRequestMessage.type}`}
              >
                {verificationRequestMessage.text}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
