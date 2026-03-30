"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { db } from "@/app/lib/firebase";
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { FaUserTie, FaUsers, FaChartPie, FaMoneyCheckAlt } from 'react-icons/fa';

export default function StaffPerformanceReport() {
    const [branchId, setBranchId] = useState('');
    const [loans, setLoans] = useState([]);
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const keys = Object.keys(sessionStorage);
        keys.forEach((k) => {
            try {
                const parsed = JSON.parse(sessionStorage.getItem(k));
                if (parsed?.branchId) setBranchId(String(parsed.branchId));
            } catch { }
        });
    }, []);

    useEffect(() => {
        if (!branchId) return;
        const qLoans = query(collection(db, "loans"), where("branchId", "==", branchId));
        const qPay = query(collection(db, "ACODApayment"), where("branchId", "==", branchId));

        const unsubLoans = onSnapshot(qLoans, (snap) => {
            setLoans(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        const unsubPay = onSnapshot(qPay, (snap) => {
            setPayments(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            setLoading(false);
        });
        return () => { unsubLoans(); unsubPay(); };
    }, [branchId]);

    // Grouping Logic: Staff -> Groups -> Aggregated Totals
    const staffReport = useMemo(() => {
        const report = {};

        loans.forEach(loan => {
            const staff = loan.staffName || "Unassigned";
            const group = loan.groupName || "Individual Loans";
            const gId = loan.groupId || "none";

            if (!report[staff]) report[staff] = { staffName: staff, groups: {} };
            if (!report[staff].groups[gId]) {
                report[staff].groups[gId] = {
                    groupName: group,
                    clientCount: 0,
                    principal: 0,
                    interest: 0,
                    loanPaid: 0,
                    cashSecurity: 0
                };
            }

            const currentGroup = report[staff].groups[gId];
            const p = parseFloat(loan.principal || 0);
            const r = parseFloat(loan.interestRate || 0) / 100;
            const initialSec = parseFloat(loan.cashSecurity || 0);

            currentGroup.clientCount += 1;
            currentGroup.principal += p;
            currentGroup.interest += (p * r);
            currentGroup.cashSecurity += initialSec;

            // Add payments for this specific loan
            const loanPayments = payments.filter(pay => pay.loanId === loan.loanId);
            loanPayments.forEach(pay => {
                currentGroup.loanPaid += parseFloat(pay.repaymentAmount || 0);
                currentGroup.cashSecurity += parseFloat(pay.securityCollected || 0);
                currentGroup.cashSecurity -= parseFloat(pay.securityReturned || 0);
            });
        });

        return Object.values(report);
    }, [loans, payments]);

    if (loading) return <div className="p-10 text-center font-bold">Generating Staff Portfolio...</div>;

    return (
        <div className="p-4 md:p-8 bg-gray-50 min-h-screen">
            <h1 className="text-3xl font-black text-slate-800 mb-8 flex items-center gap-3">
                <FaChartPie className="text-indigo-600" /> Staff & Group Portfolio Tracking
            </h1>

            {staffReport.map((staff, idx) => (
                <div key={idx} className="mb-12 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    {/* Staff Header */}
                    <div className="bg-indigo-900 p-5 flex justify-between items-center text-white">
                        <div className="flex items-center gap-4">
                            <div className="bg-indigo-700 p-3 rounded-full">
                                <FaUserTie size={24} />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold uppercase tracking-wide">{staff.staffName}</h2>
                                <p className="text-indigo-300 text-xs">Managing {Object.keys(staff.groups).length} Group(s)</p>
                            </div>
                        </div>
                    </div>

                    {/* Groups Table for this Staff */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-bold tracking-tighter">
                                <tr>
                                    <th className="p-4">Group Name</th>
                                    <th className="p-4 text-center">Clients</th>
                                    <th className="p-4">Total Principal</th>
                                    <th className="p-4">Total Interest</th>
                                    <th className="p-4">Total Paid</th>
                                    <th className="p-4">Balance</th>
                                    <th className="p-4 text-right">Total Security</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {Object.values(staff.groups).map((group, gIdx) => {
                                    const totalDue = group.principal + group.interest;
                                    const balance = totalDue - group.loanPaid;

                                    return (
                                        <tr key={gIdx} className="hover:bg-slate-50 transition-colors">
                                            <td className="p-4">
                                                <div className="flex items-center gap-2">
                                                    <FaUsers className="text-slate-400" />
                                                    <span className="font-bold text-slate-700">{group.groupName}</span>
                                                </div>
                                            </td>
                                            <td className="p-4 text-center">
                                                <span className="bg-slate-100 px-3 py-1 rounded-full text-xs font-bold text-slate-600">
                                                    {group.clientCount}
                                                </span>
                                            </td>
                                            <td className="p-4 font-mono text-slate-600">{group.principal.toLocaleString()}</td>
                                            <td className="p-4 font-mono text-slate-600">{group.interest.toLocaleString()}</td>
                                            <td className="p-4 font-mono text-green-600 font-bold">{group.loanPaid.toLocaleString()}</td>
                                            <td className="p-4">
                                                <span className={`font-mono font-black ${balance > 0 ? 'text-rose-600' : 'text-blue-600'}`}>
                                                    {balance.toLocaleString()}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right">
                                                <div className="inline-flex items-center gap-1 text-amber-700 font-bold bg-amber-50 px-3 py-1 rounded-lg border border-amber-100">
                                                    <FaMoneyCheckAlt size={12} />
                                                    {group.cashSecurity.toLocaleString()}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            ))}
        </div>
    );
}