import os
import bcrypt
from datetime import datetime, timezone, timedelta
from functools import wraps
from cryptography.fernet import Fernet
from dotenv import load_dotenv
from flask import (
    Flask, render_template, request, redirect, url_for,
    flash, jsonify, session
)
from flask_login import (
    LoginManager, login_user, logout_user,
    login_required, current_user
)
from sqlalchemy import func
from models import db, User, Client, Password, AccessLog

load_dotenv()

app = Flask(__name__)
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", os.urandom(32))
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///passwords.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db.init_app(app)

login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = "login"
login_manager.login_message = "Por favor, faça login para acessar esta página."
login_manager.login_message_category = "warning"

# Encryption key — stored in .env or generated once and saved
FERNET_KEY = os.environ.get("FERNET_KEY")
if not FERNET_KEY:
    key = Fernet.generate_key()
    FERNET_KEY = key.decode()
    with open(".env", "a") as f:
        f.write(f"\nFERNET_KEY={FERNET_KEY}\n")

fernet = Fernet(FERNET_KEY.encode())


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def encrypt_password(plain: str) -> str:
    return fernet.encrypt(plain.encode()).decode()


def decrypt_password(token: str) -> str:
    return fernet.decrypt(token.encode()).decode()


def log_action(action: str, client_id=None, password_id=None):
    entry = AccessLog(
        user_id=current_user.id,
        client_id=client_id,
        password_id=password_id,
        action=action,
        ip_address=request.remote_addr,
    )
    db.session.add(entry)
    db.session.commit()


def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not current_user.is_authenticated or current_user.role != "admin":
            flash("Acesso restrito a administradores.", "danger")
            return redirect(url_for("dashboard"))
        return f(*args, **kwargs)
    return decorated


@login_manager.user_loader
def load_user(user_id):
    return db.session.get(User, int(user_id))


# ---------------------------------------------------------------------------
# Auth routes
# ---------------------------------------------------------------------------

@app.route("/", methods=["GET", "POST"])
def login():
    if current_user.is_authenticated:
        return redirect(url_for("dashboard"))

    if request.method == "POST":
        username = request.form.get("username", "").strip()
        password = request.form.get("password", "")

        user = User.query.filter_by(username=username, active=True).first()
        if user and bcrypt.checkpw(password.encode(), user.password_hash.encode()):
            login_user(user, remember=False)
            entry = AccessLog(
                user_id=user.id,
                action="login",
                ip_address=request.remote_addr,
            )
            db.session.add(entry)
            db.session.commit()
            return redirect(url_for("dashboard"))
        else:
            flash("Usuário ou senha inválidos.", "danger")

    return render_template("login.html")


@app.route("/logout")
@login_required
def logout():
    log_action("logout")
    logout_user()
    flash("Você saiu do sistema.", "info")
    return redirect(url_for("login"))


# ---------------------------------------------------------------------------
# Main routes
# ---------------------------------------------------------------------------

@app.route("/dashboard")
@login_required
def dashboard():
    clients = Client.query.filter_by(active=True).order_by(Client.name).all()

    # Stats
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    stats = {}

    if current_user.role == "admin":
        stats["total_clients"]  = Client.query.filter_by(active=True).count()
        stats["total_passwords"] = Password.query.count()
        stats["total_users"]    = User.query.filter_by(active=True).count()
        stats["accesses_today"] = AccessLog.query.filter(
            AccessLog.timestamp >= today_start,
            AccessLog.action.in_(["copy_login", "copy_password", "view_client"])
        ).count()
    else:
        stats["total_clients"]   = len(clients)
        stats["total_passwords"] = db.session.query(func.count(Password.id)).scalar()
        stats["my_accesses_today"] = AccessLog.query.filter(
            AccessLog.user_id == current_user.id,
            AccessLog.timestamp >= today_start,
        ).count()

    # Recent logs (admin: all; team: own)
    log_query = (
        AccessLog.query
        .order_by(AccessLog.timestamp.desc())
        .limit(10)
    )
    if current_user.role != "admin":
        log_query = (
            AccessLog.query
            .filter_by(user_id=current_user.id)
            .order_by(AccessLog.timestamp.desc())
            .limit(10)
        )
    recent_logs = log_query.all()

    # Top accessed clients (last 30 days)
    since = datetime.now(timezone.utc) - timedelta(days=30)
    top_clients = (
        db.session.query(Client, func.count(AccessLog.id).label("cnt"))
        .join(AccessLog, AccessLog.client_id == Client.id)
        .filter(AccessLog.timestamp >= since, Client.active == True)
        .group_by(Client.id)
        .order_by(func.count(AccessLog.id).desc())
        .limit(5)
        .all()
    )

    return render_template(
        "dashboard.html",
        clients=clients,
        stats=stats,
        recent_logs=recent_logs,
        top_clients=top_clients,
        now=datetime.now(timezone.utc),
    )


