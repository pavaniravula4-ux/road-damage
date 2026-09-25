import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

function OperatorLogin({ setRole, setUserId }) {
  const navigate = useNavigate();

  const API_URL =
    import.meta.env.VITE_API_URL ||
    "http://127.0.0.1:5000";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] =
    useState(false);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  // ============================================================
  // OPERATOR LOGIN
  // ============================================================

  const handleLogin = async (event) => {
    event.preventDefault();

    setError("");

    // ----------------------------------------------------------
    // Validate input
    // ----------------------------------------------------------

    if (!username.trim() || !password) {
      setError(
        "Please enter your operator username and password."
      );
      return;
    }

    try {
      setLoading(true);

      // --------------------------------------------------------
      // Clear any previous operator session
      // --------------------------------------------------------

      sessionStorage.removeItem(
        "operator_token"
      );

      localStorage.removeItem(
        "operator_user_id"
      );

      // --------------------------------------------------------
      // API request
      // --------------------------------------------------------

      const response = await fetch(
        `${API_URL}/api/operator/login`,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            username: username.trim(),
            password: password,
          }),
        }
      );

      // --------------------------------------------------------
      // Read response safely
      // --------------------------------------------------------

      let data = {};

      try {
        data = await response.json();
      } catch {
        data = {};
      }

      // --------------------------------------------------------
      // Handle backend error
      // --------------------------------------------------------

      if (!response.ok) {
        throw new Error(
          data.error ||
            data.message ||
            "Invalid operator credentials."
        );
      }

      // --------------------------------------------------------
      // Verify operator token
      // --------------------------------------------------------

      if (!data.operator_token) {
        throw new Error(
          "Operator login succeeded, but no authentication token was returned."
        );
      }

      // --------------------------------------------------------
      // Verify role
      // --------------------------------------------------------

      const userRole = String(
        data.role || ""
      ).toLowerCase();

      if (userRole !== "operator") {
        throw new Error(
          "This account is not an operator account."
        );
      }

      // --------------------------------------------------------
      // Verify user ID
      // --------------------------------------------------------

      if (!data.user_id) {
        throw new Error(
          "Operator login succeeded, but no operator ID was returned."
        );
      }

      // ========================================================
      // STORE OPERATOR SESSION
      // ========================================================

      // Token is kept in sessionStorage so it disappears
      // when the browser session is closed.
      sessionStorage.setItem(
        "operator_token",
        data.operator_token
      );

      // Operator-specific ID
      localStorage.setItem(
        "operator_user_id",
        String(data.user_id)
      );

      // Operator username
      const operatorUsername =
        data.username ||
        data.email ||
        username.trim();

      localStorage.setItem(
        "operator_username",
        operatorUsername
      );

      // Generic values are kept because App.jsx currently
      // uses role/user_id for routing.
      localStorage.setItem(
        "username",
        operatorUsername
      );

      localStorage.setItem(
        "user_id",
        String(data.user_id)
      );

      localStorage.setItem(
        "role",
        "operator"
      );

      // --------------------------------------------------------
      // Update React state
      // --------------------------------------------------------

      setUserId(
        String(data.user_id)
      );

      setRole(
        "operator"
      );

      // --------------------------------------------------------
      // Navigate to operator dashboard
      // --------------------------------------------------------

      navigate(
        "/operator-dashboard",
        {
          replace: true,
        }
      );

    } catch (err) {
      console.error(
        "Operator login error:",
        err
      );

      // Clear potentially stale session
      sessionStorage.removeItem(
        "operator_token"
      );

      localStorage.removeItem(
        "operator_user_id"
      );

      setError(
        err.message ||
          "Unable to login as operator."
      );

    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // UI
  // ============================================================

  return (
    <div className="admin-login-page">

      <div className="admin-login-card">

        {/* ====================================================
            OPERATOR ICON
        ==================================================== */}

        <div className="admin-login-logo">
          🛠️
        </div>

        {/* ====================================================
            TITLE
        ==================================================== */}

        <h1>
          Operator Sign In
        </h1>

        <p className="admin-login-subtitle">
          RoadGuard AI Operations
        </p>

        {/* ====================================================
            ERROR MESSAGE
        ==================================================== */}

        {error && (
          <div className="admin-login-error">

            <span>!</span>

            <p>
              {error}
            </p>

          </div>
        )}

        {/* ====================================================
            LOGIN FORM
        ==================================================== */}

        <form
          className="admin-login-form"
          onSubmit={handleLogin}
        >

          {/* ==================================================
              USERNAME
          ================================================== */}

          <div className="admin-login-field">

            <label htmlFor="operator-username">
              OPERATOR USERNAME
            </label>

            <input
              id="operator-username"
              type="text"
              value={username}
              onChange={(event) =>
                setUsername(
                  event.target.value
                )
              }
              placeholder="Enter operator username"
              autoComplete="username"
              disabled={loading}
            />

          </div>

          {/* ==================================================
              PASSWORD
          ================================================== */}

          <div className="admin-login-field">

            <label htmlFor="operator-password">
              PASSWORD
            </label>

            <div className="admin-password-wrapper">

              <input
                id="operator-password"
                type={
                  showPassword
                    ? "text"
                    : "password"
                }
                value={password}
                onChange={(event) =>
                  setPassword(
                    event.target.value
                  )
                }
                placeholder="Enter password"
                autoComplete="current-password"
                disabled={loading}
              />

              <button
                type="button"
                className="admin-password-toggle"
                onClick={() =>
                  setShowPassword(
                    (value) => !value
                  )
                }
                disabled={loading}
              >
                {showPassword
                  ? "Hide"
                  : "Show"}
              </button>

            </div>

          </div>

          {/* ==================================================
              SIGN IN BUTTON
          ================================================== */}

          <button
            type="submit"
            className="admin-login-button"
            disabled={loading}
          >

            {loading ? (
              <>
                <span className="admin-login-spinner"></span>
                Signing in...
              </>
            ) : (
              <>
                Sign In
                <span>→</span>
              </>
            )}

          </button>

        </form>

      </div>

    </div>
  );
}

export default OperatorLogin;