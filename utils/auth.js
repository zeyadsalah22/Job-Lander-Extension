// Authentication utilities for Job Lander Extension
// Leverages frontend authentication instead of duplicating login
class AuthManager {
  constructor() {
    this.API_BASE_URL = 'http://localhost:5253/api';
    this.FRONTEND_URL = 'http://localhost:5173'; // Vite dev server default
    this.storage = chrome.storage.local; // Fallback to extension storage
  }

  // Get tokens from frontend localStorage OR extension storage
  async getTokensFromFrontend() {
    try {
      console.log('Job Lander: Getting tokens from frontend...');
      
      // First try to get from frontend tab if available
      const frontendTokens = await this.getFromFrontendTab();
      
      if (frontendTokens.hasTokens) {
        console.log('Job Lander: Found tokens in frontend localStorage');
        // Store in extension storage for future use
        await this.storage.set({
          'cached_access_token': frontendTokens.accessToken,
          'cached_refresh_token': frontendTokens.refreshToken
        });
        return frontendTokens;
      }

      console.log('Job Lander: No tokens in frontend, checking extension storage...');
      
      // Fallback to extension storage (cached tokens)
      const result = await this.storage.get(['cached_access_token', 'cached_refresh_token']);
      const accessToken = result.cached_access_token;
      const refreshToken = result.cached_refresh_token;

      if (accessToken && refreshToken) {
        console.log('Job Lander: Found cached tokens in extension storage');
      } else {
        console.log('Job Lander: No tokens found anywhere');
      }

      return {
        accessToken,
        refreshToken,
        hasTokens: !!(accessToken && refreshToken)
      };
    } catch (error) {
      console.error('Job Lander: Error accessing tokens:', error);
      return { accessToken: null, refreshToken: null, hasTokens: false };
    }
  }

  // Try to get tokens from frontend tab
  async getFromFrontendTab() {
    try {
      console.log('Job Lander: Attempting to access frontend localStorage...');
      
      const [accessToken, refreshToken] = await Promise.all([
        this.getFromLocalStorage('access'),  // Match background.js key
        this.getFromLocalStorage('refreshToken')  // Match background.js key
      ]);

      console.log('Job Lander: Frontend localStorage access result:', {
        hasAccessToken: !!accessToken,
        hasRefreshToken: !!refreshToken
      });

      return {
        accessToken,
        refreshToken,
        hasTokens: !!(accessToken && refreshToken)
      };
    } catch (error) {
      console.warn('Job Lander: Could not access frontend tab:', error);
      return { accessToken: null, refreshToken: null, hasTokens: false };
    }
  }

  // Get user data from frontend localStorage
  async getUserDataFromFrontend() {
    try {
      const [userId, email, fullName, role] = await Promise.all([
        this.getFromLocalStorage('userId'),
        this.getFromLocalStorage('email'),
        this.getFromLocalStorage('fullName'),
        this.getFromLocalStorage('role')
      ]);

      // Also get user from Zustand store if available
      const zustandUser = await this.getFromLocalStorage('user');
      let parsedUser = null;
      if (zustandUser) {
        try {
          const userStore = JSON.parse(zustandUser);
          parsedUser = userStore.state?.user;
        } catch (e) {
          console.warn('Could not parse user store:', e);
        }
      }

      // Extract firstName - try parsedUser first, then parse from fullName
      let firstName = parsedUser?.firstName || parsedUser?.first_name;
      if (!firstName && fullName) {
        // Extract first name from fullName (e.g., "John Doe" -> "John")
        firstName = fullName.split(' ')[0];
      }

      return {
        userId,
        email,
        fullName,
        firstName,
        role: role ? parseInt(role) : 0,
        user: parsedUser,
        hasUserData: !!(userId && email)
      };
    } catch (error) {
      console.error('Error accessing frontend user data:', error);
      return { hasUserData: false };
    }
  }

