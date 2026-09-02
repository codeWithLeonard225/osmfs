"use client";

import React, { useState, useEffect } from 'react';
import { db } from '@/app/lib/firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { FaChartBar, FaDownload, FaMapMarkerAlt, FaCoins, FaBoxes } from 'react-icons/fa';

export default function LoanProductAnalysisReport() {
  const [records, setRecords] = useState([]);
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
      const docsData = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      setRecords(docsData);
      setLoading(false);
    }, (error) => {
      console.error("Failed to stream analytical records:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentBranchId]);

  // ==========================================
  // SEGMENTATION & GROUPING MATRIX ENGINE
  // ==========================================
  const compileProductAnalysis = () => {
    // Initialize your 5 strictly defined groups
    const segments = {
      "Commercial Loans": { count: 0, totalAmount: 0 },
      "Agricultural Loans": { count: 0, totalAmount: 0 },
      "Salary Loans": { count: 0, totalAmount: 0 },
      "Group Loans": { count: 0, totalAmount: 0 },
      "Asset Finance Loans": { count: 0, totalAmount: 0 },
      "Unclassified Products": { count: 0, totalAmount: 0 } // Fallback safe bucket
    };

    records.forEach(doc => {
      const req = doc.loanRequest || {};
      const productTitle = (req.productType || '').toLowerCase();
      const amount = parseFloat(req.loanAmount) || 0;

      // Logic routing system based on string mappings from form dropdown selections
      if (productTitle.includes('commercial') || productTitle.includes('enterprise') || productTitle.includes('business')) {
        segments["Commercial Loans"].count++;
        segments["Commercial Loans"].totalAmount += amount;
      } else if (productTitle.includes('agri') || productTitle.includes('farm') || productTitle.includes('crop')) {
        segments["Agricultural Loans"].count++;
        segments["Agricultural Loans"].totalAmount += amount;
      } else if (productTitle.includes('salary') || productTitle.includes('payroll') || productTitle.includes('employee')) {
        segments["Salary Loans"].count++;
        segments["Salary Loans"].totalAmount += amount;
      } else if (productTitle.includes('group') || productTitle.includes('community') || productTitle.includes('peer')) {
        segments["Group Loans"].count++;
        segments["Group Loans"].totalAmount += amount;
      } else if (productTitle.includes('asset') || productTitle.includes('equipment') || productTitle.includes('vehicle')) {
        segments["Asset Finance Loans"].count++;
        segments["Asset Finance Loans"].totalAmount += amount;
      } else {
        segments["Unclassified Products"].count++;
        segments["Unclassified Products"].totalAmount += amount;
      }
    });

    // Calculate dynamic averages across the mapped objects
    return Object.entries(segments).map(([productType, data]) => {
      const averageLoanSize = data.count > 0 ? (data.totalAmount / data.count) : 0;
      return {
        productType,
        applicationsCount: data.count,
        totalAmountRequested: data.totalAmount,
        averageLoanSize: parseFloat(averageLoanSize.toFixed(2))
      };
    });
  };

  const compiledAnalysisData = compileProductAnalysis();
  
  // Calculate aggregate totals for summary widgets
  const globalTotalApplications = records.length;
  const globalTotalCapitalRequested = records.reduce((acc, curr) => acc + (parseFloat(curr.loanRequest?.loanAmount) || 0), 0);

  // 3. Export engine structured explicitly for the Product Analysis fields
  const handleExportCSV = () => {
    if (records.length === 0) return alert("No metrics layer available to compile.");

    const headers = ["Product Grouping Category", "Number of Applications", "Total Amount Requested (Le)", "Average Loan Size (Le)"];
    
    const rows = compiledAnalysisData.map(row => [
      `"${row.productType}"`,
      row.applicationsCount,
      row.totalAmountRequested,
      row.averageLoanSize
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Loan_Product_Popularity_Analysis_Branch_${currentBranchId || 'Active'}.csv`);
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
            <FaChartBar className="text-indigo-600" />
            <span>6. Loan Product Strategic Analysis Report</span>
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
          <span>Export Analytics CSV</span>
        </button>
      </div>

      {/* Overview Aggregates Summary Boxes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Gross Branch Application Depth</span>
          <p className="text-3xl font-black text-gray-900 mt-1">{globalTotalApplications} Submissions</p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Cumulative Requested Portfolio Weight</span>
          <p className="text-3xl font-black text-emerald-600 mt-1">Le {globalTotalCapitalRequested.toLocaleString()}</p>
        </div>
      </div>

      {/* Popularity Visual Bars Overview Matrix */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm mb-6">
        <h3 className="text-sm font-bold uppercase text-gray-400 tracking-wider mb-4 flex items-center space-x-2">
          <FaBoxes />
          <span>Product Portfolio Popularity Volume Distribution</span>
        </h3>
        <div className="space-y-4">
          {compiledAnalysisData
            .filter(r => r.applicationsCount > 0 || r.productType !== "Unclassified Products")
            .map((row) => {
              const weightPct = globalTotalApplications ? ((row.applicationsCount / globalTotalApplications) * 100).toFixed(1) : 0;
              return (
                <div key={row.productType} className="group">
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span className="text-gray-700 font-bold group-hover:text-indigo-600 transition-colors">{row.productType}</span>
                    <span className="text-gray-900 font-black">{row.applicationsCount} Requests ({weightPct}%)</span>
                  </div>
                  <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-indigo-600 h-full rounded-full transition-all duration-500" 
                      style={{ width: `${weightPct}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Main Structuring Statistical Presentation Table Grid */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <th className="py-3 px-6">Product Type Category Group</th>
                <th className="py-3 px-6 text-center">Number of Applications</th>
                <th className="py-3 px-6 text-right">Total Amount Requested</th>
                <th className="py-3 px-6 text-right">Average Loan Size</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {compiledAnalysisData.map((row) => {
                const isZeroCount = row.applicationsCount === 0;
                return (
                  <tr key={row.productType} className={`hover:bg-gray-50/70 transition-colors ${isZeroCount ? 'opacity-60' : ''}`}>
                    <td className="py-4 px-6 font-bold text-gray-900">
                      {row.productType}
                    </td>
                    <td className="py-4 px-6 text-center">
                      <span className={`inline-flex items-center px-3 py-0.5 rounded-full text-xs font-black ${
                        isZeroCount ? 'bg-gray-100 text-gray-400' : 'bg-indigo-50 text-indigo-700'
                      }`}>
                        {row.applicationsCount}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right font-mono font-bold text-gray-900">
                      Le {row.totalAmountRequested.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-4 px-6 text-right font-mono font-black text-emerald-700">
                      Le {row.averageLoanSize.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}