"use client";

import React, { useState, useEffect } from 'react';
import { db } from '@/app/lib/firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { FaIdCard, FaDownload, FaSearch, FaMapMarkerAlt, FaUsers } from 'react-icons/fa';

export default function ClientRegistrationReport() {
  const [clients, setClients] = useState([]);
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
      setClients(records);
      setLoading(false);
    }, (error) => {
      console.error("Failed to stream client registry:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentBranchId]);

  // 3. Search filter application logic
  const filteredClients = clients.filter(client => {
    const matchString = `${client.clientId} ${client.personFullName} ${client.telephone} ${client.nationalId}`.toLowerCase();
    return matchString.includes(searchTerm.toLowerCase());
  });

  // 4. Export engine structured for requested fields
  const handleExportCSV = () => {
    if (filteredClients.length === 0) return alert("No client data matching current criteria to export.");

    const headers = ["Client ID", "Full Name", "Phone Number", "NIN", "Gender", "District", "Town", "Registration Date", "Marital Status"];
    
    const rows = filteredClients.map(client => [
      `"${client.clientId || ''}"`,
      `"${client.personFullName || ''}"`,
      `"${client.telephone || ''}"`,
      `"${client.nationalId || ''}"`,
      `"${client.gender || ''}"`,
      `"${client.district || ''}"`,
      `"${client.town || ''}"`,
      `"${client.registrationDate || ''}"`,
      `"${client.maritalStatus || ''}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Client_Registration_Report_Branch_${currentBranchId || 'Active'}.csv`);
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
            <FaUsers className="text-indigo-600" />
            <span>1. Client Registration Report</span>
          </h1>
          <p className="text-sm text-gray-500 mt-1 flex items-center">
            <FaMapMarkerAlt className="mr-1 text-gray-400" />
            Active Context ID: <span className="font-semibold text-gray-700 ml-1">{currentBranchId || "None Detected"}</span>
          </p>
        </div>
        
        <button
          onClick={handleExportCSV}
          className="mt-4 md:mt-0 inline-flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-sm shadow-indigo-100"
        >
          <FaDownload />
          <span>Export Layout CSV</span>
        </button>
      </div>

      {/* Control Utility bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div className="relative w-full md:w-96">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
            <FaSearch className="h-4 w-4" />
          </span>
          <input
            type="text"
            placeholder="Search by ID, Name, Phone, or NIN..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 bg-white text-black outline-none transition-all"
          />
        </div>
        <div className="text-sm text-gray-500 bg-white px-4 py-2 rounded-lg border border-gray-200 shadow-sm">
          Filtered Record Count: <span className="font-bold text-indigo-600">{filteredClients.length}</span> / {clients.length}
        </div>
      </div>

      {/* Data Presentation Matrix */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <th className="py-3 px-4">Client ID</th>
                <th className="py-3 px-4">Full Name</th>
                <th className="py-3 px-4">Phone Number</th>
                <th className="py-3 px-4">NIN (National ID)</th>
                <th className="py-3 px-4">Gender</th>
                <th className="py-3 px-4">District</th>
                <th className="py-3 px-4">Town</th>
                <th className="py-3 px-4">Registration Date</th>
                <th className="py-3 px-4">Marital Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {filteredClients.length > 0 ? (
                filteredClients.map((client) => (
                  <tr key={client.id} className="hover:bg-gray-50/70 transition-colors">
                    <td className="py-3.5 px-4 font-mono text-xs font-bold text-indigo-600">
                      {client.clientId || 'N/A'}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-gray-900">
                      {client.personFullName || 'N/A'}
                    </td>
                    <td className="py-3.5 px-4 text-gray-600">
                      {client.telephone || 'N/A'}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-gray-700">
                      {client.nationalId || 'N/A'}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        client.gender?.toLowerCase() === 'male' ? 'bg-blue-50 text-blue-700' :
                        client.gender?.toLowerCase() === 'female' ? 'bg-pink-50 text-pink-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {client.gender || 'N/A'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-gray-700">{client.district || 'N/A'}</td>
                    <td className="py-3.5 px-4 text-gray-700">{client.town || 'N/A'}</td>
                    <td className="py-3.5 px-4 text-gray-500 whitespace-nowrap">
                      {client.registrationDate || 'N/A'}
                    </td>
                    <td className="py-3.5 px-4 text-gray-600">{client.maritalStatus || 'N/A'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="9" className="text-center py-12 text-sm text-gray-400 font-medium bg-gray-50/50">
                    No matching registry files discovered under this branch environment.
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