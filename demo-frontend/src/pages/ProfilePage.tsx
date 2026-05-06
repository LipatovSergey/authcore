import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser, type User } from '../auth/authSession';
import { formatDate } from '../utils/formatDate';

export function ProfilePage() {
  const navigate = useNavigate();
  const [userData, setUserData] = useState<User>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);
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

  return (
    <div>
      <h1>Profile</h1>
      {isLoading && <p>Is loading...</p>}
      {!isLoading && errorMessage && <p>{errorMessage}</p>}
      {!isLoading && !errorMessage && userData && (
        <dl className="profile-details">
          <dt>Email</dt>
          <dd>{userData.email}</dd>
          <dt>User ID</dt>
          <dd>{userData.id}</dd>
          <dt>Created at:</dt>
          <dd>{formatDate(userData.created_at)}</dd>
          <dt>Updated at:</dt>
          <dd>{formatDate(userData.updated_at)}</dd>
        </dl>
      )}
    </div>
  );
}
