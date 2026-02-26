import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { CreditCard, Rocket, CheckCircle, BadgeCheck, ArrowLeft } from 'lucide-react';

const Payment = () => {
    const { signOut, user, profile, fetchProfile } = useAuth();
    const [loading, setLoading] = useState(false);
    const [history, setHistory] = useState([]);
    const [paymentSuccess, setPaymentSuccess] = useState(false);
    const [countdown, setCountdown] = useState(10);
    const navigate = useNavigate();

    // Check if the user has already paid for the current month
    const isAlreadyPaid = (() => {
        if (!profile?.valid_until) return false;
        const validUntil = new Date(profile.valid_until);
        return validUntil > new Date();
    })();

    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';

    useEffect(() => {
        let timer;
        if (paymentSuccess && countdown > 0) {
            timer = setInterval(() => setCountdown((prev) => prev - 1), 1000);
        } else if (paymentSuccess && countdown === 0) {
            navigate('/');
        }
        return () => clearInterval(timer);
    }, [paymentSuccess, countdown, navigate]);

    useEffect(() => {
        const fetchHistory = async () => {
            if (!user) return;
            try {
                const res = await fetch(`${apiUrl}/api/payment-history?userId=${user.id}`);
                const data = await res.json();
                if (Array.isArray(data)) setHistory(data);
            } catch (err) {
                console.error("Failed to load history", err);
            }
        };
        fetchHistory();
    }, [user, apiUrl]);

    const loadRazorpayScript = () => {
        return new Promise((resolve) => {
            if (window.Razorpay) {
                resolve(true);
                return;
            }
            const script = document.createElement('script');
            script.src = 'https://checkout.razorpay.com/v1/checkout.js';
            script.onload = () => resolve(true);
            script.onerror = () => resolve(false);
            document.body.appendChild(script);
        });
    };

    const handlePayment = async () => {
        setLoading(true);
        const scriptLoaded = await loadRazorpayScript();
        
        if (!scriptLoaded) {
            alert('Failed to load Razorpay SDK. Are you online?');
            setLoading(false);
            return;
        }

        try {
            // 1. Create Order
            const orderRes = await fetch(`${apiUrl}/api/create-payment-order`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.id })
            });

            if (!orderRes.ok) {
                const errText = await orderRes.json();
                throw new Error(errText.detail || 'Order creation failed');
            }
            const orderData = await orderRes.json();

            // 2. Fetch Key
            const keyRes = await fetch(`${apiUrl}/api/razorpay-key`);
            const keyData = await keyRes.json();

            // 3. Open Razorpay
            const options = {
                key: keyData.key,
                amount: orderData.amount,
                currency: orderData.currency,
                name: "WhatsApp Automation",
                description: "Monthly Prepaid Access (Valid until 7th)",
                order_id: orderData.id,
                handler: async (response) => {
                    try {
                        const verifyRes = await fetch(`${apiUrl}/api/verify-payment`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                razorpay_payment_id: response.razorpay_payment_id,
                                razorpay_order_id: response.razorpay_order_id,
                                razorpay_signature: response.razorpay_signature,
                                userId: user.id
                            })
                        });
                        const verifyData = await verifyRes.json();
                        
                        if (verifyData.success) {
                            await fetchProfile(); // Refresh context
                            setPaymentSuccess(true);
                        } else {
                            alert("Payment verification failed: " + verifyData.detail);
                        }
                    } catch (err) {
                        console.error(err);
                        alert("Verification error: " + err.message);
                    }
                },
                prefill: {
                    name: user?.user_metadata?.full_name || "",
                    email: user?.email || "",
                },
                theme: { color: "#25D366" }
            };

            const rzp = new window.Razorpay(options);
            rzp.on('payment.failed', function (response) {
                alert(response.error.description);
            });
            rzp.open();

        } catch (err) {
            console.error(err);
            alert(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (isAlreadyPaid) {
        const validUntil = new Date(profile.valid_until).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
        return (
            <div className="flex h-screen items-center justify-center p-4 bg-background-dark flex-col animate-fade-in relative overflow-hidden">
                <button onClick={() => navigate('/dashboard')} className="absolute top-6 left-6 flex items-center gap-2 text-muted hover:text-white transition-colors focus:outline-none z-20">
                    <ArrowLeft size={20} /> <span className="hidden sm:inline-block">Back to Dashboard</span>
                </button>
                <div className="absolute top-[-10%] right-[-5%] w-96 h-96 bg-success/20 rounded-full blur-[100px] pointer-events-none"></div>
                <div className="absolute bottom-[-10%] left-[-5%] w-96 h-96 bg-primary/10 rounded-full blur-[100px] pointer-events-none"></div>

                <div className="glass-panel p-8 sm:p-12 w-full max-w-lg text-center z-10">
                    <div className="flex justify-center mb-6">
                        <BadgeCheck size={64} className="text-success" />
                    </div>
                    <h2 className="text-3xl font-bold mb-4 text-white">Already Paid!</h2>
                    <p className="text-gray-300 mb-2 text-lg">
                        Your current monthly payment is already done.
                    </p>
                    <p className="text-sm text-gray-400 mb-8">
                        Access is active until <span className="text-success font-semibold">{validUntil}</span>.
                    </p>
                    <button
                        onClick={() => navigate('/')}
                        className="w-full py-4 rounded-xl font-bold text-lg text-white bg-success hover:bg-success/80 transition-all shadow-lg shadow-success/20"
                    >
                        Go to Dashboard
                    </button>
                    <button
                        onClick={signOut}
                        className="mt-4 text-muted text-sm hover:text-white transition-colors focus:outline-none"
                    >
                        Sign out ({user?.email})
                    </button>
                </div>
            </div>
        );
    }

    if (paymentSuccess) {
        return (
            <div className="flex h-screen items-center justify-center p-4 bg-background-dark flex-col animate-fade-in relative overflow-hidden">
                <div className="absolute top-[-10%] right-[-5%] w-96 h-96 bg-success/20 rounded-full blur-[100px] pointer-events-none"></div>
                <div className="absolute bottom-[-10%] left-[-5%] w-96 h-96 bg-primary/10 rounded-full blur-[100px] pointer-events-none"></div>

                <div className="glass-panel p-8 sm:p-12 w-full max-w-lg text-center z-10">
                    <div className="flex justify-center mb-6">
                        <CheckCircle size={64} className="text-success animate-pulse" />
                    </div>
                    <h2 className="text-3xl font-bold mb-4 text-white">Payment Successful!</h2>
                    <p className="text-gray-300 mb-8 text-lg">
                        Your monthly access is now active until the 7th.
                    </p>
                    
                    <div className="mb-8">
                        <p className="text-sm text-gray-400">Redirecting in {countdown} seconds...</p>
                    </div>

                    <button
                        onClick={() => navigate('/')}
                        className="w-full py-4 rounded-xl font-bold text-lg text-white bg-success hover:bg-success/80 transition-all shadow-lg shadow-success/20"
                    >
                        Go to Dashboard Now
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen items-center justify-center p-4 relative overflow-hidden bg-background-dark flex-col">
            <button onClick={() => signOut()} className="absolute top-6 left-6 flex items-center gap-2 text-muted hover:text-white transition-colors focus:outline-none z-20">
                    <ArrowLeft size={20} /> <span className="hidden sm:inline-block">Sign Out</span>
            </button>
            {/* Background Gradients */}
            <div className="absolute top-[-10%] right-[-5%] w-96 h-96 bg-success/20 rounded-full blur-[100px] pointer-events-none"></div>
            <div className="absolute bottom-[-10%] left-[-5%] w-96 h-96 bg-primary/10 rounded-full blur-[100px] pointer-events-none"></div>

            <div className="glass-panel p-6 sm:p-10 w-full max-w-lg text-center animate-fade-in z-10 mx-auto">
                <div className="flex justify-center mb-8">
                    <div className="bg-success/20 p-5 rounded-full shadow-lg shadow-success/20">
                        <Rocket size={48} className="text-success" />
                    </div>
                </div>

                <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">Prepaid Access</h2>
                <p className="text-muted mb-8 text-base sm:text-lg leading-relaxed">
                    Pay 600 INR to unlock access until the 7th of next month.
                </p>

                <div className="bg-background-dark/50 p-6 rounded-2xl border border-border-color mb-8 shadow-inner">
                    <div className="flex justify-between items-center mb-4">
                        <span className="text-muted font-medium">Monthly Plan</span>
                        <span className="font-semibold text-white tracking-wide">
                            Prepaid
                        </span>
                    </div>
                    <div className="flex justify-between items-center text-xl sm:text-2xl font-bold pt-4 border-t border-border-color">
                        <span>Total Due</span>
                        <span className="text-success flex items-center gap-1">
                            ₹600 / month
                        </span>
                    </div>
                </div>

                <button
                    onClick={handlePayment}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-3 py-4 sm:py-5 rounded-xl font-bold text-lg sm:text-xl text-white transition-all duration-300 bg-gradient-to-r from-success to-emerald-600 shadow-xl shadow-success/30 hover:-translate-y-1 hover:shadow-success/40 disabled:opacity-70 disabled:cursor-not-allowed mb-6"
                >
                    <CreditCard size={28} />
                    {loading ? 'Processing...' : 'Pay Now'}
                </button>

                <button
                    onClick={signOut}
                    className="text-muted text-sm hover:text-white transition-colors focus:outline-none"
                >
                    Sign out ({user?.email})
                </button>
            </div>

            {/* Payment History Section */}
            {history.length > 0 && (
                <div className="mt-8 w-full max-w-lg bg-gray-800/80 p-6 rounded-xl border border-gray-700 z-10 w-full">
                    <h3 className="text-lg font-semibold mb-4 text-gray-300">Payment History</h3>
                    <div className="space-y-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                         {history.map((pay, i) => (
                            <div key={i} className="bg-gray-700/30 p-3 rounded text-sm flex justify-between items-center border border-gray-700/50">
                                <div>
                                    <div className="font-medium text-white">₹{pay.amount || 0}</div>
                                    <div className="text-xs text-gray-400">
                                        {new Date(pay.created_at || Date.now()).toLocaleDateString()}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-green-400 text-xs font-mono uppercase">{pay.status}</div>
                                    {pay.valid_until && (
                                        <div className="text-xs text-gray-500">Valid: {new Date(pay.valid_until).toLocaleDateString()}</div>
                                    )}
                                </div>
                            </div>
                         ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Payment;
