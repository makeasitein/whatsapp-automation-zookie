import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Calendar, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const History = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchHistory();
    }, [user]);

    const fetchHistory = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('message_logs')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(1000); // Last 1000 messages

            if (error) throw error;
            setLogs(data || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateStr) => {
        return new Date(dateStr).toLocaleString('en-IN', { 
            hour: '2-digit', minute: '2-digit' 
        });
    };

    const getGroupDate = (dateStr) => {
        const date = new Date(dateStr);
        const today = new Date();
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        if (date.toDateString() === today.toDateString()) return 'Today';
        if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
        
        return date.toLocaleDateString('en-IN', { 
            day: 'numeric', month: 'long', year: 'numeric' 
        });
    };

    const groupedLogs = logs.reduce((acc, log) => {
        const dateLabel = getGroupDate(log.created_at);
        if (!acc[dateLabel]) acc[dateLabel] = [];
        acc[dateLabel].push(log);
        return acc;
    }, {});

    return (
        <div className="min-h-screen p-4 md:p-8">
            <header className="flex flex-col md:flex-row justify-between items-center mb-6 md:mb-8 gap-4">
                <div className="flex w-full md:w-auto justify-start">
                    <button onClick={() => navigate('/dashboard')} className="flex items-center gap-2 text-muted hover:text-white transition-colors focus:outline-none">
                        <ArrowLeft size={20} /> <span className="hidden sm:inline-block">Back to Dashboard</span>
                    </button>
                </div>
                <h1 className="text-xl md:text-2xl font-bold w-full md:w-auto text-center md:text-left">Broadcast History</h1>
            </header>

            <div className="max-w-6xl mx-auto glass-panel p-0 overflow-hidden">
                <div className="p-6 border-b border-border-color">
                    <h2 className="text-lg font-semibold">Recent Activity</h2>
                    <p className="text-muted text-sm">Showing the last 1000 messages sent.</p>
                </div>
                
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-background-dark/50 border-b border-border-color">
                            <tr>
                                <th className="p-4 text-xs font-bold text-muted uppercase tracking-wider">Time</th>
                                <th className="p-4 text-xs font-bold text-muted uppercase tracking-wider">Template</th>
                                <th className="p-4 text-xs font-bold text-muted uppercase tracking-wider">Recipient</th>
                                <th className="p-4 text-xs font-bold text-muted uppercase tracking-wider">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border-color/50">
                            {loading ? (
                                <tr><td colSpan="4" className="p-8 text-center text-muted">Loading history...</td></tr>
                            ) : logs.length === 0 ? (
                                <tr><td colSpan="4" className="p-8 text-center text-muted">No broadcast history found.</td></tr>
                            ) : (
                                Object.entries(groupedLogs).map(([dateLabel, groupLogs]) => (
                                    <React.Fragment key={dateLabel}>
                                        <tr className="bg-background-dark/30 border-y border-border-color/30">
                                            <td colSpan="4" className="px-4 py-2 text-xs font-bold text-primary uppercase tracking-wide">
                                                {dateLabel}
                                            </td>
                                        </tr>
                                        {groupLogs.map((log) => (
                                            <tr key={log.id} className="hover:bg-white/5 transition-colors">
                                                <td className="p-4 text-sm text-muted whitespace-nowrap flex items-center gap-2">
                                                    <Clock size={14} />
                                                    {formatDate(log.created_at)}
                                                </td>
                                                <td className="p-4 text-sm font-medium text-white">{log.template_name}</td>
                                                <td className="p-4 text-sm text-muted font-mono">{log.contact_phone}</td>
                                                <td className="p-4">
                                                    {log.status === 'sent' ? (
                                                        <span className="flex items-center gap-1.5 text-success text-xs font-bold uppercase bg-success/10 px-2 py-1 rounded-md w-fit">
                                                            <CheckCircle2 size={12} /> Sent
                                                        </span>
                                                    ) : (
                                                        <span className="flex items-center gap-1.5 text-error text-xs font-bold uppercase bg-error/10 px-2 py-1 rounded-md w-fit">
                                                            <XCircle size={12} /> Failed
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </React.Fragment>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default History;
