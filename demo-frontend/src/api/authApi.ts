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

interface GetMeData {
  accessToken: string;
}
interface GetMeResponse {
  id: string;
  email: string;
  created_at: string;
  updated_at: string;
}
export function getMe(data: GetMeData) {
  return apiRequest<GetMeResponse>({
    path: '/auth/me',
    method: 'GET',
    accessToken: data.accessToken,
  });
}

interface LogoutData {
  refresh_token: string;
}
interface LogoutResponse {
  message: string;
}
export function logout(data: LogoutData) {
  return apiRequest<LogoutResponse>({
    path: '/auth/logout',
    method: 'POST',
    body: data,
  });
}

interface ForgotPasswordData {
  email: string;
}
interface ForgotPasswordResponse {
  message: string;
}
export function forgotPassword(data: ForgotPasswordData) {
  return apiRequest<ForgotPasswordResponse>({
    path: '/auth/forgot-password',
    method: 'POST',
    body: data,
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
