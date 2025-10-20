import React, { useState, useEffect } from 'react';
import Dashboard from './Dashboard';
import LoginForm from './LoginForm';
import authManager from '../../utils/auth';

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [showLogin, setShowLogin] = useState(false);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const authenticated = await authManager.isAuthenticated();
      setIsAuthenticated(authenticated);
      
      if (authenticated) {
        const userInfo = await authManager.getUserInfo();
        setUser(userInfo);
        setShowLogin(false);
      } else {
        // Check if we should show login or redirect to frontend
        setShowLogin(false); // Start with redirect option
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setIsAuthenticated(false);
      setShowLogin(false);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setLoading(true);
    await checkAuthStatus();
  };

  const handleLogin = async (credentials) => {
    try {
      const result = await authManager.login(credentials.email, credentials.password);
      
      if (result.success) {
        setIsAuthenticated(true);
        setUser(result.user);
        setShowLogin(false);
        return { success: true };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      return { success: false, error: 'Login failed' };
    }
  };

  const handleLogout = async () => {
    try {
      await authManager.logout();
      setIsAuthenticated(false);
      setUser(null);
      setShowLogin(false);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-w-[380px] min-h-[500px] flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm text-muted-foreground">Checking authentication...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    if (showLogin) {
      return <LoginForm onLogin={handleLogin} onBack={() => setShowLogin(false)} />;
    }

    return (
      <div className="min-w-[380px] min-h-[500px] bg-background flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 bg-gradient-primary rounded-full flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold mb-2">Authentication Required</h2>
        <p className="text-muted-foreground mb-6">
          Please sign in to your Job Lander account to use the extension.
        </p>
        
        <div className="w-full space-y-3">
          <button
            onClick={() => authManager.redirectToFrontend()}
            className="w-full bg-primary text-primary-foreground px-6 py-3 rounded-md hover:bg-primary/90 transition-colors font-medium"
          >
            Open Job Lander App
          </button>
          
          <div className="flex items-center space-x-4">
            <hr className="flex-1 border-muted" />
            <span className="text-xs text-muted-foreground">OR</span>
            <hr className="flex-1 border-muted" />
          </div>
          
          <button
            onClick={() => setShowLogin(true)}
            className="w-full bg-secondary text-secondary-foreground px-6 py-3 rounded-md hover:bg-secondary/90 transition-colors font-medium"
          >
            Sign In Here
          </button>
          
          <button
            onClick={handleRefresh}
            className="w-full mt-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            I'm already signed in - Refresh
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-[380px] min-h-[500px] bg-background">
      <Dashboard user={user} onLogout={handleLogout} onRefresh={handleRefresh} />
    </div>
  );
};

export default App;
