from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from fastapi.responses import JSONResponse
from jose import jwt, JWTError
from pydantic import BaseModel
from mongo_test import Rooms, Users, Admin
import datetime
from typing import Optional

router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")

class UpdateRoomRequest(BaseModel):
    room_name: Optional[str] = None
    room_picture: Optional[str] = None

    class Config:
        extra = "forbid"
    
class CreateRoomRequest(BaseModel):
    room_name: Optional[str] = None
    room_picture: Optional[str] = None

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
def get_rooms(current_user: str = Depends(get_current_user)):
    try:
        rooms = Rooms.get_user_rooms(current_user)
        return {"message": "Rooms retreived successfuly!", "rooms": rooms}
    except ValueError as e:
        return JSONResponse(status_code=400, content={"error": str(e)})
    
@router.post("/create")
def create_room(
    req: CreateRoomRequest,
    current_user: str = Depends(get_current_user)
):
    try:
        id, code = Rooms.create_room(req.room_name, req.room_picture, current_user)
        return {"message": "Room created successfully!", "room_id": id, "room_code": code}
    except ValueError as e:
        return JSONResponse(status_code=400, content={"error": str(e)})

@router.get("/join")
def join_room(
    code: str,
    current_user: str = Depends(get_current_user)
):
    try:
        room = Rooms.get_room_by_join_code(code)
        Rooms.add_user_to_room(current_user, str(room["_id"]))
        return {"message": "Joined room successfully!"}
    except ValueError as e:
        return JSONResponse(status_code=400, content={"error": str(e)})
    
@router.get("/leave")
def leave_room(
    id: str,
    current_user: str = Depends(get_current_user)
):
    try:
        Rooms.remove_user_from_room(current_user, id)
        return {"message": "Left room successfully!"}
    except ValueError as e:
        return JSONResponse(status_code=400, content={"error": str(e)})

@router.get("/{room_id}")
def get_room(
    room_id: str, 
    current_user: str = Depends(get_current_user)
):
    try:
        if not Users.is_user_in_room(current_user, room_id):
            raise HTTPException(status_code=403, detail="You are not allowed to access this room.")
        room = Rooms.get_room_by_id(room_id)
        return {"message": "Room retrieved successfully!", "room": dict(room)}
    except ValueError as e:
        return JSONResponse(status_code=400, content={"error": str(e)})


@router.put("/{room_id}")
def update_room(
    req: UpdateRoomRequest,
    room_id: str, 
    current_user: str = Depends(get_current_user)
):
    try:
        Rooms.update_room(room_id, req.room_name, req.room_picture, current_user)
        return {"message": "Room updated successfully!"}
    except ValueError as e:
        return JSONResponse(status_code=400, content={"error": str(e)})


@router.get("/{room_id}/messages")
def get_room_messages(
    room_id: str, 
    current_user: str = Depends(get_current_user)
):
    try:
        if not Users.is_user_in_room(current_user, room_id):
            raise HTTPException(status_code=403, detail="You are not allowed to access this room.")
        messages = Rooms.get_messages(room_id)
        return {"message": "Messages retrieved successfully!", "messages": messages}
    except ValueError as e:
        return JSONResponse(status_code=400, content={"error": str(e)})
