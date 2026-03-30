"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { db } from "@/app/lib/firebase";
import { collection, query, where, onSnapshot } from 'firebase/firestore';

export default function LoanPaymentReport() {
    const [branchId, setBranchId] = useState('');
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(true);

    // 1. Get Branch ID
    useEffect(() => {
        const keys = Object.keys(sessionStorage);
        keys.forEach((k) => {
            try {
                const parsed = JSON.parse(sessionStorage.getItem(k));
                if (parsed?.branchId) setBranchId(String(parsed.branchId));
            } catch { }
        });
    }, []);

    // 2. Real-time Subscription
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

    // HELPERS
    const getDayName = (dateStr) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-GB', { weekday: 'long' });
    };

    const formatDateFull = (dateStr) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-GB', { 
            day: 'numeric', 
            month: 'long', 
            year: 'numeric' 
        });
    };

    // 3. AGGREGATION & SORTING
    const dailyReport = useMemo(() => {
        const groups = payments.reduce((acc, pay) => {
            const dateStr = pay.date;
            if (!acc[dateStr]) {
                acc[dateStr] = {
                    date: dateStr,
                    cashSecurity: 0,
                    totalRepaid: 0,
                };
            }
            acc[dateStr].cashSecurity += parseFloat(pay.securityCollected || 0);
            acc[dateStr].totalRepaid += parseFloat(pay.repaymentAmount || 0);
            return acc;
        }, {});

        // Sort: Small to Big (Earliest to Latest)
        return Object.values(groups).sort((a, b) => new Date(a.date) - new Date(b.date));
    }, [payments]);

    if (loading) return <div className="p-10 text-center font-bold">Loading Reports...</div>;

    return (
        <div className="p-6 bg-slate-50 min-h-screen">
            <div className="max-w-5xl mx-auto">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <table className="w-full border-collapse text-sm">
                        <thead className="bg-slate-800 text-white">
                            <tr>
                                <th className="p-4 text-left font-bold uppercase tracking-wider">Day</th>
                                <th className="p-4 text-left font-bold uppercase tracking-wider">Date</th>
                                <th className="p-4 text-center font-bold uppercase tracking-wider">Security Saved</th>
                                <th className="p-4 text-center font-bold uppercase tracking-wider">Total Repaid</th>
                                <th className="p-4 text-right font-bold uppercase tracking-wider">Daily Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {dailyReport.map((row) => (
                                <tr key={row.date} className="hover:bg-blue-50 transition-colors">
                                    <td className="p-4 font-bold text-slate-600">
                                        {getDayName(row.date)}
                                    </td>
                                    <td className="p-4 font-medium text-slate-800">
                                        {formatDateFull(row.date)}
                                    </td>
                                    <td className="p-4 text-center font-bold text-orange-600">
                                        {row.cashSecurity.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="p-4 text-center font-bold text-green-700">
                                        {row.totalRepaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="p-4 text-right">
                                        <span className="font-black text-slate-900 bg-slate-100 px-3 py-1 rounded">
                                            SLE {(row.cashSecurity + row.totalRepaid).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        {/* Summary Footer */}
                        <tfoot className="bg-slate-50 border-t-2 border-slate-300">
                            <tr className="font-black text-slate-900">
                                <td colSpan="2" className="p-4 text-right uppercase">Branch Totals:</td>
                                <td className="p-4 text-center text-orange-700">
                                    {dailyReport.reduce((a, b) => a + b.cashSecurity, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </td>
                                <td className="p-4 text-center text-green-800">
                                    {dailyReport.reduce((a, b) => a + b.totalRepaid, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </td>
                                <td className="p-4 text-right text-lg text-indigo-900">
                                    SLE {dailyReport.reduce((a, b) => a + (b.cashSecurity + b.totalRepaid), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </div>
    );
}