import { Link, useNavigate } from 'react-router-dom';
import { ApiError } from '../api/client';
import { useState } from 'react';
import { login, resendEmailVerification } from '../api/authApi';
import { saveTokens } from '../auth/tokenStorage';
import { LoadingOverlay } from '../components/LoadingOverlay';

export function SignInPage() {
  const navigate = useNavigate();
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [showVerificationPanel, setShowVerificationPanel] =
    useState<boolean>(false);
  const [isRequestingVerificationLink, setIsRequestingVerificationLink] =
    useState<boolean>(false);
  const [verificationRequestMessage, setVerificationRequestMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  async function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatusMessage(null);
    setVerificationRequestMessage(null);
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get('email') ?? '').trim();
    const password = String(formData.get('password') ?? '');
    if (!email || !password) {
      setStatusMessage('All fields are required.');
      return;
    }
    try {
      setIsLoading(true);
      const tokens = await login({ email, password });
      saveTokens(tokens);
      navigate('/me');
    } catch (error) {
      let errorText = 'Something went wrong. Please try again later.';
      if (error instanceof ApiError) {
        if (error.status === 401 && error.code === 'EMAIL_NOT_VERIFIED') {
          setUnverifiedEmail(email);
          setShowVerificationPanel(true);
        } else if (error.status === 401 || error.status === 400) {
          errorText = 'Invalid email or password';
        }
      }
      setStatusMessage(errorText);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleResendVerification() {
    if (!unverifiedEmail) {
      setVerificationRequestMessage({
        type: 'error',
        text: 'Could not request a new verification link. Please try again later.',
      });
      return;
    }

    try {
      setIsRequestingVerificationLink(true);
      setVerificationRequestMessage(null);
      await resendEmailVerification(unverifiedEmail);
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
        <h1 className="auth-card-title">Sign in</h1>
        {!showVerificationPanel && (
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
            <Link className="link form-link" to="/forgot-password">
              Forgot password?
            </Link>
            <button className="button form-submit-button" type="submit">
              Sign in
            </button>
            {statusMessage && (
              <p className={`status-message status-message-error`}>
                {statusMessage}
              </p>
            )}
            <p className="auth-card-footer">
              Don't have an account?
              <Link className="link auth-card-footer-link" to="/register">
                Create account
              </Link>
            </p>
          </form>
        )}
        {showVerificationPanel && (
          <div className="verification-panel">
            <p className="verification-panel-text">
              Email verification required. Check demo notifications for the
              verification link. If you need another link, request a new one
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
