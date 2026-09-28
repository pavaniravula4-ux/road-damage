import os
import re
import secrets
import sqlite3
import time
import uuid
from datetime import datetime, timezone, timedelta

from flask import Flask, request, jsonify, send_from_directory
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS

from google import genai
from google.genai import types
from dotenv import load_dotenv

from werkzeug.security import generate_password_hash, check_password_hash


# ============================================================
# LOAD ENVIRONMENT
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
        r"/api/*": {
            "origins": [
                "http://localhost:5173",
                "http://127.0.0.1:5173",
            ],
            "allow_headers": [
                "Content-Type",
                "Authorization",
            ],
            "methods": [
                "GET",
                "POST",
                "PUT",
                "PATCH",
                "DELETE",
                "OPTIONS",
            ],
        },
        r"/uploads/*": {
            "origins": [
                "http://localhost:5173",
                "http://127.0.0.1:5173",
            ],
            "methods": ["GET", "OPTIONS"],
        },
    },
    supports_credentials=True,
)


# ============================================================
# DATABASE
# ============================================================
#
# Flask-SQLAlchemy stores sqlite:///roadguard.db in Flask's
# instance folder by default:
#
# backend/
#   instance/
#       roadguard.db
#
# This matches your existing database.
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
        primary_key=True,
    )

    # Existing column is kept as the username/email field.
    email = db.Column(
        db.String(255),
        unique=True,
        nullable=False,
    )

    password = db.Column(
        db.String(255),
        nullable=False,
    )

    role = db.Column(
        db.String(50),
        default="user",
        nullable=False,
    )


class Report(db.Model):
    __tablename__ = "report"

    id = db.Column(
        db.Integer,
        primary_key=True,
    )

    user_id = db.Column(
        db.Integer,
        nullable=False,
    )

    location = db.Column(
        db.String(255),
        nullable=False,
    )

    image_path = db.Column(
        db.String(255),
        nullable=False,
    )

    analysis = db.Column(
        db.Text,
        nullable=False,
    )

    damage_type = db.Column(
        db.String(100),
        nullable=True,
    )

    severity = db.Column(
        db.String(50),
        nullable=True,
    )

    priority = db.Column(
        db.String(50),
        nullable=True,
    )

    priority_score = db.Column(
        db.Integer,
        nullable=True,
    )

    # ========================================================
    # OPERATOR ASSIGNMENT + TRACKING
    # ========================================================

    assigned_operator_id = db.Column(
        db.Integer,
        nullable=True,
    )

    status = db.Column(
        db.String(50),
        default="Unassigned",
        nullable=False,
    )

    assigned_at = db.Column(
        db.DateTime,
        nullable=True,
    )

    completed_at = db.Column(
        db.DateTime,
        nullable=True,
    )

    # ========================================================
    # AFTER-WORK GEMINI VERIFICATION
    # ========================================================

    after_work_image_path = db.Column(
        db.String(255),
        nullable=True,
    )

    verification_analysis = db.Column(
        db.Text,
        nullable=True,
    )

    verification_status = db.Column(
        db.String(50),
        nullable=True,
    )

    verification_confidence = db.Column(
        db.Float,
        nullable=True,
    )

    verified_at = db.Column(
        db.DateTime,
        nullable=True,
    )

    created_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(INDIA_TIMEZONE),
        nullable=True,
    )


# ============================================================
# CREATE TABLES + SAFE MIGRATION
# ============================================================

with app.app_context():
    db.create_all()

    # db.create_all() does not add columns to an existing table.
    # Add the four tracking columns if an older database is used.
    inspector = db.inspect(db.engine)

    if "report" in inspector.get_table_names():
        existing_columns = {
            column["name"]
            for column in inspector.get_columns("report")
        }

        migration_statements = {
            "assigned_operator_id": (
                "ALTER TABLE report "
                "ADD COLUMN assigned_operator_id INTEGER"
            ),
            "status": (
                "ALTER TABLE report "
                "ADD COLUMN status TEXT DEFAULT 'Unassigned'"
            ),
            "assigned_at": (
                "ALTER TABLE report "
                "ADD COLUMN assigned_at DATETIME"
            ),
            "completed_at": (
                "ALTER TABLE report "
                "ADD COLUMN completed_at DATETIME"
            ),
            "after_work_image_path": (
                "ALTER TABLE report "
                "ADD COLUMN after_work_image_path VARCHAR(255)"
            ),
            "verification_analysis": (
                "ALTER TABLE report "
                "ADD COLUMN verification_analysis TEXT"
            ),
            "verification_status": (
                "ALTER TABLE report "
                "ADD COLUMN verification_status VARCHAR(50)"
            ),
            "verification_confidence": (
                "ALTER TABLE report "
                "ADD COLUMN verification_confidence FLOAT"
            ),
            "verified_at": (
                "ALTER TABLE report "
                "ADD COLUMN verified_at DATETIME"
            ),
        }

        for column_name, statement in migration_statements.items():
            if column_name not in existing_columns:
                try:
                    db.session.execute(db.text(statement))
                    db.session.commit()
                    print(
                        f"Database migration: added {column_name}"
                    )
                except Exception as migration_error:
                    db.session.rollback()
                    print(
                        f"Database migration warning for "
                        f"{column_name}: {migration_error}"
                    )


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


GEMINI_MODEL = os.getenv(
    "GEMINI_MODEL",
    "gemini-3.6-flash",
)

GEMINI_FALLBACK_MODEL = os.getenv(
    "GEMINI_FALLBACK_MODEL",
    "gemini-3.5-flash-lite",
)

GEMINI_MAX_RETRIES = int(
    os.getenv(
        "GEMINI_MAX_RETRIES",
        "2",
    )
)

GEMINI_RETRY_DELAY = float(
    os.getenv(
        "GEMINI_RETRY_DELAY",
        "2",
    )
)


if client is not None:
    print(
        "Gemini configured:",
        f"primary={GEMINI_MODEL}, "
        f"fallback={GEMINI_FALLBACK_MODEL}",
    )
else:
    print(
        "Gemini is not configured. "
        "Add GEMINI_API_KEY to backend/.env."
    )


# ============================================================
# IN-MEMORY AUTH TOKENS
# ============================================================
#
# Admin token:
#     token -> nothing
#
# Operator token:
#     token -> operator user id
#
# Tokens disappear when Flask is restarted.
# ============================================================

app.admin_tokens = set()
app.operator_tokens = {}


# ============================================================
# PASSWORD HELPERS
# ============================================================


def hash_password(password):
    return generate_password_hash(password)


def verify_password(password, stored_password):
    if not stored_password:
        return False

    try:
        if (
            stored_password.startswith("pbkdf2:")
            or stored_password.startswith("scrypt:")
        ):
            return check_password_hash(
                stored_password,
                password,
            )
    except Exception:
        return False

    # Compatibility for old development accounts.
    return password == stored_password


