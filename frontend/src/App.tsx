import { useState, useEffect } from 'react';
import LoginPage from './components/LoginPage/LoginPage';
import RegisterPage from './components/RegisterPage/RegisterPage';

export default function App() {
  const [route, setRoute] = useState(window.location.pathname);

  useEffect(() => {
    const handleLocationChange = () => {
      setRoute(window.location.pathname);
    };

    // Listen for history push/pop
    window.addEventListener('popstate', handleLocationChange);

    // Auto-redirect from root to /login
    if (window.location.pathname === '/' || window.location.pathname === '') {
      window.history.replaceState({}, '', '/login');
      setRoute('/login');
    }

    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  if (route === '/register') {
    return <RegisterPage />;
  }

  return <LoginPage />;
}
