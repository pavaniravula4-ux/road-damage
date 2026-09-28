import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

function UploadReports({ userId }) {
  const navigate = useNavigate();

  const API_URL =
    import.meta.env.VITE_API_URL ||
    "http://127.0.0.1:5000";

  const [image, setImage] = useState(null);
  const [location, setLocation] = useState("");

  const [preview, setPreview] = useState("");

  const [loading, setLoading] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  /* =====================================================
     IMAGE SELECTION
  ===================================================== */

  const handleImageChange = (event) => {
    const file = event.target.files[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image file.");
      return;
    }

    setError("");
    setSuccess("");
    setImage(file);

    const imageUrl = URL.createObjectURL(file);
    setPreview(imageUrl);
  };


  /* =====================================================
     GET CURRENT LOCATION
  ===================================================== */

  const handleGetLocation = () => {

    setError("");
    setSuccess("");
    setGettingLocation(true);

    if (!navigator.geolocation) {
      setError(
        "Your browser does not support location services."
      );

      setGettingLocation(false);
      return;
    }

    const handleLocationSuccess = (position) => {

      const latitude =
        position.coords.latitude;

      const longitude =
        position.coords.longitude;

      setLocation(
        `${latitude}, ${longitude}`
      );

      setError("");
      setGettingLocation(false);
    };

    const handleLocationError = (error) => {

      console.error(
        "Location error:",
        error
      );

      setGettingLocation(false);

      if (error.code === 1) {
        setError(
          "Location permission was denied. Please allow location access for this site and try again."
        );
      } else if (error.code === 2) {
        setError(
          "Your location could not be determined. Please make sure Location Services are enabled and try again."
        );
      } else if (error.code === 3) {
        setError(
          "Location request timed out. Please try the Use My Location button again."
        );
      } else {
        setError(
          "Unable to get your current location. Please try again."
        );
      }
    };

    // First use a normal-accuracy request. This is usually faster and
    // works more reliably in browsers than forcing GPS/high accuracy.
    navigator.geolocation.getCurrentPosition(
      handleLocationSuccess,
      (firstError) => {

        console.warn(
          "Normal location request failed. Trying high accuracy:",
          firstError
        );

        // If permission was denied, asking again cannot help.
        if (firstError.code === 1) {
          handleLocationError(firstError);
          return;
        }

        // Retry once with high accuracy for laptops/desktops where
        // the first location provider could not determine the position.
        navigator.geolocation.getCurrentPosition(
          handleLocationSuccess,
          handleLocationError,
          {
            enableHighAccuracy: true,
            timeout: 20000,
            maximumAge: 0,
          }
        );
      },
      {
        enableHighAccuracy: false,
        timeout: 15000,
        maximumAge: 60000,
      }
    );
  };


  /* =====================================================
     SUBMIT REPORT
  ===================================================== */

  const handleSubmit = async (event) => {

    event.preventDefault();

    setError("");
    setSuccess("");


    /* ---------- VALIDATION ---------- */

    if (!image) {
      setError(
        "Please upload an image of the road damage."
      );

      return;
    }

    if (!location.trim()) {
      setError(
        "Please enter the location of the road damage."
      );

      return;
    }

    if (!userId) {
      setError(
        "User session not found. Please login again."
      );

      return;
    }


    /* ---------- FORM DATA ---------- */

    const formData = new FormData();

    formData.append(
      "user_id",
      userId
    );

    formData.append(
      "location",
      location.trim()
    );

    formData.append(
      "image",
      image
    );


    /* ---------- API REQUEST ---------- */

    try {

      setLoading(true);

      const response = await fetch(
        `${API_URL}/api/report/upload`,
        {
          method: "POST",
          body: formData,
        }
      );


      const data = await response.json();


      if (!response.ok) {

        // Backend rejects non-road images with this exact message.
        // Show it directly to the user and DO NOT navigate to My Reports.
        if (
          data?.error ===
          "Please upload road damaged images only."
        ) {
          setError("");
          setSuccess("");

          window.alert(
            "Please upload road damaged images only."
          );

          setLoading(false);
          return;
        }

        throw new Error(
          data.message ||
          data.error ||
          "Failed to submit report."
        );

      }


      /* ---------- SUCCESS ---------- */

      setSuccess(
        "Road damage report submitted successfully!"
      );

      setImage(null);
      setPreview("");
      setLocation("");


      /*
         Give the user a moment to see
         the success message.
      */

      setTimeout(() => {

        navigate(
          "/myreports",
          {
            replace: true,
          }
        );

      }, 1200);


    } catch (err) {

      console.error(
        "Report upload error:",
        err
      );

      setError(
        err.message ||
        "Unable to submit the report."
      );

    } finally {

      setLoading(false);

    }

  };


  /* =====================================================
     RENDER
  ===================================================== */

  return (

    <div className="upload-report-page">

      <div className="upload-report-container">

        {/* =================================================
            HEADER
        ================================================= */}

        <div className="upload-report-header">

          <button
            type="button"
            className="upload-back-button"
            onClick={() =>
              navigate("/myreports")
            }
          >
            ← Back to My Reports
          </button>

          <div className="upload-report-title">

            <span>
              ROADGUARD AI
            </span>

            <h1>
              Report Road Damage
            </h1>

            <p>
              Upload an image and provide the
              location so our system can analyze
              the road condition.
            </p>

          </div>

        </div>


        {/* =================================================
            ERROR
        ================================================= */}

        {error && (

          <div className="upload-message upload-error">

            <span>!</span>

            <p>
              {error}
            </p>

          </div>

        )}


        {/* =================================================
            SUCCESS
        ================================================= */}

        {success && (

          <div className="upload-message upload-success">

            <span>✓</span>

            <p>
              {success}
            </p>

          </div>

        )}


        {/* =================================================
            FORM
        ================================================= */}

        <form
          className="upload-report-form"
          onSubmit={handleSubmit}
        >

          {/* =================================================
              IMAGE UPLOAD
          ================================================= */}

          <section className="upload-card">

            <div className="upload-card-heading">

              <div className="upload-card-number">
                01
              </div>

              <div>
                <h2>
                  Upload Road Image
                </h2>

                <p>
                  Add a clear photo showing the
                  road damage.
                </p>
              </div>

            </div>


            <label
              className={
                preview
                  ? "image-upload-area has-image"
                  : "image-upload-area"
              }
            >

              {preview ? (

                <div className="image-preview-wrapper">

                  <img
                    src={preview}
                    alt="Road damage preview"
                    className="image-preview"
                  />

                  <div className="image-change-overlay">
                    Click to change image
                  </div>

                </div>

              ) : (

                <div className="image-upload-placeholder">

                  <div className="upload-icon">
                    📷
                  </div>

                  <h3>
                    Upload an image
                  </h3>

                  <p>
                    Click here to select a road
                    damage image
                  </p>

                  <span>
                    JPG, JPEG, PNG
                  </span>

                </div>

              )}

              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                hidden
              />

            </label>


            {image && (

              <div className="selected-file">

                <span>
                  ✓
                </span>

                <div>

                  <strong>
                    {image.name}
                  </strong>

                  <small>
                    {(image.size / 1024 / 1024).toFixed(2)}
                    {" "}
                    MB
                  </small>

                </div>

              </div>

            )}

          </section>


          {/* =================================================
              LOCATION
          ================================================= */}

          <section className="upload-card">

            <div className="upload-card-heading">

              <div className="upload-card-number">
                02
              </div>

              <div>
                <h2>
                  Road Location
                </h2>

                <p>
                  Tell us where the damage was
                  reported.
                </p>
              </div>

            </div>


            <div className="location-input-section">

              <label>
                Location
              </label>

              <div className="location-input-row">

                <input
                  type="text"
                  value={location}
                  onChange={(event) =>
                    setLocation(
                      event.target.value
                    )
                  }
                  placeholder="Enter road, area or location"
                />

                <button
                  type="button"
                  className="location-button"
                  onClick={handleGetLocation}
                  disabled={gettingLocation}
                >

                  {gettingLocation
                    ? "Getting..."
                    : "📍 Use My Location"}

                </button>

              </div>

              <small className="location-help">
                Example: Gachibowli Main Road,
                Hyderabad
              </small>

            </div>

          </section>


          {/* =================================================
              SUBMIT
          ================================================= */}

          <div className="upload-submit-section">

            <button
              type="submit"
              className="submit-report-button"
              disabled={loading}
            >

              {loading
                ? "Submitting Report..."
                : "Submit Road Damage Report →"}

            </button>

            <p>
              Your report will be sent for AI-powered
              road damage analysis.
            </p>

          </div>

        </form>

      </div>

    </div>

  );
}

export default UploadReports;






