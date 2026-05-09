import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getCurrentUser,
  logoutCurrentUser,
  type User,
} from '../auth/authSession';
import { formatDate } from '../utils/formatDate';
import { LoadingOverlay } from '../components/LoadingOverlay';

export function ProfilePage() {
  const navigate = useNavigate();
  const [userData, setUserData] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  useEffect(() => {
    async function loadUserData() {
      try {
        setIsLoading(true);
        setErrorMessage(null);
        const result = await getCurrentUser();
        if (result.status === 'unauthenticated') {
          navigate('/login');
          return;
        }
        if (result.status === 'error') {
          setErrorMessage(result.message);
          return;
        }

        setUserData(result.user);
      } catch {
        setErrorMessage('Something went wrong. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    }

    loadUserData();
  }, [navigate]);

  async function handleSignOut() {
    setIsLoading(true);
    try {
      const result = await logoutCurrentUser();
      if (result.status === 'success') {
        navigate('/login');
      }
      if (result.status === 'error') {
        setErrorMessage(result.message);
      }
    } catch {
      setErrorMessage('Something went wrong. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="profile-page">
      <h1 className="profile-page-title">Profile</h1>
      <div className="profile-card">
        {isLoading && <LoadingOverlay />}
        {!isLoading && errorMessage && <p>{errorMessage}</p>}
        {!isLoading && !errorMessage && userData && (
          <dl className="profile-details">
            <dt>Email:</dt>
            <dd>{userData.email}</dd>
            <dt>User ID:</dt>
            <dd>{userData.id}</dd>
            <dt>Created at:</dt>
            <dd>{formatDate(userData.created_at)}</dd>
            <dt>Updated at:</dt>
            <dd>{formatDate(userData.updated_at)}</dd>
          </dl>
        )}
        {!isLoading && userData && (
          <button className="button" type="button" onClick={handleSignOut}>
            Sign out
          </button>
        )}
      </div>
    </div>
  );
}
