"use client";

import React, { useState, useEffect } from 'react';
import { db } from "@/app/lib/firebase";
import {
    collection,
    query,
    where,
    getDocs,
    deleteDoc,
    doc
} from 'firebase/firestore';

export default function PaymentReversal() {
    const [branchId, setBranchId] = useState('');
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
    const [payments, setPayments] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isDeleting, setIsDeleting] = useState(null); // Track specific ID being deleted
    const [searchTerm, setSearchTerm] = useState('');
    
    // Security Passcode State
    const [securityPasscode, setSecurityPasscode] = useState('');

    const filteredPayments = payments.filter((p) => {
        const search = searchTerm.toLowerCase();
        return (
            p.clientName?.toLowerCase().includes(search) ||
            p.groupName?.toLowerCase().includes(search)
        );
    });

    // 1. Load Branch ID from session
    useEffect(() => {
        const keys = Object.keys(sessionStorage);
        keys.forEach((k) => {
            try {
                const parsed = JSON.parse(sessionStorage.getItem(k));
                if (parsed?.branchId) setBranchId(String(parsed.branchId));
            } catch { }
        });
    }, []);

    // 2. Fetch payments based on Date and Branch
    const fetchPaymentsToReverse = async () => {
        if (!branchId) return alert("Branch ID not found. Please log in.");
        setIsLoading(true);
        try {
            const q = query(
                collection(db, "ACODApayment"),
                where("branchId", "==", branchId),
                where("date", "==", date)
            );
            const snap = await getDocs(q);
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setPayments(data);
            if (data.length === 0) alert("No payments found for this date.");
        } catch (e) {
            alert("Error fetching: " + e.message);
        } finally {
            setIsLoading(false);
        }
    };

    // 3. Handle Deletion
    const handleReverse = async (paymentId, clientName) => {
        // Double-check passcode match inside logic before executing network requests
        if (securityPasscode !== "8710") {
            return alert("Access Denied: Invalid security clearance password input code.");
        }

        if (!confirm(`Are you sure you want to REVERSE the payment for ${clientName}? This action cannot be undone.`)) return;

        setIsDeleting(paymentId);
        try {
            await deleteDoc(doc(db, "ACODApayment", paymentId));
            // Update local state to remove the item
            setPayments(prev => prev.filter(p => p.id !== paymentId));
            alert("Payment reversed successfully.");
        } catch (e) {
            alert("Error reversing: " + e.message);
        } finally {
            setIsDeleting(null);
        }
    };

    return (
        <div className="p-4 bg-red-50 min-h-screen text-xs text-black font-sans">
            <div className="max-w-[1100px] mx-auto bg-white p-6 rounded-lg shadow-lg border-t-4 border-red-600">
                <h1 className="text-xl font-black mb-4 text-red-700">SECURE PAYMENT REVERSAL TOOL</h1>
                <p className="mb-6 text-gray-600">Enter your administrative clearance credentials below to completely purge accidental sheet items.</p>

                {/* Filter Section */}
                <div className="flex flex-wrap gap-4 mb-6 items-end bg-gray-100 p-4 rounded border">
                    <div className="flex flex-col">
                        <label className="font-bold mb-1">Select Date</label>
                        <input 
                            type="date" 
                            className="border p-2 rounded text-sm w-44" 
                            value={date} 
                            onChange={e => setDate(e.target.value)} 
                        />
                    </div>
                    
                    <button 
                        onClick={fetchPaymentsToReverse} 
                        className="bg-gray-800 text-white px-5 py-2 rounded font-bold h-10 hover:bg-black transition"
                    >
                        {isLoading ? "Searching..." : "Search Payments"}
                    </button>

                    <div className="flex flex-col">
                        <label className="font-bold mb-1">Search Name / Group</label>
                        <input
                            type="text"
                            placeholder="Enter client or group..."
                            className="border p-2 rounded text-sm w-52"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    {/* GLOBAL SECURITY CONTROLLER INPUT */}
                    <div className="flex flex-col ml-auto">
                        <label className="font-bold mb-1 text-red-700 flex items-center gap-1">
                            ⚠️ Admin Delete Password
                        </label>
                        <input
                            type="password"
                            placeholder="Enter Passcode..."
                            maxLength={4}
                            className={`border-2 p-2 rounded text-sm w-40 text-center font-black tracking-widest ${
                                securityPasscode === "8710" 
                                    ? "border-green-500 bg-green-50 text-green-700" 
                                    : "border-red-300 bg-red-50"
                            }`}
                            value={securityPasscode}
                            onChange={(e) => setSecurityPasscode(e.target.value)}
                        />
                    </div>
                </div>

                {/* Results Table */}
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-gray-300">
                        <thead className="bg-red-700 text-white uppercase">
                            <tr>
                                <th className="border p-2 text-left">Client Name</th>
                                <th className="border p-2 text-center">Group</th>
                                <th className="border p-2 text-center">Amount (SLE)</th>
                                <th className="border p-2 text-center">Security (SLE)</th>
                                <th className="border p-2 text-center">Action Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredPayments.length === 0 && !isLoading && (
                                <tr>
                                    <td colSpan="5" className="text-center p-10 text-gray-400 italic">No payments loaded. Select a date and click search.</td>
                                </tr>
                            )}
                            {filteredPayments.map(p => {
                                const isUnlocked = securityPasscode === "8710";
                                return (
                                    <tr key={p.id} className="hover:bg-red-50 border-b">
                                        <td className="border p-3">
                                            <div className="font-bold">{p.clientName}</div>
                                            <div className="text-[10px] text-gray-500">Loan ID: {p.loanId}</div>
                                        </td>
                                        <td className="border p-3 text-center">{p.groupName}</td>
                                        <td className="border p-3 text-center font-bold text-green-700">{p.repaymentAmount}</td>
                                        <td className="border p-3 text-center font-bold text-orange-700">{p.securityCollected}</td>
                                        <td className="border p-3 text-center">
                                            <button 
                                                onClick={() => handleReverse(p.id, p.clientName)}
                                                disabled={isDeleting === p.id || !isUnlocked}
                                                className={`px-4 py-1 rounded font-bold transition text-[11px] ${
                                                    isUnlocked 
                                                        ? "bg-red-600 text-white hover:bg-red-800 cursor-pointer shadow" 
                                                        : "bg-gray-200 text-gray-400 cursor-not-allowed border"
                                                }`}
                                            >
                                                {isDeleting === p.id ? "Deleting..." : !isUnlocked ? "LOCKED 🔒" : "REVERSE"}
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}