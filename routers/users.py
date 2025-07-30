from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from fastapi.responses import HTMLResponse, JSONResponse
from jose import jwt, JWTError
from pydantic import BaseModel
from typing import Optional
from mongo_test import Rooms, Users, Admin

router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")

class UpdateUserRequest(BaseModel):
    email: Optional[str] = None
    old_password: Optional[str] = None
    new_password: Optional[str] = None
    pfp: Optional[str] = None

    class Config:
        extra = "forbid"

def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid token!",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, Admin.get_config().get("secret_key"), algorithms=["HS256"])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
        return user_id
    except JWTError:
        raise credentials_exception

@router.get("")
def get_user(current_user: str = Depends(get_current_user)):
    try:
        user = Users.get_user(current_user)
        return {"message": "User retrieved successfully", "user": user}
    except ValueError as e:
        return JSONResponse(status_code=400, content={"error": str(e)})
    
@router.put("/")
def put_user(
    req: UpdateUserRequest,
    current_user: str = Depends(get_current_user)
):
    try:
        Users.update_user(current_user, req.email, req.old_password, req.new_password, req.pfp)
        return {"message": "User updated successfully"}
    except ValueError as e:
        return JSONResponse(status_code=400, content={"error": str(e)})