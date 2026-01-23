"use client"; // Required for Next.js Client Components

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image'; // Next.js Image optimization
import { 
    FaUpload, FaUser, FaPencilAlt, FaTrashAlt, FaCalendarAlt, 
    FaMapMarkerAlt, FaPhone, FaHome, FaBirthdayCake, 
    FaHeart, FaBriefcase, FaSpinner 
} from 'react-icons/fa';

// Update your firebase import path to match Next.js alias if you use one (e.g., @/lib/firebase)
import { db } from '@/app/lib/firebase'; 
import { cloudinaryConfig } from "@/app/lib/cloudinaryUpload";

import {
    collection,
    addDoc,
    updateDoc,
    doc,
    deleteDoc,
    onSnapshot,
    query,
    where
} from 'firebase/firestore';

/** --- REUSABLE COMPONENTS --- **/

const Input = ({ id, label, type = 'text', value, onChange, placeholder, readOnly = false, icon: Icon = null }) => (
    <div className="flex flex-col space-y-1">
        <label htmlFor={id} className="text-sm font-medium text-gray-700">{label}</label>
        <div className="relative">
            {Icon && (
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Icon size={18} className="text-gray-400" />
                </div>
            )}
            <input
                id={id}
                type={type}
                value={value}
                onChange={onChange}
                readOnly={readOnly}
                placeholder={placeholder}
                className={`w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors duration-200 ${Icon ? 'pl-10' : ''} text-black`}
            />
        </div>
    </div>
);

const Button = ({ onClick, children, className = "", disabled = false, type = "button" }) => (
    <button
        type={type}
        onClick={onClick}
        disabled={disabled}
        className={`inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500
                ${disabled ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700'}
                ${className}`}
    >
        {children}
    </button>
);

const Spinner = () => (
    <div className="flex justify-center items-center py-8">
        <FaSpinner className="animate-spin text-indigo-600 text-4xl" role="status" aria-label="Loading" />
    </div>
);

/** --- MAIN COMPONENT --- **/

