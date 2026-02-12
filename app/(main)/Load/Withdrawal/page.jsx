"use client";

import { useState, useEffect } from "react";
import { FaEdit, FaTrash } from "react-icons/fa";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  getDocs,
  where,
} from "firebase/firestore";
import { db } from "@/app/lib/firebase";

/* ---------------- REUSABLE UI ---------------- */
const Input = ({ id, label, type = "text", value, onChange, placeholder, readOnly = false, disabled = false, error = false, helpText = "" }) => (
  <div className="flex flex-col space-y-1">
    <label htmlFor={id} className="text-sm font-medium text-gray-700">{label}</label>
    <input
      id={id}
      type={type}
      value={value}
      onChange={onChange}
      readOnly={readOnly}
      disabled={disabled}
      placeholder={placeholder}
      className={`w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 text-black bg-white ${
        error ? "border-red-500" : "border-gray-300"
      } ${disabled || readOnly ? "bg-gray-100 cursor-not-allowed" : ""}`}
    />
    {helpText && <p className={`text-xs ${error ? "text-red-500" : "text-gray-500"}`}>{helpText}</p>}
  </div>
);

const Button = ({ onClick, children, className = "", type = "button", disabled = false }) => (
  <button
    type={type}
    onClick={onClick}
    disabled={disabled}
    className={`px-4 py-2 rounded-md text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition ${disabled ? "opacity-50 cursor-not-allowed" : ""} ${className}`}
  >
    {children}
  </button>
);

const Modal = ({ show, onClose, children }) => {
  if (!show) return null;
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-sm relative">
        <button onClick={onClose} className="absolute top-2 right-3 text-2xl text-gray-500">&times;</button>
        {children}
      </div>
    </div>
  );
};

