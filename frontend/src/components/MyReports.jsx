import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

function MyReports({ userId, setRole, setUserId }) {
  const navigate = useNavigate();

  const API_URL =
    import.meta.env.VITE_API_URL || "http://127.0.0.1:5000";

  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState(null);
  const [selectedReport, setSelectedReport] = useState(null);

  const fetchReports = async () => {
    if (!userId) {
      setReports([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `${API_URL}/api/user/reports/${userId}`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || data.error || "Unable to load your reports."
        );
      }

      setReports(Array.isArray(data) ? data : data.reports || []);
    } catch (err) {
      console.error("Fetch reports error:", err);
      setError(err.message || "Unable to load your reports.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [userId]);

  const getStatus = (analysis) => {
    const value = String(analysis || "").trim().toLowerCase();

    if (!value || value === "pending analysis") {
      return {
        label: "Pending",
        className: "pending",
      };
    }

    if (
      value.startsWith("ai analysis failed") ||
      value.startsWith("ai analysis temporarily unavailable") ||
      value.startsWith("ai analysis unavailable")
    ) {
      return {
        label: "Analysis Failed",
        className: "failed",
      };
    }

    return {
      label: "AI Analyzed",
      className: "analyzed",
    };
  };

  const getImageUrl = (imagePath) => {
    if (!imagePath) return "";

    if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) {
      return imagePath;
    }

    return `${API_URL}${imagePath.startsWith("/") ? "" : "/"}${imagePath}`;
  };

  const deleteReport = async (reportId) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this report? This action cannot be undone."
    );

    if (!confirmed) return;

    try {
      setDeletingId(reportId);
      setError("");

      const response = await fetch(
        `${API_URL}/api/user/reports/${userId}/${reportId}`,
        {
          method: "DELETE",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || data.error || "Unable to delete the report."
        );
      }

      setReports((currentReports) =>
        currentReports.filter((report) => report.id !== reportId)
      );

      if (selectedReport?.id === reportId) {
        setSelectedReport(null);
      }
    } catch (err) {
      console.error("Delete report error:", err);
      setError(err.message || "Unable to delete the report.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleLogout = () => {
    // Clear all user authentication data from browser storage.
    localStorage.removeItem("role");
    localStorage.removeItem("user_id");
    localStorage.removeItem("user_email");
    localStorage.removeItem("username");

    // Clear the authentication state held by App.jsx.
    if (typeof setRole === "function") {
      setRole(null);
    }

    if (typeof setUserId === "function") {
      setUserId(null);
    }

    // Close any open report modal and return to login.
    setSelectedReport(null);
    navigate("/", { replace: true });
  };

  useEffect(() => {
    if (!userId) {
      navigate("/", { replace: true });
    }
  }, [userId, navigate]);

  const stats = useMemo(() => {
    const pending = reports.filter(
      (report) => getStatus(report.analysis).className === "pending"
    ).length;

    const analyzed = reports.filter(
      (report) => getStatus(report.analysis).className === "analyzed"
    ).length;

    const failed = reports.filter(
      (report) => getStatus(report.analysis).className === "failed"
    ).length;

    return {
      total: reports.length,
      pending,
      analyzed,
      failed,
    };
  }, [reports]);

  return (
    <div className="my-reports-page">
      <header className="my-reports-header">
        <div className="my-reports-brand">
          <div className="my-reports-logo">🛣️</div>
          <div>
            <h2>RoadGuard AI</h2>
            <span>Road Damage Reporting</span>
          </div>
        </div>

        <div className="my-reports-user">
          <div className="my-reports-avatar">U</div>

          <div>
            <strong>
              {localStorage.getItem("user_email") || "User"}
            </strong>
            <span>Citizen Reporter</span>
          </div>

          <button
            type="button"
            className="my-reports-logout"
            onClick={handleLogout}
          >
            Logout
          </button>
        </div>
      </header>

      <main className="my-reports-main">
        <div className="my-reports-heading">
          <div>
            <h1>My Reports</h1>
            <p>Track the road damage reports you have submitted.</p>
          </div>

          <button
            className="upload-report-link"
            onClick={() => navigate("/upload")}
          >
            + Upload Report
          </button>
        </div>

        <div className="my-reports-stats">
          <div className="my-reports-stat-card">
            <span>Total Reports</span>
            <strong>{stats.total}</strong>
          </div>

          <div className="my-reports-stat-card">
            <span>Pending</span>
            <strong>{stats.pending}</strong>
          </div>

          <div className="my-reports-stat-card">
            <span>AI Analyzed</span>
            <strong>{stats.analyzed}</strong>
          </div>

          <div className="my-reports-stat-card">
            <span>Analysis Failed</span>
            <strong>{stats.failed}</strong>
          </div>
        </div>

        {error && (
          <div className="my-reports-error">
            {error}
          </div>
        )}

        {loading ? (
          <div className="my-reports-empty">
            <div className="my-reports-loading-spinner"></div>
            <p>Loading your reports...</p>
          </div>
        ) : reports.length === 0 ? (
          <div className="my-reports-empty">
            <div className="my-reports-empty-icon">📋</div>
            <h3>No reports yet</h3>
            <p>
              You have not submitted any road damage reports.
            </p>
            <button
              className="upload-report-link"
              onClick={() => navigate("/upload")}
            >
              Upload Your First Report
            </button>
          </div>
        ) : (
          <div className="my-reports-grid">
            {reports.map((report) => {
              const status = getStatus(report.analysis);

              return (
                <article className="my-report-card" key={report.id}>
                  <div className="my-report-image-wrapper">
                    {report.image_path ? (
                      <img
                        className="my-report-image"
                        src={getImageUrl(report.image_path)}
                        alt="Road damage report"
                        onError={(event) => {
                          event.currentTarget.style.display = "none";
                        }}
                      />
                    ) : (
                      <div className="my-report-image-placeholder">
                        No Image
                      </div>
                    )}

                    <span
                      className={`my-report-status ${status.className}`}
                    >
                      {status.label}
                    </span>
                  </div>

                  <div className="my-report-body">
                    <div className="my-report-location">
                      <span>📍</span>
                      <span>{report.location || "Location not available"}</span>
                    </div>

                    <p className="my-report-analysis-preview">
                      {status.className === "analyzed"
                        ? "AI analysis completed successfully."
                        : status.className === "failed"
                        ? "AI analysis is currently unavailable."
                        : "AI analysis is pending."}
                    </p>

                    <div className="my-report-actions">
                      <button
                        type="button"
                        className="my-report-view-button"
                        onClick={() => setSelectedReport(report)}
                      >
                        View Details
                      </button>

                      <button
                        type="button"
                        className="my-report-delete-button"
                        onClick={() => deleteReport(report.id)}
                        disabled={deletingId === report.id}
                      >
                        {deletingId === report.id ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      {selectedReport && (
        <div
          className="my-report-modal-backdrop"
          onClick={() => setSelectedReport(null)}
        >
          <div
            className="my-report-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="my-report-modal-header">
              <div>
                <h2>Report Details</h2>
                <p>
                  Report #{selectedReport.id}
                </p>
              </div>

              <button
                className="my-report-modal-close"
                onClick={() => setSelectedReport(null)}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {selectedReport.image_path && (
              <img
                className="my-report-modal-image"
                src={getImageUrl(selectedReport.image_path)}
                alt="Road damage"
              />
            )}

            <div className="my-report-modal-content">
              <div>
                <strong>Location</strong>
                <p>
                  {selectedReport.location ||
                    "Location not available"}
                </p>
              </div>

              <div>
                <strong>AI Status</strong>
                <p>
                  {getStatus(selectedReport.analysis).className === "analyzed"
                    ? "AI analysis completed successfully. Your report has been analyzed and submitted for review."
                    : getStatus(selectedReport.analysis).className === "failed"
                    ? "AI analysis is currently unavailable. Your report was still submitted successfully."
                    : "AI analysis is pending."}
                </p>
              </div>
            </div>

            <div className="my-report-modal-actions">
              <button
                className="my-report-delete-button"
                onClick={() => deleteReport(selectedReport.id)}
                disabled={deletingId === selectedReport.id}
              >
                {deletingId === selectedReport.id
                  ? "Deleting..."
                  : "Delete Report"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MyReports;
