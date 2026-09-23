import os
import uuid
import secrets
import time
import re
from datetime import datetime, timezone, timedelta

from flask import Flask, request, jsonify, send_from_directory
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS

from google import genai
from google.genai import types
from dotenv import load_dotenv

from werkzeug.security import generate_password_hash, check_password_hash


# ============================================================
# LOAD ENVIRONMENT VARIABLES
# ============================================================

load_dotenv()


# ============================================================
# INDIA STANDARD TIME
# ============================================================
INDIA_TIMEZONE = timezone(timedelta(hours=5, minutes=30))


# ============================================================
# FLASK APPLICATION
# ============================================================

app = Flask(__name__)

CORS(
    app,
    resources={
        r"/*": {
            "origins": [
                "http://localhost:5173",
                "http://127.0.0.1:5173"
            ],
            "allow_headers": [
                "Content-Type",
                "Authorization"
            ],
            "methods": [
                "GET",
                "POST",
                "PUT",
                "PATCH",
                "DELETE",
                "OPTIONS"
            ]
        }
    }
)

# ============================================================
# DATABASE CONFIGURATION
# ============================================================

app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///roadguard.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db = SQLAlchemy(app)


# ============================================================
# DATABASE MODELS
# ============================================================

class User(db.Model):

    __tablename__ = "users"

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    # We keep the existing "email" column so your
    # existing roadguard.db database does not immediately
    # break.
    #
    # The frontend can use this field as a username.
    email = db.Column(
        db.String(255),
        unique=True,
        nullable=False
    )

    password = db.Column(
        db.String(255),
        nullable=False
    )

    role = db.Column(
        db.String(50),
        default="user",
        nullable=False
    )


class Report(db.Model):

    __tablename__ = "report"

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    user_id = db.Column(
        db.Integer,
        nullable=False
    )

    location = db.Column(
        db.String(255),
        nullable=False
    )

    image_path = db.Column(
        db.String(255),
        nullable=False
    )

    analysis = db.Column(
        db.Text,
        nullable=False
    )

    damage_type = db.Column(
        db.String(100),
        nullable=True
    )

    severity = db.Column(
        db.String(50),
        nullable=True
    )

    priority = db.Column(
        db.String(50),
        nullable=True
    )

    priority_score = db.Column(
        db.Integer,
        nullable=True
    )

    created_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(INDIA_TIMEZONE),
        nullable=True
    )


# ============================================================
# CREATE DATABASE TABLES
# ============================================================

with app.app_context():

    db.create_all()


# ============================================================
# GEMINI CONFIGURATION
# ============================================================

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not GEMINI_API_KEY:

    print(
        "WARNING: GEMINI_API_KEY is not configured."
    )

    client = None

else:

    try:

        client = genai.Client(
            api_key=GEMINI_API_KEY
        )

    except Exception as e:

        print(
            f"WARNING: Gemini client initialization failed: {e}"
        )

        client = None


# Gemini models
#
# Primary: Gemini 3.6 Flash
# Fallback: Gemini 3.5 Flash-Lite
#
# Both support image input and text output.
GEMINI_MODEL = os.getenv(
    "GEMINI_MODEL",
    "gemini-3.6-flash"
)

GEMINI_FALLBACK_MODEL = os.getenv(
    "GEMINI_FALLBACK_MODEL",
    "gemini-3.5-flash-lite"
)

# Retry settings for temporary Gemini 503/429/5xx errors.
GEMINI_MAX_RETRIES = int(
    os.getenv("GEMINI_MAX_RETRIES", "2")
)

GEMINI_RETRY_DELAY = float(
    os.getenv("GEMINI_RETRY_DELAY", "2")
)


# ============================================================
# GEMINI STARTUP STATUS
# ============================================================

if client is not None:
    print(
        "Gemini configured:",
        f"primary={GEMINI_MODEL}, "
        f"fallback={GEMINI_FALLBACK_MODEL}"
    )
else:
    print(
        "Gemini is not configured. "
        "Add GEMINI_API_KEY to backend/.env."
    )


# ============================================================
# PASSWORD HELPERS
# ============================================================

def hash_password(password):
    """
    Securely hash a user's password.
    """

    return generate_password_hash(
        password
    )


