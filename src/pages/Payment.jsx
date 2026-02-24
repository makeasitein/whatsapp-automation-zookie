import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { CreditCard, Rocket } from 'lucide-react';

const Payment = () => {
    const { signOut, user, fetchProfile } = useAuth();
    const [loading, setLoading] = useState(false);

    const loadRazorpayScript = () => {
        return new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = 'https://checkout.razorpay.com/v1/checkout.js';
            script.onload = () => resolve(true);
            script.onerror = () => resolve(false);
            document.body.appendChild(script);
        });
    };

    const handlePayment = async () => {
        setLoading(true);
        const res = await loadRazorpayScript();

        if (!res) {
            alert('Failed to load Razorpay SDK. Are you online?');
            setLoading(false);
            return;
        }

        try {
            const orderRes = await fetch('/.netlify/functions/create-order', { method: 'POST' });
            const orderData = await orderRes.json();

            if (!orderData || !orderData.id) {
                throw new Error('Failed to create order');
            }

            const keyRes = await fetch('/.netlify/functions/get-razorpay-key');
            const keyData = await keyRes.json();

            if (!keyData || !keyData.key) {
                throw new Error('Failed to retrieve Razorpay Key');
            }

            const options = {
                key: keyData.key,
                amount: orderData.amount,
                currency: orderData.currency,
                name: 'WhatsApp Auto',
                description: 'Lifetime Membership',
                order_id: orderData.id,
                handler: async function (response) {
                    try {
                        const verifyRes = await fetch('/.netlify/functions/verify-payment', {
                            method: 'POST',
                            body: JSON.stringify({
                                razorpay_payment_id: response.razorpay_payment_id,
                                razorpay_order_id: response.razorpay_order_id,
                                razorpay_signature: response.razorpay_signature,
                                userId: user.id
                            })
                        });
                        const verifyData = await verifyRes.json();

                        if (verifyData.success) {
                            alert('Payment Successful!');
                            await fetchProfile(user.id);
                        } else {
                            alert('Payment verification failed.');
                        }
                    } catch (err) {
                        alert('Verification Error');
                    }
                },
                prefill: {
                    email: user?.email,
                },
                theme: {
                    color: '#4F46E5'
                }
            };

            const rzp = new window.Razorpay(options);
            rzp.on('payment.failed', function (response) {
                alert(response.error.description);
            });
            rzp.open();
        } catch (error) {
            console.error(error);
            alert("Error originating payment.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center p-4 relative overflow-hidden bg-background-dark">
            {/* Background Gradients */}
            <div className="absolute top-[-10%] right-[-5%] w-96 h-96 bg-success/20 rounded-full blur-[100px] pointer-events-none"></div>
            <div className="absolute bottom-[-10%] left-[-5%] w-96 h-96 bg-primary/10 rounded-full blur-[100px] pointer-events-none"></div>

            <div className="glass-panel p-6 sm:p-10 w-full max-w-lg text-center animate-fade-in z-10 mx-auto">
                <div className="flex justify-center mb-8">
                    <div className="bg-success/20 p-5 rounded-full shadow-lg shadow-success/20">
                        <Rocket size={48} className="text-success" />
                    </div>
                </div>

                <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">Unlock Automation</h2>
                <p className="text-muted mb-8 text-base sm:text-lg leading-relaxed">
                    You're just one step away from sending unlimited WhatsApp broadcasts. Complete your payment to activate your account.
                </p>

                <div className="bg-background-dark/50 p-6 rounded-2xl border border-border-color mb-8 shadow-inner">
                    <div className="flex justify-between items-center mb-4">
                        <span className="text-muted font-medium">Plan</span>
                        <span className="font-semibold text-white tracking-wide">Lifetime Access</span>
                    </div>
                    <div className="flex justify-between items-center text-xl sm:text-2xl font-bold pt-4 border-t border-border-color">
                        <span>Total Pay</span>
                        <span className="text-success flex items-center gap-1">₹999</span>
                    </div>
                </div>

                <button
                    onClick={handlePayment}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-3 py-4 sm:py-5 rounded-xl font-bold text-lg sm:text-xl text-white transition-all duration-300 bg-gradient-to-r from-success to-emerald-600 shadow-xl shadow-success/30 hover:-translate-y-1 hover:shadow-success/40 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none mb-6"
                >
                    <CreditCard size={28} />
                    {loading ? 'Processing...' : 'Pay Now Securely'}
                </button>

                <button
                    onClick={signOut}
                    className="text-muted text-sm hover:text-white transition-colors focus:outline-none"
                >
                    Sign out ({user?.email})
                </button>
            </div>
        </div>
    );
};

export default Payment;