/* ---------------- MAIN PAGE ---------------- */
export default function WithdrawalPage() {
  const [branchId, setBranchId] = useState("");
  const [branchIdError, setBranchIdError] = useState("");

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [clientId, setClientId] = useState("");
  const [clientName, setClientName] = useState("");
  const [amount, setAmount] = useState("");

  const [withdrawalsList, setWithdrawalsList] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  const [isSaving, setIsSaving] = useState(false);
  const [clientLoading, setClientLoading] = useState(false);
  const [message, setMessage] = useState("");

  const [showDelete, setShowDelete] = useState(false);
  const [deleteId, setDeleteId] = useState("");
  const [deletePassword, setDeletePassword] = useState("");

  const ADMIN_PASSWORD = "1234";

  /* 1. SESSION RECOVERY */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const keys = Object.keys(sessionStorage);
    let found = null;
    keys.forEach((k) => {
      const val = sessionStorage.getItem(k);
      if (val && val.includes("branchId")) {
        try { found = JSON.parse(val); } catch {}
      }
    });
    if (found?.branchId) setBranchId(found.branchId);
    else setBranchIdError("Branch ID not found. Please log in.");
  }, []);

  /* 2. AUTO-FETCH CLIENT NAME */
  useEffect(() => {
    if (clientId.length < 3 || !branchId) {
      if (clientId.length === 0) setClientName(""); 
      return;
    }

    setClientLoading(true);
    const clientsRef = collection(db, "clients");
    const q = query(
      clientsRef, 
      where('clientId', '==', clientId), 
      where('branchId', '==', branchId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const data = snapshot.docs[0].data();
        setClientName(data.fullName || "Unknown Client");
      } else {
        setClientName(""); 
      }
      setClientLoading(false);
    });

    return () => unsubscribe();
  }, [clientId, branchId]);

  /* 3. FETCH WITHDRAWAL RECORDS */
  useEffect(() => {
    if (!branchId) return;
    const q = query(collection(db, "withdrawals"), where("branchId", "==", branchId));
    const unsub = onSnapshot(q, (snap) => {
      setWithdrawalsList(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [branchId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!clientId || !clientName || !amount) {
      setMessage("Please ensure Client ID is valid and amount is entered");
      return;
    }

    setIsSaving(true);
    const data = {
      date,
      clientId,
      clientName,
      amount: Number(amount) || 0,
      branchId,
      updatedAt: serverTimestamp(),
    };

    try {
      if (editingId) {
        await updateDoc(doc(db, "withdrawals", editingId), data);
        setMessage("Withdrawal updated successfully ✅");
      } else {
        await addDoc(collection(db, "withdrawals"), { ...data, createdAt: serverTimestamp() });
        setMessage("Withdrawal saved successfully ✨");
      }
      clearForm();
    } catch (err) {
      setMessage("Error saving withdrawal record");
    } finally {
      setIsSaving(false);
    }
  };

  const clearForm = () => {
    setEditingId(null);
    setClientId("");
    setClientName("");
    setAmount("");
  };

  const confirmDelete = async () => {
    if (deletePassword !== ADMIN_PASSWORD) {
      setMessage("Wrong admin password");
      return;
    }
    await deleteDoc(doc(db, "withdrawals", deleteId));
    setShowDelete(false);
    setDeletePassword("");
    setMessage("Deleted successfully 🗑️");
  };

  const filtered = withdrawalsList.filter(w =>
    w.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    w.clientId?.includes(searchTerm)
  );

  if (branchIdError) return <div className="p-10 text-red-600 font-bold">{branchIdError}</div>;

  return (
    <div className="p-6 bg-gray-100 min-h-screen font-sans text-black">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold mb-6 text-blue-900">Withdrawal Management</h1>

        {message && <p className="mb-4 p-3 bg-blue-50 text-blue-700 rounded-lg border border-blue-200">{message}</p>}

        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-md grid md:grid-cols-3 gap-4 mb-8">
          <Input label="Branch ID" value={branchId} readOnly />
          <Input label="Date" type="date" value={date} onChange={(e)=>setDate(e.target.value)} />
          <Input 
            label="Client ID" 
            value={clientId} 
            onChange={(e)=>setClientId(e.target.value)} 
            placeholder="e.g. cmcs-01"
            helpText={clientLoading ? "Searching..." : ""}
          />
          <Input label="Client Name" value={clientName} readOnly placeholder="Auto-fetched name" />
          <Input label="Withdrawal Amount" type="number" value={amount} onChange={(e)=>setAmount(e.target.value)} />

          <div className="col-span-full flex gap-3 pt-4">
            <Button type="submit" disabled={isSaving || !clientName}>
              {editingId ? "Update Withdrawal" : "Save Withdrawal"}
            </Button>
            {editingId && <Button onClick={clearForm} className="bg-gray-500">Cancel</Button>}
          </div>
        </form>

        <div className="bg-white p-6 rounded-xl shadow-md">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Withdrawal History</h2>
                <input
                    className="p-2 border border-gray-300 rounded-md w-64 focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Search by name or ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-50 text-gray-600 uppercase text-xs">
                            <th className="p-3 border-b">Date</th>
                            <th className="p-3 border-b">Client</th>
                            <th className="p-3 border-b">Amount</th>
                            <th className="p-3 border-b text-center">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map((w) => (
                            <tr key={w.id} className="hover:bg-gray-50 border-b">
                                <td className="p-3">{w.date}</td>
                                <td className="p-3">
                                    <span className="font-medium">{w.clientName}</span>
                                    <br /><span className="text-xs text-gray-500">{w.clientId}</span>
                                </td>
                                <td className="p-3 font-semibold text-red-600">-{w.amount?.toLocaleString()}</td>
                                <td className="p-3 flex justify-center gap-4 text-lg">
                                    <button onClick={() => {
                                        setEditingId(w.id);
                                        setDate(w.date);
                                        setClientId(w.clientId);
                                        setClientName(w.clientName);
                                        setAmount(w.amount);
                                    }} className="text-blue-600 hover:text-blue-800"><FaEdit /></button>
                                    <button onClick={() => { setDeleteId(w.id); setShowDelete(true); }} className="text-red-600 hover:text-red-800"><FaTrash /></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
      </div>

      <Modal show={showDelete} onClose={() => setShowDelete(false)}>
        <h2 className="font-bold text-lg mb-4">Confirm Deletion</h2>
        <Input
          label="Enter Admin PIN to delete"
          type="password"
          value={deletePassword}
          onChange={(e) => setDeletePassword(e.target.value)}
        />
        <div className="flex justify-end gap-3 mt-6">
          <Button onClick={() => setShowDelete(false)} className="bg-gray-400">Cancel</Button>
          <Button onClick={confirmDelete} className="bg-red-600">Confirm Delete</Button>
        </div>
      </Modal>
    </div>
  );
}