# ============================================================
# VALIDATION HELPERS
# ============================================================


def validate_username(username):
    if not username:
        return False, "Username is required."

    username = username.strip()

    if len(username) < 3:
        return False, "Username must be at least 3 characters."

    if len(username) > 50:
        return False, "Username must be 50 characters or less."

    return True, ""


def validate_password(password):
    if not password:
        return False, "Password is required."

    if len(password) < 6:
        return False, "Password must be at least 6 characters."

    return True, ""


def get_username_from_request():
    if request.is_json:
        data = request.get_json(silent=True) or {}

        username = (
            data.get("username")
            or data.get("email")
        )

        return (
            str(username).strip()
            if username
            else None
        )

    username = (
        request.form.get("username")
        or request.form.get("email")
    )

    return (
        username.strip()
        if username
        else None
    )


def get_password_from_request():
    if request.is_json:
        data = request.get_json(silent=True) or {}
        return data.get("password")

    return request.form.get("password")


# ============================================================
# DATE HELPERS
# ============================================================


def serialize_created_at(value):
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
# UPLOAD FOLDER
# ============================================================

UPLOAD_FOLDER = os.path.join(
    app.root_path,
    "uploads",
)

os.makedirs(
    UPLOAD_FOLDER,
    exist_ok=True,
)


# ============================================================
# AFTER-WORK VERIFICATION UPLOADS
# ============================================================

VERIFICATION_UPLOAD_FOLDER = os.path.join(
    app.root_path,
    "verification_uploads",
)

os.makedirs(
    VERIFICATION_UPLOAD_FOLDER,
    exist_ok=True,
)


@app.route(
    "/verification_uploads/<path:filename>"
)
def verification_uploaded_file(filename):
    return send_from_directory(
        VERIFICATION_UPLOAD_FOLDER,
        filename,
    )


# ============================================================
# STATIC UPLOADED FILES
# ============================================================


@app.route(
    "/uploads/<path:filename>"
)
def uploaded_file(filename):
    return send_from_directory(
        UPLOAD_FOLDER,
        filename,
    )


# ============================================================
# GEMINI HELPERS
# ============================================================


def _is_retryable_gemini_error(error):
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


