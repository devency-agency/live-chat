from pymongo import MongoClient
import pymongo
from pymongo import ReturnDocument
from datetime import datetime, timedelta, timezone
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from jose import jwt
from email_validator import validate_email, EmailNotValidError
from password_strength import PasswordPolicy
from bson import ObjectId
from bson.objectid import ObjectId
import string, random
import validators
import re
import time

# CONFIGURATION
ph = PasswordHasher(
    time_cost=3,
    memory_cost=65536,
    parallelism=2,
    hash_len=32,
    salt_len=16
)
policy = PasswordPolicy.from_names(
    length=6,
    numbers=1,
    special=1,
)

def get_system_message():
    config = Admin.get_config()
    return config.get("system_message")

def get_db_uri():
    config = Admin.get_config()
    return config["db_uri"]

def get_db_name():
    config = Admin.get_config()
    return config["db_name"]

def get_register_status():
    config = Admin.get_config()
    return config.get("register_feature", True)

def get_ai_status():
    config = Admin.get_config()
    return config.get("ai_feature", True)

def hash_password(p): return ph.hash(p)
def check_password(p1, p2): return ph.verify(p1, p2)
def validate_password(p): return not policy.test(p) 

def create_access_token(data: dict, expires_delta: timedelta | None = None):
    raise NotImplementedError("Access token function logic has been removed from the public version.")

def conf_():
    raise NotImplementedError("Main configurations has been removed from the public version.")
    # ../ Configurations \.. #

class Authentication:
    def __init__(self):
        self.collection = user_collection

    @staticmethod
    def login(email: str, password: str):
        try:
            result = validate_email(email, check_deliverability=False)
            normalized_email = result.normalized
        except EmailNotValidError as e:
            raise ValueError(f"Invalid email!")
        user = user_collection.find_one({"email": normalized_email})
        if not user:
            raise ValueError("Invalid email or password!")
        try:
            check_password(user["password"], password)
        except VerifyMismatchError:
            raise ValueError("Invalid email or password!")
        if user["status"] == "locked":
            raise ValueError("Your account is locked!")
        user["last_login"] = datetime.now()
        user_collection.update_one({"_id": user["_id"]}, {"$set": {"last_login": user["last_login"]}})
        return create_access_token(data={"sub": str(user["_id"])})


    @staticmethod
    def register(email: str, username: str, password: str):
        if not get_register_status():
            raise ValueError("This feature is currently disabled by an admin!")
        try:
            result = validate_email(email, check_deliverability=False)
            normalized_email = result.normalized
        except EmailNotValidError as e:
            raise ValueError(f"Invalid email!")
        if not validate_password(password):
            raise ValueError("Weak password!")
        if not re.fullmatch(r'^[a-z0-9_]+$', username):
            raise ValueError("Username must contain only lowercase letters, numbers, and underscores.")
        if username.lower() == 'ai' or len(username) < 3 or len(username) > 16:
            raise ValueError("Invalid username!")
        new_user = {
            "username": username,
            "email": normalized_email,
            "password": hash_password(password),
            "profile_picture": "".join(random.choices(string.ascii_letters + string.digits, k=16)),
            "status": "active",
            "created_at": datetime.now(),
            "last_login": datetime.now(),
            "role": "user",
            "is_admin": False
        }
        try:
            result = user_collection.insert_one(new_user)
            Rooms.create_room("AI Room", None, str(result.inserted_id), None, True, is_system=True)
            return create_access_token(data={"sub": str(result.inserted_id)})
        except pymongo.errors.DuplicateKeyError:
            raise ValueError("Username or email already exists!")

