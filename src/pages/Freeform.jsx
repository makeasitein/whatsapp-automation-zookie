import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Send, Loader2, CheckCircle2, AlertCircle, Image as ImageIcon, UploadCloud, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Freeform = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    // Meta API Credentials are now handled securely by Netlify Functions on the backend.
    // The VITE_ prefix is no longer required or recommended for these sensitive keys.
    const [messageText, setMessageText] = useState('');
    const [headerImage, setHeaderImage] = useState('');

    const [broadcasting, setBroadcasting] = useState(false);
    const [broadcastStatus, setBroadcastStatus] = useState({ total: 0, sent: 0, failed: 0 });
    const [message, setMessage] = useState('');

    const [showImageModal, setShowImageModal] = useState(false);
    const [images, setImages] = useState([]);
    const [loadingImages, setLoadingImages] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);

    const fetchImages = async () => {
        setLoadingImages(true);
        try {
            const { data, error } = await supabase.storage.from('broadcast-images').list();
            if (error) throw error;

            const validImages = (data || []).filter(item => item.name && !item.name.startsWith('.'));
            const imageList = validImages.map(img => {
                const { data: { publicUrl } } = supabase.storage.from('broadcast-images').getPublicUrl(img.name);
                return { name: img.name, url: publicUrl, created_at: img.created_at };
            }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

            setImages(imageList);
        } catch (err) {
            console.error('Error fetching images:', err);
            setMessage('Error loading images from storage.');
        } finally {
            setLoadingImages(false);
        }
    };

    const openImageModal = () => {
        setShowImageModal(true);
        fetchImages();
    };

    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const MAX_FILE_SIZE = 10 * 1024 * 1024;
        if (file.size > MAX_FILE_SIZE) {
            setMessage('Image upload failed: File size exceeds the 10MB limit.');
            setShowImageModal(false);
            e.target.value = null;
            return;
        }

        setUploadingImage(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
                .from('broadcast-images')
                .upload(fileName, file);

            if (uploadError) throw uploadError;

            await fetchImages();

        } catch (err) {
            console.error('Upload Error:', err);
            setMessage(`Image upload failed: ${err.message}`);
            setShowImageModal(false);
        } finally {
            setUploadingImage(false);
            e.target.value = null;
        }
    };

    const startBroadcast = async () => {
        if (!messageText && !headerImage) {
            setMessage('Please enter a message or attach an image.');
            return;
        }

        setBroadcasting(true);
        setMessage('');

        try {
            const { data: contacts, error } = await supabase
                .from('contacts')
                .select('*');

            if (error) throw error;
            if (!contacts || contacts.length === 0) {
                throw new Error("No contacts found. Please upload contacts first.");
            }

            setBroadcastStatus({ total: contacts.length, sent: 0, failed: 0 });

            let sentCount = 0;
            let failedCount = 0;

            for (const contact of contacts) {
                try {
                    // For freeform messages, we can send text or image payloads
                    let payload;

                    if (headerImage) {
                        // Send image message
                        payload = {
                            messaging_product: "whatsapp",
                            recipient_type: "individual",
                            to: `91${contact.phone_number}`,
                            type: "image",
                            image: {
                                link: headerImage,
                                caption: messageText // Optional text with image
                            }
                        };
                    } else {
                        // Send plain text message
                        payload = {
                            messaging_product: "whatsapp",
                            recipient_type: "individual",
                            to: `91${contact.phone_number}`,
                            type: "text",
                            text: {
                                preview_url: false,
                                body: messageText
                            }
                        };
                    }

                    const res = await fetch('/api/send-message', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(payload)
                    });

                    const result = await res.json();

                    if (result.error) {
                        throw new Error(result.error.message || JSON.stringify(result.error));
                    }

                    if (result.messages && result.messages.length > 0 && result.messages[0].id) {
                        const messageId = result.messages[0].id;

                        await supabase
                            .from('message_logs')
                            .insert([{
                                message_id: messageId,
                                contact_phone: contact.phone_number,
                                template_name: 'Freeform Message',
                                status: 'sent'
                            }]);
                    } else {
                        throw new Error(`Message sent but failed to retrieve Message ID.`);
                    }

                    sentCount++;
                } catch (err) {
                    console.error(`Failed to send to ${contact.phone_number}:`, err);
                    failedCount++;
                }

                setBroadcastStatus(prev => ({ ...prev, sent: sentCount, failed: failedCount }));
                await new Promise(resolve => setTimeout(resolve, 50));
            }

            setMessage(`Broadcast finished! Sent: ${sentCount}. Failed: ${failedCount}.`);

        } catch (err) {
            setMessage(`Broadcast failed: ${err.message}`);
        } finally {
            setBroadcasting(false);
        }
    };

    return (
        <div className="min-h-screen p-4 md:p-8">
            <header className="flex flex-col md:flex-row justify-between items-center mb-6 md:mb-8 gap-4">
                <div className="flex w-full md:w-auto justify-start">
                    <button onClick={() => navigate('/dashboard')} className="flex items-center gap-2 text-muted hover:text-white transition-colors focus:outline-none">
                        <ArrowLeft size={20} /> <span className="hidden sm:inline-block">Back to Dashboard</span>
                    </button>
                </div>
                <div className="flex w-full md:w-auto items-center justify-between md:justify-end gap-4">
                    <h1 className="text-xl md:text-2xl font-bold">Freeform Messages</h1>
                </div>
            </header>

            <div className="max-w-4xl mx-auto">
                <div className="glass-panel p-6 sm:p-8 flex flex-col">
                    {message && (
                        <div className={`mb-6 p-4 rounded-xl flex items-start gap-3 border ${message.includes('fail') || message.includes('Error') || message.includes('Please enter') ? 'bg-error/10 border-error/20 text-error' : 'bg-success/10 border-success/20 text-success'}`}>
                            {message.includes('fail') || message.includes('Error') || message.includes('Please enter') ? <AlertCircle size={20} className="shrink-0 mt-0.5" /> : <CheckCircle2 size={20} className="shrink-0 mt-0.5" />}
                            <span className="leading-relaxed">{message}</span>
                        </div>
                    )}

                    <div className="mb-6">
                        <h2 className="text-2xl font-bold mb-2">Compose Message</h2>
                        <p className="text-muted text-sm">Send unapproved messages to users who interacted within 24h.</p>
                    </div>

                    <div className="space-y-6">
                        <div className="group">
                            <label className="block text-sm font-medium text-muted mb-2 group-focus-within:text-primary transition-colors">Attached Image (Optional)</label>
                            <div className="flex gap-2">
                                <input
                                    type="url"
                                    placeholder="https://example.com/image.jpg"
                                    value={headerImage}
                                    onChange={(e) => setHeaderImage(e.target.value)}
                                    className="flex-1"
                                />
                                <button
                                    onClick={openImageModal}
                                    className="px-4 py-2 bg-background-dark/50 border border-border-color rounded-xl hover:bg-primary/20 hover:border-primary/50 transition-colors flex items-center gap-2 group-focus-within:border-primary/50"
                                >
                                    <ImageIcon size={20} className="text-primary" />
                                    <span className="hidden sm:inline-block text-sm font-medium">Assets</span>
                                </button>
                            </div>
                            {headerImage && (
                                <div className="mt-3 relative inline-block">
                                    <img src={headerImage} alt="Attached header preview" className="h-32 rounded-lg border border-border-color object-cover" />
                                    <button
                                        onClick={() => setHeaderImage('')}
                                        className="absolute -top-2 -right-2 bg-error text-white rounded-full p-1 shadow-md hover:bg-error-hover transition-colors"
                                        title="Remove Image"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="group">
                            <label className="block text-sm font-medium text-muted mb-2 group-focus-within:text-primary transition-colors">Message Text</label>
                            <textarea
                                rows={6}
                                placeholder="Type your message here..."
                                value={messageText}
                                onChange={(e) => setMessageText(e.target.value)}
                                className="w-full bg-background-dark/50 border border-border-color rounded-xl p-4 focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-colors resize-none"
                            ></textarea>
                        </div>
                    </div>

                    <button
                        onClick={startBroadcast}
                        disabled={broadcasting}
                        className="btn-primary w-full mt-8 flex justify-center items-center gap-3 py-4 text-base shadow-xl shadow-primary/20"
                    >
                        {broadcasting ? <><Loader2 className="animate-spin" size={22} /> Sending ({broadcastStatus.sent + broadcastStatus.failed}/{broadcastStatus.total})...</> : <><Send size={22} className="ml-1 -mr-1" /> Send to Contacts</>}
                    </button>
                </div>
            </div>

            {/* Image Asset Manager Modal */}
            {showImageModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background-dark/80 backdrop-blur-sm animate-fade-in">
                    <div className="glass-panel w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-border-color/50">
                        <div className="flex justify-between items-center p-6 border-b border-border-color pb-4 bg-background-dark/20">
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                <ImageIcon className="text-primary" /> Image Asset Manager
                            </h2>
                            <button onClick={() => setShowImageModal(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors text-muted hover:text-white">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-background-dark/10">
                            <div className="mb-8 p-6 border-2 border-dashed border-border-color rounded-2xl bg-surface-dark/20 hover:bg-surface-dark/40 transition-colors group relative cursor-pointer">
                                <input
                                    type="file"
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                    accept="image/*"
                                    onChange={handleImageUpload}
                                    disabled={uploadingImage}
                                />
                                <div className="flex flex-col items-center justify-center text-center">
                                    {uploadingImage ? (
                                        <div className="flex flex-col items-center gap-3 text-primary">
                                            <Loader2 className="animate-spin" size={40} />
                                            <p className="font-semibold animate-pulse">Uploading Image...</p>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="bg-primary/10 p-4 rounded-full mb-4 group-hover:scale-110 transition-transform">
                                                <UploadCloud size={32} className="text-primary" />
                                            </div>
                                            <p className="font-semibold text-lg text-white mb-1">Click or drag image to upload</p>
                                            <p className="text-sm text-muted">Supports JPG, PNG, WEBP (Max 10MB)</p>
                                        </>
                                    )}
                                </div>
                            </div>

                            <h3 className="text-sm font-bold text-muted uppercase tracking-wider mb-4 border-b border-white/5 pb-2">Your Supabase Gallery</h3>

                            {loadingImages ? (
                                <div className="flex justify-center p-12">
                                    <Loader2 className="animate-spin text-primary" size={32} />
                                </div>
                            ) : images.length === 0 ? (
                                <div className="text-center p-12 border border-border-color rounded-xl bg-background-dark/20 text-muted">
                                    <ImageIcon size={48} className="mx-auto mb-4 opacity-30" />
                                    <p>No images found in your 'broadcast-images' bucket.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                                    {images.map((img) => (
                                        <div
                                            key={img.name}
                                            className="group relative aspect-square rounded-xl overflow-hidden border border-border-color bg-background-dark hover:border-primary/50 transition-all cursor-pointer"
                                            onClick={() => {
                                                setHeaderImage(img.url);
                                                setShowImageModal(false);
                                            }}
                                        >
                                            <img src={img.url} alt={img.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" loading="lazy" />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                                                <p className="text-xs text-white truncate font-medium">{img.name}</p>
                                                <div className="mt-2 w-full bg-primary text-white text-xs font-bold py-1.5 rounded-lg text-center shadow-lg transform translate-y-4 group-hover:translate-y-0 transition-transform">
                                                    Select Image
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Freeform;