def _run_gemini_with_retry(
    model,
    uploaded_file,
    prompt,
):
    last_error = None

    total_attempts = (
        GEMINI_MAX_RETRIES + 1
    )

    for attempt in range(total_attempts):
        try:
            print(
                f"Gemini attempt "
                f"{attempt + 1}/{total_attempts} "
                f"using {model}..."
            )

            response = client.models.generate_content(
                model=model,
                contents=[
                    uploaded_file,
                    prompt,
                ],
                config=types.GenerateContentConfig(
                    temperature=0,
                ),
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


def validate_road_damage_image(filepath):
    """Validate that a user-uploaded image is actually a damaged road.

    This function is used ONLY by the normal user report-upload flow.
    It is intentionally separate from operator after-repair verification.
    """
    if client is None:
        print(
            "Road image validation unavailable: "
            "GEMINI_API_KEY is not configured."
        )
        return None

    if not os.path.exists(filepath):
        print("Road image validation failed: image file not found.")
        return None

    validation_prompt = """
You are the STRICT image gatekeeper for RoadGuard AI.

Your ONLY task is to decide whether this uploaded image is a valid
road-damage report image.

Return VALID only when BOTH conditions are clearly visible:
1. A road, street, roadway, pavement, or road surface is visible.
2. Actual damage to that road surface is visible.

Examples of valid road damage:
- pothole
- road crack
- broken or damaged pavement
- surface deterioration
- damaged road edge
- water-related road damage
- another clearly visible road defect

Return INVALID for:
- houses or buildings
- rooms or indoor scenes
- people or portraits
- animals
- food
- plants
- documents or screenshots
- random objects
- vehicle-only images
- normal/undamaged roads
- scenery without visible road damage
- images where the road or damage cannot be clearly determined

A house, person, animal, or vehicle near a road does NOT make the image valid.
Do not use the filename. Do not guess the user's intention.
If the evidence is unclear, return INVALID.

Return ONLY one word:
VALID
or
INVALID
"""

    try:
        uploaded_file = client.files.upload(
            file=filepath
        )

        try:
            result = _run_gemini_with_retry(
                GEMINI_MODEL,
                uploaded_file,
                validation_prompt,
            )
        except Exception as primary_error:
            print(
                "Primary Gemini road validation failed:",
                str(primary_error),
            )

            if (
                GEMINI_FALLBACK_MODEL
                and GEMINI_FALLBACK_MODEL != GEMINI_MODEL
                and _is_retryable_gemini_error(primary_error)
            ):
                try:
                    result = _run_gemini_with_retry(
                        GEMINI_FALLBACK_MODEL,
                        uploaded_file,
                        validation_prompt,
                    )
                except Exception as fallback_error:
                    print(
                        "Fallback Gemini road validation failed:",
                        str(fallback_error),
                    )
                    return None
            else:
                return None

        result = str(result or "").strip().upper()

        if result == "VALID":
            return True

        if result == "INVALID":
            return False

        print(
            "Unexpected road validation response:",
            result,
        )
        return False

    except Exception as e:
        print(
            "Road image validation error:",
            str(e),
        )
        return None


def analyze_image_with_gemini(filepath):
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
        uploaded_file = client.files.upload(
            file=filepath
        )

        prompt = """
You are RoadGuard AI, a road-damage visual inspection system.

Inspect ONLY the visible road condition in the image.

Do not use assumptions about location, weather, traffic,
road ownership, or information outside the image.

Damage Type — choose exactly one:
- Pothole
- Crack
- Surface deterioration
- Road edge damage
- Water-related damage
- Other
- No visible road damage

Severity — choose exactly one:

Minor:
- Small or localized visible damage.
- Limited apparent effect on the road surface.

Moderate:
- Clearly visible damage affecting a noticeable area.
- More than a minor defect, but the road still appears generally serviceable.

Severe:
- Large, deep, extensive, or widespread damage.
- Multiple significant defects or substantial deterioration.

Critical:
- Extremely extensive/deep damage,
- major structural failure,
- severe collapse,
- or an immediate obvious major safety hazard.

Not determinable:
- Image quality, angle, obstruction, or visible evidence is insufficient.

IMPORTANT:
- Do not upgrade severity merely because the damage is a pothole.
- Do not call damage Severe or Critical without visible evidence.
- Do not infer hidden damage.
- When evidence is between two levels, choose the lower level unless clearly supported.
- Do NOT determine Priority or Priority Score.
- The Flask backend calculates priority.

Evidence:
Describe only visible evidence in one or two short sentences.

Recommendation:
Give one short practical road-maintenance recommendation.

Return ONLY these four fields, each on its own line:

Damage Type: ...
Severity: ...
Evidence: ...
Recommendation: ...

Do not add headings, markdown, or extra lines.
"""

        try:
            return _run_gemini_with_retry(
                GEMINI_MODEL,
                uploaded_file,
                prompt,
            )

        except Exception as primary_error:
            print(
                "Primary Gemini model failed:",
                str(primary_error),
            )

            if (
                GEMINI_FALLBACK_MODEL
                and GEMINI_FALLBACK_MODEL != GEMINI_MODEL
                and _is_retryable_gemini_error(
                    primary_error
                )
            ):
                print(
                    "Trying Gemini fallback model:",
                    GEMINI_FALLBACK_MODEL,
                )

                try:
                    return _run_gemini_with_retry(
                        GEMINI_FALLBACK_MODEL,
                        uploaded_file,
                        prompt,
                    )

                except Exception as fallback_error:
                    print(
                        "Fallback Gemini model failed:",
                        str(fallback_error),
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
            str(e),
        )

        return (
            "AI analysis failed: "
            + str(e)
        )


# ============================================================
# BEFORE / AFTER REPAIR VERIFICATION WITH GEMINI
# ============================================================

def verify_repair_with_gemini(
    before_filepath,
    after_filepath,
):
    if client is None:
        raise RuntimeError(
            "GEMINI_API_KEY is not configured."
        )

    if not os.path.isfile(before_filepath):
        raise FileNotFoundError(
            "Original report image file was not found."
        )

    if not os.path.isfile(after_filepath):
        raise FileNotFoundError(
            "After-work image file was not found."
        )

    before_file = client.files.upload(
        file=before_filepath
    )

    after_file = client.files.upload(
        file=after_filepath
    )

    prompt = """
You are RoadGuard AI, a road repair verification system.

You will receive TWO images of the same road location:
1. BEFORE image — the original road-damage report.
2. AFTER image — the photo submitted after repair work.

Compare ONLY visible evidence in the two images.

Determine whether the visible road damage appears:
- Completed: the reported damage appears repaired.
- Partially Completed: some repair is visible, but damage remains.
- Not Completed: the reported damage remains substantially visible.
- Unclear: the images do not provide enough comparable evidence.

Do not assume work was completed merely because the second image exists.
Do not infer hidden repairs.
Do not use location, weather, traffic, or outside information.

Confidence must be a number from 0 to 100.

Evidence should briefly explain the visible before/after difference.

Recommendation should briefly state the next practical action.

Return ONLY these fields, one per line:

Status: Completed | Partially Completed | Not Completed | Unclear
Confidence: 0-100
Evidence: ...
Recommendation: ...
"""

    total_attempts = GEMINI_MAX_RETRIES + 1
    last_error = None

    models_to_try = [GEMINI_MODEL]

    if (
        GEMINI_FALLBACK_MODEL
        and GEMINI_FALLBACK_MODEL != GEMINI_MODEL
    ):
        models_to_try.append(
            GEMINI_FALLBACK_MODEL
        )

    for model in models_to_try:
        for attempt in range(total_attempts):
            try:
                print(
                    "Gemini repair verification "
                    f"attempt {attempt + 1}/{total_attempts} "
                    f"using {model}..."
                )

                response = client.models.generate_content(
                    model=model,
                    contents=[
                        before_file,
                        after_file,
                        prompt,
                    ],
                    config=types.GenerateContentConfig(
                        temperature=0,
                    ),
                )

                if response and response.text:
                    print(
                        "Gemini repair verification "
                        f"succeeded using {model}."
                    )
                    return response.text.strip()

                last_error = RuntimeError(
                    "Gemini returned an empty "
                    "repair verification response."
                )

            except Exception as exc:
                last_error = exc

                print(
                    "Gemini repair verification error "
                    f"using {model} "
                    f"(attempt {attempt + 1}/{total_attempts}): "
                    f"{exc}"
                )

                if not _is_retryable_gemini_error(exc):
                    raise

                if attempt < total_attempts - 1:
                    delay = (
                        GEMINI_RETRY_DELAY
                        * (2 ** attempt)
                    )

                    print(
                        "Temporary Gemini repair "
                        f"verification failure. "
                        f"Retrying in {delay:.1f} seconds..."
                    )

                    time.sleep(delay)

    raise last_error or RuntimeError(
        "Unable to verify the repair with Gemini."
    )


def parse_repair_verification(text):
    text = str(text or "").strip()

    status = "Unclear"
    confidence = None
    evidence = None
    recommendation = None

    status_match = re.search(
        r"^Status:\s*(.+)$",
        text,
        flags=re.IGNORECASE | re.MULTILINE,
    )

    if status_match:
        raw_status = status_match.group(1).strip().lower()

        if raw_status == "completed":
            status = "Completed"
        elif raw_status in {
            "partially completed",
            "partial",
            "partially_complete",
        }:
            status = "Partially Completed"
        elif raw_status in {
            "not completed",
            "not_complete",
            "incomplete",
        }:
            status = "Not Completed"
        else:
            status = "Unclear"

    confidence_match = re.search(
        r"^Confidence:\s*([0-9]+(?:\.[0-9]+)?)",
        text,
        flags=re.IGNORECASE | re.MULTILINE,
    )

    if confidence_match:
        try:
            confidence = float(
                confidence_match.group(1)
            )
            confidence = min(
                max(confidence, 0.0),
                100.0,
            )
        except ValueError:
            confidence = None

    evidence_match = re.search(
        r"^Evidence:\s*(.+)$",
        text,
        flags=re.IGNORECASE | re.MULTILINE,
    )

    if evidence_match:
        evidence = evidence_match.group(1).strip()

    recommendation_match = re.search(
        r"^Recommendation:\s*(.+)$",
        text,
        flags=re.IGNORECASE | re.MULTILINE,
    )

    if recommendation_match:
        recommendation = recommendation_match.group(1).strip()

    return {
        "status": status,
        "confidence": confidence,
        "evidence": evidence,
        "recommendation": recommendation,
        "raw_analysis": text,
    }


# ============================================================
# AI RESULT PARSING + PRIORITY
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

    return re.sub(
        r"\s+",
        " ",
        str(value),
    ).strip()


def parse_gemini_analysis(analysis):
    text = str(
        analysis or ""
    ).strip()

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
                flags=re.IGNORECASE,
            )

            if match:
                fields[key] = _clean_ai_value(
                    match.group(1)
                )
                break

    damage_raw = _clean_ai_value(
        fields.get("damage_type")
    )

    severity_raw = _clean_ai_value(
        fields.get("severity")
    )

    priority_raw = _clean_ai_value(
        fields.get("priority")
    )

    return {
        "damage_type": DAMAGE_TYPES.get(
            damage_raw.lower(),
            "Other" if damage_raw else None,
        ),
        "severity": SEVERITIES.get(
            severity_raw.lower(),
            "Not determinable" if severity_raw else None,
        ),
        "priority": PRIORITIES.get(
            priority_raw.lower(),
            "Not determinable" if priority_raw else None,
        ),
        "evidence": fields.get("evidence"),
        "recommendation": fields.get("recommendation"),
    }