class Users:
    def __init__(self):
        self.collection = user_collection

    @staticmethod
    def get_user(id: str):
        user = user_collection.find_one({"_id": ObjectId(id)})
        if not user:
            raise ValueError("User not found!")
        user = dict(user)
        user["_id"] = str(user["_id"])
        user["created_at"] = user["created_at"].isoformat()
        user["last_login"] = user["last_login"].isoformat()
        user.pop("password", None)
        return user
    
    @staticmethod
    def change_user_email(id: str, new_email: str):
        try:
            result = validate_email(new_email, check_deliverability=False)
            normalized_email = result.normalized
        except EmailNotValidError as e:
            raise ValueError(f"Invalid email!")
        if user_collection.find_one({"email": normalized_email}):
            raise ValueError("Email already in use!")
        user_collection.update_one({"_id": ObjectId(id)}, {"$set": {"email": normalized_email}})

    @staticmethod
    def change_user_password(id: str, old_password: str, new_password: str):
        user = user_collection.find_one({"_id": ObjectId(id)})
        if not user:
            raise ValueError("User not found!")
        try:
            check_password(user["password"], old_password)
        except VerifyMismatchError:
            raise ValueError("Invalid password!")
        if not validate_password(new_password):
            raise ValueError("Weak password!")
        user_collection.update_one({"_id": ObjectId(id)}, {"$set": {"password": hash_password(new_password)}})

    @staticmethod
    def change_user_pfp(id: str, new_pfp: str):
        user_collection.update_one({"_id": ObjectId(id)}, {"$set": {"profile_picture": new_pfp}})

    @staticmethod
    def update_user(id: str, email, old_p, new_p, pfp):
        if email:
            Users.change_user_email(id, email)
        if old_p and new_p:
            Users.change_user_password(id, old_p, new_p)
        if pfp:
            Users.change_user_pfp(id, pfp)

    @staticmethod
    def is_user_in_room(id: str, room_id: str):
        room = Rooms.get_room(room_id)
        if str(room["_id"]) == '685a64dcd94f6bbc0088f911':
            return True
        user = Users.get_user(id)
        if user["is_admin"]:
            return True
        return user["username"] in room["members"]

    @staticmethod
    def is_user_owner(id: str, room_id: str):
        room = Rooms.get_room(room_id)
        user = Users.get_user(id)
        if user["is_admin"]:
            return True
        return user["username"] == room["owner"]

    @staticmethod
    def is_user_banned(id: str, room_id: str):
        room = Rooms.get_room(room_id)
        user = Users.get_user(id)
        if user["is_admin"]:
            return False
        return user["username"] in room.get("banned", [])

    @staticmethod
    def is_user_admin(id: str):
        user = Users.get_user(id)
        return user.get("is_admin", False)
    
    @staticmethod
    def check_ai_access(id: str, room_id: str):
        user = Users.get_user(id)
        return user["ai_room"] == room_id

