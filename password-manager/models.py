from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
from datetime import datetime, timezone

db = SQLAlchemy()


class User(UserMixin, db.Model):
    __tablename__ = "users"
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(10), nullable=False, default="team")  # "admin" or "team"
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    active = db.Column(db.Boolean, default=True)

    def __repr__(self):
        return f"<User {self.username}>"


class Client(db.Model):
    __tablename__ = "clients"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    description = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    created_by = db.Column(db.Integer, db.ForeignKey("users.id"))
    active = db.Column(db.Boolean, default=True)
    passwords = db.relationship("Password", backref="client", lazy=True, cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Client {self.name}>"


class Password(db.Model):
    __tablename__ = "passwords"
    id = db.Column(db.Integer, primary_key=True)
    client_id = db.Column(db.Integer, db.ForeignKey("clients.id"), nullable=False)
    service_name = db.Column(db.String(120), nullable=False)
    description = db.Column(db.Text)
    login = db.Column(db.String(255))
    encrypted_password = db.Column(db.Text, nullable=False)
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    created_by = db.Column(db.Integer, db.ForeignKey("users.id"))

    def __repr__(self):
        return f"<Password {self.service_name}>"


class AccessLog(db.Model):
    __tablename__ = "access_logs"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    client_id = db.Column(db.Integer, db.ForeignKey("clients.id"))
    password_id = db.Column(db.Integer, db.ForeignKey("passwords.id"))
    action = db.Column(db.String(50), nullable=False)  # "view_client", "copy_login", "copy_password", "login", "logout"
    ip_address = db.Column(db.String(45))
    timestamp = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    user = db.relationship("User", foreign_keys=[user_id])
    client = db.relationship("Client", foreign_keys=[client_id])
    password_entry = db.relationship("Password", foreign_keys=[password_id])