def calculate_priority_score(
    damage_type,
    severity,
):
    if not severity:
        return None

    severity_key = str(
        severity
    ).strip().lower()

    damage_key = str(
        damage_type or ""
    ).strip().lower()

    if severity_key == "not determinable":
        return 0

    severity_score = SEVERITY_SCORES.get(
        severity_key,
        0,
    )

    damage_weight = DAMAGE_TYPE_WEIGHTS.get(
        damage_key,
        0,
    )

    return min(
        max(
            severity_score + damage_weight,
            0,
        ),
        100,
    )


def priority_from_score(score):
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
    parsed = parse_gemini_analysis(
        report.analysis
    )

    report.damage_type = parsed["damage_type"]
    report.severity = parsed["severity"]

    report.priority_score = calculate_priority_score(
        report.damage_type,
        report.severity,
    )

    report.priority = priority_from_score(
        report.priority_score
    )

    return parsed


# ============================================================
# SERIALIZATION
# ============================================================


def serialize_report(report):
    return {
        "id": report.id,
        "user_id": report.user_id,
        "location": report.location,
        "image_path": report.image_path,
        "analysis": report.analysis,
        "damage_type": report.damage_type,
        "severity": report.severity,
        "priority": report.priority,
        "priority_score": report.priority_score,

        # Operator tracking
        "assigned_operator_id": (
            report.assigned_operator_id
        ),
        "status": (
            report.status or "Unassigned"
        ),
        "assigned_at": serialize_created_at(
            report.assigned_at
        ),
        "completed_at": serialize_created_at(
            report.completed_at
        ),

        # After-work Gemini verification
        "after_work_image_path": (
            report.after_work_image_path
        ),
        "verification_analysis": (
            report.verification_analysis
        ),
        "verification_status": (
            report.verification_status
        ),
        "verification_confidence": (
            report.verification_confidence
        ),
        "verified_at": serialize_created_at(
            report.verified_at
        ),

        "created_at": serialize_created_at(
            report.created_at
        ),
    }


# ============================================================
# USER REGISTRATION
# ============================================================


@app.route(
    "/api/user/register",
    methods=["POST"],
)
def register_user():
    username = get_username_from_request()
    password = get_password_from_request()

    valid_username, username_error = (
        validate_username(username)
    )

    if not valid_username:
        return jsonify({
            "error": username_error,
        }), 400

    valid_password, password_error = (
        validate_password(password)
    )

    if not valid_password:
        return jsonify({
            "error": password_error,
        }), 400

    existing_user = User.query.filter_by(
        email=username
    ).first()

    if existing_user:
        return jsonify({
            "error": (
                "Username already exists. "
                "Please choose another username."
            ),
        }), 409

    try:
        user = User(
            email=username,
            password=hash_password(password),
            role="user",
        )

        db.session.add(user)
        db.session.commit()

        return jsonify({
            "message": "Account created successfully",
            "user_id": user.id,
            "username": user.email,
            "role": user.role,
        }), 201

    except Exception as e:
        db.session.rollback()

        print(
            "Registration error:",
            str(e),
        )

        return jsonify({
            "error": "Unable to create account.",
        }), 500


# ============================================================
# SIGNUP ALIAS
# ============================================================


@app.route(
    "/signup",
    methods=["POST"],
)
def signup():
    return register_user()


# ============================================================
# USER LOGIN
# ============================================================


@app.route(
    "/api/user/login",
    methods=["POST"],
)
def user_login():
    username = get_username_from_request()
    password = get_password_from_request()

    if not username or not password:
        return jsonify({
            "error": (
                "Username and password are required."
            ),
        }), 400

    username = username.strip()

    user = User.query.filter_by(
        email=username
    ).first()

    if not user:
        return jsonify({
            "error": "Invalid username or password.",
        }), 401

    if not verify_password(
        password,
        user.password,
    ):
        return jsonify({
            "error": "Invalid username or password.",
        }), 401

    # Upgrade old plain-text development passwords.
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
            str(e),
        )

    # Operator accounts use the operator portal.
    if str(user.role).lower() != "user":
        if str(user.role).lower() == "operator":
            return jsonify({
                "error": (
                    "Operator accounts must use "
                    "the Operator Login portal."
                ),
                "role": "operator",
            }), 403

        return jsonify({
            "error": (
                "This account cannot use the user login."
            ),
            "role": user.role,
        }), 403

    return jsonify({
        "message": "Login successful",
        "user_id": user.id,
        "username": user.email,
        "role": user.role,
    }), 200


# ============================================================
# LOGIN ALIAS
# ============================================================


@app.route(
    "/login",
    methods=["POST"],
)
def login():
    return user_login()


# ============================================================
# ADMIN LOGIN
# ============================================================


@app.route(
    "/api/admin/login",
    methods=["POST"],
)
@app.route(
    "/admin/login",
    methods=["POST"],
)
def admin_login():
    if request.is_json:
        data = request.get_json(
            silent=True
        ) or {}

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

        password = (
            request.form.get("password")
            or ""
        )

    ADMIN_EMAIL = "admin@gmail.com"
    ADMIN_PASSWORD = "Admin@123"

    if (
        email.lower() != ADMIN_EMAIL.lower()
        or password != ADMIN_PASSWORD
    ):
        return jsonify({
            "message": (
                "Invalid administrator credentials."
            ),
        }), 401

    admin_token = secrets.token_urlsafe(32)

    app.admin_tokens.add(
        admin_token
    )

    return jsonify({
        "message": (
            "Administrator login successful."
        ),
        "role": "admin",
        "username": "Administrator",
        "email": ADMIN_EMAIL,
        "admin_token": admin_token,
    }), 200


# ============================================================
# ADMIN TOKEN AUTHENTICATION
# ============================================================


def require_admin_token():
    authorization = request.headers.get(
        "Authorization",
        "",
    )

    if not authorization.startswith(
        "Bearer "
    ):
        return False

    token = authorization[7:].strip()

    if not token:
        return False

    return token in app.admin_tokens


# ============================================================
# ADMIN LOGOUT
# ============================================================


