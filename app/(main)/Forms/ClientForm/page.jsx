"use client"; // Required for Next.js Client Components

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { 
    FaUpload, FaUser, FaPencilAlt, FaTrashAlt, FaCalendarAlt, 
    FaMapMarkerAlt, FaPhone, FaHome, FaBirthdayCake, 
    FaBriefcase, FaSpinner, FaIdCard, FaStore, FaMoneyBillWave, FaUsers 
} from 'react-icons/fa';

import { db } from '@/app/lib/firebase'; 
import { cloudinaryConfig } from "@/app/lib/cloudinaryUpload";

import {
    collection,
    addDoc,
    updateDoc,
    doc,
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
                    <Icon size={16} className="text-gray-400" />
                </div>
            )}
            <input
                id={id}
                type={type}
                value={value}
                onChange={onChange}
                readOnly={readOnly}
                placeholder={placeholder}
                className={`w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors duration-200 ${Icon ? 'pl-10' : ''} text-black bg-white`}
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
    const [telephone, setTelephone] = useState('');
    const [address, setAddress] = useState('');

    // Personal & Identity
    const [nationalId, setNationalId] = useState('');
    const [district, setDistrict] = useState('');
    const [town, setTown] = useState('');
    const [maritalStatus, setMaritalStatus] = useState('');
    const [spouseName, setSpouseName] = useState('');
    const [spouseNationalId, setSpouseNationalId] = useState('');

    // Next of Kin States
    const [nokName, setNokName] = useState('');
    const [nokRelationship, setNokRelationship] = useState('');
    const [nokPhone, setNokPhone] = useState('');

    // Business Details States
    const [businessName, setBusinessName] = useState('');
    const [businessNature, setBusinessNature] = useState('');
    const [businessLocation, setBusinessLocation] = useState('');
    const [avgSales, setAvgSales] = useState('');
    const [avgExpenses, setAvgExpenses] = useState('');
    const [isBusinessRegistered, setIsBusinessRegistered] = useState('no');
    const [businessRegDate, setBusinessRegDate] = useState('');
    const [loanPurpose, setLoanPurpose] = useState('');
    const [capitalSource, setCapitalSource] = useState('');
    
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
    
    // Data States
    const [clientList, setClientList] = useState([]);
    const [staffMembers, setStaffMembers] = useState([]);
    const [editingClientId, setEditingClientId] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    const fileInputRef = useRef(null);
    const clientsCollectionRef = collection(db, "clients");
    const staffMembersCollectionRef = collection(db, "staffMembers");

    // 1. ONLINE STATUS
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
   // 2. SESSION DATA (Robust Version)
useEffect(() => {
    if (typeof window !== 'undefined') {
        const keys = Object.keys(sessionStorage);
        let foundData = null;

        // Scan all keys to find the one containing the auth/company data
        keys.forEach(key => {
            const val = sessionStorage.getItem(key);
            if (val && val.includes("companyShortCode")) {
                try {
                    foundData = JSON.parse(val);
                } catch (e) { console.error("Session parse error", e); }
            }
        });

        if (foundData) {
            if (foundData.branchId) setBranchId(foundData.branchId);
            if (foundData.companyShortCode) setCompanyShortCode(foundData.companyShortCode);
            setError(null);
        } else {
            // Fallback to direct keys
            const directBranch = sessionStorage.getItem('branchId');
            const directCode = sessionStorage.getItem('companyShortCode');
            if (directBranch) {
                setBranchId(directBranch);
                setCompanyShortCode(directCode || '');
            } else {
                setError("Session missing. Please log in again.");
                setLoading(false);
            }
        }
    }
}, [branch]);

    // 3. REAL-TIME FETCHING
    useEffect(() => {
        if (!branchId) return;
        const q = query(clientsCollectionRef, where("branchId", "==", branchId));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedClients = snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id }));
            setClientList(fetchedClients);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [branchId]);

    // 4. STAFF FETCHING
    useEffect(() => {
        if (!branchId) return;
        const staffQuery = query(staffMembersCollectionRef, where('branchId', '==', branchId));
        const unsubscribe = onSnapshot(staffQuery, (snapshot) => {
            const fetchedStaff = snapshot.docs.map((doc) => ({
                id: doc.id,
                fullName: doc.data().fullName
            })).sort((a, b) => a.fullName.localeCompare(b.fullName));
            setStaffMembers(fetchedStaff);
        });
        return () => unsubscribe();
    }, [branchId]);


