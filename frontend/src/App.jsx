import React, { useState } from "react";

import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import "./App.css";

import Login from "./components/Login";
import AdminLogin from "./components/AdminLogin";
import AdminDashboard from "./components/AdminDashboard";
import MyReports from "./components/MyReports";
import UploadReports from "./components/UploadReports";
import Home from "./components/Home";
import Register from "./components/register";
import OperatorLogin from "./components/OperatorLogin";
import OperatorDashboard from "./components/OperatorDashboard";


function App() {

  // ============================================================
  // AUTHENTICATION STATE
  // ============================================================

  const [role, setRole] = useState(
    localStorage.getItem("role") || null
  );

  const [userId, setUserId] = useState(
    localStorage.getItem("user_id") || null
  );


  // ============================================================
  // LOGOUT HANDLER
  // ============================================================
  //
  // This clears BOTH:
  // 1. React authentication state
  // 2. Browser storage
  //
  // This prevents the protected route from immediately
  // redirecting back to the dashboard.
  //

  const handleUserLogout = () => {

    localStorage.removeItem("role");
    localStorage.removeItem("user_id");
    localStorage.removeItem("username");

    setRole(null);
    setUserId(null);
  };


  return (
    <Router>

      <Routes>

        {/* =====================================================
            HOME
        ===================================================== */}

        <Route
          path="/home"
          element={<Home />}
        />


        {/* =====================================================
            USER LOGIN
        ===================================================== */}

        <Route
          path="/"
          element={
            role === "user" && userId ? (
              <Navigate
                to="/myreports"
                replace
              />
            ) : (
              <Login
                setRole={setRole}
                setUserId={setUserId}
              />
            )
          }
        />


        {/* =====================================================
            USER REGISTER
        ===================================================== */}

        <Route
          path="/register"
          element={
            role === "user" && userId ? (
              <Navigate
                to="/myreports"
                replace
              />
            ) : (
              <Register />
            )
          }
        />


        {/* =====================================================
            USER MY REPORTS
        ===================================================== */}

        <Route
          path="/myreports"
          element={
            role === "user" && userId ? (
              <MyReports
                userId={userId}
                setRole={setRole}
                setUserId={setUserId}
              />
            ) : (
              <Navigate
                to="/"
                replace
              />
            )
          }
        />


        {/* =====================================================
            USER UPLOAD
        ===================================================== */}

        <Route
          path="/upload"
          element={
            role === "user" && userId ? (
              <UploadReports
                userId={userId}
              />
            ) : (
              <Navigate
                to="/"
                replace
              />
            )
          }
        />


        {/* =====================================================
            OPERATOR LOGIN
        ===================================================== */}

        <Route
          path="/operator-login"
          element={
            role === "operator" ? (
              <Navigate
                to="/operator-dashboard"
                replace
              />
            ) : (
              <OperatorLogin
                setRole={setRole}
                setUserId={setUserId}
              />
            )
          }
        />


        {/* =====================================================
            OPERATOR DASHBOARD
        =====================================================
        
        IMPORTANT:
        Pass setRole and setUserId to OperatorDashboard.

        This is what fixes the logout blinking problem.
        */}

        <Route
          path="/operator-dashboard"
          element={
            role === "operator" ? (
              <OperatorDashboard
                setRole={setRole}
                setUserId={setUserId}
              />
            ) : (
              <Navigate
                to="/operator-login"
                replace
              />
            )
          }
        />


        {/* =====================================================
            ADMIN LOGIN
        ===================================================== */}

        <Route
          path="/adminlogin"
          element={
            <AdminLogin
              setRole={setRole}
            />
          }
        />


        {/* =====================================================
            ADMIN DASHBOARD
        ===================================================== */}

        <Route
          path="/admin-dashboard"
          element={
            role === "admin" ? (
              <AdminDashboard />
            ) : (
              <Navigate
                to="/adminlogin"
                replace
              />
            )
          }
        />


        {/* =====================================================
            UNKNOWN ROUTES
        ===================================================== */}

        <Route
          path="*"
          element={
            <Navigate
              to="/"
              replace
            />
          }
        />

      </Routes>

    </Router>
  );
}


export default App;