def verify_password(password, stored_password):
    """
    Verify a password.

    New accounts use Werkzeug password hashes.

    Older development accounts may have plain-text
    passwords from the previous version. Those are
    temporarily supported so the application does not
    break when an existing database is used.
    """

    if not stored_password:
        return False

    # New hashed password
    try:

        if stored_password.startswith(
            "pbkdf2:"
        ) or stored_password.startswith(
            "scrypt:"
        ):

            return check_password_hash(
                stored_password,
                password
            )

    except Exception:
        return False

    # Legacy plain-text password
    return password == stored_password


# ============================================================
# USERNAME VALIDATION
# ============================================================

def validate_username(username):

    if not username:

        return (
            False,
            "Username is required."
        )

    username = username.strip()

    if len(username) < 3:

        return (
            False,
            "Username must be at least 3 characters."
        )

    if len(username) > 50:

        return (
            False,
            "Username must be 50 characters or less."
        )

    return (
        True,
        ""
    )


def validate_password(password):

    if not password:

        return (
            False,
            "Password is required."
        )

    if len(password) < 6:

        return (
            False,
            "Password must be at least 6 characters."
        )

    return (
        True,
        ""
    )


# ============================================================
# GET USERNAME FROM REQUEST
# ============================================================

def get_username_from_request():

    # --------------------------------------------------------
    # JSON request
    # --------------------------------------------------------

    if request.is_json:

        data = request.get_json(
            silent=True
        ) or {}

        username = (
            data.get("username")
            or data.get("email")
        )

        return (
            str(username).strip()
            if username
            else None
        )

    # --------------------------------------------------------
    # FormData request
    # --------------------------------------------------------

    username = (
        request.form.get("username")
        or request.form.get("email")
    )

    return (
        username.strip()
        if username
        else None
    )


# ============================================================
# GET PASSWORD FROM REQUEST
# ============================================================

def get_password_from_request():

    if request.is_json:

        data = request.get_json(
            silent=True
        ) or {}

        return data.get("password")

    return request.form.get(
        "password"
    )


# ============================================================
# GET UPLOAD FOLDER
# ============================================================

UPLOAD_FOLDER = "uploads"

os.makedirs(
    UPLOAD_FOLDER,
    exist_ok=True
)


# ============================================================
# STATIC FILES
# ============================================================

@app.route(
    "/uploads/<path:filename>"
)
def uploaded_file(filename):

    return send_from_directory(
        UPLOAD_FOLDER,
        filename
    )


# ============================================================
# GEMINI IMAGE ANALYSIS
# ============================================================

def _is_retryable_gemini_error(error):
    """
    Identify temporary Gemini/API errors that are safe to retry.
    """
    message = str(error).upper()

    retryable_codes = (
        "503",
        "UNAVAILABLE",
        "429",
        "RESOURCE_EXHAUSTED",
        "500",
        "INTERNAL",
        "504",
        "DEADLINE_EXCEEDED",
        "TIMEOUT",
    )

    return any(
        code in message
        for code in retryable_codes
    )


def _run_gemini_with_retry(model, uploaded_file, prompt):
    """
    Run one Gemini model with exponential backoff.
    """
    last_error = None
    total_attempts = GEMINI_MAX_RETRIES + 1

    for attempt in range(total_attempts):

        try:
            print(
                f"Gemini attempt {attempt + 1}/{total_attempts} "
                f"using {model}..."
            )

            response = client.models.generate_content(
                model=model,
                contents=[
                    uploaded_file,
                    prompt
                ],
                config=types.GenerateContentConfig(
                    temperature=0
                )
            )

            if response and response.text:
                print(
                    f"Gemini analysis succeeded using {model}."
                )
                return response.text.strip()

            last_error = RuntimeError(
                "Gemini returned an empty response."
            )

        except Exception as e:

            last_error = e

            print(
                f"Gemini error using {model} "
                f"(attempt {attempt + 1}/{total_attempts}): "
                f"{e}"
            )

            if not _is_retryable_gemini_error(e):
                raise

            if attempt < total_attempts - 1:
                delay = (
                    GEMINI_RETRY_DELAY
                    * (2 ** attempt)
                )

                print(
                    f"Temporary Gemini failure. "
                    f"Retrying in {delay:.1f} seconds..."
                )

                time.sleep(delay)

    raise last_error


