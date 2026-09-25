from datetime import datetime, timezone, timedelta

from flask_sqlalchemy import SQLAlchemy


db = SQLAlchemy()


# ============================================================
# INDIA STANDARD TIME
# ============================================================

INDIA_TIMEZONE = timezone(
    timedelta(hours=5, minutes=30)
)


# ============================================================
# USER MODEL
# ============================================================

class User(db.Model):

    __tablename__ = "users"

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    email = db.Column(
        db.String(255),
        unique=True,
        nullable=False
    )

    password = db.Column(
        db.String(255),
        nullable=False
    )

    # Supported roles:
    # user, operator, admin
    role = db.Column(
        db.String(50),
        default="user",
        nullable=False
    )


# ============================================================
# REPORT MODEL
# ============================================================

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

    # Complete Gemini response
    analysis = db.Column(
        db.Text,
        nullable=False
    )

    # Structured AI results
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

    # Numerical maintenance priority score
    priority_score = db.Column(
        db.Integer,
        nullable=True
    )

    # Upload date and time in IST
    created_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(INDIA_TIMEZONE),
        nullable=True
    )
