"use client";

import React, { useState, useEffect } from 'react';
import { FaEdit, FaTrash, FaPlus, FaSearch, FaHandHoldingUsd, FaUsers, FaUserTie, FaTimes, FaShieldAlt } from "react-icons/fa";
import { HiOutlineStatusOnline, HiOutlineStatusOffline } from 'react-icons/hi';
import { db } from '@/app/lib/firebase';
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

/** --- REUSABLE UI COMPONENTS --- **/
const Input = ({ id, label, type = 'text', value, onChange, placeholder, readOnly = false }) => (
    <div className="flex flex-col space-y-1">
        <label htmlFor={id} className="text-sm font-medium text-gray-700">{label}</label>
        <input
            id={id}
            type={type}
            value={value}
            onChange={onChange}
            readOnly={readOnly}
            placeholder={placeholder}
            className={`w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors duration-200 text-black bg-white ${readOnly ? 'bg-gray-100' : ''}`}
        />
    </div>
);

const Button = ({ onClick, children, className = "", disabled = false, type = "button" }) => (
    <button
        type={type}
        disabled={disabled}
        onClick={onClick}
        className={`inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 ${className}`}
    >
        {children}
    </button>
);

const Spinner = () => (
    <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" role="status">
            <span className="sr-only">Loading...</span>
        </div>
    </div>
);

