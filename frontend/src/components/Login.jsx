import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

function Login({ setRole, setUserId }) {
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const API_URL =
    import.meta.env.VITE_API_URL ||
    "http://localhost:5000";

  const handleLogin = async (e) => {
    e.preventDefault();

    setError("");

    if (!username.trim() || !password) {
      setError(
        "Please enter your username and password."
      );
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `${API_URL}/api/user/login`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: username.trim(),
            password,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
          data.message ||
          data.detail ||
          "Invalid username or password."
        );
      }

      const userRole = String(
        data.role || "user"
      ).toLowerCase();

      localStorage.setItem(
        "user_id",
        String(data.user_id)
      );

      localStorage.setItem(
        "username",
        data.username || username.trim()
      );

      localStorage.setItem(
        "role",
        userRole
      );

      setUserId(data.user_id);
      setRole(userRole);

      if (userRole === "user") {
        navigate("/upload", {
          replace: true,
        });
      } else {
        setError(
          "This page is for user login."
        );
      }

    } catch (err) {
      console.error("Login error:", err);

      setError(
        err.message ||
        "Unable to connect to the server."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">

      <div className="auth-background-shape shape-one"></div>
      <div className="auth-background-shape shape-two"></div>

      <div className="login-card">

        <div className="brand-section">

          <div className="brand-icon">
            🚧
          </div>

          <h1>
            RoadGuard AI
          </h1>

          <p>
            Smart Road Damage Reporting
          </p>

        </div>

        <form
          className="login-form"
          onSubmit={handleLogin}
        >

          <div className="form-title">

            <h2>
              Welcome back
            </h2>

            <p>
              Sign in to report road damage
            </p>

          </div>

          <div className="input-group">

            <label htmlFor="username">
              Username
            </label>

            <div className="input-wrapper">

              <span className="input-icon">
                👤
              </span>

              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) =>
                  setUsername(e.target.value)
                }
                placeholder="Enter your username"
                autoComplete="username"
                disabled={loading}
              />

            </div>

          </div>

          <div className="input-group">

            <label htmlFor="password">
              Password
            </label>

            <div className="input-wrapper">

              <span className="input-icon">
                🔒
              </span>

              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) =>
                  setPassword(e.target.value)
                }
                placeholder="Enter your password"
                autoComplete="current-password"
                disabled={loading}
              />

            </div>

          </div>

          {error && (
            <div className="auth-error">
              <span>!</span>
              {error}
            </div>
          )}

          <button
            type="submit"
            className="primary-auth-button"
            disabled={loading}
          >
            {loading
              ? "Signing in..."
              : "Sign In"}
          </button>

        </form>

        <div className="register-section">

          <span>
            Don't have an account?
          </span>

          <button
            type="button"
            onClick={() =>
              navigate("/register")
            }
          >
            Create an account
          </button>

        </div>

        <div className="login-footer">
          AI-powered road safety platform
        </div>

      </div>

    </div>
  );
}

export default Login;