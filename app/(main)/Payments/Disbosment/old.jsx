"use client";

import React, { useState, useEffect } from 'react';
import { FaEdit, FaTrash } from "react-icons/fa";
// Ensure this path matches your project structure (app/lib/firebase.js)
import { db } from "@/app/lib/firebase"; 
import {
    collection,
    query,
    where,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    serverTimestamp,
    onSnapshot
} from 'firebase/firestore';

/**
 * Reusable Components
 */
const Input = ({ id, label, type = 'text', value, onChange, placeholder, readOnly = false, disabled = false, className = "" }) => (
    <div className="flex flex-col space-y-1">
        <label htmlFor={id} className="text-sm font-medium text-gray-700">{label}</label>
        <input
            id={id}
            type={type}
            value={value}
            onChange={onChange}
            readOnly={readOnly}
            disabled={disabled}
            placeholder={placeholder}
            className={`w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent transition-colors duration-200 ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''} ${className}`}
        />
    </div>
);

const Button = ({ onClick, children, className = "", type = "button", disabled = false }) => (
    <button
        type={type}
        onClick={onClick}
        disabled={disabled}
        className={`inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 bg-green-600 text-white hover:bg-green-700 ${className} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
        {children}
    </button>
);

const Spinner = () => (
    <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600" role="status">
            <span className="sr-only">Loading...</span>
        </div>
    </div>
);

/**
 * Main Payments Component
 */
export default function Payments({ branch }) {
    const [branchId, setBranchId] = useState('');
    const [branchIdError, setBranchIdError] = useState(null);
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
    const [loanId, setLoanId] = useState('');
    const [clientId, setClientId] = useState('');
    const [fullName, setFullName] = useState('');
    const [staffName, setStaffName] = useState('');
    const [groupId, setGroupId] = useState('');
    const [groupName, setGroupName] = useState('');
    const [repaymentStartDate, setRepaymentStartDate] = useState('');
    const [loanOutcome, setLoanOutcome] = useState('');
    const [loanType, setLoanType] = useState('');
    const [actualAmount, setActualAmount] = useState('0');
    const [repaymentAmount, setRepaymentAmount] = useState('');
    const [principal, setPrincipal] = useState('');
    const [loanOutstanding, setLoanOutstanding] = useState('0');
    const [paymentWeeks, setPaymentWeeks] = useState('');
    const [interestRate, setInterestRate] = useState('');
    const [isOnline, setIsOnline] = useState(true);

    const [totalRepaymentSoFar, setTotalRepaymentSoFar] = useState('0.00');
    const [remainingBalanceCalc, setRemainingBalanceCalc] = useState('0.00');

    const [paymentsList, setPaymentsList] = useState([]);
    const [editingPaymentId, setEditingPaymentId] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [loadingPayments, setLoadingPayments] = useState(true);
    const [paymentsError, setPaymentsError] = useState('');

    const [isLoadingLoanDetails, setIsLoadingLoanDetails] = useState(false);
    const [loanDetailsError, setLoanDetailsError] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState('');
    const [saveSuccess, setSaveSuccess] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [loading, setLoading] = useState(true);

    const DELETE_PIN = "1234";
    const areLoanFieldsReadOnly = editingPaymentId !== null || !!loanId;

    // 1. Recover Branch ID (Next.js Compatible)
  useEffect(() => {
  if (typeof window === "undefined") return;

  setIsOnline(navigator.onLine);

  let foundBranchId = null;

  const keys = Object.keys(sessionStorage);
  keys.forEach((k) => {
    const val = sessionStorage.getItem(k);
    if (!val) return;

    try {
      const parsed = JSON.parse(val);
      if (parsed?.branchId) {
        foundBranchId = parsed.branchId;
      }
    } catch {}
  });

  if (foundBranchId) {
    setBranchId(foundBranchId);
  } else {
    setBranchIdError("Branch ID required. Please log in.");
  }

  setLoading(false);
}, []);


    // 2. Fetch Loan Details and History
    useEffect(() => {
        if (!loanId || !branchId || editingPaymentId) return;

        const fetchLoanData = async () => {
            setIsLoadingLoanDetails(true);
            try {
                const q = query(collection(db, "loans"), where("loanId", "==", loanId), where('branchId', '==', branchId));
                const snap = await getDocs(q);

                if (!snap.empty) {
                    const data = snap.docs[0].data();
                    setClientId(data.clientId || '');
                    setFullName(data.clientName || '');
                    setStaffName(data.staffName || '');
                    setGroupId(data.groupId || '');
                    setGroupName(data.groupName || '');
                    setRepaymentStartDate(data.repaymentStartDate || '');
                    setLoanOutcome(data.loanOutcome || '');
                    setLoanType(data.loanType || '');
                    setPrincipal(String(data.principal || ''));
                    setInterestRate(String(data.interestRate || ''));
                    setPaymentWeeks(String(data.paymentWeeks || ''));

                    // Logic: Total Debt = Principal + (Principal * Rate / 100)
                    const totalDebt = (data.principal || 0) * (1 + (data.interestRate || 0) / 100);
                    setLoanOutstanding(totalDebt.toFixed(2));
                    setActualAmount(data.paymentWeeks > 0 ? (totalDebt / data.paymentWeeks).toFixed(2) : '0');

                    // Fetch history for running totals
                    const pq = query(collection(db, "payments"), where("loanId", "==", loanId), where('branchId', '==', branchId));
                    const pSnap = await getDocs(pq);
                    const totalPaid = pSnap.docs.reduce((sum, d) => sum + (d.data().repaymentAmount || 0), 0);
                    
                    setTotalRepaymentSoFar(totalPaid.toFixed(2));
                    setRemainingBalanceCalc((totalDebt - totalPaid).toFixed(2));
                    setLoanDetailsError('');
                } else {
                    setLoanDetailsError("Loan ID not found.");
                }
            } catch (err) {
                setLoanDetailsError("Error loading loan info.");
            } finally {
                setIsLoadingLoanDetails(false);
            }
        };
        fetchLoanData();
    }, [loanId, branchId, editingPaymentId]);

    // 3. Real-time Payments List
    useEffect(() => {
        if (!branchId) return;
        const q = query(collection(db, 'payments'), where('branchId', '==', branchId));
        const unsub = onSnapshot(q, (snap) => {
            setPaymentsList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            setLoadingPayments(false);
        });
        return () => unsub();
    }, [branchId]);

    const clearForm = () => {
        setLoanId('');
        setClientId('');
        setFullName('');
        setRepaymentAmount('');
        setEditingPaymentId(null);
        setSaveSuccess('');
        setSaveError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!loanId || !repaymentAmount || isSubmitting) return;

        setIsSubmitting(true);
        setIsSaving(true);
        
        const payload = {
            branchId, date, loanId, clientId, fullName, staffName, groupId, groupName,
            repaymentStartDate, loanOutcome, loanType,
            actualAmount: parseFloat(actualAmount),
            repaymentAmount: parseFloat(repaymentAmount),
            principal: parseFloat(principal),
            interestRate: parseFloat(interestRate),
            loanOutstanding: parseFloat(loanOutstanding),
            paymentWeeks: parseInt(paymentWeeks),
            updatedAt: serverTimestamp(),
        };

        try {
            if (editingPaymentId) {
                await updateDoc(doc(db, "payments", editingPaymentId), payload);
                setSaveSuccess("Updated! ✅");
            } else {
                await addDoc(collection(db, "payments"), { ...payload, createdAt: serverTimestamp() });
                setSaveSuccess("Saved! ✨");
            }
            clearForm();
        } catch (err) {
            setSaveError("Save failed.");
        } finally {
            setIsSaving(false);
            setIsSubmitting(false);
        }
    };

    const handleEdit = (p) => {
        setEditingPaymentId(p.id);
        setDate(p.date);
        setLoanId(p.loanId);
        setClientId(p.clientId);
        setFullName(p.fullName);
        setRepaymentAmount(String(p.repaymentAmount));
        setActualAmount(String(p.actualAmount));
        setLoanOutstanding(String(p.loanOutstanding));
        // ... set other fields
    };

    const handleDelete = async (id) => {
        if (prompt("Enter PIN (1234)") !== DELETE_PIN) return;
        if (confirm("Delete this record?")) {
            await deleteDoc(doc(db, "payments", id));
        }
    };

    const filteredPayments = paymentsList.filter(p => 
        p.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
        p.loanId?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (branchIdError) return <div className="p-10 text-red-600 bg-red-50">{branchIdError}</div>;
    if (loading) return <Spinner />;

    return (
        <div className="container mx-auto p-4 md:p-8 bg-gray-50 min-h-screen text-black">
            <div className="bg-white rounded-xl shadow-sm border p-6 mb-8">
                <div className="flex justify-between items-center mb-6 border-b pb-4">
                    <h1 className="text-2xl font-bold text-gray-800">
                        {editingPaymentId ? 'Edit Payment' : 'New Collection Payment'}
                    </h1>
                    <span className={`text-sm font-bold ${isOnline ? "text-green-600" : "text-red-600"}`}>
                        {isOnline ? "● Online" : "○ Offline"}
                    </span>
                </div>

                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <Input id="branchId" label="Branch" value={branchId} readOnly disabled />
                    <Input id="date" label="Payment Date" type="date" value={date} onChange={e => setDate(e.target.value)} />
                    <Input id="loanId" label="Loan ID" value={loanId} onChange={e => setLoanId(e.target.value)} placeholder="Search Loan..." readOnly={!!editingPaymentId} />

                    {/* Status Feedback */}
                    <div className="col-span-full">
                        {isLoadingLoanDetails && <p className="text-blue-500 text-xs animate-pulse">Loading Loan Data...</p>}
                        {loanDetailsError && <p className="text-red-500 text-xs">{loanDetailsError}</p>}
                        {saveSuccess && <p className="text-green-600 font-bold">{saveSuccess}</p>}
                    </div>

                    <Input id="repaid" label="Total Repaid So Far" value={`SLE ${totalRepaymentSoFar}`} className="bg-blue-50 text-blue-700 font-bold" disabled />
                    <Input id="bal" label="Current Balance" value={`SLE ${remainingBalanceCalc}`} className="bg-orange-50 text-orange-700 font-bold" disabled />
                    <Input id="target" label="Scheduled Weekly" value={actualAmount} disabled className="bg-gray-100" />

                    <div className="col-span-full border-t pt-4 mt-2 grid grid-cols-1 md:grid-cols-3 gap-5">
                        <Input id="client" label="Client Name" value={fullName} disabled />
                        <Input id="repaymentAmount" label="Repayment Amount (Current)" type="number" value={repaymentAmount} onChange={e => setRepaymentAmount(e.target.value)} placeholder="0.00" className="border-indigo-300 ring-1 ring-indigo-100" />
                        
                        <div className="flex items-end">
                            <Button type="submit" className="w-full h-[42px]" disabled={isSaving || !isOnline}>
                                {isSaving ? "Processing..." : editingPaymentId ? "Update Record" : "Post Payment"}
                            </Button>
                        </div>
                    </div>
                </form>
            </div>

            {/* Table Section */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
                <div className="flex flex-col md:flex-row justify-between mb-4 gap-4">
                    <h2 className="text-lg font-bold">Recent Payments</h2>
                    <input 
                        type="text" 
                        placeholder="Search records..." 
                        className="p-2 border rounded-md text-sm w-full md:w-64"
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-600">
                            <tr>
                                <th className="p-3 border-b">Date</th>
                                <th className="p-3 border-b">Client</th>
                                <th className="p-3 border-b">Loan ID</th>
                                <th className="p-3 border-b">Amount</th>
                                <th className="p-3 border-b">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredPayments.map(p => (
                                <tr key={p.id} className="hover:bg-gray-50">
                                    <td className="p-3 border-b">{p.date}</td>
                                    <td className="p-3 border-b font-medium">{p.fullName}</td>
                                    <td className="p-3 border-b">{p.loanId}</td>
                                    <td className="p-3 border-b font-bold text-green-700">SLE {p.repaymentAmount?.toLocaleString()}</td>
                                    <td className="p-3 border-b flex gap-3">
                                        <button onClick={() => handleEdit(p)} className="text-blue-600 hover:text-blue-800"><FaEdit /></button>
                                        <button onClick={() => handleDelete(p.id)} className="text-red-600 hover:text-red-800"><FaTrash /></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}