export default function ClientDetails({ branch }) {
    // Basic Form States
    const [clientId, setClientId] = useState('');
    const [registrationDate, setRegistrationDate] = useState(new Date().toISOString().slice(0, 10));
    const [staffName, setStaffName] = useState('');
    const [fullName, setFullName] = useState('');
    const [gender, setGender] = useState('');
    const [dateOfBirth, setDateOfBirth] = useState('');
    const [age, setAge] = useState('');
    const [placeOfBirth, setPlaceOfBirth] = useState('');
    const [maritalStatus, setMaritalStatus] = useState('');
    const [telephone, setTelephone] = useState('');
    const [address, setAddress] = useState('');
    
    // UI & Status States
    const [isOnline, setIsOnline] = useState(true);
    const [branchId, setBranchId] = useState('');
    const [companyShortCode, setCompanyShortCode] = useState('');
    const [error, setError] = useState(null);
    const [photoUrl, setPhotoUrl] = useState('');
    const [imagePreviewUrl, setImagePreviewUrl] = useState('');
    const [imageUploading, setImageUploading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const [staffLoading, setStaffLoading] = useState(true);
    
    // Data States
    const [clientList, setClientList] = useState([]);
    const [staffMembers, setStaffMembers] = useState([]);
    const [editingClientId, setEditingClientId] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    const fileInputRef = useRef(null);
    const DELETE_PIN = "1234"; 

    const clientsCollectionRef = collection(db, "clients");
    const staffMembersCollectionRef = collection(db, "staffMembers");

    // 1. ONLINE STATUS (Next.js Fix: Move navigator check to useEffect)
    useEffect(() => {
        setIsOnline(navigator.onLine);
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener("online", handleOnline);
        window.addEventListener("offline", handleOffline);
        return () => {
            window.removeEventListener("online", handleOnline);
            window.removeEventListener("offline", handleOffline);
        };
    }, []);

    // 2. SESSION DATA
    useEffect(() => {
        const id = branch?.branchId || sessionStorage.getItem('branchId') || '';
        const code = sessionStorage.getItem('companyShortCode') || '';
        
        if (id) {
            setBranchId(id);
            setCompanyShortCode(code);
            setError(null);
        } else {
            setError("Session expired or Branch ID missing. Please log in again.");
            setLoading(false);
        }
    }, [branch]);

    // 3. REAL-TIME DATA FETCHING
    useEffect(() => {
        if (!branchId) return;
        setLoading(true);

        const q = query(clientsCollectionRef, where("branchId", "==", branchId));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedClients = snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id }));
            setClientList(fetchedClients);
            setLoading(false);
        }, (err) => {
            console.error("Firestore Error:", err);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [branchId]);

    // 4. STAFF FETCHING
    useEffect(() => {
        if (!branchId) return;
        setStaffLoading(true);
        const staffQuery = query(staffMembersCollectionRef, where('branchId', '==', branchId));
        
        const unsubscribe = onSnapshot(staffQuery, (snapshot) => {
            const fetchedStaff = snapshot.docs.map((doc) => ({
                id: doc.id,
                fullName: doc.data().fullName
            })).sort((a, b) => a.fullName.localeCompare(b.fullName));
            setStaffMembers(fetchedStaff);
            setStaffLoading(false);
        });
        return () => unsubscribe();
    }, [branchId]);

    // 5. AUTO-ID GENERATION (Simplified)
    useEffect(() => {
        if (!editingClientId && clientList.length >= 0) {
            const code = (companyShortCode || "PMCD").toUpperCase();
            const latestNum = clientList.reduce((max, client) => {
                const parts = (client.clientId || "").split('-');
                const num = parseInt(parts[parts.length - 1], 10);
                return !isNaN(num) && num > max ? num : max;
            }, 0);
            setClientId(`${code}-SD-${String(latestNum + 1).padStart(2, '0')}`);
        }
    }, [clientList, editingClientId, companyShortCode]);

    // 6. AGE CALCULATION
    useEffect(() => {
        if (dateOfBirth) {
            const dob = new Date(dateOfBirth);
            const today = new Date();
            let calculatedAge = today.getFullYear() - dob.getFullYear();
            if (today.getMonth() < dob.getMonth() || (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate())) {
                calculatedAge--;
            }
            setAge(calculatedAge.toString());
        }
    }, [dateOfBirth]);

    // --- HANDLERS ---

    const handlePhotoImport = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setImagePreviewUrl(URL.createObjectURL(file));
        setImageUploading(true);

        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', cloudinaryConfig.uploadPreset);
        formData.append('folder', 'Pmc_clients');

        try {
            const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/image/upload`, {
                method: 'POST',
                body: formData,
            });
            const data = await response.json();
            setPhotoUrl(data.secure_url);
        } catch (error) {
            alert("Upload failed. Check your internet.");
            setImagePreviewUrl('');
        } finally {
            setImageUploading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!fullName || !staffName || !branchId) return alert("Fill required fields");
        
        setIsSaving(true);
        const clientData = {
            clientId, registrationDate, staffName, branchId, fullName,
            gender, dateOfBirth, age, placeOfBirth, maritalStatus,
            telephone, address, photoUrl,
            updatedAt: new Date().toISOString(),
            createdAt: editingClientId ? clientList.find(c => c.id === editingClientId)?.createdAt : new Date().toISOString(),
        };

        try {
            if (editingClientId) {
                await updateDoc(doc(db, "clients", editingClientId), clientData);
            } else {
                await addDoc(clientsCollectionRef, clientData);
            }
            clearForm();
            alert("Saved successfully!");
        } catch (err) {
            alert("Error saving data");
        } finally {
            setIsSaving(false);
        }
    };

    const clearForm = () => {
        setFullName(''); setGender(''); setDateOfBirth('');
        setPlaceOfBirth(''); setMaritalStatus(''); setTelephone('');
        setAddress(''); setPhotoUrl(''); setImagePreviewUrl('');
        setEditingClientId(null);
    };

    const filteredClients = clientList.filter(c => 
        c.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
        c.clientId?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (error) return <div className="p-4 text-red-500 font-bold bg-red-50 rounded-lg">{error}</div>;

    return (
        <div className="max-w-6xl mx-auto p-4 space-y-8 text-black">
            {/* SEARCH BAR */}
            <div className="bg-white p-4 rounded-xl shadow-sm border">
                <Input 
                    placeholder="Search by name or ID..." 
                    value={searchTerm} 
                    onChange={(e) => setSearchTerm(e.target.value)}
                    label="Quick Search"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* FORM SECTION */}
                <form onSubmit={handleSubmit} className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-lg border space-y-6">
                    <div className="flex justify-between items-center border-b pb-4">
                        <h2 className="text-2xl font-bold text-indigo-900 flex items-center gap-2">
                            <FaUser /> {editingClientId ? 'Update Client' : 'New Registration'}
                        </h2>
                        {!isOnline && <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full animate-pulse">Offline Mode</span>}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input label="Client ID" value={clientId} readOnly icon={FaBriefcase} />
                        <Input label="Reg. Date" type="date" value={registrationDate} onChange={(e) => setRegistrationDate(e.target.value)} icon={FaCalendarAlt} />
                        
                        <div className="flex flex-col space-y-1">
                            <label className="text-sm font-medium text-gray-700">Assign Staff</label>
                            <select 
                                value={staffName} 
                                onChange={(e) => setStaffName(e.target.value)}
                                className="p-2 border rounded-md bg-white text-black"
                            >
                                <option value="">Select Staff</option>
                                {staffMembers.map(s => <option key={s.id} value={s.fullName}>{s.fullName}</option>)}
                            </select>
                        </div>

                        <Input label="Full Name" value={fullName} onChange={(e) => setFullName(e.target.value)} icon={FaUser} placeholder="Surname First" />
                        <Input label="Phone" value={telephone} onChange={(e) => setTelephone(e.target.value)} icon={FaPhone} />
                        <Input label="DOB" type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} icon={FaBirthdayCake} />
                        <Input label="Age" value={age} readOnly />
                        <Input label="Address" value={address} onChange={(e) => setAddress(e.target.value)} icon={FaHome} />
                    </div>

                    {/* PHOTO SECTION */}
                    <div className="flex flex-col items-center p-4 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                        <input type="file" hidden ref={fileInputRef} onChange={handlePhotoImport} accept="image/*" />
                        {imagePreviewUrl ? (
                            <div className="relative w-32 h-32 rounded-full overflow-hidden border-4 border-white shadow-md">
                                <Image 
                                    src={imagePreviewUrl} 
                                    alt="Preview" 
                                    fill 
                                    className="object-cover"
                                    unoptimized // For blob URLs
                                />
                                {imageUploading && (
                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                        <FaSpinner className="animate-spin text-white text-2xl" />
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="w-32 h-32 bg-gray-200 rounded-full flex items-center justify-center text-gray-400">
                                <FaUser size={48} />
                            </div>
                        )}
                        <Button 
                            onClick={() => fileInputRef.current.click()} 
                            className="mt-4 bg-gray-800"
                            disabled={imageUploading}
                        >
                            <FaUpload className="mr-2" /> {imageUploading ? 'Uploading...' : 'Upload Photo'}
                        </Button>
                    </div>

                    <div className="flex gap-4 pt-4">
                        <Button type="submit" className="flex-1 py-3 h-auto text-lg" disabled={isSaving || imageUploading}>
                            {isSaving ? <FaSpinner className="animate-spin mr-2" /> : <FaUpload className="mr-2" />}
                            {editingClientId ? 'Update Records' : 'Save Registration'}
                        </Button>
                        {editingClientId && (
                            <Button onClick={clearForm} className="bg-gray-200 !text-gray-700 hover:bg-gray-300">
                                Cancel
                            </Button>
                        )}
                    </div>
                </form>

                {/* LIST SECTION */}
                <div className="bg-white rounded-2xl shadow-lg border overflow-hidden">
                    <div className="bg-indigo-900 p-4 text-white">
                        <h3 className="font-bold flex items-center gap-2">
                            Recent Registrations <span className="bg-indigo-700 px-2 py-0.5 rounded text-xs">{filteredClients.length}</span>
                        </h3>
                    </div>
                    <div className="overflow-y-auto max-h-[600px]">
                        {loading ? <Spinner /> : filteredClients.map(client => (
                            <div key={client.id} className="p-4 border-b hover:bg-gray-50 flex items-center gap-4 transition-colors">
                                <div className="relative w-12 h-12 rounded-full overflow-hidden bg-gray-100 flex-shrink-0">
                                    {client.photoUrl ? (
                                        <Image src={client.photoUrl} alt="" fill className="object-cover" />
                                    ) : (
                                        <FaUser className="m-auto mt-3 text-gray-400" />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold truncate">{client.fullName}</p>
                                    <p className="text-xs text-gray-500">{client.clientId}</p>
                                </div>
                                <div className="flex gap-1">
                                    <button onClick={() => handleEdit(client)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg">
                                        <FaPencilAlt size={14} />
                                    </button>
                                    <button onClick={() => handleDelete(client.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg">
                                        <FaTrashAlt size={14} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}