"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { db } from "@/app/lib/firebase";
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { FaFileInvoiceDollar, FaChartLine, FaRegClock } from 'react-icons/fa';

export default function LoanSummaryReport() {
    const [branchId, setBranchId] = useState('');
    const [loans, setLoans] = useState([]);
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

    // 2. Real-time Listeners
    useEffect(() => {
        if (!branchId) return;

        const qLoans = query(collection(db, "loans"), where("branchId", "==", branchId));
        const qPay = query(collection(db, "ACODApayment"), where("branchId", "==", branchId));

        const unsubLoans = onSnapshot(qLoans, (snap) => {
            setLoans(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });

        const unsubPay = onSnapshot(qPay, (snap) => {
            setPayments(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            setLoading(false);
        });

        return () => { unsubLoans(); unsubPay(); };
    }, [branchId]);

    // 3. Calculation Engine
    const summary = useMemo(() => {
        const stats = {
            totalPrincipalDisbursed: 0,
            totalInterestExpected: 0,
            totalRepaymentsCollected: 0,
            totalSecurityHeld: 0,
            activeLoanCount: 0
        };

        loans.forEach(loan => {
            const p = parseFloat(loan.principal || 0);
            const r = parseFloat(loan.interestRate || 0) / 100;
            stats.totalPrincipalDisbursed += p;
            stats.totalInterestExpected += (p * r);
            stats.totalSecurityHeld += parseFloat(loan.cashSecurity || 0);
            stats.activeLoanCount++;
        });

        payments.forEach(pay => {
            stats.totalRepaymentsCollected += parseFloat(pay.repaymentAmount || 0);
            // Add security collected during weekly meetings if any
            stats.totalSecurityHeld += parseFloat(pay.securityCollected || 0);
            // Subtract security returned
            stats.totalSecurityHeld -= parseFloat(pay.securityReturned || 0);
        });

        const totalExpected = stats.totalPrincipalDisbursed + stats.totalInterestExpected;
        const remainingBalance = totalExpected - stats.totalRepaymentsCollected;

        return {
            ...stats,
            totalExpected,
            remainingBalance,
            collectionRate: totalExpected > 0 ? (stats.totalRepaymentsCollected / totalExpected) * 100 : 0
        };
    }, [loans, payments]);

    if (loading) return <div className="p-10 text-center font-bold animate-pulse">Loading Loan Summary...</div>;

    return (
        <div className="p-6 bg-slate-50 min-h-screen font-sans">
            <div className="max-w-6xl mx-auto">
                <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                    <FaFileInvoiceDollar className="text-indigo-600" /> Loan Portfolio Summary
                </h2>

                {/* Dashboard Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                    <Card title="Total Disbursed" value={summary.totalPrincipalDisbursed} color="blue" />
                    <Card title="Interest Expected" value={summary.totalInterestExpected} color="purple" />
                    <Card title="Total Collected" value={summary.totalRepaymentsCollected} color="green" />
                    <Card title="Outstanding Bal" value={summary.remainingBalance} color="rose" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Detailed Breakdown */}
                <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
    <div className="bg-slate-800 p-4 text-white font-bold flex justify-between">
        <span>Client Loan & Security Breakdown</span>
        <span>{summary.activeLoanCount} Active Loans</span>
    </div>
    <table className="w-full text-sm text-left">
        <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-widest border-b">
            <tr>
                <th className="p-4">Client / Loan ID</th>
                <th className="p-4">Principal</th>
                <th className="p-4">Paid (P+I)</th>
                <th className="p-4">Security Held</th>
                <th className="p-4 text-right">Loan Balance</th>
            </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
            {loans.map(loan => {
                // 1. Calculate Individual Repayments
                const individualPayments = payments.filter(p => p.loanId === loan.loanId || p.clientId === loan.clientId);
                
                const totalPaid = individualPayments.reduce((sum, p) => sum + parseFloat(p.repaymentAmount || 0), 0);
                
                // 2. Calculate Individual Security (Initial + Weekly - Returns)
                const weeklySecurity = individualPayments.reduce((sum, p) => sum + parseFloat(p.securityCollected || 0), 0);
                const securityReturned = individualPayments.reduce((sum, p) => sum + parseFloat(p.securityReturned || 0), 0);
                const initialSecurity = parseFloat(loan.cashSecurity || 0);
                
                const currentSecurityHeld = (initialSecurity + weeklySecurity) - securityReturned;

                // 3. Calculate Loan Balance
                const totalDue = parseFloat(loan.principal || 0) + (parseFloat(loan.principal || 0) * (parseFloat(loan.interestRate || 0) / 100));
                const loanBalance = totalDue - totalPaid;

                return (
                    <tr key={loan.id} className="hover:bg-indigo-50/50 transition-colors">
                        <td className="p-4">
                            <div className="font-bold text-slate-900">{loan.clientName}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{loan.loanId}</div>
                        </td>
                        <td className="p-4 font-medium text-slate-600">
                            {parseFloat(loan.principal).toLocaleString()}
                        </td>
                        <td className="p-4 text-green-700 font-bold">
                            {totalPaid.toLocaleString()}
                        </td>
                        <td className="p-4">
                            <div className="text-amber-700 font-bold">
                                {currentSecurityHeld.toLocaleString()}
                            </div>
                            {weeklySecurity > 0 && (
                                <div className="text-[9px] text-slate-400 italic">
                                    Incl. {weeklySecurity} weekly
                                </div>
                            )}
                        </td>
                        <td className="p-4 text-right font-black text-rose-600">
                            SLE {loanBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                    </tr>
                );
            })}
        </tbody>
    </table>
</div>

                    {/* Secondary Metrics */}
                    <div className="space-y-6">
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                            <h3 className="text-sm font-bold text-slate-500 uppercase mb-4 flex items-center gap-2">
                                <FaChartLine /> Collection Efficiency
                            </h3>
                            <div className="text-4xl font-black text-indigo-600">
                                {summary.collectionRate.toFixed(1)}%
                            </div>
                            <div className="w-full bg-slate-100 h-2 rounded-full mt-4 overflow-hidden">
                                <div 
                                    className="bg-indigo-600 h-full transition-all duration-1000" 
                                    style={{ width: `${summary.collectionRate}%` }}
                                />
                            </div>
                        </div>

                        <div className="bg-orange-50 p-6 rounded-xl border border-orange-200">
                            <h3 className="text-sm font-bold text-orange-800 uppercase mb-2 flex items-center gap-2">
                                <FaRegClock /> Total Cash Security
                            </h3>
                            <p className="text-xs text-orange-600 mb-3 italic">Total collateral currently held in branch vault</p>
                            <div className="text-3xl font-black text-orange-700">
                                SLE {summary.totalSecurityHeld.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function Card({ title, value, color }) {
    const colors = {
        blue: "text-blue-700 bg-blue-50 border-blue-100",
        purple: "text-purple-700 bg-purple-50 border-purple-100",
        green: "text-green-700 bg-green-50 border-green-100",
        rose: "text-rose-700 bg-rose-50 border-rose-100"
    };
    return (
        <div className={`p-5 rounded-xl border shadow-sm ${colors[color]}`}>
            <div className="text-[10px] uppercase font-bold opacity-70 mb-1">{title}</div>
            <div className="text-xl font-black">SLE {value.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
        </div>
    );
}