"use client";

import React, { useState, useEffect } from 'react';
import { 
    FaSearch, FaCoins, FaCalendarAlt, FaBriefcase, FaUser, 
    FaCalculator, FaReceipt, FaEraser, FaSave, FaHistory 
} from 'react-icons/fa';
import { HiOutlineStatusOnline, HiOutlineStatusOffline } from 'react-icons/hi';
import { db } from '@/app/lib/firebase';
import { collection, addDoc, onSnapshot, query, where, serverTimestamp } from 'firebase/firestore';

/** --- REUSABLE UI INPUT COMPONENT --- **/
const Input = ({ id, label, type = 'text', value, onChange, placeholder, readOnly = false, icon: Icon }) => (
    <div className="flex flex-col space-y-1 w-full">
        <label htmlFor={id} className="text-sm font-medium text-gray-700">{label}</label>
        <div className="relative rounded-md shadow-sm">
            {Icon && (
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    <Icon size={16} />
                </div>
            )}
            <input
                id={id}
                type={type}
                value={value}
                onChange={onChange}
                readOnly={readOnly}
                placeholder={placeholder}
                className={`w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 text-black bg-white text-sm ${Icon ? 'pl-10' : 'pl-3'} ${readOnly ? 'bg-gray-100 cursor-not-allowed' : ''}`}
            />
        </div>
    </div>
);

