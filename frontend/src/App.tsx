import { useState, useEffect } from 'react';
import LoginPage from './components/LoginPage/LoginPage';
import RegisterPage from './components/RegisterPage/RegisterPage';
import HomePage from './components/HomePage/HomePage';
import Preloader from './components/Preloader/Preloader';
import InviteLandingPage from './components/InviteLandingPage/InviteLandingPage';

import api from './utils/api';

export default function App() {
  const [route, setRoute] = useState(window.location.pathname);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handleLocationChange = () => {
      setRoute(window.location.pathname);
    };

    // Listen for history push/pop
    window.addEventListener('popstate', handleLocationChange);

    const hasToken = localStorage.getItem('token');
    const path = window.location.pathname;

    // Check for pending invite auto-joining if authenticated
    const pendingInvite = localStorage.getItem('pendingInvite');
    if (pendingInvite && hasToken) {
      const autoJoin = async () => {
        try {
          const res = await api.post(`/servers/join/${pendingInvite}`);
          const data = res.data;
          if (data.success) {
            if (data.serverId) {
              localStorage.setItem('selectedServerId', data.serverId);
            }
          }
        } catch (err) {
          console.error('Failed to auto join pending invite:', err);
        } finally {
          localStorage.removeItem('pendingInvite');
          window.location.href = '/home';
        }
      };
      autoJoin();
      return () => window.removeEventListener('popstate', handleLocationChange);
    }

    // Robust route guard redirection
    if (path.startsWith('/invite/')) {
      // Do nothing, let it render the public invite page
    } else if (path === '/home' && !hasToken) {
      window.history.replaceState({}, '', '/login');
      setRoute('/login');
    } else if ((path === '/login' || path === '/register' || path === '/' || path === '') && hasToken) {
      window.history.replaceState({}, '', '/home');
      setRoute('/home');
    } else if (path === '/' || path === '') {
      const nextPath = hasToken ? '/home' : '/login';
      window.history.replaceState({}, '', nextPath);
      setRoute(nextPath);
    }

    return () => window.removeEventListener('popstate', handleLocationChange);
  }, [route]);

  const renderRoute = () => {
    if (route.startsWith('/invite/')) {
      const inviteCode = route.split('/invite/')[1];
      return <InviteLandingPage inviteCode={inviteCode} />;
    }
    if (route === '/register') {
      return <RegisterPage />;
    }
    if (route === '/home') {
      return <HomePage />;
    }
    return <LoginPage />;
  };

  return (
    <>
      {loading && <Preloader onComplete={() => setLoading(false)} />}
      {!loading && renderRoute()}
    </>
  );
}
