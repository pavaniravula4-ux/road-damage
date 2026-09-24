import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

function AdminDashboard() {
  const navigate = useNavigate();

  const API_URL =
    import.meta.env.VITE_API_URL ||
    `http://${window.location.hostname}:5000`;

  // ==============================
  // ADMIN AUTHENTICATION
  // ==============================
  const getAdminToken = () =>
    sessionStorage.getItem("admin_token");

  const getAdminHeaders = () => {
    const token = getAdminToken();

    return token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : {};
  };

  const handleUnauthorized = () => {
    sessionStorage.removeItem("admin_token");
    localStorage.removeItem("role");
    localStorage.removeItem("admin_email");
    localStorage.removeItem("admin_username");

    navigate("/adminlogin", {
      replace: true,
    });
  };

  // ==============================
  // STATE
  // ==============================
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [deletingAll, setDeletingAll] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");

  const [selectedReport, setSelectedReport] = useState(null);

  // ==============================
  // FETCH ADMIN REPORTS
  // ==============================
  const fetchReports = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `${API_URL}/api/admin/reports`,
        {
          method: "GET",
          headers: getAdminHeaders(),
        }
      );

      const data = await response.json();

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!response.ok) {
        throw new Error(
          data.message ||
            data.error ||
            "Unable to load reports."
        );
      }

      setReports(
        Array.isArray(data)
          ? data
          : data.reports || []
      );
    } catch (err) {
      console.error(
        "Fetch admin reports error:",
        err
      );

      setError(
        err.message ||
          "Unable to load reports."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = getAdminToken();

    if (!token) {
      handleUnauthorized();
      return;
    }

    fetchReports();
  }, []);

  // ==============================
  // REPORT STATUS
  // ==============================
  const getStatus = (analysis) => {
    if (
      !analysis ||
      analysis === "Pending analysis"
    ) {
      return {
        label: "Pending",
        className: "pending",
      };
    }

    if (
      String(analysis)
        .toLowerCase()
        .startsWith("ai analysis failed")
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

  // ==============================
  // PRIORITY CLASS
  // ==============================
  const getPriorityClass = (value) => {
    const normalized = String(
      value || ""
    ).toLowerCase();

    if (normalized.includes("critical")) {
      return "critical";
    }

    if (normalized.includes("high")) {
      return "high";
    }

    if (normalized.includes("medium")) {
      return "medium";
    }

    if (normalized.includes("low")) {
      return "low";
    }

    return "normal";
  };

  // ==============================
  // PRIORITY LABEL
  // ==============================
  const getPriorityLabel = (report) => {
    return (
      report.priority ||
      "Not determinable"
    );
  };

  // ==============================
  // PRIORITY SCORE
  // ==============================
  const getPriorityScore = (report) => {
    const score = Number(
      report.priority_score
    );

    if (
      Number.isFinite(score) &&
      score >= 0
    ) {
      return score;
    }

    return null;
  };

  // ==============================
  // FORMAT DATE
  // ==============================
  const formatDate = (dateValue) => {
    if (!dateValue) {
      return "Date not available";
    }

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
      return String(dateValue);
    }

    return date.toLocaleString();
  };

  // ==============================
  // FORMAT GEMINI ANALYSIS
  // ==============================
  const parseAIAnalysis = (analysis) => {
    const text = String(
      analysis || ""
    ).trim();

    if (!text) {
      return null;
    }

    const lowerText =
      text.toLowerCase();

    const isError =
      lowerText.startsWith(
        "ai analysis failed"
      ) ||
      lowerText.startsWith(
        "ai analysis temporarily unavailable"
      ) ||
      lowerText.startsWith(
        "ai analysis unavailable"
      );

    if (
      isError ||
      text === "Pending analysis"
    ) {
      return {
        raw: text,
        fields: [],
      };
    }

    const labels = [
      "Damage Type",
      "Severity",
      "Priority",
      "Evidence",
      "Recommendation",
    ];

    const escaped = labels.map(
      (label) =>
        label.replace(
          /[.*+?^${}()|[\]\\]/g,
          "\\$&"
        )
    );

    const pattern = new RegExp(
      `(${escaped.join(
        "|"
      )})\\s*:\\s*(.*?)(?=\\s+(?:${escaped.join(
        "|"
      )})\\s*:|$)`,
      "gis"
    );

    const fields = [];
    let match;

    while (
      (match = pattern.exec(text)) !== null
    ) {
      fields.push({
        label: match[1],
        value: match[2].trim(),
      });
    }

    return {
      raw: text,
      fields,
    };
  };

  // ==============================
  // IMAGE URL
  // ==============================
  const getImageUrl = (imagePath) => {
    if (!imagePath) {
      return "";
    }

    if (
      imagePath.startsWith("http://") ||
      imagePath.startsWith("https://")
    ) {
      return imagePath;
    }

    return `${API_URL}${
      imagePath.startsWith("/")
        ? ""
        : "/"
    }${imagePath}`;
  };

  // ==============================
  // DELETE SINGLE REPORT
  // ==============================
  const deleteReport = async (reportId) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this report? This action cannot be undone."
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingId(reportId);
      setError("");

      const response = await fetch(
        `${API_URL}/api/admin/reports/${reportId}`,
        {
          method: "DELETE",
          headers: getAdminHeaders(),
        }
      );

      const data = await response.json();

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!response.ok) {
        throw new Error(
          data.message ||
            data.error ||
            "Unable to delete the report."
        );
      }

      setReports(
        (currentReports) =>
          currentReports.filter(
            (report) =>
              report.id !== reportId
          )
      );

      if (
        selectedReport?.id === reportId
      ) {
        setSelectedReport(null);
      }
    } catch (err) {
      console.error(
        "Delete admin report error:",
        err
      );

      setError(
        err.message ||
          "Unable to delete the report."
      );
    } finally {
      setDeletingId(null);
    }
  };

  // ==============================
  // DELETE ALL REPORTS
  // ==============================
  const deleteAllReports = async () => {
    if (reports.length === 0) {
      return;
    }

    const firstConfirm =
      window.confirm(
        `This will permanently delete all ${reports.length} reports and their uploaded images. Continue?`
      );

    if (!firstConfirm) {
      return;
    }

    const secondConfirm =
      window.confirm(
        "Final confirmation: delete ALL reports?"
      );

    if (!secondConfirm) {
      return;
    }

    try {
      setDeletingAll(true);
      setError("");

      const response = await fetch(
        `${API_URL}/api/admin/reports`,
        {
          method: "DELETE",
          headers: getAdminHeaders(),
        }
      );

      const data =
        await response.json();

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!response.ok) {
        throw new Error(
          data.message ||
            data.error ||
            "Unable to delete all reports."
        );
      }

      setReports([]);
      setSelectedReport(null);
    } catch (err) {
      console.error(
        "Delete all reports error:",
        err
      );

      setError(
        err.message ||
          "Unable to delete all reports."
      );
    } finally {
      setDeletingAll(false);
    }
  };

  // ==============================
  // ADMIN LOGOUT
  // ==============================
  const handleLogout = async () => {
    try {
      await fetch(
        `${API_URL}/api/admin/logout`,
        {
          method: "POST",
          headers: getAdminHeaders(),
        }
      );
    } catch (err) {
      console.error(
        "Admin logout error:",
        err
      );
    } finally {
      sessionStorage.removeItem(
        "admin_token"
      );

      localStorage.removeItem("role");
      localStorage.removeItem(
        "admin_email"
      );
      localStorage.removeItem(
        "admin_username"
      );

      navigate("/adminlogin", {
        replace: true,
      });
    }
  };

  // ==============================
  // STATISTICS
  // ==============================
  const stats = useMemo(() => {
    const pending =
      reports.filter(
        (report) =>
          getStatus(report.analysis)
            .className === "pending"
      ).length;

    const analyzed =
      reports.filter(
        (report) =>
          getStatus(report.analysis)
            .className === "analyzed"
      ).length;

    const failed =
      reports.filter(
        (report) =>
          getStatus(report.analysis)
            .className === "failed"
      ).length;

    const critical =
      reports.filter(
        (report) =>
          String(
            report.priority || ""
          ).toLowerCase() ===
          "critical"
      ).length;

    const high =
      reports.filter(
        (report) =>
          String(
            report.priority || ""
          ).toLowerCase() ===
          "high"
      ).length;

    const medium =
      reports.filter(
        (report) =>
          String(
            report.priority || ""
          ).toLowerCase() ===
          "medium"
      ).length;

    const low =
      reports.filter(
        (report) =>
          String(
            report.priority || ""
          ).toLowerCase() ===
          "low"
      ).length;

    return {
      total: reports.length,
      pending,
      analyzed,
      failed,
      critical,
      high,
      medium,
      low,
    };
  }, [reports]);

  // ==============================
  // SEARCH + FILTER
  // ==============================
  const filteredReports = useMemo(() => {
    // Search is AND-based:
    // "high pothole" means the same report must contain
    // BOTH "high" and "pothole".
    const searchTerms = search
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);

    return reports.filter(
      (report) => {
        const status =
          getStatus(
            report.analysis
          );

        const priority =
          String(
            report.priority || ""
          )
            .trim()
            .toLowerCase();

        // Structured fields are kept separate so that a search
        // such as "crack" matches the Damage Type "Crack"
        // instead of accidentally matching the Gemini analysis
        // of a Pothole report.
        const damageType =
          String(report.damage_type ?? "")
            .trim()
            .toLowerCase();

        const severity =
          String(report.severity ?? "")
            .trim()
            .toLowerCase();

        const priorityValue =
          String(report.priority ?? "")
            .trim()
            .toLowerCase();

        const searchableText = [
          report.id,
          report.user_id,
          report.location,
          report.damage_type,
          report.severity,
          report.priority,
          report.priority_score,
          report.created_at,
        ]
          .map((value) =>
            String(value ?? "").toLowerCase()
          )
          .join(" ");

        const knownDamageTypes = [
          "pothole",
          "crack",
          "surface deterioration",
          "road edge damage",
          "water-related damage",
          "other",
          "no visible road damage",
        ];

        const knownSeverities = [
          "minor",
          "moderate",
          "severe",
          "critical",
          "not determinable",
        ];

        const knownPriorities = [
          "low",
          "medium",
          "high",
          "critical",
          "not determinable",
        ];

        // Every search term must be present.
        // For structured values such as "crack", "pothole",
        // "high", and "severe", match the corresponding
        // structured field only.
        const matchesSearch =
          searchTerms.length === 0 ||
          searchTerms.every((term) => {
            if (knownDamageTypes.includes(term)) {
              return damageType === term;
            }

            if (knownSeverities.includes(term)) {
              return severity === term;
            }

            if (knownPriorities.includes(term)) {
              return priorityValue === term;
            }

            return searchableText.includes(term);
          });

        const matchesStatus =
          statusFilter === "all" ||
          status.className ===
            statusFilter;

        const matchesPriority =
          priorityFilter === "all" ||
          priority ===
            priorityFilter;

        return (
          matchesSearch &&
          matchesStatus &&
          matchesPriority
        );
      }
    );
  }, [
    reports,
    search,
    statusFilter,
    priorityFilter,
  ]);

  // ==============================
  // UI
  // ==============================
  return (
    <div className="admin-dashboard-page">

      {/* ==============================
          HEADER
      ============================== */}
      <header className="admin-dashboard-header">
        <div className="admin-dashboard-brand">
          <div className="admin-dashboard-logo">
            🛡️
          </div>

          <div>
            <h2>RoadGuard AI</h2>

            <span>
              Administration Portal
            </span>
          </div>
        </div>

        <div className="admin-dashboard-actions">
          <div className="admin-profile">
            <div className="admin-profile-avatar">
              A
            </div>

            <div>
              <strong>
                Administrator
              </strong>

              <span>
                {localStorage.getItem(
                  "admin_email"
                ) ||
                  "admin@gmail.com"}
              </span>
            </div>
          </div>

          <button
            type="button"
            className="admin-logout"
            onClick={handleLogout}
          >
            Logout
          </button>
        </div>
      </header>

      {/* ==============================
          MAIN
      ============================== */}
      <main className="admin-dashboard-main">

        {/* HEADING */}
        <div className="admin-dashboard-heading">
          <div>
            <h1>
              Road Damage Dashboard
            </h1>

            <p>
              Monitor, analyze, and manage
              road damage reports.
            </p>
          </div>
        </div>

        {/* ERROR */}
        {error && (
          <div className="admin-dashboard-error">
            {error}
          </div>
        )}

        {/* ==============================
            STATISTICS
        ============================== */}
        <div className="admin-stat-grid">

          <div className="admin-stat-card">
            <span>
              Total Reports
            </span>

            <strong>
              {stats.total}
            </strong>
          </div>

          <div className="admin-stat-card">
            <span>
              Pending
            </span>

            <strong>
              {stats.pending}
            </strong>
          </div>

          <div className="admin-stat-card">
            <span>
              AI Analyzed
            </span>

            <strong>
              {stats.analyzed}
            </strong>
          </div>

          <div className="admin-stat-card">
            <span>
              Analysis Failed
            </span>

            <strong>
              {stats.failed}
            </strong>
          </div>

          <div className="admin-stat-card">
            <span>
              Critical Priority
            </span>

            <strong>
              {stats.critical}
            </strong>
          </div>

          <div className="admin-stat-card">
            <span>
              High Priority
            </span>

            <strong>
              {stats.high}
            </strong>
          </div>

          <div className="admin-stat-card">
            <span>
              Medium Priority
            </span>

            <strong>
              {stats.medium}
            </strong>
          </div>

          <div className="admin-stat-card">
            <span>
              Low Priority
            </span>

            <strong>
              {stats.low}
            </strong>
          </div>

        </div>

        {/* ==============================
            REPORT MANAGEMENT
        ============================== */}
        <section className="admin-reports-container">

          <div className="admin-report-tools">

            <div>
              <h2>
                Report Management
              </h2>

              <p>
                {filteredReports.length}{" "}
                of {reports.length} reports
                shown
              </p>
            </div>

            <div className="admin-report-tools-actions">

              {/* SEARCH */}
              <input
                className="admin-search"
                type="search"
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
                placeholder="Search reports..."
              />

              {/* STATUS FILTER */}
              <select
                className="admin-filter"
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(
                    event.target.value
                  )
                }
              >
                <option value="all">
                  All Status
                </option>

                <option value="pending">
                  Pending
                </option>

                <option value="analyzed">
                  AI Analyzed
                </option>

                <option value="failed">
                  Analysis Failed
                </option>
              </select>

              {/* PRIORITY FILTER */}
              <select
                className="admin-filter"
                value={priorityFilter}
                onChange={(event) =>
                  setPriorityFilter(
                    event.target.value
                  )
                }
              >
                <option value="all">
                  All Priorities
                </option>

                <option value="critical">
                  Critical
                </option>

                <option value="high">
                  High
                </option>

                <option value="medium">
                  Medium
                </option>

                <option value="low">
                  Low
                </option>

                <option value="not determinable">
                  Not Determinable
                </option>
              </select>

              {/* DELETE ALL */}
              <button
                type="button"
                className="admin-delete-all-button"
                onClick={
                  deleteAllReports
                }
                disabled={
                  deletingAll ||
                  reports.length === 0
                }
              >
                {deletingAll
                  ? "Deleting..."
                  : "Delete All"}
              </button>

            </div>
          </div>

          {/* ==============================
              LOADING
          ============================== */}
          {loading ? (
            <div className="admin-empty-state">
              <div className="admin-loading-spinner"></div>

              <p>
                Loading reports...
              </p>
            </div>
          ) : filteredReports.length ===
            0 ? (

            <div className="admin-empty-state">
              <div className="admin-empty-icon">
                📋
              </div>

              <h3>
                {reports.length === 0
                  ? "No reports available"
                  : "No matching reports"}
              </h3>

              <p>
                {reports.length === 0
                  ? "There are currently no road damage reports."
                  : "Try changing the search or filter."}
              </p>
            </div>

          ) : (

            /* ==============================
               REPORT GRID
            ============================== */
            <div className="admin-report-grid">

              {filteredReports.map(
                (report) => {

                  const status =
                    getStatus(
                      report.analysis
                    );

                  const priority =
                    getPriorityLabel(
                      report
                    );

                  const priorityClass =
                    getPriorityClass(
                      priority
                    );

                  const score =
                    getPriorityScore(
                      report
                    );

                  return (
                    <article
                      className="admin-report-card"
                      key={report.id}
                    >

                      {/* IMAGE */}
                      <div className="admin-report-image-wrapper">

                        {report.image_path ? (
                          <img
                            className="admin-report-image"
                            src={getImageUrl(
                              report.image_path
                            )}
                            alt="Road damage report"
                          />
                        ) : (
                          <div className="admin-report-image-placeholder">
                            No Image
                          </div>
                        )}

                        <span
                          className={`admin-report-status ${status.className}`}
                        >
                          {status.label}
                        </span>

                      </div>

                      {/* BODY */}
                      <div className="admin-report-body">

                        <div className="admin-report-meta">

                          <span>
                            Report #
                            {report.id}
                          </span>

                          <span>
                            User #
                            {report.user_id}
                          </span>

                        </div>

                        {/* LOCATION */}
                        <div className="admin-report-location">
                          📍{" "}
                          {report.location ||
                            "Location not available"}
                        </div>

                        {/* AI SUMMARY */}
                        <div
                          style={{
                            display: "grid",
                            gap: "8px",
                            marginTop: "14px",
                          }}
                        >

                          {/* DAMAGE TYPE */}
                          <div
                            style={{
                              display: "flex",
                              justifyContent:
                                "space-between",
                              gap: "10px",
                              alignItems:
                                "center",
                            }}
                          >
                            <strong>
                              Damage
                            </strong>

                            <span>
                              {report.damage_type ||
                                "Not determinable"}
                            </span>
                          </div>

                          {/* SEVERITY */}
                          <div
                            style={{
                              display: "flex",
                              justifyContent:
                                "space-between",
                              gap: "10px",
                              alignItems:
                                "center",
                            }}
                          >
                            <strong>
                              Severity
                            </strong>

                            <span>
                              {report.severity ||
                                "Not determinable"}
                            </span>
                          </div>

                          {/* PRIORITY */}
                          <div
                            style={{
                              display: "flex",
                              justifyContent:
                                "space-between",
                              gap: "10px",
                              alignItems:
                                "center",
                            }}
                          >
                            <strong>
                              Priority
                            </strong>

                            <span
                              style={{
                                fontWeight: 700,
                                padding:
                                  "4px 10px",
                                borderRadius:
                                  "999px",
                                background:
                                  priorityClass ===
                                  "critical"
                                    ? "rgba(239,68,68,0.16)"
                                    : priorityClass ===
                                      "high"
                                    ? "rgba(249,115,22,0.16)"
                                    : priorityClass ===
                                      "medium"
                                    ? "rgba(234,179,8,0.16)"
                                    : priorityClass ===
                                      "low"
                                    ? "rgba(34,197,94,0.16)"
                                    : "rgba(148,163,184,0.16)",
                              }}
                            >
                              {priority}
                            </span>
                          </div>

                          {/* SCORE */}
                          {score !== null && (
                            <div
                              style={{
                                display: "flex",
                                justifyContent:
                                  "space-between",
                                gap: "10px",
                              }}
                            >
                              <strong>
                                Priority Score
                              </strong>

                              <span>
                                {score} / 100
                              </span>
                            </div>
                          )}

                        </div>

                        {/* DATE */}
                        <div
                          style={{
                            marginTop: "10px",
                            fontSize: "12px",
                            opacity: 0.7,
                          }}
                        >
                          {formatDate(
                            report.created_at
                          )}
                        </div>

                        {/* ANALYSIS PREVIEW */}
                        <p className="admin-report-analysis-preview">
                          {report.analysis ||
                            "Pending analysis"}
                        </p>

                        {/* ACTIONS */}
                        <div className="admin-report-card-actions">

                          <button
                            type="button"
                            className="admin-view-button"
                            onClick={() =>
                              setSelectedReport(
                                report
                              )
                            }
                          >
                            View Details
                          </button>

                          <button
                            type="button"
                            className="admin-delete-button"
                            onClick={() =>
                              deleteReport(
                                report.id
                              )
                            }
                            disabled={
                              deletingId ===
                              report.id
                            }
                          >
                            {deletingId ===
                            report.id
                              ? "Deleting..."
                              : "Delete"}
                          </button>

                        </div>

                      </div>
                    </article>
                  );
                }
              )}

            </div>
          )}

        </section>

      </main>

      {/* ==============================
          REPORT DETAILS MODAL
      ============================== */}
      {selectedReport && (
        <div
          className="admin-modal-backdrop"
          onClick={() =>
            setSelectedReport(null)
          }
        >

          <div
            className="admin-modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >

            {/* MODAL HEADER */}
            <div className="admin-modal-header">

              <div>
                <h2>
                  Report #
                  {selectedReport.id}
                </h2>

                <p>
                  Road damage report
                  details
                </p>
              </div>

              <button
                type="button"
                className="admin-modal-close"
                onClick={() =>
                  setSelectedReport(null)
                }
                aria-label="Close"
              >
                ×
              </button>

            </div>

            {/* IMAGE */}
            {selectedReport.image_path && (
              <img
                className="admin-modal-image"
                src={getImageUrl(
                  selectedReport.image_path
                )}
                alt="Road damage"
              />
            )}

            {/* CONTENT */}
            <div className="admin-modal-content">

              {/* LOCATION */}
              <div className="admin-location-box">

                <strong>
                  Location
                </strong>

                <p>
                  {selectedReport.location ||
                    "Location not available"}
                </p>

              </div>

              {/* STRUCTURED AI INFORMATION */}
              <div className="admin-analysis-box">

                <strong>
                  Road Damage Assessment
                </strong>

                <div
                  style={{
                    display: "grid",
                    gap: "12px",
                    marginTop: "16px",
                  }}
                >

                  {/* DAMAGE TYPE */}
                  <div
                    style={{
                      padding:
                        "12px 14px",
                      borderRadius:
                        "10px",
                      background:
                        "rgba(255,255,255,0.06)",
                      border:
                        "1px solid rgba(255,255,255,0.10)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "11px",
                        fontWeight: 700,
                        letterSpacing:
                          "0.08em",
                        textTransform:
                          "uppercase",
                        marginBottom:
                          "5px",
                        opacity: 0.7,
                      }}
                    >
                      Damage Type
                    </div>

                    <div>
                      {selectedReport.damage_type ||
                        "Not determinable"}
                    </div>
                  </div>

                  {/* SEVERITY */}
                  <div
                    style={{
                      padding:
                        "12px 14px",
                      borderRadius:
                        "10px",
                      background:
                        "rgba(255,255,255,0.06)",
                      border:
                        "1px solid rgba(255,255,255,0.10)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "11px",
                        fontWeight: 700,
                        letterSpacing:
                          "0.08em",
                        textTransform:
                          "uppercase",
                        marginBottom:
                          "5px",
                        opacity: 0.7,
                      }}
                    >
                      Severity
                    </div>

                    <div
                      style={{
                        fontWeight: 700,
                      }}
                    >
                      {selectedReport.severity ||
                        "Not determinable"}
                    </div>
                  </div>

                  {/* PRIORITY */}
                  <div
                    style={{
                      padding:
                        "12px 14px",
                      borderRadius:
                        "10px",
                      background:
                        "rgba(255,255,255,0.06)",
                      border:
                        "1px solid rgba(255,255,255,0.10)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "11px",
                        fontWeight: 700,
                        letterSpacing:
                          "0.08em",
                        textTransform:
                          "uppercase",
                        marginBottom:
                          "5px",
                        opacity: 0.7,
                      }}
                    >
                      Maintenance Priority
                    </div>

                    <div
                      style={{
                        display:
                          "inline-block",
                        padding:
                          "5px 12px",
                        borderRadius:
                          "999px",
                        fontWeight: 700,
                        background:
                          getPriorityClass(
                            selectedReport.priority
                          ) ===
                          "critical"
                            ? "rgba(239,68,68,0.16)"
                            : getPriorityClass(
                                selectedReport.priority
                              ) ===
                              "high"
                            ? "rgba(249,115,22,0.16)"
                            : getPriorityClass(
                                selectedReport.priority
                              ) ===
                              "medium"
                            ? "rgba(234,179,8,0.16)"
                            : getPriorityClass(
                                selectedReport.priority
                              ) ===
                              "low"
                            ? "rgba(34,197,94,0.16)"
                            : "rgba(148,163,184,0.16)",
                      }}
                    >
                      {selectedReport.priority ||
                        "Not determinable"}
                    </div>
                  </div>

                  {/* PRIORITY SCORE */}
                  <div
                    style={{
                      padding:
                        "12px 14px",
                      borderRadius:
                        "10px",
                      background:
                        "rgba(255,255,255,0.06)",
                      border:
                        "1px solid rgba(255,255,255,0.10)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "11px",
                        fontWeight: 700,
                        letterSpacing:
                          "0.08em",
                        textTransform:
                          "uppercase",
                        marginBottom:
                          "5px",
                        opacity: 0.7,
                      }}
                    >
                      Priority Score
                    </div>

                    <div
                      style={{
                        fontSize:
                          "22px",
                        fontWeight: 800,
                      }}
                    >
                      {getPriorityScore(
                        selectedReport
                      ) !== null
                        ? `${getPriorityScore(
                            selectedReport
                          )} / 100`
                        : "Not available"}
                    </div>
                  </div>

                  {/* CREATED DATE */}
                  <div
                    style={{
                      padding:
                        "12px 14px",
                      borderRadius:
                        "10px",
                      background:
                        "rgba(255,255,255,0.06)",
                      border:
                        "1px solid rgba(255,255,255,0.10)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "11px",
                        fontWeight: 700,
                        letterSpacing:
                          "0.08em",
                        textTransform:
                          "uppercase",
                        marginBottom:
                          "5px",
                        opacity: 0.7,
                      }}
                    >
                      Report Created
                    </div>

                    <div>
                      {formatDate(
                        selectedReport.created_at
                      )}
                    </div>
                  </div>

                </div>

              </div>

              {/* ORIGINAL GEMINI ANALYSIS */}
              <div
                className="admin-analysis-box"
                style={{
                  marginTop: "16px",
                }}
              >

                <strong>
                  Gemini Analysis
                </strong>

                {(() => {
                  const parsed =
                    parseAIAnalysis(
                      selectedReport.analysis
                    );

                  if (
                    !parsed ||
                    parsed.fields.length ===
                      0
                  ) {
                    return (
                      <p
                        style={{
                          marginTop:
                            "14px",
                          lineHeight:
                            1.6,
                        }}
                      >
                        {parsed?.raw ||
                          "Pending analysis"}
                      </p>
                    );
                  }

                  return (
                    <div
                      style={{
                        display:
                          "grid",
                        gap: "12px",
                        marginTop:
                          "16px",
                      }}
                    >

                      {parsed.fields.map(
                        (field) => {

                          const isPriority =
                            field.label ===
                              "Priority" ||
                            field.label ===
                              "Severity";

                          return (
                            <div
                              key={
                                field.label
                              }
                              style={{
                                padding:
                                  "12px 14px",
                                borderRadius:
                                  "10px",
                                background:
                                  "rgba(255,255,255,0.06)",
                                border:
                                  "1px solid rgba(255,255,255,0.10)",
                              }}
                            >

                              <div
                                style={{
                                  fontSize:
                                    "11px",
                                  fontWeight:
                                    700,
                                  letterSpacing:
                                    "0.08em",
                                  textTransform:
                                    "uppercase",
                                  marginBottom:
                                    "5px",
                                  opacity:
                                    0.7,
                                }}
                              >
                                {field.label}
                              </div>

                              <div
                                style={{
                                  fontSize:
                                    "14px",
                                  lineHeight:
                                    1.6,
                                  fontWeight:
                                    isPriority
                                      ? 700
                                      : 400,
                                }}
                              >
                                {field.value}
                              </div>

                            </div>
                          );
                        }
                      )}

                    </div>
                  );
                })()}

              </div>

            </div>

            {/* MODAL ACTIONS */}
            <div className="admin-modal-actions">

              {selectedReport.location && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                    selectedReport.location
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="admin-map-button"
                >
                  Open in Maps
                </a>
              )}

              <button
                type="button"
                className="admin-delete-button"
                onClick={() =>
                  deleteReport(
                    selectedReport.id
                  )
                }
                disabled={
                  deletingId ===
                  selectedReport.id
                }
              >
                {deletingId ===
                selectedReport.id
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

export default AdminDashboard;