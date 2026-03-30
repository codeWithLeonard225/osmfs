"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { db } from "@/app/lib/firebase";
import { collection, query, where, onSnapshot } from 'firebase/firestore';

export default function ProfessionalStaffLedger() {
    const [branchId, setBranchId] = useState('');
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const keys = Object.keys(sessionStorage);
        keys.forEach((k) => {
            try {
                const parsed = JSON.parse(sessionStorage.getItem(k));
                if (parsed?.branchId) setBranchId(String(parsed.branchId));
            } catch { }
        });
    }, []);

    useEffect(() => {
        if (!branchId) return;
        const payQuery = query(collection(db, "ACODApayment"), where("branchId", "==", branchId));
        const unsubscribe = onSnapshot(payQuery, (snapshot) => {
            const payData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setPayments(payData);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [branchId]);

    const getDayName = (dateStr) => new Date(dateStr).toLocaleDateString('en-GB', { weekday: 'long' });
    const formatDateFull = (dateStr) => new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

    const ledgerData = useMemo(() => {
        const tree = payments.reduce((acc, pay) => {
            const d = pay.date;
            const s = pay.staffName || "Unassigned";
            const g = pay.groupName || "Individual";

            if (!acc[d]) acc[d] = {};
            if (!acc[d][s]) acc[d][s] = {};
            if (!acc[d][s][g]) acc[d][s][g] = { security: 0, repaid: 0 };

            acc[d][s][g].security += parseFloat(pay.securityCollected || 0);
            acc[d][s][g].repaid += parseFloat(pay.repaymentAmount || 0);
            return acc;
        }, {});

        return Object.keys(tree).sort((a, b) => new Date(a) - new Date(b)).map(date => ({
            date,
            staffMembers: tree[date]
        }));
    }, [payments]);

    if (loading) return <div className="p-10 text-center font-bold text-slate-500 uppercase tracking-widest">Processing Ledger...</div>;

    return (
        <div className="p-6 bg-slate-100 min-h-screen font-sans text-slate-900">
            <div className="max-w-5xl mx-auto">
                
                <div className="mb-6 flex justify-between items-end border-b-4 border-slate-900 pb-2">
                    <div>
                        <h1 className="text-3xl font-black uppercase tracking-tighter text-slate-900">Daily Collection Ledger</h1>
                        <p className="text-xs font-bold text-slate-500 italic">Financial Management System — {branchId}</p>
                    </div>
                    <button onClick={() => window.print()} className="bg-slate-900 text-white px-4 py-2 text-xs font-black uppercase rounded hover:bg-slate-700">Print Report</button>
                </div>

                {ledgerData.map((day) => {
                    let daySecurityTotal = 0;
                    let dayRepaidTotal = 0;

                    return (
                        <div key={day.date} className="mb-10 bg-white shadow-xl rounded-lg overflow-hidden border border-slate-300 print:break-inside-avoid">
                            {/* DAY HEADER */}
                            <div className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center">
                                <span className="text-xl font-black uppercase tracking-widest">{getDayName(day.date)}, {formatDateFull(day.date)}</span>
                                <span className="text-xs bg-white/20 px-3 py-1 rounded-full uppercase">Verified Ledger</span>
                            </div>

                            {Object.entries(day.staffMembers).map(([staffName, groups]) => (
                                <div key={staffName} className="border-b-2 border-slate-100 last:border-b-0">
                                    <div className="bg-slate-50 px-6 py-2 border-b border-slate-200">
                                        <span className="text-[10px] font-black text-slate-400 uppercase">Officer In Charge:</span>
                                        <span className="ml-3 text-sm font-black text-indigo-900 uppercase">{staffName}</span>
                                    </div>

                                    <table className="w-full">
                                        <thead>
                                            <tr className="bg-white text-[10px] uppercase text-slate-400 font-black border-b">
                                                <th className="px-6 py-3 text-left w-1/3">Group Name</th>
                                                <th className="px-6 py-3 text-center">Security Saved</th>
                                                <th className="px-6 py-3 text-center">Total Repaid</th>
                                                <th className="px-6 py-3 text-right bg-slate-50">Total Saved</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {Object.entries(groups).map(([groupName, totals]) => {
                                                const groupTotal = totals.security + totals.repaid;
                                                daySecurityTotal += totals.security;
                                                dayRepaidTotal += totals.repaid;

                                                return (
                                                    <tr key={groupName} className="hover:bg-blue-50/30 transition-colors">
                                                        <td className="px-6 py-3 text-sm font-bold text-slate-800 uppercase">{groupName}</td>
                                                        <td className="px-6 py-3 text-center text-sm font-mono font-bold text-orange-600">
                                                            {totals.security.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                        </td>
                                                        <td className="px-6 py-3 text-center text-sm font-mono font-bold text-green-700">
                                                            {totals.repaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                        </td>
                                                        <td className="px-6 py-3 text-right text-sm font-mono font-black text-slate-900 bg-slate-50/50">
                                                            {groupTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            ))}

                            {/* DAILY FOOTER TOTAL */}
                            <div className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center">
                                <span className="text-xs font-black uppercase tracking-widest text-slate-400">Total for {formatDateFull(day.date)}:</span>
                                <div className="flex gap-8">
                                    <div className="text-center">
                                        <p className="text-[9px] uppercase text-slate-400">Sec. Total</p>
                                        <p className="font-mono font-bold text-orange-400">{daySecurityTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-[9px] uppercase text-slate-400">Repay. Total</p>
                                        <p className="font-mono font-bold text-green-400">{dayRepaidTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                                    </div>
                                    <div className="text-right border-l border-slate-700 pl-8">
                                        <p className="text-[9px] uppercase text-slate-400">Grand Collection</p>
                                        <p className="text-lg font-mono font-black text-white">SLE {(daySecurityTotal + dayRepaidTotal).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}