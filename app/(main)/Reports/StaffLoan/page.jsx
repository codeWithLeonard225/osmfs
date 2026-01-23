"use client";

import React, { useEffect, useState, useMemo } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import { FaFileAlt, FaChevronDown, FaChevronUp, FaPrint, FaArrowLeft } from "react-icons/fa";

export default function GroupLoanReport() {
    const [branchId, setBranchId] = useState("");
    const [loanList, setLoanList] = useState([]);

    const [staffName, setStaffName] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");

    const [reportData, setReportData] = useState({});
    const [expandedGroups, setExpandedGroups] = useState({});

    /* GET UNIQUE STAFF */
    const uniqueStaff = useMemo(() => {
        const names = loanList
            .map((loan) => loan.staffName)
            .filter((name) => name && name.trim() !== "");
        return [...new Set(names)].sort();
    }, [loanList]);

    /* SESSION DATA */
    useEffect(() => {
        if (typeof window !== "undefined") {
            const keys = Object.keys(sessionStorage);
            let found = null;
            keys.forEach((k) => {
                const val = sessionStorage.getItem(k);
                if (val && val.includes("branchId")) {
                    try { found = JSON.parse(val); } catch {}
                }
            });
            if (found) setBranchId(found.branchId);
        }
    }, []);

    /* FETCH DATA */
    useEffect(() => {
        if (!branchId) return;
        const q = query(collection(db, "loans"), where("branchId", "==", branchId));
        const unsub = onSnapshot(q, (snapshot) => {
            setLoanList(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
        });
        return () => unsub();
    }, [branchId]);

    const generateReport = () => {
        if (!startDate || !endDate) return alert("Please select dates");

        const start = new Date(startDate);
        const end = new Date(endDate);

        const filtered = loanList.filter((loan) => {
            const d = new Date(loan.disbursementDate);
            const matchesStaff = !staffName || loan.staffName === staffName;
            return matchesStaff && d >= start && d <= end;
        });

        const grouped = {};
        filtered.forEach((loan) => {
            const group = loan.groupName || "Individual";
            if (!grouped[group]) grouped[group] = [];
            grouped[group].push(loan);
        });

        setReportData(grouped);
        const expandMap = {};
        Object.keys(grouped).forEach(g => expandMap[g] = true);
        setExpandedGroups(expandMap);
    };

    const handlePrint = () => {
        window.print();
    };

    const grandTotal = Object.values(reportData).flat().reduce((sum, l) => sum + Number(l.principal), 0);

    return (
        <div className="p-6 bg-gray-50 min-h-screen text-gray-800">
            {/* 1. REPORT HEADER (Visible on Screen and Print) */}
            <div className="bg-white p-6 rounded-xl shadow-sm border mb-6 flex justify-between items-center print:shadow-none print:border-b print:rounded-none">
                <div>
                    <h1 className="text-2xl font-bold text-indigo-900 flex items-center gap-2">
                        <FaFileAlt /> Group Loan Report
                    </h1>
                    <p className="text-sm text-gray-500 font-medium uppercase">Branch: {branchId || "N/A"}</p>
                    <div className="hidden print:block text-xs mt-2 text-gray-600">
                        <p><strong>Staff:</strong> {staffName || "All Staff"}</p>
                        <p><strong>Period:</strong> {startDate} to {endDate}</p>
                    </div>
                </div>

                <div className="print:hidden">
                    <button 
                        onClick={handlePrint}
                        className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 font-bold transition-all shadow-lg shadow-indigo-200"
                    >
                        <FaPrint /> Print Preview
                    </button>
                </div>
            </div>

            {/* 2. FILTER SECTION (Hidden on Print) */}
            <div className="bg-white p-5 rounded-xl shadow-sm border mb-6 print:hidden">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div className="flex flex-col space-y-1">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Staff Name</label>
                        <select
                            value={staffName}
                            onChange={(e) => setStaffName(e.target.value)}
                            className="p-2 border rounded-md bg-white text-black focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                        >
                            <option value="">All Staff</option>
                            {uniqueStaff.map((name) => (
                                <option key={name} value={name}>{name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex flex-col space-y-1">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Start Date</label>
                        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="p-2 border rounded-md outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                    <div className="flex flex-col space-y-1">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">End Date</label>
                        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="p-2 border rounded-md outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                    <button
                        onClick={generateReport}
                        className="bg-indigo-600 text-white font-bold py-2 rounded-md hover:bg-indigo-700 transition-colors"
                    >
                        Generate Report
                    </button>
                </div>
            </div>

            {/* 3. THE REPORT CONTENT */}
            <div className="print:block">
                {Object.keys(reportData).length === 0 && (
                    <div className="text-center py-20 bg-white rounded-xl border-2 border-dashed border-gray-200 text-gray-400 print:hidden">
                        <p>No report data generated yet.</p>
                    </div>
                )}

                {Object.keys(reportData).map((group) => {
                    const total = reportData[group].reduce((sum, l) => sum + Number(l.principal), 0);
                    const isExpanded = expandedGroups[group];

                    return (
                        <div key={group} className="bg-white rounded-xl shadow-sm border mb-4 overflow-hidden print:shadow-none print:border print:mb-8 print:break-inside-avoid">
                            {/* Group Header */}
                            <div 
                                onClick={() => setExpandedGroups(prev => ({...prev, [group]: !prev[group]}))}
                                className="bg-indigo-50 p-4 flex justify-between items-center cursor-pointer print:bg-gray-100 print:border-b"
                            >
                                <h3 className="font-bold text-indigo-900 uppercase tracking-tight">Group: {group}</h3>
                                <div className="flex items-center gap-6">
                                    <span className="font-bold text-indigo-700">Total: SLE {total.toLocaleString()}</span>
                                    <span className="print:hidden text-indigo-300">{isExpanded ? <FaChevronUp /> : <FaChevronDown />}</span>
                                </div>
                            </div>

                            {/* Table (Forces visible on print via CSS below) */}
                            <div className={`overflow-x-auto p-4 ${isExpanded ? 'block' : 'hidden'} print:block`}>
                                <table className="w-full text-sm border-collapse">
                                    <thead>
                                        <tr className="text-gray-400 border-b text-left uppercase text-[10px] font-bold tracking-widest">
                                            <th className="p-2">Client Name</th>
                                            <th className="p-2">Loan ID</th>
                                            <th className="p-2 text-right">Principal</th>
                                            <th className="p-2 text-right">Disbursement</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {reportData[group].map((loan) => (
                                            <tr key={loan.id} className="hover:bg-gray-50 transition-colors">
                                                <td className="p-2 font-semibold text-gray-700">{loan.clientName}</td>
                                                <td className="p-2 font-mono text-xs text-gray-400">{loan.loanId}</td>
                                                <td className="p-2 text-right font-bold text-green-700 print:text-black">SLE {Number(loan.principal).toLocaleString()}</td>
                                                <td className="p-2 text-right text-gray-500">{loan.disbursementDate}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    );
                })}

                {/* 4. GRAND TOTAL SUMMARY */}
                {Object.keys(reportData).length > 0 && (
                    <div className="mt-8 p-6 bg-indigo-900 text-white rounded-xl flex justify-between items-center print:bg-white print:text-black print:border-2 print:border-black print:rounded-none">
                        <div className="uppercase tracking-widest">
                            <h2 className="text-sm font-bold opacity-70">Report Grand Total</h2>
                            <p className="text-2xl font-black">SLE {grandTotal.toLocaleString()}</p>
                        </div>
                        <div className="text-right hidden print:block opacity-50 text-[10px]">
                            Report Generated: {new Date().toLocaleString()}
                        </div>
                    </div>
                )}
            </div>

            {/* 5. PRINT SPECIFIC STYLES */}
          {/* Add this at the bottom of your Report Component's JSX */}
<style jsx global>{`
  @media print {
    /* 1. RESET LAYOUT WRAPPERS - CRITICAL FOR MULTI-PAGE PRINTING */
    /* We must force all parent containers to have a natural height */
    html, body, 
    div[class*="flex"], 
    div[class*="h-screen"], 
    div[class*="overflow-y-auto"],
    main {
      height: auto !important;
      overflow: visible !important;
      display: block !important;
      position: relative !important;
    }

    /* 2. Hide the Sidebar and Toggle Buttons */
    .fixed, 
    aside, 
    nav,
    [class*="sidebar"], 
    .bg-black.bg-opacity-40,
    button.print\:hidden,
    .no-print,
    .md\\:hidden {
      display: none !important;
    }

    /* 3. Expand Content to Full Width */
    .flex-1, 
    .bg-gray-100 {
      margin: 0 !important;
      padding: 0 !important;
      background-color: white !important;
      width: 100% !important;
    }

    /* 4. Page Breaks & Table Formatting */
    .bg-white {
      background-color: white !important;
      border: none !important;
    }

    /* Prevent group sections from being split in half across two pages */
    .print\\:break-inside-avoid {
      break-inside: avoid;
      page-break-inside: avoid;
      margin-bottom: 2rem !important;
    }

    /* Force the table to be visible even if accordion is closed on screen */
    .print\\:block {
      display: block !important;
    }

    @page {
      margin: 15mm;
      size: auto;
    }

    /* Chrome/Safari fix for multi-page height */
    body {
      -webkit-print-color-adjust: exact;
    }
  }
`}</style>
        </div>
    );
}