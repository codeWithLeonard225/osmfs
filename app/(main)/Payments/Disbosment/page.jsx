"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { db } from "@/app/lib/firebase";
import {
    collection,
    query,
    where,
    getDocs,
    addDoc,
    serverTimestamp,
    onSnapshot
} from 'firebase/firestore';

export default function BulkPayments() {
    const [branchId, setBranchId] = useState('');
    const [staffList, setStaffList] = useState([]);
    const [groupList, setGroupList] = useState([]);
    const [selectedStaff, setSelectedStaff] = useState('');
    const [selectedGroup, setSelectedGroup] = useState('');
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

    const [rawLoans, setRawLoans] = useState([]); // Store the base loan docs
    const [clients, setClients] = useState([]);   // Store the calculated display data
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [payments, setPayments] = useState([]);

    // 1. Listen to ALL branch payments for real-time calculation
    useEffect(() => {
        if (!branchId) return;
        const payQuery = query(collection(db, "ACODApayment"), where("branchId", "==", branchId));
        const unsubscribe = onSnapshot(payQuery, (snapshot) => {
            const payData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setPayments(payData);
        });
        return () => unsubscribe();
    }, [branchId]);

    // 2. Load Branch ID from session
    useEffect(() => {
        const keys = Object.keys(sessionStorage);
        keys.forEach((k) => {
            try {
                const parsed = JSON.parse(sessionStorage.getItem(k));
                if (parsed?.branchId) setBranchId(String(parsed.branchId));
            } catch { }
        });
    }, []);

    // 3. Fetch Staff Names
    useEffect(() => {
        if (!branchId) return;
        const fetchStaff = async () => {
            const q = query(collection(db, "loans"), where("branchId", "==", branchId));
            const snap = await getDocs(q);
            const uniqueStaff = [...new Set(snap.docs.map(doc => doc.data().staffName))].filter(Boolean);
            setStaffList(uniqueStaff);
        };
        fetchStaff();
    }, [branchId]);

    // 4. Fetch Groups based on Staff
    useEffect(() => {
        if (!selectedStaff || !branchId) return;
        const fetchGroups = async () => {
            const q = query(collection(db, "loans"), where("branchId", "==", branchId), where("staffName", "==", selectedStaff));
            const snap = await getDocs(q);
            const uniqueGroups = [...new Set(snap.docs.map(doc => doc.data().groupName))].filter(Boolean);
            setGroupList(uniqueGroups);
        };
        fetchGroups();
    }, [selectedStaff, branchId]);

    // 5. THE TRIGGER: Fetch base loans (only happens when clicking "Generate")
    const fetchCollectionSheet = async () => {
        if (!selectedStaff || !selectedGroup) return;
        setIsLoading(true);
        const qLoans = query(
            collection(db, "loans"),
            where("branchId", "==", branchId),
            where("staffName", "==", selectedStaff),
            where("groupName", "==", selectedGroup)
        );
        const snap = await getDocs(qLoans);
        setRawLoans(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setIsLoading(false);
    };

    // 6. THE ENGINE: Re-calculate clients whenever payments OR rawLoans change
    useEffect(() => {
        const updated = rawLoans.map((loanData) => {
            const loanId = loanData.loanId;
            const principal = parseFloat(loanData.principal || 0);
            const iRate = parseFloat(loanData.interestRate || 0);
            const totalWeeks = parseInt(loanData.paymentWeeks || 1);
            const totalDebt = principal * (1 + (iRate / 100));
            const weekly = totalDebt / totalWeeks;

            const loanPayments = payments.filter(p => p.loanId === loanId);
            const alreadyPaidOnThisDate = loanPayments.some(p => p.date === date);

            let totalPaid = 0;
            let totalSavedSecurity = 0;
            loanPayments.forEach((pay) => {
                totalPaid += parseFloat(pay.repaymentAmount || 0);
                totalSavedSecurity += parseFloat(pay.securityCollected || 0);
            });

            const currentBalance = totalDebt - totalPaid;

            return {
                ...loanData,
                fullName: loanData.clientName || '',
                fullOutstanding: totalDebt.toFixed(2),
                totalPay: totalPaid.toFixed(2),
                balance: currentBalance.toFixed(2),
                actualAmount: weekly.toFixed(2),
                currentPayment: weekly.toFixed(2),
                securityToSave: "0",
                remWeeks: Math.max(0, totalWeeks - (totalPaid / weekly)).toFixed(1),
                cashSecurityFromLoan: parseFloat(loanData.cashSecurity || 0),
                prevCashSaved: totalSavedSecurity,
                paidToday: alreadyPaidOnThisDate
            };
        });
        setClients(updated);
    }, [payments, rawLoans, date]); // Auto-updates when payments arrive or date changes

    const saveAll = async () => {
        if (!confirm("Save all payments to ACODA records?")) return;
        setIsSaving(true);
        try {
            const promises = clients
                .filter(c => !c.paidToday) // Don't even try to save if already paid
                .map(async (c) => {
                    const securityVal = parseFloat(c.securityToSave || 0);
                    const paymentVal = parseFloat(c.currentPayment || 0);
                    if (securityVal === 0 && paymentVal === 0) return;

                    await addDoc(collection(db, "ACODApayment"), {
                        loanId: c.loanId,
                        clientId: c.clientId,
                        clientName: c.fullName,
                        branchId: c.branchId,
                        groupName: c.groupName,
                        staffName: c.staffName,
                        repaymentAmount: paymentVal,
                        securityCollected: securityVal,
                        date,
                        createdAt: serverTimestamp(),
                    });
                });

            await Promise.all(promises);
            alert("Success! Payments posted. ✅");
        } catch (e) {
            alert("Error saving: " + e.message);
        } finally { setIsSaving(false); }
    };

    const totalCollection = clients.reduce((acc, curr) => acc + (curr.paidToday ? 0 : parseFloat(curr.currentPayment || 0)), 0);
    const totalNewSecurity = clients.reduce((acc, curr) => acc + (curr.paidToday ? 0 : parseFloat(curr.securityToSave || 0)), 0);

    return (
        <div className="p-4 bg-gray-100 min-h-screen text-xs text-black font-sans">
            <div className="max-w-[1400px] mx-auto bg-white p-6 rounded shadow">
                {/* Filter Section */}
                <div className="flex flex-wrap gap-4 mb-6 items-end bg-gray-50 p-4 rounded border">
                    <div className="flex flex-col">
                        <label className="font-bold mb-1">Staff</label>
                        <select className="border p-2 rounded w-48 text-sm" value={selectedStaff} onChange={e => setSelectedStaff(e.target.value)}>
                            <option value="">Select Staff</option>
                            {staffList.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                    <div className="flex flex-col">
                        <label className="font-bold mb-1">Group</label>
                        <select className="border p-2 rounded w-48 text-sm" value={selectedGroup} onChange={e => setSelectedGroup(e.target.value)}>
                            <option value="">Select Group</option>
                            {groupList.map(g => <option key={g} value={g}>{g}</option>)}
                        </select>
                    </div>
                    <div className="flex flex-col">
                        <label className="font-bold mb-1">Date</label>
                        <input type="date" className="border p-2 rounded text-sm" value={date} onChange={e => setDate(e.target.value)} />
                    </div>
                    <button onClick={fetchCollectionSheet} className="bg-blue-600 text-white px-6 py-2 rounded font-bold h-10">
                        {isLoading ? "Loading..." : "Generate Sheet"}
                    </button>
                </div>

                {/* Table Section */}
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-gray-300">
                        <thead className="bg-gray-800 text-white uppercase">
                            <tr>
                                <th className="border p-2 text-left">Client Details</th>
                                <th className="border p-2 text-center">Loan Info</th>
                                <th className="border p-2 text-center">Status</th>
                                <th className="border p-2 text-center bg-gray-700">Security (SLE)</th>
                                <th className="border p-2 bg-blue-900">Financial History</th>
                                <th className="border p-2 bg-indigo-900">Weeks</th>
                                <th className="border p-2 bg-orange-600 w-28">Save Security</th>
                                <th className="border p-2 bg-green-700 w-32">Collect (SLE)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {clients.map(c => {
                                const currentTotalSecurity = c.cashSecurityFromLoan + c.prevCashSaved;
                                return (
                                    <tr key={c.id} className="hover:bg-gray-50 text-[11px] border-b">
                                        <td className="border p-2">
                                            <div className="font-bold text-blue-700 text-sm">{c.fullName}</div>
                                            <div className="text-gray-500">ID: {c.clientId}</div>
                                        </td>
                                        <td className="border p-2 text-center">
                                            <div className="font-semibold">{c.loanType}</div>
                                            <div className="text-gray-400">#{c.loanId}</div>
                                        </td>
                                        <td className="border p-2 text-center">
                                            <div className={`font-bold ${c.loanOutcome === 'Disbursed' ? 'text-green-600' : 'text-orange-600'}`}>
                                                {c.loanOutcome}
                                            </div>
                                            <div className="bg-blue-100 text-blue-800 px-1 rounded inline-block font-bold mt-1">
                                                Rate: {c.interestRate}%
                                            </div>
                                        </td>
                                      {/* SECURITY COLUMN - FIXED AS REQUESTED */}
                                        <td className="border p-2 text-center bg-gray-50">
                                            <div className="text-gray-500 text-[10px]">cashSecurity: {c.cashSecurityFromLoan.toFixed(2)}</div>
                                            <div className="text-gray-500 text-[10px]">cash saved: {c.prevCashSaved.toFixed(2)}</div>

                                            <div className="text-[14px] font-black text-gray-900 mt-1 pt-1 border-t border-gray-300">
                                                Total: {currentTotalSecurity.toFixed(2)}
                                            </div>
                                        </td>
                                       <td className="border p-2 bg-blue-50">
                                            <div className="flex justify-between"><span>Principal:</span><b>{c.principal}</b></div>
                                            <div className="flex justify-between text-blue-800"><span>Full Debt:</span><b>{c.fullOutstanding}</b></div>
                                            <div className="flex justify-between text-green-700"><span>Total Paid:</span><b>{c.totalPay}</b></div>
                                            <div className="flex justify-between text-red-700 font-bold border-t mt-1 pt-1"><span>Balance:</span><b>{c.balance}</b></div>
                                        </td>
                                        <td className="border p-2 bg-indigo-50 text-center">
                                            <div className="text-gray-500">Duration: {c.paymentWeeks} wks</div>
                                            <div className="text-indigo-700 font-black text-sm">Remaining: {c.remWeeks}</div>
                                        </td>
                                        <td className="border p-2 bg-orange-50">
                                            <input
                                                type="number"
                                                disabled={c.paidToday}
                                                className={`w-full p-2 border rounded font-black text-center ${c.paidToday ? "bg-gray-200" : "border-orange-300"}`}
                                                value={c.paidToday ? "0" : c.securityToSave}
                                                onChange={e => setClients(prev => prev.map(item => item.id === c.id ? { ...item, securityToSave: e.target.value } : item))}
                                            />
                                        </td>
                                        <td className="border p-2 bg-green-50">
                                            {c.paidToday ? (
                                                <div className="text-center py-2 bg-green-100 text-green-700 font-bold rounded">✅ PAID</div>
                                            ) : (
                                                <input
                                                    type="number"
                                                    className="w-full p-2 border-2 border-green-300 rounded font-bold text-center"
                                                    value={c.currentPayment}
                                                    onChange={e => setClients(prev => prev.map(item => item.id === c.id ? { ...item, currentPayment: e.target.value } : item))}
                                                />
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Footer Action */}
                {clients.length > 0 && (
                    <div className="mt-6 flex flex-col md:flex-row justify-between items-center bg-gray-900 p-6 rounded text-white">
                        <div>
                            <h2 className="text-2xl font-bold text-green-400">Total: SLE {(totalCollection + totalNewSecurity).toLocaleString()}</h2>
                        </div>
                        <button
                            onClick={saveAll}
                            disabled={isSaving}
                            className="bg-green-500 hover:bg-green-600 text-black px-12 py-4 rounded-lg font-black text-xl disabled:bg-gray-500"
                        >
                            {isSaving ? "POSTING..." : "CONFIRM & POST ALL"}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}