@app.route(
    "/api/admin/logout",
    methods=["POST"],
)
def admin_logout():
    authorization = request.headers.get(
        "Authorization",
        "",
    )

    if authorization.startswith("Bearer "):
        token = authorization[7:].strip()
        app.admin_tokens.discard(token)

    return jsonify({
        "message": (
            "Administrator logged out successfully."
        ),
    }), 200


# ============================================================
# OPERATOR LOGIN
# ============================================================


@app.route(
    "/api/operator/login",
    methods=["POST"],
)
@app.route(
    "/operator/login",
    methods=["POST"],
)
def operator_login():
    username = get_username_from_request()
    password = get_password_from_request()

    if not username or not password:
        return jsonify({
            "error": (
                "Username and password are required."
            ),
        }), 400

    username = username.strip()

    operator = User.query.filter_by(
        email=username
    ).first()

    if not operator:
        return jsonify({
            "error": "Invalid operator credentials.",
        }), 401

    if str(operator.role).lower() != "operator":
        return jsonify({
            "error": (
                "This account is not an operator account."
            ),
        }), 403

    if not verify_password(
        password,
        operator.password,
    ):
        return jsonify({
            "error": "Invalid operator credentials.",
        }), 401

    # Upgrade legacy password.
    try:
        if not (
            operator.password.startswith("pbkdf2:")
            or operator.password.startswith("scrypt:")
        ):
            operator.password = hash_password(
                password
            )
            db.session.commit()

    except Exception as e:
        print(
            "Operator password upgrade warning:",
            str(e),
        )

    operator_token = secrets.token_urlsafe(32)

    # IMPORTANT:
    # token -> operator ID
    # This lets the backend know which operator is logged in.
    app.operator_tokens[operator_token] = operator.id

    return jsonify({
        "message": "Operator login successful.",
        "user_id": operator.id,
        "username": operator.email,
        "email": operator.email,
        "role": "operator",
        "operator_token": operator_token,
    }), 200


# ============================================================
# OPERATOR TOKEN AUTHENTICATION
# ============================================================


def require_operator_token():
    authorization = request.headers.get(
        "Authorization",
        "",
    )

    if not authorization.startswith(
        "Bearer "
    ):
        return False

    token = authorization[7:].strip()

    if not token:
        return False

    return token in app.operator_tokens


def get_current_operator_id():
    authorization = request.headers.get(
        "Authorization",
        "",
    )

    if not authorization.startswith(
        "Bearer "
    ):
        return None

    token = authorization[7:].strip()

    if not token:
        return None

    return app.operator_tokens.get(
        token
    )


# ============================================================
# OPERATOR LOGOUT
# ============================================================


@app.route(
    "/api/operator/logout",
    methods=["POST"],
)
@app.route(
    "/operator/logout",
    methods=["POST"],
)
def operator_logout():
    authorization = request.headers.get(
        "Authorization",
        "",
    )

    if authorization.startswith("Bearer "):
        token = authorization[7:].strip()

        app.operator_tokens.pop(
            token,
            None,
        )

    return jsonify({
        "message": (
            "Operator logged out successfully."
        ),
    }), 200


# ============================================================
# ADMIN - CREATE OPERATOR
# ============================================================


@app.route(
    "/api/admin/operators",
    methods=["POST"],
)
def create_operator():
    if not require_admin_token():
        return jsonify({
            "error": (
                "Administrator authentication required."
            ),
        }), 401

    if request.is_json:
        data = request.get_json(
            silent=True
        ) or {}

        username = (
            data.get("username")
            or data.get("email")
            or ""
        ).strip()

        password = data.get("password") or ""

    else:
        username = (
            request.form.get("username")
            or request.form.get("email")
            or ""
        ).strip()

        password = (
            request.form.get("password")
            or ""
        )

    valid_username, username_error = (
        validate_username(username)
    )

    if not valid_username:
        return jsonify({
            "error": username_error,
        }), 400

    valid_password, password_error = (
        validate_password(password)
    )

    if not valid_password:
        return jsonify({
            "error": password_error,
        }), 400

    existing_user = User.query.filter_by(
        email=username
    ).first()

    if existing_user:
        return jsonify({
            "error": (
                "An account with this username "
                "already exists."
            ),
        }), 409

    try:
        operator = User(
            email=username,
            password=hash_password(password),
            role="operator",
        )

        db.session.add(operator)
        db.session.commit()

        return jsonify({
            "message": (
                "Operator created successfully."
            ),
            "operator": {
                "id": operator.id,
                "username": operator.email,
                "email": operator.email,
                "role": operator.role,
            },
        }), 201

    except Exception as e:
        db.session.rollback()

        print(
            "Create operator error:",
            str(e),
        )

        return jsonify({
            "error": "Unable to create operator.",
        }), 500


# ============================================================
# ADMIN - GET OPERATORS
# ============================================================


@app.route(
    "/api/admin/operators",
    methods=["GET"],
)
def get_operators():
    if not require_admin_token():
        return jsonify({
            "error": (
                "Administrator authentication required."
            ),
        }), 401

    try:
        operators = (
            User.query
            .filter_by(role="operator")
            .order_by(User.id.desc())
            .all()
        )

        # Return an array because this is the format normally
        # consumed by the Admin Dashboard.
        return jsonify([
            {
                "id": operator.id,
                "username": operator.email,
                "email": operator.email,
                "role": operator.role,
            }
            for operator in operators
        ]), 200

    except Exception as e:
        print(
            "Get operators error:",
            str(e),
        )

        return jsonify({
            "error": "Unable to load operators.",
        }), 500


# ============================================================
# ADMIN - GET USERS
# ============================================================


@app.route(
    "/api/admin/users",
    methods=["GET"],
)
def get_users():
    if not require_admin_token():
        return jsonify({
            "error": (
                "Administrator authentication required."
            ),
        }), 401

    try:
        users = (
            User.query
            .filter(
                User.role.isnot(None),
                User.role.ilike("user"),
            )
            .order_by(User.id.desc())
            .all()
        )

        return jsonify([
            {
                "id": user.id,
                "username": user.email,
                "email": user.email,
                "role": user.role,
            }
            for user in users
        ]), 200

    except Exception as e:
        db.session.rollback()
        print("Get users error:", str(e))

        return jsonify({
            "error": "Unable to load users.",
        }), 500




# ============================================================
# ADMIN - DELETE OPERATOR
# ============================================================