class Rooms:
    def __init__(self):
        self.collection = room_collection

    @staticmethod
    def create_room(room_name: str, room_picture: str, id: str, join_code: str = None, is_ai: bool = False, is_system: bool = False):
        if not is_system:
            if not room_name or len(room_name) < 4 or len(room_name) > 16: 
                raise ValueError("Room name must be at least 4 characters long and not exceed 16 characters!")
            if room_name == 'AI' or room_name == 'AI Room':
                raise ValueError("Invalid name!")
        if not is_ai:
            if not room_picture:
                room_picture = f'https://api.dicebear.com/7.x/avataaars/svg?seed={"".join(random.choices(string.ascii_letters + string.digits, k=16))}'
            if not validators.url(room_picture):
                raise ValueError("Invalid room picture URL!")
        user = Users.get_user(id)
        new_room = {
            "room_name": room_name,
            "room_picture": room_picture,
            "room_join_code": join_code if not is_ai and join_code else "".join(random.choices(string.ascii_letters + string.digits, k=8)),
            "created_at": datetime.now(),
            "modified_at": datetime.now(),
            "owner": user["username"],
            "members": [user["username"]],
            "banned": [],
            "is_ai": is_ai
        }
        result = room_collection.insert_one(new_room)
        return str(result.inserted_id), new_room["room_join_code"]
    
    @staticmethod
    def change_room_name(room_id: str, new_name: str):
        room = Rooms.get_room(room_id)
        if not new_name or len(new_name) < 3:
            raise ValueError("Room name must be at least 3 characters long!")
        room_collection.update_one({"_id": room["_id"]}, {"$set": {"room_name": new_name}})
        room_collection.update_one({"_id": room["_id"]}, {"$set": {"modified_at": datetime.now()}})

    @staticmethod
    def change_room_picture(room_id: str, new_picture: str):
        room = Rooms.get_room(room_id)
        if not validators.url(new_picture):
            raise ValueError("Invalid room picture URL!")
        room_collection.update_one({"_id": room["_id"]}, {"$set": {"room_picture": new_picture}})
        room_collection.update_one({"_id": room["_id"]}, {"$set": {"modified_at": datetime.now()}})
        
    @staticmethod
    def update_room(room_id: str, room_name: str, room_picture: str, id: str):
        if not Users.is_user_owner(id, room_id):
            raise ValueError("You are not the owner of this room!")
        if room_name:
            Rooms.change_room_name(room_id, room_name)
        if room_picture:
            Rooms.change_room_picture(room_id, room_picture)

    @staticmethod
    def get_room(id: str):
        room = room_collection.find_one({"_id": ObjectId(id)})
        if not room:
            raise ValueError("Room not found!")
        return room
    
    @staticmethod
    def get_user_rooms(id: str):
        user = Users.get_user(id)
        rooms = room_collection.find({"members": user["username"]})
        serialized_rooms = []
        for room in list(rooms):
            room = dict(room)
            if "_id" in room:
                room["_id"] = str(room["_id"])
            serialized_rooms.append(room)
        return serialized_rooms

    @staticmethod
    def get_room_by_id(room_id: str):
        room = room_collection.find_one({"_id": ObjectId(room_id)})
        if not room:
            raise ValueError("Room not found!")
        room.pop("banned", None)
        room["_id"] = str(room["_id"])
        room["created_at"] = room["created_at"].isoformat()
        room["modified_at"] = room["modified_at"].isoformat()
        room["members"] = len(room["members"])
        return room

    @staticmethod
    def get_room_by_join_code(join_code: str):
        room = room_collection.find_one({"room_join_code": join_code})
        if not room:
            raise ValueError("Room not found!")
        return room

    @staticmethod
    def add_user_to_room(id: str, room_id: str):
        room = Rooms.get_room(room_id)
        user = Users.get_user(id)
        if user["username"] not in room["members"]:
            room["members"].append(user["username"])
            room_collection.update_one({"_id": room["_id"]}, {"$set": {"members": room["members"]}})
            return
        raise ValueError("User is already a member of this room!")

    @staticmethod
    def remove_user_from_room(id: str, room_id: str):
        room = Rooms.get_room(room_id)
        user = Users.get_user(id)
        if user["username"] == room["owner"]:
            raise ValueError("You cannot leave the room you own!")
        if user["username"] in room["members"]:
            room["members"].remove(user["username"])
            room_collection.update_one({"_id": room["_id"]}, {"$set": {"members": room["members"]}})
            return
        raise ValueError("User is not a member of this room!")

    @staticmethod
    def add_message(room_id: str, message: str, id: str = None, pfp: str = None, user: str = None):
        user_obj = None
        if id:
            user_obj = Users.get_user(id)
        new_message = {
            "room_id": room_id,
            "pfp": pfp if pfp else (user_obj["profile_picture"] if user_obj else None),
            "user": user if user else (user_obj["username"] if user_obj else None),
            "message": message,
            "timestamp": datetime.now()
        }
        messages_collection.insert_one(new_message)

    @staticmethod
    def get_messages(room_id: str, limit: int = 15, descending: bool = False):
        sort_order = pymongo.DESCENDING if descending else pymongo.ASCENDING
        messages = messages_collection.find({"room_id": room_id}).sort("timestamp", sort_order).limit(limit)
        serialize_messages = []
        for m in messages:
            m = dict(m)
            if '_id' in m:
                m['_id'] = str(m['_id'])
                m['timestamp'] = m['timestamp'].isoformat() if isinstance(m['timestamp'], datetime) else m['timestamp']
                serialize_messages.append(m)
        return serialize_messages

    @staticmethod
    def get_message_before(room_id: str, before: datetime, limit: int = 15):
        messages = messages_collection.find({
            "room_id": room_id,
            "timestamp": {"$lt": before}
        }).sort("timestamp", pymongo.DESCENDING).limit(limit)
        return list(messages)