// AUTO-ID GENERATION
// 5. AUTO-ID GENERATION (Regex Version)
useEffect(() => {
    if (!editingClientId) {
        // Ensure we have a code, use "PMCD" as fallback
        const code = (companyShortCode || "PMCD").toLowerCase();
        
        const latestClientNumber = clientList.reduce((max, client) => {
            // Matches: [code]-sd-[numbers] (case insensitive)
            const regex = new RegExp(`^${code}-sd-(\\d+)$`, 'i');
            const numMatch = (client.clientId || "").match(regex);
            const num = numMatch ? parseInt(numMatch[1], 10) : 0;
            return num > max ? num : max;
        }, 0);

        const newNumber = latestClientNumber + 1;
        // Format: CODE-SD-01
        const formattedId = `${code.toUpperCase()}-SD-${String(newNumber).padStart(2, '0')}`;
        setClientId(formattedId);
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
            alert("Upload failed.");
            setImagePreviewUrl('');
        } finally {
            setImageUploading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!fullName || !staffName || !branchId) return alert("Fill required fields (Name, Staff)");
        
        setIsSaving(true);
        const clientData = {
            clientId, registrationDate, staffName, branchId, fullName,
            gender, dateOfBirth, age, telephone, address, photoUrl,
            nationalId, district, town, maritalStatus,
            spouseName: maritalStatus === 'married' ? spouseName : '',
            spouseNationalId: maritalStatus === 'married' ? spouseNationalId : '',
            nokName, nokRelationship, nokPhone,
            businessName, businessNature, businessLocation, avgSales, avgExpenses,
            isBusinessRegistered, 
            businessRegDate: isBusinessRegistered === 'yes' ? businessRegDate : '',
            loanPurpose, capitalSource,
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

    const handleEdit = (client) => {
        setEditingClientId(client.id);
        setClientId(client.clientId);
        setRegistrationDate(client.registrationDate);
        setStaffName(client.staffName);
        setFullName(client.fullName);
        setGender(client.gender);
        setDateOfBirth(client.dateOfBirth);
        setAge(client.age);
        setTelephone(client.telephone);
        setAddress(client.address);
        setPhotoUrl(client.photoUrl);
        setImagePreviewUrl(client.photoUrl);
        setNationalId(client.nationalId || '');
        setDistrict(client.district || '');
        setTown(client.town || '');
        setMaritalStatus(client.maritalStatus || '');
        setSpouseName(client.spouseName || '');
        setSpouseNationalId(client.spouseNationalId || '');
        setNokName(client.nokName || '');
        setNokRelationship(client.nokRelationship || '');
        setNokPhone(client.nokPhone || '');
        setBusinessName(client.businessName || '');
        setBusinessNature(client.businessNature || '');
        setBusinessLocation(client.businessLocation || '');
        setAvgSales(client.avgSales || '');
        setAvgExpenses(client.avgExpenses || '');
        setIsBusinessRegistered(client.isBusinessRegistered || 'no');
        setBusinessRegDate(client.businessRegDate || '');
        setLoanPurpose(client.loanPurpose || '');
        setCapitalSource(client.capitalSource || '');
    };

    const clearForm = () => {
        setFullName(''); setGender(''); setDateOfBirth('');
        setTelephone(''); setAddress(''); setPhotoUrl(''); 
        setImagePreviewUrl(''); setEditingClientId(null);
        setNationalId(''); setDistrict(''); setTown('');
        setMaritalStatus(''); setSpouseName(''); setSpouseNationalId('');
        setNokName(''); setNokRelationship(''); setNokPhone('');
        setBusinessName(''); setBusinessNature(''); setBusinessLocation('');
        setAvgSales(''); setAvgExpenses(''); setIsBusinessRegistered('no');
        setBusinessRegDate(''); setLoanPurpose(''); setCapitalSource('');
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
                        {!isOnline && <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full animate-pulse">Offline</span>}
                    </div>

                    {/* SECTION 1: IDENTITY */}
                    <h3 className="text-md font-bold text-indigo-700 flex items-center gap-2 border-b border-gray-100 pb-2"><FaIdCard /> Identity & Personal</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input label="Client ID" value={clientId} readOnly icon={FaBriefcase} />
                        <Input label="Reg. Date" type="date" value={registrationDate} onChange={(e) => setRegistrationDate(e.target.value)} icon={FaCalendarAlt} />
                        <Input label="National ID No." value={nationalId} onChange={(e) => setNationalId(e.target.value)} placeholder="Card Number" />
                        <div className="flex flex-col space-y-1">
                            <label className="text-sm font-medium text-gray-700">Assign Staff</label>
                            <select value={staffName} onChange={(e) => setStaffName(e.target.value)} className="p-2 border rounded-md bg-white text-black">
                                <option value="">Select Staff</option>
                                {staffMembers.map(s => <option key={s.id} value={s.fullName}>{s.fullName}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input label="Full Name" value={fullName} onChange={(e) => setFullName(e.target.value)} icon={FaUser} placeholder="Surname First" />
                        <Input label="Phone Number" value={telephone} onChange={(e) => setTelephone(e.target.value)} icon={FaPhone} />
                        <Input label="Date of Birth" type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} icon={FaBirthdayCake} />
                        <Input label="Calculated Age" value={age} readOnly />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input label="District" value={district} onChange={(e) => setDistrict(e.target.value)} />
                        <Input label="Town" value={town} onChange={(e) => setTown(e.target.value)} />
                        <Input label="Address" value={address} onChange={(e) => setAddress(e.target.value)} icon={FaHome} />
                        <div className="flex flex-col space-y-1">
                            <label className="text-sm font-medium text-gray-700">Marital Status</label>
                            <select value={maritalStatus} onChange={(e) => setMaritalStatus(e.target.value)} className="p-2 border rounded-md bg-white text-black">
                                <option value="">Select...</option>
                                <option value="married">Married</option>
                                <option value="divorced">Divorced</option>
                                <option value="widow">Widow</option>
                            </select>
                        </div>
                    </div>

                    {maritalStatus === 'married' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-indigo-50 rounded-lg">
                            <Input label="Name of Spouse" value={spouseName} onChange={(e) => setSpouseName(e.target.value)} />
                            <Input label="Spouse National ID" value={spouseNationalId} onChange={(e) => setSpouseNationalId(e.target.value)} />
                        </div>
                    )}

                    {/* SECTION 2: NEXT OF KIN */}
                    <h3 className="text-md font-bold text-indigo-700 flex items-center gap-2 border-b border-gray-100 pb-2 pt-4"><FaUsers /> Next of Kin</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Input label="Next of Kin Name" value={nokName} onChange={(e) => setNokName(e.target.value)} />
                        <Input label="Relationship" value={nokRelationship} onChange={(e) => setNokRelationship(e.target.value)} placeholder="e.g. Brother, Wife" />
                        <Input label="Kin Phone No." value={nokPhone} onChange={(e) => setNokPhone(e.target.value)} icon={FaPhone} />
                    </div>

                    {/* SECTION 3: BUSINESS DETAILS */}
                    <h3 className="text-md font-bold text-indigo-700 flex items-center gap-2 border-b border-gray-100 pb-2 pt-4"><FaStore /> Business Details</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input label="Name of Business" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
                        <div className="flex flex-col space-y-1">
                            <label className="text-sm font-medium text-gray-700">Nature of Business</label>
                            <select value={businessNature} onChange={(e) => setBusinessNature(e.target.value)} className="p-2 border rounded-md bg-white text-black">
                                <option value="">Select...</option>
                                <option value="Retail shop">Retail shop</option>
                                <option value="fishing">Fishing</option>
                                <option value="farm produce">Farm Produce</option>
                                <option value="other">Other</option>
                            </select>
                        </div>
                        <Input label="Business Location" value={businessLocation} onChange={(e) => setBusinessLocation(e.target.value)} />
                        <Input label="Weekly Sales (SLE)" type="number" value={avgSales} onChange={(e) => setAvgSales(e.target.value)} icon={FaMoneyBillWave} />
                        <Input label="Weekly Expenses (SLE)" type="number" value={avgExpenses} onChange={(e) => setAvgExpenses(e.target.value)} />
                        <div className="flex flex-col space-y-1">
                            <label className="text-sm font-medium text-gray-700">Registered?</label>
                            <select value={isBusinessRegistered} onChange={(e) => setIsBusinessRegistered(e.target.value)} className="p-2 border rounded-md bg-white text-black">
                                <option value="no">No</option>
                                <option value="yes">Yes</option>
                            </select>
                        </div>
                        {isBusinessRegistered === 'yes' && (
                            <Input label="Reg. Date" type="date" value={businessRegDate} onChange={(e) => setBusinessRegDate(e.target.value)} />
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input label="Loan Purpose" value={loanPurpose} onChange={(e) => setLoanPurpose(e.target.value)} />
                        <div className="flex flex-col space-y-1">
                            <label className="text-sm font-medium text-gray-700">Source of Capital</label>
                            <select value={capitalSource} onChange={(e) => setCapitalSource(e.target.value)} className="p-2 border rounded-md bg-white text-black">
                                <option value="">Select...</option>
                                <option value="own savings">Own Savings</option>
                                <option value="MFI">MFI</option>
                                <option value="Family">Family</option>
                                <option value="Friends">Friends</option>
                                <option value="Bank">Bank</option>
                            </select>
                        </div>
                    </div>

                    {/* PHOTO SECTION */}
                    <div className="flex flex-col items-center p-4 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                        <input type="file" hidden ref={fileInputRef} onChange={handlePhotoImport} accept="image/*" />
                        <div className="relative w-32 h-32 rounded-full overflow-hidden bg-gray-200 border-4 border-white shadow-md">
                            {imagePreviewUrl ? (
                                <Image src={imagePreviewUrl} alt="Preview" fill className="object-cover" unoptimized />
                            ) : (
                                <FaUser size={48} className="m-auto mt-8 text-gray-400" />
                            )}
                            {imageUploading && (
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                    <FaSpinner className="animate-spin text-white text-2xl" />
                                </div>
                            )}
                        </div>
                        <Button onClick={() => fileInputRef.current.click()} className="mt-4 bg-gray-800" disabled={imageUploading}>
                            <FaUpload className="mr-2" /> {imageUploading ? 'Uploading...' : 'Upload Photo'}
                        </Button>
                    </div>

                    <div className="flex gap-4 pt-4">
                        <Button type="submit" className="flex-1 py-3 h-auto text-lg" disabled={isSaving || imageUploading}>
                            {isSaving ? <FaSpinner className="animate-spin mr-2" /> : <FaUpload className="mr-2" />}
                            {editingClientId ? 'Update Records' : 'Save Registration'}
                        </Button>
                        {editingClientId && (
                            <Button onClick={clearForm} className="bg-gray-200 !text-gray-700 hover:bg-gray-300">Cancel</Button>
                        )}
                    </div>
                </form>

                {/* LIST SECTION */}
                <div className="bg-white rounded-2xl shadow-lg border overflow-hidden flex flex-col h-[fit-content]">
                    <div className="bg-indigo-900 p-4 text-white sticky top-0 z-10">
                        <h3 className="font-bold flex items-center gap-2">
                            Recent Registrations <span className="bg-indigo-700 px-2 py-0.5 rounded text-xs">{filteredClients.length}</span>
                        </h3>
                    </div>
                    <div className="overflow-y-auto max-h-[800px]">
                        {loading ? <Spinner /> : filteredClients.map(client => (
                            <div key={client.id} className="p-4 border-b hover:bg-gray-50 flex items-center gap-4 transition-colors">
                                <div className="relative w-10 h-10 rounded-full overflow-hidden bg-gray-100 flex-shrink-0">
                                    {client.photoUrl ? (
                                        <Image src={client.photoUrl} alt="" fill className="object-cover" />
                                    ) : (
                                        <FaUser className="m-auto mt-2 text-gray-400" />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold truncate text-sm">{client.fullName}</p>
                                    <p className="text-[10px] text-gray-500">{client.clientId}</p>
                                </div>
                                <button onClick={() => handleEdit(client)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg">
                                    <FaPencilAlt size={14} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}