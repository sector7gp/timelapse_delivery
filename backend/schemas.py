from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime

# --- Token Schemas ---
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None

# --- User Schemas ---
class UserBase(BaseModel):
    email: EmailStr

class UserCreate(UserBase):
    password: str
    is_admin: bool = False

class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    is_active: Optional[bool] = None
    is_admin: Optional[bool] = None

class User(UserBase):
    id: int
    is_active: bool
    is_admin: bool

    model_config = {"from_attributes": True}

# --- Project Schemas ---
class ProjectBase(BaseModel):
    name: str
    directory_name: str

class ProjectCreate(ProjectBase):
    pass

class Project(ProjectBase):
    id: int
    user_id: int

    model_config = {"from_attributes": True}

# --- Video Schemas ---
class Video(BaseModel):
    filename: str
    size: int
    last_modified: datetime

# --- DownloadLog Schemas ---
class DownloadLogBase(BaseModel):
    filename: str
    ip_address: Optional[str] = None

class DownloadLogCreate(DownloadLogBase):
    project_id: int

class DownloadLog(DownloadLogBase):
    id: int
    user_id: int
    project_id: int
    timestamp: datetime

    model_config = {"from_attributes": True}