class Admin:
    def __init__(self):
        self.collection = user_collection

    @staticmethod
    def get_all_users(pagination: int = 0, limit: int = 5, search: str = "h", sort_by: str = "created_at", sort_order: str = "asc"):
        if sort_by not in USERS_ALLOWED_SORT_FIELDS or sort_order not in USERS_ALLOWED_SORT_ORDERS:
            raise ValueError("Invalid sort field or order!")
        skip = pagination * limit
        pymongo_order = pymongo.DESCENDING if sort_order == "desc" else pymongo.ASCENDING
        query = {}
        if search:
            query = {"$or": [
                {"username": {"$regex": search, "$options": "i"}},
                {"email": {"$regex": search, "$options": "i"}}
            ]}
        total = user_collection.count_documents(query)
        users = user_collection.find(query).sort(sort_by, pymongo_order).skip(skip).limit(limit)
        serialized_users = []
        for user in users:
            user = dict(user)
            user["_id"] = str(user["_id"])
            user["created_at"] = user["created_at"].isoformat()
            user["last_login"] = user["last_login"].isoformat()
            joined_rooms = Rooms.get_user_rooms(user["_id"])
            user["room_membership"] = [
                {"room_name": room["room_name"], "role": "owner" if user["username"] == room["owner"] else "member"}
                for room in joined_rooms
            ]
            user.pop("password", None)
            serialized_users.append(user)
        return serialized_users, total

    @staticmethod
    def delete_user(id: str):
        user = Users.get_user(id)
        if user["is_admin"]:
            raise ValueError("You cannot delete an admin user!")
        user_collection.delete_one({"_id": ObjectId(id)})
        room_collection.update_many(
            {"members": user["username"]},
            {"$pull": {"members": user["username"]}}
        )
        room_collection.delete_many({"owner": user["username"]})
        messages_collection.delete_many({"user": user["username"]})

    @staticmethod
    def lock_unlock_user(id: str, action: str):
        user = Users.get_user(id)
        if user["is_admin"]:
            raise ValueError("You cannot lock an admin user!")
        if action == 'lock':
            user_collection.update_one({"_id": ObjectId(id)}, {"$set": {"status": "locked"}})
        elif action == 'unlock':
            user_collection.update_one({"_id": ObjectId(id)}, {"$set": {"status": "active"}})

    @staticmethod
    def reset_user_password(id: str, new_password: str, confirm_password: str):
        user = Users.get_user(id)
        if new_password != confirm_password:
            raise ValueError("New password and confirm password don't match!")
        if not validate_password(new_password):
            raise ValueError("Weak password!")
        if user["is_admin"]:
            raise ValueError("You cannot reset an admin user!")
        user_collection.update_one({"_id": ObjectId(id)}, {"$set": {"password": hash_password(new_password)}})

    ##############################################################

    @staticmethod
    def get_all_rooms(pagination: int = 0, limit: int = 5, search: str = "", sort_by: str = "created_at", sort_order: str = "members_count"):
        if sort_by not in ROOMS_ALLOWED_SORT_FIELDS or sort_order not in ROOMS_ALLOWED_SORT_ORDERS:
            raise ValueError("Invalid sort field or order!")
        skip = pagination * limit
        pymongo_order = pymongo.DESCENDING if sort_order == "desc" else pymongo.ASCENDING
        query = {
            "is_ai": {"$ne": True},
            "_id": {"$ne": ObjectId("685a64dcd94f6bbc0088f911")}
        }
        if search:
            query = {"$or": [
                {"room_name": {"$regex": search, "$options": "i"}},
                {"room_join_code": {"$regex": search, "$options": "i"}},
                {"owner": {"$regex": search, "$options": "i"}}
            ]}
        total = room_collection.count_documents(query)
        rooms = room_collection.find(query).sort(sort_by, pymongo_order).skip(skip).limit(limit)
        serialized_rooms = []
        for room in rooms:
            room = dict(room)
            if "_id" in room:
                room["_id"] = str(room["_id"])
            room["created_at"] = room["created_at"].isoformat()
            room["modified_at"] = room["modified_at"].isoformat()
            room["members_count"] = len(room.get("members", []))
            room["total_messages"] = messages_collection.count_documents({"room_id": room["_id"]})
            room.pop("banned", None)
            room.pop("is_ai", None)
            serialized_rooms.append(room)
        return serialized_rooms, total

    @staticmethod
    def delete_room(room_id: str):
        room = Rooms.get_room(room_id)
        if room["is_ai"]:
            raise ValueError("You cannot delete an AI room!")
        room_collection.delete_one({"_id": ObjectId(room_id)})
        messages_collection.delete_many({"room_id": room_id})
        return {"message": "Room deleted successfully!"}

    ##############################################################

    @staticmethod
    def get_all_messages(pagination: int = 0, limit: int = 5, search: str = "", sort_by: str = "created_at", sort_order: str = "desc"):
        if sort_by not in MESSAGES_ALLOWED_SORT_FIELDS \
           or sort_order not in MESSAGES_ALLOWED_SORT_ORDERS:
            raise ValueError("Invalid sort field or order!")

        # Map UI sort fields to actual MongoDB fields
        sort_field_map = {
            "created_at": "timestamp",
            "sender": "user"
        }
        sort_field = sort_field_map.get(sort_by, "timestamp")

        match_stage = {}
        if search:
            regex = {"$regex": search, "$options": "i"}
            match_stage["$or"] = [
                {"message": regex},
                {"user":    regex},
            ]

        skip = pagination * limit
        direction = pymongo.DESCENDING if sort_order == "desc" else pymongo.ASCENDING
        pipeline = []

        if match_stage:
            pipeline.append({"$match": match_stage})

        pipeline.append({"$match": {"room_id": {"$type": "string", "$regex": "^[a-fA-F0-9]{24}$"}}})
        pipeline.append({"$addFields": {"room_id_obj": {"$toObjectId": "$room_id"}}})
        pipeline.append({
            "$lookup": {
                "from": "rooms",
                "localField": "room_id_obj",
                "foreignField": "_id",
                "as": "room_docs"
            }
        })
        pipeline.append({"$unwind": "$room_docs"})
        pipeline.append({"$match": {"room_docs.room_name": {"$ne": "AI Room"}}})
        pipeline.append({"$sort": {sort_field: direction}})
        pipeline.append({
            "$facet": {
                "data": [
                    {"$skip": skip},
                    {"$limit": limit},
                    {"$project": {
                        "_id": {"$toString": "$_id"},
                        "user": 1,
                        "message": 1,
                        "timestamp": {"$dateToString": {"format": "%Y-%m-%dT%H:%M:%S.%LZ", "date": "$timestamp"}},
                        "room_id": 1,
                        "room_name": "$room_docs.room_name"
                    }}
                ],
                "total": [
                    {"$count": "count"}
                ]
            }
        })
        result = list(messages_collection.aggregate(pipeline))[0]
        serialized_messages = result["data"]
        total = result["total"][0]["count"] if result["total"] else 0
        return serialized_messages, total

    @staticmethod
    def delete_message(message_id: str):
        message = messages_collection.find_one({"_id": ObjectId(message_id)})
        if not message:
            raise ValueError("Message not found!")
        messages_collection.delete_one({"_id": ObjectId(message_id)})

    ##############################################################

    @staticmethod
    def get_ai_settings():
        stats = stats_collection.find_one({"_id": ObjectId(STAT_DOC_ID)})
        stats["_id"] = str(stats["_id"])
        return stats

    @staticmethod
    def update_ai_settings(model: str, temperature: int, max_tokens: int):
        if model:
            pass
        if temperature:
            AI.change_ai_temperature(temperature)
        if max_tokens:
            AI.change_max_tokens(max_tokens)

    ############################################################## 

    @staticmethod
    def get_config():
        config = settings_collection.find_one({"_id": ObjectId(SETTING_DOC_ID)})
        if not config:
            raise ValueError("Config not found!")
        config["_id"] = str(config["_id"])
        return config
        
    def update_config(updates: dict):
        result = settings_collection.update_one({"_id": ObjectId(SETTING_DOC_ID)}, {"$set": updates})
        if result.matched_count == 0:
            raise ValueError("Config not found!")

