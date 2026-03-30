"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { db } from "@/app/lib/firebase";
import { collection, query, where, onSnapshot } from 'firebase/firestore';

export default function GroupPortfolioSummary() {
    const [branchId, setBranchId] = useState('');
    const [loans, setLoans] = useState([]);
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
        const qLoans = query(collection(db, "loans"), where("branchId", "==", branchId));
        const qPay = query(collection(db, "ACODApayment"), where("branchId", "==", branchId));

        const unsubLoans = onSnapshot(qLoans, (snap) => {
            setLoans(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        const unsubPay = onSnapshot(qPay, (snap) => {
            setPayments(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setLoading(false);
        });

        return () => { unsubLoans(); unsubPay(); };
    }, [branchId]);

    const groupData = useMemo(() => {
        const summary = {};

        loans.forEach(loan => {
            const staff = loan.staffName || "Unassigned";
            const group = loan.groupName || "Individual";
            const key = `${staff}-${group}`;

            if (!summary[key]) {
                summary[key] = {
                    staffName: staff,
                    groupName: group,
                    clientCount: 0, // NEW: Counter for clients
                    initialCashSecurity: 0,
                    principal: 0,
                    interestValue: 0,
                    totalDebt: 0,
                    securitySaved: 0,
                    totalRepaid: 0
                };
            }

            const principal = parseFloat(loan.principal || 0);
            const rate = parseFloat(loan.interestRate || 0);
            const interest = principal * (rate / 100);

            summary[key].clientCount += 1; // Increment for each loan in the group
            summary[key].initialCashSecurity += parseFloat(loan.cashSecurity || 0);
            summary[key].principal += principal;
            summary[key].interestValue += interest;
            summary[key].totalDebt += (principal + interest);
        });

        payments.forEach(pay => {
            const staff = pay.staffName || "Unassigned";
            const group = pay.groupName || "Individual";
            const key = `${staff}-${group}`;
            if (summary[key]) {
                summary[key].securitySaved += parseFloat(pay.securityCollected || 0);
                summary[key].totalRepaid += parseFloat(pay.repaymentAmount || 0);
            }
        });

        return Object.values(summary).sort((a, b) => a.staffName.localeCompare(b.staffName));
    }, [loans, payments]);

    if (loading) return <div className="p-20 text-center font-bold text-slate-400 uppercase tracking-widest animate-pulse">Analyzing Portfolio...</div>;

    return (
        <div className="p-6 bg-slate-100 min-h-screen font-sans">
            <div className="max-w-6xl mx-auto">
                <div className="mb-8 flex justify-between items-end border-b-4 border-slate-900 pb-4">
                    <div>
                        <h1 className="text-4xl font-black text-slate-900 uppercase tracking-tighter italic">Group Financial Health</h1>
                        <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.2em]">Acoda Group Lending Audit — Branch {branchId}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] font-black text-slate-400 uppercase">Active Groups</p>
                        <p className="text-3xl font-black text-slate-900">{groupData.length}</p>
                    </div>
                </div>

                {groupData.map((data, index) => (
                    <div key={index} className="mb-10 bg-white shadow-2xl rounded-2xl overflow-hidden border border-slate-200">
                        
                        {/* Header with Client Count Badge */}
                        <div className="bg-slate-900 text-white p-6 flex justify-between items-center">
                            <div className="flex items-center gap-6">
                                <div className="bg-indigo-600 px-4 py-2 rounded-lg text-center shadow-inner">
                                    <p className="text-[9px] font-black uppercase text-indigo-200">Clients</p>
                                    <p className="text-2xl font-black leading-none">{data.clientCount}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] uppercase font-bold text-slate-400">Officer: {data.staffName}</p>
                                    <h2 className="text-2xl font-black uppercase tracking-tight text-white">{data.groupName}</h2>
                                </div>
                            </div>
                            <div className="hidden md:block text-right">
                                <span className="text-[10px] font-black bg-white/10 px-3 py-1 rounded-full uppercase tracking-widest border border-white/20">
                                    Portfolio Summary
                                </span>
                            </div>
                        </div>

                        {/* Financial Body */}
                        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-100">
                            
                            {/* Assets Section */}
                            <div className="p-6">
                                <h3 className="text-[10px] font-black text-indigo-500 uppercase mb-4 tracking-widest border-b pb-2">Cash & Security</h3>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500">Initial Deposit:</span>
                                        <span className="font-mono font-bold">{data.initialCashSecurity.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500">Weekly Savings:</span>
                                        <span className="font-mono font-bold text-blue-600">{data.securitySaved.toLocaleString()}</span>
                                    </div>
                                    <div className="pt-2 flex justify-between items-center">
                                        <span className="text-xs font-black text-slate-900 uppercase">Total Asset Value:</span>
                                        <span className="text-lg font-mono font-black text-indigo-700">
                                            {(data.initialCashSecurity + data.securitySaved).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Loan Section */}
                            <div className="p-6 bg-slate-50/50">
                                <h3 className="text-[10px] font-black text-slate-400 uppercase mb-4 tracking-widest border-b pb-2">Loan Engagement</h3>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500">Group Principal:</span>
                                        <span className="font-mono font-bold">{data.principal.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500">Accrued Interest:</span>
                                        <span className="font-mono font-bold text-slate-800">+{data.interestValue.toLocaleString()}</span>
                                    </div>
                                    <div className="pt-2 flex justify-between items-center">
                                        <span className="text-xs font-black text-slate-900 uppercase">Total Debt:</span>
                                        <span className="text-lg font-mono font-black text-slate-900">
                                            {data.totalDebt.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Status Section */}
                            <div className="p-6">
                                <h3 className="text-[10px] font-black text-green-600 uppercase mb-4 tracking-widest border-b pb-2">Performance</h3>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm font-bold">
                                        <span className="text-slate-500">Repaid to Date:</span>
                                        <span className="font-mono text-green-700">{data.totalRepaid.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between text-sm font-bold">
                                        <span className="text-slate-500">Remaining:</span>
                                        <span className="font-mono text-red-600 italic">{(data.totalDebt - data.totalRepaid).toLocaleString()}</span>
                                    </div>
                                    <div className="mt-4 bg-slate-900 rounded-lg p-3 flex justify-between items-center">
                                        <span className="text-[10px] font-black text-slate-400 uppercase">Recovery</span>
                                        <span className="text-xl font-black text-green-400">
                                            {data.totalDebt > 0 ? ((data.totalRepaid / data.totalDebt) * 100).toFixed(0) : 0}%
                                        </span>
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}