import { Routes, Route, Navigate } from 'react-router-dom';
import { RegisterPage } from './pages/RegisterPage';
import { EmailVerificationResultPage } from './pages/EmailVerificationResultPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { ProfilePage } from './pages/ProfilePage';
import { SignInPage } from './pages/LoginPage';
import { DemoNotificationsPage } from './pages/DemoNotificationsPage';
import { AppLayout } from './components/AppLayout';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';

function App() {
  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/login" element={<SignInPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route
          path="/email-verification-result"
          element={<EmailVerificationResultPage />}
        />
        <Route path="/demo-notifications" element={<DemoNotificationsPage />} />
      </Routes>
    </AppLayout>
  );
}

export default App;
