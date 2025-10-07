import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

const parseHashParams = () => {
  if (typeof window === 'undefined' || !window.location.hash) {
    return {};
  }

  const params = new URLSearchParams(window.location.hash.replace('#', ''));
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  const type = params.get('type');
  return { access_token, refresh_token, type };
};

const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const [{ access_token, refresh_token, type }] = useState(parseHashParams);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState({ error: '', success: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  const tokensPresent = useMemo(() => access_token && refresh_token, [access_token, refresh_token]);

  useEffect(() => {
    let cancelled = false;

    const establishSession = async () => {
      try {
        if (tokensPresent) {
          const { error } = await supabase.auth.setSession({ access_token, refresh_token });
          if (error) throw error;
        } else {
          const { data, error } = await supabase.auth.getSession();
          if (error) throw error;
          if (!data.session) {
            setStatus({ error: 'Reset link is invalid or expired. Request a new one.', success: '' });
            return;
          }
        }

        if (!cancelled) {
          setSessionReady(true);
          if (tokensPresent && typeof window !== 'undefined') {
            window.history.replaceState(null, document.title, window.location.pathname + window.location.search);
          }
        }
      } catch (error) {
        if (!cancelled) {
          setStatus({ error: error.message || 'Unable to validate reset link.', success: '' });
        }
      }
    };

    establishSession();
    return () => {
      cancelled = true;
    };
  }, [access_token, refresh_token, tokensPresent]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus({ error: '', success: '' });

    if (password.length < 8) {
      setStatus({ error: 'Password must be at least 8 characters.', success: '' });
      return;
    }

    if (password !== confirmPassword) {
      setStatus({ error: 'Passwords do not match.', success: '' });
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setStatus({ error: error.message || 'Unable to update password.', success: '' });
        setIsSubmitting(false);
        return;
      }

      setStatus({ error: '', success: 'Password updated. You can now sign in.' });
      setIsSubmitting(false);
      setTimeout(() => navigate('/login', { replace: true }), 1200);
    } catch (error) {
      setStatus({ error: error.message || 'Unexpected error updating password.', success: '' });
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-layout">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1>Create a new password</h1>
        <p className="auth-subtext">
          {type === 'recovery'
            ? 'Enter a new password for your account.'
            : 'If the link you used is expired, request another reset email.'}
        </p>
        <label>
          New password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={8}
            disabled={!sessionReady}
            autoComplete="new-password"
            autoFocus
          />
        </label>
        <label>
          Confirm password
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
            minLength={8}
            disabled={!sessionReady}
            autoComplete="new-password"
          />
        </label>
        {status.error && <div className="auth-error">{status.error}</div>}
        {status.success && <div className="auth-success">{status.success}</div>}
        <button type="submit" disabled={!sessionReady || isSubmitting}>
          {isSubmitting ? 'Updating…' : 'Update password'}
        </button>
        <div className="auth-links">
          <Link to="/login">Back to login</Link>
        </div>
      </form>
    </div>
  );
};

export default ResetPasswordPage;
