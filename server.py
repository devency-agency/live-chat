from fastapi import FastAPI
import socketio
import datetime
from bson import ObjectId
import asyncio

from routers import auth, users, rooms, admin
from mongo_test import Users, Rooms, AI, Admin, get_ai_status
from jose import jwt, JWTError
from asyncio import Lock
from time import time
import random
from fastapi.staticfiles import StaticFiles  # Import StaticFiles

sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins="*",
    cors_credentials=True,
)
socket_app = socketio.ASGIApp(sio, socketio_path="/ws/socket.io")

app = FastAPI()

# Include API routers
app.include_router(auth.router, prefix="/api/auth")
app.include_router(users.router, prefix="/api/users")
app.include_router(rooms.router, prefix="/api/rooms")
app.include_router(admin.router, prefix="/admin")
# Mount the WebSocket app
app.mount("/ws", socket_app)
# Mount the 'out' folder to serve the Next.js app
app.mount("/", StaticFiles(directory="out", html=True), name="static")

def get_current_user(token: str):
    try:
        payload = jwt.decode(token, Admin.get_config().get("secret_key"), algorithms=["HS256"])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise ValueError("Invalid token")
        return user_id
    except JWTError:
        raise ValueError("Invalid token")

@sio.event
async def connect(sid, environ, auth):
    try:
        raise NotImplementedError("Connection logic has been removed from the public version.")
    except ValueError as e:
        await sio.emit('error', {'error': str(e)}, to=sid)
        return

@sio.event
async def disconnect(sid):
    raise NotImplementedError("Disconnecting logic has been removed from the public version.")

@sio.event
async def join(sid, data):
    try:
        raise NotImplementedError("Joining logic has been removed from the public version.")
    except ValueError as e:
        await sio.emit('error', {'error': str(e)}, to=sid)

@sio.event
async def message(sid, data):
    try:

        raise NotImplementedError("Messaging logic has been removed from the public version.")

    except ValueError as e:
        await sio.emit('error', {'error': str(e)}, to=sid)
