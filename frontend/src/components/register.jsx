import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

function Register() {
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const API_URL =
    import.meta.env.VITE_API_URL ||
    "http://127.0.0.1:5000";


  const handleRegister = async (e) => {

    e.preventDefault();

    setError("");
    setSuccess("");

    if (!username.trim()) {
      setError(
        "Please enter a username."
      );
      return;
    }

    if (username.trim().length < 3) {
      setError(
        "Username must contain at least 3 characters."
      );
      return;
    }

    if (!password) {
      setError(
        "Please enter a password."
      );
      return;
    }

    if (password.length < 6) {
      setError(
        "Password must contain at least 6 characters."
      );
      return;
    }

    if (password !== confirmPassword) {
      setError(
        "Passwords do not match."
      );
      return;
    }

    setLoading(true);

    try {

      const response =
        await fetch(
          `${API_URL}/signup`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              username:
                username.trim(),

              password,
            }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
          data.detail ||
          "Registration failed."
        );
      }

      setSuccess(
        "Account created successfully."
      );

      setUsername("");
      setPassword("");
      setConfirmPassword("");

      setTimeout(() => {
        navigate("/", {
          replace: true,
        });
      }, 1200);

    } catch (err) {

      console.error(err);

      setError(
        err.message ||
        "Unable to create account."
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
            Create your reporting account
          </p>

        </div>


        <form
          className="login-form"
          onSubmit={handleRegister}
        >

          <div className="form-title">

            <h2>
              Create account
            </h2>

            <p>
              Register to report road damage
            </p>

          </div>


          <div className="input-group">

            <label>
              Username
            </label>

            <div className="input-wrapper">

              <span className="input-icon">
                👤
              </span>

              <input
                type="text"
                value={username}
                onChange={(e) =>
                  setUsername(e.target.value)
                }
                placeholder="Choose a username"
                disabled={loading}
              />

            </div>

          </div>


          <div className="input-group">

            <label>
              Password
            </label>

            <div className="input-wrapper">

              <span className="input-icon">
                🔒
              </span>

              <input
                type="password"
                value={password}
                onChange={(e) =>
                  setPassword(e.target.value)
                }
                placeholder="Create a password"
                disabled={loading}
              />

            </div>

          </div>


          <div className="input-group">

            <label>
              Confirm Password
            </label>

            <div className="input-wrapper">

              <span className="input-icon">
                🔒
              </span>

              <input
                type="password"
                value={confirmPassword}
                onChange={(e) =>
                  setConfirmPassword(
                    e.target.value
                  )
                }
                placeholder="Confirm your password"
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


          {success && (
            <div
              className="auth-error"
              style={{
                background: "#edf9f3",
                borderColor: "#c9e8d8",
                color: "#17764e",
              }}
            >
              <span
                style={{
                  background: "#1e9b65",
                }}
              >
                ✓
              </span>

              {success}
            </div>
          )}


          <button
            type="submit"
            className="primary-auth-button"
            disabled={loading}
          >
            {loading
              ? "Creating account..."
              : "Create Account"}
          </button>

        </form>


        <div className="register-section">

          <span>
            Already have an account?
          </span>

          <button
            type="button"
            onClick={() =>
              navigate("/")
            }
          >
            Sign in
          </button>

        </div>


        <div className="login-footer">
          AI-powered road safety platform
        </div>

      </div>

    </div>
  );
}

export default Register;