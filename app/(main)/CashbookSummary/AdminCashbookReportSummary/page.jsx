"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { db } from "@/app/lib/firebase";
import { collection, query, where, onSnapshot } from 'firebase/firestore';

export default function GroupNameReport() {
    const [branchId, setBranchId] = useState('');
    const [staffList, setStaffList] = useState([]);
    const [selectedStaff, setSelectedStaff] = useState('');
    const [allPayments, setAllPayments] = useState([]);

    // 1. Get Branch ID from session
    useEffect(() => {
        const keys = Object.keys(sessionStorage);
        keys.forEach((k) => {
            try {
                const parsed = JSON.parse(sessionStorage.getItem(k));
                if (parsed?.branchId) setBranchId(String(parsed.branchId));
            } catch { }
        });
    }, []);

    // 2. Fetch unique staff names
    useEffect(() => {
        if (!branchId) return;
        const q = query(collection(db, "loans"), where("branchId", "==", branchId));
        const unsubscribe = onSnapshot(q, (snap) => {
            const uniqueStaff = [...new Set(snap.docs.map(doc => doc.data().staffName))].filter(Boolean);
            setStaffList(uniqueStaff);
        });
        return () => unsubscribe();
    }, [branchId]);

    // 3. Listen to Payments
    useEffect(() => {
        if (!branchId) return;
        const q = query(collection(db, "ACODApayment"), where("branchId", "==", branchId));
        const unsubscribe = onSnapshot(q, (snap) => {
            setAllPayments(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        return () => unsubscribe();
    }, [branchId]);

    // 4. THE ENGINE: Group by GroupName AND then by Date
    const groupedReport = useMemo(() => {
        if (!selectedStaff) return [];

        const filtered = allPayments.filter(p => p.staffName === selectedStaff);

        // First, group by Group Name
        const byGroup = filtered.reduce((acc, curr) => {
            const gName = curr.groupName || "Individual";
            const date = curr.date;
            
            if (!acc[gName]) acc[gName] = {};
            if (!acc[gName][date]) {
                acc[gName][date] = { security: 0, repayment: 0 };
            }

            acc[gName][date].security += parseFloat(curr.securityCollected || 0);
            acc[gName][date].repayment += parseFloat(curr.repaymentAmount || 0);
            
            return acc;
        }, {});

        return Object.entries(byGroup).map(([groupName, dates]) => ({
            groupName,
            rows: Object.entries(dates).map(([date, totals]) => ({
                date,
                ...totals
            })).sort((a, b) => new Date(b.date) - new Date(a.date)) // Sort newest date first
        }));
    }, [allPayments, selectedStaff]);

    return (
        <div className="p-6 bg-gray-100 min-h-screen font-sans text-black print:bg-white">
            <div className="max-w-4xl mx-auto">
                
                {/* Filter Section - Hidden during print */}
                <div className="bg-white p-6 rounded shadow mb-6 print:hidden">
                    <label className="block text-sm font-bold mb-2">Filter by Staff Name</label>
                    <select 
                        className="w-full md:w-64 border p-2 rounded text-sm"
                        value={selectedStaff}
                        onChange={e => setSelectedStaff(e.target.value)}
                    >
                        <option value="">Select Staff</option>
                        {staffList.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>

                {selectedStaff && (
                    <div className="space-y-8">
                        <div className="flex justify-between items-center border-b-2 border-black pb-2">
                            <h1 className="text-2xl font-black uppercase">Staff: {selectedStaff}</h1>
                            <span className="text-sm font-bold italic">Report Date: {new Date().toLocaleDateString()}</span>
                        </div>

                        {groupedReport.map((group, idx) => (
                            <div key={idx} className="bg-white shadow rounded overflow-hidden">
                                {/* Group Header */}
                                <div className="bg-gray-800 text-white p-3 px-4 flex justify-between">
                                    <h2 className="font-bold uppercase tracking-widest text-lg">{group.groupName}</h2>
                                    <span className="text-xs self-center">Group Summary</span>
                                </div>

                                <table className="w-full border-collapse">
                                    <thead>
                                        <tr className="bg-gray-200 text-[11px] uppercase border-b border-gray-300">
                                            <th className="p-3 text-left">Collection Date</th>
                                            <th className="p-3 text-right">Total Security (SLE)</th>
                                            <th className="p-3 text-right">Total Repayment (SLE)</th>
                                            <th className="p-3 text-right bg-blue-50">Total Cash</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {group.rows.map((row, rIdx) => (
                                            <tr key={rIdx} className="border-b hover:bg-gray-50 text-sm">
                                                <td className="p-3 font-medium text-gray-600">{row.date}</td>
                                                <td className="p-3 text-right text-orange-700 font-bold">
                                                    {row.security.toFixed(2)}
                                                </td>
                                                <td className="p-3 text-right text-green-700 font-bold">
                                                    {row.repayment.toFixed(2)}
                                                </td>
                                                <td className="p-3 text-right bg-blue-50 font-black">
                                                    {(row.security + row.repayment).toFixed(2)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="bg-gray-50 font-black border-t-2 border-gray-200">
                                            <td className="p-3 text-sm">GROUP TOTALS</td>
                                            <td className="p-3 text-right text-orange-700">
                                                {group.rows.reduce((sum, r) => sum + r.security, 0).toFixed(2)}
                                            </td>
                                            <td className="p-3 text-right text-green-700">
                                                {group.rows.reduce((sum, r) => sum + r.repayment, 0).toFixed(2)}
                                            </td>
                                            <td className="p-3 text-right bg-blue-100 text-blue-900">
                                                {group.rows.reduce((sum, r) => sum + r.security + r.repayment, 0).toFixed(2)}
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        ))}
                    </div>
                )}

                {!selectedStaff && (
                    <div className="text-center py-20 text-gray-400">
                        <p className="text-xl">Select a staff member to view the group summaries.</p>
                    </div>
                )}
            </div>

            {/* Print Button */}
            {selectedStaff && (
                <button 
                    onClick={() => window.print()}
                    className="fixed bottom-8 right-8 bg-black text-white px-6 py-3 rounded-full font-bold shadow-2xl print:hidden hover:scale-105 transition-transform"
                >
                    Print Full Report
                </button>
            )}
        </div>
    );
}