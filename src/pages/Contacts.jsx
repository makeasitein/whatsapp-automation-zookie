import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import * as xlsx from 'xlsx';
import { PhoneNumberUtil } from 'google-libphonenumber';
import { UploadCloud, CheckCircle2, AlertCircle, ArrowLeft, Trash2, Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const phoneUtil = PhoneNumberUtil.getInstance();

const Contacts = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [contacts, setContacts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        fetchContacts();
    }, [user]);

    const fetchContacts = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('contacts')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setContacts(data || []);
        } catch (err) {
            console.error(err);
            setMessage('Failed to load contacts.');
        } finally {
            setLoading(false);
        }
    };

    const detectColumns = (headers) => {
        let nameCol = null;
        let phoneCol = null;

        for (const col of headers) {
            if (!col) continue;
            const colLower = String(col).toLowerCase();

            if (nameCol === null && (colLower.includes('name') || colLower.includes('contact') || colLower.includes('client'))) {
                nameCol = col;
            }

            if (phoneCol === null && (colLower.includes('phone') || colLower.includes('mobile') || colLower.includes('number') || colLower.includes('tel'))) {
                phoneCol = col;
            }
        }

        if (nameCol === null) nameCol = headers[0];
        if (phoneCol === null) phoneCol = headers[headers.length > 1 ? 1 : 0];

        return { nameCol, phoneCol };
    };

    const cleanIndianNumber = (rawNumber) => {
        if (rawNumber === null || rawNumber === undefined) return null;

        let rawStr = String(rawNumber).trim();

        // Remove .0 (Excel float issue)
        if (rawStr.endsWith(".0")) {
            rawStr = rawStr.slice(0, -2);
        }

        // Remove non-digits
        let number = rawStr.replace(/\D/g, "");

        // Ignore numbers less than 10 digits
        if (number.length < 10) return null;

        // Remove country code 91
        if (number.startsWith("91") && number.length > 10) {
            number = number.slice(2);
        }

        // Remove leading 0
        if (number.startsWith("0") && number.length > 10) {
            number = number.slice(1);
        }

        if (number.length !== 10) return null;

        if (!["6", "7", "8", "9"].includes(number[0])) return null;

        // Check if all characters are the same
        if (new Set(number).size === 1) return null;

        try {
            const parsed = phoneUtil.parse("+91" + number, "IN");
            if (!phoneUtil.isValidNumber(parsed)) {
                return null;
            }
        } catch (e) {
            return null;
        }

        return number;
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploading(true);
        setMessage('');

        try {
            const data = await file.arrayBuffer();
            const workbook = xlsx.read(data);
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];

            // Read as array of objects instead of array of arrays, to use column headers
            const jsonData = xlsx.utils.sheet_to_json(worksheet, { defval: "" });

            if (jsonData.length === 0) {
                setMessage('The uploaded Excel file is empty.');
                setUploading(false);
                return;
            }

            // Extract headers from the first object
            const headers = Object.keys(jsonData[0]);
            const { nameCol, phoneCol } = detectColumns(headers);

            // Process Data
            let processedContacts = [];
            const seenPhones = new Set();

            jsonData.forEach(row => {
                const name = row[nameCol] || 'Unknown';
                const phone = row[phoneCol] || '';

                const cleanPhone = cleanIndianNumber(phone);

                if (cleanPhone && !seenPhones.has(cleanPhone)) {
                    seenPhones.add(cleanPhone);
                    processedContacts.push({
                        name: String(name).trim(),
                        phone_number: cleanPhone
                    });
                }
            });

            if (processedContacts.length === 0) {
                setMessage('No valid Indian contacts found. Numbers must be 10 digits.');
                setUploading(false);
                return;
            }

            // Check against database to avoid duplicate conflicts
            const existingPhones = new Set(contacts.map(c => c.phone_number));
            const newContacts = processedContacts.filter(c => !existingPhones.has(c.phone_number));

            if (newContacts.length === 0) {
                setMessage(`Found ${processedContacts.length} valid contacts, but they already exist in your database.`);
                setUploading(false);
                return;
            }

            // Chunk inserts for limits
            const { error } = await supabase
                .from('contacts')
                .insert(newContacts);

            if (error) {
                if (error.code === '23505') {
                    setMessage('Some numbers were already in the database.');
                } else {
                    throw error;
                }
            } else {
                setMessage(`Successfully imported ${newContacts.length} new contacts (ignored ${processedContacts.length - newContacts.length} duplicates).`);
            }

            fetchContacts(); // Refresh list

        } catch (err) {
            console.error(err);
            setMessage('Error processing file. Ensure it is a valid Excel format.');
        } finally {
            setUploading(false);
            e.target.value = null; // Reset input
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to delete this contact?")) return;
        try {
            const { error } = await supabase.from('contacts').delete().eq('id', id);
            if (error) throw error;
            setContacts(contacts.filter(c => c.id !== id));
        } catch (err) {
            console.error(err);
            alert('Failed to delete contact');
        }
    };

    const exportToExcel = () => {
        if (contacts.length === 0) return;
        const exportData = contacts.map(c => ({
            Name: c.name,
            'Phone Number': c.phone_number
        }));

        const worksheet = xlsx.utils.json_to_sheet(exportData);
        const workbook = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(workbook, worksheet, "Contacts");
        xlsx.writeFile(workbook, "Contacts_Export.xlsx");
    };

    return (
        <div className="min-h-screen p-4 md:p-8">
            <header className="flex flex-col md:flex-row justify-between items-center mb-6 md:mb-8 gap-4">
                <div className="flex w-full md:w-auto justify-start">
                    <button onClick={() => navigate('/dashboard')} className="flex items-center gap-2 text-muted hover:text-white transition-colors focus:outline-none">
                        <ArrowLeft size={20} /> <span className="hidden sm:inline-block">Back to Dashboard</span>
                    </button>
                </div>
                <h1 className="text-xl md:text-2xl font-bold w-full md:w-auto text-center md:text-left">Contact Management</h1>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8 max-w-7xl mx-auto">
                {/* Upload Section */}
                <div className="lg:col-span-1">
                    <div className="glass-panel p-6 sm:p-8 h-full">
                        <h2 className="text-xl font-semibold mb-3">Import Contacts</h2>
                        <p className="text-muted text-sm leading-relaxed mb-6">
                            Upload an Excel file (.xls, .xlsx). We expect Column A to be Name and Column B to be Phone Number. We'll automatically remove duplicates and numbers with less than 10 digits.
                        </p>

                        <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-border-color rounded-2xl cursor-pointer bg-background-dark/30 hover:bg-background-dark/50 hover:border-primary/50 transition-all duration-300 group">
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                <UploadCloud className="w-12 h-12 mb-4 text-primary group-hover:scale-110 transition-transform duration-300" />
                                <p className="mb-2 text-sm text-text-muted"><span className="font-semibold text-white">Click to upload</span> or drag and drop</p>
                                <p className="text-xs text-text-muted/70">XLS, XLSX up to 10MB</p>
                            </div>
                            <input type="file" className="hidden" accept=".xls,.xlsx" onChange={handleFileUpload} disabled={uploading} />
                        </label>

                        {uploading && (
                            <div className="mt-6 text-center text-sm font-semibold text-primary animate-pulse flex justify-center items-center gap-2">
                                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                                Processing file...
                            </div>
                        )}

                        {message && (
                            <div className={`mt-6 p-4 rounded-xl flex items-start gap-3 text-sm border shadow-inner ${message.includes('Error') || message.includes('No valid') ? 'bg-error/10 border-error/20 text-error' : 'bg-success/10 border-success/20 text-success'}`}>
                                {message.includes('Error') || message.includes('No valid') ? <AlertCircle size={18} className="shrink-0 mt-0.5" /> : <CheckCircle2 size={18} className="shrink-0 mt-0.5" />}
                                <span className="leading-relaxed">{message}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* List Section */}
                <div className="lg:col-span-2">
                    <div className="glass-panel p-6 sm:p-8 h-full flex flex-col">
                        <div className="flex justify-between items-center mb-6 pb-4 border-b border-border-color">
                            <h2 className="text-xl font-semibold">Saved Contacts</h2>
                            <div className="flex items-center gap-3">
                                <span className="text-sm bg-primary-light text-primary font-bold px-4 py-1.5 rounded-full">
                                    {contacts.length} Total
                                </span>
                                <button
                                    onClick={exportToExcel}
                                    disabled={contacts.length === 0}
                                    className="flex items-center gap-2 px-4 py-1.5 text-sm font-semibold text-white bg-background-dark border border-border-color rounded-full hover:bg-background-dark/80 hover:border-primary/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Download size={16} />
                                    <span className="hidden sm:inline-block">Export to Excel</span>
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-auto max-h-[60vh] pr-2 custom-scrollbar">
                            {loading ? (
                                <div className="h-full flex flex-col justify-center items-center text-muted gap-3 py-10">
                                    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                                    Loading contacts...
                                </div>
                            ) : contacts.length === 0 ? (
                                <div className="text-center text-muted py-12 border-2 border-dashed border-border-color rounded-2xl h-full flex flex-col items-center justify-center bg-background-dark/20">
                                    <AlertCircle className="mb-4 opacity-40" size={48} />
                                    <p className="text-lg font-medium text-white mb-2">No contacts found</p>
                                    <p className="max-w-xs">Upload a file using the panel on the left to get started.</p>
                                </div>
                            ) : (
                                <div className="grid gap-4">
                                    {contacts.map(contact => (
                                        <div key={contact.id} className="flex justify-between items-center p-4 sm:p-5 bg-background-dark/40 border border-border-color rounded-xl hover:border-primary/50 hover:bg-background-dark/80 transition-all duration-200 group">
                                            <div>
                                                <p className="font-semibold text-[1.05rem] mb-1">{contact.name}</p>
                                                <p className="text-sm font-medium text-muted tracking-wide">+{contact.phone_number}</p>
                                            </div>
                                            <button onClick={() => handleDelete(contact.id)} className="text-muted hover:text-error bg-transparent p-2.5 rounded-full hover:bg-error/10 transition-colors focus:outline-none opacity-100 sm:opacity-0 group-hover:opacity-100">
                                                <Trash2 size={20} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Contacts;
