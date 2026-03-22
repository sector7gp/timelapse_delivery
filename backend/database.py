import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.environ.get("DATABASE_URL", "mysql+pymysql://root:password@localhost:3306/video_portal")
DB_SSL_DISABLED = os.environ.get("DB_SSL_DISABLED", "0") == "1"

# SQLAlchemy engine setup
connect_args = {}

if DATABASE_URL.startswith("sqlite"):
    connect_args["check_same_thread"] = False
elif DB_SSL_DISABLED:
    # Disable SSL for MySQL/MariaDB (equivalent to --ssl=0)
    connect_args["ssl_disabled"] = True

engine = create_engine(DATABASE_URL, connect_args=connect_args)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
