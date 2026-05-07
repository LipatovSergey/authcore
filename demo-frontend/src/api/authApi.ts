import { apiRequest } from './client';

interface RegisterData {
  email: string;
  password: string;
}
interface RegisterResponse {
  message: string;
}
export function register(data: RegisterData) {
  return apiRequest<RegisterResponse>({
    path: '/auth/register',
    method: 'POST',
    body: data,
  });
}

interface LoginData {
  email: string;
  password: string;
}
interface LoginResponse {
  access_token: string;
  refresh_token: string;
}
export function login(data: LoginData) {
  return apiRequest<LoginResponse>({
    path: '/auth/login',
    method: 'POST',
    body: data,
  });
}

interface GetMeResponse {
  id: string;
  email: string;
  created_at: string;
  updated_at: string;
}
export function getMe(accessToken: string) {
  return apiRequest<GetMeResponse>({
    path: '/auth/me',
    method: 'GET',
    accessToken: accessToken,
  });
}

export interface RefreshResponse {
  access_token: string;
  refresh_token: string;
}
export function refresh(refreshToken: string) {
  return apiRequest<RefreshResponse>({
    path: '/auth/refresh',
    method: 'POST',
    body: {
      refresh_token: refreshToken,
    },
  });
}

interface LogoutResponse {
  message: string;
}
export function logout(refresh_token: string) {
  return apiRequest<LogoutResponse>({
    path: '/auth/logout',
    method: 'POST',
    body: {
      refresh_token: refresh_token,
    },
  });
}

interface ForgotPasswordResponse {
  message: string;
}
export function forgotPassword(email: string) {
  return apiRequest<ForgotPasswordResponse>({
    path: '/auth/forgot-password',
    method: 'POST',
    body: {
      email: email,
    },
  });
}

interface ResetPasswordData {
  token: string;
  password: string;
}
interface ResetPasswordResponse {
  message: string;
}
export function resetPassword(data: ResetPasswordData) {
  return apiRequest<ResetPasswordResponse>({
    path: '/auth/reset-password',
    method: 'POST',
    body: data,
  });
}

interface ResendEmailVerificationResponse {
  message: string;
}
export function resendEmailVerification(email: string) {
  return apiRequest<ResendEmailVerificationResponse>({
    path: '/auth/email-verification/resend',
    method: 'POST',
    body: { email: email },
  });
}
