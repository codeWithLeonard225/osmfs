"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

 useEffect(() => {
    const restoreSession = () => {
      const ceoData = sessionStorage.getItem("ceoData");
      const adminData = sessionStorage.getItem("adminData");
      const staffData = sessionStorage.getItem("staffData");
      const userData = sessionStorage.getItem("userData");
      // MATCH THIS KEY with the login function
      const savedRole = sessionStorage.getItem("userRole"); 

      if (ceoData) {
        setUser({ data: JSON.parse(ceoData), role: "ceo" });
      } else if (adminData) {
        setUser({ data: JSON.parse(adminData), role: "admin" });
      } else if (staffData) {
        setUser({ data: JSON.parse(staffData), role: "staff" });
      } else if (userData) {
        setUser({ data: JSON.parse(userData), role: savedRole || "staff" });
      }
      
      setLoading(false);
    };
    restoreSession();
  }, []);

// Inside AuthContext.js -> login function
const login = (userData, role) => {
  sessionStorage.setItem("userData", JSON.stringify(userData));
  sessionStorage.setItem("userRole", role);
  
  // Save the specific authorized path
  const authPath = userData.dashboardPath || userData.ownerRoute || "default";
  sessionStorage.setItem("authorizedPath", authPath);

  // Set the cookie for Middleware
  document.cookie = `userRole=${role}; path=/; max-age=86400; SameSite=Lax`;
  // Add a cookie for the path check
  document.cookie = `authPath=${authPath}; path=/; max-age=86400; SameSite=Lax`;

  setUser({ data: userData, role: role, authorizedPath: authPath });
};

// Inside AuthContext.js -> logout function
const logout = () => {
  sessionStorage.clear();
  // Clear the cookie by setting max-age to 0
  document.cookie = "userRole=; path=/; max-age=0;";
  setUser(null);
  router.push("/");
};


  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);