export default function IndividualLoanPaymentsPage() {

    const [currentBranchId, setCurrentBranchId] = useState('');
const [companyShortCode, setCompanyShortCode] = useState('PMC');
// const [isOnline, setIsOnline] = useState(true);
    // Session & Context Metrics
    const [isOnline, setIsOnline] = useState(true);
    const [loading, setLoading] = useState(false);
    const [loanLoading, setLoanLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    // Core Input State
    const [inputLoanId, setInputLoanId] = useState('');

    // Resolved Target Loan Parameters
    const [matchedLoanDocId, setMatchedLoanDocId] = useState(''); // Firestore Auto-ID
    const [clientName, setClientName] = useState('');
    const [clientId, setClientId] = useState('');
    const [totalLoanSanctioned, setTotalLoanSanctioned] = useState(0);
    const [monthlyInstallmentAmount, setMonthlyInstallmentAmount] = useState(0);
    const [totalContractMonths, setTotalContractMonths] = useState(0);

    // Historic Ledger Calculated Summary Metrics
    const [totalAmountPaidToDate, setTotalAmountPaidToDate] = useState(0);
    const [remainingBalanceOwed, setRemainingBalanceOwed] = useState(0);
    const [remainingMonthsCalculated, setRemainingMonthsCalculated] = useState(0);
    const [historicPaymentsLedger, setHistoricPaymentsLedger] = useState([]);

    // New Payment Form Transaction States
    const [amountBeingPaid, setAmountBeingPaid] = useState('');
    const [paymentMode, setPaymentMode] = useState('Cash');
    const [bankReference, setBankReference] = useState('');
    const [collectorStaffName, setCollectorStaffName] = useState('');

    // Global Payments Logger (For the real-time bottom audit table)
    const [globalRecentPaymentsList, setGlobalRecentPaymentsList] = useState([]);

    useEffect(() => {
    if (typeof window !== "undefined") {
        const keys = Object.keys(sessionStorage);
        let foundData = null;

        keys.forEach((key) => {
            const val = sessionStorage.getItem(key);

            if (val && val.includes("companyShortCode")) {
                try {
                    foundData = JSON.parse(val);
                } catch (error) {
                    console.error(error);
                }
            }
        });

        if (foundData) {
            setCurrentBranchId(foundData.branchId || '');
            setCompanyShortCode(foundData.companyShortCode || 'PMC');
        }
    }
}, []);

    // 1. Connection Monitoring Link
    useEffect(() => {
        const handleStatus = () => setIsOnline(navigator.onLine);
        window.addEventListener("online", handleStatus);
        window.addEventListener("offline", handleStatus);
        return () => {
            window.removeEventListener("online", handleStatus);
            window.removeEventListener("offline", handleStatus);
        };
    }, []);

    // 2. Real-Time Monitor for the Global Master Payment Log (Bottom Table View)
    useEffect(() => {
       if (!currentBranchId) return;

const q = query(
    collection(db, "loan_payments"),
    where("branchId", "==", currentBranchId)
);
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setGlobalRecentPaymentsList(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })));
        });
        return () => unsubscribe();
    }, []);

    // 3. Dynamic Multi-Query Evaluation Engine (Triggers on Loan ID entry)
    useEffect(() => {
        const targetLoanId = inputLoanId.trim().toUpperCase();

        if (targetLoanId.length < 4) {
            resetResolvedLoanStates();
            return;
        }

        setLoanLoading(true);

        // Step A: Search for the Master Formulated Loan Profile
      const loanQuery = query(
    collection(db, "individual_loan_products"),
    where("singleLoanId", "==", targetLoanId),
    where("branchId", "==", currentBranchId)
);
        
        const unsubscribeLoan = onSnapshot(loanQuery, (loanSnapshot) => {
            if (!loanSnapshot.empty) {
                const loanData = loanSnapshot.docs[0].data();
                setMatchedLoanDocId(loanSnapshot.docs[0].id);
                setClientName(loanData.personFullName || '');
                setClientId(loanData.personId || '');
                
                // Extract configuration sub-objects safely
                const amount = parseFloat(loanData.loanRequest?.loanAmount) || 0;
                const duration = parseInt(loanData.loanRequest?.durationMonths, 10) || 0;
                const monthlyBase = parseFloat(loanData.loanRequest?.monthlyRepaymentExpected) || 0;

                // Account for 30% Flat Interest Setup in calculations
                const totalPayableWithInterest = amount + (amount * 0.30);

                setTotalLoanSanctioned(totalPayableWithInterest);
                setTotalContractMonths(duration);
                setMonthlyInstallmentAmount(monthlyBase);

                // Step B: Chain lookups to find all matching payments registered under this unique Loan ID
               const paymentsQuery = query(
    collection(db, "loan_payments"),
    where("singleLoanId", "==", targetLoanId),
    where("branchId", "==", currentBranchId)
);
                
                const unsubscribePayments = onSnapshot(paymentsQuery, (paymentsSnapshot) => {
                    let totalPaidSum = 0;
                    const paymentsList = [];

                    paymentsSnapshot.forEach((doc) => {
                        const data = doc.data();
                        totalPaidSum += parseFloat(data.amountPaid) || 0;
                        paymentsList.push({ ...data, id: doc.id });
                    });

                    // Sort historical collection by transaction timestamp
                    paymentsList.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
                    setHistoricPaymentsLedger(paymentsList);

                    // Compute dynamic breakdown tracking stats
                    const remainingOwed = totalPayableWithInterest - totalPaidSum;
                    
                    // Remaining months = Remaining Balance divided by standard monthly billing target
                    let remainingMonths = monthlyBase > 0 ? Math.ceil(remainingOwed / monthlyBase) : 0;
                    if (remainingOwed <= 0) remainingMonths = 0;

                    setTotalAmountPaidToDate(totalPaidSum);
                    setRemainingBalanceOwed(remainingOwed < 0 ? 0 : remainingOwed);
                    setRemainingMonthsCalculated(remainingMonths);
                    
                    setLoanLoading(false);
                }, (err) => {
                    console.error("Error evaluating transactional history: ", err);
                    setLoanLoading(false);
                });

                return () => unsubscribePayments();

            } else {
                // If ID matches nothing in system database
                resetResolvedLoanStates();
                setLoanLoading(false);
            }
        }, (err) => {
            console.error("Error matching loan parameters: ", err);
            setLoanLoading(false);
        });

        return () => unsubscribeLoan();
    }, [inputLoanId]);

    // Helper to clear sub-states quickly
    const resetResolvedLoanStates = () => {
        setMatchedLoanDocId('');
        setClientName('');
        setClientId('');
        setTotalLoanSanctioned(0);
        setTotalContractMonths(0);
        setMonthlyInstallmentAmount(0);
        setTotalAmountPaidToDate(0);
        setRemainingBalanceOwed(0);
        setRemainingMonthsCalculated(0);
        setHistoricPaymentsLedger([]);
    };

    // Full Screen Form Purge Action
    const handleResetFormFields = () => {
        setInputLoanId('');
        setAmountBeingPaid('');
        setPaymentMode('Cash');
        setBankReference('');
        setCollectorStaffName('');
        resetResolvedLoanStates();
        setMessage({ type: '', text: '' });
    };

    // Form Committal Handling Action
    const handlePaymentSubmission = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage({ type: '', text: '' });

        const parsedAmount = parseFloat(amountBeingPaid);

        if (!matchedLoanDocId) {
            setMessage({ type: 'error', text: 'Error: Cannot log transaction. Input a verified and active Single Loan ID.' });
            setLoading(false);
            return;
        }

        if (!parsedAmount || parsedAmount <= 0) {
            setMessage({ type: 'error', text: 'Error: Transaction amount must be greater than 0 NLE.' });
            setLoading(false);
            return;
        }

        try {
            const paymentPayload = {
                singleLoanId: inputLoanId.trim().toUpperCase(),
                clientId,
                clientName,
                branchId: currentBranchId,
                amountPaid: parsedAmount,
                paymentMode,
                bankReference: paymentMode !== 'Cash' ? bankReference : 'N/A',
                collectorStaffName,
                monthlyInstallmentSnapshot: monthlyInstallmentAmount,
                createdAt: serverTimestamp()
            };

            // Post transaction entry to Firebase
            await addDoc(collection(db, "loan_payments"), paymentPayload);

            setMessage({ 
                type: 'success', 
                text: `Success! Payment of ${parsedAmount.toLocaleString()} NLE posted successfully for ${clientName}.` 
            });

            // Clean single payment inputs while retaining current Loan profile on-screen
            setAmountBeingPaid('');
            setBankReference('');
        } catch (error) {
            console.error("Failed to commit payment transaction node: ", error);
            setMessage({ type: 'error', text: 'Critical error logging processing voucher transaction onto node cluster.' });
        } finally {
            setLoading(false);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
            <div className="max-w-5xl mx-auto bg-white p-6 sm:p-10 rounded-2xl shadow-xl border border-slate-200">
                
                {/* Header Context Bar */}
                <div className="flex flex-col sm:flex-row justify-between items-center border-b pb-6 mb-8 gap-4">
                    <div className="text-center sm:text-left">
                        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center justify-center sm:justify-start gap-2">
                            <FaReceipt className="text-indigo-600" /> Loan Repayment Ledger Desk
                        </h1>
                        <p className="text-sm text-slate-500 mt-1">Real-time balances lookup engine. Evaluates total collections, principal variances, and remaining payment timelines instantly.</p>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-white border shadow-sm">
                        {isOnline ? (
                            <span className="flex items-center gap-1.5 text-emerald-600"><HiOutlineStatusOnline size={16} /> Connected</span>
                        ) : (
                            <span className="flex items-center gap-1.5 text-rose-500 animate-pulse"><HiOutlineStatusOffline size={16} /> Working Offline</span>
                        )}
                    </div>
                </div>

                {/* Feedback Alerts */}
                {message.text && (
                    <div className={`p-4 rounded-xl mb-8 text-sm font-medium border transition-all shadow-sm ${
                        message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'
                    }`}>
                        {message.text}
                    </div>
                )}

                {/* STEP 1: RUN REAL-TIME SEARCH */}
                <div className="bg-indigo-50/50 p-6 rounded-2xl border border-indigo-100 mb-8">
                    <h3 className="text-sm font-bold text-indigo-900 mb-3 uppercase tracking-wider">Step 1: Locate Active Formulated Loan Contract</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                        <div>
                            <Input 
                                id="searchLoanId" 
                                label="Enter Single Loan ID *" 
                                value={inputLoanId} 
                                onChange={(e) => setInputLoanId(e.target.value)} 
                                placeholder="e.g. PMC-IL-01" 
                                icon={FaSearch} 
                            />
                            {loanLoading && <p className="text-xs text-indigo-500 mt-1 highway-pulse animate-pulse">Scanning database ledgers...</p>}
                        </div>
                        <div className="p-2 border rounded-md bg-white/80 flex items-center h-10 text-sm text-slate-700">
                            <span className="font-semibold text-slate-500 mr-2">Target Client Profile:</span>
                            {clientName ? (
                                <span className="text-indigo-900 font-bold flex items-center gap-1"><FaUser className="text-indigo-500" /> {clientName} ({clientId})</span>
                            ) : (
                                <span className="text-gray-400 italic">Provide a valid continuous code...</span>
                            )}
                        </div>
                    </div>
                </div>

                {/* STEP 2: DYNAMIC LIVE METRICS VISUAL BARS */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    <div className="bg-slate-50 p-4 border rounded-xl shadow-sm">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">Total Matched (Inc. 30% Int.)</span>
                        <span className="text-xl font-extrabold text-slate-900 block mt-1">{totalLoanSanctioned.toLocaleString()} NLE</span>
                        <span className="text-[11px] text-slate-400 block mt-1">Contract: {totalContractMonths} Mos Term</span>
                    </div>

                    <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl shadow-sm">
                        <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 block">Total Recovered To-Date</span>
                        <span className="text-xl font-extrabold text-emerald-900 block mt-1">{totalAmountPaidToDate.toLocaleString()} NLE</span>
                        <span className="text-[11px] text-emerald-600 block mt-1">Aggregated historical collection receipts</span>
                    </div>

                    <div className="bg-rose-50 border border-rose-100 p-4 rounded-xl shadow-sm">
                        <span className="text-xs font-bold uppercase tracking-wider text-rose-700 block">Outstanding Remaining Balance</span>
                        <span className="text-xl font-extrabold text-rose-900 block mt-1">{remainingBalanceOwed.toLocaleString()} NLE</span>
                        <span className="text-[11px] text-rose-600 block mt-1">Net pending processing liabilities</span>
                    </div>

                    <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl shadow-sm">
                        <span className="text-xs font-bold uppercase tracking-wider text-amber-700 block">Estimated Remaining Months</span>
                        <span className="text-xl font-extrabold text-amber-900 block mt-1">{remainingMonthsCalculated} Months Left</span>
                        <span className="text-[11px] text-amber-600 block mt-1">Expected Rate: {monthlyInstallmentAmount.toLocaleString()} NLE / Mo</span>
                    </div>
                </div>

                {/* ACTION SPACE SPLIT: LEFT (SUBMIT PAYMENT) | RIGHT (STATEMENT HISTORY) */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    
                    {/* FORM TRANS-BOX */}
                    <form onSubmit={handlePaymentSubmission} className="space-y-4 lg:col-span-5 bg-slate-50/50 p-5 rounded-2xl border border-slate-200">
                        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1 border-b pb-2">
                            <FaCoins className="text-indigo-600" /> Post New Payment Record
                        </h3>

                        <Input 
                            id="payAmt" 
                            label="Payment Amount Collected (NLE) *" 
                            type="number" 
                            value={amountBeingPaid} 
                            onChange={(e) => setAmountBeingPaid(e.target.value)} 
                            placeholder="0.00" 
                            icon={FaCoins}
                            disabled={!matchedLoanDocId}
                        />

                        <div className="flex flex-col space-y-1">
                            <label className="text-sm font-medium text-gray-700">Payment Channel / Mode</label>
                            <select 
                                value={paymentMode} 
                                onChange={(e) => setPaymentMode(e.target.value)} 
                                className="p-2 border border-gray-300 rounded-md bg-white text-black text-sm focus:ring-2 focus:ring-indigo-500"
                                disabled={!matchedLoanDocId}
                            >
                                <option value="Cash">Cash Handover</option>
                                <option value="Bank Deposit">Direct Bank Deposit</option>
                                <option value="Bank Transfer">Electronic Wire Transfer</option>
                                <option value="Mobile Money">Orange / Afrimoney Mobile Wallet</option>
                            </select>
                        </div>

                        {paymentMode !== 'Cash' && (
                            <Input 
                                id="bankRef" 
                                label="Bank Transaction Reference / Voucher ID *" 
                                value={bankReference} 
                                onChange={(e) => setBankReference(e.target.value)} 
                                placeholder="Txn ID Reference number" 
                                icon={FaBriefcase}
                            />
                        )}

                        <Input 
                            id="staffName" 
                            label="Receiving Officer / Collector Name" 
                            value={collectorStaffName} 
                            onChange={(e) => setCollectorStaffName(e.target.value)} 
                            placeholder="Staff full name" 
                            icon={FaUser}
                            disabled={!matchedLoanDocId}
                        />

                        <div className="flex gap-2 pt-2">
                            <button 
                                type="button" 
                                onClick={handleResetFormFields} 
                                className="w-1/3 py-2 border rounded-xl text-xs font-semibold text-slate-600 bg-white hover:bg-slate-50 transition flex items-center justify-center gap-1 shadow-sm"
                            >
                                <FaEraser /> Clear
                            </button>
                            <button 
                                type="submit" 
                                disabled={loading || !matchedLoanDocId} 
                                className="w-2/3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-semibold text-xs rounded-xl transition flex items-center justify-center gap-1 shadow-md"
                            >
                                {loading ? (
                                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                ) : (
                                    <><FaSave /> Save Transaction</>
                                )}
                            </button>
                        </div>
                    </form>

                    {/* LIVE AUDIT CARD LOG INDEX */}
                    <div className="lg:col-span-7 space-y-3">
                        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1">
                            <FaHistory className="text-emerald-600" /> Account Statement History Index
                        </h3>
                        
                        <div className="overflow-y-auto max-h-[340px] border border-slate-200 rounded-xl shadow-sm bg-white">
                            {historicPaymentsLedger.length === 0 ? (
                                <div className="p-8 text-center text-slate-400 text-xs italic">
                                    No transaction registry blocks indexed for this specified loan asset key.
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-100">
                                    {historicPaymentsLedger.map((pmt, i) => (
                                        <div key={pmt.id} className="p-3 hover:bg-slate-50 transition text-xs flex justify-between items-center">
                                            <div>
                                                <p className="font-bold text-slate-900 text-sm">+{parseFloat(pmt.amountPaid).toLocaleString()} NLE</p>
                                                <p className="text-slate-500 font-medium mt-0.5">Mode: {pmt.paymentMode} {pmt.bankReference !== 'N/A' && `(${pmt.bankReference})`}</p>
                                                <p className="text-slate-400 text-[10px]">Staff Entry: {pmt.collectorStaffName || 'System Automatic'}</p>
                                            </div>
                                            <div className="text-right">
                                                <span className="bg-slate-100 font-mono px-2 py-0.5 rounded text-slate-600 font-bold block text-center">Receipt #{historicPaymentsLedger.length - i}</span>
                                                <span className="text-[10px] text-slate-400 mt-1 block">
                                                    {pmt.createdAt?.seconds ? new Date(pmt.createdAt.seconds * 1000).toLocaleDateString() : 'Pending verification'}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                </div>

                {/* --- MASTER TRACKING LOG TABLE SYSTEM (ALL RECENT TRANSACTIONS GLOBALVIEW) --- */}
                <div className="mt-12 border-t pt-8">
                    <div className="mb-4">
                        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                            <FaReceipt className="text-indigo-600" /> Live Global Collections Registry Table
                        </h3>
                        <p className="text-xs text-slate-500">Live system telemetry processing stream capturing all cross-portfolio individual payment entries entered globally.</p>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
                        <table className="min-w-full divide-y divide-slate-200 text-sm text-left text-slate-700 bg-white">
                            <thead className="bg-slate-50 font-semibold text-slate-900 text-xs uppercase tracking-wider">
                                <tr>
                                    <th className="px-4 py-3">Transaction Date</th>
                                    <th className="px-4 py-3">Loan ID Reference</th>
                                    <th className="px-4 py-3">Client Reference Name</th>
                                    <th className="px-4 py-3">Payment Channel</th>
                                    <th className="px-4 py-3">Amount Deposited</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 text-xs">
                                {globalRecentPaymentsList.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" className="px-4 py-8 text-center text-slate-400 italic">
                                            No collection transactions recorded anywhere on cluster databases yet.
                                        </td>
                                    </tr>
                                ) : (
                                    globalRecentPaymentsList.map((entry) => (
                                        <tr key={entry.id} className="hover:bg-slate-50/80 transition-colors">
                                            <td className="px-4 py-3 text-slate-500">
                                                {entry.createdAt?.seconds ? new Date(entry.createdAt.seconds * 1000).toLocaleString() : 'Processing transaction...'}
                                            </td>
                                            <td className="px-4 py-3 font-mono font-bold text-indigo-600 uppercase">{entry.singleLoanId || 'N/A'}</td>
                                            <td className="px-4 py-3 font-medium text-slate-900">{entry.clientName || 'N/A'}</td>
                                            <td className="px-4 py-3 text-slate-600">{entry.paymentMode || 'Cash'}</td>
                                            <td className="px-4 py-3 font-bold text-emerald-700 text-sm">+{parseFloat(entry.amountPaid || 0).toLocaleString()} NLE</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>
        </div>
    );
}