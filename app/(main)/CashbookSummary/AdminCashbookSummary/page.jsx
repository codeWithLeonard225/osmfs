"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { db } from "@/app/lib/firebase";
import { collection, query, where, onSnapshot } from 'firebase/firestore';

export default function CashbookSummary() {
    const [branchId, setBranchId] = useState('');
    const [staffList, setStaffList] = useState([]);
    const [selectedStaff, setSelectedStaff] = useState('');
    const [allPayments, setAllPayments] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    // 1. Get Branch ID from session (consistent with your other pages)
    useEffect(() => {
        const keys = Object.keys(sessionStorage);
        keys.forEach((k) => {
            try {
                const parsed = JSON.parse(sessionStorage.getItem(k));
                if (parsed?.branchId) setBranchId(String(parsed.branchId));
            } catch { }
        });
    }, []);

    // 2. Fetch unique staff names for the filter
    useEffect(() => {
        if (!branchId) return;
        const q = query(collection(db, "loans"), where("branchId", "==", branchId));
        const unsubscribe = onSnapshot(q, (snap) => {
            const uniqueStaff = [...new Set(snap.docs.map(doc => doc.data().staffName))].filter(Boolean);
            setStaffList(uniqueStaff);
        });
        return () => unsubscribe();
    }, [branchId]);

    // 3. Listen to all payments for the branch
    useEffect(() => {
        if (!branchId) return;
        setIsLoading(true);
        const q = query(collection(db, "ACODApayment"), where("branchId", "==", branchId));
        const unsubscribe = onSnapshot(q, (snap) => {
            const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setAllPayments(data);
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, [branchId]);

    // 4. THE ENGINE: Group and Sum data by GroupName
    const groupedData = useMemo(() => {
        if (!selectedStaff) return [];

        const filtered = allPayments.filter(p => p.staffName === selectedStaff);
        
        const groups = filtered.reduce((acc, curr) => {
            const gName = curr.groupName || "Individual";
            if (!acc[gName]) {
                acc[gName] = {
                    groupName: gName,
                    totalSecurity: 0,
                    totalRepayment: 0,
                    lastDate: curr.date
                };
            }
            acc[gName].totalSecurity += parseFloat(curr.securityCollected || 0);
            acc[gName].totalRepayment += parseFloat(curr.repaymentAmount || 0);
            // Keep the most recent date found for this group
            if (curr.date > acc[gName].lastDate) acc[gName].lastDate = curr.date;
            
            return acc;
        }, {});

        return Object.values(groups);
    }, [allPayments, selectedStaff]);

    // Totals for the footer
    const grandSecurity = groupedData.reduce((sum, g) => sum + g.totalSecurity, 0);
    const grandRepayment = groupedData.reduce((sum, g) => sum + g.totalRepayment, 0);

    return (
        <div className="p-6 bg-gray-50 min-h-screen font-sans text-black">
            <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
                
                {/* Header & Filter */}
                <div className="bg-gray-900 p-6">
                    <h1 className="text-xl font-bold text-white mb-4">Cashbook Report Summary</h1>
                    <div className="flex flex-col md:flex-row gap-4 items-end">
                        <div className="flex flex-col w-full md:w-64">
                            <label className="text-gray-400 text-xs mb-1 uppercase font-semibold">Filter by Staff</label>
                            <select 
                                className="bg-gray-800 text-white border border-gray-700 p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                value={selectedStaff}
                                onChange={e => setSelectedStaff(e.target.value)}
                            >
                                <option value="">Select Staff Member</option>
                                {staffList.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Table Section */}
                <div className="p-0">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-100 text-gray-600 uppercase text-xs font-bold border-b">
                                <th className="p-4">Group Name</th>
                                <th className="p-4">Last Activity</th>
                                <th className="p-4 text-right">Total Security (SLE)</th>
                                <th className="p-4 text-right">Total Repayment (SLE)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {groupedData.length > 0 ? (
                                groupedData.map((group, idx) => (
                                    <tr key={idx} className="border-b hover:bg-blue-50 transition-colors">
                                        <td className="p-4 font-bold text-blue-900">{group.groupName}</td>
                                        <td className="p-4 text-gray-500">{group.lastDate}</td>
                                        <td className="p-4 text-right font-semibold text-orange-600">
                                            {group.totalSecurity.toLocaleString(undefined, {minimumFractionDigits: 2})}
                                        </td>
                                        <td className="p-4 text-right font-semibold text-green-600">
                                            {group.totalRepayment.toLocaleString(undefined, {minimumFractionDigits: 2})}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="4" className="p-10 text-center text-gray-400 italic">
                                        {selectedStaff ? "No payment data found for this staff." : "Please select a staff member to view summary."}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                        {groupedData.length > 0 && (
                            <tfoot>
                                <tr className="bg-gray-900 text-white font-bold">
                                    <td className="p-4" colSpan="2">GRAND TOTAL</td>
                                    <td className="p-4 text-right text-orange-400">
                                        {grandSecurity.toLocaleString(undefined, {minimumFractionDigits: 2})}
                                    </td>
                                    <td className="p-4 text-right text-green-400">
                                        {grandRepayment.toLocaleString(undefined, {minimumFractionDigits: 2})}
                                    </td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>

            {/* Print/Export Helper */}
            {groupedData.length > 0 && (
                <div className="max-w-4xl mx-auto mt-4 flex justify-end">
                    <button 
                        onClick={() => window.print()} 
                        className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-bold shadow hover:bg-blue-700"
                    >
                        Print Report
                    </button>
                </div>
            )}
        </div>
    );
}