def analyze_image_with_gemini(filepath):

    """
    Analyze a road image using Gemini.

    Flow:
        1. Upload image to Gemini.
        2. Try Gemini 3.6 Flash.
        3. Retry temporary failures with exponential backoff.
        4. If still unavailable, try Gemini 3.5 Flash-Lite.
        5. Return a concise road-damage assessment.
    """

    if client is None:
        return (
            "AI analysis unavailable. "
            "GEMINI_API_KEY is not configured."
        )

    if not os.path.exists(filepath):
        return (
            "AI analysis failed: "
            "Image file not found."
        )

    try:

        # ----------------------------------------------------
        # Upload image once; reuse it for both models.
        # ----------------------------------------------------

        uploaded_file = client.files.upload(
            file=filepath
        )

        # ----------------------------------------------------
        # RoadGuard AI inspection prompt
        # ----------------------------------------------------

        prompt = """
You are RoadGuard AI, a road-damage visual inspection system.

Inspect ONLY the visible road condition in the image. Do not use assumptions about location, weather, traffic, road ownership, or information outside the image.

Damage Type — choose exactly one:
- Pothole
- Crack
- Surface deterioration
- Road edge damage
- Water-related damage
- Other
- No visible road damage

Severity — choose exactly one using these strict visual criteria:

Minor:
- Small or localized visible damage.
- Limited apparent effect on the road surface.
- No clear sign of major structural deterioration.

Moderate:
- Clearly visible damage affecting a noticeable area.
- More than a minor defect, but the road surface still appears generally serviceable.
- No strong visual evidence of extensive structural failure.

Severe:
- Large, deep, extensive, or widespread damage.
- Multiple significant defects or clear substantial deterioration.
- Strong visual evidence that repair is needed soon.

Critical:
- Extremely extensive/deep damage, major structural failure, severe collapse, or an immediate and obvious major safety hazard.
- Use Critical only when the image provides strong visual evidence for this level.

Not determinable:
- Use this when image quality, angle, obstruction, or visible evidence is insufficient.

IMPORTANT:
- Do not upgrade severity merely because the damage is a pothole.
- Do not call damage Severe or Critical without visible evidence supporting that level.
- Do not infer hidden damage beneath the road surface.
- When evidence is between two levels, choose the lower level unless the image clearly supports the higher level.
- Judge visible extent, depth, spread, and structural appearance.
- Be conservative and consistent.
- Do NOT determine Priority or Priority Score. The Flask backend calculates those values.

Evidence:
Describe only visible evidence in one or two short sentences.

Recommendation:
Give one short practical road-maintenance recommendation.

Return ONLY these four fields, each on its own separate line:

Damage Type: ...
Severity: ...
Evidence: ...
Recommendation: ...

Do not add headings, explanations, markdown, or extra lines.
"""

        # ----------------------------------------------------
        # Primary model
        # ----------------------------------------------------

        try:
            return _run_gemini_with_retry(
                GEMINI_MODEL,
                uploaded_file,
                prompt
            )

        except Exception as primary_error:

            print(
                "Primary Gemini model failed:",
                str(primary_error)
            )

            # ------------------------------------------------
            # Fallback model for temporary service failures
            # ------------------------------------------------

            if (
                GEMINI_FALLBACK_MODEL
                and GEMINI_FALLBACK_MODEL != GEMINI_MODEL
                and _is_retryable_gemini_error(
                    primary_error
                )
            ):

                print(
                    "Trying Gemini fallback model:",
                    GEMINI_FALLBACK_MODEL
                )

                try:
                    return _run_gemini_with_retry(
                        GEMINI_FALLBACK_MODEL,
                        uploaded_file,
                        prompt
                    )

                except Exception as fallback_error:

                    print(
                        "Fallback Gemini model failed:",
                        str(fallback_error)
                    )

                    return (
                        "AI analysis temporarily unavailable. "
                        "Both Gemini models are currently unavailable. "
                        "Please try again shortly."
                    )

            return (
                "AI analysis failed: "
                + str(primary_error)
            )

    except Exception as e:

        print(
            "Gemini image processing error:",
            str(e)
        )

        return (
            "AI analysis failed: "
            + str(e)
        )


