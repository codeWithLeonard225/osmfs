"use client";
export const dynamic = "force-dynamic";

// app/(dashboard)/owner/page.jsx

import React, { useState, useEffect } from "react";
import { MdDashboard, MdAttachMoney, MdAssignmentTurnedIn, MdLibraryBooks, MdMenuBook, MdKeyboardArrowDown } from "react-icons/md";
import { useAuth } from "@/app/context/AuthContext";
import { useRouter } from "next/navigation";
import StaffForm from "../../Forms/StaffForm/page";
import ClientDetails from "../../Forms/ClientForm/page";
import Principal from "../../Load/Principal/page";
import Savings from "../../Load/Savings/page";
import Withdrawal from "../../Load/Withdrawal/page";
import GroupStaffReport from "../../Reports/StaffLoan/page";
import ClientLoanOutstanding from "../../Reports/ClientLoanOutstanding/page";




// --- Sidebar navigation items ---
const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard", icon: <MdDashboard /> },

  {
    key: "staffReg",
    label: "Registerations",
    icon: <MdDashboard />,
    children: [
      { key: "staffform", label: "Register Staff" },
      { key: "clientform", label: "Register Client " },
      { key: "staffRoles", label: "Staff Roles" },
    ],
  },

  {
    key: "loan",
    label: "Loan",
    icon: <MdAssignmentTurnedIn />,
    children: [
      { key: "Principal", label: "Principal" },
      { key: "Savings", label: "Savings" },
      { key: "Withdrawal", label: "Withdrawal" },
    ],
  },



  {
    key: "reports",
    label: "Reports",
    icon: <MdLibraryBooks />,
    children: [
      { key: "GroupStaffReport", label: "StaffLoan " },
      { key: "ClientLoanOutstanding", label: "Client Loan Outstanding" },
      { key: "loanHistory", label: "Loan History" },
    ],
  },

  { key: "BranchManagement", label: "Branch Management", icon: <MdLibraryBooks /> },
  { key: "OwnerLoginHistory", label: "Attendance", icon: <MdLibraryBooks /> },
];


// --- Button component ---
const Button = ({ variant = "default", onClick, className = "", children }) => {
  let baseStyles = "inline-flex items-center justify-start whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-950 disabled:pointer-events-none disabled:opacity-50";
  let variantStyles = variant === "default"
    ? "bg-indigo-600 text-white shadow hover:bg-indigo-700"
    : "hover:bg-indigo-100 hover:text-indigo-700 text-gray-700";

  return (
    <button onClick={onClick} className={`${baseStyles} ${variantStyles} ${className} h-9 px-4 py-2 justify-start`}>
      {children}
    </button>
  );
};

// --- Main Owner Dashboard ---
export default function AdminDashboard() {
 
  const router = useRouter();

  const [activeTab, setActiveTab] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null);
  // Inside app/(dashboard)/admin/page.jsx
const { user, loading } = useAuth();

useEffect(() => {
  if (!loading) {
    const savedPath = sessionStorage.getItem("authorizedPath");
    const currentUrl = window.location.pathname.split("/").pop();

    // If role is wrong OR they are on the wrong URL segment
    if (user?.role !== "admin" || (currentUrl !== savedPath && savedPath !== "default")) {
      router.replace("/");
    }
  }
}, [user, loading, router]);


