"use client";

import React, { useState, useEffect } from 'react';
import { FaSearch, FaPrint, FaFileAlt, FaFilePdf } from "react-icons/fa";
import { db } from '@/app/lib/firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';

export default function IndividualLoanAndPaymentReport() {
    const [loanList, setLoanList] = useState([]);
    const [paymentsMap, setPaymentsMap] = useState({});
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [downloadingPdf, setDownloadingPdf] = useState(false);
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

    // Real-Time Listeners
    useEffect(() => {
        if (!currentBranchId) return;
        setLoading(true);

        const loansRef = collection(db, "individual_loan_products");
        const qLoans = query(loansRef, where('branchId', '==', currentBranchId));

        const unsubLoans = onSnapshot(qLoans, (snapshot) => {
            setLoanList(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })));
            setLoading(false);
        });

        const paymentsRef = collection(db, "loan_payments");
        const qPayments = query(paymentsRef, where('branchId', '==', currentBranchId));

        const unsubPayments = onSnapshot(qPayments, (snapshot) => {
            const totals = {};
            snapshot.docs.forEach((doc) => {
                const data = doc.data();
                if (data.singleLoanId) {
                    const amount = parseFloat(data.amountPaid) || 0;
                    totals[data.singleLoanId] = (totals[data.singleLoanId] || 0) + amount;
                }
            });
            setPaymentsMap(totals);
        });

        return () => {
            unsubLoans();
            unsubPayments();
        };
    }, [currentBranchId]);

    // PDF Export Handler
    const handleDownloadPDF = async () => {
        setDownloadingPdf(true);
        try {
            const html2pdf = (await import('html2pdf.js')).default;
            const element = document.getElementById('report-container');
            
            const opt = {
                margin:       0.3,
                filename:     `Individual_Loan_Report_${currentBranchId || 'All'}.pdf`,
                image:        { type: 'jpeg', quality: 0.98 },
                html2canvas:  { scale: 2 },
                jsPDF:        { unit: 'in', format: 'letter', orientation: 'landscape' }
            };

            await html2pdf().set(opt).from(element).save();
        } catch (error) {
            console.error("Error generating PDF:", error);
            window.print();
        } finally {
            setDownloadingPdf(false);
        }
    };

    // Search Filter
    const filteredLoans = loanList.filter(l =>
        (l.personFullName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (l.personId || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (l.singleLoanId || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (l.loanRequest?.productType || "").toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Dynamic Summary Aggregations
    const totalPrincipal = filteredLoans.reduce((sum, item) => sum + (parseFloat(item.loanRequest?.loanAmount) || 0), 0);

    const totalPrincipalPlusInterest = filteredLoans.reduce((sum, item) => {
        const principal = parseFloat(item.loanRequest?.loanAmount) || 0;
        return sum + (principal + (principal * 0.30));
    }, 0);

    const totalRepaidAll = filteredLoans.reduce((sum, item) => {
        return sum + (paymentsMap[item.singleLoanId] || 0);
    }, 0);

    const totalBalanceAll = totalPrincipalPlusInterest - totalRepaidAll;

    return (
        <div className="p-4 md:p-8 bg-gray-50 min-h-screen text-gray-800">
            {/* Embedded Print Styling */}
            <style jsx global>{`
                @media print {
                    @page {
                        size: landscape;
                        margin: 10mm;
                    }

                    /* Force Browser to Output Full Colors */
                    *, *::before, *::after {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                        color-adjust: exact !important;
                    }

                    /* Hide Parent Layout / Sidebar / Nav */
                    body * {
                        visibility: hidden !important;
                    }

                    /* Show Only Printable Section */
                    #printable-report-area, #printable-report-area * {
                        visibility: visible !important;
                    }

                    #printable-report-area {
                        position: absolute !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 100% !important;
                        margin: 0 !important;
                        padding: 0 !important;
                    }

                    .no-print {
                        display: none !important;
                    }

                    /* Page Break Control */
                    tr {
                        break-inside: avoid !important;
                        page-break-inside: avoid !important;
                    }

                    .last-page-totals {
                        break-inside: avoid !important;
                        page-break-inside: avoid !important;
                    }
                }
            `}</style>

            <div id="printable-report-area">
                {/* Controls Bar */}
                <div className="no-print mb-6 flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                    <div className="relative w-full md:w-96">
                        <FaSearch className="absolute left-3 top-3 text-gray-400" />
                        <input
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-black bg-white"
                            placeholder="Search by Loan ID, Person ID, Name..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    
                    <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                        <button
                            onClick={handleDownloadPDF}
                            disabled={downloadingPdf}
                            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors disabled:opacity-50"
                        >
                            <FaFilePdf /> {downloadingPdf ? 'Generating PDF...' : 'Download PDF'}
                        </button>
                        <button
                            onClick={() => window.print()}
                            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors"
                        >
                            <FaPrint /> Print Table Only
                        </button>
                    </div>
                </div>

                {/* Main Table Container */}
                <div id="report-container" className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden p-4">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr>
                                <th colSpan="9" className="p-0 border-none">
                                    <div className="p-6 bg-indigo-900 text-white flex justify-between items-center rounded-t-xl mb-4">
                                        <div>
                                            <h2 className="text-xl font-bold flex items-center gap-2">
                                                <FaFileAlt className="text-indigo-400" /> Individual Loan & Payments Report
                                            </h2>
                                            <p className="text-xs text-indigo-200 mt-1">
                                                Branch: {currentBranchId || 'All Branches'} | Total Records: {filteredLoans.length}
                                            </p>
                                        </div>
                                    </div>
                                </th>
                            </tr>
                            <tr className="bg-indigo-50 text-indigo-950 uppercase text-xs font-semibold border-b border-indigo-200">
                                <th className="p-4 border-b">Single Loan ID</th>
                                <th className="p-4 border-b">Person ID</th>
                                <th className="p-4 border-b">Full Name</th>
                                <th className="p-4 border-b">Product Type</th>
                                <th className="p-4 border-b text-center">Term</th>
                                <th className="p-4 border-b text-right">Principal</th>
                                <th className="p-4 border-b text-right">Total (+30% Int.)</th>
                                <th className="p-4 border-b text-right">Total Paid</th>
                                <th className="p-4 border-b text-right">Balance Owed</th>
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-gray-200 text-sm">
                            {loading ? (
                                <tr>
                                    <td colSpan="9" className="p-8 text-center text-gray-500">
                                        Loading report data...
                                    </td>
                                </tr>
                            ) : filteredLoans.length === 0 ? (
                                <tr>
                                    <td colSpan="9" className="p-8 text-center text-gray-500">
                                        No loan records found.
                                    </td>
                                </tr>
                            ) : (
                                <>
                                    {filteredLoans.map((item) => {
                                        const principal = parseFloat(item.loanRequest?.loanAmount) || 0;
                                        const totalWithInterest = principal + (principal * 0.30);
                                        const paidToDate = paymentsMap[item.singleLoanId] || 0;
                                        const balance = totalWithInterest - paidToDate;

                                        return (
                                            <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                                                <td className="p-4 font-mono font-bold text-indigo-900">
                                                    {item.singleLoanId || '-'}
                                                </td>
                                                <td className="p-4 font-mono text-gray-600">
                                                    {item.personId || '-'}
                                                </td>
                                                <td className="p-4 font-semibold text-gray-800">
                                                    {item.personFullName || '-'}
                                                </td>
                                                <td className="p-4">
                                                    <span className="px-2 py-1 bg-indigo-100 text-indigo-800 rounded text-xs font-medium border border-indigo-200">
                                                        {item.loanRequest?.productType || '-'}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-center font-medium">
                                                    {item.loanRequest?.durationMonths ? `${item.loanRequest.durationMonths}m` : '-'}
                                                </td>
                                                <td className="p-4 text-right font-bold text-gray-900">
                                                    {principal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </td>
                                                <td className="p-4 text-right font-bold text-gray-900">
                                                    {totalWithInterest.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </td>
                                                <td className="p-4 text-right font-bold text-green-600">
                                                    {paidToDate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </td>
                                                <td className={`p-4 text-right font-bold ${balance > 0 ? 'text-red-600' : 'text-gray-700'}`}>
                                                    {balance < 0 ? '0.00' : balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </td>
                                            </tr>
                                        );
                                    })}

                                    {/* Inline Totals Row inside <tbody> prevents page repetition */}
                                    <tr className="last-page-totals bg-indigo-100 font-bold border-t-2 border-indigo-300">
                                        <td colSpan="5" className="p-4 text-right text-indigo-950">Totals:</td>
                                        <td className="p-4 text-right text-indigo-950">
                                            {totalPrincipal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        <td className="p-4 text-right text-indigo-950">
                                            {totalPrincipalPlusInterest.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        <td className="p-4 text-right text-green-700">
                                            {totalRepaidAll.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        <td className="p-4 text-right text-red-600">
                                            {totalBalanceAll.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
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