@app.route("/client/<int:client_id>")
@login_required
def client_detail(client_id):
    client = Client.query.filter_by(id=client_id, active=True).first_or_404()
    passwords = Password.query.filter_by(client_id=client_id).order_by(Password.service_name).all()
    log_action("view_client", client_id=client_id)
    return render_template("client.html", client=client, passwords=passwords)


@app.route("/api/reveal/<int:password_id>", methods=["POST"])
@login_required
def reveal_password(password_id):
    """Returns decrypted credentials for copy. Logged."""
    entry = Password.query.get_or_404(password_id)
    field = request.json.get("field")  # "login" or "password"

    if field == "login":
        log_action("copy_login", client_id=entry.client_id, password_id=password_id)
        return jsonify({"value": entry.login})
    elif field == "password":
        log_action("copy_password", client_id=entry.client_id, password_id=password_id)
        plain = decrypt_password(entry.encrypted_password)
        return jsonify({"value": plain})
    return jsonify({"error": "Campo inválido"}), 400


# ---------------------------------------------------------------------------
# Admin — Clients management
# ---------------------------------------------------------------------------

@app.route("/admin/clients")
@login_required
@admin_required
def admin_clients():
    clients = Client.query.order_by(Client.name).all()
    return render_template("admin/clients.html", clients=clients)


@app.route("/admin/clients/new", methods=["GET", "POST"])
@login_required
@admin_required
def admin_client_new():
    if request.method == "POST":
        name = request.form.get("name", "").strip()
        description = request.form.get("description", "").strip()
        if not name:
            flash("Nome do cliente é obrigatório.", "danger")
        else:
            client = Client(name=name, description=description, created_by=current_user.id)
            db.session.add(client)
            db.session.commit()
            flash(f"Cliente '{name}' criado com sucesso.", "success")
            return redirect(url_for("admin_clients"))
    return render_template("admin/client_form.html", client=None)


@app.route("/admin/clients/<int:client_id>/edit", methods=["GET", "POST"])
@login_required
@admin_required
def admin_client_edit(client_id):
    client = Client.query.get_or_404(client_id)
    if request.method == "POST":
        client.name = request.form.get("name", "").strip()
        client.description = request.form.get("description", "").strip()
        client.active = "active" in request.form
        db.session.commit()
        flash("Cliente atualizado.", "success")
        return redirect(url_for("admin_clients"))
    return render_template("admin/client_form.html", client=client)


# ---------------------------------------------------------------------------
# Admin — Passwords management
# ---------------------------------------------------------------------------

@app.route("/admin/clients/<int:client_id>/passwords")
@login_required
@admin_required
def admin_passwords(client_id):
    client = Client.query.get_or_404(client_id)
    passwords = Password.query.filter_by(client_id=client_id).order_by(Password.service_name).all()
    return render_template("admin/passwords.html", client=client, passwords=passwords)


@app.route("/admin/clients/<int:client_id>/passwords/new", methods=["GET", "POST"])
@login_required
@admin_required
def admin_password_new(client_id):
    client = Client.query.get_or_404(client_id)
    if request.method == "POST":
        service_name = request.form.get("service_name", "").strip()
        login_val = request.form.get("login", "").strip()
        plain_pw = request.form.get("password", "")
        description = request.form.get("description", "").strip()
        notes = request.form.get("notes", "").strip()

        if not service_name or not plain_pw:
            flash("Serviço e senha são obrigatórios.", "danger")
        else:
            pw = Password(
                client_id=client_id,
                service_name=service_name,
                description=description,
                login=login_val,
                encrypted_password=encrypt_password(plain_pw),
                notes=notes,
                created_by=current_user.id,
            )
            db.session.add(pw)
            db.session.commit()
            flash(f"Senha '{service_name}' adicionada.", "success")
            return redirect(url_for("admin_passwords", client_id=client_id))
    return render_template("admin/password_form.html", client=client, entry=None)


