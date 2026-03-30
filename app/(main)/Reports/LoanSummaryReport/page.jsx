"use client";

import React, { useEffect, useState } from "react";
import { db } from "@/app/lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";

export default function DailyLoanReport() {
  const [branchId, setBranchId] = useState("");
  const [loanList, setLoanList] = useState([]);
  const [loading, setLoading] = useState(true);

  const loansRef = collection(db, "loans");

  /* -------- GET BRANCH FROM SESSION -------- */
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

  /* -------- FETCH LOANS -------- */
  useEffect(() => {
    if (!branchId) return;

    const q = query(loansRef, where("branchId", "==", branchId));

    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setLoanList(data);
      setLoading(false);
    });

    return () => unsub();
  }, [branchId]);

  /* -------- GROUP DATA -------- */
  const groupedReport = {};

  loanList.forEach((loan) => {
    const date = loan.disbursementDate || "No Date";
    const staff = loan.staffName || "Unknown Staff";
    const group = loan.groupName || "Individual";

    if (!groupedReport[date]) groupedReport[date] = {};
    if (!groupedReport[date][staff]) groupedReport[date][staff] = {};
    if (!groupedReport[date][staff][group])
      groupedReport[date][staff][group] = [];

    groupedReport[date][staff][group].push(loan);
  });

  /* -------- SORT DATES (LATEST FIRST) -------- */
  const sortedDates = Object.keys(groupedReport).sort(
    (a, b) => new Date(b) - new Date(a)
  );

  return (
    <div className="p-6 bg-gray-100 min-h-screen text-sm">
      <div className="max-w-7xl mx-auto bg-white p-6 rounded shadow">
        <h2 className="text-xl font-bold mb-6 text-indigo-900">
          Daily Loan Report
        </h2>

        {loading ? (
          <p className="text-center py-6">Loading report...</p>
        ) : sortedDates.length === 0 ? (
          <p className="text-center py-6">No data available</p>
        ) : (
          sortedDates.map((date) => (
            <div key={date} className="mb-10 border-b pb-6">
              {/* DATE */}
              <h3 className="text-lg font-bold text-blue-800 mb-4 border-l-4 border-blue-800 pl-3">
                Date: {date}
              </h3>

              {Object.entries(groupedReport[date]).map(([staff, groupData]) => (
                <div key={staff} className="ml-4 mb-6">
                  {/* STAFF */}
                  <h4 className="font-semibold text-indigo-700 mb-3">
                    Staff: {staff}
                  </h4>

                  {Object.entries(groupData).map(([group, loans]) => {
                    // --- CALCULATE FOOTER TOTALS FOR THIS GROUP ---
                    const totalPrincipal = loans.reduce((acc, l) => acc + (Number(l.principal) || 0), 0);
                    const totalSecurity = loans.reduce((acc, l) => acc + (Number(l.cashSecurity) || 0), 0);
                    const totalAdmission = loans.reduce((acc, l) => acc + (Number(l.admissionFee) || 0), 0);
                    const totalPassbook = loans.reduce((acc, l) => acc + (Number(l.passbookFee) || 0), 0);
                    const totalProcessing = loans.reduce((acc, l) => acc + (Number(l.loanProcessingFee) || 0), 0);

                    return (
                      <div key={group} className="ml-6 mb-8">
                        {/* GROUP */}
                        <h5 className="font-medium text-gray-700 mb-2 italic">
                          Group: {group}
                        </h5>

                        <div className="overflow-x-auto shadow-sm">
                          <table className="w-full border-collapse border border-gray-300 text-xs">
                            <thead className="bg-gray-800 text-white">
                              <tr>
                                <th className="border border-gray-300 p-2">Client ID</th>
                                <th className="border border-gray-300 p-2 text-left">Client Name</th>
                                <th className="border border-gray-300 p-2">Loan ID</th>
                                <th className="border border-gray-300 p-2">Int %</th>
                                <th className="border border-gray-300 p-2 text-right">Principal</th>
                                <th className="border border-gray-300 p-2 text-right">Security</th>
                                <th className="border border-gray-300 p-2 text-right">Admission</th>
                                <th className="border border-gray-300 p-2 text-right">Passbook</th>
                                <th className="border border-gray-300 p-2 text-right">Processing</th>
                              </tr>
                            </thead>

                            <tbody>
                              {loans.map((loan, i) => (
                                <tr key={i} className="hover:bg-gray-50 transition-colors">
                                  <td className="border border-gray-300 p-2 text-center">{loan.clientId}</td>
                                  <td className="border border-gray-300 p-2 font-semibold uppercase">{loan.clientName}</td>
                                  <td className="border border-gray-300 p-2 text-center text-[10px]">{loan.loanId}</td>
                                  <td className="border border-gray-300 p-2 text-center">{loan.interestRate}</td>
                                  <td className="border border-gray-300 p-2 text-right">{(Number(loan.principal) || 0).toLocaleString()}</td>
                                  <td className="border border-gray-300 p-2 text-right">{(Number(loan.cashSecurity) || 0).toLocaleString()}</td>
                                  <td className="border border-gray-300 p-2 text-right">{(Number(loan.admissionFee) || 0).toLocaleString()}</td>
                                  <td className="border border-gray-300 p-2 text-right">{(Number(loan.passbookFee) || 0).toLocaleString()}</td>
                                  <td className="border border-gray-300 p-2 text-right">{(Number(loan.loanProcessingFee) || 0).toLocaleString()}</td>
                                </tr>
                              ))}
                            </tbody>

                            {/* --- FOOTER TOTALS --- */}
                            <tfoot className="bg-indigo-50 font-bold text-indigo-900 border-t-2 border-indigo-200">
                              <tr>
                                <td colSpan={4} className="border border-gray-300 p-2 text-right uppercase tracking-wider">
                                  Total for {group}:
                                </td>
                                <td className="border border-gray-300 p-2 text-right">
                                  {totalPrincipal.toLocaleString()}
                                </td>
                                <td className="border border-gray-300 p-2 text-right">
                                  {totalSecurity.toLocaleString()}
                                </td>
                                <td className="border border-gray-300 p-2 text-right">
                                  {totalAdmission.toLocaleString()}
                                </td>
                                <td className="border border-gray-300 p-2 text-right">
                                  {totalPassbook.toLocaleString()}
                                </td>
                                <td className="border border-gray-300 p-2 text-right">
                                  {totalProcessing.toLocaleString()}
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}