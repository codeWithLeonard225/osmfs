"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { db } from "@/app/lib/firebase";
import { collection, query, where, onSnapshot } from 'firebase/firestore';

export default function MasterTransactionLedger() {
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

    // THE MASTER ENGINE: Date -> Staff -> Group -> [Individual Clients]
    const masterData = useMemo(() => {
        const tree = payments.reduce((acc, pay) => {
            const d = pay.date;
            const s = pay.staffName || "Unassigned";
            const g = pay.groupName || "Individual";
            const c = pay.clientName || "Unknown Client";

            if (!acc[d]) acc[d] = {};
            if (!acc[d][s]) acc[d][s] = {};
            if (!acc[d][s][g]) acc[d][s][g] = [];

            acc[d][s][g].push({
                name: c,
                clientId: pay.clientId,
                security: parseFloat(pay.securityCollected || 0),
                repaid: parseFloat(pay.repaymentAmount || 0)
            });
            return acc;
        }, {});

        return Object.keys(tree).sort((a, b) => new Date(a) - new Date(b)).map(date => ({
            date,
            staffMembers: tree[date]
        }));
    }, [payments]);

    if (loading) return <div className="p-10 text-center font-black text-slate-400 animate-pulse">GENERATING MASTER LEDGER...</div>;

    return (
        <div className="p-4 bg-slate-200 min-h-screen font-sans text-slate-900">
            <div className="max-w-[1200px] mx-auto">
                
                {/* Header Section */}
                <div className="bg-white p-6 mb-4 rounded shadow-sm border-l-8 border-slate-900 flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-black uppercase tracking-tight">Master Transaction Ledger</h1>
                        <p className="text-xs font-bold text-slate-500">Individual Client Tracking — Branch: {branchId}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Report Status</p>
                        <p className="text-xs font-black text-green-600 uppercase">Live Database Sync</p>
                    </div>
                </div>

                {masterData.map((day) => {
                    let dayGrandTotal = 0;

                    return (
                        <div key={day.date} className="mb-8 overflow-hidden shadow-lg border border-slate-300 print:break-inside-avoid">
                            
                            {/* 1. DATE SECTION */}
                            <div className="bg-slate-900 text-white px-4 py-2 flex justify-between items-center">
                                <h2 className="text-lg font-black uppercase tracking-widest">
                                    {getDayName(day.date)}, {formatDateFull(day.date)}
                                </h2>
                            </div>

                            {Object.entries(day.staffMembers).map(([staffName, groups]) => (
                                <div key={staffName} className="bg-white">
                                    
                                    {/* 2. STAFF NAME HEADER */}
                                    <div className="bg-indigo-900 text-indigo-100 px-4 py-1 text-[11px] font-black uppercase tracking-widest">
                                        Field Officer: {staffName}
                                    </div>

                                    {Object.entries(groups).map(([groupName, clients]) => (
                                        <div key={groupName} className="border-b last:border-b-0">
                                            
                                            {/* 3. GROUP NAME HEADER */}
                                            <div className="bg-slate-100 px-4 py-1 border-b border-slate-200">
                                                <span className="text-[10px] font-bold text-slate-500 uppercase mr-2">Group:</span>
                                                <span className="text-xs font-black text-slate-800 uppercase italic">{groupName}</span>
                                            </div>

                                            {/* 4. INDIVIDUAL CLIENT TABLE */}
                                            <table className="w-full text-xs">
                                                <thead>
                                                    <tr className="text-[9px] uppercase text-slate-400 border-b">
                                                        <th className="px-8 py-2 text-left w-1/3">Client Name</th>
                                                        <th className="px-4 py-2 text-center">Security Saved</th>
                                                        <th className="px-4 py-2 text-center">Total Repaid</th>
                                                        <th className="px-8 py-2 text-right bg-slate-50 font-black text-slate-600">Total Saved</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {clients.map((client, idx) => {
                                                        const totalSaved = client.security + client.repaid;
                                                        dayGrandTotal += totalSaved;
                                                        return (
                                                            <tr key={idx} className="border-b border-slate-50 hover:bg-yellow-50/50 transition-colors">
                                                                <td className="px-8 py-2 font-bold text-slate-700 uppercase">
                                                                    {client.name} <span className="text-[9px] text-slate-400 ml-2">({client.clientId})</span>
                                                                </td>
                                                                <td className="px-4 py-2 text-center font-mono font-bold text-orange-600">
                                                                    {client.security.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                                </td>
                                                                <td className="px-4 py-2 text-center font-mono font-bold text-green-700">
                                                                    {client.repaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                                </td>
                                                                <td className="px-8 py-2 text-right font-mono font-black text-slate-900 bg-slate-50/50">
                                                                    {totalSaved.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    ))}
                                </div>
                            ))}

                            {/* 5. DAILY SUMMARY FOOTER */}
                            <div className="bg-white p-4 border-t-2 border-slate-900 flex justify-end items-center gap-4">
                                <span className="text-xs font-black uppercase text-slate-500">Daily Total Collection:</span>
                                <span className="text-xl font-mono font-black text-slate-900 px-4 py-1 bg-yellow-400 rounded">
                                    SLE {dayGrandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}