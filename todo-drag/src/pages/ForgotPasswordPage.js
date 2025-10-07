import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState({ error: '', success: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus({ error: '', success: '' });
    setIsSubmitting(true);

    try {
      const redirectTo = `${window.location.origin}/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) {
        setStatus({ error: error.message || 'Unable to send reset instructions.', success: '' });
        setIsSubmitting(false);
        return;
      }

      setStatus({
        error: '',
        success: 'Check your email for a password reset link. The link opens this app to complete the process.',
      });
      setIsSubmitting(false);
    } catch (error) {
      setStatus({ error: error.message || 'Unexpected error sending reset email.', success: '' });
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-layout">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1>Reset your password</h1>
        <p className="auth-subtext">
          Enter the email tied to your Fieldnotes account. We’ll send a reset link that brings you back here to choose a new password.
        </p>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            autoComplete="email"
            autoFocus
          />
        </label>
        {status.error && <div className="auth-error">{status.error}</div>}
        {status.success && <div className="auth-success">{status.success}</div>}
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Sending…' : 'Send reset link'}
        </button>
        <div className="auth-links">
          <Link to="/login">Back to login</Link>
        </div>
      </form>
    </div>
  );
};

export default ForgotPasswordPage;