# ============================================================
# GEMINI RESULT PARSING + SMART PRIORITY SCORING
# ============================================================

DAMAGE_TYPES = {
    "pothole": "Pothole",
    "crack": "Crack",
    "surface deterioration": "Surface deterioration",
    "road edge damage": "Road edge damage",
    "water-related damage": "Water-related damage",
    "other": "Other",
    "no visible road damage": "No visible road damage",
}

SEVERITIES = {
    "minor": "Minor",
    "moderate": "Moderate",
    "severe": "Severe",
    "critical": "Critical",
    "not determinable": "Not determinable",
}

PRIORITIES = {
    "low": "Low",
    "medium": "Medium",
    "high": "High",
    "critical": "Critical",
    "not determinable": "Not determinable",
}

SEVERITY_SCORES = {
    "minor": 20,
    "moderate": 40,
    "severe": 70,
    "critical": 90,
    "not determinable": 0,
}

DAMAGE_TYPE_WEIGHTS = {
    "pothole": 10,
    "crack": 10,
    "surface deterioration": 5,
    "road edge damage": 5,
    "water-related damage": 10,
    "other": 0,
    "no visible road damage": 0,
}


def _clean_ai_value(value):
    if value is None:
        return ""
    return re.sub(r"\s+", " ", str(value)).strip()


def parse_gemini_analysis(analysis):
    """Parse current four-field and older five-field Gemini responses."""
    text = str(analysis or "").strip()

    if (
        not text
        or text.lower() == "pending analysis"
        or text.lower().startswith("ai analysis")
    ):
        return {
            "damage_type": None,
            "severity": None,
            "priority": None,
            "evidence": None,
            "recommendation": None,
        }

    fields = {}

    patterns = {
        "damage_type": r"^Damage Type:\s*(.+)$",
        "severity": r"^Severity:\s*(.+)$",
        "priority": r"^Priority:\s*(.+)$",
        "evidence": r"^Evidence:\s*(.+)$",
        "recommendation": r"^Recommendation:\s*(.+)$",
    }

    for line in text.splitlines():
        line = line.strip()

        for key, pattern in patterns.items():
            match = re.match(
                pattern,
                line,
                flags=re.IGNORECASE
            )

            if match:
                fields[key] = _clean_ai_value(match.group(1))
                break

    damage_raw = _clean_ai_value(fields.get("damage_type"))
    severity_raw = _clean_ai_value(fields.get("severity"))
    priority_raw = _clean_ai_value(fields.get("priority"))

    return {
        "damage_type": DAMAGE_TYPES.get(
            damage_raw.lower(),
            "Other" if damage_raw else None
        ),
        "severity": SEVERITIES.get(
            severity_raw.lower(),
            "Not determinable" if severity_raw else None
        ),
        # Compatibility only for older stored Gemini responses.
        "priority": PRIORITIES.get(
            priority_raw.lower(),
            "Not determinable" if priority_raw else None
        ),
        "evidence": fields.get("evidence"),
        "recommendation": fields.get("recommendation"),
    }


def calculate_priority_score(damage_type, severity):
    """
    Deterministic maintenance score.
    Severity is the main factor; damage type adds a small weight.
    Maximum score is 100.
    """
    if not severity:
        return None

    severity_key = str(severity).strip().lower()
    damage_key = str(damage_type or "").strip().lower()

    if severity_key == "not determinable":
        return 0

    severity_score = SEVERITY_SCORES.get(
        severity_key,
        0
    )

    damage_weight = DAMAGE_TYPE_WEIGHTS.get(
        damage_key,
        0
    )

    return min(
        max(severity_score + damage_weight, 0),
        100
    )


def priority_from_score(score):
    """
    0-24   = Low
    25-49  = Medium
    50-74  = High
    75-100 = Critical
    """
    if score is None:
        return "Not determinable"

    if score == 0:
        return "Not determinable"

    if score <= 24:
        return "Low"

    if score <= 49:
        return "Medium"

    if score <= 74:
        return "High"

    return "Critical"


def update_report_from_analysis(report):
    """Store AI fields and calculate final priority on the backend."""
    parsed = parse_gemini_analysis(report.analysis)

    report.damage_type = parsed["damage_type"]
    report.severity = parsed["severity"]

    report.priority_score = calculate_priority_score(
        report.damage_type,
        report.severity
    )

    report.priority = priority_from_score(
        report.priority_score
    )

    return parsed


