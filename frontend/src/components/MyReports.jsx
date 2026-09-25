import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import { useNavigate } from "react-router-dom";


function MyReports({
  userId,
  setRole,
  setUserId,
}) {
  const navigate = useNavigate();


  // ============================================================
  // API
  // ============================================================

  const API_URL =
    import.meta.env.VITE_API_URL ||
    "http://127.0.0.1:5000";


  // ============================================================
  // STATE
  // ============================================================

  const [reports, setReports] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [deletingId, setDeletingId] =
    useState(null);

  const [selectedReport, setSelectedReport] =
    useState(null);


  // ============================================================
  // FETCH USER REPORTS
  // ============================================================

  const fetchReports = async () => {

    if (!userId) {
      setReports([]);
      setLoading(false);
      return;
    }


    try {
      setLoading(true);
      setError("");


      const response =
        await fetch(
          `${API_URL}/api/user/reports/${userId}`
        );


      let data = {};

      try {
        data =
          await response.json();
      } catch {
        data = {};
      }


      if (!response.ok) {
        throw new Error(
          data.message ||
          data.error ||
          "Unable to load your reports."
        );
      }


      setReports(
        Array.isArray(data)
          ? data
          : data.reports || []
      );

    } catch (err) {

      console.error(
        "Fetch reports error:",
        err
      );

      setError(
        err.message ||
        "Unable to load your reports."
      );

    } finally {

      setLoading(false);
    }
  };


  // ============================================================
  // INITIAL LOAD
  // ============================================================

  useEffect(() => {
    fetchReports();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);


  // ============================================================
  // AI ANALYSIS STATUS
  // ============================================================

  const getStatus = (
    analysis
  ) => {

    const value =
      String(
        analysis || ""
      )
        .trim()
        .toLowerCase();


    if (
      !value ||
      value === "pending analysis"
    ) {
      return {
        label: "Pending",
        className: "pending",
      };
    }


    if (
      value.startsWith(
        "ai analysis failed"
      ) ||
      value.startsWith(
        "ai analysis temporarily unavailable"
      ) ||
      value.startsWith(
        "ai analysis unavailable"
      )
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


  // ============================================================
  // WORKFLOW STATUS
  // ============================================================

  const getTrackingStatus = (
    status
  ) => {

    const value =
      String(
        status || "Unassigned"
      )
        .trim()
        .toLowerCase();


    if (
      value === "completed" ||
      value === "complete"
    ) {
      return "Completed";
    }


    if (
      value === "in progress" ||
      value === "in_progress" ||
      value === "in-progress"
    ) {
      return "In Progress";
    }


    if (
      value === "assigned"
    ) {
      return "Assigned";
    }


    return "Unassigned";
  };


  // ============================================================
  // TRACKING STEP STATE
  // ============================================================

  const getTrackingStepState = (
    report,
    step
  ) => {

    const status =
      getTrackingStatus(
        report.status
      );


    if (step === "submitted") {
      return "completed";
    }


    if (step === "assigned") {

      if (
        status === "Assigned" ||
        status === "In Progress" ||
        status === "Completed"
      ) {
        return "completed";
      }

      return "upcoming";
    }


    if (step === "progress") {

      if (
        status === "In Progress" ||
        status === "Completed"
      ) {
        return "completed";
      }


      if (
        status === "Assigned"
      ) {
        return "current";
      }


      return "upcoming";
    }


    if (step === "completed") {

      if (
        status === "Completed"
      ) {
        return "completed";
      }

      return "upcoming";
    }


    return "upcoming";
  };


  // ============================================================
  // CURRENT TRACKING TEXT
  // ============================================================

  const getTrackingMessage = (
    report
  ) => {

    const status =
      getTrackingStatus(
        report.status
      );


    if (
      status === "Completed"
    ) {
      return "Your road-damage report has been completed.";
    }


    if (
      status === "In Progress"
    ) {
      return "An operator is currently working on your report.";
    }


    if (
      status === "Assigned"
    ) {
      return "Your report has been assigned to an operator.";
    }


    return "Your report has been submitted and is waiting to be assigned.";
  };


  // ============================================================
  // IMAGE URL
  // ============================================================

  const getImageUrl = (
    imagePath
  ) => {

    if (!imagePath) {
      return "";
    }


    const path =
      String(
        imagePath
      ).trim();


    if (
      path.startsWith(
        "http://"
      ) ||
      path.startsWith(
        "https://"
      )
    ) {
      return path;
    }


    return `${API_URL}${
      path.startsWith("/")
        ? ""
        : "/"
    }${path}`;
  };


  // ============================================================
  // DATE FORMAT
  // ============================================================

  const formatDate = (
    dateValue
  ) => {

    if (!dateValue) {
      return "Not available";
    }


    const date =
      new Date(dateValue);


    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return String(
        dateValue
      );
    }


    return date.toLocaleString(
      "en-IN",
      {
        dateStyle: "medium",
        timeStyle: "short",
      }
    );
  };


  // ============================================================
  // DELETE REPORT
  // ============================================================

  const deleteReport = async (
    reportId
  ) => {

    const confirmed =
      window.confirm(
        "Are you sure you want to delete this report? This action cannot be undone."
      );


    if (!confirmed) {
      return;
    }


    try {

      setDeletingId(
        reportId
      );

      setError("");


      const response =
        await fetch(
          `${API_URL}/api/user/reports/${userId}/${reportId}`,
          {
            method: "DELETE",
          }
        );


      let data = {};

      try {
        data =
          await response.json();
      } catch {
        data = {};
      }


      if (!response.ok) {
        throw new Error(
          data.message ||
          data.error ||
          "Unable to delete the report."
        );
      }


      // Remove from UI immediately.

      setReports(
        (currentReports) =>
          currentReports.filter(
            (report) =>
              report.id !== reportId
          )
      );


      if (
        selectedReport?.id ===
        reportId
      ) {
        setSelectedReport(
          null
        );
      }

    } catch (err) {

      console.error(
        "Delete report error:",
        err
      );

      setError(
        err.message ||
        "Unable to delete the report."
      );

    } finally {

      setDeletingId(
        null
      );
    }
  };


  // ============================================================
  // LOGOUT
  // ============================================================

  const handleLogout = () => {

    // Clear user session immediately.

    localStorage.removeItem(
      "role"
    );

    localStorage.removeItem(
      "user_id"
    );

    localStorage.removeItem(
      "user_email"
    );

    localStorage.removeItem(
      "username"
    );


    // Update App.jsx state.

    if (
      typeof setRole ===
      "function"
    ) {
      setRole(null);
    }


    if (
      typeof setUserId ===
      "function"
    ) {
      setUserId(null);
    }


    // Close modal.

    setSelectedReport(
      null
    );


    // Navigate immediately.

    navigate(
      "/",
      {
        replace: true,
      }
    );
  };


  // ============================================================
  // AUTH REDIRECT
  // ============================================================

  useEffect(() => {

    if (!userId) {

      navigate(
        "/",
        {
          replace: true,
        }
      );
    }

  }, [
    userId,
    navigate,
  ]);


  // ============================================================
  // STATISTICS
  // ============================================================

  const stats = useMemo(() => {

    const pending =
      reports.filter(
        (report) =>
          getStatus(
            report.analysis
          ).className ===
          "pending"
      ).length;


    const analyzed =
      reports.filter(
        (report) =>
          getStatus(
            report.analysis
          ).className ===
          "analyzed"
      ).length;


    const failed =
      reports.filter(
        (report) =>
          getStatus(
            report.analysis
          ).className ===
          "failed"
      ).length;


    const completed =
      reports.filter(
        (report) =>
          getTrackingStatus(
            report.status
          ) === "Completed"
      ).length;


    const inProgress =
      reports.filter(
        (report) =>
          getTrackingStatus(
            report.status
          ) === "In Progress"
      ).length;


    const assigned =
      reports.filter(
        (report) =>
          getTrackingStatus(
            report.status
          ) === "Assigned"
      ).length;


    return {
      total:
        reports.length,

      pending,

      analyzed,

      failed,

      assigned,

      inProgress,

      completed,
    };

  }, [
    reports,
  ]);


  // ============================================================
  // RENDER
  // ============================================================

  return (

    <div
      className="my-reports-page"
    >

      {/* ========================================================
          HEADER
      ======================================================== */}

      <header
        className="my-reports-header"
      >

        <div
          className="my-reports-brand"
        >

          <div
            className="my-reports-logo"
          >
            🛣️
          </div>


          <div>

            <h2>
              RoadGuard AI
            </h2>

            <span>
              Road Damage Reporting
            </span>

          </div>

        </div>


        <div
          className="my-reports-user"
        >

          <div
            className="my-reports-avatar"
          >
            U
          </div>


          <div>

            <strong>
              {
                localStorage.getItem(
                  "user_email"
                ) ||
                "User"
              }
            </strong>

            <span>
              Citizen Reporter
            </span>

          </div>


          <button
            type="button"
            className="my-reports-logout"
            onClick={
              handleLogout
            }
          >
            Logout
          </button>

        </div>

      </header>


      {/* ========================================================
          MAIN
      ======================================================== */}

      <main
        className="my-reports-main"
      >

        {/* ======================================================
            HEADING
        ====================================================== */}

        <div
          className="my-reports-heading"
        >

          <div>

            <h1>
              My Reports
            </h1>

            <p>
              Track the road damage reports
              you have submitted.
            </p>

          </div>


          <button
            type="button"
            className="upload-report-link"
            onClick={() =>
              navigate(
                "/upload"
              )
            }
          >
            + Upload Report
          </button>

        </div>


        {/* ======================================================
            STATISTICS
        ====================================================== */}

        <div
          className="my-reports-stats"
        >

          <div
            className="my-reports-stat-card"
          >

            <span>
              Total Reports
            </span>

            <strong>
              {stats.total}
            </strong>

          </div>


          <div
            className="my-reports-stat-card"
          >

            <span>
              Pending
            </span>

            <strong>
              {stats.pending}
            </strong>

          </div>


          <div
            className="my-reports-stat-card"
          >

            <span>
              AI Analyzed
            </span>

            <strong>
              {stats.analyzed}
            </strong>

          </div>


          <div
            className="my-reports-stat-card"
          >

            <span>
              Analysis Failed
            </span>

            <strong>
              {stats.failed}
            </strong>

          </div>

        </div>


        {/* ======================================================
            TRACKING STATISTICS
        ====================================================== */}

        <div
          className="my-reports-stats"
        >

          <div
            className="my-reports-stat-card"
          >

            <span>
              Assigned
            </span>

            <strong>
              {stats.assigned}
            </strong>

          </div>


          <div
            className="my-reports-stat-card"
          >

            <span>
              In Progress
            </span>

            <strong>
              {stats.inProgress}
            </strong>

          </div>


          <div
            className="my-reports-stat-card"
          >

            <span>
              Completed
            </span>

            <strong>
              {stats.completed}
            </strong>

          </div>

        </div>


        {/* ======================================================
            ERROR
        ====================================================== */}

        {error && (

          <div
            className="my-reports-error"
          >
            {error}
          </div>

        )}


        {/* ======================================================
            LOADING
        ====================================================== */}

        {loading ? (

          <div
            className="my-reports-empty"
          >

            <div
              className="my-reports-loading-spinner"
            ></div>

            <p>
              Loading your reports...
            </p>

          </div>

        ) : reports.length === 0 ? (

          /* ====================================================
             EMPTY
          ==================================================== */

          <div
            className="my-reports-empty"
          >

            <div
              className="my-reports-empty-icon"
            >
              📋
            </div>

            <h3>
              No reports yet
            </h3>

            <p>
              You have not submitted any
              road damage reports.
            </p>


            <button
              type="button"
              className="upload-report-link"
              onClick={() =>
                navigate(
                  "/upload"
                )
              }
            >
              Upload Your First Report
            </button>

          </div>

        ) : (

          /* ====================================================
             REPORT GRID
          ==================================================== */

          <div
            className="my-reports-grid"
          >

            {reports.map(
              (report) => {

                const aiStatus =
                  getStatus(
                    report.analysis
                  );


                const trackingStatus =
                  getTrackingStatus(
                    report.status
                  );


                return (

                  <article
                    className="my-report-card"
                    key={
                      report.id
                    }
                  >

                    {/* ========================================
                        IMAGE
                    ======================================== */}

                    <div
                      className="my-report-image-wrapper"
                    >

                      {report.image_path ? (

                        <img
                          className="my-report-image"
                          src={
                            getImageUrl(
                              report.image_path
                            )
                          }
                          alt="Road damage report"
                          onError={(
                            event
                          ) => {
                            event.currentTarget.style.display =
                              "none";
                          }}
                        />

                      ) : (

                        <div
                          className="my-report-image-placeholder"
                        >
                          No Image
                        </div>

                      )}


                      {/* AI STATUS */}

                      <span
                        className={
                          `my-report-status ${aiStatus.className}`
                        }
                      >
                        {aiStatus.label}
                      </span>

                    </div>


                    {/* ========================================
                        BODY
                    ======================================== */}

                    <div
                      className="my-report-body"
                    >

                      {/* LOCATION */}

                      <div
                        className="my-report-location"
                      >

                        <span>
                          📍
                        </span>

                        <span>
                          {
                            report.location ||
                            "Location not available"
                          }
                        </span>

                      </div>


                      {/* REPORT STATUS */}

                      <div
                        style={{
                          marginTop:
                            "12px",
                          marginBottom:
                            "10px",
                          display:
                            "flex",
                          alignItems:
                            "center",
                          justifyContent:
                            "space-between",
                          gap:
                            "10px",
                          padding:
                            "10px 12px",
                          borderRadius:
                            "10px",
                          background:
                            "#f7f9fc",
                          border:
                            "1px solid #e5e9f0",
                        }}
                      >

                        <span
                          style={{
                            fontSize:
                              "13px",
                            fontWeight:
                              "600",
                            color:
                              "#667085",
                          }}
                        >
                          Report Status
                        </span>


                        <span
                          style={{
                            fontSize:
                              "13px",
                            fontWeight:
                              "700",
                            color:
                              trackingStatus ===
                              "Completed"
                                ? "#15803d"
                                : trackingStatus ===
                                  "In Progress"
                                ? "#2563eb"
                                : trackingStatus ===
                                  "Assigned"
                                ? "#d97706"
                                : "#667085",
                          }}
                        >
                          {trackingStatus}
                        </span>

                      </div>


                      {/* AI PREVIEW */}

                      <p
                        className="my-report-analysis-preview"
                      >

                        {
                          aiStatus.className ===
                          "analyzed"

                            ? "AI analysis completed successfully."

                            : aiStatus.className ===
                              "failed"

                            ? "AI analysis is currently unavailable."

                            : "AI analysis is pending."
                        }

                      </p>


                      {/* ACTIONS */}

                      <div
                        className="my-report-actions"
                      >

                        <button
                          type="button"
                          className="my-report-view-button"
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
                          className="my-report-delete-button"
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
                          {
                            deletingId ===
                            report.id
                              ? "Deleting..."
                              : "Delete"
                          }
                        </button>

                      </div>

                    </div>

                  </article>

                );
              }
            )}

          </div>

        )}


      </main>


      {/* ========================================================
          REPORT DETAILS MODAL
      ======================================================== */}

      {selectedReport && (

        <div
          className="my-report-modal-backdrop"
          onClick={() =>
            setSelectedReport(
              null
            )
          }
        >

          <div
            className="my-report-modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >

            {/* ==================================================
                MODAL HEADER
            ================================================== */}

            <div
              className="my-report-modal-header"
            >

              <div>

                <h2>
                  Report Details
                </h2>

                <p>
                  Report #
                  {selectedReport.id}
                </p>

              </div>


              <button
                type="button"
                className="my-report-modal-close"
                onClick={() =>
                  setSelectedReport(
                    null
                  )
                }
                aria-label="Close"
              >
                ×
              </button>

            </div>


            {/* ==================================================
                IMAGE
            ================================================== */}

            {selectedReport.image_path && (

              <img
                className="my-report-modal-image"
                src={
                  getImageUrl(
                    selectedReport.image_path
                  )
                }
                alt="Road damage"
              />

            )}


            {/* ==================================================
                TRACKING SECTION
            ================================================== */}

            <div
              style={{
                margin:
                  "20px 0",
                padding:
                  "20px",
                borderRadius:
                  "14px",
                background:
                  "#f8fafc",
                border:
                  "1px solid #e5e7eb",
              }}
            >

              <div
                style={{
                  display:
                    "flex",
                  alignItems:
                    "center",
                  justifyContent:
                    "space-between",
                  gap:
                    "12px",
                  marginBottom:
                    "18px",
                }}
              >

                <div>

                  <h3
                    style={{
                      margin:
                        "0 0 4px",
                      fontSize:
                        "18px",
                    }}
                  >
                    Report Tracking
                  </h3>

                  <p
                    style={{
                      margin:
                        "0",
                      color:
                        "#667085",
                      fontSize:
                        "13px",
                    }}
                  >
                    Track the progress
                    of your report.
                  </p>

                </div>


                <span
                  style={{
                    padding:
                      "7px 12px",
                    borderRadius:
                      "999px",
                    fontSize:
                      "12px",
                    fontWeight:
                      "700",
                    background:
                      getTrackingStatus(
                        selectedReport.status
                      ) ===
                      "Completed"
                        ? "#dcfce7"
                        : getTrackingStatus(
                            selectedReport.status
                          ) ===
                          "In Progress"
                        ? "#dbeafe"
                        : getTrackingStatus(
                            selectedReport.status
                          ) ===
                          "Assigned"
                        ? "#fef3c7"
                        : "#eef2f6",
                    color:
                      getTrackingStatus(
                        selectedReport.status
                      ) ===
                      "Completed"
                        ? "#15803d"
                        : getTrackingStatus(
                            selectedReport.status
                          ) ===
                          "In Progress"
                        ? "#1d4ed8"
                        : getTrackingStatus(
                            selectedReport.status
                          ) ===
                          "Assigned"
                        ? "#b45309"
                        : "#667085",
                  }}
                >
                  {
                    getTrackingStatus(
                      selectedReport.status
                    )
                  }
                </span>

              </div>


              {/* ================================================
                  TRACKING TIMELINE
              ================================================= */}

              <div
                style={{
                  display:
                    "flex",
                  flexDirection:
                    "column",
                  gap:
                    "0",
                }}
              >

                {/* SUBMITTED */}

                <div
                  style={{
                    display:
                      "flex",
                    gap:
                      "14px",
                    minHeight:
                      "72px",
                  }}
                >

                  <div
                    style={{
                      display:
                        "flex",
                      flexDirection:
                        "column",
                      alignItems:
                        "center",
                    }}
                  >

                    <div
                      style={{
                        width:
                          "30px",
                        height:
                          "30px",
                        borderRadius:
                          "50%",
                        display:
                          "flex",
                        alignItems:
                          "center",
                        justifyContent:
                          "center",
                        background:
                          "#16a34a",
                        color:
                          "#fff",
                        fontWeight:
                          "700",
                        flexShrink:
                          0,
                      }}
                    >
                      ✓
                    </div>


                    <div
                      style={{
                        width:
                          "2px",
                        flex:
                          1,
                        background:
                          "#16a34a",
                        marginTop:
                          "4px",
                      }}
                    />

                  </div>


                  <div>

                    <strong
                      style={{
                        display:
                          "block",
                        color:
                          "#111827",
                        fontSize:
                          "14px",
                      }}
                    >
                      Report Submitted
                    </strong>

                    <span
                      style={{
                        display:
                          "block",
                        marginTop:
                          "4px",
                        color:
                          "#667085",
                        fontSize:
                          "12px",
                      }}
                    >
                      {formatDate(
                        selectedReport.created_at
                      )}
                    </span>

                  </div>

                </div>


                {/* ASSIGNED */}

                <div
                  style={{
                    display:
                      "flex",
                    gap:
                      "14px",
                    minHeight:
                      "72px",
                  }}
                >

                  <div
                    style={{
                      display:
                        "flex",
                      flexDirection:
                        "column",
                      alignItems:
                        "center",
                    }}
                  >

                    <div
                      style={{
                        width:
                          "30px",
                        height:
                          "30px",
                        borderRadius:
                          "50%",
                        display:
                          "flex",
                        alignItems:
                          "center",
                        justifyContent:
                          "center",
                        background:
                          getTrackingStepState(
                            selectedReport,
                            "assigned"
                          ) ===
                          "completed"
                            ? "#16a34a"
                            : "#e5e7eb",
                        color:
                          getTrackingStepState(
                            selectedReport,
                            "assigned"
                          ) ===
                          "completed"
                            ? "#fff"
                            : "#667085",
                        fontWeight:
                          "700",
                        flexShrink:
                          0,
                      }}
                    >
                      {
                        getTrackingStepState(
                          selectedReport,
                          "assigned"
                        ) ===
                        "completed"
                          ? "✓"
                          : "2"
                      }
                    </div>


                    <div
                      style={{
                        width:
                          "2px",
                        flex:
                          1,
                        background:
                          getTrackingStepState(
                            selectedReport,
                            "assigned"
                          ) ===
                          "completed"
                            ? "#16a34a"
                            : "#e5e7eb",
                        marginTop:
                          "4px",
                      }}
                    />

                  </div>


                  <div>

                    <strong
                      style={{
                        display:
                          "block",
                        color:
                          "#111827",
                        fontSize:
                          "14px",
                      }}
                    >
                      Assigned to Operator
                    </strong>

                    <span
                      style={{
                        display:
                          "block",
                        marginTop:
                          "4px",
                        color:
                          "#667085",
                        fontSize:
                          "12px",
                      }}
                    >
                      {
                        selectedReport.assigned_at
                          ? formatDate(
                              selectedReport.assigned_at
                            )
                          : "Waiting for assignment"
                      }
                    </span>

                  </div>

                </div>


                {/* IN PROGRESS */}

                <div
                  style={{
                    display:
                      "flex",
                    gap:
                      "14px",
                    minHeight:
                      "72px",
                  }}
                >

                  <div
                    style={{
                      display:
                        "flex",
                      flexDirection:
                        "column",
                      alignItems:
                        "center",
                    }}
                  >

                    <div
                      style={{
                        width:
                          "30px",
                        height:
                          "30px",
                        borderRadius:
                          "50%",
                        display:
                          "flex",
                        alignItems:
                          "center",
                        justifyContent:
                          "center",
                        background:
                          getTrackingStepState(
                            selectedReport,
                            "progress"
                          ) ===
                          "completed"
                            ? "#16a34a"
                            : getTrackingStepState(
                                selectedReport,
                                "progress"
                              ) ===
                              "current"
                            ? "#2563eb"
                            : "#e5e7eb",
                        color:
                          getTrackingStepState(
                            selectedReport,
                            "progress"
                          ) ===
                          "upcoming"
                            ? "#667085"
                            : "#fff",
                        fontWeight:
                          "700",
                        flexShrink:
                          0,
                      }}
                    >
                      {
                        getTrackingStepState(
                          selectedReport,
                          "progress"
                        ) ===
                        "completed"
                          ? "✓"
                          : "3"
                      }
                    </div>


                    <div
                      style={{
                        width:
                          "2px",
                        flex:
                          1,
                        background:
                          getTrackingStepState(
                            selectedReport,
                            "progress"
                          ) ===
                          "completed"
                            ? "#16a34a"
                            : "#e5e7eb",
                        marginTop:
                          "4px",
                      }}
                    />

                  </div>


                  <div>

                    <strong
                      style={{
                        display:
                          "block",
                        color:
                          "#111827",
                        fontSize:
                          "14px",
                      }}
                    >
                      Work In Progress
                    </strong>

                    <span
                      style={{
                        display:
                          "block",
                        marginTop:
                          "4px",
                        color:
                          "#667085",
                        fontSize:
                          "12px",
                      }}
                    >
                      {
                        getTrackingStatus(
                          selectedReport.status
                        ) ===
                        "In Progress"
                          ? "Operator is working on your report"
                          : getTrackingStatus(
                              selectedReport.status
                            ) ===
                            "Completed"
                          ? "Work was completed"
                          : "Waiting for work to begin"
                      }
                    </span>

                  </div>

                </div>


                {/* COMPLETED */}

                <div
                  style={{
                    display:
                      "flex",
                    gap:
                      "14px",
                  }}
                >

                  <div
                    style={{
                      display:
                        "flex",
                      flexDirection:
                        "column",
                      alignItems:
                        "center",
                    }}
                  >

                    <div
                      style={{
                        width:
                          "30px",
                        height:
                          "30px",
                        borderRadius:
                          "50%",
                        display:
                          "flex",
                        alignItems:
                          "center",
                        justifyContent:
                          "center",
                        background:
                          getTrackingStepState(
                            selectedReport,
                            "completed"
                          ) ===
                          "completed"
                            ? "#16a34a"
                            : "#e5e7eb",
                        color:
                          getTrackingStepState(
                            selectedReport,
                            "completed"
                          ) ===
                          "completed"
                            ? "#fff"
                            : "#667085",
                        fontWeight:
                          "700",
                        flexShrink:
                          0,
                      }}
                    >
                      {
                        getTrackingStepState(
                          selectedReport,
                          "completed"
                        ) ===
                        "completed"
                          ? "✓"
                          : "4"
                      }
                    </div>

                  </div>


                  <div>

                    <strong
                      style={{
                        display:
                          "block",
                        color:
                          "#111827",
                        fontSize:
                          "14px",
                      }}
                    >
                      Completed
                    </strong>

                    <span
                      style={{
                        display:
                          "block",
                        marginTop:
                          "4px",
                        color:
                          "#667085",
                        fontSize:
                          "12px",
                      }}
                    >
                      {
                        selectedReport.completed_at
                          ? formatDate(
                              selectedReport.completed_at
                            )
                          : "Not completed yet"
                      }
                    </span>

                  </div>

                </div>

              </div>


              {/* ================================================
                  CURRENT STATUS MESSAGE
              ================================================= */}

              <div
                style={{
                  marginTop:
                    "20px",
                  padding:
                    "12px 14px",
                  borderRadius:
                    "10px",
                  background:
                    "#ffffff",
                  border:
                    "1px solid #e5e7eb",
                  color:
                    "#344054",
                  fontSize:
                    "13px",
                  lineHeight:
                    "1.5",
                }}
              >

                <strong>
                  Current Status:
                </strong>

                {" "}

                {
                  getTrackingMessage(
                    selectedReport
                  )
                }

              </div>

            </div>


            {/* ==================================================
                REPORT INFORMATION
            ================================================== */}

            <div
              className="my-report-modal-content"
            >

              <div>

                <strong>
                  Location
                </strong>

                <p>
                  {
                    selectedReport.location ||
                    "Location not available"
                  }
                </p>

              </div>


              <div>

                <strong>
                  AI Status
                </strong>

                <p>

                  {
                    getStatus(
                      selectedReport.analysis
                    ).className ===
                    "analyzed"

                      ? "AI analysis completed successfully. Your report has been analyzed and submitted for review."

                      : getStatus(
                          selectedReport.analysis
                        ).className ===
                        "failed"

                      ? "AI analysis is currently unavailable. Your report was still submitted successfully."

                      : "AI analysis is pending."
                  }

                </p>

              </div>


              <div>

                <strong>
                  Report Submitted
                </strong>

                <p>
                  {formatDate(
                    selectedReport.created_at
                  )}
                </p>

              </div>


              <div>

                <strong>
                  Assigned At
                </strong>

                <p>
                  {formatDate(
                    selectedReport.assigned_at
                  )}
                </p>

              </div>


              <div>

                <strong>
                  Completed At
                </strong>

                <p>
                  {formatDate(
                    selectedReport.completed_at
                  )}
                </p>

              </div>

            </div>


            {/* ==================================================
                MODAL ACTIONS
            ================================================== */}

            <div
              className="my-report-modal-actions"
            >

              <button
                type="button"
                className="my-report-delete-button"
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

                {
                  deletingId ===
                  selectedReport.id
                    ? "Deleting..."
                    : "Delete Report"
                }

              </button>

            </div>

          </div>

        </div>

      )}

    </div>
  );
}


export default MyReports;