@app.route(
    "/api/admin/operators/<int:operator_id>",
    methods=["DELETE"],
)
def delete_operator(operator_id):
    if not require_admin_token():
        return jsonify({
            "error": (
                "Administrator authentication required."
            ),
        }), 401

    operator = db.session.get(
        User,
        operator_id,
    )

    if not operator:
        return jsonify({
            "error": "Operator not found.",
        }), 404

    if str(operator.role).lower() != "operator":
        return jsonify({
            "error": (
                "The selected account is not an operator."
            ),
        }), 400

    try:
        # Reports assigned to a deleted operator become
        # available again for assignment.
        assigned_reports = (
            Report.query
            .filter_by(
                assigned_operator_id=operator.id
            )
            .all()
        )

        for report in assigned_reports:
            report.assigned_operator_id = None
            report.status = "Unassigned"
            report.assigned_at = None
            report.completed_at = None

        # Remove active tokens belonging to this operator.
        tokens_to_remove = [
            token
            for token, user_id
            in app.operator_tokens.items()
            if user_id == operator.id
        ]

        for token in tokens_to_remove:
            app.operator_tokens.pop(
                token,
                None,
            )

        db.session.delete(operator)
        db.session.commit()

        return jsonify({
            "message": (
                "Operator deleted successfully."
            ),
        }), 200

    except Exception as e:
        db.session.rollback()

        print(
            "Delete operator error:",
            str(e),
        )

        return jsonify({
            "error": "Unable to delete operator.",
        }), 500


# ============================================================
# ADMIN - ASSIGN REPORT TO OPERATOR
# ============================================================


@app.route(
    "/api/admin/reports/<int:report_id>/assign",
    methods=["POST", "PUT"],
)
def assign_report_to_operator(report_id):
    if not require_admin_token():
        return jsonify({
            "error": (
                "Administrator authentication required."
            ),
        }), 401

    report = db.session.get(
        Report,
        report_id,
    )

    if not report:
        return jsonify({
            "error": "Report not found.",
        }), 404

    data = request.get_json(
        silent=True
    ) or {}

    operator_id = data.get(
        "operator_id"
    )

    if operator_id in (None, ""):
        return jsonify({
            "error": "Operator ID is required.",
        }), 400

    try:
        operator_id = int(operator_id)
    except (TypeError, ValueError):
        return jsonify({
            "error": (
                "Operator ID must be a valid number."
            ),
        }), 400

    operator = db.session.get(
        User,
        operator_id,
    )

    if not operator:
        return jsonify({
            "error": "Operator not found.",
        }), 404

    if str(operator.role).lower() != "operator":
        return jsonify({
            "error": (
                "The selected account is not an operator."
            ),
        }), 400

    try:
        report.assigned_operator_id = operator.id
        report.status = "Assigned"
        report.assigned_at = datetime.now(
            INDIA_TIMEZONE
        )
        report.completed_at = None

        db.session.commit()

        return jsonify({
            "message": (
                "Report assigned successfully."
            ),
            "report_id": report.id,
            "assigned_operator_id": operator.id,
            "operator_username": operator.email,
            "status": report.status,
            "assigned_at": serialize_created_at(
                report.assigned_at
            ),
        }), 200

    except Exception as e:
        db.session.rollback()

        print(
            "Assign report error:",
            str(e),
        )

        return jsonify({
            "error": "Unable to assign report.",
        }), 500


# ============================================================
# ADMIN - UNASSIGN REPORT
# ============================================================


@app.route(
    "/api/admin/reports/<int:report_id>/unassign",
    methods=["POST", "PUT"],
)
def unassign_report(report_id):
    if not require_admin_token():
        return jsonify({
            "error": (
                "Administrator authentication required."
            ),
        }), 401

    report = db.session.get(
        Report,
        report_id,
    )

    if not report:
        return jsonify({
            "error": "Report not found.",
        }), 404

    try:
        report.assigned_operator_id = None
        report.status = "Unassigned"
        report.assigned_at = None
        report.completed_at = None

        db.session.commit()

        return jsonify({
            "message": (
                "Report unassigned successfully."
            ),
            "report_id": report.id,
            "status": report.status,
        }), 200

    except Exception as e:
        db.session.rollback()

        print(
            "Unassign report error:",
            str(e),
        )

        return jsonify({
            "error": "Unable to unassign report.",
        }), 500


# ============================================================
# OPERATOR - GET ASSIGNED REPORTS
# ============================================================


@app.route(
    "/api/operator/reports",
    methods=["GET"],
)
def get_operator_reports():
    if not require_operator_token():
        return jsonify({
            "error": (
                "Operator authentication required."
            ),
        }), 401

    operator_id = get_current_operator_id()

    if not operator_id:
        return jsonify({
            "error": "Invalid operator session.",
        }), 401

    try:
        reports = (
            Report.query
            .filter_by(
                assigned_operator_id=operator_id
            )
            .order_by(
                Report.id.desc()
            )
            .all()
        )

        return jsonify([
            serialize_report(report)
            for report in reports
        ]), 200

    except Exception as e:
        print(
            "Operator reports error:",
            str(e),
        )

        return jsonify({
            "error": (
                "Unable to load assigned reports."
            ),
        }), 500


# ============================================================
# OPERATOR - VERIFY REPAIR WITH BEFORE/AFTER IMAGES
# ============================================================