  // Helper to access localStorage from extension with security handling
  async getFromLocalStorage(key) {
    return new Promise((resolve) => {
      try {
        // Execute script in the context of the frontend tab
        chrome.tabs.query({ url: `${this.FRONTEND_URL}/*` }, (tabs) => {
          if (tabs.length > 0) {
            chrome.scripting.executeScript({
              target: { tabId: tabs[0].id },
              func: (storageKey) => {
                try {
                  // Check if localStorage is available and accessible
                  if (typeof Storage === "undefined" || !window.localStorage) {
                    return { error: 'localStorage not available', value: null };
                  }

                  // Try to access localStorage with error handling
                  const value = localStorage.getItem(storageKey);
                  return { error: null, value: value };
                } catch (error) {
                  // Handle sandboxing and other security errors
                  console.warn('localStorage access denied:', error.message);
                  return { error: error.message, value: null };
                }
              },
              args: [key]
            }, (results) => {
              if (chrome.runtime.lastError) {
                console.warn('Could not execute script:', chrome.runtime.lastError);
                resolve(null);
              } else {
                const result = results?.[0]?.result;
                if (result && result.error) {
                  console.warn(`localStorage access error for key "${key}":`, result.error);
                  resolve(null);
                } else {
                  resolve(result?.value || null);
                }
              }
            });
          } else {
            console.log('No frontend tab found for localStorage access');
            resolve(null);
          }
        });
      } catch (error) {
        console.warn('Error accessing localStorage:', error);
        resolve(null);
      }
    });
  }

  // Check if user is authenticated in the frontend
  async isAuthenticated() {
    const { accessToken, refreshToken, hasTokens } = await this.getTokensFromFrontend();
    
    if (!hasTokens) {
      return false;
    }

    try {
      // Validate access token
      if (this.isTokenValid(accessToken)) {
        return true;
      }

      // Try to refresh if access token is expired but refresh token exists
      if (refreshToken) {
        const newToken = await this.refreshToken(refreshToken);
        return !!newToken;
      }

      return false;
    } catch (error) {
      console.error('Error validating authentication:', error);
      return false;
    }
  }

