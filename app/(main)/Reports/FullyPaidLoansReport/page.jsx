"use client";

import React, { useState, useEffect } from 'react';
import { 
    FaSearch, FaDownload, FaCheckCircle, FaAward, 
    FaBoxes, FaCalendarCheck, FaFolderOpen, FaArrowCircleUp
} from 'react-icons/fa';
import { db } from '@/app/lib/firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';

export default function FullyPaidLoansReport({ branchId }) {
    // Parameter filtering hook configurations
    const [searchTerm, setSearchTerm] = useState('');
    const [completedLoansList, setCompletedLoansList] = useState([]);
    const [loading, setLoading] = useState(true);

    // Summary block calculations
    const [summaryMetrics, setSummaryMetrics] = useState({
        totalClosedAccounts: 0,
        grossCapitalLiquidated: 0
    });

    // Real-Time pipeline synchronization loop
    useEffect(() => {
        if (!branchId) return;

        setLoading(true);
        const qProducts = query(
            collection(db, "individual_loan_products"),
            where("branchId", "==", branchId)
        );

        const unsubscribe = onSnapshot(qProducts, (loanSnapshot) => {
            if (loanSnapshot.empty) {
                setCompletedLoansList([]);
                setLoading(false);
                return;
            }

            // Hydrate product profiles mapping structural metadata
            const historicalLoans = loanSnapshot.docs.map(doc => {
                const data = doc.data();
                const principalAmount = parseFloat(data.loanRequest?.loanAmount) || 0;
                const contractTotalWithInterest = principalAmount + (principalAmount * 0.30); // 30% standard flat interest yield pricing

                return {
                    id: doc.id,
                    singleLoanId: data.singleLoanId || 'N/A',
                    clientName: data.personFullName || 'N/A',
                    totalLoan: contractTotalWithInterest
                };
            });

            // Read the dynamic transactions pool to isolate completed ledger arrays
            const qPayments = query(collection(db, "loan_payments"), where("branchId", "==", branchId));
            const unsubscribePayments = onSnapshot(qPayments, (paymentsSnapshot) => {
                
                const collectionsMap = {};
                const completionDatesMap = {};

                // Sort collections ascendingly to capture absolute terminal transaction dates
                const sortedPayments = paymentsSnapshot.docs.map(d => d.data())
                    .sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));

                sortedPayments.forEach(pData => {
                    const loanKey = (pData.singleLoanId || '').toUpperCase().trim();
                    const paymentAmount = parseFloat(pData.amountPaid) || 0;
                    
                    collectionsMap[loanKey] = (collectionsMap[loanKey] || 0) + paymentAmount;
                    
                    // Capture transaction timestamps mapping terminal resolution closures
                    if (pData.createdAt?.seconds) {
                        completionDatesMap[loanKey] = new Date(pData.createdAt.seconds * 1000).toLocaleDateString('en-GB');
                    }
                });

                // Enforce condition: remainingBalanceOwed <= 0
                const resolvedSettledPortfolios = historicalLoans.map(loan => {
                    const cleanKey = loan.singleLoanId.toUpperCase().trim();
                    const totalDeposited = collectionsMap[cleanKey] || 0;
                    const remainingBalanceOwed = loan.totalLoan - totalDeposited;

                    return {
                        ...loan,
                        amountPaid: totalDeposited,
                        remainingBalanceOwed: remainingBalanceOwed < 0 ? 0 : remainingBalanceOwed,
                        dateCompleted: completionDatesMap[cleanKey] || 'N/A'
                    };
                }).filter(loan => loan.amountPaid >= loan.totalLoan && loan.totalLoan > 0); 
                // Safeguards allocation condition ensuring structural zero-balance items match cleanly

                setCompletedLoansList(resolvedSettledPortfolios);
                setLoading(false);
            }, (pErr) => {
                console.error("Error evaluating closure telemetry indices:", pErr);
                setLoading(false);
            });

            return () => unsubscribePayments();

        }, (err) => {
            console.error("Master portfolio streaming break:", err);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [branchId]);

    // Live calculations and query token sorting mechanisms
    const compileClosedReportView = () => {
        let items = [...completedLoansList];

        if (searchTerm.trim() !== '') {
            const token = searchTerm.toLowerCase();
            items = items.filter(l => 
                l.singleLoanId.toLowerCase().includes(token) ||
                l.clientName.toLowerCase().includes(token)
            );
        }

        const totalClosedAccounts = items.length;
        let grossCapitalLiquidated = 0;
        items.forEach(l => { grossCapitalLiquidated += l.amountPaid; });

        return { filteredItems: items, aggregatedMetrics: { totalClosedAccounts, grossCapitalLiquidated } };
    };

    const { filteredItems, aggregatedMetrics } = compileClosedReportView();

    // Export handler capturing clean spreadsheet logs
    const handleExportCSV = () => {
        if (filteredItems.length === 0) return alert("No fully completed loan ledger blocks indexed to build standard sheet streams.");

        const headers = ["Loan ID", "Client Name", "Total Loan (w/ Int)", "Amount Recovered", "Date Settle Completed", "Status"];
        const rows = filteredItems.map(l => [
            `"${l.singleLoanId}"`,
            `"${l.clientName}"`,
            l.totalLoan,
            l.amountPaid,
            `"${l.dateCompleted}"`,
            `"COMPLETED"`
        ]);

        rows.push([]);
        rows.push(["LIQUIDATION MATRIX BREAKDOWN SUMMARY"]);
        rows.push(["Total Zero-Balance Accounts", aggregatedMetrics.totalClosedAccounts]);
        rows.push(["Total Capital Liquidated (NLE)", aggregatedMetrics.grossCapitalLiquidated]);

        const content = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
        const link = document.createElement("a");
        link.setAttribute("href", encodeURI(content));
        link.setAttribute("download", `Fully_Paid_Loans_Report_Branch_${branchId || 'Active'}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-md p-6 text-black space-y-6">
            
            {/* Header Action Row */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-4 gap-3">
                <div>
                    <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
                        <FaAward className="text-emerald-500" /> Fully Paid Loans Report ⭐
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">Auditing closed cycles, fully liquidated assets, and performance completions across historical books.</p>
                </div>
                <button 
                    onClick={handleExportCSV}
                    className="inline-flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-2 rounded-xl text-xs transition shadow-sm"
                >
                    <FaDownload /> <span>Export Closures Log</span>
                </button>
            </div>

            {/* Filter Input Console */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <FaSearch className="text-slate-400" /> Fast Search Registry Filter
                </label>
                <input 
                    type="text"
                    placeholder="Search by verified Loan ID key string or profile client name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="p-2 text-xs border border-slate-200 rounded-lg bg-white text-black outline-none focus:ring-2 focus:ring-emerald-500"
                />
            </div>

            {/* Dynamic Visual KPI Summary blocks */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-slate-900 text-white p-4 rounded-xl shadow-inner flex flex-col justify-between">
                    <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider flex items-center gap-1">
                        <FaBoxes /> Total Fully Settled Contracts
                    </span>
                    <span className="text-xl font-black mt-1">{aggregatedMetrics.totalClosedAccounts} Portfolios</span>
                </div>
                <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl flex flex-col justify-between">
                    <span className="text-[10px] font-bold uppercase text-emerald-700 tracking-wider flex items-center gap-1">
                        <FaArrowCircleUp /> Aggregate Vol Liquidated
                    </span>
                    <span className="text-xl font-black text-emerald-900 mt-1">Le {aggregatedMetrics.grossCapitalLiquidated.toLocaleString()}</span>
                </div>
            </div>

            {/* Completed Output Grid Array Table */}
            <div className="overflow-x-auto border border-slate-100 rounded-xl max-h-80 shadow-sm">
                <table className="min-w-full text-left text-xs text-slate-700 bg-white">
                    <thead className="bg-slate-50 font-bold uppercase tracking-wider text-[10px] text-slate-500 sticky top-0 border-b">
                        <tr>
                            <th className="p-3">Loan ID Reference</th>
                            <th className="p-3">Client Name</th>
                            <th className="p-3 text-right">Total Loan (Inc. Int)</th>
                            <th className="p-3 text-right">Aggregate Recovered</th>
                            <th className="p-3 text-center">Date Completed</th>
                            <th className="p-3 text-center">Operational Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading ? (
                            <tr>
                                <td colSpan="6" className="text-center py-10 text-slate-400 font-medium animate-pulse">
                                    Isolating satisfied ledger accounts...
                                </td>
                            </tr>
                        ) : filteredItems.length > 0 ? (
                            filteredItems.map((loan) => (
                                <tr key={loan.id} className="hover:bg-slate-50/80 transition-colors">
                                    <td className="p-3 font-mono font-bold text-indigo-600 uppercase">{loan.singleLoanId}</td>
                                    <td className="p-3 font-semibold text-slate-900">{loan.clientName}</td>
                                    <td className="p-3 text-right font-medium text-slate-500">Le {loan.totalLoan.toLocaleString()}</td>
                                    <td className="p-3 text-right font-bold text-emerald-600">Le {loan.amountPaid.toLocaleString()}</td>
                                    <td className="p-3 text-center font-bold text-slate-600 flex items-center justify-center gap-1 mt-1">
                                        <FaCalendarCheck className="text-slate-400" /> {loan.dateCompleted}
                                    </td>
                                    <td className="p-3 text-center">
                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-black text-[10px] bg-emerald-100 text-emerald-800 tracking-wider">
                                            <FaCheckCircle /> COMPLETED
                                        </span>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan="6" className="text-center py-12 text-slate-400 italic">
                                    <FaFolderOpen className="mx-auto text-slate-300 mb-2" size={24} />
                                    No records identified where condition (remainingBalanceOwed &le; 0) matches fully.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

        </div>
    );
}