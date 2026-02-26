import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut, Users, MessageSquareShare, MessageSquare, ShieldCheck, AlertCircle, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Dashboard = () => {
    const { signOut, user } = useAuth();
    const navigate = useNavigate();

    const [wabaStatus, setWabaStatus] = useState(null);
    const [loadingWabaStatus, setLoadingWabaStatus] = useState(false);

    useEffect(() => {
        fetchWabaStatus();
    }, []);

    const fetchWabaStatus = async () => {
        setLoadingWabaStatus(true);
        try {
            const res = await fetch('/api/waba-analytics');
            const data = await res.json();
            if (data && data.marketing_messages_onboarding_status) {
                setWabaStatus(data.marketing_messages_onboarding_status);
            }
        } catch (error) {
            console.error("Failed to fetch WABA status", error);
        } finally {
            setLoadingWabaStatus(false);
        }
    };

    const parsedStatus = typeof wabaStatus === 'object' ? wabaStatus?.status : wabaStatus;
    const isEligible = parsedStatus === 'ELIGIBLE' || parsedStatus === 'ONBOARDED';


    return (
        <div className="min-h-screen p-4 md:p-8">
            <header className="flex flex-col md:flex-row justify-between items-center mb-8 md:mb-12 glass-panel p-4 md:px-8 gap-4">
                <div className="flex flex-col items-center md:items-start gap-2 w-full md:w-auto">
                    <div className="flex items-center gap-3 justify-center md:justify-start w-full">
                        <div className="bg-primary-light p-2 rounded-lg">
                            <MessageSquareShare className="text-primary" size={24} />
                        </div>
                        <h1 className="text-xl font-bold tracking-wide">WhatsApp Auto</h1>
                    </div>

                    <div className="flex items-center gap-2 mt-1 px-3 py-1.5 bg-background-dark/30 rounded-full border border-border-color/50">
                        {loadingWabaStatus ? (
                            <span className="text-xs text-muted animate-pulse">Checking WABA eligibility...</span>
                        ) : parsedStatus ? (
                            <>
                                {isEligible ? <ShieldCheck size={14} className="text-success" /> : <AlertCircle size={14} className="text-warning" />}
                                <span className="text-xs font-medium text-muted">Marketing Messages API:</span>
                                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${isEligible ? 'bg-success/20 text-success' : 'bg-warning/20 text-warning'}`}>
                                    {parsedStatus.replace(/_/g, ' ')}
                                </span>
                            </>
                        ) : (
                            <span className="text-xs text-muted">WABA Eligibility: Unknown</span>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
                    <span className="text-sm font-medium text-muted truncate max-w-[150px] md:max-w-none">{user?.email}</span>
                    <button onClick={signOut} className="btn-secondary flex items-center gap-2 py-2 px-4 text-sm">
                        <LogOut size={16} /> <span className="hidden sm:inline-block">Sign Out</span>
                    </button>
                </div>
            </header>

            <main className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
                {/* Contact Management Card */}
                <div onClick={() => navigate('/contacts')} className="glass-panel p-6 md:p-8 hover:-translate-y-2 transition-transform duration-300 cursor-pointer group flex flex-col h-full">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="bg-success/20 p-3 rounded-full group-hover:bg-success/30 transition-colors">
                            <Users size={28} className="text-success" />
                        </div>
                        <h2 className="text-xl md:text-2xl font-semibold">Contacts</h2>
                    </div>
                    <p className="text-muted mb-6 md:mb-8 flex-grow text-sm md:text-base leading-relaxed">
                        Upload Excel files, filter numbers accurately, manage duplicates, and sync your audience securely to our database.
                    </p>
                    <button className="btn-primary w-full sm:w-auto text-sm flex items-center justify-center gap-2 group-hover:shadow-primary/50">
                        Manage Contacts
                    </button>
                </div>

                {/* Broadcast Card */}
                <div onClick={() => navigate('/broadcast')} className="glass-panel p-6 md:p-8 hover:-translate-y-2 transition-transform duration-300 cursor-pointer group flex flex-col h-full">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="bg-primary-light p-3 rounded-full group-hover:bg-primary/30 transition-colors">
                            <MessageSquareShare size={28} className="text-primary" />
                        </div>
                        <h2 className="text-xl md:text-2xl font-semibold">Broadcast</h2>
                    </div>
                    <p className="text-muted mb-6 md:mb-8 flex-grow text-sm md:text-base leading-relaxed">
                        Fetch WhatsApp Templates directly from your Meta Developer Account and send automated bulk messages instantly.
                    </p>
                    <button className="btn-primary w-full sm:w-auto text-sm flex items-center justify-center gap-2 group-hover:shadow-primary/50">
                        Start Broadcast
                    </button>
                </div>

                {/* History & Payment Card */}
                <div onClick={() => navigate('/history')} className="glass-panel p-6 md:p-8 hover:-translate-y-2 transition-transform duration-300 cursor-pointer group flex flex-col h-full bg-surface-dark/40">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="bg-white/10 p-3 rounded-full group-hover:bg-white/20 transition-colors">
                            <Clock size={28} className="text-white" />
                        </div>
                        <h2 className="text-xl md:text-2xl font-semibold">History & Plan</h2>
                    </div>
                    <p className="text-muted mb-6 md:mb-8 flex-grow text-sm md:text-base leading-relaxed">
                        View past broadcast logs, delivery reports, and manage your billing or subscription plan settings.
                    </p>
                    <div className="flex gap-2">
                        <button className="flex-1 btn-secondary text-sm flex items-center justify-center gap-2 hover:bg-white/20">
                            Logs
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); navigate('/payment'); }} className="flex-1 btn-secondary text-sm flex items-center justify-center gap-2 hover:bg-success/20 text-success border-success/30">
                            Billing
                        </button>
                    </div>
                </div>

                {/* Freeform Message Card */}
                <div onClick={() => navigate('/freeform')} className="glass-panel p-6 md:p-8 hover:-translate-y-2 transition-transform duration-300 cursor-pointer group flex flex-col h-full">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="bg-warning/20 p-3 rounded-full group-hover:bg-warning/30 transition-colors">
                            <MessageSquare size={28} className="text-warning" />
                        </div>
                        <h2 className="text-xl md:text-2xl font-semibold">Freeform</h2>
                    </div>
                    <p className="text-muted mb-6 md:mb-8 flex-grow text-sm md:text-base leading-relaxed">
                        Send custom messages or images directly to users who have interacted with you in the last 24 hours.
                    </p>
                    <button className="btn-primary w-full sm:w-auto text-sm flex items-center justify-center gap-2 group-hover:shadow-primary/50">
                        Freeform Msg
                    </button>
                </div>
            </main>
        </div>
    );
};

export default Dashboard;
