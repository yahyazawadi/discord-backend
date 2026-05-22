import { useState, useEffect, useRef } from 'react';
import gsap from 'gsap';
import FloatingParticles from '../FloatingParticles/FloatingParticles';
import './RegisterPage.css';

export default function RegisterPage() {
  const cardRef = useRef<HTMLDivElement>(null);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [birthdate, setBirthdate] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState(1); // 1 = Register Form, 2 = OTP Verification
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [sentOtp, setSentOtp] = useState('');

  useEffect(() => {
    if (cardRef.current) {
      gsap.fromTo(cardRef.current,
        { opacity: 0, y: 30, scale: 0.96 },
        { opacity: 1, y: 0, scale: 1, duration: 0.8, ease: 'power3.out', delay: 0.1 }
      );
    }
  }, []);

  const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? `http://${window.location.hostname}:5001/api/auth`
    : `${window.location.origin}/api/auth`;

  // SPA navigation helper
  const handleNavigate = (e: React.MouseEvent, path: string) => {
    e.preventDefault();
    window.history.pushState({}, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !username || !password || !birthdate) {
      setError('Please provide all required fields');
      return;
    }
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch(`${API_BASE}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, username, password, birthdate }),
        credentials: 'include',
      });
      const data = await response.json();
      if (response.ok && data.success) {
        if (data.otp) {
          setSentOtp(data.otp);
        }
        setMessage(data.message || 'OTP sent to email. Please verify.');
        setStep(2);
      } else {
        setError(data.error || data.message || 'Registration failed');
      }
    } catch (err) {
      setError('Connection failed. Is the server running?');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp) {
      setError('Please enter the 6-digit verification code.');
      return;
    }
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch(`${API_BASE}/verify-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, otp }),
        credentials: 'include',
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setMessage('Account verified successfully! Redirecting...');
        if (data.token) {
          localStorage.setItem('token', data.token);
        }
        localStorage.setItem('user', JSON.stringify(data.user));

        setTimeout(() => {
          window.history.pushState({}, '', '/home');
          window.dispatchEvent(new PopStateEvent('popstate'));
        }, 1500);
      } else {
        setError(data.error || 'Verification failed. Please try again.');
      }
    } catch (err) {
      setError('Connection failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async (e: React.MouseEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch(`${API_BASE}/resend-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        if (data.otp) {
          setSentOtp(data.otp);
        }
        setMessage(data.message || 'New OTP sent successfully.');
      } else {
        setError(data.error || 'Failed to resend OTP.');
      }
    } catch (err) {
      setError('Connection failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-page">
      <div className="register-bg-overlay" />
      <FloatingParticles />

      <div className="register-card" ref={cardRef}>
        <div className="register-inner">
          {step === 1 ? (
            <>
              <div className="register-header">
                <h1 className="register-title">Create an account</h1>
              </div>

              <form className="register-form" onSubmit={handleRegisterSubmit} style={{ width: '100%' }}>
                {error && (
                  <div style={{ color: '#f23f43', fontSize: '14px', width: '100%', marginBottom: '16px', fontWeight: '500' }}>
                    ⚠️ {error}
                  </div>
                )}

                <div className="register-fields">
                  <div className="field-group">
                    <label className="field-label" htmlFor="email">EMAIL</label>
                    <input
                      id="email"
                      type="email"
                      className="field-input"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>

                  <div className="field-group">
                    <label className="field-label" htmlFor="username">USERNAME</label>
                    <input
                      id="username"
                      type="text"
                      className="field-input"
                      autoComplete="username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                    />
                  </div>

                  <div className="field-group">
                    <label className="field-label" htmlFor="password">PASSWORD</label>
                    <input
                      id="password"
                      type="password"
                      className="field-input"
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>

                  <div className="field-group">
                    <label className="field-label" htmlFor="birthdate">DATE OF BIRTH</label>
                    <input
                      id="birthdate"
                      type="date"
                      className="field-input"
                      value={birthdate}
                      onChange={(e) => setBirthdate(e.target.value)}
                      required
                      style={{ colorScheme: 'dark' }} // Native support for dark date picker UI
                    />
                  </div>
                </div>

                <button type="submit" className="register-btn" disabled={loading} style={{ marginTop: '20px' }}>
                  {loading ? 'Registering...' : 'Register'}
                </button>

                <p className="login-text" style={{ marginTop: '12px' }}>
                  Already have an account?{' '}
                  <a href="/login" onClick={(e) => handleNavigate(e, '/login')} className="login-link">Log in</a>
                </p>
              </form>
            </>
          ) : (
            <>
              <div className="register-header">
                <h1 className="register-title" style={{ color: '#23a55a' }}>Verify your email</h1>
                <p className="register-subtitle" style={{ fontSize: '15px', marginTop: '10px', color: 'rgba(194, 206, 214, 0.70)' }}>
                  We sent a 6-digit code to <strong>{email}</strong>
                  {sentOtp && (
                    <span style={{ display: 'block', marginTop: '8px', color: '#14AC7B', fontWeight: '500' }}>
                      Verification Code: <strong style={{ color: '#ffffff', letterSpacing: '1px', fontSize: '16px' }}>{sentOtp}</strong>
                    </span>
                  )}
                </p>
              </div>

              <form className="register-form" onSubmit={handleVerifySubmit} style={{ width: '100%' }}>
                {error && (
                  <div style={{ color: '#f23f43', fontSize: '14px', width: '100%', marginBottom: '16px', fontWeight: '500' }}>
                    ⚠️ {error}
                  </div>
                )}
                {message && (
                  <div style={{ color: '#23a55a', fontSize: '14px', width: '100%', marginBottom: '16px', fontWeight: '500' }}>
                    ✓ {message}
                  </div>
                )}

                <div className="register-fields">
                  <div className="field-group">
                    <label className="field-label" htmlFor="otp">6-DIGIT VERIFICATION CODE</label>
                    <input
                      id="otp"
                      type="text"
                      className="field-input"
                      maxLength={6}
                      placeholder={sentOtp || "e.g. 123456"}
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} // numbers only
                      required
                    />
                  </div>
                </div>

                <button type="submit" className="register-btn" disabled={loading} style={{ marginTop: '20px' }}>
                  {loading ? 'Verifying...' : 'Verify & Complete'}
                </button>

                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginTop: '12px' }}>
                  <a href="#" onClick={handleResendOtp} className="login-link" style={{ fontSize: '14px' }}>
                    Resend Code
                  </a>
                  <a href="#" onClick={(e) => { e.preventDefault(); setStep(1); }} className="login-link" style={{ fontSize: '14px', color: '#c2ced6' }}>
                    Back
                  </a>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
