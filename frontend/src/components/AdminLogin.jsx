import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

function AdminLogin({ setRole }) {
  const navigate = useNavigate();

  const API_URL =
    import.meta.env.VITE_API_URL || "http://127.0.0.1:5000";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (event) => {
    event.preventDefault();
    setError("");

    if (!email.trim() || !password) {
      setError("Please enter your admin email and password.");
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(`${API_URL}/api/admin/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            data.error ||
            "Invalid admin credentials."
        );
      }

      if (!data.admin_token) {
        throw new Error(
          "Admin login succeeded, but no authentication token was returned."
        );
      }

      // Keep the admin token only for this browser tab/session.
      sessionStorage.setItem("admin_token", data.admin_token);

      localStorage.setItem(
        "admin_email",
        data.email || email.trim()
      );

      localStorage.setItem(
        "admin_username",
        data.username ||
          data.email ||
          email.trim()
      );

      localStorage.setItem("role", "admin");

      setRole("admin");

      navigate("/admin-dashboard", {
        replace: true,
      });
    } catch (err) {
      console.error("Admin login error:", err);

      setError(
        err.message ||
          "Unable to login as administrator."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-login-page">
      <div className="admin-login-card">
        <div className="admin-login-logo">🛡️</div>

        <h1>Admin Sign In</h1>

        <p className="admin-login-subtitle">
          RoadGuard AI Administration
        </p>

        {error && (
          <div className="admin-login-error">
            <span>!</span>
            <p>{error}</p>
          </div>
        )}

        <form className="admin-login-form" onSubmit={handleLogin}>
          <div className="admin-login-field">
            <label htmlFor="admin-email">
              ADMIN EMAIL
            </label>

            <input
              id="admin-email"
              type="email"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              placeholder="Enter admin email"
              autoComplete="username"
            />
          </div>

          <div className="admin-login-field">
            <label htmlFor="admin-password">
              PASSWORD
            </label>

            <div className="admin-password-wrapper">
              <input
                id="admin-password"
                type={
                  showPassword
                    ? "text"
                    : "password"
                }
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                placeholder="Enter password"
                autoComplete="current-password"
              />

              <button
                type="button"
                className="admin-password-toggle"
                onClick={() =>
                  setShowPassword(
                    (value) => !value
                  )
                }
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

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

export default AdminLogin;