@app.route(
    "/api/operator/reports/<int:report_id>/verify-repair",
    methods=["POST"],
)
def verify_operator_repair(report_id):
    if not require_operator_token():
        return jsonify({
            "error": "Operator authentication required.",
        }), 401

    operator_id = get_current_operator_id()

    if not operator_id:
        return jsonify({
            "error": "Invalid operator session.",
        }), 401

    report = db.session.get(
        Report,
        report_id,
    )

    if not report:
        return jsonify({
            "error": "Report not found.",
        }), 404

    if report.assigned_operator_id != operator_id:
        return jsonify({
            "error": "This report is not assigned to you.",
        }), 403

    # ========================================================
    # AFTER-REPAIR IMAGE UPLOAD
    # ========================================================

    after_image = request.files.get(
        "after_image"
    )

    if not after_image or not after_image.filename:
        return jsonify({
            "error": "After-repair image is required.",
        }), 400

    extension = os.path.splitext(
        after_image.filename
    )[1].lower()

    allowed_extensions = {
        ".jpg",
        ".jpeg",
        ".png",
        ".webp",
    }

    if extension not in allowed_extensions:
        return jsonify({
            "error": (
                "Only JPG, JPEG, PNG and WEBP "
                "images are supported."
            ),
        }), 400

    # Make sure the verification upload directory exists.
    os.makedirs(
        VERIFICATION_UPLOAD_FOLDER,
        exist_ok=True,
    )

    filename = (
        str(uuid.uuid4())
        + extension
    )

    after_filepath = os.path.join(
        VERIFICATION_UPLOAD_FOLDER,
        filename,
    )

    try:
        # ----------------------------------------------------
        # STEP 1: SAVE AFTER-REPAIR IMAGE FIRST
        # ----------------------------------------------------
        after_image.save(
            after_filepath
        )

        if not os.path.isfile(
            after_filepath
        ):
            raise RuntimeError(
                "After-repair image could not be saved."
            )

        # Save the image path immediately so the uploaded
        # image is not lost if Gemini verification fails.
        report.after_work_image_path = (
            f"/verification_uploads/{filename}"
        )

        db.session.commit()

        # ----------------------------------------------------
        # STEP 2: FIND ORIGINAL BEFORE IMAGE
        # ----------------------------------------------------
        original_filename = os.path.basename(
            report.image_path or ""
        )

        original_filepath = os.path.join(
            UPLOAD_FOLDER,
            original_filename,
        )

        if (
            not original_filename
            or not os.path.isfile(
                original_filepath
            )
        ):
            return jsonify({
                "message": (
                    "After-repair image uploaded successfully."
                ),
                "warning": (
                    "Original before-repair image "
                    "was not found, so verification "
                    "could not be completed."
                ),
                "report": serialize_report(report),
            }), 200

        # ----------------------------------------------------
        # STEP 3: VERIFY BEFORE + AFTER WITH GEMINI
        # ----------------------------------------------------
        verification_text = (
            verify_repair_with_gemini(
                original_filepath,
                after_filepath,
            )
        )

        parsed = parse_repair_verification(
            verification_text
        )

        report.verification_analysis = (
            verification_text
        )

        report.verification_status = (
            parsed["status"]
        )

        report.verification_confidence = (
            parsed["confidence"]
        )

        report.verified_at = datetime.now(
            INDIA_TIMEZONE
        )

        db.session.commit()

        return jsonify({
            "message": (
                "After-repair image uploaded "
                "and repair verification completed."
            ),
            "report": serialize_report(report),
            "verification": parsed,
        }), 200

    except Exception as e:
        # IMPORTANT:
        # Do NOT delete the after-repair image here.
        # The image has already been successfully uploaded
        # and its path has been stored in the database.
        db.session.rollback()

        # Restore the image path after rollback and keep it.
        try:
            report = db.session.get(
                Report,
                report_id,
            )

            if report:
                report.after_work_image_path = (
                    f"/verification_uploads/{filename}"
                )

                db.session.commit()
        except Exception as save_error:
            db.session.rollback()

            print(
                "Could not preserve after-repair "
                f"image path: {save_error}"
            )

        print(
            "Repair verification error:",
            str(e),
        )

        # The upload itself succeeded, so return the
        # uploaded image even if Gemini verification failed.
        current_report = db.session.get(
            Report,
            report_id,
        )

        return jsonify({
            "message": (
                "After-repair image uploaded successfully, "
                "but AI verification could not be completed."
            ),
            "warning": str(e),
            "report": (
                serialize_report(current_report)
                if current_report
                else {
                    "id": report_id,
                    "after_work_image_path": (
                        f"/verification_uploads/{filename}"
                    ),
                }
            ),
        }), 200


# ============================================================
# OPERATOR - UPDATE REPORT STATUS
# ============================================================


@app.route(
    "/api/operator/reports/<int:report_id>/status",
    methods=["PUT", "PATCH"],
)
def update_operator_report_status(report_id):
    if not require_operator_token():
        return jsonify({
            "error": (
                "Operator authentication required."
            ),
        }), 401

    operator_id = get_current_operator_id()

    if not operator_id:
        return jsonify({
            "error": "Invalid operator session.",
        }), 401

    report = db.session.get(
        Report,
        report_id,
    )

    if not report:
        return jsonify({
            "error": "Report not found.",
        }), 404

    if report.assigned_operator_id != operator_id:
        return jsonify({
            "error": (
                "This report is not assigned to you."
            ),
        }), 403

    data = request.get_json(
        silent=True
    ) or {}

    new_status = str(
        data.get("status", "")
    ).strip()

    allowed_statuses = {
        "In Progress",
        "Completed",
    }

    if new_status not in allowed_statuses:
        return jsonify({
            "error": (
                "Status must be In Progress or Completed."
            ),
        }), 400

    now = datetime.now(
        INDIA_TIMEZONE
    )

    try:
        report.status = new_status

        if new_status == "In Progress":
            report.completed_at = None

        elif new_status == "Completed":
            report.completed_at = now

        db.session.commit()

        return jsonify({
            "message": (
                "Report status updated successfully."
            ),
            "report_id": report.id,
            "status": report.status,
            "assigned_operator_id": (
                report.assigned_operator_id
            ),
            "assigned_at": serialize_created_at(
                report.assigned_at
            ),
            "completed_at": serialize_created_at(
                report.completed_at
            ),
        }), 200

    except Exception as e:
        db.session.rollback()

        print(
            "Operator status update error:",
            str(e),
        )

        return jsonify({
            "error": (
                "Unable to update report status."
            ),
        }), 500


# ============================================================
# REPORT UPLOAD
# ============================================================


@app.route(
    "/api/report/upload",
    methods=["POST"],
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

    if not user_id:
        return jsonify({
            "error": "User ID is required.",
        }), 400

    if not location:
        return jsonify({
            "error": "Location is required.",
        }), 400

    if not image:
        return jsonify({
            "error": "Road image is required.",
        }), 400

    try:
        user = db.session.get(
            User,
            int(user_id),
        )
    except Exception:
        user = None

    if not user:
        return jsonify({
            "error": "Invalid user.",
        }), 401

    # A report must be created by a normal user.
    if str(user.role).lower() != "user":
        return jsonify({
            "error": (
                "Only regular users can create road reports."
            ),
        }), 403

    original_name = image.filename

    if not original_name:
        return jsonify({
            "error": "Invalid image filename.",
        }), 400

    extension = os.path.splitext(
        original_name
    )[1].lower()

    allowed_extensions = {
        ".jpg",
        ".jpeg",
        ".png",
        ".webp",
    }

    if extension not in allowed_extensions:
        return jsonify({
            "error": (
                "Only JPG, JPEG, PNG and WEBP "
                "images are supported."
            ),
        }), 400

    filename = (
        str(uuid.uuid4())
        + extension
    )

    filepath = os.path.join(
        UPLOAD_FOLDER,
        filename,
    )

    try:
        image.save(filepath)
    except Exception as e:
        print(
            "Image save error:",
            str(e),
        )

        return jsonify({
            "error": "Unable to save image.",
        }), 500

    image_path = (
        f"/uploads/{filename}"
    )

    # ========================================================
    # USER IMAGE VALIDATION ONLY
    # ========================================================
    # This runs before Report(...) is created. It is deliberately
    # separate from the operator after-repair verification flow.
    validation_result = validate_road_damage_image(filepath)

    if validation_result is False:
        try:
            if os.path.exists(filepath):
                os.remove(filepath)
        except Exception as cleanup_error:
            print(
                "Invalid-image cleanup warning:",
                str(cleanup_error),
            )

        return jsonify({
            "valid": False,
            "error": "Please upload road damaged images only.",
        }), 400

    if validation_result is None:
        try:
            if os.path.exists(filepath):
                os.remove(filepath)
        except Exception as cleanup_error:
            print(
                "Validation-failure cleanup warning:",
                str(cleanup_error),
            )

        return jsonify({
            "valid": False,
            "error": (
                "Unable to validate the image right now. "
                "Please try again."
            ),
        }), 503

    upload_time = datetime.now(
        INDIA_TIMEZONE
    )

    report = Report(
        user_id=int(user_id),
        location=location,
        image_path=image_path,
        analysis="Pending analysis",
        status="Unassigned",
        assigned_operator_id=None,
        assigned_at=None,
        completed_at=None,
        created_at=upload_time,
    )

    try:
        db.session.add(report)
        db.session.commit()

    except Exception as e:
        db.session.rollback()

        print(
            "Report database error:",
            str(e),
        )

        return jsonify({
            "error": "Unable to save report.",
        }), 500

    # ========================================================
    # RUN GEMINI
    # ========================================================

    try:
        report.analysis = analyze_image_with_gemini(
            filepath
        )

        update_report_from_analysis(
            report
        )

        db.session.commit()

    except Exception as e:
        db.session.rollback()

        print(
            "Upload-time Gemini analysis error:",
            str(e),
        )

        # The report remains in the database even if AI fails.
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
                str(save_error),
            )

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
        "assigned_operator_id": (
            report.assigned_operator_id
        ),
        "status": report.status or "Unassigned",
        "assigned_at": serialize_created_at(
            report.assigned_at
        ),
        "completed_at": serialize_created_at(
            report.completed_at
        ),
        "created_at": serialize_created_at(
            report.created_at
        ),
    }), 201


