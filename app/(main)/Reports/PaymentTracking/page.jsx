"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { db } from "@/app/lib/firebase";
import { collection, query, where, onSnapshot } from 'firebase/firestore';

export default function StaffPaymentLedger() {
  const [branchId, setBranchId] = useState('');
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const keys = Object.keys(sessionStorage);
    keys.forEach((k) => {
      try {
        const parsed = JSON.parse(sessionStorage.getItem(k));
        if (parsed?.branchId) setBranchId(String(parsed.branchId));
      } catch { }
    });
  }, []);

  useEffect(() => {
    if (!branchId) return;
    const q = query(collection(db, "ACODApayment"), where("branchId", "==", branchId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPayments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return () => unsubscribe();
  }, [branchId]);

  // THE ENGINE: Grouping by Staff first
  const staffGroups = useMemo(() => {
    const staffMap = {};

    payments.forEach(pay => {
      const staff = pay.staffName || "Unknown Staff";
      const groupKey = `${pay.date}_${pay.groupName}`;

      if (!staffMap[staff]) {
        staffMap[staff] = {
          name: staff,
          records: {}
        };
      }

      if (!staffMap[staff].records[groupKey]) {
        staffMap[staff].records[groupKey] = {
          date: pay.date,
          groupName: pay.groupName,
          count: 0,
          repaid: 0,
          security: 0
        };
      }

      const rec = staffMap[staff].records[groupKey];
      rec.count += 1;
      rec.repaid += parseFloat(pay.repaymentAmount || 0);
      rec.security += parseFloat(pay.securityCollected || 0);
    });

    // Convert into an array of staff, each with an array of sorted records
    return Object.values(staffMap).map(s => ({
      ...s,
      sortedRecords: Object.values(s.records).sort((a, b) => new Date(b.date) - new Date(a.date))
    }));
  }, [payments]);

  if (loading) return <div className="p-10 text-center font-bold">Loading Ledger...</div>;

  return (
    <div className="p-4 bg-gray-100 min-h-screen text-xs text-black font-sans">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-xl font-black mb-6 uppercase border-b-4 border-black pb-2">
          Staff Collection Summary
        </h1>

        {staffGroups.map((staff) => (
          <div key={staff.name} className="mb-10 bg-white shadow-md rounded-lg overflow-hidden">
            {/* Staff Header */}
            <div className="bg-gray-800 text-white p-3 flex justify-between items-center">
              <h2 className="text-lg font-bold uppercase tracking-widest">
                Staff Name: <span className="text-yellow-400">{staff.name}</span>
              </h2>
            </div>

            {/* Staff Table */}
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-200 text-[10px] uppercase text-gray-600 border-b">
                  <th className="p-3 text-left">Date</th>
                  <th className="p-3 text-left">Group Name</th>
                  <th className="p-3 text-center">Count</th>
                  <th className="p-3 text-right">Repaid (SLE)</th>
                  <th className="p-3 text-right">Security (SLE)</th>
                  <th className="p-3 text-right bg-gray-300 text-black">Sub-Total</th>
                </tr>
              </thead>
              <tbody>
                {staff.sortedRecords.map((rec, i) => (
                  <tr key={i} className="border-b hover:bg-gray-50">
                    <td className="p-3 font-medium">{rec.date}</td>
                    <td className="p-3 font-bold text-blue-700">{rec.groupName}</td>
                    <td className="p-3 text-center">
                      <span className="bg-blue-100 px-2 py-0.5 rounded-full font-bold">{rec.count}</span>
                    </td>
                    <td className="p-3 text-right font-semibold">{rec.repaid.toLocaleString()}</td>
                    <td className="p-3 text-right font-semibold">{rec.security.toLocaleString()}</td>
                    <td className="p-3 text-right font-black bg-gray-100">
                      {(rec.repaid + rec.security).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
              {/* Staff Footer Total */}
              <tfoot>
                <tr className="bg-gray-900 text-white">
                  <td colSpan="3" className="p-3 text-right font-bold uppercase">Total for {staff.name}</td>
                  <td className="p-3 text-right font-bold">
                    {staff.sortedRecords.reduce((a, b) => a + b.repaid, 0).toLocaleString()}
                  </td>
                  <td className="p-3 text-right font-bold">
                    {staff.sortedRecords.reduce((a, b) => a + b.security, 0).toLocaleString()}
                  </td>
                  <td className="p-3 text-right font-black text-yellow-400 text-sm">
                    {staff.sortedRecords.reduce((a, b) => a + (b.repaid + b.security), 0).toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}