"use client";

import React, { useState, useEffect } from "react";
import { db } from "@/app/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

export default function LoanPaymentReportTwo() {

    const [branchId, setBranchId] = useState("");
    const [report, setReport] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const keys = Object.keys(sessionStorage);
        keys.forEach(k => {
            try {
                const parsed = JSON.parse(sessionStorage.getItem(k));
                if (parsed?.branchId) setBranchId(parsed.branchId);
            } catch { }
        });
    }, []);

    const generateReport = async () => {
        if (!branchId) return;

        setLoading(true);

        try {

            const q = query(
                collection(db, "ACODApayment"),
                where("branchId", "==", branchId)
            );

            const snap = await getDocs(q);

            const payments = snap.docs.map(doc => doc.data());

            const grouped = {};

            payments.forEach(p => {

                const date = p.date;

                if (!grouped[date]) {
                    grouped[date] = {
                        date,
                        securitySaved: 0,
                        totalPaid: 0
                    };
                }

                grouped[date].securitySaved += parseFloat(p.securityCollected || 0);
                grouped[date].totalPaid += parseFloat(p.repaymentAmount || 0);

            });

            const sorted = Object.values(grouped)
                .sort((a, b) => new Date(b.date) - new Date(a.date));

            setReport(sorted);

        } catch (err) {
            console.error(err);
        }

        setLoading(false);
    };

    const totalSecurity = report.reduce(
        (sum, r) => sum + r.securitySaved,
        0
    );

    const totalPaid = report.reduce(
        (sum, r) => sum + r.totalPaid,
        0
    );

    return (
        <div className="p-6 bg-gray-100 min-h-screen">

            <div className="max-w-5xl mx-auto bg-white p-6 rounded shadow">

                <div className="flex justify-between mb-6">

                    <h1 className="text-xl font-bold">
                        Loan Payment Daily Summary
                    </h1>

                    <button
                        onClick={generateReport}
                        className="bg-blue-600 text-white px-6 py-2 rounded"
                    >
                        {loading ? "Loading..." : "Generate Report"}
                    </button>

                </div>

                <table className="w-full border text-sm">

                    <thead className="bg-gray-800 text-white">

                        <tr>
                            <th className="p-3 border">Day</th>
                            <th className="p-3 border">Date</th>
                            <th className="p-3 border">Cash Security Saved</th>
                            <th className="p-3 border">Total Paid</th>
                        </tr>

                    </thead>

                    <tbody>

                        {report.map((r, i) => {

                            const d = new Date(r.date);

                            const day = d.toLocaleDateString(
                                "en-US",
                                { weekday: "long" }
                            );

                            return (

                                <tr key={i} className="border-b">

                                    <td className="p-2 border">{day}</td>

                                    <td className="p-2 border">
                                        {d.toLocaleDateString()}
                                    </td>

                                    <td className="p-2 border text-right">
                                        {r.securitySaved.toLocaleString()}
                                    </td>

                                    <td className="p-2 border text-right font-bold text-green-700">
                                        {r.totalPaid.toLocaleString()}
                                    </td>

                                </tr>

                            )

                        })}

                    </tbody>
                    <tfoot className="bg-gray-900 text-white font-bold">
                        <tr>
                            <td className="p-3 border text-right" colSpan="2">
                                TOTAL
                            </td>

                            <td className="p-3 border text-right text-orange-300">
                                {totalSecurity.toLocaleString()}
                            </td>

                            <td className="p-3 border text-right text-green-400 text-lg">
                                {totalPaid.toLocaleString()}
                            </td>

                        </tr>
                    </tfoot>

                </table>

            </div>

        </div>
    );
}