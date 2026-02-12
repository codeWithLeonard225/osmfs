"use client";

import React, { useState, useEffect } from 'react';
import { db } from "@/app/lib/firebase";
import {
    collection,
    query,
    where,
    getDocs,
    doc,
    deleteDoc,
    updateDoc,
    increment
} from 'firebase/firestore';

export default function AdminPaymentManager() {
    const [branchId, setBranchId] = useState('');
    const [staffList, setStaffList] = useState([]);
    const [groupList, setGroupList] = useState([]);
    const [selectedStaff, setSelectedStaff] = useState('');
    const [selectedGroup, setSelectedGroup] = useState('');
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

    const [payments, setPayments] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    // 1. Recover Branch ID
    useEffect(() => {
        const keys = Object.keys(sessionStorage);
        keys.forEach((k) => {
            try {
                const parsed = JSON.parse(sessionStorage.getItem(k));
                if (parsed?.branchId) setBranchId(String(parsed.branchId));
            } catch { }
        });
    }, []);

    // 2. Fetch unique Staff and Groups for filters
    useEffect(() => {
        if (!branchId) return;
        const fetchFilters = async () => {
            const q = query(collection(db, "ACODApayment"), where("branchId", "==", branchId));
            const snap = await getDocs(q);
            const data = snap.docs.map(d => d.data());
            
            setStaffList([...new Set(data.map(item => item.staffName))].filter(Boolean));
            setGroupList([...new Set(data.map(item => item.groupName))].filter(Boolean));
        };
        fetchFilters();
    }, [branchId]);

    // 3. FETCH: Filtered Payments
    const fetchPayments = async () => {
        if (!branchId) return;
        setIsLoading(true);
        try {
            let q = query(collection(db, "ACODApayment"), 
                where("branchId", "==", branchId),
                where("date", "==", date)
            );

            if (selectedStaff) q = query(q, where("staffName", "==", selectedStaff));
            if (selectedGroup) q = query(q, where("groupName", "==", selectedGroup));

            const snap = await getDocs(q);
            setPayments(snap.docs.map(d => ({ docId: d.id, ...d.data() })));
        } catch (err) {
            alert("Fetch Error: " + err.message);
        } finally {
            setIsLoading(false);
        }
    };

    // 4. DELETE: Revert security and remove payment record
   

const handleDelete = async (payRecord) => {
  if (isDeleting) return;
  if (!confirm(`Are you sure you want to DELETE this record for ${payRecord.clientName}?`)) return;

  setIsDeleting(true);
  try {
    await deleteDoc(doc(db, "ACODApayment", payRecord.docId));
    setPayments(prev => prev.filter(p => p.docId !== payRecord.docId));
    alert("Record deleted successfully ✅");
  } catch (e) {
    alert("Delete failed: " + e.message);
  } finally {
    setIsDeleting(false);
  }
};


    return (
        <div className="p-4 bg-gray-100 min-h-screen text-xs text-black">
            <div className="max-w-[1200px] mx-auto bg-white p-6 rounded shadow">
                <h1 className="text-xl font-bold mb-6 border-b pb-2 uppercase text-red-600">Admin Payment Deletion</h1>

                {/* Filter Header */}
                <div className="flex flex-wrap gap-4 mb-6 items-end bg-gray-50 p-4 rounded border">
                    <div className="flex flex-col">
                        <label className="font-bold mb-1">Date</label>
                        <input type="date" className="border p-2 rounded w-40" value={date} onChange={e => setDate(e.target.value)} />
                    </div>
                    <div className="flex flex-col">
                        <label className="font-bold mb-1">Staff</label>
                        <select className="border p-2 rounded w-44" value={selectedStaff} onChange={e => setSelectedStaff(e.target.value)}>
                            <option value="">All Staff</option>
                            {staffList.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                    <div className="flex flex-col">
                        <label className="font-bold mb-1">Group</label>
                        <select className="border p-2 rounded w-44" value={selectedGroup} onChange={e => setSelectedGroup(e.target.value)}>
                            <option value="">All Groups</option>
                            {groupList.map(g => <option key={g} value={g}>{g}</option>)}
                        </select>
                    </div>
                    <button onClick={fetchPayments} className="bg-blue-600 text-white px-6 py-2 rounded font-bold hover:bg-blue-700 h-10 transition-colors">
                        {isLoading ? "Searching..." : "Filter Payments"}
                    </button>
                </div>

                {/* Results Table */}
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-gray-300">
                        <thead className="bg-gray-800 text-white uppercase">
                            <tr>
                                <th className="border p-2 text-left">Client & ID</th>
                                <th className="border p-2">Group</th>
                                <th className="border p-2 text-center bg-orange-700">Security Saved</th>
                                <th className="border p-2 text-center bg-green-700">Repayment</th>
                                <th className="border p-2 bg-red-800">Danger Zone</th>
                            </tr>
                        </thead>
                        <tbody>
                            {payments.map(p => (
                                <tr key={p.docId} className="hover:bg-red-50 border-b">
                                    <td className="border p-2 font-bold">{p.clientName} <span className="text-gray-400 block font-normal">#{p.loanId}</span></td>
                                    <td className="border p-2 text-center">{p.groupName}</td>
                                    <td className="border p-2 text-center font-black text-orange-600 italic">SLE {p.securityCollected}</td>
                                    <td className="border p-2 text-center font-black text-green-700">SLE {p.repaymentAmount}</td>
                                    <td className="border p-2 text-center">
                                        <button 
                                            onClick={() => handleDelete(p)} 
                                            className="bg-red-600 text-white px-4 py-1 rounded font-bold hover:bg-red-800 transition-all"
                                        >
                                            DELETE
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {!isLoading && payments.length === 0 && (
                        <div className="p-10 text-center text-gray-400 italic">No payment records match these filters.</div>
                    )}
                </div>
            </div>
        </div>
    );
}