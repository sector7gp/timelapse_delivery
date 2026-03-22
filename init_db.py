import os
from sqlalchemy.orm import Session
from backend.database import engine, Base, SessionLocal
from backend.models import User, Project
from backend.crud import get_password_hash

def init_db():
    print("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    print("Tables created successfully.")
    
    db = SessionLocal()
    try:
        # Check if admin user exists
        admin = db.query(User).filter(User.email == "admin@example.com").first()
        if not admin:
            print("Creating default admin user...")
            hashed_pw = get_password_hash("admin123")
            admin = User(email="admin@example.com", hashed_password=hashed_pw, is_active=True)
            db.add(admin)
            db.commit()
            db.refresh(admin)
            print(f"Admin user created: admin@example.com / admin123")

            # Create a sample project
            print("Creating sample project...")
            project = Project(name="Sample Project", directory_name="sample", user_id=admin.id)
            db.add(project)
            db.commit()
            print("Sample project created. Please ensure /tmp/videos/sample exists (or your BASE_VIDEO_DIR/sample).")
            
            # create dir just in case
            base_dir = os.environ.get("BASE_VIDEO_DIR", "/tmp/videos")
            sample_dir = os.path.join(base_dir, "sample")
            os.makedirs(sample_dir, exist_ok=True)
            print(f"Sample directory created at {sample_dir}")
        else:
            print("Admin user already exists.")
    finally:
        db.close()

if __name__ == "__main__":
    init_db()
