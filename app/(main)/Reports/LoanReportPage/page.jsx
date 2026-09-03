"use client";
import React, { useState, useEffect } from 'react';
import { FaSearch, FaPrint, FaFileAlt } from "react-icons/fa";
import { db } from '@/app/lib/firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';

export default function LoanReportTable() {
    const [loanList, setLoanList] = useState([]);
    const [repaymentsMap, setRepaymentsMap] = useState({});
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [currentBranchId, setCurrentBranchId] = useState('');

    // Session Data Retrieval
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const keys = Object.keys(sessionStorage);
            let foundData = null;
            keys.forEach(key => {
                const val = sessionStorage.getItem(key);
                if (val && val.includes("companyShortCode")) {
                    try { foundData = JSON.parse(val); } catch (e) { }
                }
            });
            if (foundData) {
                setCurrentBranchId(foundData.branchId || '');
            }
        }
    }, []);

    // Fetch Loans & Repayments in Real-Time
    useEffect(() => {
        if (!currentBranchId) return;
        setLoading(true);

        const loansRef = collection(db, "loans");
        const qLoans = query(loansRef, where('branchId', '==', currentBranchId));

        const unsubLoans = onSnapshot(qLoans, (snapshot) => {
            setLoanList(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })));
            setLoading(false);
        });

        const paymentsRef = collection(db, "ACODApayment");
        const qPayments = query(paymentsRef, where('branchId', '==', currentBranchId));

        const unsubPayments = onSnapshot(qPayments, (snapshot) => {
            const totals = {};
            snapshot.docs.forEach((doc) => {
                const data = doc.data();
                if (data.loanId) {
                    const amount = parseFloat(data.repaymentAmount) || 0;
                    totals[data.loanId] = (totals[data.loanId] || 0) + amount;
                }
            });
            setRepaymentsMap(totals);
        });

        return () => {
            unsubLoans();
            unsubPayments();
        };
    }, [currentBranchId]);

    // Search Filter
    const filteredLoans = loanList.filter(l =>
        (l.clientName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (l.clientId || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (l.loanId || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (l.staffName || "").toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Totals Calculations
    const totalPrincipal = filteredLoans.reduce((sum, item) => sum + (parseFloat(item.principal) || 0), 0);
    
    const totalPrincipalPlusInterest = filteredLoans.reduce((sum, item) => {
        const principalVal = parseFloat(item.principal) || 0;
        const rateVal = parseFloat(item.interestRate) || 0;
        return sum + (principalVal + (principalVal * (rateVal / 100)));
    }, 0);

    const totalRepaidAll = filteredLoans.reduce((sum, item) => {
        return sum + (repaymentsMap[item.loanId] || 0);
    }, 0);

    const totalBalanceAll = totalPrincipalPlusInterest - totalRepaidAll;

    return (
        <div className="p-4 md:p-8 bg-gray-50 min-h-screen text-gray-800">
            {/* Print CSS Configuration */}
            <style jsx global>{`
                @media print {
                    @page {
                        size: landscape;
                        margin: 8mm;
                    }
                    /* Preserve colors in print output */
                    * {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    /* Hide parent controls and layout elements */
                    body * {
                        visibility: hidden;
                    }
                    #printable-report, #printable-report * {
                        visibility: visible;
                    }
                    #printable-report {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                        background: white !important;
                        padding: 0 !important;
                        margin: 0 !important;
                        box-shadow: none !important;
                        border: none !important;
                    }
                    /* Ensure row group stays intact on last page */
                    .totals-row {
                        page-break-inside: avoid !important;
                    }
                    tr {
                        page-break-inside: avoid;
                    }
                }
            `}</style>

            {/* Control Header */}
            <div className="mb-6 flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100 print:hidden">
                <div className="relative w-full md:w-96">
                    <FaSearch className="absolute left-3 top-3 text-gray-400" />
                    <input
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-black bg-white"
                        placeholder="Search by ID, Name, or Staff..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <button
                    onClick={() => window.print()}
                    className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors"
                >
                    <FaPrint /> Print Report
                </button>
            </div>

            {/* Printable Report Container */}
            <div id="printable-report" className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden print:shadow-none print:border-none">
                <div className="p-6 bg-indigo-900 text-white flex justify-between items-center print:bg-indigo-900 print:text-white print:p-4 print:rounded-t-lg print:mb-2">
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2 print:text-lg">
                            <FaFileAlt className="text-indigo-300" /> Loan & Repayment Report
                        </h2>
                        <p className="text-xs text-indigo-200 mt-1">
                            Branch: {currentBranchId || 'All Branches'} | Total Records: {filteredLoans.length}
                        </p>
                    </div>
                </div>

                <div className="overflow-x-auto print:overflow-visible">
                    <table className="w-full text-left border-collapse print:text-xs">
                        <thead className="bg-gray-100 text-gray-700 uppercase text-xs font-semibold border-b print:bg-indigo-100 print:text-indigo-950">
                            <tr>
                                <th className="p-3 border-b">Loan ID</th>
                                <th className="p-3 border-b">Client ID</th>
                                <th className="p-3 border-b">Client Name</th>
                                <th className="p-3 border-b">Staff Name</th>
                                <th className="p-3 border-b text-right">Principal</th>
                                <th className="p-3 border-b text-center">Interest</th>
                                <th className="p-3 border-b text-right">Principal + Int.</th>
                                <th className="p-3 border-b text-right">Total Repaid</th>
                                <th className="p-3 border-b text-right">Balance</th>
                                <th className="p-3 border-b text-center">Disbursement Date</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 text-sm print:text-xs">
                            {loading ? (
                                <tr>
                                    <td colSpan="10" className="p-8 text-center text-gray-500">
                                        Loading records...
                                    </td>
                                </tr>
                            ) : filteredLoans.length === 0 ? (
                                <tr>
                                    <td colSpan="10" className="p-8 text-center text-gray-500">
                                        No loan records found.
                                    </td>
                                </tr>
                            ) : (
                                <>
                                    {filteredLoans.map((loan) => {
                                        const principalNum = parseFloat(loan.principal) || 0;
                                        const rateNum = parseFloat(loan.interestRate) || 0;
                                        const expectedTotal = principalNum + (principalNum * (rateNum / 100));
                                        const totalPaid = repaymentsMap[loan.loanId] || 0;
                                        const balance = expectedTotal - totalPaid;

                                        return (
                                            <tr key={loan.id} className="hover:bg-gray-50 transition-colors">
                                                <td className="p-3 font-mono font-bold text-indigo-900">
                                                    {loan.loanId || '-'}
                                                </td>
                                                <td className="p-3 font-mono text-gray-600">
                                                    {loan.clientId || '-'}
                                                </td>
                                                <td className="p-3 font-semibold text-gray-800">
                                                    {loan.clientName || '-'}
                                                </td>
                                                <td className="p-3 text-gray-700">
                                                    {loan.staffName || '-'}
                                                </td>
                                                <td className="p-3 text-right font-bold text-gray-900">
                                                    {principalNum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </td>
                                                <td className="p-3 text-center font-medium text-gray-700">
                                                    {loan.interestRate ? `${loan.interestRate}%` : '-'}
                                                </td>
                                                <td className="p-3 text-right font-bold text-gray-900">
                                                    {expectedTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </td>
                                                <td className="p-3 text-right font-bold text-emerald-600">
                                                    {totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </td>
                                                <td className={`p-3 text-right font-bold ${balance > 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                                                    {balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </td>
                                                <td className="p-3 text-center font-mono text-gray-600 whitespace-nowrap">
                                                    {loan.disbursementDate || '-'}
                                                </td>
                                            </tr>
                                        );
                                    })}

                                    {/* Totals Row placed inside tbody so it prints ONCE at the end */}
                                    <tr className="totals-row bg-indigo-50 font-bold border-t-2 border-indigo-300 print:bg-indigo-50">
                                        <td colSpan="4" className="p-3 text-right text-indigo-900">Totals:</td>
                                        <td className="p-3 text-right text-indigo-900">
                                            {totalPrincipal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        <td></td>
                                        <td className="p-3 text-right text-indigo-900">
                                            {totalPrincipalPlusInterest.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        <td className="p-3 text-right text-emerald-600">
                                            {totalRepaidAll.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        <td className="p-3 text-right text-red-600">
                                            {totalBalanceAll.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        <td></td>
                                    </tr>
                                </>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}