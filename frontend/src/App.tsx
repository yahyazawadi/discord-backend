import { useState, useEffect } from 'react';
import LoginPage from './components/LoginPage/LoginPage';
import RegisterPage from './components/RegisterPage/RegisterPage';
import Preloader from './components/Preloader/Preloader';

export default function App() {
  const [route, setRoute] = useState(window.location.pathname);
  const [loading, setLoading] = useState(true);

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

  return (
    <>
      {loading && <Preloader onComplete={() => setLoading(false)} />}
      {!loading && (route === '/register' ? <RegisterPage /> : <LoginPage />)}
    </>
  );
}
