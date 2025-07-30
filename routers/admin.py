from fastapi import APIRouter, Body
from fastapi.responses import FileResponse, JSONResponse
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from pydantic import BaseModel
from typing import Optional, Union
from mongo_test import Rooms, Users, Admin

router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")

def get_current_admin(token: str = Depends(oauth2_scheme)):
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
        user = Users.get_user(user_id)
        if not user.get("is_admin", False):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to access this resource.",
            )
        return user_id
    except JWTError:
        raise credentials_exception

class ResetRequest(BaseModel):
    new_p: str
    confirm_p: str

class UpdateUserRequest(BaseModel):
    email: Optional[str] = None
    pfp: Optional[str] = None

    class Config:
        extra = "forbid"

class UpdateRoomRequest(BaseModel):
    room_name: Optional[str] = None
    room_picture: Optional[str] = None

    class Config:
        extra = "forbid"

class UpdateAI(BaseModel):
    temperature: Optional[Union[float, int]] = None
    max_tokens: Optional[int] = None

    class Config:
        extra = "forbid"

@router.get("/dashboard")
async def get_dashboard():
    return FileResponse("dist/admin.html")

@router.get("/users")
def get_users(
    pagination: int = 0,
    limit: int = 5,
    search: str = "",
    sort_by: str = "created_at",
    sort_order: str = "desc",
    current_user: str = Depends(get_current_admin)
):
    try:
        users, total = Admin.get_all_users(pagination, limit, search, sort_by, sort_order)
        return {"message": "Users retrieved successfully!", "users": users, "total": total}
        pass
    except ValueError as e:
        return JSONResponse(status_code=400, content={"error": str(e)})

@router.put("/user/{user_id}")
def update_user(
    user_id: str,
    req: UpdateUserRequest,
):
    try:
        Users.update_user(id=user_id, email=req.email, old_p=None, new_p=None, pfp=req.pfp)
        return {"message": "User updated successfully!"}
    except ValueError as e:
        return JSONResponse(status_code=400, content={"error": str(e)})

@router.delete("/user/{user_id}")
def delete_user(
    user_id: str,
    current_user: str = Depends(get_current_admin)
):
    try:
        Admin.delete_user(user_id)
        return {"message": "User deleted successfully!"}
    except ValueError as e:
        return JSONResponse(status_code=400, content={"error": str(e)})
    
@router.get("/user/{user_id}/{action}")
def lock_unlock_user(
    user_id: str,
    action: str,
    current_user: str = Depends(get_current_admin)
):
    try:
        if action not in ["lock", "unlock"]:
            raise ValueError("Invalid action. Use 'lock' or 'unlock'.")
        Admin.lock_unlock_user(user_id, action)
        return {"message": f"User {action}ed successfully!"}
    except ValueError as e:
        return JSONResponse(status_code=400, content={"error": str(e)})
    
@router.post("/user/{user_id}/reset")
def reset_user_password(
    user_id: str,
    req: ResetRequest,
    current_user: str = Depends(get_current_admin)
):
    try:
        Admin.reset_user_password(user_id, req.new_p, req.confirm_p)
        return {"message": "User password reset successfully!"}
    except ValueError as e:
        return JSONResponse(status_code=400, content={"error": str(e)})

##################################################

@router.get("/rooms")
def get_rooms(
    pagination: int = 0,
    limit: int = 5,
    search: str = "",
    sort_by: str = "created_at",
    sort_order: str = "members_count",
    current_user: str = Depends(get_current_admin)
):
    try:
        rooms, total = Admin.get_all_rooms(pagination, limit, search, sort_by, sort_order)
        return {"message": "Rooms retrieved successfully!", "rooms": rooms, "total": total}
    except ValueError as e:
        return JSONResponse(status_code=400, content={"error": str(e)})
    
@router.put("/room/{room_id}")
def update_room(
    room_id: str,
    req: UpdateRoomRequest,
    current_user: str = Depends(get_current_admin)
):
    try:
        Rooms.update_room(room_id, room_name=req.room_name, room_picture=req.room_picture, id=current_user)
        return {"message": "Room updated successfully!"}
    except ValueError as e:
        return JSONResponse(status_code=400, content={"error": str(e)})
    
@router.delete("/room/{room_id}")
def delete_room(
    room_id: str,
    current_user: str = Depends(get_current_admin)
):
    try:
        Admin.delete_room(room_id)
        return {"message": "Room deleted successfully!"}
    except ValueError as e:
        return JSONResponse(status_code=400, content={"error": str(e)})

##################################################

@router.get("/messages")
def get_messages(
    pagination: int = 0,
    limit: int = 5,
    search: str = "",
    sort_by: str = "created_at",
    sort_order: str = "desc",
    current_user: str = Depends(get_current_admin)
):
    try:
        messages, total = Admin.get_all_messages(pagination, limit, search, sort_by, sort_order)
        return {"message": "Messages retrieved successfully!", "messages": messages, "total": total}
    except ValueError as e:
        return JSONResponse(status_code=400, content={"error": str(e)})

@router.delete("/message/{message_id}")
def delete_message(
    message_id: str,
    current_user: str = Depends(get_current_admin)
):
    try:
        Admin.delete_message(message_id)
        return {"message": "Message deleted successfully!"}
    except ValueError as e:
        return JSONResponse(status_code=400, content={"error": str(e)})

##################################################

@router.get("/ai")
def get_ai(
    current_user: str = Depends(get_current_admin)
):
    try:
        settings = Admin.get_ai_settings()
        return {"message": "AI Settings retrieved successfully!", "settings": settings}
    except ValueError as e:
        return JSONResponse(status_code=400, content={"error": str(e)})

@router.put("/ai")
def update_ai(
    req: UpdateAI,
    current_user: str = Depends(get_current_admin)
):
    try:
        Admin.update_ai_settings(model=None, temperature=req.temperature, max_tokens=req.max_tokens)
        return {"message": "AI Settings have been saved successfully!"}
    except ValueError as e:
        return JSONResponse(status_code=400, content={"error": str(e)})

##################################################

@router.get("/config")
def get_config(
    current_user: str = Depends(get_current_admin)
):
    try:
        config = Admin.get_config()
        return {"message": "Configuration settings retrieved successfully!", "config": config}
    except ValueError as e:
        return JSONResponse(status_code=400, content={"error": str(e)})

@router.put("/config")
def put_config(
    updates: dict = Body(...),
    current_user: str = Depends(get_current_admin)
):
    try:
        Admin.update_config(updates)
        return {"message": "Configuration updated successfully!"}
    except ValueError as e:
        return JSONResponse(status_code=400, content={"error": str(e)})

        