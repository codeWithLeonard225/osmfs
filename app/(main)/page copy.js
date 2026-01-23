"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/app/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { FiEye, FiEyeOff } from "react-icons/fi";
import { useAuth } from "@/app/context/AuthContext";


// 🔗 Dynamic Admin Routes
const getAdminRoute = (type) => {
  switch (type) {
    case "AdminDashboard1":
      return "/Dashboard/AdminDashboard1";
    case "AdminDashboard2":
      return "/Dashboard/AdminDashboard2";


    default:
      return "/";
  }
};


export default function LoginPage() {
  const [branchId, setBranchId] = useState("");
  const [code, setCode] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [showCode, setShowCode] = useState(false);
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);


  const router = useRouter();

  const fetchBranchDetails = async (bId) => {
    try {
      const branchRef = collection(db, "branches");
      const q = query(branchRef, where("branchId", "==", bId));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const branchData = querySnapshot.docs[0].data();
        sessionStorage.setItem("companyShortCode", branchData.companyShortCode);
        return branchData;
      }
    } catch (err) {
      console.error("Error fetching branch details:", err);
    }
    return null;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true); // 🔹 start loading

    try {
      const trimmedBranchId = branchId.trim();
      const trimmedCode = code.trim();
      const trimmedUsername = username.trim().toLowerCase();

      // ================= USER/ADMIN LOGIN =================
      if (trimmedBranchId) {
        const usersRef = collection(db, "users");
        const q = query(
          usersRef,
          where("branchId", "==", trimmedBranchId),
          where("userCode", "==", trimmedCode),
          where("username", "==", trimmedUsername)
        );

        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
          const userData = snapshot.docs[0].data();
          const userRole = userData.role || "staff";

          await fetchBranchDetails(userData.branchId);

          // USE THE CONTEXT LOGIN FUNCTION
          login(userData, userRole);

          if (userRole === "admin") {
            const dashboardPath = userData.dashboardPath || "AdminDashboard";
            const adminRoute = getAdminRoute(dashboardPath);

            router.push(adminRoute);
          } else {
            router.push("/Dashboard/StaffDashboard");
          }
          setLoading(false); // 🔹 stop loading
          return;
        }
      }

      // ================= STAFF LOGIN (Alternative) =================
      const staffRef = collection(db, "staffMembers");
      const staffQ = query(
        staffRef,
        where("staffId", "==", trimmedCode),
        where("branchId", "==", trimmedBranchId)
      );

      const staffSnap = await getDocs(staffQ);
      if (!staffSnap.empty) {
        const staffData = staffSnap.docs[0].data();
        // Check if name matches (handling case sensitivity if needed)
        if (staffData.fullName.toLowerCase() === username.trim().toLowerCase()) {
          await fetchBranchDetails(staffData.branchId);
          sessionStorage.setItem("branchId", staffData.branchId);
          sessionStorage.setItem("role", "staff");
          sessionStorage.setItem("staffData", JSON.stringify(staffData));
          router.push("/StaffPanel");
          setLoading(false);
          return;
        }
      }

      // ================= CEO/OWNER LOGIN =================
      const ceoRef = collection(db, "ceo");
      const ceoQ = query(
        ceoRef,
        where("username", "==", trimmedUsername),
        where("code", "==", trimmedCode)
      );

      const ceoSnap = await getDocs(ceoQ);
      if (!ceoSnap.empty) {
        const ceoData = ceoSnap.docs[0].data();
        sessionStorage.setItem("role", "owner");
        sessionStorage.setItem("ceoData", JSON.stringify(ceoData));
        router.push("/ceopage");
        setLoading(false);
        return;
      }

      setError("Invalid credentials. Please check your details.");
      setLoading(false);
    } catch (err) {
      console.error("Login error:", err);
      setError("Something went wrong.");
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 p-4">
      <div className="bg-white shadow-xl rounded-2xl p-8 w-full max-w-md">
        <h2 className="text-3xl font-bold mb-2 text-center text-blue-900">Online Salone</h2>
        <p className="text-center text-gray-500 mb-8">Microfinance Management System</p>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm font-medium border border-red-100">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block mb-1.5 text-sm font-semibold text-gray-700">Branch ID</label>
            <input
              type="text"
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              placeholder="e.g. 004"
              className="w-full p-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-black"
              required
            />
          </div>

          <div className="relative">
            <label className="block mb-1.5 text-sm font-semibold text-gray-700">Access Code</label>
            <input
              type={showCode ? "text" : "password"}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Enter your code"
              className="w-full p-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-black"
              required
            />
            <span
              className="absolute right-3 cursor-pointer text-gray-400 hover:text-blue-600 transition-colors"
              onClick={() => setShowCode(!showCode)}
            >
              {showCode ? <FiEyeOff size={20} /> : <FiEye size={20} />}
            </span>
          </div>

          <div>
            <label className="block mb-1.5 text-sm font-semibold text-gray-700">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              className="w-full p-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-black"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 rounded-xl font-bold shadow-lg transition-all
    ${loading
                ? "bg-blue-400 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700 shadow-blue-200"
              }`}
          >
            {loading ? (
              <div className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                </svg>
                Loading...
              </div>
            ) : (
              "Sign In"
            )}
          </button>

        </form>
      </div>
    </div>
  );
}