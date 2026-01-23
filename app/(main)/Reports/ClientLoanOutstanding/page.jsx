"use client";

import React, { useEffect, useState, useMemo } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import { FaFileAlt, FaChevronDown, FaChevronUp, FaPrint, FaMoneyBillWave } from "react-icons/fa";

export default function ClientLoanOutstanding() {
    const [branchId, setBranchId] = useState("");
    const [loanList, setLoanList] = useState([]);
    const [staffName, setStaffName] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [reportData, setReportData] = useState({});
    const [expandedGroups, setExpandedGroups] = useState({});

    // Fetch Unique Staff for filter
    const uniqueStaff = useMemo(() => {
        const names = loanList
            .map((loan) => loan.staffName)
            .filter((name) => name && name.trim() !== "");
        return [...new Set(names)].sort();
    }, [loanList]);

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

    const handlePrint = () => { window.print(); };

    // Calculations for Summary
    const totals = useMemo(() => {
        let p = 0; let o = 0;
        Object.values(reportData).flat().forEach(l => {
            const principal = Number(l.principal) || 0;
            const rate = Number(l.interestRate) || 0;
            p += principal;
            o += principal + (principal * (rate / 100));
        });
        return { principal: p, outstanding: o };
    }, [reportData]);

    return (
        <div className="p-6 bg-gray-50 min-h-screen text-gray-800">
            {/* HEADER */}
            <div className="bg-white p-6 rounded-xl shadow-sm border mb-6 flex justify-between items-center print:shadow-none print:border-b print:rounded-none">
                <div>
                    <h1 className="text-2xl font-bold text-emerald-900 flex items-center gap-2">
                        <FaMoneyBillWave /> Client Loan Outstanding
                    </h1>
                    <p className="text-sm text-gray-500 font-medium uppercase">Branch: {branchId || "N/A"}</p>
                    <div className="hidden print:block text-xs mt-2 text-gray-600">
                        <p><strong>Staff:</strong> {staffName || "All Staff"}</p>
                        <p><strong>Period:</strong> {startDate} to {endDate}</p>
                    </div>
                </div>
                <div className="print:hidden">
                    <button onClick={handlePrint} className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-2 rounded-lg hover:bg-emerald-700 font-bold transition-all shadow-lg shadow-emerald-200">
                        <FaPrint /> Print Preview
                    </button>
                </div>
            </div>

            {/* FILTERS */}
            <div className="bg-white p-5 rounded-xl shadow-sm border mb-6 print:hidden">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div className="flex flex-col space-y-1">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Staff Name</label>
                        <select value={staffName} onChange={(e) => setStaffName(e.target.value)} className="p-2 border rounded-md bg-white text-black">
                            <option value="">All Staff</option>
                            {uniqueStaff.map((name) => <option key={name} value={name}>{name}</option>)}
                        </select>
                    </div>
                    <div className="flex flex-col space-y-1">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Start Date</label>
                        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="p-2 border rounded-md" />
                    </div>
                    <div className="flex flex-col space-y-1">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">End Date</label>
                        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="p-2 border rounded-md" />
                    </div>
                    <button onClick={generateReport} className="bg-emerald-600 text-white font-bold py-2 rounded-md hover:bg-emerald-700 transition-colors">Generate Report</button>
                </div>
            </div>

            {/* CONTENT */}
            <div className="print:block">
                {Object.keys(reportData).length === 0 && (
                    <div className="text-center py-20 bg-white rounded-xl border-2 border-dashed text-gray-400 print:hidden">
                        <p>No outstanding data found for selected criteria.</p>
                    </div>
                )}

                {Object.keys(reportData).map((group) => {
                    const groupTotalPrincipal = reportData[group].reduce((sum, l) => sum + Number(l.principal), 0);
                    const isExpanded = expandedGroups[group];

                    return (
                        <div key={group} className="bg-white rounded-xl shadow-sm border mb-4 overflow-hidden print:shadow-none print:border print:mb-8 print:break-inside-avoid">
                            <div onClick={() => setExpandedGroups(prev => ({...prev, [group]: !prev[group]}))} className="bg-emerald-50 p-4 flex justify-between items-center cursor-pointer print:bg-gray-50">
                                <h3 className="font-bold text-emerald-900 uppercase tracking-tight">Group: {group}</h3>
                                <div className="flex items-center gap-6">
                                    <span className="font-bold text-emerald-700">Group Principal: SLE {groupTotalPrincipal.toLocaleString()}</span>
                                    <span className="print:hidden text-emerald-300">{isExpanded ? <FaChevronUp /> : <FaChevronDown />}</span>
                                </div>
                            </div>

                            <div className={`overflow-x-auto p-4 ${isExpanded ? 'block' : 'hidden'} print:block`}>
                                <table className="w-full text-[11px] border-collapse">
                                    <thead>
                                        <tr className="text-gray-500 border-b text-left uppercase font-bold tracking-wider">
                                            <th className="p-2">Client Name</th>
                                            <th className="p-2 text-center">Rate</th>
                                            <th className="p-2 text-right">Principal</th>
                                            <th className="p-2 text-right">Interest</th>
                                            <th className="p-2 text-right bg-emerald-50 print:bg-transparent">Total Outstanding</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {reportData[group].map((loan) => {
                                            const principal = Number(loan.principal) || 0;
                                            const interest = principal * (Number(loan.interestRate) / 100);
                                            const outstanding = principal + interest;

                                            return (
                                                <tr key={loan.id} className="hover:bg-gray-50">
                                                    <td className="p-2">
                                                        <div className="font-bold text-[15px] text-gray-800">{loan.clientName}</div>
                                                        <div className="text-[13px] text-gray-400">{loan.clientId}</div>
                                                    </td>
                                                    <td className="p-2 text-[15px] text-center">{loan.interestRate}%</td>
                                                    <td className="p-2 text-[15px] text-right font-medium">SLE {principal.toLocaleString()}</td>
                                                    <td className="p-2 text-[15px] text-right text-red-500 font-medium">SLE {interest.toLocaleString()}</td>
                                                    <td className="p-2 text-[15px] text-right font-black text-emerald-700 bg-emerald-50 print:bg-transparent print:text-black">
                                                        SLE {outstanding.toLocaleString()}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    );
                })}

                {/* GRAND TOTAL */}
                {Object.keys(reportData).length > 0 && (
                    <div className="mt-8 p-6 bg-emerald-900 text-white rounded-xl grid grid-cols-2 gap-4 print:bg-white print:text-black print:border-2 print:border-black print:rounded-none">
                        <div>
                            <h2 className="text-xs font-bold opacity-70 uppercase">Grand Total Principal</h2>
                            <p className="text-xl font-black">SLE {totals.principal.toLocaleString()}</p>
                        </div>
                        <div className="text-right">
                            <h2 className="text-xs font-bold opacity-70 uppercase">Total Outstanding (Inc. Interest)</h2>
                            <p className="text-2xl font-black text-emerald-300 print:text-black">SLE {totals.outstanding.toLocaleString()}</p>
                        </div>
                    </div>
                )}
            </div>

            <style jsx global>{`
                @media print {
                    html, body, div[class*="flex"], div[class*="h-screen"], div[class*="overflow-y-auto"], main {
                        height: auto !important;
                        overflow: visible !important;
                        display: block !important;
                    }
                    .fixed, aside, nav, [class*="sidebar"], .bg-black.bg-opacity-40, .no-print, .md\\:hidden {
                        display: none !important;
                    }
                    .flex-1, .bg-gray-100 {
                        margin: 0 !important; padding: 0 !important;
                        background-color: white !important; width: 100% !important;
                    }
                    .print\\:break-inside-avoid { break-inside: avoid; page-break-inside: avoid; margin-bottom: 2rem !important; }
                    .print\\:block { display: block !important; }
                    @page { margin: 15mm; size: auto; }
                }
            `}</style>
        </div>
    );
}