"use client";

import React, { useState, useEffect } from 'react';
import { db } from '@/app/lib/firebase';
import {
  collection,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  onSnapshot,
  query,
  where,
  orderBy
} from 'firebase/firestore';
import { 
  FaIdCard, FaUsers, FaCoins, FaCalendarAlt, FaBriefcase, 
  FaPhone, FaHome, FaBirthdayCake, FaSave, FaEraser, FaBuilding, 
  FaEdit, FaTrashAlt, FaTable 
} from 'react-icons/fa';

// Constants for drop-downs
const SIERRA_LEONE_DISTRICTS = [
  "Bo", "Bombali", "Bonthe", "Falaba", "Freetown (Western Area Urban)", 
  "Kailahun", "Kambia", "Karene", "Kenema", "Koinadugu", "Kono", "Moyamba", 
  "Port Loko", "Pujehun", "Tonkolili", "Western Area Rural"
];

const TOWNS = [
  "Freetown", "Bo", "Makeni", "Kenema", "Koidu", "Lunsar", "Port Loko", 
  "Waterloo", "Kabala", "Segbwema", "Magburaka", "Bonthe"
];

const RELATIONSHIPS = [
  "Spouse", "Parent", "Child", "Sibling", "Uncle", "Aunt", "Cousin", "Nephew", "Niece", "Other"
];

const OWNERSHIP_TYPES = [
  "Individual", "General Partnership", "Corporation", "Trust", "Limited Partnership", "Limited Liability Corporation"
];

// Reusable Input Component
const Input = ({ label, type = "text", value, onChange, placeholder, icon: Icon, readOnly = false }) => (
  <div className="flex flex-col space-y-1 w-full">
    <label className="text-sm font-medium text-gray-700">{label}</label>
    <div className="relative rounded-md shadow-sm">
      {Icon && (
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
          <Icon className="h-4 w-4" />
        </div>
      )}
      <input
        type={type}
        value={value}
        onChange={onChange}
        readOnly={readOnly}
        placeholder={placeholder}
        className={`w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 bg-white text-black text-sm ${
          Icon ? 'pl-10' : 'pl-3'
        } ${readOnly ? 'bg-gray-100 cursor-not-allowed' : ''}`}
      />
    </div>
  </div>
);

