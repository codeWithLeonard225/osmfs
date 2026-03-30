"use client";

import React, { useState, useEffect } from "react";
import { db } from "@/app/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

export default function WeeklyCashCollection() {
  const [branchId, setBranchId] = useState("");
  const [weekStart, setWeekStart] = useState(""); // Monday of the week
  const [weekEnd, setWeekEnd] = useState("");     // Sunday of the week
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const keys = Object.keys(sessionStorage);
    keys.forEach(k => {
      try {
        const parsed = JSON.parse(sessionStorage.getItem(k));
        if (parsed?.branchId) setBranchId(parsed.branchId);
      } catch {}
    });
  }, []);

  const fetchData = async () => {
    if (!branchId || !weekStart || !weekEnd) return;
    setLoading(true);

    try {
      // Helper to fetch data within date range
      const fetchCollection = async (colName, dateField) => {
        const q = query(
          collection(db, colName),
          where("branchId", "==", branchId)
        );
        const snap = await getDocs(q);
        // Filter by date range manually
        return snap.docs
          .map(d => d.data())
          .filter(d => d[dateField] >= weekStart && d[dateField] <= weekEnd);
      };

      const payments = await fetchCollection("ACODApayment", "date");
      const loans = await fetchCollection("loans", "disbursementDate");

      const summary = {
        cashIn: { repayments:0, securityDeposited:0, admission:0, passbook:0, processing:0, fundsReceived:0 },
        cashOut: { disbursements:0, securityReturned:0, fundsTransfer:0, expenses:0 }
      };

      payments.forEach(p => {
        summary.cashIn.repayments += parseFloat(p.amountPaid || 0);
        summary.cashOut.securityReturned += parseFloat(p.securityReturned || 0);
        summary.cashIn.fundsReceived += parseFloat(p.fundsReceived || 0);
        summary.cashOut.fundsTransfer += parseFloat(p.fundsTransfer || 0);
        summary.cashOut.expenses += parseFloat(p.expenses || 0);
      });

      loans.forEach(l => {
        summary.cashIn.securityDeposited += parseFloat(l.cashSecurity || 0);
        summary.cashIn.admission += parseFloat(l.admissionFee || 0);
        summary.cashIn.passbook += parseFloat(l.passbookFee || 0);
        summary.cashIn.processing += parseFloat(l.loanProcessingFee || 0);
        summary.cashOut.disbursements += parseFloat(l.principal || 0);
      });

      setData(summary);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const totalIn = data ? Object.values(data.cashIn).reduce((a,b)=>a+b,0) : 0;
  const totalOut = data ? Object.values(data.cashOut).reduce((a,b)=>a+b,0) : 0;

  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      <div className="max-w-4xl mx-auto bg-white p-6 rounded-2xl shadow-sm mb-6">
        <h1 className="text-xl font-bold mb-4">Weekly Cash Collection</h1>
        <div className="flex gap-4 flex-col md:flex-row items-end">
          <input type="date" value={weekStart} onChange={e=>setWeekStart(e.target.value)} className="p-2 border rounded" placeholder="Week Start" />
          <input type="date" value={weekEnd} onChange={e=>setWeekEnd(e.target.value)} className="p-2 border rounded" placeholder="Week End" />
          <button onClick={fetchData} className="bg-indigo-600 text-white px-6 py-2 rounded">{loading?"Syncing...":"Generate"}</button>
        </div>
      </div>

      {data && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <CashCard title="Cash Inflow" data={data.cashIn} total={totalIn} />
          <CashCard title="Cash Outflow" data={data.cashOut} total={totalOut} />
          <div className="md:col-span-2 bg-slate-900 text-white p-6 rounded-2xl flex justify-between">
            <h2>Net Cash: {(totalIn-totalOut).toLocaleString()}</h2>
            <p>From {weekStart} to {weekEnd}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function CashCard({title, data, total}) {
  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border-t-4 border-indigo-500">
      <h3 className="uppercase font-bold text-xs mb-3">{title}</h3>
      {Object.keys(data).map((key,i)=>(
        <div key={i} className="flex justify-between mb-1 text-sm">
          <span className="text-gray-500">{key.replace(/([A-Z])/g, ' $1')}</span>
          <span className="font-mono">{data[key].toLocaleString()}</span>
        </div>
      ))}
      <div className="pt-2 border-t border-gray-100 flex justify-between font-bold">{total.toLocaleString()}</div>
    </div>
  );
}