"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { db } from "@/app/lib/firebase";
import { collection, query, where, onSnapshot } from 'firebase/firestore';

export default function DeepPaymentLedger() {
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

  // THE ENGINE: Nested Grouping (Staff -> Group -> Date)
  const nestedData = useMemo(() => {
    const staffMap = {};

    payments.forEach(pay => {
      const staff = pay.staffName || "Unknown Staff";
      const group = pay.groupName || "No Group";
      const date = pay.date;

      if (!staffMap[staff]) {
        staffMap[staff] = { name: staff, groups: {} };
      }

      if (!staffMap[staff].groups[group]) {
        staffMap[staff].groups[group] = { name: group, dailyRecords: {} };
      }

      if (!staffMap[staff].groups[group].dailyRecords[date]) {
        staffMap[staff].groups[group].dailyRecords[date] = {
          date: date,
          count: 0,
          repaid: 0,
          security: 0
        };
      }

      const entry = staffMap[staff].groups[group].dailyRecords[date];
      entry.count += 1;
      entry.repaid += parseFloat(pay.repaymentAmount || 0);
      entry.security += parseFloat(pay.securityCollected || 0);
    });

    // Convert objects to sorted arrays for rendering
    return Object.values(staffMap).map(s => ({
      ...s,
      groupList: Object.values(s.groups).map(g => ({
        ...g,
        sortedHistory: Object.values(g.dailyRecords).sort((a, b) => new Date(b.date) - new Date(a.date))
      }))
    }));
  }, [payments]);

  if (loading) return <div className="p-10 text-center font-bold">Loading Detailed Ledger...</div>;

  return (
    <div className="p-4 bg-gray-50 min-h-screen text-[11px] text-black font-sans">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-black mb-8 uppercase border-b-8 border-gray-900 pb-2 italic">
          Master Collection Analysis
        </h1>

        {nestedData.map((staff) => (
          <div key={staff.name} className="mb-16">
            {/* STAFF LEVEL HEADER */}
            <div className="bg-gray-900 text-white p-4 rounded-t-xl flex justify-between items-center shadow-lg">
              <span className="text-xs uppercase tracking-widest opacity-70">Field Staff</span>
              <h2 className="text-xl font-black uppercase text-yellow-400">{staff.name}</h2>
            </div>

            <div className="bg-white border-x border-b border-gray-300 rounded-b-xl p-4 shadow-sm">
              {staff.groupList.map((group) => (
                <div key={group.name} className="mb-8 last:mb-0">
                  {/* GROUP LEVEL HEADER */}
                  <div className="flex items-center gap-2 mb-2 border-l-4 border-blue-600 pl-3">
                    <span className="font-bold text-gray-500 uppercase text-[10px]">Group:</span>
                    <h3 className="text-sm font-black text-blue-800 uppercase">{group.name}</h3>
                  </div>

                  {/* COLLECTION TABLE */}
                  <table className="w-full border border-gray-200 rounded overflow-hidden">
                    <thead>
                      <tr className="bg-gray-100 text-gray-600 uppercase text-[9px]">
                        <th className="p-2 text-left border-b">Collection Date</th>
                        <th className="p-2 text-center border-b">Client Count</th>
                        <th className="p-2 text-right border-b">Repaid (SLE)</th>
                        <th className="p-2 text-right border-b">Security (SLE)</th>
                        <th className="p-2 text-right border-b bg-gray-800 text-white w-32">Sub-Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.sortedHistory.map((rec, idx) => (
                        <tr key={idx} className="border-b hover:bg-blue-50 transition-colors">
                          <td className="p-2 font-bold">{rec.date}</td>
                          <td className="p-2 text-center">
                            <span className="bg-blue-100 text-blue-700 px-2 rounded-full font-bold">
                              {rec.count}
                            </span>
                          </td>
                          <td className="p-2 text-right font-medium">{rec.repaid.toLocaleString()}</td>
                          <td className="p-2 text-right font-medium text-orange-700">{rec.security.toLocaleString()}</td>
                          <td className="p-2 text-right font-black bg-gray-50">
                            {(rec.repaid + rec.security).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    {/* GROUP SUMMARY ROW */}
                    <tfoot>
                      <tr className="bg-blue-50 font-bold">
                        <td colSpan="2" className="p-2 text-right text-blue-900 uppercase text-[10px]">Group Total:</td>
                        <td className="p-2 text-right text-blue-900">
                          {group.sortedHistory.reduce((a, b) => a + b.repaid, 0).toLocaleString()}
                        </td>
                        <td className="p-2 text-right text-blue-900">
                          {group.sortedHistory.reduce((a, b) => a + b.security, 0).toLocaleString()}
                        </td>
                        <td className="p-2 text-right bg-blue-600 text-white font-black">
                          {group.sortedHistory.reduce((a, b) => a + (b.repaid + b.security), 0).toLocaleString()}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}