  // Validate JWT token
  isTokenValid(token) {
    if (!token) return false;

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Date.now() / 1000;
      
      // Check if token is expired (with 5 minute buffer)
      return payload.exp && payload.exp > (currentTime + 300);
    } catch (error) {
      console.error('Error validating token:', error);
      return false;
    }
  }

  // Refresh token using the same mechanism as frontend
  async refreshToken(refreshToken) {
    try {
      const response = await fetch(`${this.API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      });

      if (response.ok) {
        const data = await response.json();
        
        // Update tokens in frontend localStorage via content script
        await this.updateFrontendTokens(data);
        
        return data.token;
      } else {
        // Refresh failed, redirect to frontend for re-authentication
        await this.redirectToFrontend();
        return null;
      }
    } catch (error) {
      console.error('Token refresh error:', error);
      await this.redirectToFrontend();
      return null;
    }
  }

  // Update tokens in frontend localStorage with security handling
  async updateFrontendTokens(tokenData) {
    try {
      chrome.tabs.query({ url: `${this.FRONTEND_URL}/*` }, (tabs) => {
        if (tabs.length > 0) {
          chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            func: (data) => {
              try {
                // Check if localStorage is available
                if (typeof Storage === "undefined" || !window.localStorage) {
                  return { success: false, error: 'localStorage not available' };
                }

                // Update localStorage with new tokens (same as frontend does)
                localStorage.setItem("access", data.token);
                localStorage.setItem("refreshToken", data.refreshToken);
                
                // Update additional user info if provided
                if (data.userId) localStorage.setItem("userId", data.userId);
                if (data.email) localStorage.setItem("email", data.email);
                if (data.fullName) localStorage.setItem("fullName", data.fullName);
                if (data.role !== undefined) localStorage.setItem("role", data.role);
                if (data.expiresAt) localStorage.setItem("expiresAt", data.expiresAt);

                return { success: true, error: null };
              } catch (error) {
                console.warn('Failed to update localStorage:', error.message);
                return { success: false, error: error.message };
              }
            },
            args: [tokenData]
          }, (results) => {
            if (chrome.runtime.lastError) {
              console.warn('Could not update frontend tokens:', chrome.runtime.lastError);
            } else {
              const result = results?.[0]?.result;
              if (result && !result.success) {
                console.warn('Frontend token update failed:', result.error);
              } else {
                console.log('Frontend tokens updated successfully');
              }
            }
          });
        }
      });
    } catch (error) {
      console.error('Error updating frontend tokens:', error);
    }
  }

  // Redirect user to frontend for authentication
  async redirectToFrontend() {
    try {
      await chrome.tabs.create({
        url: this.FRONTEND_URL,
        active: true
      });
    } catch (error) {
      console.error('Error opening frontend:', error);
    }
  }

  // Get current access token (with automatic refresh if needed)
  async getValidToken() {
    const { accessToken, refreshToken } = await this.getTokensFromFrontend();
    
    if (!accessToken) {
      return null;
    }

    // If token is valid, return it
    if (this.isTokenValid(accessToken)) {
      return accessToken;
    }

    // Try to refresh token
    if (refreshToken) {
      return await this.refreshToken(refreshToken);
    }

    return null;
  }

  // Get user info from login response or frontend storage
  async getUserInfo() {
    // Try to get from frontend storage first
    const frontendUser = await this.getUserDataFromFrontend();
    if (frontendUser.hasUserData) {
      return frontendUser;
    }

    // Try to get from extension storage (cached from login)
    try {
      const result = await this.storage.get(['cached_user_data']);
      return result.cached_user_data || null;
    } catch (error) {
      console.error('Error getting cached user data:', error);
      return null;
    }
  }

  // Check if user should be redirected to frontend for auth
  async requiresAuthentication() {
    const isAuth = await this.isAuthenticated();
    if (!isAuth) {
      await this.redirectToFrontend();
      return true;
    }
    return false;
  }

  // Simple login method for extension (fallback)
  async login(email, password) {
    try {
      const response = await fetch(`${this.API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: email, password: password }),
      });

      const data = await response.json();

      if (response.ok && data.token) {
        // Store tokens and user data in extension storage
        await this.storage.set({
          'cached_access_token': data.token,
          'cached_refresh_token': data.refreshToken,
          'cached_user_data': {
            userId: data.userId,
            email: data.email,
            fullName: data.fullName,
            role: data.role
          }
        });

        // Also try to store in frontend if tab is available
        try {
          await this.updateFrontendTokens(data);
        } catch (e) {
          console.warn('Could not update frontend tokens:', e);
        }

        return { success: true, user: { userId: data.userId, email: data.email, fullName: data.fullName, role: data.role } };
      } else {
        return { success: false, error: data.message || 'Login failed' };
      }
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Network error occurred' };
    }
  }

  // Remove tokens (logout)
  async logout() {
    try {
      await this.storage.clear();
      // Try to clear frontend tokens if available
      try {
        chrome.tabs.query({ url: `${this.FRONTEND_URL}/*` }, (tabs) => {
          if (tabs.length > 0) {
            chrome.scripting.executeScript({
              target: { tabId: tabs[0].id },
              func: () => {
                localStorage.removeItem('access');
                localStorage.removeItem('refreshToken');
                localStorage.removeItem('userId');
                localStorage.removeItem('email');
                localStorage.removeItem('fullName');
                localStorage.removeItem('role');
                localStorage.removeItem('expiresAt');
              }
            });
          }
        });
      } catch (e) {
        console.warn('Could not clear frontend tokens:', e);
      }
      return true;
    } catch (error) {
      console.error('Error during logout:', error);
      return false;
    }
  }

  // Make authenticated API request (updated to use shared tokens)
  async apiRequest(endpoint, options = {}) {
    const token = await this.getValidToken();
    if (!token) {
      await this.redirectToFrontend();
      throw new Error('No authentication token available');
    }

    const defaultOptions = {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    };

    const mergedOptions = {
      ...defaultOptions,
      ...options,
      headers: {
        ...defaultOptions.headers,
        ...options.headers,
      },
    };

    try {
      const response = await fetch(`${this.API_BASE_URL}${endpoint}`, mergedOptions);
      
      if (response.status === 401) {
        // Try to refresh token one more time
        const refreshedToken = await this.getValidToken();
        if (refreshedToken && refreshedToken !== token) {
          // Retry with new token
          mergedOptions.headers['Authorization'] = `Bearer ${refreshedToken}`;
          return await fetch(`${this.API_BASE_URL}${endpoint}`, mergedOptions);
        } else {
          // Refresh failed, redirect to frontend
          await this.redirectToFrontend();
          throw new Error('Authentication expired');
        }
      }

      return response;
    } catch (error) {
      console.error('API request error:', error);
      throw error;
    }
  }
}

// Export singleton instance
const authManager = new AuthManager();
export default authManager;