def serialize_created_at(value):
    """Return a consistent IST ISO timestamp for old and new reports."""
    if not value:
        return None

    if value.tzinfo is None:
        value = value.replace(
            tzinfo=INDIA_TIMEZONE
        )
    else:
        value = value.astimezone(
            INDIA_TIMEZONE
        )

    return value.isoformat()


# ============================================================
# USER REGISTRATION
# ============================================================

@app.route(
    "/api/user/register",
    methods=["POST"]
)
def register_user():

    username = get_username_from_request()

    password = get_password_from_request()

    # --------------------------------------------------------
    # Validate username
    # --------------------------------------------------------

    valid_username, username_error = (
        validate_username(username)
    )

    if not valid_username:

        return jsonify({
            "error": username_error
        }), 400

    # --------------------------------------------------------
    # Validate password
    # --------------------------------------------------------

    valid_password, password_error = (
        validate_password(password)
    )

    if not valid_password:

        return jsonify({
            "error": password_error
        }), 400

    # --------------------------------------------------------
    # Check existing user
    # --------------------------------------------------------

    existing_user = User.query.filter_by(
        email=username
    ).first()

    if existing_user:

        return jsonify({
            "error": (
                "Username already exists. "
                "Please choose another username."
            )
        }), 409

    # --------------------------------------------------------
    # Create user
    # --------------------------------------------------------

    try:

        hashed_password = hash_password(
            password
        )

        user = User(
            email=username,
            password=hashed_password,
            role="user"
        )

        db.session.add(user)

        db.session.commit()

        return jsonify({
            "message": "Account created successfully",
            "user_id": user.id,
            "username": user.email,
            "role": user.role
        }), 201

    except Exception as e:

        db.session.rollback()

        print(
            "Registration error:",
            str(e)
        )

        return jsonify({
            "error": "Unable to create account."
        }), 500


# ============================================================
# REGISTRATION ALIAS
# ============================================================
#
# Your current React Register.jsx calls:
#
# POST /signup
#
# So we provide this endpoint too.
#
# ============================================================

@app.route(
    "/signup",
    methods=["POST"]
)
def signup():

    return register_user()


# ============================================================
# USER LOGIN
# ============================================================

@app.route(
    "/api/user/login",
    methods=["POST"]
)
def user_login():

    username = get_username_from_request()

    password = get_password_from_request()

    # --------------------------------------------------------
    # Validate input
    # --------------------------------------------------------

    if not username or not password:

        return jsonify({
            "error": (
                "Username and password are required."
            )
        }), 400

    username = username.strip()

    # --------------------------------------------------------
    # Find user
    # --------------------------------------------------------

    user = User.query.filter_by(
        email=username
    ).first()

    if not user:

        return jsonify({
            "error": "Invalid username or password."
        }), 401

    # --------------------------------------------------------
    # Verify password
    # --------------------------------------------------------

    if not verify_password(
        password,
        user.password
    ):

        return jsonify({
            "error": "Invalid username or password."
        }), 401

    # --------------------------------------------------------
    # Upgrade legacy plain-text password
    # --------------------------------------------------------

    try:

        if not (
            user.password.startswith("pbkdf2:")
            or user.password.startswith("scrypt:")
        ):

            user.password = hash_password(
                password
            )

            db.session.commit()

    except Exception as e:

        print(
            "Password upgrade warning:",
            str(e)
        )

    # --------------------------------------------------------
    # Login successful
    # --------------------------------------------------------

    return jsonify({

        "message": "Login successful",

        "user_id": user.id,

        "username": user.email,

        "role": user.role

    }), 200


# ============================================================
# LOGIN ALIAS
# ============================================================
#
# Your current React Login.jsx calls:
#
# POST /login
#
# So we provide this endpoint too.
#
# ============================================================

@app.route(
    "/login",
    methods=["POST"]
)
def login():

    return user_login()


