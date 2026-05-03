export interface ApiError {
  status: number;
  message: string;
}

interface ApiRequestInput {
  path: string;
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT';
  body?: object;
  accessToken?: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export async function apiRequest<TResponse>(
  input: ApiRequestInput,
): Promise<TResponse> {
  if (!API_BASE_URL) {
    throw new Error('VITE_API_BASE_URL is not defined');
  }
  const { path, method, body, accessToken } = input;
  const fullUrl = `${API_BASE_URL}${path}`;
  const headers: Record<string, string> = {};
  if (body) {
    headers['Content-Type'] = 'application/json';
  }
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const response = await fetch(fullUrl, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw {
      status: response.status,
      message: data.message ?? 'Request failed',
    };
  }

  return data;
}
