import React, { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth } from '../firebase';
import { Beer, Lock, Mail, UserPlus, LogIn, AlertCircle } from 'lucide-react';

export const AuthScreen: React.FC = () => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Input Validations
    if (isRegistering) {
      if (!firstName.trim() || !lastName.trim()) {
        return setError('Please enter both your first and last name.');
      }
    }

    if (!email.trim() || !password.trim()) {
      return setError('Please enter both email and password.');
    }

    if (isRegistering) {
      if (password !== confirmPassword) {
        return setError('Passwords do not match.');
      }
      if (password.length < 6) {
        return setError('Password must be at least 6 characters.');
      }
    }

    setLoading(true);

    try {
      if (isRegistering) {
        const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await updateProfile(userCredential.user, {
          displayName: `${firstName.trim()} ${lastName.trim()}`
        });
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
    } catch (err: any) {
      console.error('Firebase authentication error:', err);
      // Translate firebase error codes to friendly display strings
      switch (err.code) {
        case 'auth/email-already-in-use':
          setError('This email address is already in use by another account.');
          break;
        case 'auth/invalid-email':
          setError('The email address is invalid.');
          break;
        case 'auth/operation-not-allowed':
          setError('Email/password accounts are not enabled. Contact admin.');
          break;
        case 'auth/weak-password':
          setError('The password is too weak. Please use a stronger password.');
          break;
        case 'auth/user-disabled':
          setError('This user account has been disabled.');
          break;
        case 'auth/user-not-found':
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
          setError('Invalid email or password. Please try again.');
          break;
        default:
          setError(err.message || 'An error occurred during authentication.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container-wrapper">
      <div className="auth-card">
        {/* Brand/Logo Section */}
        <div className="auth-brand">
          <div className="auth-logo-container">
            <Beer className="auth-brand-logo animate-float" size={36} />
          </div>
          <h1 className="auth-brand-title">Keg Swap</h1>
          <p className="auth-brand-subtitle">Beer & Ale Events Board</p>
        </div>

        {/* Title */}
        <h2 className="auth-title">
          {isRegistering ? 'Create an Account' : 'Welcome Back'}
        </h2>
        <p className="auth-instructions">
          {isRegistering 
            ? 'Sign up to register events, add drinks, and review craft beers.' 
            : 'Sign in to access your dashboard and local ale meetups.'}
        </p>

        {/* Error Notification */}
        {error && (
          <div className="form-alert auth-alert">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Credentials Form */}
        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          {isRegistering && (
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="auth-firstname" className="form-label">First Name</label>
                <input
                  type="text"
                  id="auth-firstname"
                  className="form-input"
                  placeholder="e.g. Jane"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
              <div className="form-group">
                <label htmlFor="auth-lastname" className="form-label">Last Name</label>
                <input
                  type="text"
                  id="auth-lastname"
                  className="form-input"
                  placeholder="e.g. Doe"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="auth-email" className="form-label">Email Address</label>
            <div className="auth-input-wrapper">
              <Mail className="auth-input-icon" size={16} />
              <input
                type="email"
                id="auth-email"
                className="form-input auth-input"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="auth-password" className="form-label">Password</label>
            <div className="auth-input-wrapper">
              <Lock className="auth-input-icon" size={16} />
              <input
                type="password"
                id="auth-password"
                className="form-input auth-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>
          </div>

          {isRegistering && (
            <div className="form-group">
              <label htmlFor="auth-confirm-password" className="form-label">Confirm Password</label>
              <div className="auth-input-wrapper">
                <Lock className="auth-input-icon" size={16} />
                <input
                  type="password"
                  id="auth-confirm-password"
                  className="form-input auth-input"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
            </div>
          )}

          <button 
            type="submit" 
            className="btn-primary auth-submit-btn" 
            disabled={loading}
          >
            {loading ? (
              <span>Connecting...</span>
            ) : (
              <>
                {isRegistering ? <UserPlus size={16} /> : <LogIn size={16} />}
                <span>{isRegistering ? 'Register' : 'Sign In'}</span>
              </>
            )}
          </button>
        </form>

        {/* Switch Register/Login */}
        <div className="auth-footer">
          <span>
            {isRegistering ? 'Already have an account?' : "Don't have an account?"}
          </span>
          <button
            type="button"
            className="btn-link"
            onClick={() => {
              setIsRegistering(!isRegistering);
              setError('');
              setFirstName('');
              setLastName('');
              setPassword('');
              setConfirmPassword('');
            }}
            disabled={loading}
          >
            {isRegistering ? 'Sign In' : 'Sign Up'}
          </button>
        </div>
      </div>
    </div>
  );
};
