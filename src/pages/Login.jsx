import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { MessageSquare, Mail, Lock, LogIn, UserPlus, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Login = () => {
    const [isSignUp, setIsSignUp] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const { signIn } = useAuth();
    const navigate = useNavigate();

    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            if (isSignUp) {
                // Use backend register endpoint — creates user with email_confirm=true
                // so no email confirmation step is needed.
                const res = await fetch(`${apiUrl}/api/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.detail || 'Registration failed');

                // Auto sign-in after successful registration
                const { error: signInError } = await signIn(email, password);
                if (signInError) throw signInError;
                navigate('/');
            } else {
                const { error } = await signIn(email, password);
                if (error) throw error;
                navigate('/');
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center p-4 relative overflow-hidden bg-background-dark">
            {/* Background Gradients */}
            <div className="absolute top-[-10%] right-[-5%] w-96 h-96 bg-primary/20 rounded-full blur-[100px] pointer-events-none"></div>
            <div className="absolute bottom-[-10%] left-[-5%] w-96 h-96 bg-success/10 rounded-full blur-[100px] pointer-events-none"></div>

            <div className="glass-panel p-6 sm:p-8 w-full max-w-md animate-fade-in z-10 mx-auto">
                <div className="flex flex-col items-center mb-8">
                    <div className="bg-primary-light p-4 rounded-2xl mb-6 shadow-lg shadow-primary/20">
                        <MessageSquare size={36} className="text-primary" />
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-center">{isSignUp ? 'Create an Account' : 'Welcome Back'}</h2>
                    <p className="text-muted mt-3 text-center text-sm sm:text-base leading-relaxed">
                        {isSignUp ? 'Join to automate your WhatsApp broadcasts instantly.' : 'Sign in to access your WhatsApp Automation Dashboard.'}
                    </p>
                </div>

                {error && (
                    <div className="bg-error/10 border border-error/30 text-error p-4 rounded-xl mb-6 text-sm flex items-start gap-3">
                        <AlertCircle className="shrink-0 mt-0.5" size={18} />
                        <span>{error}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                    <div className="relative group">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-primary transition-colors" size={20} />
                        <input
                            type="email"
                            placeholder="Email address"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="pl-12"
                        />
                    </div>
                    <div className="relative group">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-primary transition-colors" size={20} />
                        <input
                            type="password"
                            placeholder="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="pl-12"
                        />
                    </div>

                    <button type="submit" className="btn-primary w-full flex items-center justify-center gap-2 mt-4 py-3.5" disabled={loading}>
                        {loading ? 'Processing...' : isSignUp ? <><UserPlus size={20} /> Sign Up</> : <><LogIn size={20} /> Sign In</>}
                    </button>
                </form>

                <div className="mt-8 text-center border-t border-border-color pt-6">
                    <button
                        type="button"
                        onClick={() => setIsSignUp(!isSignUp)}
                        className="text-sm text-primary hover:text-primary-hover hover:underline transition-colors focus:outline-none"
                    >
                        {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Login;
