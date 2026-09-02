"use client";

import React, { useState, useEffect } from 'react';
import { db } from '@/app/lib/firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { FaBriefcase, FaDownload, FaSearch, FaMapMarkerAlt, FaChartLine, FaIdCard } from 'react-icons/fa';

export default function BusinessProfileReport() {
  const [businesses, setBusinesses] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentBranchId, setCurrentBranchId] = useState('');
  const [loading, setLoading] = useState(true);

  // 1. Fetch current logged-in branch identity
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedBranch = sessionStorage.getItem('branchId') || '';
      setCurrentBranchId(storedBranch);
    }
  }, []);

  // 2. Stream target branch registration items
  useEffect(() => {
    if (!currentBranchId) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'individual_loans'), 
      where('branchId', '==', currentBranchId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const records = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      setBusinesses(records);
      setLoading(false);
    }, (error) => {
      console.error("Failed to stream business registry:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentBranchId]);

  // 3. Search filter application logic (Checks Client Name, ID, Business Name, or TIN)
  const filteredBusinesses = businesses.filter(loan => {
    const biz = loan.businessDetails || {};
    const matchString = `
      ${loan.clientId || ''} 
      ${loan.personFullName || ''} 
      ${biz.businessName || ''} 
      ${biz.tinNumber || ''}
    `.toLowerCase();
    return matchString.includes(searchTerm.toLowerCase());
  });

  // 4. Export engine structured for Business Profile fields
  const handleExportCSV = () => {
    if (filteredBusinesses.length === 0) return alert("No business profile data available to export.");

    const headers = [
      "Client ID", "Client Name", "Business Name", "Business Phone", 
      "Business Address", "Business District", "Business Type", 
      "Registered Owner", "TIN Number", "Number of Employees", "Annual Revenue"
    ];
    
    const rows = filteredBusinesses.map(loan => {
      const b = loan.businessDetails || {};
      return [
        `"${loan.clientId || ''}"`,
        `"${loan.personFullName || ''}"`,
        `"${b.businessName || ''}"`,
        `"${b.businessPhone || ''}"`,
        `"${b.mailingAddress || ''}"`,
        `"${b.district || ''}"`,
        `"${b.ownershipType || ''}"`, // Maps to Business Type
        `"${b.registeredOwner || ''}"`,
        `"${b.tinNumber || ''}"`,
        b.employeeCount || 0,
        b.annualRevenue || 0
      ];
    });

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Business_Profile_Report_Branch_${currentBranchId || 'Active'}.csv`);
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
            <FaBriefcase className="text-emerald-600" />
            <span>2. Business Profile Report</span>
          </h1>
          <p className="text-sm text-gray-500 mt-1 flex items-center">
            <FaMapMarkerAlt className="mr-1 text-gray-400" />
            Active Context ID: <span className="font-semibold text-gray-700 ml-1">{currentBranchId || "None Detected"}</span>
          </p>
        </div>
        
        <button
          onClick={handleExportCSV}
          className="mt-4 md:mt-0 inline-flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-sm"
        >
          <FaDownload />
          <span>Export Layout CSV</span>
        </button>
      </div>

      {/* Meta Analytical Context Bars (For SME Monitoring / Loan Assessment use cases) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center space-x-3">
          <div className="p-3 rounded-lg bg-emerald-50 text-emerald-600">
            <FaChartLine className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-bold uppercase">Evaluated Enterprises</p>
            <p className="text-xl font-bold text-gray-800">{filteredBusinesses.length}</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center space-x-3">
          <div className="p-3 rounded-lg bg-blue-50 text-blue-600">
            <FaBriefcase className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-bold uppercase">Aggregate Job Footprint</p>
            <p className="text-xl font-bold text-gray-800">
              {filteredBusinesses.reduce((acc, curr) => acc + (parseInt(curr.businessDetails?.employeeCount, 10) || 0), 0)} Employees
            </p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center space-x-3">
          <div className="p-3 rounded-lg bg-amber-50 text-amber-600">
            <FaIdCard className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-bold uppercase">TIN Documentation Rate</p>
            <p className="text-xl font-bold text-gray-800">
              {filteredBusinesses.length ? ((filteredBusinesses.filter(b => b.businessDetails?.tinNumber).length / filteredBusinesses.length) * 100).toFixed(0) : 0}%
            </p>
          </div>
        </div>
      </div>

      {/* Control Utility bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div className="relative w-full md:w-96">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
            <FaSearch className="h-4 w-4" />
          </span>
          <input
            type="text"
            placeholder="Search Client, Business Name, or TIN..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 bg-white text-black outline-none transition-all"
          />
        </div>
      </div>

      {/* Data Presentation Table Matrix */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <th className="py-3 px-4">Client ID</th>
                <th className="py-3 px-4">Client Name</th>
                <th className="py-3 px-4">Business Name</th>
                <th className="py-3 px-4">Business Phone</th>
                <th className="py-3 px-4">Business Address</th>
                <th className="py-3 px-4">District</th>
                <th className="py-3 px-4">Business Type</th>
                <th className="py-3 px-4">Registered Owner</th>
                <th className="py-3 px-4">TIN Number</th>
                <th className="py-3 px-4 text-center">Employees</th>
                <th className="py-3 px-4 text-right">Annual Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {filteredBusinesses.length > 0 ? (
                filteredBusinesses.map((loan) => {
                  const b = loan.businessDetails || {};
                  return (
                    <tr key={loan.id} className="hover:bg-gray-50/70 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-xs font-bold text-indigo-600">
                        {loan.clientId || 'N/A'}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-gray-900">
                        {loan.personFullName || 'N/A'}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-emerald-700">
                        {b.businessName || 'N/A'}
                      </td>
                      <td className="py-3.5 px-4 text-gray-600">{b.businessPhone || 'N/A'}</td>
                      <td className="py-3.5 px-4 text-gray-600 truncate max-w-xs">{b.mailingAddress || 'N/A'}</td>
                      <td className="py-3.5 px-4 text-gray-700">{b.district || 'N/A'}</td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-gray-100 text-gray-800 text-xs font-medium">
                          {b.ownershipType || 'Unspecified'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-gray-700 text-xs">{b.registeredOwner || 'N/A'}</td>
                      <td className="py-3.5 px-4 font-mono text-xs text-gray-600">{b.tinNumber || 'None'}</td>
                      <td className="py-3.5 px-4 text-center font-semibold text-gray-800">{b.employeeCount || 0}</td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-gray-900">
                        Le {parseFloat(b.annualRevenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="11" className="text-center py-12 text-sm text-gray-400 font-medium bg-gray-50/50">
                    No borrowing entity files encountered matching current filters.
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