# ============================================================
# ADMIN LOGIN
# ============================================================
@app.route("/api/admin/login", methods=["POST"])
@app.route("/admin/login", methods=["POST"])
def admin_login():
    """
    Administrator login.

    After successful backend verification, a random admin token is
    returned. Protected admin requests must send this token as:

        Authorization: Bearer <admin_token>

    Tokens live only while this Flask process is running.
    """

    if request.is_json:
        data = request.get_json(silent=True) or {}

        email = (
            data.get("email")
            or data.get("username")
            or ""
        ).strip()

        password = data.get("password") or ""

    else:
        email = (
            request.form.get("email")
            or request.form.get("username")
            or ""
        ).strip()

        password = request.form.get("password") or ""

    ADMIN_EMAIL = "admin@gmail.com"
    ADMIN_PASSWORD = "Admin@123"

    if (
        email.lower() != ADMIN_EMAIL.lower()
        or password != ADMIN_PASSWORD
    ):
        return jsonify({
            "message": "Invalid administrator credentials."
        }), 401

    if not hasattr(app, "admin_tokens"):
        app.admin_tokens = set()

    admin_token = secrets.token_urlsafe(32)
    app.admin_tokens.add(admin_token)

    return jsonify({
        "message": "Administrator login successful.",
        "role": "admin",
        "username": "Administrator",
        "email": ADMIN_EMAIL,
        "admin_token": admin_token
    }), 200


# ============================================================
# ADMIN AUTHENTICATION HELPER
# ============================================================

def require_admin_token():
    """
    Verify the admin token from:

        Authorization: Bearer <admin_token>
    """

    authorization = request.headers.get("Authorization", "")

    if not authorization.startswith("Bearer "):
        return False

    token = authorization[7:].strip()

    if not token:
        return False

    admin_tokens = getattr(app, "admin_tokens", set())

    return token in admin_tokens


# ============================================================
# ADMIN LOGOUT
# ============================================================

@app.route(
    "/api/admin/logout",
    methods=["POST"]
)
def admin_logout():

    authorization = request.headers.get("Authorization", "")

    if authorization.startswith("Bearer "):
        token = authorization[7:].strip()

        if hasattr(app, "admin_tokens"):
            app.admin_tokens.discard(token)

    return jsonify({
        "message": "Administrator logged out successfully."
    }), 200


# ============================================================
# REPORT UPLOAD
# ============================================================

@app.route(
    "/api/report/upload",
    methods=["POST"]
)
def upload_report():

    user_id = request.form.get(
        "user_id"
    )

    location = request.form.get(
        "location"
    )

    image = request.files.get(
        "image"
    )

    # --------------------------------------------------------
    # Validate fields
    # --------------------------------------------------------

    if not user_id:

        return jsonify({
            "error": "User ID is required."
        }), 400

    if not location:

        return jsonify({
            "error": "Location is required."
        }), 400

    if not image:

        return jsonify({
            "error": "Road image is required."
        }), 400

    # --------------------------------------------------------
    # Validate user exists
    # --------------------------------------------------------

    try:

        user = db.session.get(User, int(user_id))

    except Exception:

        user = None

    if not user:

        return jsonify({
            "error": "Invalid user."
        }), 401

    # --------------------------------------------------------
    # Generate safe unique filename
    # --------------------------------------------------------

    original_name = image.filename

    if not original_name:

        return jsonify({
            "error": "Invalid image filename."
        }), 400

    extension = os.path.splitext(
        original_name
    )[1].lower()

    allowed_extensions = [
        ".jpg",
        ".jpeg",
        ".png",
        ".webp"
    ]

    if extension not in allowed_extensions:

        return jsonify({
            "error": (
                "Only JPG, JPEG, PNG and WEBP "
                "images are supported."
            )
        }), 400

    filename = (
        str(uuid.uuid4())
        + extension
    )

    filepath = os.path.join(
        UPLOAD_FOLDER,
        filename
    )

    # --------------------------------------------------------
    # Save image
    # --------------------------------------------------------

    try:

        image.save(
            filepath
        )

    except Exception as e:

        print(
            "Image save error:",
            str(e)
        )

        return jsonify({
            "error": "Unable to save image."
        }), 500

    image_path = (
        f"/uploads/{filename}"
    )

    # --------------------------------------------------------
    # Create report
    # --------------------------------------------------------

    # Capture upload time before Gemini analysis so AI processing
    # time does not affect the displayed report timestamp.
    upload_time = datetime.now(
        INDIA_TIMEZONE
    )

    report = Report(

        user_id=int(user_id),

        location=location,

        image_path=image_path,

        analysis="Pending analysis",

        created_at=upload_time

    )

    try:

        db.session.add(
            report
        )

        db.session.commit()

    except Exception as e:

        db.session.rollback()

        print(
            "Report database error:",
            str(e)
        )

        return jsonify({
            "error": (
                "Unable to save report."
            )
        }), 500

    # --------------------------------------------------------
    # RUN AI ANALYSIS
    # --------------------------------------------------------
    #
    # Analyze the image immediately after upload so the user
    # report can contain the Gemini result without waiting for
    # the admin dashboard to be opened.
    #
    # If Gemini is temporarily unavailable, the upload still
    # succeeds and the report keeps the failure message. The
    # admin dashboard can retry failed analyses later.
    # --------------------------------------------------------

    try:

        report.analysis = analyze_image_with_gemini(
            filepath
        )

        update_report_from_analysis(report)

        db.session.commit()

    except Exception as e:

        db.session.rollback()

        print(
            "Upload-time Gemini analysis error:",
            str(e)
        )

        # Keep the report available even if AI is unavailable.
        report.analysis = (
            "AI analysis temporarily unavailable. "
            "The report was uploaded successfully. "
            "Please retry AI analysis from the admin dashboard."
        )

        try:
            db.session.add(report)
            db.session.commit()
        except Exception as save_error:
            db.session.rollback()
            print(
                "Unable to save AI fallback status:",
                str(save_error)
            )

    # --------------------------------------------------------
    # Return result
    # --------------------------------------------------------

    return jsonify({

        "message": (
            "Report uploaded successfully."
        ),

        "report_id": report.id,

        "user_id": report.user_id,

        "location": report.location,

        "image_path": report.image_path,

        "analysis": report.analysis,
        "damage_type": report.damage_type,
        "severity": report.severity,
        "priority": report.priority,
        "priority_score": report.priority_score,
        "created_at": serialize_created_at(report.created_at)

    }), 201