class AI:

    @staticmethod
    def ask_llm(prompt, history):
        """
        Ask LLM a question and return the response.
        """
        
        raise NotImplementedError("Memory logic has been removed from the public version.")

        start_time = time.time()
        raise NotImplementedError("LLM function logic has been removed from the public version.")
        elapsed = time.time() - start_time

        if llm.response:
            old_n = stat.get("total_ai_responses", 0)
            old_avg = stat.get("average_response_time", 0.0)
            total_reqs = stat["total_requests"]
            new_n = old_n + 1
            new_avg = (old_avg * old_n + elapsed) / new_n
            new_rate = (new_n / total_reqs) * 100
            stats_collection.update_one(
                {"_id": ObjectId(STAT_DOC_ID)},
                {
                    "$inc": {"total_ai_responses": 1},
                    "$set": {
                        "average_response_time": new_avg,
                        "ai_response_rate": new_rate
                    }
                }
            )

        return llm.response.text

    @staticmethod
    def change_ai_temperature(temperature):
        if temperature > 1.5 or temperature < 0:
            raise ValueError("Invalid temperature value!")
        stats_collection.update_one({"_id": ObjectId(STAT_DOC_ID)}, {"$set": {"temperature": temperature}})

    @staticmethod
    def change_max_tokens(max_tokens):
        if max_tokens < 128 or max_tokens > 4096:
            raise ValueError("Invalid max_tokens value!")
        stats_collection.update_one({"_id": ObjectId(STAT_DOC_ID)}, {"$set": {"max_tokens": max_tokens}})