// THE DOUBLE LOCK: 
  // If loading or the role doesn't match, return a blank screen or loader.
  // This prevents manual URL entry from showing the UI.
  if (loading || !user || user.role !== "admin") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-700"></div>
      </div>
    );
  }

  // ONLY now do we define variables like initials
  const ownerName = user.data.username || "Admin";
  // ... rest of your component
 

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <p className="text-xl font-semibold text-indigo-700">
          {loading ? "Verifying Session..." : "Unauthorized Access"}
        </p>
      </div>
    );
  }


  const ownerId = user.data.ownerID || "N/A";
  const initials = ownerName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);

  // --- Render sidebar nav items ---
  const renderNavItems = (items) =>
    items.map((item) => (
      <div key={item.key} className="mb-1">
        {item.children ? (
          <>
            <Button
              variant={openDropdown === item.key ? "default" : "ghost"}
              onClick={() => setOpenDropdown(openDropdown === item.key ? null : item.key)}
              className="w-full flex items-center justify-between gap-2 text-base py-2"
            >
              <div className="flex items-center gap-2">{item.icon} {item.label}</div>
              <MdKeyboardArrowDown className={`transition-transform ${openDropdown === item.key ? "rotate-180" : ""}`} />
            </Button>

            {openDropdown === item.key && (
              <div className="pl-6 mt-1 space-y-1">
                {item.children.map(child => (
                  <Button
                    key={child.key}
                    variant={activeTab === child.key ? "default" : "ghost"}
                    onClick={() => setActiveTab(child.key)}
                    className="w-full text-sm py-1"
                  >
                    {child.label}
                  </Button>
                ))}
              </div>
            )}
          </>
        ) : (
          <Button
            variant={activeTab === item.key ? "default" : "ghost"}
            onClick={() => { setActiveTab(item.key); setOpenDropdown(null); }}
            className="w-full flex items-center gap-2 text-base py-2"
          >
            {item.icon} {item.label}
          </Button>
        )}
      </div>
    ));

  // --- Render main content ---
  const renderContent = () => {
    switch (activeTab) {
      case "dashboard":
        return (
          <div className="p-6 bg-white rounded-xl shadow-md">
            <h2 className="text-2xl font-bold text-gray-700">Welcome, {ownerName}!</h2>
            <p className="mt-2 text-gray-600">Owner ID: {ownerId}</p>
            <p className="mt-1 text-gray-500">Select an item from the sidebar to get started.</p>
          </div>
        );
      case "staffform":
        return <StaffForm/>;
      case "clientform":
        return <ClientDetails/>;
      case "Principal":
        return <Principal/>;
      case "Savings":
        return <Savings/>;
      case "Withdrawal":
        return <Withdrawal/>;
      case "GroupStaffReport":
        return <GroupStaffReport/>;
      case "ClientLoanOutstanding":
        return <ClientLoanOutstanding/>;
      case "approvals":
        return <div>ApprovalsPage</div>;
      case "rates":
        return <div>RatesPage</div>
    //   case "Loan":
    //     return <Loan/>;
    //   case "BranchAllocation":
    //     return <BranchAllocation/>;
    //   case "BranchManagement":
    //     return <BranchManagement/>;
    //   case "OwnerLoginHistory":
    //     return <OwnerLoginHistory/>;
      default:
        return (
          <div className="p-6 bg-white rounded-xl shadow-md">
            <h2 className="text-2xl font-bold text-gray-700">Content for: {activeTab.toUpperCase()}</h2>
            <p className="mt-2 text-gray-500">This module is under development.</p>
          </div>
        );
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 font-sans">

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-40 w-64 bg-white p-4 border-r shadow-lg transform transition-transform duration-300
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0 md:static`}>
        
        {/* Owner info */}
        <div className="flex items-center gap-3 mb-6 p-2 bg-indigo-100 rounded-lg">
          <div className="w-12 h-12 rounded-full bg-indigo-600 flex items-center justify-center text-xl font-bold text-white">
            {initials}
          </div>
          <div>
            <p className="text-lg font-bold text-indigo-800">{ownerName}</p>
            <p className="text-sm text-gray-600">ID: {ownerId}</p>
          </div>
        </div>

        <div className="space-y-2 overflow-y-auto max-h-[calc(100vh-170px)] pb-4">
          {renderNavItems(NAV_ITEMS)}
        </div>
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-40 z-30 md:hidden" onClick={() => setSidebarOpen(false)}></div>
      )}

      {/* Main content */}
      <div className="flex-1 p-4 overflow-y-auto bg-gray-100">
        <div className="flex items-center justify-between mb-6 md:hidden no-print">
          <Button variant="default" onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? "Close Menu" : "Open Menu"}
          </Button>
        </div>

        {renderContent()}
      </div>
    </div>
  );
}
