import { useState, useEffect } from 'react';
import LoginPage from './components/LoginPage/LoginPage';
import RegisterPage from './components/RegisterPage/RegisterPage';
import HomePage from './components/HomePage/HomePage';
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

    // Auto-redirect from root to /login if not logged in, or /home if logged in
    if (window.location.pathname === '/' || window.location.pathname === '') {
      const hasToken = localStorage.getItem('token');
      const nextPath = hasToken ? '/home' : '/login';
      window.history.replaceState({}, '', nextPath);
      setRoute(nextPath);
    }

    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  const renderRoute = () => {
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
