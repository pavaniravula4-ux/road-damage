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

function App() {
  const [role, setRole] = useState(
    localStorage.getItem("role") || null
  );

  const [userId, setUserId] = useState(
    localStorage.getItem("user_id") || null
  );

  return (
    <Router>
      <Routes>

        {/* HOME */}
        <Route
          path="/home"
          element={<Home />}
        />

        {/* USER LOGIN */}
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

        {/* REGISTER */}
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

        {/* USER DASHBOARD */}
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

        {/* UPLOAD REPORT */}
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

        {/* ADMIN LOGIN */}
        <Route
          path="/adminlogin"
          element={
            <AdminLogin
              setRole={setRole}
            />
          }
        />

        {/* ADMIN DASHBOARD */}
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

        {/* UNKNOWN ROUTES */}
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