export default function LoanPage() {
    // Session & Context States
    const [currentBranchId, setCurrentBranchId] = useState('');
    const [companyShortCode, setCompanyShortCode] = useState('');
    const [isOnline, setIsOnline] = useState(true);

    // Loan Form States
    const [loanId, setLoanId] = useState('');
    const [clientId, setClientId] = useState('');
    const [clientName, setClientName] = useState('');
    const [staffName, setStaffName] = useState('');
    const [loanOutcome, setLoanOutcome] = useState('');
    const [loanType, setLoanType] = useState('');
    const [cashSecurity, setCashSecurity] = useState('');
    const [principal, setPrincipal] = useState('');
    const [interestRate, setInterestRate] = useState('');
    const [paymentWeeks, setPaymentWeeks] = useState('');
    const [disbursementDate, setDisbursementDate] = useState(new Date().toISOString().slice(0, 10));
    const [repaymentStartDate, setRepaymentStartDate] = useState('');

    // --- NEW GUARANTOR STATES ---
    const [guarantorName, setGuarantorName] = useState('');
    const [guarantorIdCard, setGuarantorIdCard] = useState('');
    const [guarantorRelationship, setGuarantorRelationship] = useState('');
    const [guarantorTel, setGuarantorTel] = useState('');
    const [guarantorAmount, setGuarantorAmount] = useState('');

    // Fee States
    const [admissionFee, setAdmissionFee] = useState('');
    const [passbookFee, setPassbookFee] = useState('');
    const [loanProcessingFee, setLoanProcessingFee] = useState('');

    // Group Management States
    const [groupId, setGroupId] = useState('');
    const [groupName, setGroupName] = useState('');
    const [tempGroupId, setTempGroupId] = useState('');
    const [tempGroupName, setTempGroupName] = useState('');
    const [leaderName, setLeaderName] = useState('');
    const [leaderTel, setLeaderTel] = useState('');
    const [leaderAddress, setLeaderAddress] = useState('');
    const [secretaryName, setSecretaryName] = useState('');
    const [secretaryTel, setSecretaryTel] = useState('');

    // Data Lists
    const [loanList, setLoanList] = useState([]);
    const [groupList, setGroupList] = useState([]);

    // UI Logic States
    const [editingLoanId, setEditingLoanId] = useState(null);
    const [editingGroupId, setEditingGroupId] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [clientLoading, setClientLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const DELETE_PIN = "1234";
    const loansCollectionRef = collection(db, "loans");
    const groupsCollectionRef = collection(db, "groups");
    const clientsCollectionRef = collection(db, "clients");

    // 1. Online Status Hook
    useEffect(() => {
        const handleStatus = () => setIsOnline(navigator.onLine);
        window.addEventListener("online", handleStatus);
        window.addEventListener("offline", handleStatus);
        return () => {
            window.removeEventListener("online", handleStatus);
            window.removeEventListener("offline", handleStatus);
        };
    }, []);

    // 2. SESSION DATA
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const keys = Object.keys(sessionStorage);
            let foundData = null;
            keys.forEach(key => {
                const val = sessionStorage.getItem(key);
                if (val && val.includes("companyShortCode")) {
                    try { foundData = JSON.parse(val); } catch (e) { }
                }
            });
            if (foundData) {
                setCurrentBranchId(foundData.branchId || '');
                setCompanyShortCode(foundData.companyShortCode || '');
            }
        }
    }, []);

    // 3. Real-time Listeners
    useEffect(() => {
        if (!currentBranchId) return;
        setLoading(true);
        const qLoans = query(loansCollectionRef, where('branchId', '==', currentBranchId));
        const qGroups = query(groupsCollectionRef, where('branchId', '==', currentBranchId));

        const unsubLoans = onSnapshot(qLoans, (snapshot) => {
            setLoanList(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })));
            setLoading(false);
        });
        const unsubGroups = onSnapshot(qGroups, (snapshot) => {
            setGroupList(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })));
        });
        return () => { unsubLoans(); unsubGroups(); };
    }, [currentBranchId]);

    // 4. Auto-Calculate Repayment Date
    useEffect(() => {
        if (disbursementDate) {
            const date = new Date(disbursementDate);
            date.setDate(date.getDate() + 7);
            setRepaymentStartDate(date.toISOString().slice(0, 10));
        }
    }, [disbursementDate]);

    // 5. Sequential ID Generation
    useEffect(() => {
        if (!editingLoanId && !editingGroupId && companyShortCode) {
            const code = companyShortCode.toLowerCase();

            // Generate Loan ID
            const latestLoanNum = loanList.reduce((max, loan) => {
                const regex = new RegExp(`^${code}-LN-(\\d+)$`, 'i');
                const match = (loan.loanId || "").match(regex);
                const num = match ? parseInt(match[1], 10) : 0;
                return num > max ? num : max;
            }, 0);
            setLoanId(`${code.toUpperCase()}-LN-${String(latestLoanNum + 1).padStart(2, '0')}`);

            // Generate Group ID
            const latestGroupNum = groupList.reduce((max, group) => {
                const regex = new RegExp(`^${code}-GR-(\\d+)$`, 'i');
                const match = (group.groupId || "").match(regex);
                const num = match ? parseInt(match[1], 10) : 0;
                return num > max ? num : max;
            }, 0);
            setTempGroupId(`${code.toUpperCase()}-GR-${String(latestGroupNum + 1).padStart(2, '0')}`);
        }
    }, [loanList, groupList, editingLoanId, editingGroupId, companyShortCode]);

    // 6. Fetch Client Details
    useEffect(() => {
        if (clientId.length < 3 || !currentBranchId) return;
        setClientLoading(true);
        const q = query(clientsCollectionRef, where('clientId', '==', clientId), where('branchId', '==', currentBranchId));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            if (!snapshot.empty) {
                const data = snapshot.docs[0].data();
                setClientName(data.fullName);
                setStaffName(data.staffName);
            } else {
                setClientName(''); setStaffName('');
            }
            setClientLoading(false);
        });
        return () => unsubscribe();
    }, [clientId, currentBranchId]);

    // 7. Auto-populate by Loan Type
    useEffect(() => {
        if (editingLoanId) return;
        if (loanType === 'Small' || loanType === 'Medium') {
            setInterestRate('20');
            setPaymentWeeks('23');
        }
    }, [loanType, editingLoanId]);

    // --- HANDLERS ---

    const clearGroupForm = () => {
        setEditingGroupId(null);
        setTempGroupName(''); setLeaderName(''); setLeaderTel('');
        setLeaderAddress(''); setSecretaryName(''); setSecretaryTel('');
    };

    const handleAddOrUpdateGroup = async () => {
        if (!tempGroupName || !leaderName) return alert("Please enter Group Name and Leader details.");

        if (editingGroupId) {
            const originalGroup = groupList.find(g => g.id === editingGroupId);
            if (originalGroup && originalGroup.groupName !== tempGroupName) {
                const isAssigned = loanList.some(loan => loan.groupId === originalGroup.groupId);
                if (isAssigned) {
                    alert("ACCESS DENIED: Group name cannot be changed while it has active loans.");
                    return;
                }
            }
        }

        const groupData = {
            groupId: tempGroupId,
            groupName: tempGroupName,
            leaderName,
            leaderTel,
            leaderAddress,
            secretaryName,
            secretaryTel,
            branchId: currentBranchId,
            updatedAt: new Date().toISOString()
        };

        try {
            if (editingGroupId) {
                await updateDoc(doc(db, "groups", editingGroupId), groupData);
                alert("Group Updated Successfully!");
            } else {
                await addDoc(groupsCollectionRef, groupData);
                alert("New Group Registered!");
            }
            clearGroupForm();
        } catch (e) { alert("Error saving group."); }
    };

    const handleEditGroup = (group) => {
        setEditingGroupId(group.id);
        setTempGroupId(group.groupId);
        setTempGroupName(group.groupName);
        setLeaderName(group.leaderName || '');
        setLeaderTel(group.leaderTel || '');
        setLeaderAddress(group.leaderAddress || '');
        setSecretaryName(group.secretaryName || '');
        setSecretaryTel(group.secretaryTel || '');
    };

    const handleDeleteGroup = async (group) => {
        const isAssigned = loanList.some(loan => loan.groupId === group.groupId);
        if (isAssigned) {
            return alert("CANNOT DELETE: This group has active loans.");
        }

        if (confirm(`Delete ${group.groupName}?`)) {
            try {
                await deleteDoc(doc(db, "groups", group.id));
                alert("Group deleted.");
            } catch (e) { alert("Error deleting group."); }
        }
    };

    const handleSubmitLoan = async (e) => {
        e.preventDefault();
        if (isSubmitting) return;
        if (!clientName || !principal) return alert("Fill required fields.");

        setIsSubmitting(true);
        const loanData = {
            loanId, clientId, clientName, staffName, loanOutcome, loanType, cashSecurity,
            principal: parseFloat(principal), interestRate: parseFloat(interestRate),
            paymentWeeks: parseInt(paymentWeeks), disbursementDate, repaymentStartDate,
            admissionFee: parseFloat(admissionFee) || 0,
            passbookFee: parseFloat(passbookFee) || 0,
            loanProcessingFee: parseFloat(loanProcessingFee) || 0,
            // Guarantor Data
            guarantorName, guarantorIdCard, guarantorRelationship, guarantorTel,
            guarantorAmount: parseFloat(guarantorAmount) || 0,
            groupId, groupName, branchId: currentBranchId,
            updatedAt: new Date().toISOString()
        };

        try {
            if (editingLoanId) {
                await updateDoc(doc(db, "loans", editingLoanId), loanData);
                alert("Loan Updated!");
            } else {
                await addDoc(loansCollectionRef, loanData);
                alert("Loan Disbursed!");
            }
            clearLoanForm();
        } catch (e) { alert("Error saving loan."); }
        finally { setIsSubmitting(false); }
    };

    const clearLoanForm = () => {
        setClientId(''); setClientName(''); setStaffName(''); setLoanOutcome('');
        setLoanType(''); setPrincipal(''); setInterestRate(''); setPaymentWeeks('');
        setAdmissionFee(''); setPassbookFee(''); setLoanProcessingFee('');
        setGroupId(''); setGroupName(''); setEditingLoanId(null); setCashSecurity('');
        setDisbursementDate(new Date().toISOString().slice(0, 10));
        // Clear Guarantor States
        setGuarantorName(''); setGuarantorIdCard(''); setGuarantorRelationship('');
        setGuarantorTel(''); setGuarantorAmount('');
    };

    const handleEditLoan = (loan) => {
        setEditingLoanId(loan.id);
        setLoanId(loan.loanId);
        setClientId(loan.clientId);
        setClientName(loan.clientName);
        setStaffName(loan.staffName);
        setLoanOutcome(loan.loanOutcome);
        setLoanType(loan.loanType);
        setPrincipal(loan.principal);
        setInterestRate(loan.interestRate);
        setPaymentWeeks(loan.paymentWeeks);
        setAdmissionFee(loan.admissionFee || '');
        setPassbookFee(loan.passbookFee || '');
        setLoanProcessingFee(loan.loanProcessingFee || '');
        setGroupId(loan.groupId || '');
        setGroupName(loan.groupName || '');
        setCashSecurity(loan.cashSecurity || '');
        setDisbursementDate(loan.disbursementDate);
        // Set Guarantor States
        setGuarantorName(loan.guarantorName || '');
        setGuarantorIdCard(loan.guarantorIdCard || '');
        setGuarantorRelationship(loan.guarantorRelationship || '');
        setGuarantorTel(loan.guarantorTel || '');
        setGuarantorAmount(loan.guarantorAmount || '');
    };

    const handleDeleteLoan = async (id) => {
        const pin = prompt("Enter DELETE PIN:");
        if (pin !== DELETE_PIN) return alert("Wrong PIN.");
        if (confirm("Delete this loan permanently?")) {
            await deleteDoc(doc(db, "loans", id));
            alert("Deleted.");
        }
    };

    const filteredLoans = loanList.filter(l =>
        (l.clientName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (l.clientId || "").toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="container mx-auto p-4 md:p-8 bg-gray-50 min-h-screen text-gray-800">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-center mb-8 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <div>
                    <h1 className="text-2xl font-bold text-indigo-900 flex items-center gap-2">
                        <FaHandHoldingUsd className="text-indigo-600" />
                        {editingLoanId ? 'Update Loan Record' : 'Loan Disbursement Portal'}
                    </h1>
                    <p className="text-gray-500 text-sm font-semibold">Branch: {currentBranchId || '...'}</p>
                </div>
                <div className="flex items-center gap-3 mt-4 md:mt-0">
                    {isOnline ? <HiOutlineStatusOnline className="text-green-500 text-xl" /> : <HiOutlineStatusOffline className="text-red-500 text-xl" />}
                    <span className={`text-sm font-bold ${isOnline ? 'text-green-600' : 'text-red-600'}`}>
                        {isOnline ? 'System Online' : 'System Offline'}
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                    {/* Main Loan Form */}
                    <form onSubmit={handleSubmitLoan} className="bg-white p-6 rounded-xl shadow-md border border-gray-100 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Input label="Loan ID" value={loanId} readOnly />
                            <Input label="Client ID" value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="Search ID..." />
                            <div className="flex flex-col space-y-1">
                                <label className="text-sm font-medium text-gray-700">Client Name</label>
                                <div className="p-2 border rounded-md h-[42px] flex items-center bg-gray-50 font-semibold text-indigo-700">
                                    {clientLoading ? "Searching..." : clientName || "Client Not Found"}
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Input label="Assigned Staff" value={staffName} readOnly />
                            <div className="flex flex-col space-y-1">
                                <label className="text-sm font-medium text-gray-700">Loan Outcome</label>
                                <select value={loanOutcome} onChange={(e) => setLoanOutcome(e.target.value)} className="p-2 border rounded-md bg-white text-black">
                                    <option value="">Select Circle</option>
                                    <option value="1st Circle">1st Circle</option>
                                    <option value="2nd Circle">2nd Circle</option>
                                    <option value="3rd Circle">3rd Circle</option>
                                </select>
                            </div>
                            <div className="flex flex-col space-y-1">
                                <label className="text-sm font-medium text-gray-700">Loan Type</label>
                                <select value={loanType} onChange={(e) => setLoanType(e.target.value)} className="p-2 border rounded-md bg-white text-black">
                                    <option value="">Select Type</option>
                                    <option value="Small">Small (20%)</option>
                                    <option value="Medium">Medium (20%)</option>
                                    <option value="Others">Others</option>
                                </select>
                            </div>
                        </div>

                        <hr />

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <Input label="Principal (SLE)" type="number" value={principal} onChange={(e) => setPrincipal(e.target.value)} />
                            <Input label="Interest Rate (%)" type="number" value={interestRate} onChange={(e) => setInterestRate(e.target.value)} />
                            <Input label="Duration (Weeks)" type="number" value={paymentWeeks} onChange={(e) => setPaymentWeeks(e.target.value)} />
                            <Input label="Cash Security" value={cashSecurity} onChange={(e) => setCashSecurity(e.target.value)} />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input label="Disbursement Date" type="date" value={disbursementDate} onChange={(e) => setDisbursementDate(e.target.value)} />
                            <Input label="Repayment Start" type="date" value={repaymentStartDate} readOnly />
                        </div>

                        <div className="bg-indigo-50 p-4 rounded-lg grid grid-cols-1 md:grid-cols-3 gap-4 border border-indigo-100">
                            <Input label="Admission Fee" type="number" value={admissionFee} onChange={(e) => setAdmissionFee(e.target.value)} />
                            <Input label="Pass Book Fee" type="number" value={passbookFee} onChange={(e) => setPassbookFee(e.target.value)} />
                            <Input label="Loan Processing" type="number" value={loanProcessingFee} onChange={(e) => setLoanProcessingFee(e.target.value)} />
                        </div>

                        {/* --- GUARANTOR SECTION --- */}
                        <div className="p-4 border border-amber-200 bg-amber-50 rounded-lg">
                            <h3 className="text-sm font-bold text-amber-800 mb-3 flex items-center gap-2">
                                <FaShieldAlt /> Guarantor Information
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                <Input label="Guarantor Name" value={guarantorName} onChange={(e) => setGuarantorName(e.target.value)} />
                                <Input label="ID Card Number" value={guarantorIdCard} onChange={(e) => setGuarantorIdCard(e.target.value)} />
                               {/* Updated Relationship Select */}
        <div className="flex flex-col space-y-1">
            <label className="text-sm font-medium text-gray-700">Relationship</label>
            <select 
                value={guarantorRelationship} 
                onChange={(e) => setGuarantorRelationship(e.target.value)} 
                className="p-2 border rounded-md bg-white text-black h-[42px]"
            >
                <option value="">Select Relationship</option>
                <option value="Spouse">Spouse</option>
                <option value="Parent">Parent</option>
                <option value="Sibling">Sibling</option>
                <option value="Business Partner">Business Partner</option>
                <option value="Friend">Friend</option>
                <option value="Daughter">Daughter</option>
                <option value="Son">Son</option>
                <option value="Brother">Brother</option>
                <option value="Employer">Employer</option>
                <option value="Sister">Sister</option>
                <option value="Wife">Wife</option>
                <option value="Husband">Husband</option>
                <option value="Religious Leader">Religious Leader</option>
                <option value="Other">Other</option>
            </select>
        </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input label="Guarantor Tel" value={guarantorTel} onChange={(e) => setGuarantorTel(e.target.value)} />
                                <Input label="Guaranteed Amount (SLE)" type="number" value={guarantorAmount} onChange={(e) => setGuarantorAmount(e.target.value)} />
                            </div>
                        </div>

                        <div className="flex flex-col space-y-1">
                            <label className="text-sm font-medium text-gray-700">Assign to Group</label>
                            <select
                                value={groupId}
                                onChange={(e) => {
                                    const selected = groupList.find(g => g.groupId === e.target.value);
                                    setGroupId(e.target.value);
                                    setGroupName(selected ? selected.groupName : '');
                                }}
                                className="p-2 border rounded-md bg-white text-black"
                            >
                                <option value="">Individual (No Group)</option>
                                {groupList.map(g => <option key={g.id} value={g.groupId}>{g.groupName} ({g.groupId})</option>)}
                            </select>
                        </div>

                        <Button type="submit" className="w-full py-4 text-lg font-bold shadow-lg" disabled={isSubmitting}>
                            {isSubmitting ? <Spinner /> : editingLoanId ? 'Update Loan Record' : 'Confirm & Disburse Loan'}
                        </Button>
                        {editingLoanId && (
                            <button onClick={clearLoanForm} className="w-full text-gray-500 text-sm mt-2 hover:underline">Cancel Edit</button>
                        )}
                    </form>

                    {/* Group Registration Form */}
                    <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-indigo-900">
                            <FaUsers className="text-indigo-600" /> {editingGroupId ? 'Update Group' : 'Group Registration'}
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                            <Input label="Group ID" value={tempGroupId} readOnly />
                            <Input label="Group Name" value={tempGroupName} onChange={(e) => setTempGroupName(e.target.value)} placeholder="e.g. Unity Sisters" />
                            <Input label="Group Leader" value={leaderName} onChange={(e) => setLeaderName(e.target.value)} />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                            <Input label="Leader Tel" value={leaderTel} onChange={(e) => setLeaderTel(e.target.value)} />
                            <Input label="Leader Address" value={leaderAddress} onChange={(e) => setLeaderAddress(e.target.value)} />
                            <Input label="Secretary Name" value={secretaryName} onChange={(e) => setSecretaryName(e.target.value)} />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input label="Secretary Tel" value={secretaryTel} onChange={(e) => setSecretaryTel(e.target.value)} />
                            <div className="flex gap-2 items-end">
                                <Button onClick={handleAddOrUpdateGroup} className="flex-1 bg-green-600 hover:bg-green-700 h-[42px]">
                                    <FaPlus className="mr-2" /> {editingGroupId ? 'Update Group' : 'Save Group'}
                                </Button>
                                {editingGroupId && (
                                    <Button onClick={clearGroupForm} className="bg-gray-500 hover:bg-gray-600 h-[42px]">
                                        <FaTimes />
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Group Data Table */}
                    <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
                        <div className="p-4 bg-gray-800 text-white font-bold">Registered Groups List</div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
                                    <tr>
                                        <th className="p-4 border-b">Group Info</th>
                                        <th className="p-4 border-b">Leader Details</th>
                                        <th className="p-4 border-b">Secretary</th>
                                        <th className="p-4 border-b text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y text-sm">
                                    {groupList.map((g) => (
                                        <tr key={g.id} className="hover:bg-blue-50 transition-colors">
                                            <td className="p-4">
                                                <div className="font-bold text-indigo-900">{g.groupName}</div>
                                                <div className="text-[10px] font-mono text-gray-500">{g.groupId}</div>
                                            </td>
                                            <td className="p-4">
                                                <div className="font-semibold text-gray-800">{g.leaderName}</div>
                                                <div className="text-xs text-gray-500">{g.leaderTel}</div>
                                            </td>
                                            <td className="p-4 text-xs">
                                                <div>{g.secretaryName || "N/A"}</div>
                                                <div className="text-gray-500">{g.secretaryTel}</div>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex justify-center gap-2">
                                                    <button onClick={() => handleEditGroup(g)} className="p-2 text-blue-600 hover:bg-blue-100 rounded-md transition-colors"><FaEdit /></button>
                                                    <button onClick={() => handleDeleteGroup(g)} className="p-2 text-red-600 hover:bg-red-100 rounded-md transition-colors"><FaTrash /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Sidebar Search & List */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white p-4 rounded-xl shadow-md border border-gray-100">
                        <div className="relative">
                            <FaSearch className="absolute left-3 top-3 text-gray-400" />
                            <input
                                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 text-black bg-white"
                                placeholder="Search Client..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
                        <div className="p-4 bg-indigo-900 text-white font-bold flex justify-between items-center">
                            <span>Recent Disbursements</span>
                            <span className="bg-indigo-700 px-2 py-1 rounded text-xs">{filteredLoans.length}</span>
                        </div>
                        <div className="divide-y max-h-[650px] overflow-y-auto">
                            {loading ? <Spinner /> : filteredLoans.map((loan) => (
                                <div key={loan.id} className="p-4 hover:bg-gray-50 transition-colors flex justify-between items-center">
                                    <div className="min-w-0 flex-1">
                                        <p className="font-bold text-sm truncate uppercase text-indigo-900">{loan.clientName}</p>
                                        <p className="text-xs text-gray-500 font-mono">{loan.loanId}</p>
                                        <div className="flex gap-2 mt-1 items-center">
                                            <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">SLE {loan.principal}</span>
                                            {loan.groupName && <span className="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded border border-amber-200 font-medium">Group: {loan.groupName}</span>}
                                        </div>
                                    </div>
                                    <div className="flex gap-1">
                                        <button onClick={() => handleEditLoan(loan)} className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"><FaEdit /></button>
                                        <button onClick={() => handleDeleteLoan(loan.id)} className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"><FaTrash /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}