from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timezone, timedelta


db = SQLAlchemy()


# ============================================================
# INDIA STANDARD TIME
# ============================================================

INDIA_TIMEZONE = timezone(
    timedelta(hours=5, minutes=30)
)


# ============================================================
# REPORT MODEL
# ============================================================

class Report(db.Model):

    __tablename__ = "report"

    # --------------------------------------------------------
    # Report ID
    # --------------------------------------------------------

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    # --------------------------------------------------------
    # User who submitted the report
    # --------------------------------------------------------

    user_id = db.Column(
        db.Integer,
        nullable=False
    )

    # --------------------------------------------------------
    # Road location
    # --------------------------------------------------------

    location = db.Column(
        db.String(255),
        nullable=False
    )

    # --------------------------------------------------------
    # Uploaded road image
    # --------------------------------------------------------

    image_path = db.Column(
        db.String(255),
        nullable=False
    )

    # --------------------------------------------------------
    # Complete Gemini response
    # --------------------------------------------------------

    analysis = db.Column(
        db.Text,
        nullable=False
    )

    # --------------------------------------------------------
    # Structured AI results
    # --------------------------------------------------------

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

    # --------------------------------------------------------
    # Numerical maintenance priority score
    # --------------------------------------------------------

    priority_score = db.Column(
        db.Integer,
        nullable=True
    )

    # --------------------------------------------------------
    # Report creation date and time
    # Stored in IST
    # --------------------------------------------------------

    created_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(INDIA_TIMEZONE),
        nullable=True
    )