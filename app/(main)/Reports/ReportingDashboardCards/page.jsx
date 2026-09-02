"use client";

import React, { useState, useEffect } from 'react';
import { 
    FaCalendarDay, 
    FaCalendarDays, 
    FaFileInvoiceDollar, 
    FaUserCheck, 
    FaAward, 
    FaArrowTrendUp 
} from 'react-icons/fa6';
import { db } from '@/app/lib/firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';

export default function ReportingDashboardCards({ branchId }) {
    const [loadingProducts, setLoadingProducts] = useState(true);
    const [loadingPayments, setLoadingPayments] = useState(true);
    
    const [rawLoansList, setRawLoansList] = useState([]);
    const [paymentsData, setPaymentsData] = useState({ today: 0, thisMonth: 0, paidMap: {} });

    const [metrics, setMetrics] = useState({
        collectionsToday: 0,
        collectionsThisMonth: 0,
        outstandingBalance: 0,
        activeLoansCount: 0,
        fullyPaidLoansCount: 0
    });

    // 1. Independent Real-Time Stream: Loan Products
    useEffect(() => {
        if (!branchId) {
            setLoadingProducts(false);
            return;
        }

        const qProducts = query(
            collection(db, "individual_loan_products"),
            where("branchId", "==", branchId)
        );

        const unsubscribeProducts = onSnapshot(qProducts, (loanSnapshot) => {
            const list = loanSnapshot.docs.map(doc => {
                const data = doc.data();
                const principal = parseFloat(data.loanRequest?.loanAmount) || 0;
                const totalWithInterest = principal + (principal * 0.30); 
                return {
                    singleLoanId: (data.singleLoanId || '').toUpperCase().trim(),
                    totalLoan: totalWithInterest
                };
            });
            setRawLoansList(list);
            setLoadingProducts(false);
        }, (err) => {
            console.error("Products stream fault:", err);
            setLoadingProducts(false);
        });

        return () => unsubscribeProducts();
    }, [branchId]);

    // 2. Independent Real-Time Stream: Payments Ledger
    useEffect(() => {
        if (!branchId) {
            setLoadingPayments(false);
            return;
        }

        const qPayments = query(
            collection(db, "loan_payments"),
            where("branchId", "==", branchId)
        );

        const unsubscribePayments = onSnapshot(qPayments, (paymentsSnapshot) => {
            const todayStr = new Date().toISOString().split('T')[0];
            const currentMonthStr = new Date().toISOString().substring(0, 7);

            let runningCollectionsToday = 0;
            let runningCollectionsThisMonth = 0;
            const totalPaidMap = {};

            paymentsSnapshot.forEach(pDoc => {
                const pData = pDoc.data();
                const loanKey = (pData.singleLoanId || '').toUpperCase().trim();
                const amount = parseFloat(pData.amountPaid) || 0;

                totalPaidMap[loanKey] = (totalPaidMap[loanKey] || 0) + amount;

                if (pData.createdAt?.seconds) {
                    const pmtDate = new Date(pData.createdAt.seconds * 1000);
                    const pmtDateStr = pmtDate.toISOString().split('T')[0];
                    const pmtMonthStr = pmtDate.toISOString().substring(0, 7);

                    if (pmtDateStr === todayStr) {
                        runningCollectionsToday += amount;
                    }
                    if (pmtMonthStr === currentMonthStr) {
                        runningCollectionsThisMonth += amount;
                    }
                }
            });

            setPaymentsData({
                today: runningCollectionsToday,
                thisMonth: runningCollectionsThisMonth,
                paidMap: totalPaidMap
            });
            setLoadingPayments(false);
        }, (err) => {
            console.error("Payments stream fault:", err);
            setLoadingPayments(false);
        });

        return () => unsubscribePayments();
    }, [branchId]);

    // 3. Combined Derived Core Metrics Calculation Engine
    useEffect(() => {
        // Only run calculations once both streams have initially finished loading
        if (loadingProducts || loadingPayments) return;

        let runningOutstandingBalance = 0;
        let activeCount = 0;
        let fullyPaidCount = 0;

        rawLoansList.forEach(loan => {
            if (loan.totalLoan <= 0) return;

            const aggregatePaid = paymentsData.paidMap[loan.singleLoanId] || 0;
            const netOutstanding = loan.totalLoan - aggregatePaid;

            if (netOutstanding <= 0) {
                fullyPaidCount++;
            } else {
                activeCount++;
                runningOutstandingBalance += netOutstanding;
            }
        });

        setMetrics({
            collectionsToday: paymentsData.today,
            collectionsThisMonth: paymentsData.thisMonth,
            outstandingBalance: runningOutstandingBalance < 0 ? 0 : runningOutstandingBalance,
            activeLoansCount: activeCount,
            fullyPaidLoansCount: fullyPaidCount
        });
    }, [rawLoansList, paymentsData, loadingProducts, loadingPayments]);

    // Reusable presentation skeleton for loading metrics safely
    const CardSkeleton = () => (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm animate-pulse h-28 flex flex-col justify-between">
            <div className="w-1/3 h-3 bg-slate-200 rounded"></div>
            <div className="w-2/3 h-6 bg-slate-300 rounded mt-2"></div>
            <div className="w-1/2 h-2 bg-slate-100 rounded mt-2"></div>
        </div>
    );

    // Show loading state if either independent stream is pending
    if (loadingProducts || loadingPayments) {
        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 w-full">
                <CardSkeleton /> <CardSkeleton /> <CardSkeleton /> <CardSkeleton /> <CardSkeleton />
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 w-full text-black">
            
            {/* 1. TOTAL COLLECTIONS TODAY */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between hover:border-amber-300 transition-all group relative overflow-hidden">
                <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Collections Today</span>
                    <div className="p-2 bg-amber-50 text-amber-600 rounded-xl group-hover:bg-amber-100 transition-colors">
                        <FaCalendarDay size={16} />
                    </div>
                </div>
                <div className="mt-4">
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                        Le {metrics.collectionsToday.toLocaleString()}
                    </h3>
                    <p className="text-[10px] text-slate-400 font-medium mt-0.5 flex items-center gap-0.5">
                        <FaArrowTrendUp className="text-emerald-500" /> Live daily cash positions
                    </p>
                </div>
            </div>

            {/* 2. TOTAL COLLECTIONS THIS MONTH */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between hover:border-indigo-300 transition-all group relative overflow-hidden">
                <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Collections This Month</span>
                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl group-hover:bg-indigo-100 transition-colors">
                        <FaCalendarDays size={16} />
                    </div>
                </div>
                <div className="mt-4">
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                        Le {metrics.collectionsThisMonth.toLocaleString()}
                    </h3>
                    <p className="text-[10px] text-slate-400 font-medium mt-0.5">Cumulative monthly cycle</p>
                </div>
            </div>

            {/* 3. OUTSTANDING BALANCE */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between hover:border-rose-300 transition-all group relative overflow-hidden">
                <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Outstanding Balance</span>
                    <div className="p-2 bg-rose-50 text-rose-600 rounded-xl group-hover:bg-rose-100 transition-colors">
                        <FaFileInvoiceDollar size={16} />
                    </div>
                </div>
                <div className="mt-4">
                    <h3 className="text-2xl font-black text-rose-600 tracking-tight">
                        Le {metrics.outstandingBalance.toLocaleString()}
                    </h3>
                    <p className="text-[10px] text-rose-400 font-bold mt-0.5">Total Portfolio at Risk (PAR)</p>
                </div>
            </div>

            {/* 4. ACTIVE LOANS */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between hover:border-blue-300 transition-all group relative overflow-hidden">
                <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Loans</span>
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-xl group-hover:bg-blue-100 transition-colors">
                        <FaUserCheck size={16} />
                    </div>
                </div>
                <div className="mt-4">
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                        {metrics.activeLoansCount} Accounts
                    </h3>
                    <p className="text-[10px] text-slate-400 font-medium mt-0.5">Open pending collections</p>
                </div>
            </div>

            {/* 5. FULLY PAID LOANS */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between hover:border-emerald-300 transition-all group relative overflow-hidden">
                <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Fully Paid Loans</span>
                    <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl group-hover:bg-emerald-100 transition-colors">
                        <FaAward size={16} />
                    </div>
                </div>
                <div className="mt-4">
                    <h3 className="text-2xl font-black text-emerald-700 tracking-tight">
                        {metrics.fullyPaidLoansCount} Cycles
                    </h3>
                    <p className="text-[10px] text-slate-400 font-medium mt-0.5">Satisfied zero-balance contracts</p>
                </div>
            </div>

        </div>
    );
}