# ============================================================
# GET USER REPORTS
# ============================================================

@app.route(
    "/api/user/reports/<int:user_id>",
    methods=["GET"]
)
def get_user_reports(user_id):

    # --------------------------------------------------------
    # Verify user
    # --------------------------------------------------------

    user = db.session.get(User, user_id)

    if not user:

        return jsonify({
            "error": "User not found."
        }), 404

    # --------------------------------------------------------
    # Get reports
    # --------------------------------------------------------

    reports = Report.query.filter_by(
        user_id=user_id
    ).order_by(
        Report.id.desc()
    ).all()

    result = []

    for report in reports:

        result.append({

            "id": report.id,

            "user_id": report.user_id,

            "location": report.location,

            "image_path": report.image_path,

            "analysis": report.analysis,
            "damage_type": report.damage_type,
            "severity": report.severity,
            "priority": report.priority,
            "priority_score": report.priority_score,
            "created_at": serialize_created_at(report.created_at)

        })

    return jsonify(
        result
    ), 200


# ============================================================
# USER - DELETE ONE REPORT
# ============================================================

@app.route(
    "/api/user/reports/<int:user_id>/<int:report_id>",
    methods=["DELETE"]
)
def delete_user_report(user_id, report_id):

    report = db.session.get(Report, report_id)

    if not report:
        return jsonify({"error": "Report not found."}), 404

    if report.user_id != user_id:
        return jsonify({
            "error": "You are not authorized to delete this report."
        }), 403

    try:
        if report.image_path:
            filename = os.path.basename(report.image_path)
            filepath = os.path.join(UPLOAD_FOLDER, filename)
            if os.path.isfile(filepath):
                os.remove(filepath)

        db.session.delete(report)
        db.session.commit()

        return jsonify({
            "message": "Report deleted successfully."
        }), 200

    except Exception as e:
        db.session.rollback()
        print("User report delete error:", str(e))
        return jsonify({"error": "Unable to delete report."}), 500


# ============================================================
# ADMIN - GET ALL REPORTS
# ============================================================