@app.route("/admin/passwords/<int:password_id>/edit", methods=["GET", "POST"])
@login_required
@admin_required
def admin_password_edit(password_id):
    entry = Password.query.get_or_404(password_id)
    if request.method == "POST":
        entry.service_name = request.form.get("service_name", "").strip()
        entry.login = request.form.get("login", "").strip()
        entry.description = request.form.get("description", "").strip()
        entry.notes = request.form.get("notes", "").strip()
        new_pw = request.form.get("password", "")
        if new_pw:
            entry.encrypted_password = encrypt_password(new_pw)
        db.session.commit()
        flash("Credencial atualizada.", "success")
        return redirect(url_for("admin_passwords", client_id=entry.client_id))
    return render_template("admin/password_form.html", client=entry.client, entry=entry)


@app.route("/admin/passwords/<int:password_id>/delete", methods=["POST"])
@login_required
@admin_required
def admin_password_delete(password_id):
    entry = Password.query.get_or_404(password_id)
    client_id = entry.client_id
    db.session.delete(entry)
    db.session.commit()
    flash("Credencial removida.", "success")
    return redirect(url_for("admin_passwords", client_id=client_id))


# ---------------------------------------------------------------------------
# Admin — Users management
# ---------------------------------------------------------------------------

@app.route("/admin/users")
@login_required
@admin_required
def admin_users():
    users = User.query.order_by(User.username).all()
    return render_template("admin/users.html", users=users)


@app.route("/admin/users/new", methods=["GET", "POST"])
@login_required
@admin_required
def admin_user_new():
    if request.method == "POST":
        username = request.form.get("username", "").strip()
        password = request.form.get("password", "")
        role = request.form.get("role", "team")

        if not username or not password:
            flash("Usuário e senha são obrigatórios.", "danger")
        elif User.query.filter_by(username=username).first():
            flash("Usuário já existe.", "danger")
        else:
            hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
            user = User(username=username, password_hash=hashed, role=role)
            db.session.add(user)
            db.session.commit()
            flash(f"Usuário '{username}' criado.", "success")
            return redirect(url_for("admin_users"))
    return render_template("admin/user_form.html", user=None)


@app.route("/admin/users/<int:user_id>/edit", methods=["GET", "POST"])
@login_required
@admin_required
def admin_user_edit(user_id):
    user = User.query.get_or_404(user_id)
    if request.method == "POST":
        user.username = request.form.get("username", "").strip()
        user.role = request.form.get("role", "team")
        user.active = "active" in request.form
        new_pw = request.form.get("password", "")
        if new_pw:
            user.password_hash = bcrypt.hashpw(new_pw.encode(), bcrypt.gensalt()).decode()
        db.session.commit()
        flash("Usuário atualizado.", "success")
        return redirect(url_for("admin_users"))
    return render_template("admin/user_form.html", user=user)


# ---------------------------------------------------------------------------
# Admin — Logs
# ---------------------------------------------------------------------------

@app.route("/admin/logs")
@login_required
@admin_required
def admin_logs():
    page = request.args.get("page", 1, type=int)
    user_filter = request.args.get("user", "")
    action_filter = request.args.get("action", "")
    client_filter = request.args.get("client", "")

    query = AccessLog.query.join(User, AccessLog.user_id == User.id)

    if user_filter:
        query = query.filter(User.username.ilike(f"%{user_filter}%"))
    if action_filter:
        query = query.filter(AccessLog.action == action_filter)
    if client_filter:
        query = query.join(Client, AccessLog.client_id == Client.id).filter(
            Client.name.ilike(f"%{client_filter}%")
        )

    logs = query.order_by(AccessLog.timestamp.desc()).paginate(page=page, per_page=50)
    users = User.query.order_by(User.username).all()
    clients = Client.query.order_by(Client.name).all()
    actions = db.session.query(AccessLog.action).distinct().all()
    actions = [a[0] for a in actions]

    return render_template(
        "admin/logs.html",
        logs=logs,
        users=users,
        clients=clients,
        actions=actions,
        user_filter=user_filter,
        action_filter=action_filter,
        client_filter=client_filter,
    )


# ---------------------------------------------------------------------------
# Bootstrap DB + default admin
# ---------------------------------------------------------------------------

def init_db():
    db.create_all()
    if not User.query.filter_by(username="admin").first():
        hashed = bcrypt.hashpw(b"admin123", bcrypt.gensalt()).decode()
        admin = User(username="admin", password_hash=hashed, role="admin")
        db.session.add(admin)
        db.session.commit()
        print("Usuário padrão criado: admin / admin123")


if __name__ == "__main__":
    with app.app_context():
        init_db()
    app.run(debug=True, port=5000)