export default function IndividualLoanForm() {
  // Sync Data Lists for Auto-ID sequential check
  const [loanApplicationsList, setLoanApplicationsList] = useState([]);
  const [companyShortCode, setCompanyShortCode] = useState('PMC'); 
  const [currentBranchId, setCurrentBranchId] = useState(''); // Tracking dynamic branch identity
  const [editingClientId, setEditingClientId] = useState(null); // Stores document ID being updated

  // Client Identity State
  const [clientId, setClientId] = useState('');
  const [registrationDate, setRegistrationDate] = useState('');
  const [personFullName, setPersonFullName] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [occupation, setOccupation] = useState('');
  const [telephone, setTelephone] = useState('');
  const [gmail, setGmail] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [placeOfBirth, setPlaceOfBirth] = useState('');
  const [nationality, setNationality] = useState('Sierra Leonean');
  const [gender, setGender] = useState('');
  const [maritalStatus, setMaritalStatus] = useState('');
  const [address, setAddress] = useState('');
  const [district, setDistrict] = useState('');
  const [town, setTown] = useState('');
  const [dependentsCount, setDependentsCount] = useState('');

  // Spouse / Parent State
  const [spouseFullName, setSpouseFullName] = useState('');
  const [spouseNationalId, setSpouseNationalId] = useState('');
  const [spousePhone, setSpousePhone] = useState('');
  const [spouseGmail, setSpouseGmail] = useState('');
  const [spouseAddress, setSpouseAddress] = useState('');
  const [spouseDistrict, setSpouseDistrict] = useState('');
  const [spouseTown, setSpouseTown] = useState('');

  // Next of Kin State
  const [nokName, setNokName] = useState('');
  const [nokRelationship, setNokRelationship] = useState('');
  const [nokIdNo, setNokIdNo] = useState('');
  const [nokPhone, setNokPhone] = useState('');

  // Borrowing Entity (Business) State
  const [businessName, setBusinessName] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [businessDistrict, setBusinessDistrict] = useState('');
  const [businessTown, setBusinessTown] = useState('');
  const [businessPhone, setBusinessPhone] = useState('');
  const [businessGmail, setBusinessGmail] = useState('');
  const [businessDescription, setBusinessDescription] = useState('');
  const [tinNumber, setTinNumber] = useState('');
  const [establishmentDate, setEstablishmentDate] = useState('');
  const [annualRevenue, setAnnualRevenue] = useState('');
  const [employeeCount, setEmployeeCount] = useState('');
  const [registeredOwner, setRegisteredOwner] = useState('');
  const [businessRegDate, setBusinessRegDate] = useState('');
  const [revenueUnderThreshold, setRevenueUnderThreshold] = useState('');
  const [ownershipType, setOwnershipType] = useState('');
  const [taxIdNumber, setTaxIdNumber] = useState('');

  // Bank Relationship State
  const [bankName, setBankName] = useState('');
  const [accountType, setAccountType] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [avgBalance, setAvgBalance] = useState('');

  // Status Indicators
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // 1. Load Session Data & Set Default Registration Date
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setRegistrationDate(today);

    if (typeof window !== 'undefined') {
      const keys = Object.keys(sessionStorage);
      let foundData = null;

      keys.forEach(key => {
        const val = sessionStorage.getItem(key);
        if (val && val.includes("companyShortCode")) {
          try {
            foundData = JSON.parse(val);
          } catch (e) { console.error("Session parse failed", e); }
        }
      });

      if (foundData) {
        if (foundData.companyShortCode) setCompanyShortCode(foundData.companyShortCode);
        if (foundData.branchId) setCurrentBranchId(foundData.branchId);
      } else {
        setCompanyShortCode(sessionStorage.getItem('companyShortCode') || 'PMC');
        setCurrentBranchId(sessionStorage.getItem('branchId') || '');
      }
    }
  }, []);

  // 2. Real-Time Fetch Existing Applications (Ordered by descending creation)
 // 2. Real-Time Fetch Existing Applications (Filtered by Branch & ordered by descending creation)
  useEffect(() => {
    // Prevent fetching if branchId hasn't loaded from sessionStorage yet
    if (!currentBranchId) return;

    // Query elements matching the current logged-in branch
    const q = query(
      collection(db, 'individual_loans'), 
      where('branchId', '==', currentBranchId),
      // orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedLoans = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      setLoanApplicationsList(fetchedLoans);
    }, (error) => {
      console.error("Firestore Registry Filter Error:", error);
    });

    return () => unsubscribe();
  }, [currentBranchId]); // Triggers immediately once the branch ID is resolved

  // 3. SMART AUTO-ID GENERATION (Regex Incrementor with -ILD-)
  useEffect(() => {
    if (!editingClientId) {
      const code = (companyShortCode || "PMC").toLowerCase();

      const latestLoanNumber = loanApplicationsList.reduce((max, loan) => {
        const regex = new RegExp(`^${code}-ild-(\\d+)$`, 'i');
        const numMatch = (loan.clientId || "").match(regex);
        const num = numMatch ? parseInt(numMatch[1], 10) : 0;
        return num > max ? num : max;
      }, 0);

      const newNumber = latestLoanNumber + 1;
      const formattedId = `${code.toUpperCase()}-ILD-${String(newNumber).padStart(2, '0')}`;
      setClientId(formattedId);
    }
  }, [loanApplicationsList, editingClientId, companyShortCode]);

  // Clear Form Handler
  const handleClearForm = () => {
    setPersonFullName('');
    setNationalId('');
    setOccupation('');
    setTelephone('');
    setGmail('');
    setDateOfBirth('');
    setPlaceOfBirth('');
    setGender('');
    setMaritalStatus('');
    setAddress('');
    setDistrict('');
    setTown('');
    setDependentsCount('');
    setSpouseFullName('');
    setSpouseNationalId('');
    setSpousePhone('');
    setSpouseGmail('');
    setSpouseAddress('');
    setSpouseDistrict('');
    setSpouseTown('');
    setNokName('');
    setNokRelationship('');
    setNokIdNo('');
    setNokPhone('');
    setBusinessName('');
    setBusinessAddress('');
    setBusinessDistrict('');
    setBusinessTown('');
    setBusinessPhone('');
    setBusinessGmail('');
    setBusinessDescription('');
    setTinNumber('');
    setEstablishmentDate('');
    setAnnualRevenue('');
    setEmployeeCount('');
    setRegisteredOwner('');
    setBusinessRegDate('');
    setRevenueUnderThreshold('');
    setOwnershipType('');
    setTaxIdNumber('');
    setBankName('');
    setAccountType('');
    setAccountNumber('');
    setAvgBalance('');
    setMessage({ type: '', text: '' });
    setEditingClientId(null); 
  };

  // Populate form fields for editing
  const handleEditInit = (loan) => {
    setEditingClientId(loan.id);
    setClientId(loan.clientId || '');
    setRegistrationDate(loan.registrationDate || '');
    setPersonFullName(loan.personFullName || '');
    setNationalId(loan.nationalId || '');
    setOccupation(loan.occupation || '');
    setTelephone(loan.telephone || '');
    setGmail(loan.gmail || '');
    setDateOfBirth(loan.dateOfBirth || '');
    setPlaceOfBirth(loan.placeOfBirth || '');
    setNationality(loan.nationality || 'Sierra Leonean');
    setGender(loan.gender || '');
    setMaritalStatus(loan.maritalStatus || '');
    setAddress(loan.address || '');
    setDistrict(loan.district || '');
    setTown(loan.town || '');
    setDependentsCount(loan.dependentsCount || '');

    // Nested Maps
    if (loan.spouseInfo) {
      setSpouseFullName(loan.spouseInfo.fullName || '');
      setSpouseNationalId(loan.spouseInfo.nationalId || '');
      setSpousePhone(loan.spouseInfo.phone || '');
      setSpouseGmail(loan.spouseInfo.gmail || '');
      setSpouseAddress(loan.spouseInfo.address || '');
      setSpouseDistrict(loan.spouseInfo.district || '');
      setSpouseTown(loan.spouseInfo.town || '');
    }

    if (loan.nextOfKin) {
      setNokName(loan.nextOfKin.name || '');
      setNokRelationship(loan.nextOfKin.relationship || '');
      setNokIdNo(loan.nextOfKin.idNo || '');
      setNokPhone(loan.nextOfKin.phone || '');
    }

    if (loan.businessDetails) {
      setBusinessName(loan.businessDetails.businessName || '');
      setBusinessAddress(loan.businessDetails.mailingAddress || '');
      setBusinessDistrict(loan.businessDetails.district || '');
      setBusinessTown(loan.businessDetails.town || '');
      setBusinessPhone(loan.businessDetails.businessPhone || '');
      setBusinessGmail(loan.businessDetails.businessGmail || '');
      setBusinessDescription(loan.businessDetails.businessDescription || '');
      setTinNumber(loan.businessDetails.tinNumber || '');
      setEstablishmentDate(loan.businessDetails.establishmentDate || '');
      setAnnualRevenue(loan.businessDetails.annualRevenue || '');
      setEmployeeCount(loan.businessDetails.employeeCount || '');
      setRegisteredOwner(loan.businessDetails.registeredOwner || '');
      setBusinessRegDate(loan.businessDetails.businessRegDate || '');
      setRevenueUnderThreshold(loan.businessDetails.revenueUnderThreshold || '');
      setOwnershipType(loan.businessDetails.ownershipType || '');
      setTaxIdNumber(loan.businessDetails.taxIdNumber || '');
    }

    if (loan.bankRelationship) {
      setBankName(loan.bankRelationship.bankName || '');
      setAccountType(loan.bankRelationship.accountType || '');
      setAccountNumber(loan.bankRelationship.accountNumber || '');
      setAvgBalance(loan.bankRelationship.avgBalance || '');
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Delete Record Handler
  const handleDelete = async (id, idTag) => {
    if (window.confirm(`Are you sure you want to permanently delete record ${idTag}?`)) {
      try {
        await deleteDoc(doc(db, 'individual_loans', id));
        setMessage({ type: 'success', text: `Record (${idTag}) deleted successfully.` });
      } catch (err) {
        console.error("Delete failed", err);
        setMessage({ type: 'error', text: 'Failed to delete record.' });
      }
    }
  };

  // Submit Handler to Firebase (Handles both Add and Update Actions)
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    const trimmedFullName = personFullName.trim();
    const trimmedTelephone = telephone.trim();

    if (!trimmedFullName || !trimmedTelephone) {
      setMessage({ type: 'error', text: 'Please fill in all mandatory fields (Full Name and Contact Number).' });
      setLoading(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    try {
      const comprehensiveLoanData = {
        clientId: clientId.trim(),
        branchId: currentBranchId, // Successfully passed alongside core payloads
        registrationDate: registrationDate.trim(),
        personFullName: trimmedFullName,
        nationalId: nationalId.trim(),
        occupation: occupation.trim(),
        telephone: trimmedTelephone,
        gmail: gmail.trim().toLowerCase(),
        dateOfBirth: dateOfBirth.trim(),
        placeOfBirth: placeOfBirth.trim(),
        nationality: nationality.trim(),
        gender: gender,
        maritalStatus: maritalStatus,
        address: address.trim(),
        district: district,
        town: town,
        dependentsCount: dependentsCount ? parseInt(dependentsCount, 10) : 0,

        spouseInfo: {
          fullName: spouseFullName.trim(),
          nationalId: spouseNationalId.trim(),
          phone: spousePhone.trim(),
          gmail: spouseGmail.trim().toLowerCase(),
          address: spouseAddress.trim(),
          district: spouseDistrict,
          town: spouseTown
        },

        nextOfKin: {
          name: nokName.trim(),
          relationship: nokRelationship,
          idNo: nokIdNo.trim(),
          phone: nokPhone.trim()
        },

        businessDetails: {
          businessName: businessName.trim(),
          mailingAddress: businessAddress.trim(),
          district: businessDistrict,
          town: businessTown,
          businessPhone: businessPhone.trim(),
          businessGmail: businessGmail.trim().toLowerCase(),
          businessDescription: businessDescription.trim(),
          tinNumber: tinNumber.trim(),
          establishmentDate: establishmentDate.trim(),
          annualRevenue: annualRevenue ? parseFloat(annualRevenue) : 0,
          employeeCount: employeeCount ? parseInt(employeeCount, 10) : 0,
          registeredOwner: registeredOwner.trim(),
          businessRegDate: businessRegDate.trim(),
          revenueUnderThreshold: revenueUnderThreshold,
          ownershipType: ownershipType,
          taxIdNumber: ownershipType === "Trust" ? taxIdNumber.trim() : ""
        },

        bankRelationship: {
          bankName: bankName.trim(),
          accountType: accountType.trim(),
          accountNumber: accountNumber.trim(),
          avgBalance: avgBalance ? parseFloat(avgBalance) : 0
        },

        updatedAt: serverTimestamp()
      };

      if (editingClientId) {
        // Update Action
        await updateDoc(doc(db, 'individual_loans', editingClientId), comprehensiveLoanData);
        setMessage({ type: 'success', text: `Registry Profile Updates saved successfully for ${clientId}!` });
      } else {
        // Create Action
        comprehensiveLoanData.createdAt = serverTimestamp();
        await addDoc(collection(db, 'individual_loans'), comprehensiveLoanData);
        setMessage({ type: 'success', text: `Comprehensive Registry Application (${clientId}) saved successfully!` });
      }

      handleClearForm();
    } catch (error) {
      console.error("Error saving document: ", error);
      setMessage({ type: 'error', text: 'Application submission failed. Please try again.' });
    } finally {
      setLoading(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8 space-y-8">
      
      {/* PROFILE COLLECTION FORM CONTEXT CONTAINER */}
      <div className="max-w-4xl mx-auto bg-white p-6 sm:p-8 rounded-2xl shadow-md border border-gray-100">
        
        {/* Form Title Heading */}
        <div className="text-center mb-8 border-b pb-4">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
            Individual Registry Profile Form
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            {editingClientId ? 'Modify parameters for chosen sequential identifier record entry.' : 'Comprehensive registry capturing personal identity, sequential ILD metrics, business details, and banking footprints.'}
          </p>
        </div>

        {/* Dynamic Alert Messages */}
        {message.text && (
          <div className={`p-4 rounded-xl mb-6 text-sm font-semibold transition-all ${
            message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* SECTION 1: CLIENT INFORMATION */}
          <div className="space-y-4">
            <h3 className="text-md font-bold text-indigo-700 flex items-center gap-2 border-b border-gray-100 pb-2">
              <FaIdCard /> Client Information {editingClientId && <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-normal">Editing State Active</span>}
            </h3>
            
            <div className="grid grid-cols-1 gap-4">
              <Input label="Full Name *" value={personFullName} onChange={(e) => setPersonFullName(e.target.value)} placeholder="e.g. Alimamy Fofanah" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input label="Client ID" value={clientId} readOnly icon={FaBriefcase} />
              <Input label="Reg. Date" type="date" value={registrationDate} onChange={(e) => setRegistrationDate(e.target.value)} icon={FaCalendarAlt} />
              <Input label="Client NIN Number" value={nationalId} onChange={(e) => setNationalId(e.target.value)} placeholder="National ID Card No." />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input label="Occupation" value={occupation} onChange={(e) => setOccupation(e.target.value)} />
              <Input label="Contact Number *" value={telephone} onChange={(e) => setTelephone(e.target.value)} icon={FaPhone} />
              <Input label="Gmail Address" type="email" value={gmail} onChange={(e) => setGmail(e.target.value)} placeholder="example@gmail.com" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input label="Date of Birth" type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} icon={FaBirthdayCake} />
              <Input label="Place of Birth" value={placeOfBirth} onChange={(e) => setPlaceOfBirth(e.target.value)} />
              <Input label="Nationality" value={nationality} onChange={(e) => setNationality(e.target.value)} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="flex flex-col space-y-1">
                <label className="text-sm font-medium text-gray-700">Gender</label>
                <select value={gender} onChange={(e) => setGender(e.target.value)} className="p-2 border rounded-md bg-white text-black text-sm focus:ring-2 focus:ring-indigo-500">
                  <option value="">Select Gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>
              <div className="flex flex-col space-y-1">
                <label className="text-sm font-medium text-gray-700">District</label>
                <select value={district} onChange={(e) => setDistrict(e.target.value)} className="p-2 border border-gray-300 rounded-md bg-white text-black text-sm focus:ring-2 focus:ring-indigo-500">
                  <option value="">Select District</option>
                  {SIERRA_LEONE_DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="flex flex-col space-y-1">
                <label className="text-sm font-medium text-gray-700">Town</label>
                <select value={town} onChange={(e) => setTown(e.target.value)} className="p-2 border border-gray-300 rounded-md bg-white text-black text-sm focus:ring-2 focus:ring-indigo-500">
                  <option value="">Select Town</option>
                  {TOWNS.map(t => <option key={t} value={t}>{t}</option>)}
                  <option value="Other">Other...</option>
                </select>
              </div>
              <div className="flex flex-col space-y-1">
                <label className="text-sm font-medium text-gray-700">Marital Status</label>
                <select value={maritalStatus} onChange={(e) => setMaritalStatus(e.target.value)} className="p-2 border rounded-md bg-white text-black text-sm focus:ring-2 focus:ring-indigo-500">
                  <option value="">Select...</option>
                  <option value="Single">Single</option>
                  <option value="Married">Married</option>
                  <option value="Divorce">Divorce</option>
                  <option value="Widow">Widow</option>
                  <option value="Widower">Widower</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Mailing Address" value={address} onChange={(e) => setAddress(e.target.value)} icon={FaHome} />
              <Input label="No. of Dependents of children" type="number" value={dependentsCount} onChange={(e) => setDependentsCount(e.target.value)} />
            </div>
          </div>

          {/* SPOUSE OR PARENT RELATIONSHIP INFORMATION BLOCK */}
          <div className="p-4 bg-indigo-50/60 border border-indigo-100 rounded-xl space-y-4">
            <h4 className="text-sm font-bold text-indigo-900">Spouse / Parent Information</h4>
            <div className="grid grid-cols-1 gap-4">
              <Input label="Spouse/Parent Full Name" value={spouseFullName} onChange={(e) => setSpouseFullName(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input label="Spouse/Parent ID.NO" value={spouseNationalId} onChange={(e) => setSpouseNationalId(e.target.value)} />
              <Input label="Contact Number" value={spousePhone} onChange={(e) => setSpousePhone(e.target.value)} icon={FaPhone} />
              <Input label="Gmail Address" type="email" value={spouseGmail} onChange={(e) => setSpouseGmail(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input label="Spouse/Parent Address" value={spouseAddress} onChange={(e) => setSpouseAddress(e.target.value)} icon={FaHome} />
              <div className="flex flex-col space-y-1">
                <label className="text-sm font-medium text-gray-700">Spouse/Parent District</label>
                <select value={spouseDistrict} onChange={(e) => setSpouseDistrict(e.target.value)} className="p-2 border border-gray-300 rounded-md bg-white text-black text-sm focus:ring-2 focus:ring-indigo-500">
                  <option value="">Select District</option>
                  {SIERRA_LEONE_DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="flex flex-col space-y-1">
                <label className="text-sm font-medium text-gray-700">Spouse/Parent Town</label>
                <select value={spouseTown} onChange={(e) => setSpouseTown(e.target.value)} className="p-2 border border-gray-300 rounded-md bg-white text-black text-sm focus:ring-2 focus:ring-indigo-500">
                  <option value="">Select Town</option>
                  {TOWNS.map(t => <option key={t} value={t}>{t}</option>)}
                  <option value="Other">Other...</option>
                </select>
              </div>
            </div>
          </div>

          {/* SECTION 2: NEXT OF KIN */}
          <div className="space-y-4 pt-2">
            <h3 className="text-md font-bold text-indigo-700 flex items-center gap-2 border-b border-gray-100 pb-2">
              <FaUsers /> Next of Kin
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Next of Kin Name" value={nokName} onChange={(e) => setNokName(e.target.value)} />
              <div className="flex flex-col space-y-1">
                <label className="text-sm font-medium text-gray-700">Relationship</label>
                <select value={nokRelationship} onChange={(e) => setNokRelationship(e.target.value)} className="p-2 border border-gray-300 rounded-md bg-white text-black text-sm focus:ring-2 focus:ring-indigo-500">
                  <option value="">Select Relationship</option>
                  {RELATIONSHIPS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Next of Kin ID.NO" value={nokIdNo} onChange={(e) => setNokIdNo(e.target.value)} />
              <Input label="Telephone Number" value={nokPhone} onChange={(e) => setNokPhone(e.target.value)} icon={FaPhone} />
            </div>
          </div>

          {/* SECTION 3: BORROWING ENTITY INFORMATION */}
          <div className="space-y-4 pt-2">
            <h3 className="text-md font-bold text-indigo-700 flex items-center gap-2 border-b border-gray-100 pb-2">
              <FaBuilding /> Borrowing Entity Information (Business)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Business Legal Name" value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="e.g. Fofanah & Sons Enterprise" />
              <Input label="Name of Registered Owner" value={registeredOwner} onChange={(e) => setRegisteredOwner(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input label="Mailing Address" value={businessAddress} onChange={(e) => setBusinessAddress(e.target.value)} icon={FaHome} />
              <div className="flex flex-col space-y-1">
                <label className="text-sm font-medium text-gray-700">District</label>
                <select value={businessDistrict} onChange={(e) => setBusinessDistrict(e.target.value)} className="p-2 border border-gray-300 rounded-md bg-white text-black text-sm focus:ring-2 focus:ring-indigo-500">
                  <option value="">Select District</option>
                  {SIERRA_LEONE_DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="flex flex-col space-y-1">
                <label className="text-sm font-medium text-gray-700">Town</label>
                <select value={businessTown} onChange={(e) => setBusinessTown(e.target.value)} className="p-2 border border-gray-300 rounded-md bg-white text-black text-sm focus:ring-2 focus:ring-indigo-500">
                  <option value="">Select Town</option>
                  {TOWNS.map(t => <option key={t} value={t}>{t}</option>)}
                  <option value="Other">Other...</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Business Contact Number" value={businessPhone} onChange={(e) => setBusinessPhone(e.target.value)} icon={FaPhone} />
              <Input label="Business Gmail" type="email" value={businessGmail} onChange={(e) => setBusinessGmail(e.target.value)} placeholder="business@gmail.com" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Business Tin No" value={tinNumber} onChange={(e) => setTinNumber(e.target.value)} />
              <Input label="Year Of Establishment" type="date" value={establishmentDate} onChange={(e) => setEstablishmentDate(e.target.value)} icon={FaCalendarAlt} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input label="Annual Revenue" type="number" value={annualRevenue} onChange={(e) => setAnnualRevenue(e.target.value)} placeholder="0.00" icon={FaCoins} />
              <Input label="Number of Employees" type="number" value={employeeCount} onChange={(e) => setEmployeeCount(e.target.value)} />
              <Input label="Business Registration Date" type="date" value={businessRegDate} onChange={(e) => setBusinessRegDate(e.target.value)} icon={FaCalendarAlt} />
            </div>
            <div className="flex flex-col space-y-1">
              <label className="text-sm font-medium text-gray-700">Business Description</label>
              <textarea
                value={businessDescription}
                onChange={(e) => setBusinessDescription(e.target.value)}
                placeholder="Describe your business operations..."
                rows={2}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 bg-white text-black text-sm"
              />
            </div>
            
            <div className="p-3 bg-gray-50 border rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-sm font-medium text-gray-800">Were Gross annual revenue in the previous social Year NLE100,000 or less?</span>
              <div className="flex space-x-4">
                <label className="inline-flex items-center text-sm text-black">
                  <input type="radio" name="revenueThreshold" value="YES" checked={revenueUnderThreshold === "YES"} onChange={(e) => setRevenueUnderThreshold(e.target.value)} className="mr-2" /> YES
                </label>
                <label className="inline-flex items-center text-sm text-black">
                  <input type="radio" name="revenueThreshold" value="NO" checked={revenueUnderThreshold === "NO"} onChange={(e) => setRevenueUnderThreshold(e.target.value)} className="mr-2" /> NO
                </label>
              </div>
            </div>

            {/* TYPES OF BUSINESS OWNERSHIPS */}
            <div className="space-y-2 pt-2">
              <label className="text-sm font-semibold text-gray-700">The Types of Business Ownerships</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {OWNERSHIP_TYPES.map((type) => (
                  <label key={type} className={`p-2 border rounded-xl flex items-center cursor-pointer transition text-sm ${
                    ownershipType === type ? 'border-indigo-600 bg-indigo-50 text-indigo-900 font-semibold' : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                  }`}>
                    <input type="radio" name="ownershipType" value={type} checked={ownershipType === type} onChange={(e) => setOwnershipType(e.target.value)} className="mr-2 h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500" />
                    {type}
                  </label>
                ))}
              </div>
            </div>

            {ownershipType === "Trust" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <Input label="Tax ID Number (Required for Trusts)" value={taxIdNumber} onChange={(e) => setTaxIdNumber(e.target.value)} placeholder="Enter trust tax reference number" />
              </div>
            )}
          </div>

          {/* SECTION 4: BANK RELATIONSHIP */}
          <div className="space-y-4 pt-2">
            <h3 className="text-md font-bold text-indigo-700 flex items-center gap-2 border-b border-gray-100 pb-2">
              <FaBuilding /> Bank Relationship
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Bank Name" value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="e.g. SLCB, Rokel Bank" />
              <Input label="Account Type" value={accountType} onChange={(e) => setAccountType(e.target.value)} placeholder="Savings / Current" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Account Number" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} />
              <Input label="Average Balance (NLE)" type="number" value={avgBalance} onChange={(e) => setAvgBalance(e.target.value)} placeholder="0.00" icon={FaCoins} />
            </div>
          </div>

          {/* FORM ACTIONS FOOTER CONTROL BAR */}
          <div className="flex gap-4 pt-4 border-t">
            <button type="button" onClick={handleClearForm} className="w-1/3 py-2.5 border rounded-xl font-bold text-sm text-gray-600 bg-white hover:bg-gray-50 transition shadow-sm flex items-center justify-center gap-2">
              <FaEraser /> Clear / Cancel
            </button>
            <button type="submit" disabled={loading} className="w-2/3 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl transition shadow-md flex items-center justify-center gap-2">
              {loading ? (
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              ) : (
                <><FaSave /> {editingClientId ? 'Save Structural Changes' : 'Submit Application Record'}</>
              )}
            </button>
          </div>

        </form>
      </div>

      {/* --- DASHBOARD MONITORING REGISTRY TABLE --- */}
      <div className="max-w-4xl mx-auto bg-white p-6 rounded-2xl shadow-md border border-gray-100">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4 pb-2 border-b">
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><FaTable className="text-indigo-600" /> Active Registry Data Streams</h2>
            <p className="text-xs text-gray-500">Live operational telemetry displaying active profiles filed under collection cluster index.</p>
          </div>
          <span className="bg-indigo-50 border text-indigo-700 text-xs font-bold px-3 py-1 rounded-full">Total: {loanApplicationsList.length} Active Records</span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm text-left text-slate-700 bg-white">
            <thead className="bg-slate-50 font-semibold text-slate-900 text-xs uppercase">
              <tr>
                <th className="px-4 py-3">Client ID</th>
                <th className="px-4 py-3">Full Name</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Business Name</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {loanApplicationsList.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-4 py-8 text-center text-slate-400 italic">No indexed entries detected on this schema node cluster.</td>
                </tr>
              ) : (
                loanApplicationsList.map((loan) => (
                  <tr key={loan.id} className="hover:bg-slate-50 transition">
                    <td className="px-4 py-3 font-mono font-bold text-indigo-600 uppercase">{loan.clientId || 'N/A'}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{loan.personFullName || 'N/A'}</td>
                    <td className="px-4 py-3 text-slate-600">{loan.telephone || 'N/A'}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{loan.businessDetails?.businessName || 'N/A'}</td>
                    <td className="px-4 py-3 text-center flex items-center justify-center gap-2">
                      <button onClick={() => handleEditInit(loan)} className="p-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-100 transition shadow-sm" title="Edit Record"><FaEdit size={14} /></button>
                      <button onClick={() => handleDelete(loan.id, loan.clientId)} className="p-1.5 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 transition shadow-sm" title="Delete Record"><FaTrashAlt size={14} /></button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}