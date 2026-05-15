"use client";

import React, { useState, useEffect } from 'react';
import { db } from "@/app/lib/firebase";
import {
    collection,
    query,
    where,
    getDocs,
    deleteDoc, // Changed from updateDoc/addDoc to deleteDoc
    doc
} from 'firebase/firestore';

export default function PaymentReversal() {
    const [branchId, setBranchId] = useState('');
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
    const [payments, setPayments] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isDeleting, setIsDeleting] = useState(null); 
    const [searchTerm, setSearchTerm] = useState('');

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
            if (data.length === 0) alert("No active payments found for this date.");
        } catch (e) {
            alert("Error fetching: " + e.message);
        } finally {
            setIsLoading(false);
        }
    };

    // 3. Handle Hard Deletion Processing (No Backup History saved)
    const handleReverse = async (payment) => {
        if (!confirm(`CRITICAL WARNING:\nAre you sure you want to PERMANENTLY DELETE the payment for ${payment.clientName}?\n\nThis will completely erase it from the database with no backup history trail.`)) return;

        setIsDeleting(payment.id);

        try {
            // PERMANENT HARD DELETE: Deletes the record directly out of the ACODApayment collection
            await deleteDoc(doc(db, "ACODApayment", payment.id));

            // Remove item dynamically from active UI list array
            setPayments(prev => prev.filter(p => p.id !== payment.id));

            alert("Payment permanently deleted from the system. ✅");
        } catch (e) {
            alert("Error deleting payment: " + e.message);
        } finally {
            setIsDeleting(null);
        }
    };

    return (
        <div className="p-4 bg-red-50 min-h-screen text-xs text-black font-sans">
            <div className="max-w-[1000px] mx-auto bg-white p-6 rounded-lg shadow-lg border-t-4 border-red-600">
                <h1 className="text-xl font-black mb-4 text-red-700">PERMANENT PAYMENT DELETION TOOL</h1>
                <p className="mb-6 text-gray-600">Search for active payments by date to completely delete accidental entries from the database.</p>

                {/* Filter Section */}
                <div className="flex flex-wrap gap-4 mb-6 items-end bg-gray-100 p-4 rounded border">
                    <div className="flex flex-col">
                        <label className="font-bold mb-1">Select Date</label>
                        <input 
                            type="date" 
                            className="border p-2 rounded text-sm w-48" 
                            value={date} 
                            onChange={e => setDate(e.target.value)} 
                        />
                    </div>
                    
                    <button 
                        onClick={fetchPaymentsToReverse} 
                        className="bg-gray-800 text-white px-6 py-2 rounded font-bold h-10 hover:bg-black transition"
                    >
                        {isLoading ? "Searching..." : "Search Payments"}
                    </button>

                    <div className="flex flex-col">
                        <label className="font-bold mb-1">Search Name / Group</label>
                        <input
                            type="text"
                            placeholder="Enter client or group..."
                            className="border p-2 rounded text-sm w-64"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
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
                                <th className="border p-2 text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredPayments.length === 0 && !isLoading && (
                                <tr>
                                    <td colSpan="5" className="text-center p-10 text-gray-400 italic">No valid records matching active filter options.</td>
                                </tr>
                            )}
                            {filteredPayments.map(p => (
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
                                            onClick={() => handleReverse(p)}
                                            disabled={isDeleting === p.id}
                                            className="bg-red-600 text-white px-4 py-1 rounded font-bold hover:bg-red-800 disabled:bg-gray-400"
                                        >
                                            {isDeleting === p.id ? "Deleting..." : "DELETE PERMANENTLY"}
                                        </button>
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