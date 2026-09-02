"use client";

import React, { useState, useEffect } from 'react';
import { db } from '@/app/lib/firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { 
  FaUsers, FaBriefcase, FaUniversity, FaShieldAlt, 
  FaChartBar, FaDownload, FaSyncAlt, FaMapMarkerAlt 
} from 'react-icons/fa';

export default function LoanReportsDashboard() {
  const [loansData, setLoansData] = useState([]);
  const [currentBranchId, setCurrentBranchId] = useState('');
  const [activeTab, setActiveTab] = useState('demographics');
  const [loading, setLoading] = useState(true);

  // 1. Resolve Branch Session
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedBranch = sessionStorage.getItem('branchId') || '';
      setCurrentBranchId(storedBranch);
    }
  }, []);

  // 2. Real-time Stream matching current Branch
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
      setLoansData(records);
      setLoading(false);
    }, (error) => {
      console.error("Report Stream Failure:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentBranchId]);

  // ==========================================
  // AGGREGATION & METRIC LOGIC
  // ==========================================
  const totalApplications = loansData.length;

  // Report 1: Demographics Analytics
  const getDemographicMetrics = () => {
    const districts = {};
    const gender = { Male: 0, Female: 0, Unspecified: 0 };
    let totalDependents = 0;

    loansData.forEach(loan => {
      // District aggregation
      const dist = loan.district || 'Unassigned';
      districts[dist] = (districts[dist] || 0) + 1;
      
      // Gender aggregation
      if (loan.gender?.toLowerCase() === 'male') gender.Male++;
      else if (loan.gender?.toLowerCase() === 'female') gender.Female++;
      else gender.Unspecified++;

      // Dependents
      totalDependents += (parseInt(loan.dependentsCount, 10) || 0);
    });

    const avgDependents = totalApplications ? (totalDependents / totalApplications).toFixed(1) : 0;

    return { districts, gender, avgDependents };
  };

  // Report 2: Business & Economic Performance
  const getBusinessMetrics = () => {
    let totalRevenue = 0;
    let totalEmployees = 0;
    const ownershipTypes = {};
    let registeredCount = 0;

    loansData.forEach(loan => {
      const biz = loan.businessDetails || {};
      totalRevenue += (parseFloat(biz.annualRevenue) || 0);
      totalEmployees += (parseInt(biz.employeeCount, 10) || 0);
      
      const type = biz.ownershipType || 'Unspecified';
      ownershipTypes[type] = (ownershipTypes[type] || 0) + 1;

      if (biz.tinNumber) registeredCount++;
    });

    const avgRevenue = totalApplications ? (totalRevenue / totalApplications).toFixed(2) : 0;

    return { totalRevenue, totalEmployees, ownershipTypes, registeredCount, avgRevenue };
  };

  // Report 3: Bank Relationship Mapping
  const getBankMetrics = () => {
    const banks = {};
    let totalAvgBalance = 0;
    const accounts = { Savings: 0, Current: 0, Other: 0 };

    loansData.forEach(loan => {
      const bank = loan.bankRelationship || {};
      const name = bank.bankName || 'Unbanked / None';
      banks[name] = (banks[name] || 0) + 1;

      totalAvgBalance += (parseFloat(bank.avgBalance) || 0);

      const accType = bank.accountType?.toLowerCase() || '';
      if (accType.includes('savings')) accounts.Savings++;
      else if (accType.includes('current')) accounts.Current++;
      else accounts.Other++;
    });

    return { banks, totalAvgBalance, accounts };
  };

  // Report 4: Risk & Household Exposure
  const getRiskMetrics = () => {
    let missingNok = 0;
    let marriedWithSpouseData = 0;
    let marriedTotal = 0;

    loansData.forEach(loan => {
      if (!loan.nextOfKin?.name) missingNok++;
      
      if (loan.maritalStatus?.toLowerCase() === 'married') {
        marriedTotal++;
        if (loan.spouseInfo?.fullName) marriedWithSpouseData++;
      }
    });

    return { missingNok, marriedWithSpouseData, marriedTotal };
  };

  const demo = getDemographicMetrics();
  const biz = getBusinessMetrics();
  const bank = getBankMetrics();
  const risk = getRiskMetrics();

  // ==========================================
  // EXPORT ENGINE (CSV Generation)
  // ==========================================
  const handleExportCSV = () => {
    if (loansData.length === 0) return alert("No data available to export.");

    const headers = ["Client ID", "Full Name", "Phone", "District", "Business Name", "Annual Revenue", "Bank", "Avg Balance"];
    const rows = loansData.map(loan => [
      loan.clientId || '',
      loan.personFullName || '',
      loan.telephone || '',
      loan.district || '',
      loan.businessDetails?.businessName || '',
      loan.businessDetails?.annualRevenue || 0,
      loan.bankRelationship?.bankName || '',
      loan.bankRelationship?.avgBalance || 0
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Branch_${currentBranchId || 'All'}_Metric_Report.csv`);
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
      {/* Upper Navigation / Control Bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center space-x-2">
            <FaChartBar className="text-indigo-600" />
            <span>Branch Portfolio Registry Analytics</span>
          </h1>
          <p className="text-sm text-gray-500 mt-1 flex items-center">
            <FaMapMarkerAlt className="mr-1 text-gray-400" /> 
            Active Context ID: <span className="font-semibold text-gray-700 ml-1">{currentBranchId || "None (Global Restructured Overview)"}</span>
          </p>
        </div>
        <button
          onClick={handleExportCSV}
          className="mt-4 md:mt-0 inline-flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-sm"
        >
          <FaDownload />
          <span>Export Master CSV</span>
        </button>
      </div>

      {/* Main Aggregation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Total Active Registries</p>
          <p className="text-3xl font-bold mt-1 text-indigo-600">{totalApplications}</p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Aggregate Micro-Capital Revenue</p>
          <p className="text-3xl font-bold mt-1 text-emerald-600">Le {biz.totalRevenue.toLocaleString()}</p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Formal Labor Footprint</p>
          <p className="text-3xl font-bold mt-1 text-blue-600">{biz.totalEmployees} Employees</p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Avg Household Size</p>
          <p className="text-3xl font-bold mt-1 text-amber-600">{demo.avgDependents} Dependents</p>
        </div>
      </div>

      {/* Tab Switcher Grid */}
      <div className="flex border-b border-gray-200 space-x-4 mb-6 overflow-x-auto">
        {[
          { id: 'demographics', label: '1. Demographics & Context', icon: FaUsers },
          { id: 'business', label: '2. Business Analytics', icon: FaBriefcase },
          { id: 'banking', label: '3. Bank Footprint', icon: FaUniversity },
          { id: 'risk', label: '4. Household Risk & Data Integrity', icon: FaShieldAlt }
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-2 py-3 px-4 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Icon />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Report Segment Windows */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        
        {/* REPORT 1: DEMOGRAPHICS */}
        {activeTab === 'demographics' && (
          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-4">Demographics & Client Distribution</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h4 className="text-sm font-semibold text-gray-500 uppercase mb-3">Concentration by District</h4>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                  {Object.entries(demo.districts).map(([name, count]) => (
                    <div key={name} className="flex justify-between items-center text-sm p-2 bg-gray-50 rounded border border-gray-100">
                      <span className="font-medium text-gray-700">{name}</span>
                      <span className="bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full font-bold">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-gray-500 uppercase mb-3">Gender Profiling</h4>
                <div className="space-y-3">
                  {Object.entries(demo.gender).map(([gender, count]) => (
                    <div key={gender}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600 font-medium">{gender}</span>
                        <span className="text-gray-900 font-bold">{count}</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div 
                          className="bg-indigo-600 h-2 rounded-full" 
                          style={{ width: `${totalApplications ? (count / totalApplications) * 100 : 0}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* REPORT 2: BUSINESS PROFILE */}
        {activeTab === 'business' && (
          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-4">Business & Economic Performance Report</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                <span className="text-xs text-gray-400 font-bold block uppercase">Avg Annual Revenue</span>
                <span className="text-xl font-bold text-gray-800">Le {parseFloat(biz.avgRevenue).toLocaleString()}</span>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                <span className="text-xs text-gray-400 font-bold block uppercase">Tax Registration Coverage</span>
                <span className="text-xl font-bold text-gray-800">{biz.registeredCount} / {totalApplications} with TIN</span>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                <span className="text-xs text-gray-400 font-bold block uppercase">Formal Tax Ratio</span>
                <span className="text-xl font-bold text-gray-800">
                  {totalApplications ? ((biz.registeredCount / totalApplications) * 100).toFixed(0) : 0}%
                </span>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-500 uppercase mb-3">Borrowing Entity Legal Structures</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(biz.ownershipTypes).map(([type, count]) => (
                  <div key={type} className="p-3 bg-white border border-gray-200 rounded-lg text-center">
                    <span className="text-xs text-gray-400 block truncate">{type}</span>
                    <span className="text-xl font-extrabold text-gray-800">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* REPORT 3: BANK FOOTPRINT */}
        {activeTab === 'banking' && (
          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-4">Financial Health & Commercial Banking Infrastructure</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h4 className="text-sm font-semibold text-gray-500 uppercase mb-3">Market Share (Cleared Applicant Bank Choice)</h4>
                <div className="space-y-2">
                  {Object.entries(bank.banks).map(([bankName, count]) => (
                    <div key={bankName} className="flex justify-between items-center text-sm p-2 bg-gray-50 rounded">
                      <span className="text-gray-700 font-medium">{bankName}</span>
                      <span className="text-gray-900 font-bold">{count} clients</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-gray-500 uppercase mb-3">Account Variety Split</h4>
                <div className="space-y-4">
                  {Object.entries(bank.accounts).map(([type, count]) => (
                    <div key={type} className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-600">{type} Accounts</span>
                      <span className="text-sm font-bold text-gray-900">{count}</span>
                    </div>
                  ))}
                  <hr className="border-gray-100" />
                  <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-100">
                    <span className="text-xs text-emerald-600 font-bold block uppercase tracking-wider">Total Branch Liquidity Threshold</span>
                    <span className="text-2xl font-bold text-emerald-800">Le {bank.totalAvgBalance.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* REPORT 4: RISK & DATA INTEGRITY */}
        {activeTab === 'risk' && (
          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-4">Operational Risk Controls & Exposure</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl">
                <h4 className="text-orange-800 font-bold text-sm uppercase tracking-wide">Next of Kin Missing (Collections Risk)</h4>
                <p className="text-xs text-orange-600 mt-1">Clients registered without emergency alternative contact points.</p>
                <p className="text-4xl font-extrabold text-orange-900 mt-2">{risk.missingNok}</p>
              </div>

              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <h4 className="text-blue-800 font-bold text-sm uppercase tracking-wide">Spouse Co-Signer Coverage Index</h4>
                <p className="text-xs text-blue-600 mt-1">Married applicants who completed secondary dynamic spouse verification records.</p>
                <p className="text-4xl font-extrabold text-blue-900 mt-2">
                  {risk.marriedWithSpouseData} <span className="text-lg font-normal text-blue-500">of {risk.marriedTotal} Married</span>
                </p>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}