# ============================================================
# USER - GET REPORTS
# ============================================================


@app.route(
    "/api/user/reports/<int:user_id>",
    methods=["GET"],
)
def get_user_reports(user_id):
    user = db.session.get(
        User,
        user_id,
    )

    if not user:
        return jsonify({
            "error": "User not found.",
        }), 404

    reports = (
        Report.query
        .filter_by(
            user_id=user_id
        )
        .order_by(
            Report.id.desc()
        )
        .all()
    )

    return jsonify([
        serialize_report(report)
        for report in reports
    ]), 200


# ============================================================
# USER - DELETE REPORT
# ============================================================


@app.route(
    "/api/user/reports/<int:user_id>/<int:report_id>",
    methods=["DELETE"],
)
def delete_user_report(
    user_id,
    report_id,
):
    report = db.session.get(
        Report,
        report_id,
    )

    if not report:
        return jsonify({
            "error": "Report not found.",
        }), 404

    if report.user_id != user_id:
        return jsonify({
            "error": (
                "You are not authorized to delete this report."
            ),
        }), 403

    try:
        if report.image_path:
            filename = os.path.basename(
                report.image_path
            )

            filepath = os.path.join(
                UPLOAD_FOLDER,
                filename,
            )

            if os.path.isfile(filepath):
                os.remove(filepath)

        db.session.delete(report)
        db.session.commit()

        return jsonify({
            "message": (
                "Report deleted successfully."
            ),
        }), 200

    except Exception as e:
        db.session.rollback()

        print(
            "User report delete error:",
            str(e),
        )

        return jsonify({
            "error": (
                "Unable to delete report."
            ),
        }), 500


# ============================================================
# ADMIN - GET ALL REPORTS
# ============================================================


@app.route(
    "/api/admin/reports",
    methods=["GET"],
)
def get_all_reports():
    if not require_admin_token():
        return jsonify({
            "error": (
                "Administrator authentication required."
            ),
        }), 401

    try:
        reports = (
            Report.query
            .order_by(Report.id.desc())
            .all()
        )

        result = []

        for report in reports:
            # IMPORTANT:
            # Loading Reports Management must not call Gemini.
            # AI analysis happens during upload or explicit retry.
            # This keeps the dashboard fast and avoids Gemini outages
            # causing "Failed to fetch".
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
                        str(e),
                    )

            result.append(
                serialize_report(report)
            )

        return jsonify(result), 200

    except Exception as e:
        db.session.rollback()
        print("Admin reports error:", str(e))

        return jsonify({
            "error": "Unable to load reports.",
        }), 500




# ============================================================
# ADMIN - DELETE ONE REPORT
# ============================================================


@app.route(
    "/api/admin/reports/<int:report_id>",
    methods=["DELETE"],
)
def delete_admin_report(report_id):
    if not require_admin_token():
        return jsonify({
            "error": (
                "Administrator authentication required."
            ),
        }), 401

    report = db.session.get(
        Report,
        report_id,
    )

    if not report:
        return jsonify({
            "error": "Report not found.",
        }), 404

    try:
        if report.image_path:
            filename = os.path.basename(
                report.image_path
            )

            filepath = os.path.join(
                UPLOAD_FOLDER,
                filename,
            )

            if os.path.isfile(filepath):
                os.remove(filepath)

        db.session.delete(report)
        db.session.commit()

        return jsonify({
            "message": (
                "Report deleted successfully."
            ),
        }), 200

    except Exception as e:
        db.session.rollback()

        print(
            "Admin report delete error:",
            str(e),
        )

        return jsonify({
            "error": (
                "Unable to delete report."
            ),
        }), 500


# ============================================================
# ADMIN - DELETE ALL REPORTS
# ============================================================


@app.route(
    "/api/admin/reports",
    methods=["DELETE"],
)
def delete_all_admin_reports():
    if not require_admin_token():
        return jsonify({
            "error": (
                "Administrator authentication required."
            ),
        }), 401

    reports = Report.query.all()

    try:
        for report in reports:
            if report.image_path:
                filename = os.path.basename(
                    report.image_path
                )

                filepath = os.path.join(
                    UPLOAD_FOLDER,
                    filename,
                )

                if os.path.isfile(filepath):
                    os.remove(filepath)

            db.session.delete(report)

        db.session.commit()

        return jsonify({
            "message": (
                "All reports deleted successfully."
            ),
            "deleted_count": len(reports),
        }), 200

    except Exception as e:
        db.session.rollback()

        print(
            "Admin delete-all error:",
            str(e),
        )

        return jsonify({
            "error": (
                "Unable to delete all reports."
            ),
        }), 500


# ============================================================
# HEALTH CHECK
# ============================================================


@app.route(
    "/",
    methods=["GET"],
)
def home():
    return jsonify({
        "message": (
            "RoadGuard AI backend is running."
        ),
        "status": "online",
    }), 200


# ============================================================
# SERVER START
# ============================================================

if __name__ == "__main__":
    app.run(
        host="127.0.0.1",
        port=5000,
        debug=True,
    )
