import axios from 'axios';

const API_BASE = 'https://squad-j5q6.onrender.com/api';

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request Interceptor: Automatically inject Bearer JWT Token & Cache Lookup
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    const isFirstConnectionReached = (window as any).__firstConnectionReached;
    const isGet = config.method?.toLowerCase() === 'get';
    const isRelative = config.url && !config.url.startsWith('http://') && !config.url.startsWith('https://');

    if (!isFirstConnectionReached && isGet && isRelative) {
      const cacheKey = 'api_cache:' + config.url;
      const cachedDataStr = localStorage.getItem(cacheKey);
      if (cachedDataStr) {
        try {
          const cachedData = JSON.parse(cachedDataStr);
          console.log(`📦 [API Cache] Serving cached data for ${config.url} before first socket connection.`);
          config.adapter = () => {
            return Promise.resolve({
              data: cachedData,
              status: 200,
              statusText: 'OK',
              headers: {},
              config,
            });
          };
        } catch (e) {
          // Ignore parse errors and let the request proceed
        }
      }
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor: Catch authentication expiries (401), cache success, and fallback on failure
api.interceptors.response.use(
  (response) => {
    const { config } = response;
    const isGet = config.method?.toLowerCase() === 'get';
    const isRelative = config.url && !config.url.startsWith('http://') && !config.url.startsWith('https://');

    if (isGet && isRelative) {
      const cacheKey = 'api_cache:' + config.url;
      try {
        localStorage.setItem(cacheKey, JSON.stringify(response.data));
      } catch (e) {
        console.warn('⚡ [API Client] Failed to cache response in localStorage:', e);
      }
    } else if (!isGet && isRelative) {
      // Invalidate relevant cache keys on mutating requests (POST, PUT, DELETE)
      try {
        const url = config.url || '';
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('api_cache:')) {
            const cachedUrl = key.replace('api_cache:', '');
            
            // If we mutate anything under /servers, invalidate the server list and detail cache
            if (url.includes('servers')) {
              if (cachedUrl.includes('servers')) {
                keysToRemove.push(key);
              }
            }
            // If we mutate channels or categories, invalidate the server cache keys
            else if (url.includes('channels') || url.includes('categories')) {
              if (cachedUrl.includes('servers')) {
                keysToRemove.push(key);
              }
            }
            // If we mutate users or auth, invalidate user/auth cache keys
            else if (url.includes('users') || url.includes('auth')) {
              if (cachedUrl.includes('users') || cachedUrl.includes('auth')) {
                keysToRemove.push(key);
              }
            }
            // Logout invalidates everything
            else if (url.includes('auth/logout')) {
              keysToRemove.push(key);
            }
          }
        }
        
        if (keysToRemove.length > 0) {
          console.log(`🧹 [API Cache] Invalidating caches due to mutation at ${url}:`, keysToRemove);
          keysToRemove.forEach(k => localStorage.removeItem(k));
        }
      } catch (e) {
        console.warn('⚡ [API Client] Failed to invalidate cache in localStorage:', e);
      }
    }
    return response;
  },
  (error) => {
    if (error.response && error.response.status === 401) {
      console.warn('⚡ [API Client] Session expired (401 Unauthorized)');
    }

    const config = error.config;
    if (config && config.method?.toLowerCase() === 'get') {
      const isRelative = config.url && !config.url.startsWith('http://') && !config.url.startsWith('https://');
      if (isRelative) {
        const cacheKey = 'api_cache:' + config.url;
        const cachedDataStr = localStorage.getItem(cacheKey);
        if (cachedDataStr) {
          try {
            const cachedData = JSON.parse(cachedDataStr);
            console.warn(`⚠️ [API Client] Network failed for ${config.url}, falling back to stale cache data.`);
            return Promise.resolve({
              data: cachedData,
              status: 200,
              statusText: 'OK',
              headers: error.response?.headers || {},
              config,
            });
          } catch (e) {
            // Ignore parse errors
          }
        }
      }
    }

    return Promise.reject(error);
  }
);

export default api;
