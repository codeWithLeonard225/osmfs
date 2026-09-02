"use client";

import React, { useState, useEffect } from 'react';
import { db } from '@/app/lib/firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { FaShieldAlt, FaDownload, FaSearch, FaMapMarkerAlt, FaPhoneAlt, FaUserCheck } from 'react-icons/fa';

export default function NextOfKinReport() {
  const [records, setRecords] = useState([]);
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
      const docsData = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      setRecords(docsData);
      setLoading(false);
    }, (error) => {
      console.error("Failed to stream recovery records:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentBranchId]);

  // 3. Filter criteria (Checks Client ID, Client Name, Next of Kin Name, or NOK Phone)
  const filteredRecords = records.filter(loan => {
    const nok = loan.nextOfKin || {};
    const matchString = `
      ${loan.clientId || ''} 
      ${loan.personFullName || ''} 
      ${nok.name || ''} 
      ${nok.phone || ''}
    `.toLowerCase();
    return matchString.includes(searchTerm.toLowerCase());
  });

  // 4. Export engine structured for Next of Kin fields
  const handleExportCSV = () => {
    if (filteredRecords.length === 0) return alert("No recovery/tracing records available to export.");

    const headers = ["Client ID", "Client Name", "Next of Kin", "Relationship", "Phone Number", "ID Number"];
    
    const rows = filteredRecords.map(loan => {
      const nok = loan.nextOfKin || {};
      return [
        `"${loan.clientId || ''}"`,
        `"${loan.personFullName || ''}"`,
        `"${nok.name || ''}"`,
        `"${nok.relationship || ''}"`,
        `"${nok.phone || ''}"`,
        `"${nok.idNo || ''}"`
      ];
    });

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Next_Of_Kin_Tracing_Report_Branch_${currentBranchId || 'Active'}.csv`);
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
            <FaShieldAlt className="text-orange-600" />
            <span>3. Next of Kin & Guarantor Tracing Report</span>
          </h1>
          <p className="text-sm text-gray-500 mt-1 flex items-center">
            <FaMapMarkerAlt className="mr-1 text-gray-400" />
            Active Context ID: <span className="font-semibold text-gray-700 ml-1">{currentBranchId || "None Detected"}</span>
          </p>
        </div>
        
        <button
          onClick={handleExportCSV}
          className="mt-4 md:mt-0 inline-flex items-center space-x-2 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-sm"
        >
          <FaDownload />
          <span>Export Tracing CSV</span>
        </button>
      </div>

      {/* Operational Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center space-x-3">
          <div className="p-3 rounded-lg bg-orange-50 text-orange-600">
            <FaUserCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-bold uppercase">Total Base Profiles Listed</p>
            <p className="text-xl font-bold text-gray-800">{filteredRecords.length}</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center space-x-3">
          <div className="p-3 rounded-lg bg-red-50 text-red-600">
            <FaPhoneAlt className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-bold uppercase">Missing Tracing Links (Risk Exposure)</p>
            <p className="text-xl font-bold text-red-700">
              {filteredRecords.filter(loan => !loan.nextOfKin?.name || !loan.nextOfKin?.phone).length} Accounts
            </p>
          </div>
        </div>
      </div>

      {/* Utilities Control */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div className="relative w-full md:w-96">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
            <FaSearch className="h-4 w-4" />
          </span>
          <input
            type="text"
            placeholder="Search Client, Relative, or Phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 bg-white text-black outline-none transition-all"
          />
        </div>
      </div>

      {/* Data Visualization Grid */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <th className="py-3 px-4">Client ID</th>
                <th className="py-3 px-4">Client Name</th>
                <th className="py-3 px-4">Next of Kin (Relative)</th>
                <th className="py-3 px-4">Relationship</th>
                <th className="py-3 px-4">Phone Number</th>
                <th className="py-3 px-4">ID Number (NIN)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {filteredRecords.length > 0 ? (
                filteredRecords.map((loan) => {
                  const nok = loan.nextOfKin || {};
                  const isMissingData = !nok.name || !nok.phone;
                  
                  return (
                    <tr key={loan.id} className={`hover:bg-gray-50/70 transition-colors ${isMissingData ? 'bg-red-50/20' : ''}`}>
                      <td className="py-3.5 px-4 font-mono text-xs font-bold text-indigo-600">
                        {loan.clientId || 'N/A'}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-gray-900">
                        {loan.personFullName || 'N/A'}
                      </td>
                      <td className={`py-3.5 px-4 font-semibold ${nok.name ? 'text-gray-800' : 'text-red-600 italic'}`}>
                        {nok.name || 'Missing Name'}
                      </td>
                      <td className="py-3.5 px-4">
                        {nok.relationship ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-50 text-orange-800 border border-orange-100">
                            {nok.relationship}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs italic">Not set</span>
                        )}
                      </td>
                      <td className={`py-3.5 px-4 font-mono text-xs ${nok.phone ? 'text-gray-700' : 'text-red-500 font-bold'}`}>
                        {nok.phone || 'Missing Phone'}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs text-gray-600">
                        {nok.idNo || 'Not provided'}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="6" className="text-center py-12 text-sm text-gray-400 font-medium bg-gray-50/50">
                    No registry tracking files encountered matching current filters.
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