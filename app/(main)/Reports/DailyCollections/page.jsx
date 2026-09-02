"use client";

import React, { useState, useEffect } from 'react';
import { 
    FaCalendarAlt, FaSearch, FaDownload, FaReceipt, 
    FaListOl, FaMoneyBillWave, FaUniversity, FaMobileAlt, FaUser 
} from 'react-icons/fa';
import { db } from '@/app/lib/firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';

export default function DailyCollectionsReport({ branchId }) {
    // Parameters state
    const [filterDate, setFilterDate] = useState(() => {
        const today = new Date();
        return today.toISOString().split('T')[0];
    });
    const [searchTerm, setSearchTerm] = useState('');
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(true);

    // Dynamic metrics compilation states
    const [summary, setSummary] = useState({
        totalTransactions: 0,
        totalCashCollected: 0,
        totalBankDeposits: 0,
        totalMobileMoney: 0,
        grossTotal: 0
    });

    // Real-Time Sync with loan_payments Collection
    useEffect(() => {
        if (!branchId) return;

        setLoading(true);
        const q = query(
            collection(db, "loan_payments"), 
            where("branchId", "==", branchId)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const allPayments = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setPayments(allPayments);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching live collections:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [branchId]);

    // Compute metrics and filter list based on selected Date & Search keywords
    const processReportData = () => {
        // 1. Filter by targeted operational date framework
        let filtered = payments.filter(pmt => {
            if (!pmt.createdAt?.seconds) return false;
            const pmtDateStr = new Date(pmt.createdAt.seconds * 1000).toISOString().split('T')[0];
            return pmtDateStr === filterDate;
        });

        // 2. Apply text search matching (Loan ID, Client Name, Collector Name)
        if (searchTerm.trim() !== '') {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(pmt => 
                (pmt.singleLoanId || '').toLowerCase().includes(term) ||
                (pmt.clientName || '').toLowerCase().includes(term) ||
                (pmt.collectorStaffName || '').toLowerCase().includes(term)
            );
        }

        // 3. Aggregate totals dynamically mapping strict mode categories
        const metrics = {
            totalTransactions: filtered.length,
            totalCashCollected: 0,
            totalBankDeposits: 0,
            totalMobileMoney: 0,
            grossTotal: 0
        };

        filtered.forEach(pmt => {
            const amount = parseFloat(pmt.amountPaid) || 0;
            const mode = (pmt.paymentMode || '').toLowerCase();

            metrics.grossTotal += amount;

            if (mode === 'cash' || mode.includes('handover')) {
                metrics.totalCashCollected += amount;
            } else if (mode.includes('bank') || mode.includes('deposit') || mode.includes('transfer')) {
                metrics.totalBankDeposits += amount;
            } else if (mode.includes('mobile') || mode.includes('money') || mode.includes('orange') || mode.includes('afri')) {
                metrics.totalMobileMoney += amount;
            } else {
                metrics.totalCashCollected += amount; // Secure fallback loop
            }
        });

        return { filteredEntries: filtered, computedMetrics: metrics };
    };

    const { filteredEntries, computedMetrics } = processReportData();

    // Export Handler for crisp spreadsheet logging compatibility
    const handleExportCSV = () => {
        if (filteredEntries.length === 0) return alert("No operational records logged matching the selected date parameter.");
        
        const headers = ["Date/Time", "Loan ID", "Client Name", "Payment Mode", "Amount Paid (NLE)", "Collector"];
        const rows = filteredEntries.map(entry => {
            const dateStr = entry.createdAt?.seconds ? new Date(entry.createdAt.seconds * 1000).toLocaleString('en-GB') : 'N/A';
            return [
                `"${dateStr}"`,
                `"${entry.singleLoanId || ''}"`,
                `"${entry.clientName || ''}"`,
                `"${entry.paymentMode || 'Cash'}"`,
                entry.amountPaid || 0,
                `"${entry.collectorStaffName || 'System Automatic'}"`
            ];
        });

        // Inject specified balance matrix summaries into the CSV download stream
        rows.push([]);
        rows.push(["DAILY SUMMARY SUMMARY BLOCK"]);
        rows.push(["Total Transactions", computedMetrics.totalTransactions]);
        rows.push(["Total Cash Collected", computedMetrics.totalCashCollected]);
        rows.push(["Total Bank Deposits", computedMetrics.totalBankDeposits]);
        rows.push(["Total Mobile Money", computedMetrics.totalMobileMoney]);
        rows.push(["Gross Total Volume", computedMetrics.grossTotal]);

        const content = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
        const link = document.createElement("a");
        link.setAttribute("href", encodeURI(content));
        link.setAttribute("download", `Daily_Collections_Report_${filterDate}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-md p-6 text-black space-y-6">
            
            {/* Header Desk Bar */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-4 gap-3">
                <div>
                    <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
                        <FaReceipt className="text-amber-500" /> Daily Collections Report ⭐
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">End-of-day operational field audit checking all cash desk entry positions.</p>
                </div>
                <button 
                    onClick={handleExportCSV}
                    className="inline-flex items-center space-x-2 bg-amber-600 hover:bg-amber-700 text-white font-bold px-3 py-2 rounded-xl text-xs transition shadow-sm"
                >
                    <FaDownload /> <span>Export Day Sheet</span>
                </button>
            </div>

            {/* Filter controls matrix */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100 items-end">
                <div className="flex flex-col space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                        <FaCalendarAlt className="text-slate-400" /> Target Date
                    </label>
                    <input 
                        type="date" 
                        value={filterDate}
                        onChange={(e) => setFilterDate(e.target.value)}
                        className="p-2 text-xs border border-slate-200 rounded-lg bg-white text-black font-semibold outline-none focus:ring-2 focus:ring-amber-500"
                    />
                </div>
                <div className="sm:col-span-2 flex flex-col space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                        <FaSearch className="text-slate-400" /> Search Keyword Match
                    </label>
                    <input 
                        type="text"
                        placeholder="Search via Loan ID reference key, profile client name, or processing collector..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="p-2 text-xs border border-slate-200 rounded-lg bg-white text-black outline-none focus:ring-2 focus:ring-amber-500"
                    />
                </div>
            </div>

            {/* Live Parameter Financial Summary Matrix Blocks */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="bg-slate-900 text-white p-4 rounded-xl shadow-inner flex flex-col justify-between">
                    <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider flex items-center gap-1">
                        <FaListOl /> Total Txns
                    </span>
                    <span className="text-lg font-black mt-1">{computedMetrics.totalTransactions} Items</span>
                </div>
                <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl flex flex-col justify-between">
                    <span className="text-[10px] font-bold uppercase text-emerald-700 tracking-wider flex items-center gap-1">
                        <FaMoneyBillWave /> Cash Collected
                    </span>
                    <span className="text-lg font-black text-emerald-900 mt-1">Le {computedMetrics.totalCashCollected.toLocaleString()}</span>
                </div>
                <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl flex flex-col justify-between">
                    <span className="text-[10px] font-bold uppercase text-indigo-700 tracking-wider flex items-center gap-1">
                        <FaUniversity /> Bank Deposits
                    </span>
                    <span className="text-lg font-black text-indigo-900 mt-1">Le {computedMetrics.totalBankDeposits.toLocaleString()}</span>
                </div>
                <div className="bg-purple-50 border border-purple-100 p-4 rounded-xl flex flex-col justify-between">
                    <span className="text-[10px] font-bold uppercase text-purple-700 tracking-wider flex items-center gap-1">
                        <FaMobileAlt /> Mobile Money
                    </span>
                    <span className="text-lg font-black text-purple-900 mt-1">Le {computedMetrics.totalMobileMoney.toLocaleString()}</span>
                </div>
                <div className="bg-amber-50 border border-amber-100 col-span-2 lg:col-span-1 p-4 rounded-xl flex flex-col justify-between">
                    <span className="text-[10px] font-bold uppercase text-amber-800 tracking-wider">Gross Aggregate</span>
                    <span className="text-lg font-black text-amber-900 mt-1">Le {computedMetrics.grossTotal.toLocaleString()}</span>
                </div>
            </div>

            {/* Registry Logs Output Data Table */}
            <div className="overflow-x-auto border border-slate-100 rounded-xl max-h-80 shadow-sm">
                <table className="min-w-full text-left text-xs text-slate-700 bg-white">
                    <thead className="bg-slate-50 font-bold uppercase tracking-wider text-[10px] text-slate-500 sticky top-0 border-b">
                        <tr>
                            <th className="p-3">Collection Date</th>
                            <th className="p-3">Loan ID Reference</th>
                            <th className="p-3">Client Name</th>
                            <th className="p-3 text-center">Payment Mode</th>
                            <th className="p-3 text-right">Amount Paid</th>
                            <th className="p-3 text-center">Collector Staff</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading ? (
                            <tr>
                                <td colSpan="6" className="text-center py-10 text-slate-400 font-medium animate-pulse">
                                    Syncing operational database ledgers...
                                </td>
                            </tr>
                        ) : filteredEntries.length > 0 ? (
                            filteredEntries.map((entry) => (
                                <tr key={entry.id} className="hover:bg-slate-50/80 transition-colors">
                                    <td className="p-3 text-slate-400 font-medium">
                                        {entry.createdAt?.seconds 
                                            ? new Date(entry.createdAt.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
                                            : 'Pending...'}
                                    </td>
                                    <td className="p-3 font-mono font-bold text-indigo-600 uppercase">{entry.singleLoanId || 'N/A'}</td>
                                    <td className="p-3 font-semibold text-slate-900">{entry.clientName || 'N/A'}</td>
                                    <td className="p-3 text-center">
                                        <span className={`inline-flex px-2 py-0.5 rounded font-bold text-[10px] ${
                                            (entry.paymentMode || '').toLowerCase() === 'cash' 
                                                ? 'bg-emerald-50 text-emerald-800' 
                                                : (entry.paymentMode || '').toLowerCase().includes('bank') 
                                                ? 'bg-indigo-50 text-indigo-800' 
                                                : 'bg-purple-50 text-purple-800'
                                        }`}>
                                            {entry.paymentMode || 'Cash'}
                                        </span>
                                    </td>
                                    <td className="p-3 text-right font-bold text-slate-900">Le {parseFloat(entry.amountPaid || 0).toLocaleString()}</td>
                                    <td className="p-3 text-center font-medium text-slate-600 flex items-center justify-center gap-1">
                                        <FaUser className="text-slate-300 text-[10px]" /> {entry.collectorStaffName || 'System'}
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan="6" className="text-center py-10 text-slate-400 italic">
                                    No collection transactions logged for this tracking parameter config scope.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

        </div>
    );
}