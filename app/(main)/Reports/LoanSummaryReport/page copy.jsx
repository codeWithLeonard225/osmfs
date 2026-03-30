"use client";

import React, { useEffect, useState } from "react";
import { db } from "@/app/lib/firebase";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { FaHandHoldingUsd, FaUsers, FaLayerGroup, FaMoneyBillWave } from "react-icons/fa";

const Card = ({ title, value, icon }) => (
  <div className="bg-white shadow rounded-xl p-5 flex items-center justify-between border">
    <div>
      <p className="text-gray-500 text-sm">{title}</p>
      <h2 className="text-2xl font-bold text-indigo-900">{value}</h2>
    </div>
    <div className="text-indigo-600 text-3xl">{icon}</div>
  </div>
);

export default function LoanSummaryPage() {

  const [branchId, setBranchId] = useState("");
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const loansRef = collection(db, "loans");

  useEffect(() => {

    if (typeof window !== "undefined") {
      const keys = Object.keys(sessionStorage);
      let found = null;

      keys.forEach((key) => {
        const val = sessionStorage.getItem(key);
        if (val && val.includes("branchId")) {
          try {
            found = JSON.parse(val);
          } catch {}
        }
      });

      if (found) setBranchId(found.branchId);
    }

  }, []);

  useEffect(() => {

    if (!branchId) return;

    const q = query(loansRef, where("branchId", "==", branchId));

    const unsub = onSnapshot(q, (snapshot) => {

      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setLoans(data);
      setLoading(false);

    });

    return () => unsub();

  }, [branchId]);

  /* -------- SUMMARY CALCULATIONS -------- */

  const totalLoans = loans.length;

  const totalPrincipal = loans.reduce(
    (sum, loan) => sum + (loan.principal || 0),
    0
  );

  const uniqueClients = new Set(loans.map((l) => l.clientId)).size;

  const uniqueGroups = new Set(
    loans.filter((l) => l.groupId).map((l) => l.groupId)
  ).size;

  const thisMonthLoans = loans.filter((loan) => {
    const d = new Date(loan.disbursementDate);
    const now = new Date();

    return (
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear()
    );
  }).length;

 const filteredLoans = loans.filter((loan) => 
  (loan.clientName || "")
    .toLowerCase()
    .includes(searchTerm.toLowerCase())
);
  return (
    <div className="p-6 bg-gray-50 min-h-screen">

      <h1 className="text-2xl font-bold mb-6 text-indigo-900">
        Loan Portfolio Summary
      </h1>

      {/* SUMMARY CARDS */}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">

        <Card
          title="Total Loans"
          value={totalLoans}
          icon={<FaHandHoldingUsd />}
        />

        <Card
          title="Total Principal"
          value={`SLE ${totalPrincipal.toLocaleString()}`}
          icon={<FaMoneyBillWave />}
        />

        <Card
          title="Clients with Loans"
          value={uniqueClients}
          icon={<FaUsers />}
        />

        <Card
          title="Groups with Loans"
          value={uniqueGroups}
          icon={<FaLayerGroup />}
        />

        <Card
          title="Loans This Month"
          value={thisMonthLoans}
          icon={<FaHandHoldingUsd />}
        />

      </div>

      {/* LOAN TABLE */}

      <div className="bg-white rounded-xl shadow border overflow-x-auto">

        <div className="p-4 font-bold bg-indigo-900 text-white">
          Loan Portfolio
        </div>

        <div className="mb-4">
  <input
    type="text"
    placeholder="Search by client name..."
    value={searchTerm}
    onChange={(e) => setSearchTerm(e.target.value)}
    className="w-full md:w-96 p-2 border rounded-lg text-black bg-white focus:ring-2 focus:ring-indigo-500"
  />
</div>

        <table className="w-full text-sm">

        <thead className="bg-gray-100 text-gray-600 uppercase text-xs">
  <tr>
    <th className="p-3 text-left">Loan ID</th>
    <th className="p-3 text-left">Client</th>
    <th className="p-3 text-left">Principal</th>
    <th className="p-3 text-left">Interest %</th>
    <th className="p-3 text-left">Weeks</th>
    <th className="p-3 text-left">Group</th>
    <th className="p-3 text-left">Staff</th> {/* NEW */}
    <th className="p-3 text-left">Disbursement</th>
    <th className="p-3 text-left">Repayment Start</th>
  </tr>
</thead>

<tbody>
  {loading ? (
    <tr>
      <td colSpan="9" className="text-center p-6">
        Loading loans...
      </td>
    </tr>
  ) : (
    filteredLoans.map((loan) => (
      <tr key={loan.id} className="border-t hover:bg-gray-50">
        <td className="p-3 font-mono text-xs">{loan.loanId}</td>
        <td className="p-3 font-semibold">{loan.clientName}</td>
        <td className="p-3">SLE {loan.principal}</td>
        <td className="p-3">{loan.interestRate}%</td>
        <td className="p-3">{loan.paymentWeeks}</td>
        <td className="p-3">{loan.groupName || "Individual"}</td>
        <td className="p-3">{loan.staffName || "N/A"}</td> {/* NEW */}
        <td className="p-3 text-xs">{loan.disbursementDate}</td>
        <td className="p-3 text-xs">{loan.repaymentStartDate}</td>
      </tr>
    ))
  )}
</tbody>

        </table>

      </div>

    </div>
  );
}