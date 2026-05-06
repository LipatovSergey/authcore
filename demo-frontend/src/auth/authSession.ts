import { getMe, refresh } from '../api/authApi';
import type { RefreshResponse } from '../api/authApi';
import { ApiError } from '../api/client';
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  saveTokens,
} from './tokenStorage';

export interface User {
  id: string;
  email: string;
  created_at: string;
  updated_at: string;
}

type GetCurrentUserResult =
  | { status: 'authenticated'; user: User }
  | { status: 'unauthenticated' }
  | { status: 'error'; message: string };

let refreshPromise: Promise<RefreshResponse> | null = null;
function refreshTokensOnce(refreshToken: string) {
  if (!refreshPromise) {
    refreshPromise = refresh(refreshToken).finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

async function refreshAndLoadCurrentUser(): Promise<GetCurrentUserResult> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    clearTokens();
    return { status: 'unauthenticated' };
  }
  try {
    const tokens = await refreshTokensOnce(refreshToken);
    saveTokens(tokens);
    const user = await getMe(tokens.access_token);
    return { status: 'authenticated', user };
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      clearTokens();
      return { status: 'unauthenticated' };
    }
    return {
      status: 'error',
      message: 'Something went wrong. Please try again later',
    };
  }
}

export async function getCurrentUser(): Promise<GetCurrentUserResult> {
  const accessToken = getAccessToken();
  if (!accessToken) {
    return { status: 'unauthenticated' };
  }
  try {
    const user = await getMe(accessToken);
    return { status: 'authenticated', user };
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return await refreshAndLoadCurrentUser();
    }
    return {
      status: 'error',
      message: 'Something went wrong. Please try again later',
    };
  }
}
