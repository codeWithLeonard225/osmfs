"use client";

import React, { useState, useEffect, useRef } from 'react';
import { db } from "@/app/lib/firebase";
import { collection, query, onSnapshot, where } from 'firebase/firestore';

const printStyles = `
@media print {
    @page { size: landscape; margin: 10mm; }
    body { font-family: Arial, sans-serif; font-size: 10px; color: black; background: white; }
    .no-print { display: none !important; }
    table { border-collapse: collapse; width: 100%; margin-top: 10px; }
    th, td { border: 1px solid #000; padding: 4px; text-align: center; }
    th { background-color: #f3f4f6 !important; -webkit-print-color-adjust: exact; }
    .text-red-600 { color: #dc2626 !important; }
}
`;

export default function FieldCollectionSheet({ branch }) {
    const [branchId, setBranchId] = useState('');
    const [loans, setLoans] = useState([]);
    const [payments, setPayments] = useState([]);
    const [savings, setSavings] = useState([]);
    const [loading, setLoading] = useState(true);
    
    const [selectedStaff, setSelectedStaff] = useState('');
    const [selectedGroup, setSelectedGroup] = useState('');
    const [clientDates, setClientDates] = useState({});
    
    const printAreaRef = useRef(null);

    // 1. Recover Branch ID from props or Session
    useEffect(() => {
        let id = branch?.branchId;
        if (!id && typeof window !== "undefined") {
            const keys = Object.keys(sessionStorage);
            keys.forEach((k) => {
                const val = sessionStorage.getItem(k);
                if (val && val.includes("branchId")) {
                    try { id = JSON.parse(val).branchId; } catch (e) {}
                }
            });
        }
        if (id) setBranchId(id);
    }, [branch]);

    // 2. Real-time Listeners
    useEffect(() => {
        if (!branchId) return;

        const qLoans = query(collection(db, 'loans'), where('branchId', '==', branchId));
        const qPayments = query(collection(db, 'payments'), where('branchId', '==', branchId));
        const qSavings = query(collection(db, 'savings'), where('branchId', '==', branchId));

        const unsubL = onSnapshot(qLoans, (s) => {
            setLoans(s.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        const unsubP = onSnapshot(qPayments, (s) => {
            setPayments(s.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        const unsubS = onSnapshot(qSavings, (s) => {
            setSavings(s.docs.map(d => d.data()));
            setLoading(false);
        });

        return () => { unsubL(); unsubP(); unsubS(); };
    }, [branchId]);

    // 3. Populate Dropdowns (From Loans so they aren't empty)
    const uniqueStaff = [...new Set(loans.map(l => l.staffName).filter(Boolean))].sort();
    const uniqueGroups = [...new Set(loans.map(l => `${l.groupName} (${l.groupId})`).filter(Boolean))].sort();

    // 4. Data Merging Logic
    const buildReportData = () => {
        const savingsLookup = savings.reduce((acc, s) => {
            if (!acc[s.clientId]) acc[s.clientId] = { comp: 0, vol: 0 };
            acc[s.clientId].comp += (s.compulsoryAmount || 0);
            acc[s.clientId].vol += (s.voluntarySavings || 0);
            return acc;
        }, {});

        const paymentStats = payments.reduce((acc, p) => {
            const key = `${p.clientId}-${p.loanId}`;
            if (!acc[key]) acc[key] = { count: 0, paid: 0, last: null };
            acc[key].count += 1;
            acc[key].paid += (p.repaymentAmount || 0);
            const pDate = new Date(p.date);
            if (!acc[key].last || pDate > acc[key].last) acc[key].last = pDate;
            return acc;
        }, {});

        return loans.map(loan => {
            const stats = paymentStats[`${loan.clientId}-${loan.loanId}`];
            const svg = savingsLookup[loan.clientId] || { comp: 0, vol: 0 };
            
            // MATH: Total Debt = Principal * (1 + InterestRate / 100)
            const totalDebt = (loan.principal || 0) * (1 + (parseFloat(loan.interestRate || 0) / 100));
            // MATH: Rate = Total Debt / paymentWeeks
            const rate = loan.paymentWeeks > 0 ? totalDebt / loan.paymentWeeks : 0;

            return {
                ...loan,
                compBal: svg.comp,
                volBal: svg.vol,
                repaymentCount: stats?.count || 0,
                totalPaid: stats?.paid || 0,
                lastActualPay: stats?.last, // Real payment date from payments db
                currentOutstanding: totalDebt - (stats?.paid || 0),
                weeklyRate: rate,
                loanProduct: `${loan.loanOutcome || ''} ${loan.loanType || ''}`.trim()
            };
        });
    };

    // ... (Keep the rest of your imports and states the same)

    const calculateMetrics = (client, dateStr) => {
        const targetDate = new Date(dateStr);
        
        // Use the date we established for the "Last Pay" column
        // If they haven't paid, use repaymentStartDate.
        const lastPayDate = client.lastActualPay 
            ? new Date(client.lastActualPay) 
            : (client.repaymentStartDate ? new Date(client.repaymentStartDate) : null);

        if (!lastPayDate) return { expected: 0, overdue: 0 };

        // Calculate difference in days
        const diffTime = targetDate - lastPayDate;
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        
        // Calculate how many full 7-day cycles have passed
        const totalWeeksElapsed = Math.floor(diffDays / 7);

        let expected = 0;
        let overdue = 0;

        if (totalWeeksElapsed <= 0) {
            // It hasn't been a week yet since the last payment
            expected = 0;
            overdue = 0;
        } else if (totalWeeksElapsed === 1) {
            // Exactly or roughly 1 week has passed
            expected = client.weeklyRate || 0;
            overdue = 0;
        } else {
            // More than 1 week has passed (e.g., 2, 3, or 4 weeks)
            // Expected is just the current week's rate
            expected = client.weeklyRate || 0;
            // Overdue is all the weeks BEFORE the current one
            overdue = (totalWeeksElapsed - 1) * (client.weeklyRate || 0);
        }

        return { expected, overdue };
    };

// ... (In your return/render section, the table remains the same, 
// but it will now use this updated calculation automatically)

    let reportData = buildReportData();
    if (selectedStaff) reportData = reportData.filter(d => d.staffName === selectedStaff);
    if (selectedGroup) reportData = reportData.filter(d => `${d.groupName} (${d.groupId})` === selectedGroup);

    const handlePrint = () => {
        window.print();
    };

    if (loading) return <div className="p-10 text-center">Loading Collection Data...</div>;

    return (
        <div className="p-4 md:p-8 bg-gray-50 min-h-screen text-black">
            <style>{printStyles}</style>
            
            <div className="max-w-[1400px] mx-auto bg-white rounded-xl shadow-sm p-6 mb-6 no-print border">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-indigo-900">Field Collection Sheet</h1>
                        <p className="text-gray-500 text-sm">Manage and print weekly collection targets</p>
                    </div>
                    
                    <div className="flex flex-wrap gap-3">
                        <select 
                            className="p-2 border rounded-md bg-white min-w-[200px]"
                            value={selectedStaff}
                            onChange={e => setSelectedStaff(e.target.value)}
                        >
                            <option value="">All Staff Officers</option>
                            {uniqueStaff.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>

                        <select 
                            className="p-2 border rounded-md bg-white min-w-[200px]"
                            value={selectedGroup}
                            onChange={e => setSelectedGroup(e.target.value)}
                        >
                            <option value="">All Groups</option>
                            {uniqueGroups.map(g => <option key={g} value={g}>{g}</option>)}
                        </select>

                        <button 
                            onClick={handlePrint}
                            className="bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-700 transition font-semibold shadow-sm"
                        >
                            Print Sheet
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-[1400px] mx-auto bg-white p-4 md:p-8 shadow-sm border rounded-xl" ref={printAreaRef}>
                <div className="mb-6 text-center">
                    <h2 className="text-2xl font-bold underline uppercase">Field Collection Sheet</h2>
                    <div className="grid grid-cols-2 text-sm mt-4 text-left border-b pb-4">
                        <div>
                            <p><strong>Branch:</strong> {branchId}</p>
                            <p><strong>Officer:</strong> {selectedStaff || '____________________'}</p>
                        </div>
                        <div className="text-right">
                            <p><strong>Date:</strong> {new Date().toLocaleDateString()}</p>
                            <p><strong>Group:</strong> {selectedGroup || '____________________'}</p>
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-[11px] border-collapse">
                        <thead>
                            <tr className="bg-gray-100">
                                <th className="border p-2">Client ID</th>
                                <th className="border p-2 text-left">Client Name</th>
                                <th className="border p-2">Comp Bal</th>
                                <th className="border p-2">Vol Bal</th>
                                <th className="border p-2">Product</th>
                                <th className="border p-2">Last Pay</th>
                                <th className="border p-2">Ct</th>
                                <th className="border p-2">Rate (Wk)</th>
                                <th className="border p-2">Outstanding</th>
                                <th className="border p-2 bg-yellow-50">Expected</th>
                                <th className="border p-2">Overdue</th>
                                <th className="border p-2">Realise</th>
                                <th className="border p-2 no-print">Target Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            {reportData.length > 0 ? reportData.map((c) => {
                                const cDate = clientDates[c.clientId] || new Date().toISOString().slice(0, 10);
                                const { expected, overdue } = calculateMetrics(c, cDate);
                                
                                // LOGIC: If lastActualPay exists, show it. Otherwise show repaymentStartDate from loan db
                                const displayLastPay = c.lastActualPay 
                                    ? c.lastActualPay.toLocaleDateString() 
                                    : (c.repaymentStartDate ? new Date(c.repaymentStartDate).toLocaleDateString() : 'N/A');

                                return (
                                    <tr key={c.id}>
                                        <td className="border p-2 font-mono">{c.clientId}</td>
                                        <td className="border p-2 text-left font-semibold">{c.clientName}</td>
                                        <td className="border p-2">{c.compBal.toLocaleString()}</td>
                                        <td className="border p-2">{c.volBal.toLocaleString()}</td>
                                        <td className="border p-2">{c.loanProduct}</td>
                                        <td className="border p-2 font-medium">{displayLastPay}</td>
                                        <td className="border p-2">{c.repaymentCount}</td>
                                        <td className="border p-2 font-bold">{c.weeklyRate.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                                        <td className="border p-2">{c.currentOutstanding.toLocaleString()}</td>
                                        <td className="border p-2 bg-yellow-50 font-bold">{expected.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                                        <td className={`border p-2 font-bold ${overdue > 0 ? 'text-red-600' : ''}`}>
                                            {overdue.toLocaleString(undefined, {minimumFractionDigits: 2})}
                                        </td>
                                        <td className="border p-2 bg-gray-50 w-20"></td>
                                        <td className="border p-2 no-print">
                                            <input 
                                                type="date" 
                                                className="text-[10px] border p-1 rounded"
                                                value={cDate}
                                                onChange={e => setClientDates({...clientDates, [c.clientId]: e.target.value})}
                                            />
                                        </td>
                                    </tr>
                                );
                            }) : (
                                <tr>
                                    <td colSpan="13" className="border p-10 text-center text-gray-400">No active loans found.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="mt-12 grid grid-cols-2 text-sm italic pt-8 border-t border-dashed">
                    <div className="space-y-8">
                        <p>Field Officer Signature: ___________________________</p>
                        <p>Branch Manager Signature: _________________________</p>
                    </div>
                    <div className="text-right space-y-2">
                        <p className="text-lg font-bold">Total Expected: SLE {
                            reportData.reduce((sum, c) => {
                                const date = clientDates[c.clientId] || new Date().toISOString().slice(0, 10);
                                return sum + calculateMetrics(c, date).expected;
                            }, 0).toLocaleString(undefined, {minimumFractionDigits: 2})
                        }</p>
                        <p className="text-gray-500 italic">Actual Collection: ___________________________</p>
                    </div>
                </div>
            </div>
        </div>
    );
}