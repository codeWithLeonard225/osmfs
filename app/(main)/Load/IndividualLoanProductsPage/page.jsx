"use client";

import React, { useState, useEffect } from 'react';
import { 
    FaSearch, FaHandHoldingUsd, FaCoins, FaCalendarAlt, FaBriefcase, 
    FaUser, FaBuilding, FaShieldAlt, FaListAlt, FaInfoCircle, FaEraser, FaSave 
} from 'react-icons/fa';
import { HiOutlineStatusOnline, HiOutlineStatusOffline } from 'react-icons/hi';
import { db } from '@/app/lib/firebase';
import { collection, addDoc, onSnapshot, query, where, serverTimestamp } from 'firebase/firestore';

/** --- REUSABLE UI COMPONENTS --- **/
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

export default function IndividualLoanProductsPage() {
    // Session & Context States
    const [currentBranchId, setCurrentBranchId] = useState('');
    const [companyShortCode, setCompanyShortCode] = useState('PMC');
    const [isOnline, setIsOnline] = useState(true);

    // Form Tracking IDs
    const [singleLoanId, setSingleLoanId] = useState('');
    const [personId, setPersonId] = useState('');
    const [personFullName, setPersonFullName] = useState('');

    // Active Database Tracking Lists
    const [loanProductsList, setLoanProductsList] = useState([]);

    // UI Feedback Logic States
    const [loading, setLoading] = useState(false);
    const [clientLoading, setClientLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    /** --- SCHEMA SPECIFIC FORM STATES --- **/
    
    // Loan Request Details
    const [productType, setProductType] = useState('Commercial/Enterprise loan');
    const [applicationStatus, setApplicationStatus] = useState('New Application');
    const [loanAmount, setLoanAmount] = useState('');
    const [overdraftProtection, setOverdraftProtection] = useState('no');
    const [loanPurpose, setLoanPurpose] = useState('');
    const [loanDurationMonths, setLoanDurationMonths] = useState('6');
    const [monthlyRepaymentExpected, setMonthlyRepaymentExpected] = useState('');

    // Loan History Section
    const [histInstitution, setHistInstitution] = useState('');
    const [histLoanType, setHistLoanType] = useState('');
    const [histOriginalAmount, setHistOriginalAmount] = useState('');
    const [histCurrentBalance, setHistCurrentBalance] = useState('');
    const [histMaturityDate, setHistMaturityDate] = useState('');
    const [histMonthlyPayment, setHistMonthlyPayment] = useState('');
    const [histCollateralPledge, setHistCollateralPledge] = useState('');

    // Business Deposit Account
    const [depInstitution, setDepInstitution] = useState('');
    const [depAccountType, setDepAccountType] = useState('');
    const [depCurrentBalance, setDepCurrentBalance] = useState('');

    // Business Debt
    const [debtInstitution, setDebtInstitution] = useState('');
    const [debtLoanType, setDebtLoanType] = useState('');
    const [debtCurrentBalance, setDebtCurrentBalance] = useState('');
    const [debtCollateral, setDebtCollateral] = useState('');
    const [debtBeingPaidOff, setDebtBeingPaidOff] = useState('no');

    // Business Information
    const [bizDescription, setBizDescription] = useState('');
    const [bizProductServiceOrder, setBizProductServiceOrder] = useState('');
    const [bizDateEstablished, setBizDateEstablished] = useState('');
    const [bizCurrentOwnershipSince, setBizCurrentOwnershipSince] = useState('');
    const [bizStateOfBusiness, setBizStateOfBusiness] = useState('');

    // Collateral Information & Details
    const [collateralDescription, setCollateralDescription] = useState('');
    const [collateralPurchasePrice, setCollateralPurchasePrice] = useState('');
    const [collateralName, setCollateralName] = useState('');
    const [collateralRegDate, setCollateralRegDate] = useState('');
    const [collateralOwnerName, setCollateralOwnerName] = useState('');
    const [collateralOwnerAddress, setCollateralOwnerAddress] = useState('');
    const [collateralOwnerDistrict, setCollateralOwnerDistrict] = useState('');
    const [collateralOwnerTown, setCollateralOwnerTown] = useState('');
    const [collateralOwnerContact, setCollateralOwnerContact] = useState('');
    const [collateralOwnerNin, setCollateralOwnerNin] = useState('');

    // Alternative Revenue Metrics
    const [hasAlternativeIncome, setHasAlternativeIncome] = useState('no');
    const [alternativeIncomeDetails, setAlternativeIncomeDetails] = useState('');

    // 1. Monitor Network Connection Link
    useEffect(() => {
        const handleStatus = () => setIsOnline(navigator.onLine);
        window.addEventListener("online", handleStatus);
        window.addEventListener("offline", handleStatus);
        return () => {
            window.removeEventListener("online", handleStatus);
            window.removeEventListener("offline", handleStatus);
        };
    }, []);

    // 2. Hydrate Session Configurations
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const keys = Object.keys(sessionStorage);
            let foundData = null;
            keys.forEach(key => {
                const val = sessionStorage.getItem(key);
                if (val && val.includes("companyShortCode")) {
                    try { foundData = JSON.parse(val); } catch (e) {}
                }
            });
            if (foundData) {
                setCurrentBranchId(foundData.branchId || '');
                setCompanyShortCode(foundData.companyShortCode || 'PMC');
            }
        }
    }, []);

    // 3. Real-Time Product Records Evaluation Engine
  useEffect(() => {
    if (!currentBranchId) return;

    const q = query(
        collection(db, "individual_loan_products"),
        where("branchId", "==", currentBranchId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const records = snapshot.docs.map(doc => ({
            ...doc.data(),
            id: doc.id
        }));

        setLoanProductsList(records);
    });

    return () => unsubscribe();
}, [currentBranchId]);

    // 4. Sequential Form ID Generation Logic (-ILD-)
    useEffect(() => {
        const code = (companyShortCode || "PMC").toLowerCase();
        const latestNum = loanProductsList.reduce((max, entry) => {
            const regex = new RegExp(`^${code}-ild-(\\d+)$`, 'i');
            const match = (entry.singleLoanId || "").match(regex);
            const num = match ? parseInt(match[1], 10) : 0;
            return num > max ? num : max;
        }, 0);
        setSingleLoanId(`${code.toUpperCase()}-IL-${String(latestNum + 1).padStart(2, '0')}`);
    }, [loanProductsList, companyShortCode]);

    // 5. FORTIFIED: Auto-Fetch Real-Time Tracker for Client Registry Matches
   // 5. FORTIFIED: Auto-Fetch Real-Time Tracker for Client Registry Matches
    useEffect(() => {
        const targetId = personId.trim();
        
        // Prevent unnecessary database hits if user is midway typing a short code
        if (targetId.length < 3) {
            setPersonFullName('');
            return;
        }

        setClientLoading(true);
        
        // Setup direct query listening to your "individual_loans" collection matching clientId
       const q = query(
    collection(db, "individual_loans"),
    where("clientId", "==", targetId),
    where("branchId", "==", currentBranchId)
);
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            if (!snapshot.empty) {
                const clientData = snapshot.docs[0].data();
                
                // Target personFullName primarily, fallback safely if needed
                const extractedName = 
                    clientData.personFullName || 
                    clientData.fullName || 
                    clientData.FullName || 
                    clientData.clientName || 
                    (clientData.firstName ? `${clientData.firstName} ${clientData.lastName || ''}`.trim() : '');

                setPersonFullName(extractedName);
            } else {
                setPersonFullName('');
            }
            setClientLoading(false);
        }, (error) => {
            console.error("Error matching client registry mapping: ", error);
            setClientLoading(false);
        });

        return () => unsubscribe();
    }, [personId]);

    // 6. Dynamic Financial Math Formula Processor (30% Flat Interest Rate Setup)
    useEffect(() => {
        const principal = parseFloat(loanAmount);
        if (!principal || principal <= 0) {
            setMonthlyRepaymentExpected('');
            return;
        }

        const totalInterest = principal * 0.30;
        const totalPayable = principal + totalInterest;
        const totalMonths = parseInt(loanDurationMonths, 10);

        let installment = totalPayable / totalMonths;

        if (principal === 6000) {
            if (totalMonths === 6) installment = 1300;
            if (totalMonths === 7) installment = 1120;
            if (totalMonths === 8) installment = 980;
        }

        setMonthlyRepaymentExpected(Math.round(installment).toString());
    }, [loanAmount, loanDurationMonths]);

    // Reset Form Clear Handler
    const handleResetForm = () => {
        setPersonId('');
        setPersonFullName('');
        setLoanAmount('');
        setLoanPurpose('');
        setBizDescription('');
        setCollateralDescription('');
        setCollateralName('');
        setCollateralOwnerName('');
        setCollateralOwnerAddress('');
        setCollateralOwnerDistrict('');
        setCollateralOwnerTown('');
        setCollateralOwnerContact('');
        setCollateralOwnerNin('');
        setAlternativeIncomeDetails('');
        setHistInstitution('');
        setHistLoanType('');
        setHistOriginalAmount('');
        setHistCurrentBalance('');
        setHistMaturityDate('');
        setHistMonthlyPayment('');
        setHistCollateralPledge('');
        setDepInstitution('');
        setDepAccountType('');
        setDepCurrentBalance('');
        setDebtInstitution('');
        setDebtLoanType('');
        setDebtCurrentBalance('');
        setDebtCollateral('');
        setBizProductServiceOrder('');
        setBizDateEstablished('');
        setBizCurrentOwnershipSince('');
        setBizStateOfBusiness('');
        setCollateralPurchasePrice('');
        setCollateralRegDate('');
        setMessage({ type: '', text: '' });
    };

    // Firebase Document Committal Function
    const handleFormSubmission = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage({ type: '', text: '' });

        if (!personFullName || !loanAmount) {
            setMessage({ type: 'error', text: 'Error: Must provide a valid Person ID mapping to an existing system Client and include Loan Amount.' });
            setLoading(false);
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }

        try {
            if (!currentBranchId) {
    setMessage({
        type: "error",
        text: "Branch information not found. Please login again."
    });

    setLoading(false);
    return;
}
            const documentPayload = {
                singleLoanId,
                personId: personId.trim(),
                personFullName,
                branchId: currentBranchId,
                loanRequest: {
                    productType,
                    applicationStatus,
                    loanAmount: parseFloat(loanAmount),
                    overdraftProtection,
                    loanPurpose,
                    durationMonths: parseInt(loanDurationMonths, 10),
                    monthlyRepaymentExpected: parseFloat(monthlyRepaymentExpected)
                },
                loanHistory: {
                    financialInstitution: histInstitution,
                    loanType: histLoanType,
                    originalAmount: parseFloat(histOriginalAmount) || 0,
                    currentBalance: parseFloat(histCurrentBalance) || 0,
                    maturityDate: histMaturityDate,
                    monthlyPayment: parseFloat(histMonthlyPayment) || 0,
                    collateralPledge: histCollateralPledge
                },
                businessDepositAccount: {
                    financialInstitution: depInstitution,
                    accountType: depAccountType,
                    currentBalance: parseFloat(depCurrentBalance) || 0
                },
                businessDebt: {
                    financialInstitution: debtInstitution,
                    loanType: debtLoanType,
                    currentBalance: parseFloat(debtCurrentBalance) || 0,
                    collateral: debtCollateral,
                    beingPaidOffWithinThisLoan: debtBeingPaidOff
                },
                businessInformation: {
                    description: bizDescription,
                    productOrServiceOrder: bizProductServiceOrder,
                    dateBusinessEstablished: bizDateEstablished,
                    currentOwnershipSince: bizCurrentOwnershipSince,
                    stateOfBusiness: bizStateOfBusiness
                },
                collateralInformation: {
                    descriptionOrPropertyAddress: collateralDescription,
                    purchasePrice: parseFloat(collateralPurchasePrice) || 0,
                    nameOfCollateral: collateralName,
                    registrationDate: collateralRegDate,
                    ownerName: collateralOwnerName,
                    address: collateralOwnerAddress,
                    district: collateralOwnerDistrict,
                    town: collateralOwnerTown,
                    contactNo: "+232 " + collateralOwnerContact.replace(/^\+232\s*/, ''),
                    ninNo: collateralOwnerNin
                },
                alternativeRevenue: {
                    hasOtherIncomeSource: hasAlternativeIncome,
                    details: alternativeIncomeDetails
                },
                createdAt: serverTimestamp()
            };

            await addDoc(collection(db, "individual_loan_products"), documentPayload);
            setMessage({ type: 'success', text: `Loan configuration record logged under Document ID: ${singleLoanId}` });
            handleResetForm();
        } catch (error) {
            console.error(error);
            setMessage({ type: 'error', text: 'Error logging records to database system.' });
        } finally {
            setLoading(false);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
            <div className="max-w-5xl mx-auto bg-white p-6 sm:p-10 rounded-2xl shadow-xl border border-slate-200">
                
                {/* Header System Banner */}
                <div className="flex flex-col sm:flex-row justify-between items-center border-b pb-6 mb-8 gap-4">
                    <div className="text-center sm:text-left">
                        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center justify-center sm:justify-start gap-2">
                            <FaHandHoldingUsd className="text-indigo-600" /> Individual Loan Formulation Sheet
                        </h1>
                        <Input
    id="branchId"
    label="Branch ID"
    value={currentBranchId}
    readOnly
    icon={FaBuilding}
/>
                        <p className="text-sm text-slate-500 mt-1">Structured mapping accounting for system IDs, alternative revenues, collateral ownership, and real-time calculations.</p>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-white border shadow-sm">
                        {isOnline ? (
                            <span className="flex items-center gap-1.5 text-emerald-600"><HiOutlineStatusOnline size={16} /> Connected</span>
                        ) : (
                            <span className="flex items-center gap-1.5 text-rose-500 animate-pulse"><HiOutlineStatusOffline size={16} /> Working Offline</span>
                        )}
                    </div>
                </div>

                {/* Status Alerts Notification Blocks */}
                {message.text && (
                    <div className={`p-4 rounded-xl mb-8 text-sm font-medium border transition-all shadow-sm ${
                        message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'
                    }`}>
                        {message.text}
                    </div>
                )}

                <form onSubmit={handleFormSubmission} className="space-y-8 text-slate-800">
                    
                    {/* SYSTEM REFERENCE TRACKING DATA BLOCK */}
                    <div className="bg-indigo-50/50 p-5 rounded-2xl border border-indigo-100/80 grid grid-cols-1 md:grid-cols-3 gap-5 items-end">
                        <Input id="singleLoanId" label="Single Loan ID (Auto)" value={singleLoanId} readOnly icon={FaBriefcase} />
                        
                        <div>
                            <Input 
                                id="personId" 
                                label="Person ID / Client ID *" 
                                value={personId} 
                                onChange={(e) => setPersonId(e.target.value)} 
                                placeholder="Type Client ID (e.g. PMC-CD-01)" 
                                icon={FaSearch} 
                            />
                            {clientLoading && <p className="text-xs text-indigo-500 mt-1 animate-pulse">Searching client files...</p>}
                        </div>

                        {/* HIGH-VISIBILITY FEEDBACK CONTAINER FOR AUTOFETCHED NAME */}
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label className="text-sm font-medium text-gray-700">Client Full Name</label>
                                {personId.trim().length >= 3 && (
                                    personFullName ? (
                                        <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold uppercase tracking-wider animate-fade-in">Found</span>
                                    ) : !clientLoading ? (
                                        <span className="text-[10px] bg-rose-100 text-rose-800 px-2 py-0.5 rounded font-bold uppercase tracking-wider">Not Found</span>
                                    ) : null
                                )}
                            </div>
                            <div className="relative rounded-md shadow-sm">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                                    <FaUser size={16} />
                                </div>
                                <input
                                    id="personFullName"
                                    type="text"
                                    value={personFullName}
                                    readOnly
                                    placeholder={clientLoading ? "Searching registry..." : "Awaiting Client ID..."}
                                    className={`w-full p-2 border border-gray-300 rounded-md text-black font-semibold text-sm pl-10 bg-gray-100 cursor-not-allowed transition-all ${
                                        personFullName ? 'text-indigo-900 border-indigo-400 bg-indigo-50 font-bold ring-2 ring-indigo-100' : 'text-gray-500'
                                    }`}
                                />
                            </div>
                        </div>
                    </div>

                    {/* SECTION 1: LOAN REQUEST DETAILS */}
                    <div className="space-y-4">
                        <h3 className="text-md font-bold text-indigo-700 flex items-center gap-2 border-b border-slate-100 pb-2">
                            <FaCoins /> Loan Request Details
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="flex flex-col space-y-2">
                                <span className="text-sm font-semibold text-slate-700">Types of Loan Products</span>
                                <div className="space-y-2">
                                    {['Group loan', 'Commercial/Enterprise loan', 'Agricultural loan', 'Asset Finance loan', 'Salary loan'].map((product) => (
                                        <label key={product} className={`p-2.5 border rounded-xl flex items-center cursor-pointer transition text-sm bg-white ${
                                            productType === product ? 'border-indigo-600 bg-indigo-50/50 font-semibold text-indigo-900' : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                                        }`}>
                                            <input type="radio" name="productType" value={product} checked={productType === product} onChange={(e) => setProductType(e.target.value)} className="mr-3 h-4 w-4 text-indigo-600" />
                                            {product}
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className="flex flex-col space-y-2">
                                <span className="text-sm font-semibold text-slate-700">Application Parameters Classification</span>
                                <div className="space-y-2">
                                    {['New Application', 'Existing Client', 'Restructured', 'Old with O/S Balance', 'Old but fully paid'].map((status) => (
                                        <label key={status} className={`p-2.5 border rounded-xl flex items-center cursor-pointer transition text-sm bg-white ${
                                            applicationStatus === status ? 'border-indigo-600 bg-indigo-50/50 font-semibold text-indigo-900' : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                                        }`}>
                                            <input type="radio" name="applicationStatus" value={status} checked={applicationStatus === status} onChange={(e) => setApplicationStatus(e.target.value)} className="mr-3 h-4 w-4 text-indigo-600" />
                                            {status}
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border border-dashed">
                            <Input id="loanAmount" label="Loan Amount Request (NLE) *" type="number" value={loanAmount} onChange={(e) => setLoanAmount(e.target.value)} placeholder="0.00" />
                            <div className="flex flex-col space-y-1">
                                <label className="text-sm font-medium text-gray-700">Loan Duration Tier</label>
                                <select value={loanDurationMonths} onChange={(e) => setLoanDurationMonths(e.target.value)} className="p-2 border border-gray-300 rounded-md bg-white text-black text-sm focus:ring-2 focus:ring-indigo-500">
                                    <option value="6">6 Months Term</option>
                                    <option value="7">7 Months Term</option>
                                    <option value="8">8 Months Term</option>
                                </select>
                            </div>
                            <div className="flex flex-col space-y-1">
                                <label className="text-sm font-medium text-gray-700">Overdraft Protection</label>
                                <select value={overdraftProtection} onChange={(e) => setOverdraftProtection(e.target.value)} className="p-2 border border-gray-300 rounded-md bg-white text-black text-sm focus:ring-2 focus:ring-indigo-500">
                                    <option value="no">No Protection</option>
                                    <option value="yes">Yes Enabled</option>
                                </select>
                            </div>
                            <Input id="monthlyRepaymentExpected" label="Monthly Expected Base (Auto)" value={monthlyRepaymentExpected} readOnly placeholder="Calculates 30% flat..." icon={FaCoins} />
                        </div>
                        <Input id="loanPurpose" label="Detailed Purpose of Loan Structure" value={loanPurpose} onChange={(e) => setLoanPurpose(e.target.value)} placeholder="Specify use parameters..." />
                    </div>

                    {/* SECTION 2: LOAN HISTORY REGISTRY */}
                    <div className="space-y-4">
                        <h3 className="text-md font-bold text-indigo-700 flex items-center gap-2 border-b border-slate-100 pb-2">
                            <FaListAlt /> Loan History Registry
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Input id="histInstitution" label="Financial Institution Name" value={histInstitution} onChange={(e) => setHistInstitution(e.target.value)} placeholder="e.g. SLCB" />
                            <Input id="histLoanType" label="Loan Type Profile" value={histLoanType} onChange={(e) => setHistLoanType(e.target.value)} placeholder="e.g. Overdraft / Business Term" />
                            <Input id="histOriginalAmount" label="Original Loan Principal amount" type="number" value={histOriginalAmount} onChange={(e) => setHistOriginalAmount(e.target.value)} placeholder="0.00" />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <Input id="histCurrentBalance" label="Current Outstanding Balance" type="number" value={histCurrentBalance} onChange={(e) => setHistCurrentBalance(e.target.value)} placeholder="0.00" />
                            <Input id="histMaturityDate" label="Maturity Date Allocation" type="date" value={histMaturityDate} onChange={(e) => setHistMaturityDate(e.target.value)} />
                            <Input id="histMonthlyPayment" label="Monthly Instalment Amount" type="number" value={histMonthlyPayment} onChange={(e) => setHistMonthlyPayment(e.target.value)} placeholder="0.00" />
                            <Input id="histCollateralPledge" label="Collateral Pledge Reference" value={histCollateralPledge} onChange={(e) => setHistCollateralPledge(e.target.value)} placeholder="Asset pledged details" />
                        </div>
                    </div>

                    {/* DEPOSITS & DEBTS SUMMARY */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="p-4 border border-slate-200 bg-slate-50/50 rounded-xl space-y-3">
                            <h4 className="text-sm font-bold text-indigo-900 border-b border-slate-200 pb-1 flex items-center gap-1">
                                <FaBuilding /> Business Deposit Account
                            </h4>
                            <Input id="depInstitution" label="Financial Institution" value={depInstitution} onChange={(e) => setDepInstitution(e.target.value)} />
                            <Input id="depAccountType" label="Account Type" value={depAccountType} onChange={(e) => setDepAccountType(e.target.value)} placeholder="Current / Corporate Checking" />
                            <Input id="depCurrentBalance" label="Current Statement Balance" type="number" value={depCurrentBalance} onChange={(e) => setDepCurrentBalance(e.target.value)} placeholder="0.00" />
                        </div>

                        <div className="p-4 border border-slate-200 bg-slate-50/50 rounded-xl space-y-3">
                            <h4 className="text-sm font-bold text-indigo-900 border-b border-slate-200 pb-1 flex items-center gap-1">
                                <FaInfoCircle /> Business Debt Obligations
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <Input id="debtInstitution" label="Lending Institution" value={debtInstitution} onChange={(e) => setDebtInstitution(e.target.value)} />
                                <Input id="debtLoanType" label="Loan Type Profile" value={debtLoanType} onChange={(e) => setDebtLoanType(e.target.value)} />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <Input id="debtCurrentBalance" label="Current Balance" type="number" value={debtCurrentBalance} onChange={(e) => setDebtCurrentBalance(e.target.value)} placeholder="0.00" />
                                <Input id="debtCollateral" label="Collateral Reference Asset" value={debtCollateral} onChange={(e) => setDebtCollateral(e.target.value)} />
                            </div>
                            <div className="p-2 bg-white rounded border flex justify-between items-center text-xs mt-1">
                                <span className="font-medium text-slate-700">Is this debt being paid off within this loan structure application?</span>
                                <div className="flex space-x-3">
                                    <label><input type="radio" name="paidOffRadio" value="yes" checked={debtBeingPaidOff === 'yes'} onChange={(e) => setDebtBeingPaidOff(e.target.value)} className="mr-1" /> Yes</label>
                                    <label><input type="radio" name="paidOffRadio" value="no" checked={debtBeingPaidOff === 'no'} onChange={(e) => setDebtBeingPaidOff(e.target.value)} className="mr-1" /> No</label>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* SECTION 3: BUSINESS INFORMATION */}
                    <div className="space-y-4">
                        <h3 className="text-md font-bold text-indigo-700 flex items-center gap-2 border-b border-slate-100 pb-2">
                            <FaBuilding /> Business Framework Information
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input id="bizDescription" label="Comprehensive Description of Enterprise Operations" value={bizDescription} onChange={(e) => setBizDescription(e.target.value)} placeholder="Operational details" />
                            <Input id="bizProductServiceOrder" label="Product or Service Order Parameters" value={bizProductServiceOrder} onChange={(e) => setBizProductServiceOrder(e.target.value)} />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Input id="bizDateEstablished" label="Date Business Established" type="date" value={bizDateEstablished} onChange={(e) => setBizDateEstablished(e.target.value)} />
                            <Input id="bizCurrentOwnershipSince" label="Current Ownership Since (Date)" type="date" value={bizCurrentOwnershipSince} onChange={(e) => setBizCurrentOwnershipSince(e.target.value)} />
                            <Input id="bizStateOfBusiness" label="State/Health of Business Matrix" value={bizStateOfBusiness} onChange={(e) => setBizStateOfBusiness(e.target.value)} placeholder="e.g. Expansive / Stable Growth" />
                        </div>
                    </div>

                    {/* SECTION 4: COLLATERAL INFORMATION DETAILS */}
                    <div className="space-y-4">
                        <h3 className="text-md font-bold text-indigo-700 flex items-center gap-2 border-b border-slate-100 pb-2">
                            <FaShieldAlt /> Collateral & Security Metrics
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input id="collateralDescription" label="Collateral Description or Property Address" value={collateralDescription} onChange={(e) => setCollateralDescription(e.target.value)} placeholder="Location coordinates or precise serial specs" />
                            <Input id="collateralPurchasePrice" label="Purchase Price Assessment value (NLE)" type="number" value={collateralPurchasePrice} onChange={(e) => setCollateralPurchasePrice(e.target.value)} placeholder="0.00" />
                        </div>
                        
                        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">Details of Asset Collateral Documentation</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input id="collateralName" label="Name of the Collateral Asset Assets" value={collateralName} onChange={(e) => setCollateralName(e.target.value)} placeholder="e.g. Unregistered Mercedes Truck / Freehold Document" />
                                <Input id="collateralRegDate" label="Registration Date of the Collateral" type="date" value={collateralRegDate} onChange={(e) => setCollateralRegDate(e.target.value)} />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input id="collateralOwnerName" label="Owner Registered Name" value={collateralOwnerName} onChange={(e) => setCollateralOwnerName(e.target.value)} />
                                <Input id="collateralOwnerAddress" label="Owner Residential Address" value={collateralOwnerAddress} onChange={(e) => setCollateralOwnerAddress(e.target.value)} />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <Input id="collateralOwnerDistrict" label="District" value={collateralOwnerDistrict} onChange={(e) => setCollateralOwnerDistrict(e.target.value)} />
                                <Input id="collateralOwnerTown" label="Town / City" value={collateralOwnerTown} onChange={(e) => setCollateralOwnerTown(e.target.value)} />
                                <Input id="collateralOwnerContact" label="Contact Number" value={collateralOwnerContact} onChange={(e) => setCollateralOwnerContact(e.target.value)} placeholder="76xxxxxx" />
                                <Input id="collateralOwnerNin" label="National Identity Number (NIN)" value={collateralOwnerNin} onChange={(e) => setCollateralOwnerNin(e.target.value)} placeholder="AOxxxxxxxx" />
                            </div>
                        </div>
                    </div>

                    {/* SECTION 5: ALTERNATIVE REVENUE STREAMS */}
                    <div className="space-y-4">
                        <h3 className="text-md font-bold text-indigo-700 flex items-center gap-2 border-b border-slate-100 pb-2">
                            <FaHandHoldingUsd /> Alternative Revenue Metrics
                        </h3>
                        <div className="p-4 border rounded-xl bg-slate-50/50 flex flex-col space-y-3">
                            <div className="flex justify-between items-center text-sm">
                                <span className="font-semibold text-slate-700">Does the applicant have secondary alternative revenue incomes?</span>
                                <div className="flex space-x-4 font-medium">
                                    <label className="flex items-center gap-1 cursor-pointer"><input type="radio" name="altIncomeRadio" value="yes" checked={hasAlternativeIncome === 'yes'} onChange={(e) => setHasAlternativeIncome(e.target.value)} /> Yes</label>
                                    <label className="flex items-center gap-1 cursor-pointer"><input type="radio" name="altIncomeRadio" value="no" checked={hasAlternativeIncome === 'no'} onChange={(e) => setHasAlternativeIncome(e.target.value)} /> No</label>
                                </div>
                            </div>
                            {hasAlternativeIncome === 'yes' && (
                                <Input id="alternativeIncomeDetails" label="Provide Detailed Matrix of Alternative Incomes" value={alternativeIncomeDetails} onChange={(e) => setAlternativeIncomeDetails(e.target.value)} placeholder="Specify salary, rents, other business incomes..." />
                            )}
                        </div>
                    </div>

                    {/* CONTROL BAR ACTION ACTIONS */}
                    <div className="flex justify-end gap-4 border-t pt-6">
                        <button type="button" onClick={handleResetForm} className="px-5 py-2.5 border rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition flex items-center gap-2 shadow-sm">
                            <FaEraser /> Clear Form Fields
                        </button>
                        <button type="submit" disabled={loading} className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold text-sm rounded-xl transition flex items-center gap-2 shadow-md">
                            {loading ? (
                                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                            ) : (
                                <><FaSave /> Save Formulation Record</>
                            )}
                        </button>
                    </div>
                </form>

                {/* --- REAL-TIME LOAN PRODUCTS REGISTRY TABLE --- */}
                <div className="mt-12 border-t pt-8">
                    <div className="mb-4">
                        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                            <FaListAlt className="text-indigo-600" /> Formulated Loan Products Log
                        </h3>
                        <p className="text-xs text-slate-500">Live monitor reflecting all submitted individual loan formulations stored in the database.</p>
                    </div>
                    
                    <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
                        <table className="min-w-full divide-y divide-slate-200 text-sm text-left text-slate-700 bg-white">
                            <thead className="bg-slate-50 font-semibold text-slate-900 text-xs uppercase tracking-wider">
                                <tr>
                                    <th className="px-4 py-3">Loan ID</th>
                                    <th className="px-4 py-3">Client ID</th>
                                    <th className="px-4 py-3">Full Name</th>
                                    <th className="px-4 py-3">Product Type</th>
                                    <th className="px-4 py-3">Amount (NLE)</th>
                                    <th className="px-4 py-3">Duration</th>
                                    <th className="px-4 py-3">Monthly Base</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {loanProductsList.length === 0 ? (
                                    <tr>
                                        <td colSpan="7" className="px-4 py-8 text-center text-slate-400 text-xs italic">
                                            No formulated loan products recorded inside system framework ledger.
                                        </td>
                                    </tr>
                                ) : (
                                    loanProductsList.map((loan) => (
                                        <tr key={loan.id} className="hover:bg-slate-50/80 transition-colors">
                                            <td className="px-4 py-3 font-mono font-bold text-indigo-600">{loan.singleLoanId || 'N/A'}</td>
                                            <td className="px-4 py-3 font-mono text-xs">{loan.personId || 'N/A'}</td>
                                            <td className="px-4 py-3 font-medium text-slate-900">{loan.personFullName || 'N/A'}</td>
                                            <td className="px-4 py-3 text-xs">{loan.loanRequest?.productType || 'N/A'}</td>
                                            <td className="px-4 py-3 font-semibold">{loan.loanRequest?.loanAmount ? `${loan.loanRequest.loanAmount.toLocaleString()} NLE` : '0 NLE'}</td>
                                            <td className="px-4 py-3">{loan.loanRequest?.durationMonths ? `${loan.loanRequest.durationMonths} Mos` : 'N/A'}</td>
                                            <td className="px-4 py-3 font-medium text-emerald-700">{loan.loanRequest?.monthlyRepaymentExpected ? `${loan.loanRequest.monthlyRepaymentExpected} NLE` : 'N/A'}</td>
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