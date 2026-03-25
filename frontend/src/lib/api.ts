import axios, { type InternalAxiosRequestConfig } from 'axios';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000/api';

const MAX_RETRIES = 2;

interface RetryableConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
  _retryCount?: number;
}

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
  timeout: 30_000,
});

// Request interceptor - Add JWT token to all requests
// TODO: Remove after Phase 4 - Backward compatibility only
api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('accessToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Deduplicated token refresh — all concurrent 401s share one refresh call
let refreshPromise: Promise<string | null> | null = null;

function doRefresh(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      const refreshData = refreshToken ? { refreshToken } : {};

      const res = await axios.post(
        `${API_BASE_URL}/auth/refresh`,
        refreshData,
        { withCredentials: true }
      );

      const newAccessToken =
        res.data?.data?.tokens?.accessToken;
      if (newAccessToken) {
        localStorage.setItem('accessToken', newAccessToken);
      }
      return newAccessToken ?? null;
    } catch (err) {
      console.error('Token refresh failed:', err);
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      throw err;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

// Response interceptor - Handle errors and token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as RetryableConfig | undefined;

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/refresh')
    ) {
      originalRequest._retry = true;

      if (typeof window !== 'undefined') {
        try {
          await doRefresh();
          return api(originalRequest);
        } catch {
          return Promise.reject(error);
        }
      }
    }

    if (error.response?.status === 403) {
      console.error('Access denied. Please upgrade your subscription.');
    }

    if (error.response?.status === 429) {
      const errorData = error.response?.data?.error;
      if (errorData?.code === 'CONVERSATION_LIMIT') {
        console.warn('Conversation limit reached:', errorData.details);
      } else {
        console.error('Too many requests. Please try again later.');
      }
    }

    return Promise.reject(error);
  }
);

// Retry interceptor - Retry GET requests on 5xx and network errors
api.interceptors.response.use(undefined, async (error) => {
  const config = error.config as RetryableConfig | undefined;
  if (!config) return Promise.reject(error);

  const retryCount = config._retryCount ?? 0;
  if (retryCount >= MAX_RETRIES) return Promise.reject(error);

  const isServerError = error.response && error.response.status >= 500;
  const isNetworkError =
    !error.response &&
    (error.code === 'ECONNABORTED' || error.code === 'ERR_NETWORK');
  const isGet = config.method?.toLowerCase() === 'get';

  if ((isServerError || isNetworkError) && isGet) {
    config._retryCount = retryCount + 1;
    const delay = Math.pow(2, config._retryCount - 1) * 1000;
    await new Promise((resolve) => setTimeout(resolve, delay));
    return api(config);
  }

  return Promise.reject(error);
});

export default api;
