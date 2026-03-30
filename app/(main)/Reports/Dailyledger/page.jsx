"use client";

import React, { useState } from "react";
import { db } from "@/app/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

export default function DailyCashCollection() {
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [branchId, setBranchId] = useState("");
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);

    React.useEffect(() => {
        const keys = Object.keys(sessionStorage);
        keys.forEach(k => {
            try {
                const parsed = JSON.parse(sessionStorage.getItem(k));
                if (parsed?.branchId) setBranchId(parsed.branchId);
            } catch { }
        });
    }, []);

    const fetchData = async () => {
        if (!branchId || !selectedDate) return;
        setLoading(true);

        try {
            const paymentQuery = query(
                collection(db, "ACODApayment"), 
                where("branchId", "==", branchId),
                where("date", "==", selectedDate)
            );
            
            const loanQuery = query(
                collection(db, "loans"), 
                where("branchId", "==", branchId),
                where("disbursementDate", "==", selectedDate)
            );

            const [paySnap, loanSnap] = await Promise.all([getDocs(paymentQuery), getDocs(loanQuery)]);

            const summary = {
                date: selectedDate,
                cashIn: {
                    repayments: 0,
                    securityDeposited: 0,
                    admission: 0,
                    passbook: 0,
                    processing: 0,
                    fundsReceived: 0, // Added
                },
                cashOut: {
                    disbursements: 0,
                    securityReturned: 0,
                    fundsTransfer: 0, // Added
                    expenses: 0, 
                }
            };

            paySnap.forEach(doc => {
                const p = doc.data();
                summary.cashIn.repayments += parseFloat(p.amountPaid || 0);
                summary.cashOut.securityReturned += parseFloat(p.securityReturned || 0);
                // If fundsReceived or transfers are stored in the payment collection:
                summary.cashIn.fundsReceived += parseFloat(p.fundsReceived || 0);
                summary.cashOut.fundsTransfer += parseFloat(p.fundsTransfer || 0);
                summary.cashOut.expenses += parseFloat(p.expenses || 0);
            });

            loanSnap.forEach(doc => {
                const l = doc.data();
                summary.cashIn.securityDeposited += parseFloat(l.cashSecurity || 0);
                summary.cashIn.admission += parseFloat(l.admissionFee || 0);
                summary.cashIn.passbook += parseFloat(l.passbookFee || 0);
                summary.cashIn.processing += parseFloat(l.loanProcessingFee || 0);
                summary.cashOut.disbursements += parseFloat(l.principal || 0);
            });

            setData(summary);
        } catch (error) {
            console.error("Error fetching collection data:", error);
        } finally {
            setLoading(false);
        }
    };

    // Calculation Helpers
    const totalIn = data ? (data.cashIn.repayments + data.cashIn.securityDeposited + data.cashIn.admission + data.cashIn.passbook + data.cashIn.processing + data.cashIn.fundsReceived) : 0;
    const totalOut = data ? (data.cashOut.disbursements + data.cashOut.securityReturned + data.cashOut.fundsTransfer + data.cashOut.expenses) : 0;

    return (
        <div className="p-6 bg-slate-50 min-h-screen">
            <div className="max-w-4xl mx-auto">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-6">
                    <h1 className="text-xl font-bold text-slate-800 mb-4 tracking-tight">Daily Cash Collection Breakdown</h1>
                    <div className="flex flex-col md:flex-row gap-4 items-end">
                        <div className="flex-1">
                            <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Target Date</label>
                            <input 
                                type="date" 
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="w-full p-2.5 bg-slate-100 border-none rounded-lg focus:ring-2 focus:ring-indigo-500 font-medium"
                            />
                        </div>
                        <button 
                            onClick={fetchData}
                            className="bg-indigo-600 text-white px-8 py-2.5 rounded-lg font-bold hover:bg-indigo-700 transition-all shadow-md"
                        >
                            {loading ? "Syncing..." : "Generate Report"}
                        </button>
                    </div>
                </div>

                {data && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* INFLOWS */}
                        <div className="bg-white rounded-2xl shadow-sm border-t-4 border-emerald-500 p-6">
                            <h2 className="text-emerald-700 font-bold uppercase tracking-widest text-xs mb-4">Cash Inflow</h2>
                            <div className="space-y-3">
                                <DetailRow label="Loan Repayments" value={data.cashIn.repayments} />
                                <DetailRow label="Security Deposits" value={data.cashIn.securityDeposited} />
                                <DetailRow label="Admission Fees" value={data.cashIn.admission} />
                                <DetailRow label="Passbook Fees" value={data.cashIn.passbook} />
                                <DetailRow label="Processing Fees" value={data.cashIn.processing} />
                                <DetailRow label="Funds Received" value={data.cashIn.fundsReceived} highlight="text-blue-600 font-bold" />
                                <div className="pt-3 border-t border-slate-100 flex justify-between items-center text-emerald-800">
                                    <span className="font-bold">Total Inflow</span>
                                    <span className="text-xl font-black">{totalIn.toLocaleString()}</span>
                                </div>
                            </div>
                        </div>

                        {/* OUTFLOWS */}
                        <div className="bg-white rounded-2xl shadow-sm border-t-4 border-rose-500 p-6">
                            <h2 className="text-rose-700 font-bold uppercase tracking-widest text-xs mb-4">Cash Outflow</h2>
                            <div className="space-y-3">
                                <DetailRow label="Loan Disbursements" value={data.cashOut.disbursements} />
                                <DetailRow label="Security Returns" value={data.cashOut.securityReturned} />
                                <DetailRow label="Funds Transferred" value={data.cashOut.fundsTransfer} highlight="text-purple-600 font-bold" />
                                <DetailRow label="Daily Expenses" value={data.cashOut.expenses} />
                                <div className="pt-3 border-t border-slate-100 flex justify-between items-center text-rose-800">
                                    <span className="font-bold">Total Outflow</span>
                                    <span className="text-xl font-black">{totalOut.toLocaleString()}</span>
                                </div>
                            </div>
                        </div>
                        
                        {/* SUMMARY CARD */}
                        <div className="md:col-span-2 bg-slate-900 text-white p-6 rounded-2xl flex flex-col md:flex-row justify-between items-center shadow-xl">
                            <div className="text-center md:text-left mb-4 md:mb-0">
                                <p className="text-slate-400 text-xs uppercase font-bold tracking-widest">Net Cash Movement</p>
                                <h3 className={`text-4xl font-black mt-1 ${(totalIn - totalOut) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {(totalIn - totalOut).toLocaleString()}
                                </h3>
                            </div>
                            <div className="text-center md:text-right border-t md:border-t-0 md:border-l border-slate-700 pt-4 md:pt-0 md:pl-8">
                                <p className="text-slate-400 text-xs">Collection Date</p>
                                <p className="text-lg font-bold">{new Date(data.date).toLocaleDateString("en-US", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function DetailRow({ label, value, highlight = "text-slate-800" }) {
    return (
        <div className="flex justify-between text-sm">
            <span className="text-slate-500 font-medium">{label}</span>
            <span className={`font-mono ${highlight}`}>{value.toLocaleString()}</span>
        </div>
    );
}