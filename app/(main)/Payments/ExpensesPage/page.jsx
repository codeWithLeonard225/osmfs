"use client";

import React, { useState, useEffect } from 'react';
import { db } from "@/app/lib/firebase";
import {
    collection,
    query,
    where,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    serverTimestamp,
    onSnapshot
} from 'firebase/firestore';

export default function ExpensesRecordBook({ branchId: branchIdProp }) {
    const todayStr = new Date().toISOString().slice(0, 10);

    // 1. Branch ID State (Loaded from sessionStorage like BulkPayments)
    const [branchId, setBranchId] = useState(branchIdProp || '');

    // Entry Input States
    const [expenseName, setExpenseName] = useState('');
    const [totalCost, setTotalCost] = useState('');
    const [date, setDate] = useState(todayStr);
    const [comment, setComment] = useState('');

    // Staging Queue (for batch Save/Submit) & Saved Firestore Records
    const [pendingEntries, setPendingEntries] = useState([]);
    const [savedRecords, setSavedRecords] = useState([]);
    const [editingId, setEditingId] = useState(null);

    // Filter & UI States
    const [filterDate, setFilterDate] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // 2. Load Branch ID from sessionStorage (Matches BulkPayments pattern)
    useEffect(() => {
        if (branchIdProp) {
            setBranchId(String(branchIdProp));
            return;
        }
        const keys = Object.keys(sessionStorage);
        keys.forEach((k) => {
            try {
                const parsed = JSON.parse(sessionStorage.getItem(k));
                if (parsed?.branchId) setBranchId(String(parsed.branchId));
            } catch { }
        });
    }, [branchIdProp]);

    // 3. Real-Time Listener for Branch Expenses
    useEffect(() => {
        if (!branchId) {
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        const expQuery = query(
            collection(db, "expenses_book"),
            where("branchId", "==", branchId)
        );

        const unsubscribe = onSnapshot(expQuery, (snapshot) => {
            const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            data.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
            setSavedRecords(data);
            setIsLoading(false);
        }, (err) => {
            console.error("Error syncing branch expenses:", err);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [branchId]);

    // Add Row to Pending List (or Update Existing Saved Record if Editing)
    const handleAddOrUpdateRow = async (e) => {
        e.preventDefault();
        if (!branchId) return alert("Branch ID not found. Please log in or select a branch first.");
        if (!expenseName.trim() || !totalCost || parseFloat(totalCost) <= 0 || !date) {
            return alert("Please fill in Expense Name, Total Cost, and Date.");
        }

        // If editing an existing saved record, update Firestore directly
        if (editingId) {
            setIsSaving(true);
            try {
                await updateDoc(doc(db, "expenses_book", editingId), {
                    branchId,
                    expenseName: expenseName.trim(),
                    totalCost: parseFloat(totalCost),
                    date,
                    comment: comment.trim(),
                    updatedAt: serverTimestamp()
                });
                setEditingId(null);
                resetForm();
                alert("Expense record updated!");
            } catch (err) {
                alert("Error updating record: " + err.message);
            } finally {
                setIsSaving(false);
            }
            return;
        }

        // Otherwise stage into Pending Entries ready for Save / Submit
        const newDraft = {
            tempId: Date.now() + Math.random(),
            branchId,
            expenseName: expenseName.trim(),
            totalCost: parseFloat(totalCost),
            date,
            comment: comment.trim()
        };

        setPendingEntries(prev => [newDraft, ...prev]);
        resetForm();
    };

    const resetForm = () => {
        setExpenseName('');
        setTotalCost('');
        setDate(todayStr);
        setComment('');
        setEditingId(null);
    };

    // Save / Submit All Pending Entries (or single typed form entry if queue is empty)
    const handleSaveSubmit = async () => {
        if (!branchId) return alert("Branch ID is missing! Cannot save without branchId.");

        // Allow direct Save/Submit even if user typed in the form without clicking "+ Add Row" first
        let itemsToSave = [...pendingEntries];
        if (itemsToSave.length === 0 && expenseName.trim() && parseFloat(totalCost) > 0) {
            itemsToSave.push({
                branchId,
                expenseName: expenseName.trim(),
                totalCost: parseFloat(totalCost),
                date: date || todayStr,
                comment: comment.trim()
            });
        }

        if (itemsToSave.length === 0) {
            return alert("No new expenses to save. Enter an expense above first.");
        }

        if (!confirm(`Save & submit ${itemsToSave.length} expense record(s) for Branch ${branchId}?`)) return;

        setIsSaving(true);
        try {
            const promises = itemsToSave.map(item =>
                addDoc(collection(db, "expenses_book"), {
                    branchId: branchId,
                    expenseName: item.expenseName,
                    totalCost: parseFloat(item.totalCost),
                    date: item.date,
                    comment: item.comment || '',
                    createdAt: serverTimestamp()
                })
            );

            await Promise.all(promises);
            setPendingEntries([]);
            resetForm();
            alert("Success! Expenses saved to branch records.");
        } catch (err) {
            alert("Error saving expenses: " + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    // Action: Remove Pending Draft Row
    const handleRemovePending = (tempId) => {
        setPendingEntries(prev => prev.filter(item => item.tempId !== tempId));
    };

    // Action: Load Saved Record into Form for Editing
    const handleEditRecord = (record) => {
        setEditingId(record.id);
        setExpenseName(record.expenseName || '');
        setTotalCost(String(record.totalCost || ''));
        setDate(record.date || todayStr);
        setComment(record.comment || '');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Action: Delete Saved Record from Firestore
    const handleDeleteRecord = async (id, name) => {
        if (!confirm(`Delete "${name}" from expense records?`)) return;
        try {
            await deleteDoc(doc(db, "expenses_book", id));
            if (editingId === id) resetForm();
        } catch (err) {
            alert("Error deleting record: " + err.message);
        }
    };

    // Filter Saved Records
    const filteredSaved = savedRecords.filter(r => {
        const matchesDate = filterDate ? r.date === filterDate : true;
        const term = searchTerm.toLowerCase().trim();
        const matchesSearch = !term ||
            (r.expenseName || '').toLowerCase().includes(term) ||
            (r.comment || '').toLowerCase().includes(term);
        return matchesDate && matchesSearch;
    });

    const pendingTotal = pendingEntries.reduce((sum, item) => sum + (parseFloat(item.totalCost) || 0), 0);
    const savedTotal = filteredSaved.reduce((sum, item) => sum + (parseFloat(item.totalCost) || 0), 0);

    return (
        <div className="p-4 bg-gray-100 min-h-screen text-xs text-black font-sans">
            <div className="max-w-[1200px] mx-auto bg-white p-6 rounded shadow space-y-6">

                {/* Top Header with Active Branch ID */}
                <div className="flex flex-wrap justify-between items-center border-b pb-4 gap-4">
                    <div>
                        <h1 className="text-xl font-black text-gray-900 uppercase">Expenses Record Book</h1>
                        <p className="text-gray-500 text-xs mt-0.5">Record daily branch expenses and submit to ledger</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-50 border border-blue-200 px-3 py-1.5 rounded">
                            <span className="text-gray-500 font-bold mr-1">Branch ID:</span>
                            <span className="font-black text-blue-800">{branchId || "Not Detected"}</span>
                        </div>
                        <div className="bg-gray-900 text-white px-4 py-1.5 rounded font-black text-sm">
                            Saved Total: SLE {savedTotal.toLocaleString()}
                        </div>
                    </div>
                </div>

                {/* Expense Entry Input Bar */}
                <form onSubmit={handleAddOrUpdateRow} className="bg-gray-50 p-4 rounded border space-y-3">
                    <div className="flex justify-between items-center">
                        <span className="font-black uppercase text-gray-700">
                            {editingId ? "Edit Saved Expense Record" : "Add Expense Item"}
                        </span>
                        {editingId && (
                            <button
                                type="button"
                                onClick={resetForm}
                                className="text-red-600 font-bold underline"
                            >
                                Cancel Edit
                            </button>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                        <div className="flex flex-col">
                            <label className="font-bold mb-1">Expense Name *</label>
                            <input
                                type="text"
                                required
                                placeholder="e.g. Transportation"
                                className="border p-2 rounded text-sm bg-white"
                                value={expenseName}
                                onChange={(e) => setExpenseName(e.target.value)}
                            />
                        </div>

                        <div className="flex flex-col">
                            <label className="font-bold mb-1">Total Cost (SLE) *</label>
                            <input
                                type="number"
                                step="0.01"
                                min="0.01"
                                required
                                placeholder="0.00"
                                className="border p-2 rounded text-sm bg-white font-bold"
                                value={totalCost}
                                onChange={(e) => setTotalCost(e.target.value)}
                            />
                        </div>

                        <div className="flex flex-col">
                            <label className="font-bold mb-1">Date *</label>
                            <input
                                type="date"
                                required
                                className="border p-2 rounded text-sm bg-white"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                            />
                        </div>

                        <div className="flex flex-col">
                            <label className="font-bold mb-1">Comment</label>
                            <input
                                type="text"
                                placeholder="Optional details..."
                                className="border p-2 rounded text-sm bg-white"
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                            />
                        </div>

                        <div className="flex gap-2">
                            <button
                                type="submit"
                                disabled={isSaving}
                                className={`w-full text-white px-4 py-2 rounded font-bold h-10 ${
                                    editingId ? "bg-orange-600 hover:bg-orange-700" : "bg-blue-600 hover:bg-blue-700"
                                }`}
                            >
                                {editingId ? "Update Row" : "+ Add to List"}
                            </button>
                        </div>
                    </div>
                </form>

                {/* Pending / Unsaved Entries Table + Save / Submit Footer */}
                {(pendingEntries.length > 0 || (!editingId && expenseName.trim() && parseFloat(totalCost) > 0)) && (
                    <div className="border-2 border-green-600 rounded overflow-hidden">
                        <div className="bg-green-700 text-white px-4 py-2 font-black uppercase flex justify-between items-center">
                            <span>Ready to Submit ({pendingEntries.length} staged item{pendingEntries.length === 1 ? '' : 's'})</span>
                            <span>Branch ID: {branchId}</span>
                        </div>

                        {pendingEntries.length > 0 && (
                            <div className="overflow-x-auto">
                                <table className="w-full border-collapse">
                                    <thead className="bg-green-50 text-green-900 uppercase font-bold border-b">
                                        <tr>
                                            <th className="border p-2 text-left">Expense Name</th>
                                            <th className="border p-2 text-right">Total Cost (SLE)</th>
                                            <th className="border p-2 text-center">Date</th>
                                            <th className="border p-2 text-left">Comment</th>
                                            <th className="border p-2 text-center w-28">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pendingEntries.map((item) => (
                                            <tr key={item.tempId} className="bg-white border-b hover:bg-green-50/40">
                                                <td className="border p-2 font-bold">{item.expenseName}</td>
                                                <td className="border p-2 text-right font-black text-green-800">
                                                    {parseFloat(item.totalCost).toLocaleString()}
                                                </td>
                                                <td className="border p-2 text-center">{item.date}</td>
                                                <td className="border p-2">{item.comment || '-'}</td>
                                                <td className="border p-2 text-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemovePending(item.tempId)}
                                                        className="bg-red-100 hover:bg-red-200 text-red-700 font-bold px-2.5 py-1 rounded"
                                                    >
                                                        Remove
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Save / Submit Action Bar (Matches BulkPayments Footer) */}
                        <div className="flex flex-col md:flex-row justify-between items-center bg-gray-900 p-4 text-white gap-4">
                            <div>
                                <div className="text-gray-400 uppercase font-bold text-[10px]">Pending Batch Total</div>
                                <div className="text-xl font-black text-green-400">
                                    SLE {(pendingEntries.length > 0 ? pendingTotal : parseFloat(totalCost || 0)).toLocaleString()}
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={handleSaveSubmit}
                                disabled={isSaving}
                                className="bg-green-500 hover:bg-green-600 text-black px-10 py-3 rounded-lg font-black text-base disabled:bg-gray-500 transition"
                            >
                                {isSaving ? "SAVING..." : "SAVE / SUBMIT"}
                            </button>
                        </div>
                    </div>
                )}

                {/* Saved Expenses Ledger Section */}
                <div className="space-y-3 pt-2">
                    <div className="flex flex-wrap justify-between items-end gap-3 bg-gray-50 p-3 rounded border">
                        <div className="font-black uppercase text-gray-800 text-sm">
                            Saved Branch Expenses ({filteredSaved.length})
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <input
                                type="date"
                                value={filterDate}
                                onChange={(e) => setFilterDate(e.target.value)}
                                className="border p-1.5 rounded bg-white text-xs"
                            />
                            {filterDate && (
                                <button
                                    type="button"
                                    onClick={() => setFilterDate('')}
                                    className="px-2 py-1 bg-gray-200 rounded font-bold"
                                >
                                    Clear Date
                                </button>
                            )}
                            <input
                                type="text"
                                placeholder="Search expense or comment..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="border p-1.5 rounded bg-white text-xs w-56"
                            />
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse border border-gray-300">
                            <thead className="bg-gray-800 text-white uppercase">
                                <tr>
                                    <th className="border p-2 text-left">Expense Name</th>
                                    <th className="border p-2 text-right">Total Cost (SLE)</th>
                                    <th className="border p-2 text-center">Date</th>
                                    <th className="border p-2 text-left">Comment</th>
                                    <th className="border p-2 text-center w-36">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {isLoading ? (
                                    <tr>
                                        <td colSpan="5" className="border p-6 text-center text-gray-500 font-bold">
                                            Loading branch expenses...
                                        </td>
                                    </tr>
                                ) : filteredSaved.length > 0 ? (
                                    filteredSaved.map((rec) => (
                                        <tr key={rec.id} className="border-b hover:bg-gray-50">
                                            <td className="border p-2 font-bold text-gray-900">{rec.expenseName}</td>
                                            <td className="border p-2 text-right font-black text-red-700">
                                                {parseFloat(rec.totalCost || 0).toLocaleString()}
                                            </td>
                                            <td className="border p-2 text-center font-medium">{rec.date}</td>
                                            <td className="border p-2 text-gray-600">{rec.comment || '-'}</td>
                                            <td className="border p-2 text-center">
                                                <div className="flex justify-center gap-1.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleEditRecord(rec)}
                                                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-2.5 py-1 rounded text-[11px]"
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteRecord(rec.id, rec.expenseName)}
                                                        className="bg-red-600 hover:bg-red-700 text-white font-bold px-2.5 py-1 rounded text-[11px]"
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="5" className="border p-6 text-center text-gray-400 italic">
                                            No saved expense records found for this branch.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>
        </div>
    );
}