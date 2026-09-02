"use client";

import React, { useState, useEffect } from 'react';
import { db } from '@/app/lib/firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { FaChartPie, FaDownload, FaMapMarkerAlt, FaUsers, FaUserGraduate } from 'react-icons/fa';

export default function CustomerDemographicReport() {
  const [records, setRecords] = useState([]);
  const [currentBranchId, setCurrentBranchId] = useState('');
  const [loading, setLoading] = useState(true);

  // Resolve current branch session context
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedBranch = sessionStorage.getItem('branchId') || '';
      setCurrentBranchId(storedBranch);
    }
  }, []);

  // Stream target branch registration data
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
      console.error("Failed to stream demographic matrix:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentBranchId]);

  // ==========================================
  // MANAGEMENT METRIC CALCULATIONS
  // ==========================================
  const totalClients = records.length;

  const getDemographicsMatrix = () => {
    const gender = { Male: 0, Female: 0, Unspecified: 0 };
    const marital = { Married: 0, Single: 0, Other: 0 };
    const districts = {};
    const towns = {};
    const ageGroups = { '18-25': 0, '26-35': 0, '36-50': 0, '51+': 0, 'Unknown': 0 };
    let totalDependents = 0;

    records.forEach(loan => {
      // 1. Gender distribution
      const g = loan.gender?.toLowerCase();
      if (g === 'male') gender.Male++;
      else if (g === 'female') gender.Female++;
      else gender.Unspecified++;

      // 2. Marital Status
      const m = loan.maritalStatus?.toLowerCase();
      if (m === 'married') marital.Married++;
      else if (m === 'single') marital.Single++;
      else marital.Other++;

      // 3. District Distribution
      const dist = loan.district || 'Not Assigned';
      districts[dist] = (districts[dist] || 0) + 1;

      // 4. Town Distribution
      const t = loan.town || 'Not Assigned';
      towns[t] = (towns[t] || 0) + 1;

      // 5. Dependents Aggregator
      totalDependents += (parseInt(loan.dependentsCount, 10) || 0);

      // 6. Age Group Segmentation Engine
      if (loan.dateOfBirth) {
        try {
          const birthYear = new Date(loan.dateOfBirth).getFullYear();
          const currentYear = new Date().getFullYear();
          const age = currentYear - birthYear;

          if (age >= 18 && age <= 25) ageGroups['18-25']++;
          else if (age >= 26 && age <= 35) ageGroups['26-35']++;
          else if (age >= 36 && age <= 50) ageGroups['36-50']++;
          else if (age >= 51) ageGroups['51+']++;
          else ageGroups['Unknown']++;
        } catch (e) {
          ageGroups['Unknown']++;
        }
      } else {
        ageGroups['Unknown']++;
      }
    });

    const avgDependents = totalClients ? (totalDependents / totalClients).toFixed(1) : 0;

    return { gender, marital, districts, towns, ageGroups, avgDependents };
  };

  const matrix = getDemographicsMatrix();

  // CSV Export for Business Intelligence Teams
  const handleExportCSV = () => {
    if (records.length === 0) return alert("No metrics layer available to compile.");

    const headers = ["Metric Segment", "Classification Group", "Count", "Percentage Contribution"];
    const rows = [];

    // Append Gender Metrics
    Object.entries(matrix.gender).forEach(([key, val]) => {
      rows.push(["Gender Distribution", key, val, `${totalClients ? ((val / totalClients) * 100).toFixed(1) : 0}%`]);
    });
    // Append Marital Metrics
    Object.entries(matrix.marital).forEach(([key, val]) => {
      rows.push(["Marital Framework", key, val, `${totalClients ? ((val / totalClients) * 100).toFixed(1) : 0}%`]);
    });
    // Append Age Metrics
    Object.entries(matrix.ageGroups).forEach(([key, val]) => {
      rows.push(["Age Grouping Index", key, val, `${totalClients ? ((val / totalClients) * 100).toFixed(1) : 0}%`]);
    });
    // Append Regional Geographic Metrics
    Object.entries(matrix.districts).forEach(([key, val]) => {
      rows.push(["Regional District Split", key, val, `${totalClients ? ((val / totalClients) * 100).toFixed(1) : 0}%`]);
    });

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Customer_Demographics_BI_Report_Branch_${currentBranchId || 'Active'}.csv`);
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
            <FaChartPie className="text-indigo-600" />
            <span>4. Customer Demographic Intelligence Report</span>
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
          <span>Export Metrics CSV</span>
        </button>
      </div>

      {/* Top Level Intelligence Summary Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Total Active Consumer Base</span>
          <p className="text-3xl font-extrabold text-gray-900 mt-1">{totalClients}</p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Average Household Dependents</span>
          <p className="text-3xl font-extrabold text-indigo-600 mt-1">{matrix.avgDependents}</p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Primary Growth Driver Segment</span>
          <p className="text-3xl font-extrabold text-emerald-600 mt-1">26-35 Yrs</p>
        </div>
      </div>

      {/* Primary Demographic Layout Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        
        {/* Box 1: Gender split metrics */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <h3 className="text-sm font-bold uppercase text-gray-500 mb-4 border-b border-gray-100 pb-2">Gender Proportions</h3>
          <div className="space-y-4">
            {Object.entries(matrix.gender).map(([label, val]) => {
              const pct = totalClients ? ((val / totalClients) * 100).toFixed(1) : 0;
              return (
                <div key={label}>
                  <div className="flex justify-between text-xs font-medium mb-1">
                    <span className="text-gray-700">{label}</span>
                    <span className="text-gray-900 font-bold">{val} ({pct}%)</span>
                  </div>
                  <div className="w-full bg-gray-100 h-2 rounded-full">
                    <div className="bg-indigo-600 h-2 rounded-full" style={{ width: `${pct}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Box 2: Marital Matrix split */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <h3 className="text-sm font-bold uppercase text-gray-500 mb-4 border-b border-gray-100 pb-2">Marital Distribution</h3>
          <div className="space-y-4">
            {Object.entries(matrix.marital).map(([label, val]) => {
              const pct = totalClients ? ((val / totalClients) * 100).toFixed(1) : 0;
              return (
                <div key={label}>
                  <div className="flex justify-between text-xs font-medium mb-1">
                    <span className="text-gray-700">{label}</span>
                    <span className="text-gray-900 font-bold">{val} ({pct}%)</span>
                  </div>
                  <div className="w-full bg-gray-100 h-2 rounded-full">
                    <div className="bg-sky-500 h-2 rounded-full" style={{ width: `${pct}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Box 3: Age Categorization buckets */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <h3 className="text-sm font-bold uppercase text-gray-500 mb-4 border-b border-gray-100 pb-2">Age Classifications</h3>
          <div className="space-y-4">
            {Object.entries(matrix.ageGroups).map(([label, val]) => {
              const pct = totalClients ? ((val / totalClients) * 100).toFixed(1) : 0;
              return (
                <div key={label}>
                  <div className="flex justify-between text-xs font-medium mb-1">
                    <span className="text-gray-700">{label} Years</span>
                    <span className="text-gray-900 font-bold">{val} ({pct}%)</span>
                  </div>
                  <div className="w-full bg-gray-100 h-2 rounded-full">
                    <div className="bg-amber-500 h-2 rounded-full" style={{ width: `${pct}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* Regional Geographical Matrix (For Branch Expansion Assessment) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <h3 className="text-sm font-bold uppercase text-gray-500 mb-3 flex items-center space-x-1">
            <span>District Distribution Strategy</span>
          </h3>
          <div className="max-h-64 overflow-y-auto divide-y divide-gray-100 pr-2">
            {Object.entries(matrix.districts).map(([district, count]) => (
              <div key={district} className="flex justify-between items-center py-2.5 text-sm">
                <span className="text-gray-700 font-medium">{district}</span>
                <span className="bg-indigo-50 text-indigo-700 font-bold px-2.5 py-0.5 rounded-full text-xs">
                  {count} Active
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <h3 className="text-sm font-bold uppercase text-gray-500 mb-3">Town Concentrated Metrics</h3>
          <div className="max-h-64 overflow-y-auto divide-y divide-gray-100 pr-2">
            {Object.entries(matrix.towns).map(([town, count]) => (
              <div key={town} className="flex justify-between items-center py-2.5 text-sm">
                <span className="text-gray-700 font-medium">{town}</span>
                <span className="bg-emerald-50 text-emerald-700 font-bold px-2.5 py-0.5 rounded-full text-xs">
                  {count} Clients
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}