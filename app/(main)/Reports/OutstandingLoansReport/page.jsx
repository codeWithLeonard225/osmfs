"use client";

import React, { useState, useEffect } from 'react';
import { 
    FaSearch, FaDownload, FaExclamationTriangle, FaFilter,
    FaFileInvoiceDollar, FaCheckCircle, FaUserClock, FaHistory 
} from 'react-icons/fa';
import { db } from '@/app/lib/firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';

export default function OutstandingLoansReport({ branchId }) {
    // Component parameters control states
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'critical' | 'normal'
    const [loans, setLoans] = useState([]);
    const [loading, setLoading] = useState(true);

    // Dynamic state management trackers
    const [summary, setSummary] = useState({
        totalActivePortfolios: 0,
        grossSanctionedAmount: 0,
        totalRecoveredToDate: 0,
        netOutstandingLiability: 0
    });

    // Real-Time listener connecting to individual_loan_products
    useEffect(() => {
        if (!branchId) return;

        setLoading(true);
        const q = query(
            collection(db, "individual_loan_products"),
            where("branchId", "==", branchId)
        );

        // Fetching structural base records 
        const unsubscribeLoans = onSnapshot(q, (loanSnapshot) => {
            const rawLoansList = [];
            
            if (loanSnapshot.empty) {
                setLoans([]);
                setLoading(false);
                return;
            }

            // Map outstanding loans list structure
            const loansData = loanSnapshot.docs.map(doc => {
                const data = doc.data();
                const amount = parseFloat(data.loanRequest?.loanAmount) || 0;
                const monthlyBase = parseFloat(data.loanRequest?.monthlyRepaymentExpected) || 0;
                
                // standard 30% flat interest coefficient matching your platform criteria
                const totalPayableWithInterest = amount + (amount * 0.30); 

                return {
                    id: doc.id,
                    singleLoanId: data.singleLoanId || 'N/A',
                    clientName: data.personFullName || 'N/A',
                    totalLoan: totalPayableWithInterest,
                    monthlyInstallment: monthlyBase
                };
            });

            // Fetch transactional payment records sequentially to compute real balances
            const paymentsRef = query(collection(db, "loan_payments"), where("branchId", "==", branchId));
            const unsubscribePayments = onSnapshot(paymentsRef, (paymentsSnapshot) => {
                
                // Aggregate all payment blocks into a fast-lookup map array
                const paymentsMap = {};
                paymentsSnapshot.forEach(pDoc => {
                    const pData = pDoc.data();
                    const loanIdKey = (pData.singleLoanId || '').toUpperCase().trim();
                    const paidAmt = parseFloat(pData.amountPaid) || 0;
                    paymentsMap[loanIdKey] = (paymentsMap[loanIdKey] || 0) + paidAmt;
                });

                // Stitch calculated properties onto our main report array stream
                const fullyComputedPortfolios = loansData.map(loan => {
                    const loanIdClean = loan.singleLoanId.toUpperCase().trim();
                    const amountPaid = paymentsMap[loanIdClean] || 0;
                    const outstandingBalance = loan.totalLoan - amountPaid;
                    
                    // Formulate remaining month indices dynamically
                    let remainingMonths = loan.monthlyInstallment > 0 ? Math.ceil(outstandingBalance / loan.monthlyInstallment) : 0;
                    if (outstandingBalance <= 0) remainingMonths = 0;

                    return {
                        ...loan,
                        amountPaid,
                        outstandingBalance: outstandingBalance < 0 ? 0 : outstandingBalance,
                        remainingMonthsCalculated: remainingMonths
                    };
                }).filter(l => l.outstandingBalance > 0); // Isolate accounts that still owe money

                setLoans(fullyComputedPortfolios);
                setLoading(false);
            }, (pErr) => {
                console.error("Error processing tracking matrix maps:", pErr);
                setLoading(false);
            });

            return () => unsubscribePayments();

        }, (err) => {
            console.error("Error syncing master portfolios layout:", err);
            setLoading(false);
        });

        return () => unsubscribeLoans();
    }, [branchId]);

    // Handle interactive dynamic display filtering logic
    const compileFilteredReport = () => {
        let results = [...loans];

        // 1. Text filter search matching logic
        if (searchTerm.trim() !== '') {
            const term = searchTerm.toLowerCase();
            results = results.filter(l => 
                l.singleLoanId.toLowerCase().includes(term) ||
                l.clientName.toLowerCase().includes(term)
            );
        }

        // 2. Risk stratification layer filter
        if (statusFilter === 'critical') {
            // Flag accounts with more than 6 months of outstanding terms as critical risk exposure
            results = results.filter(l => l.remainingMonthsCalculated > 6);
        } else if (statusFilter === 'normal') {
            results = results.filter(l => l.remainingMonthsCalculated <= 6);
        }

        // 3. Re-aggregate summary boxes based on current filter state view
        const totalActivePortfolios = results.length;
        let grossSanctionedAmount = 0;
        let totalRecoveredToDate = 0;
        let netOutstandingLiability = 0;

        results.forEach(l => {
            grossSanctionedAmount += l.totalLoan;
            totalRecoveredToDate += l.amountPaid;
            netOutstandingLiability += l.outstandingBalance;
        });

        return {
            filteredList: results,
            liveMetrics: { totalActivePortfolios, grossSanctionedAmount, totalRecoveredToDate, netOutstandingLiability }
        };
    };

    const { filteredList, liveMetrics } = compileFilteredReport();

    // Export handler to download report straight into a spreadsheet format
    const handleExportCSV = () => {
        if (filteredList.length === 0) return alert("No outstanding loan records to export.");

        const headers = ["Loan ID", "Client Name", "Total Loan (Inc. Int)", "Amount Paid to Date", "Outstanding Balance Owed", "Remaining Months Expected"];
        const rows = filteredList.map(l => [
            `"${l.singleLoanId}"`,
            `"${l.clientName}"`,
            l.totalLoan,
            l.amountPaid,
            l.outstandingBalance,
            l.remainingMonthsCalculated
        ]);

        rows.push([]);
        rows.push(["MANAGEMENT EXPOSURE SUMMARY BLOCK"]);
        rows.push(["Total Outstanding Accounts", liveMetrics.totalActivePortfolios]);
        rows.push(["Gross Value Sanctioned", liveMetrics.grossSanctionedAmount]);
        rows.push(["Total Capital Recovered", liveMetrics.totalRecoveredToDate]);
        rows.push(["Net Portfolio at Risk (PAR)", liveMetrics.netOutstandingLiability]);

        const content = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
        const link = document.createElement("a");
        link.setAttribute("href", encodeURI(content));
        link.setAttribute("download", `Outstanding_Loans_Risk_Report.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-md p-6 text-black space-y-6">
            
            {/* Component Action Banner */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-4 gap-3">
                <div>
                    <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
                        <FaFileInvoiceDollar className="text-rose-500" /> Outstanding Loans Report ⭐
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">Real-time risk ledger showing remaining balances, repayment velocities, and portfolios at risk.</p>
                </div>
                <button 
                    onClick={handleExportCSV}
                    className="inline-flex items-center space-x-2 bg-rose-600 hover:bg-rose-700 text-white font-bold px-3 py-2 rounded-xl text-xs transition shadow-sm"
                >
                    <FaDownload /> <span>Export Risk Log</span>
                </button>
            </div>

            {/* Controls Filter Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100 items-end">
                <div className="sm:col-span-2 flex flex-col space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                        <FaSearch className="text-slate-400" /> Fast Search Filter
                    </label>
                    <input 
                        type="text"
                        placeholder="Filter by Loan ID token or client name..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="p-2 text-xs border border-slate-200 rounded-lg bg-white text-black outline-none focus:ring-2 focus:ring-rose-500"
                    />
                </div>
                <div className="flex flex-col space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                        <FaFilter className="text-slate-400" /> Risk Tier Profile
                    </label>
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="p-2 text-xs border border-slate-200 rounded-lg bg-white text-black outline-none font-semibold focus:ring-2 focus:ring-rose-500"
                    >
                        <option value="all">All Pending Receivables</option>
                        <option value="critical">Extended Terms Risk (&gt;6 Mos)</option>
                        <option value="normal">Standard Term Arrears (&le;6 Mos)</option>
                    </select>
                </div>
            </div>

            {/* Financial Risk Aggregations Visual Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-slate-900 text-white p-4 rounded-xl shadow-inner flex flex-col justify-between">
                    <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Active Debtors</span>
                    <span className="text-lg font-black mt-1">{liveMetrics.totalActivePortfolios} Accounts</span>
                </div>
                <div className="bg-slate-50 border p-4 rounded-xl flex flex-col justify-between">
                    <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Total Contract Value</span>
                    <span className="text-lg font-black text-slate-900 mt-1">Le {liveMetrics.grossSanctionedAmount.toLocaleString()}</span>
                </div>
                <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl flex flex-col justify-between">
                    <span className="text-[10px] font-bold uppercase text-emerald-700 tracking-wider">Total Capital Saved</span>
                    <span className="text-lg font-black text-emerald-900 mt-1">Le {liveMetrics.totalRecoveredToDate.toLocaleString()}</span>
                </div>
                <div className="bg-rose-50 border border-rose-100 p-4 rounded-xl flex flex-col justify-between">
                    <span className="text-[10px] font-bold uppercase text-rose-700 tracking-wider">Portfolio at Risk (PAR)</span>
                    <span className="text-lg font-black text-rose-900 mt-1">Le {liveMetrics.netOutstandingLiability.toLocaleString()}</span>
                </div>
            </div>

            {/* Registry Outstanding Data Matrix */}
            <div className="overflow-x-auto border border-slate-100 rounded-xl max-h-80 shadow-sm">
                <table className="min-w-full text-left text-xs text-slate-700 bg-white">
                    <thead className="bg-slate-50 font-bold uppercase tracking-wider text-[10px] text-slate-500 sticky top-0 border-b">
                        <tr>
                            <th className="p-3">Loan ID Reference</th>
                            <th className="p-3">Client Name</th>
                            <th className="p-3 text-right">Total Loan (w/ Int)</th>
                            <th className="p-3 text-right">Amount Recovered</th>
                            <th className="p-3 text-right">Outstanding Balance</th>
                            <th className="p-3 text-center">Remaining Months</th>
                            <th className="p-3 text-center">Risk Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading ? (
                            <tr>
                                <td colSpan="7" className="text-center py-10 text-slate-400 font-medium animate-pulse">
                                    Compiling outstanding balance matrices...
                                </td>
                            </tr>
                        ) : filteredList.length > 0 ? (
                            filteredList.map((loan) => (
                                <tr key={loan.id} className="hover:bg-slate-50/80 transition-colors">
                                    <td className="p-3 font-mono font-bold text-indigo-600 uppercase">{loan.singleLoanId}</td>
                                    <td className="p-3 font-semibold text-slate-900">{loan.clientName}</td>
                                    <td className="p-3 text-right font-medium text-slate-600">Le {loan.totalLoan.toLocaleString()}</td>
                                    <td className="p-3 text-right font-semibold text-emerald-700">Le {loan.amountPaid.toLocaleString()}</td>
                                    <td className="p-3 text-right font-black text-rose-600">Le {loan.outstandingBalance.toLocaleString()}</td>
                                    <td className="p-3 text-center font-bold text-slate-900">
                                        {loan.remainingMonthsCalculated} {loan.remainingMonthsCalculated === 1 ? 'Mo' : 'Mos'}
                                    </td>
                                    <td className="p-3 text-center">
                                        {loan.remainingMonthsCalculated > 6 ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded font-bold text-[10px] bg-rose-50 text-rose-700 animate-pulse">
                                                <FaExclamationTriangle /> Critical
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded font-bold text-[10px] bg-amber-50 text-amber-700">
                                                <FaUserClock /> Normal
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan="7" className="text-center py-10 text-slate-400 italic">
                                    All clear! No current outstanding balance liabilities identified matching this data framework scope view.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

        </div>
    );
}