@app.route(
    "/api/admin/reports",
    methods=["GET"]
)
def get_all_reports():

    if not require_admin_token():
        return jsonify({
            "error": "Administrator authentication required."
        }), 401

    reports = Report.query.order_by(
        Report.id.desc()
    ).all()

    result = []

    for report in reports:

        # ----------------------------------------------------
        # Run AI analysis if not already analyzed
        # ----------------------------------------------------

        analysis_text = (
            str(report.analysis or "").strip().lower()
        )

        needs_ai_analysis = (
            analysis_text in (
                "",
                "pending analysis"
            )
            or analysis_text.startswith(
                "ai analysis failed"
            )
            or analysis_text.startswith(
                "ai analysis temporarily unavailable"
            )
        )

        if needs_ai_analysis:

            try:

                # Convert relative path to local path
                local_path = report.image_path

                if local_path.startswith(
                    "/uploads/"
                ):

                    local_path = local_path[
                        1:
                    ]

                report.analysis = (
                    analyze_image_with_gemini(
                        local_path
                    )
                )

                update_report_from_analysis(report)

                db.session.commit()

            except Exception as e:

                db.session.rollback()

                report.analysis = (
                    "AI analysis failed: "
                    + str(e)
                )

                try:

                    db.session.commit()

                except Exception:

                    db.session.rollback()

        # ----------------------------------------------------
        # Backfill structured fields for older reports that already
        # contain a valid Gemini response.
        if (
            report.analysis
            and report.damage_type is None
            and report.severity is None
            and report.priority is None
        ):
            try:
                update_report_from_analysis(report)
                db.session.commit()
            except Exception as e:
                db.session.rollback()
                print(
                    "Structured AI field update warning:",
                    str(e)
                )

        # Add report to response
        # ----------------------------------------------------

        result.append({

            "id": report.id,

            "user_id": report.user_id,

            "location": report.location,

            "image_path": report.image_path,

            "analysis": report.analysis,
            "damage_type": report.damage_type,
            "severity": report.severity,
            "priority": report.priority,
            "priority_score": report.priority_score,
            "created_at": serialize_created_at(report.created_at)

        })

    return jsonify(
        result
    ), 200


# ============================================================
# ADMIN - DELETE ONE REPORT
# ============================================================

@app.route(
    "/api/admin/reports/<int:report_id>",
    methods=["DELETE"]
)
def delete_admin_report(report_id):

    if not require_admin_token():
        return jsonify({
            "error": "Administrator authentication required."
        }), 401

    report = db.session.get(Report, report_id)

    if not report:
        return jsonify({
            "error": "Report not found."
        }), 404

    try:
        if report.image_path:
            filename = os.path.basename(report.image_path)
            filepath = os.path.join(
                UPLOAD_FOLDER,
                filename
            )

            if os.path.isfile(filepath):
                os.remove(filepath)

        db.session.delete(report)
        db.session.commit()

        return jsonify({
            "message": "Report deleted successfully."
        }), 200

    except Exception as e:
        db.session.rollback()
        print("Admin report delete error:", str(e))

        return jsonify({
            "error": "Unable to delete report."
        }), 500


# ============================================================
# ADMIN - DELETE ALL REPORTS
# ============================================================

@app.route(
    "/api/admin/reports",
    methods=["DELETE"]
)
def delete_all_admin_reports():

    if not require_admin_token():
        return jsonify({
            "error": "Administrator authentication required."
        }), 401

    reports = Report.query.all()

    try:
        for report in reports:
            if report.image_path:
                filename = os.path.basename(report.image_path)
                filepath = os.path.join(
                    UPLOAD_FOLDER,
                    filename
                )

                if os.path.isfile(filepath):
                    os.remove(filepath)

            db.session.delete(report)

        db.session.commit()

        return jsonify({
            "message": "All reports deleted successfully.",
            "deleted_count": len(reports)
        }), 200

    except Exception as e:
        db.session.rollback()
        print("Admin delete-all error:", str(e))

        return jsonify({
            "error": "Unable to delete all reports."
        }), 500


# ============================================================
# HEALTH CHECK
# ============================================================

@app.route(
    "/",
    methods=["GET"]
)
def home():

    return jsonify({

        "message": (
            "RoadGuard AI backend is running."
        ),

        "status": "online"

    })


# ============================================================
# SERVER START
# ============================================================

if __name__ == "__main__":

    app.run(
        host="127.0.0.1",
        port=5000,
        debug=True
    )