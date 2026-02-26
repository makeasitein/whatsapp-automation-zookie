import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext();

export const useAuth = () => {
    return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Check active session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
            if (session?.user) {
                fetchProfile(session.user.id);
            } else {
                setLoading(false);
            }
        });

        // Listen to auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
            if (session?.user) {
                fetchProfile(session.user.id);
            } else {
                setProfile(null);
                setLoading(false);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const fetchProfile = async (userId) => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .maybeSingle();

            if (error) {
                console.error('Error fetching profile:', error);
            }

            if (data) {
                setProfile(data);
            } else {
                // Profile row doesn't exist — create it in DB so backend never hits null.
                console.warn('Profile not found for user, creating default profile.');
                const { error: insertError } = await supabase
                    .from('profiles')
                    .insert({ id: userId, payment_status: false, valid_until: null });
                if (insertError) {
                    console.error('Failed to auto-create profile:', insertError);
                }
                setProfile({ id: userId, payment_status: false, valid_until: null });
            }
        } catch (err) {
            console.error('Exception fetching profile:', err);
            setProfile({ id: userId, payment_status: false, valid_until: null });
        } finally {
            setLoading(false);
        }
    };

    const signIn = async (email, password) => {
        return supabase.auth.signInWithPassword({ email, password });
    };

    const signUp = async (email, password) => {
        return supabase.auth.signUp({ email, password });
    };

    const signOut = async () => {
        return supabase.auth.signOut();
    };

    return (
        <AuthContext.Provider value={{ user, profile, fetchProfile, signIn, signUp, signOut, loading }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
