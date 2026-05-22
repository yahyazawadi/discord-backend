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

    // Robust route guard redirection
    const hasToken = localStorage.getItem('token');
    const path = window.location.pathname;

    if (path === '/home' && !hasToken) {
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
