"""Seed baseline data: permissions, roles, a Super Admin user, and default
notification templates. Run once after migrations: `python seed.py`
"""
from app.db.session import SessionLocal
from app.core.security import hash_password
from app.models.user import Permission, Role, User
from app.models.notification import NotificationTemplate
from app.models.enums import NotificationType
from app.services.notification_service import DEFAULT_TEMPLATES

PERMISSIONS = [
    ("manage_students", "Create/edit/deactivate students"),
    ("manage_attendance", "Record and edit attendance"),
    ("manage_marks", "Enter and edit marks"),
    ("manage_reports", "Generate and approve reports"),
    ("manage_notifications", "View/retry notifications"),
    ("manage_users", "Manage users and roles"),
    ("manage_backups", "Create/restore backups"),
    ("manage_settings", "Change academy settings"),
]

ROLES = {
    "SUPER_ADMIN": [p[0] for p in PERMISSIONS],
    "ADMIN": [
        "manage_students", "manage_attendance", "manage_marks",
        "manage_reports", "manage_notifications", "manage_settings",
    ],
    "TEACHER": ["manage_attendance", "manage_marks"],
}


def run():
    db = SessionLocal()
    try:
        perm_objs = {}
        for code, desc in PERMISSIONS:
            p = db.query(Permission).filter(Permission.code == code).first()
            if not p:
                p = Permission(code=code, description=desc)
                db.add(p)
                db.flush()
            perm_objs[code] = p

        role_objs = {}
        for name, perm_codes in ROLES.items():
            r = db.query(Role).filter(Role.name == name).first()
            if not r:
                r = Role(name=name, description=f"{name} role")
                db.add(r)
                db.flush()
            r.permissions = [perm_objs[c] for c in perm_codes]
            role_objs[name] = r
        db.commit()

        super_admin_role = role_objs["SUPER_ADMIN"]
        existing = db.query(User).filter(User.email == "admin@acadexa.com").first()
        if not existing:
            admin = User(
                full_name="Super Admin",
                email="admin@acadexa.com",
                hashed_password=hash_password("Admin@123"),
                role_id=super_admin_role.id,
                is_active=True,
            )
            db.add(admin)
            print("Created default Super Admin: admin@acadexa.com / Admin@123 (CHANGE THIS PASSWORD)")
        else:
            print("Super Admin already exists, skipping.")

        for notif_type, body in DEFAULT_TEMPLATES.items():
            existing_tpl = db.query(NotificationTemplate).filter(NotificationTemplate.type == notif_type).first()
            if not existing_tpl:
                db.add(NotificationTemplate(type=notif_type, name=notif_type.value.title(), body=body))

        db.commit()
        print("Seed completed successfully.")
    finally:
        db.close()


if __name__ == "__main__":
    run()
