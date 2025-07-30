from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional
from mongo_test import Authentication

router = APIRouter()

class RegisterRequest(BaseModel):
    email: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None

    class Config:
        extra = "forbid"

class LoginRequest(BaseModel):
    email: str
    password: str

@router.post("/register")
def register(req: RegisterRequest):
    try:
        token = Authentication.register(req.email, req.username, req.password)
        return {"access_token": token}
    except ValueError as e:
        return JSONResponse(status_code=400, content={"error": str(e)})

@router.post("/login")
def login(req: LoginRequest):
    try:
        token = Authentication.login(req.email, req.password)
        return {"access_token": token}
    except ValueError as e:
        return JSONResponse(status_code=400, content={"error": str(e)})