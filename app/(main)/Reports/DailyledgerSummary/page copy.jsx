"use client";

import React, { useState, useEffect } from "react";
import { db } from "@/app/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

export default function DailyLedgerSummary() {
    const [branchId, setBranchId] = useState("");
    const [ledger, setLedger] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const keys = Object.keys(sessionStorage);
        keys.forEach(k => {
            try {
                const parsed = JSON.parse(sessionStorage.getItem(k));
                if (parsed?.branchId) setBranchId(parsed.branchId);
            } catch { }
        });
    }, [branchId]);

  const generateLedger = async () => {
    if (!branchId) return;
    setLoading(true);

    const paymentQuery = query(collection(db, "ACODApayment"), where("branchId", "==", branchId));
    const loanQuery = query(collection(db, "loans"), where("branchId", "==", branchId));

    const [paySnap, loanSnap] = await Promise.all([getDocs(paymentQuery), getDocs(loanQuery)]);

    const payments = paySnap.docs.map(d => d.data());
    const loans = loanSnap.docs.map(d => d.data());

    const grouped = {};

    const ensureKey = (date) => {
        if (!grouped[date]) {
            grouped[date] = {
                date: date,
                cashSecurityDeposited: 0,
                cashSecurityReturns: 0,
                admissionFees: 0,
                passbookFees: 0,
                loanProcessingFee: 0,
                loanDisbursed: 0,
                loanToBePaid: 0,
                loanPaid: 0,
                fundsTransfer: 0,
                fundsReceived: 0,
                expenses: 0,
                prevCash: 0
            };
        }
    };

    // 1. PROCESS LOANS ONLY (Initial Disbursement & Initial Fees)
    loans.forEach(l => {
        const date = l.disbursementDate;
        if (!date) return;
        ensureKey(date);

        // Security is usually taken at disbursement
        grouped[date].cashSecurityDeposited += parseFloat(l.cashSecurity || 0);
        grouped[date].loanDisbursed += parseFloat(l.principal || 0);
        grouped[date].admissionFees += parseFloat(l.admissionFee || 0);
        grouped[date].passbookFees += parseFloat(l.passbookFee || 0);
        grouped[date].loanProcessingFee += parseFloat(l.loanProcessingFee || 0);

        const interest = parseFloat(l.principal || 0) * (parseFloat(l.interestRate || 0) / 100);
        grouped[date].loanToBePaid += (parseFloat(l.principal || 0) + interest);
    });

    // 2. PROCESS PAYMENTS ONLY (Ongoing repayments & security returns)
    payments.forEach(p => {
        if (!p.date) return;
        ensureKey(p.date);

        // Only add repayments and returns here. 
        // DO NOT add securityCollected here if you already took it from the 'loans' collection.
        grouped[p.date].loanPaid += parseFloat(p.amountPaid || 0);
        grouped[p.date].cashSecurityReturns += parseFloat(p.securityReturned || 0);
    });

    // 3. FINAL SORT AND BALANCE CALCULATION
    const sorted = Object.values(grouped).sort((a, b) => new Date(a.date) - new Date(b.date));

    let runningBalance = 0;
    const finalized = sorted.map(row => {
        const opening = runningBalance;
        // INFLOWS: Money coming into the branch
        const inflows = row.loanPaid + row.cashSecurityDeposited + row.admissionFees + row.passbookFees + row.loanProcessingFee + row.fundsReceived;
        // OUTFLOWS: Money leaving the branch
        const outflows = row.loanDisbursed + row.cashSecurityReturns + row.expenses + row.fundsTransfer;

        runningBalance = (opening + inflows) - outflows;
        return { ...row, prevCash: opening, grandTotal: runningBalance };
    });

    setLedger(finalized);
    setLoading(false);
};

    return (
        <div className="p-4 md:p-6 bg-gray-100 min-h-screen">
            <div className="max-w-full mx-auto bg-white p-6 rounded-xl shadow-lg">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl font-bold text-gray-800 tracking-tight">General Ledger Summary</h1>
                    <button
                        onClick={generateLedger}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-2.5 rounded-lg font-semibold transition-all shadow-md disabled:bg-gray-400"
                    >
                        {loading ? "Syncing Data..." : "Generate Ledger"}
                    </button>
                </div>

                <div className="overflow-x-auto rounded-lg border border-gray-200">
                    <table className="w-full text-[11px] whitespace-nowrap border-collapse">
                        <thead className="bg-slate-800 text-white uppercase text-[10px] tracking-widest">
                            <tr>
                                <th className="p-3 border-r border-slate-700">Day / Date</th>
                                <th className="p-3 border-r border-slate-700">Opening Balance</th>
                                <th className="p-3 border-r border-slate-700">Loan Activity</th>
                                <th className="p-3 border-r border-slate-700">Fees & Collateral</th>
                                <th className="p-3 border-r border-slate-700">Ops & Expenses</th>
                                <th className="p-3 text-right bg-indigo-900">Grand Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {ledger.map((row, i) => {
                                const dateObj = new Date(row.date);
                                const dayName = dateObj.toLocaleDateString("en-US", { weekday: 'long' });
                                // --- UPDATED DATE FORMAT ---
                                const formattedDate = dateObj.toLocaleDateString("en-US", {
                                    month: 'long',
                                    day: 'numeric',
                                    year: 'numeric'
                                });

                                return (
                                    <tr key={i} className="hover:bg-blue-50/50 transition-colors">
                                        <td className="p-3 border-r font-medium text-gray-700">
                                            <span className="block text-indigo-700 font-bold text-xs">{dayName}</span>
                                            {formattedDate}
                                        </td>
                                        <td className="p-3 border-r text-right font-mono bg-gray-50 text-gray-600">
                                            {row.prevCash.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </td>

                                        <td className="p-3 border-r bg-rose-50/30">
                                            <div className="flex justify-between mb-1">
                                                <span className="text-gray-500">Disbursed:</span>
                                                <b className="text-rose-700">{row.loanDisbursed.toLocaleString()}</b>
                                            </div>
                                            <div className="flex justify-between mb-1">
                                                <span className="text-gray-500">Expected (P+I):</span>
                                                <b className="text-gray-800">{row.loanToBePaid.toLocaleString()}</b>
                                            </div>
                                            <div className="flex justify-between font-bold text-green-700 border-t border-rose-100 pt-1">
                                                <span>Total Paid:</span>
                                                <span>{row.loanPaid.toLocaleString()}</span>
                                            </div>
                                        </td>

                                        <td className="p-3 border-r bg-sky-50/30">
                                            <div className="flex justify-between py-0.5"><span>Admission:</span><b>{row.admissionFees.toLocaleString()}</b></div>
                                            <div className="flex justify-between py-0.5"><span>Passbook:</span><b>{row.passbookFees.toLocaleString()}</b></div>
                                            <div className="flex justify-between py-0.5"><span>Processing:</span><b>{row.loanProcessingFee.toLocaleString()}</b></div>
                                            <div className="flex justify-between text-amber-700 border-t border-sky-100 mt-1 pt-1 italic font-semibold">
                                                <span>Cash Security:</span><b>{row.cashSecurityDeposited.toLocaleString()}</b>
                                            </div>
                                            <div className="flex justify-between text-orange-600 italic">
                                                <span>Security Ret:</span><b>{row.cashSecurityReturns.toLocaleString()}</b>
                                            </div>
                                        </td>

                                        <td className="p-3 border-r">
                                            <div className="flex justify-between py-0.5 text-blue-700 font-semibold"><span>Funds Rec:</span><b>{row.fundsReceived.toLocaleString()}</b></div>
                                            <div className="flex justify-between py-0.5 text-purple-700"><span>Transfer:</span><b>{row.fundsTransfer.toLocaleString()}</b></div>
                                            <div className="flex justify-between py-0.5 text-rose-600"><span>Expenses:</span><b>{row.expenses.toLocaleString()}</b></div>
                                        </td>

                                        <td className="p-3 text-right font-black text-indigo-900 bg-indigo-50 text-sm">
                                            {row.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    {ledger.length === 0 && !loading && (
                        <div className="p-12 text-center text-gray-400 italic">
                            No ledger records found for this branch.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}