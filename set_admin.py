import os
import sys
from sqlalchemy.orm import Session
from backend.database import SessionLocal
from backend.models import User

def set_admin(email):
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        if not user:
            print(f"Error: User with email '{email}' not found.")
            return
        
        user.is_admin = True
        user.is_active = True
        db.commit()
        print(f"Success: User '{email}' is now an administrator.")
    finally:
        db.close()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 set_admin.py <email>")
    else:
        set_admin(sys.argv[1])
