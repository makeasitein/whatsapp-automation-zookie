import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Settings, Send, Loader2, CheckCircle2, AlertCircle, Image as ImageIcon, UploadCloud, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Broadcast = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    const credentials = {
        accessToken: import.meta.env.VITE_META_ACCESS_TOKEN || '',
        wabaId: import.meta.env.VITE_META_WABA_ID || '',
        phoneId: import.meta.env.VITE_META_PHONE_ID || ''
    };

    const [templates, setTemplates] = useState([]);
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [templateVariables, setTemplateVariables] = useState({});
    const [headerImage, setHeaderImage] = useState('');

    const [loadingTemplates, setLoadingTemplates] = useState(false);
    const [broadcasting, setBroadcasting] = useState(false);
    const [broadcastStatus, setBroadcastStatus] = useState({ total: 0, sent: 0, failed: 0 });
    const [message, setMessage] = useState('');

    const [showImageModal, setShowImageModal] = useState(false);
    const [images, setImages] = useState([]);
    const [loadingImages, setLoadingImages] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);

    useEffect(() => {
        if (credentials.accessToken && credentials.wabaId) {
            fetchTemplates();
        }
    }, []);

    const fetchTemplates = async () => {
        setLoadingTemplates(true);
        setMessage('');
        try {
            const response = await fetch(`https://graph.facebook.com/v23.0/${credentials.wabaId}/message_templates?fields=name,status,components,language,category`, {
                headers: {
                    'Authorization': `Bearer ${credentials.accessToken}`
                }
            });
            const data = await response.json();

            if (data.error) throw new Error(data.error.message);

            const approvedTemplates = (data.data || []).filter(t => t.status === 'APPROVED');
            setTemplates(approvedTemplates);
        } catch (err) {
            console.error(err);
            setMessage('Error fetching templates: ' + err.message);
        } finally {
            setLoadingTemplates(false);
        }
    };

    const fetchImages = async () => {
        setLoadingImages(true);
        try {
            const { data, error } = await supabase.storage.from('broadcast-images').list();
            if (error) throw error;

            // Filter out any hidden files like .emptyFolderPlaceholder
            const validImages = (data || []).filter(item => item.name && !item.name.startsWith('.'));

            // Map to public URLs
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

        // Check file size (10 MB limit)
        const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes
        if (file.size > MAX_FILE_SIZE) {
            setMessage('Image upload failed: File size exceeds the 10MB limit.');
            setShowImageModal(false);
            e.target.value = null; // Reset input
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

            // Refresh image list
            await fetchImages();

        } catch (err) {
            console.error('Upload Error:', err);
            setMessage(`Image upload failed: ${err.message}`);
            setShowImageModal(false); // Close to show error on main screen
        } finally {
            setUploadingImage(false);
            e.target.value = null; // Reset input
        }
    };

    const startBroadcast = async () => {
        if (!selectedTemplate) return;

        setBroadcasting(true);
        setMessage('');

        try {
            // 1. Fetch Contacts
            const { data: contacts, error } = await supabase
                .from('contacts')
                .select('*');

            if (error) throw error;
            if (!contacts || contacts.length === 0) {
                throw new Error("No contacts found. Please upload contacts first.");
            }

            // 2. Prepare payload components
            const components = [];
            const headerComp = selectedTemplate.components.find(c => c.type === 'HEADER');
            if (headerComp && headerComp.format === 'IMAGE' && headerImage) {
                components.push({
                    type: 'header',
                    parameters: [{ type: 'image', image: { link: headerImage } }]
                });
            }

            const bodyComp = selectedTemplate.components.find(c => c.type === 'BODY');
            if (bodyComp && bodyComp.text.includes('{{')) {
                // Find how many variables we need
                const varMatches = bodyComp.text.match(/\{\{\d+\}\}/g) || [];
                const uniqueVars = [...new Set(varMatches)];

                if (uniqueVars.length > 0) {
                    const bodyParameters = uniqueVars.map((_, idx) => ({
                        type: 'text',
                        text: templateVariables[idx + 1] || ' '
                    }));
                    components.push({
                        type: 'body',
                        parameters: bodyParameters
                    });
                }
            }

            setBroadcastStatus({ total: contacts.length, sent: 0, failed: 0 });

            // 3. Loop and send
            let sentCount = 0;
            let failedCount = 0;

            // Batch processing could be implemented here for large lists
            // For simplicity, we loop synchronously to avoid hitting rate limits instantly
            for (const contact of contacts) {
                try {
                    // Base template payload
                    const templatePayload = {
                        name: selectedTemplate.name,
                        language: { code: selectedTemplate.language },
                        components: components
                    };

                    const payload = {
                        messaging_product: "whatsapp",
                        to: `91${contact.phone_number}`, // Append India country code
                        type: "template",
                        template: templatePayload
                    };

                    // Add click tracking if it is a marketing template (or always for safety)
                    if (selectedTemplate.category === 'MARKETING') {
                        payload.message_activity_sharing = true; // Enables click tracking
                    }

                    const endpoint = selectedTemplate.category === 'MARKETING'
                        ? 'marketing_messages'
                        : 'messages';

                    const res = await fetch(`https://graph.facebook.com/v23.0/${credentials.phoneId}/${endpoint}`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${credentials.accessToken}`
                        },
                        body: JSON.stringify(payload)
                    });

                    const result = await res.json();
                    console.log(`Payload sent to ${contact.phone_number} via ${endpoint}:`, payload);
                    console.log(`Response for ${contact.phone_number}:`, result);

                    if (result.error) {
                        throw new Error(result.error.message || JSON.stringify(result.error));
                    }

                    if (result.messages && result.messages.length > 0 && result.messages[0].id) {
                        const messageId = result.messages[0].id;

                        // Log to Supabase
                        const { error: logError } = await supabase
                            .from('message_logs')
                            .insert([{
                                message_id: messageId,
                                contact_phone: contact.phone_number,
                                template_name: selectedTemplate.name,
                                status: 'sent'
                            }]);

                        if (logError) {
                            console.error(`Failed to log message ${messageId} to Supabase:`, logError);
                            // We don't throw here to avoid failing the broadcast if just logging fails, 
                            // but we could if strict tracking is required.
                        }
                    } else {
                        // Throw an error so it fails the specific contact and alerts the user
                        throw new Error(`Message sent but failed to retrieve Message ID (response.messages[0].id) from Meta. 🛠 How To Check Properly: Ensure your app has correct permissions.`);
                    }

                    sentCount++;
                } catch (err) {
                    console.error(`Failed to send to ${contact.phone_number}:`, err);
                    failedCount++;
                }

                // Update UI
                setBroadcastStatus(prev => ({ ...prev, sent: sentCount, failed: failedCount }));

                // Artificial delay for rate limits (e.g. 50ms)
                await new Promise(resolve => setTimeout(resolve, 50));
            }

            setMessage(`Broadcast finished! Sent: ${sentCount}. Failed: ${failedCount}.`);

        } catch (err) {
            setMessage(`Broadcast failed: ${err.message}`);
        } finally {
            setBroadcasting(false);
        }
    };

    const renderTemplateBuilder = () => {
        if (!selectedTemplate) return null;

        const headerComp = selectedTemplate.components.find(c => c.type === 'HEADER');
        const bodyComp = selectedTemplate.components.find(c => c.type === 'BODY');
        const hasImageHeader = headerComp && headerComp.format === 'IMAGE';
        const varMatches = bodyComp ? bodyComp.text.match(/\{\{\d+\}\}/g) || [] : [];
        const uniqueVars = [...new Set(varMatches)];

        return (
            <div className="mt-8 border-t border-border-color pt-8 animate-fade-in">
                <h3 className="text-lg font-semibold mb-5 flex items-center gap-2">
                    <div className="w-1.5 h-5 bg-primary rounded-full"></div>
                    Template Variables
                </h3>

                <div className="space-y-5">
                    {hasImageHeader && (
                        <div className="group">
                            <label className="block text-sm font-medium text-muted mb-2 group-focus-within:text-primary transition-colors">Header Image URL</label>
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
                        </div>
                    )}

                    {uniqueVars.map((v, i) => {
                        const varIndex = i + 1;
                        return (
                            <div key={varIndex} className="group">
                                <label className="block text-sm font-medium text-muted mb-2 group-focus-within:text-primary transition-colors">Variable {`{{${varIndex}}}`}</label>
                                <input
                                    type="text"
                                    placeholder={`Value for {{${varIndex}}}`}
                                    value={templateVariables[varIndex] || ''}
                                    onChange={(e) => setTemplateVariables({ ...templateVariables, [varIndex]: e.target.value })}
                                />
                            </div>
                        );
                    })}
                </div>

                <div className="bg-background-dark/30 p-5 rounded-xl mt-8 border border-border-color/50 shadow-inner">
                    <h4 className="text-sm font-bold text-muted uppercase tracking-wider mb-3">Message Preview</h4>
                    <div className="text-[15px] leading-relaxed text-white whitespace-pre-wrap">
                        {hasImageHeader && headerImage && <div className="mb-3 text-primary bg-primary-light/50 inline-block px-3 py-1 rounded-md text-sm font-medium border border-primary/20">📸 Attached Image</div>}
                        <div className="bg-background-dark/50 p-4 rounded-lg border border-border-color">
                            {bodyComp?.text.replace(/\{\{(\d+)\}\}/g, (match, p1) => {
                                return templateVariables[p1] ? `**${templateVariables[p1]}**` : match;
                            })}
                        </div>
                    </div>
                </div>

                <button
                    onClick={startBroadcast}
                    disabled={broadcasting}
                    className="btn-primary w-full mt-8 flex justify-center items-center gap-3 py-4 text-base shadow-xl shadow-primary/20"
                >
                    {broadcasting ? <><Loader2 className="animate-spin" size={22} /> Sending ({broadcastStatus.sent + broadcastStatus.failed}/{broadcastStatus.total})...</> : <><Send size={22} className="ml-1 -mr-1" /> Send to All Contacts</>}
                </button>
            </div>
        );
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
                    <h1 className="text-xl md:text-2xl font-bold">Broadcast Setup</h1>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8 max-w-7xl mx-auto">

                {/* Templates Selection */}
                <div className="lg:col-span-1">
                    <div className="glass-panel p-6 h-full flex flex-col">
                        <div className="flex justify-between items-center mb-6 pb-4 border-b border-border-color">
                            <h2 className="text-xl font-semibold">Templates</h2>
                            <button onClick={fetchTemplates} className="text-sm font-medium text-primary hover:text-primary-hover hover:underline bg-transparent flex items-center gap-1 focus:outline-none" disabled={loadingTemplates}>
                                {loadingTemplates ? 'Refreshing...' : 'Refresh'}
                            </button>
                        </div>

                        <div className="flex-1 overflow-auto max-h-[600px] pr-2 custom-scrollbar">
                            {loadingTemplates ? (
                                <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" size={32} /></div>
                            ) : templates.length === 0 ? (
                                <div className="text-center text-muted py-12 px-4 text-sm bg-background-dark/20 rounded-xl border border-dashed border-border-color">
                                    No approved templates found. Check your WABA ID or Meta account.
                                </div>
                            ) : (
                                <div className="flex flex-col gap-3">
                                    {templates.map(t => (
                                        <div
                                            key={t.name}
                                            onClick={() => { setSelectedTemplate(t); setTemplateVariables({}); setHeaderImage(''); setMessage(''); }}
                                            className={`p-4 rounded-xl cursor-pointer border transition-all duration-200 ${selectedTemplate?.name === t.name ? 'border-primary bg-primary-light shadow-md shadow-primary/10' : 'border-border-color bg-background-dark/40 hover:border-primary/50 hover:bg-background-dark/80'}`}
                                        >
                                            <h3 className={`font-semibold text-sm ${selectedTemplate?.name === t.name ? 'text-primary' : 'text-white'}`}>{t.name}</h3>
                                            <span className="text-xs font-medium text-muted uppercase mt-1.5 inline-block tracking-wider px-2 py-0.5 bg-background-dark/50 rounded-md">{t.language}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Broadcasting Build Panel */}
                <div className="lg:col-span-2">
                    <div className="glass-panel p-6 sm:p-8 min-h-[400px] flex flex-col">
                        {message && (
                            <div className={`mb-6 p-4 rounded-xl flex items-start gap-3 border ${message.includes('fail') || message.includes('Error') ? 'bg-error/10 border-error/20 text-error' : 'bg-success/10 border-success/20 text-success'}`}>
                                {message.includes('fail') || message.includes('Error') ? <AlertCircle size={20} className="shrink-0 mt-0.5" /> : <CheckCircle2 size={20} className="shrink-0 mt-0.5" />}
                                <span className="leading-relaxed">{message}</span>
                            </div>
                        )}

                        {!selectedTemplate ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-muted opacity-60 mt-12 mb-12 border-2 border-dashed border-border-color rounded-2xl bg-background-dark/10 p-8 text-center">
                                <div className="bg-background-dark/50 p-6 rounded-full mb-6">
                                    <Send size={48} className="text-muted" />
                                </div>
                                <p className="text-lg">Select a template from the left to configure your broadcast.</p>
                            </div>
                        ) : (
                            <div className="flex-1">
                                <div className="mb-6">
                                    <h2 className="text-2xl font-bold mb-2">Configure Broadcast</h2>
                                    <p className="text-muted text-sm">Template: <span className="font-semibold text-primary bg-primary-light px-2 py-0.5 rounded-md ml-1">{selectedTemplate.name}</span></p>
                                </div>

                                {renderTemplateBuilder()}
                            </div>
                        )}
                    </div>
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

export default Broadcast;
