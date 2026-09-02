"use client";

import React, { useState, useEffect } from 'react';
import { db } from '@/app/lib/firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { FaHandHoldingUsd, FaDownload, FaSearch, FaMapMarkerAlt, FaCalendarAlt } from 'react-icons/fa';

export default function LoanApplicationsReport() {
  const [applications, setApplications] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentBranchId, setCurrentBranchId] = useState('');
  const [loading, setLoading] = useState(true);

  // 1. Hydrate Branch Session Configuration Context
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedBranch = sessionStorage.getItem('branchId') || '';
      setCurrentBranchId(storedBranch);
    }
  }, []);

  // 2. Stream target branch loan products/requests
  useEffect(() => {
    if (!currentBranchId) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'individual_loan_products'), 
      where('branchId', '==', currentBranchId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const records = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      setApplications(records);
      setLoading(false);
    }, (error) => {
      console.error("Failed to stream loan pipeline records:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentBranchId]);

  // 3. Search Filter Logic (Checks IDs, Client Name, Product Type, or Status)
  const filteredApps = applications.filter(app => {
    const req = app.loanRequest || {};
    const matchString = `
      ${app.singleLoanId || ''} 
      ${app.personId || ''} 
      ${app.personFullName || ''} 
      ${req.productType || ''} 
      ${req.applicationStatus || ''}
    `.toLowerCase();
    return matchString.includes(searchTerm.toLowerCase());
  });

  // Helper to format timestamps gracefully
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'N/A';
    if (timestamp.seconds) return new Date(timestamp.seconds * 1000).toLocaleDateString('en-GB');
    return new Date(timestamp).toLocaleDateString('en-GB');
  };

  // 4. Export engine structured for Loan Application specified fields
  const handleExportCSV = () => {
    if (filteredApps.length === 0) return alert("No loan request data matching current filters to export.");

    const headers = [
      "Loan ID", "Client ID", "Client Name", "Product Type", 
      "Loan Amount", "Duration (Months)", "Monthly Repayment", 
      "Application Status", "Date Created"
    ];
    
    const rows = filteredApps.map(app => {
      const req = app.loanRequest || {};
      return [
        `"${app.singleLoanId || ''}"`,
        `"${app.personId || ''}"`,
        `"${app.personFullName || ''}"`,
        `"${req.productType || ''}"`,
        req.loanAmount || 0,
        req.durationMonths || 0,
        req.monthlyRepaymentExpected || 0,
        `"${req.applicationStatus || 'New Application'}"`,
        `"${formatTimestamp(app.createdAt)}"`
      ];
    });

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Loan_Applications_Pipeline_Branch_${currentBranchId || 'Active'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 text-black">
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center space-x-2">
            <FaHandHoldingUsd className="text-indigo-600" />
            <span>5. Loan Applications Monitoring Pipeline</span>
          </h1>
          <p className="text-sm text-gray-500 mt-1 flex items-center">
            <FaMapMarkerAlt className="mr-1 text-gray-400" />
            Active Context ID: <span className="font-semibold text-gray-700 ml-1">{currentBranchId || "None Detected"}</span>
          </p>
        </div>
        
        <button
          onClick={handleExportCSV}
          className="mt-4 md:mt-0 inline-flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-sm"
        >
          <FaDownload />
          <span>Export Pipeline CSV</span>
        </button>
      </div>

      {/* Credit Dashboard Status Trackers */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Active Pipeline Requests</p>
          <p className="text-2xl font-black text-gray-900 mt-1">{filteredApps.length}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Pipeline Capital Value</p>
          <p className="text-2xl font-black text-indigo-600 mt-1">
            Le {filteredApps.reduce((acc, curr) => acc + (parseFloat(curr.loanRequest?.loanAmount) || 0), 0).toLocaleString()}
          </p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Projected Portfolio Monthly Income Stream</p>
          <p className="text-2xl font-black text-emerald-600 mt-1">
            Le {filteredApps.reduce((acc, curr) => acc + (parseFloat(curr.loanRequest?.monthlyRepaymentExpected) || 0), 0).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Control Utility Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div className="relative w-full md:w-96">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
            <FaSearch className="h-4 w-4" />
          </span>
          <input
            type="text"
            placeholder="Search Loan ID, Client, Product Type or Status..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 bg-white text-black outline-none transition-all"
          />
        </div>
      </div>

      {/* Data Visualization Matrix */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <th className="py-3 px-4">Loan ID</th>
                <th className="py-3 px-4">Client ID</th>
                <th className="py-3 px-4">Client Name</th>
                <th className="py-3 px-4">Product Type</th>
                <th className="py-3 px-4 text-right">Loan Amount</th>
                <th className="py-3 px-4 text-center">Duration</th>
                <th className="py-3 px-4 text-right">Monthly Repayment</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Date Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {filteredApps.length > 0 ? (
                filteredApps.map((app) => {
                  const req = app.loanRequest || {};
                  return (
                    <tr key={app.id} className="hover:bg-gray-50/70 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-xs font-bold text-indigo-600">
                        {app.singleLoanId || 'N/A'}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs font-semibold text-gray-600">
                        {app.personId || 'N/A'}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-gray-900">
                        {app.personFullName || 'N/A'}
                      </td>
                      <td className="py-3.5 px-4 text-xs font-medium text-gray-600">
                        {req.productType || 'N/A'}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-gray-900">
                        Le {parseFloat(req.loanAmount || 0).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-center text-xs font-semibold text-gray-800">
                        {req.durationMonths ? `${req.durationMonths} Months` : 'N/A'}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-indigo-700">
                        Le {parseFloat(req.monthlyRepaymentExpected || 0).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide border ${
                          req.applicationStatus?.toLowerCase().includes('approved') ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          req.applicationStatus?.toLowerCase().includes('reject') || req.applicationStatus?.toLowerCase().includes('decline') ? 'bg-red-50 text-red-700 border-red-200' :
                          'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                          {req.applicationStatus || 'New Application'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center text-xs text-gray-500 whitespace-nowrap">
                        <span className="flex items-center justify-center space-x-1">
                          <FaCalendarAlt className="text-gray-300" />
                          <span>{formatTimestamp(app.createdAt)}</span>
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="9" className="text-center py-12 text-sm text-gray-400 font-medium bg-gray-50/50">
                    No active loan portfolio elements matching criteria registered under this branch scope.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}