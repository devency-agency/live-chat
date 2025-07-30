"use client";

import { useState, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Settings,
  LogOut,
  Plus,
  UserPlus,
  Globe,
  Bot,
  Users,
  Share2,
  Edit3,
  UserMinus,
  MoreHorizontal
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { notify } from "@/lib/notifications";

interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  ai_room?: string;
}

interface Room {
  _id: string;
  room_name: string;
  room_picture?: string;
  members: Array<string>;
  owner: string;
  room_join_code: string;
  is_ai?: boolean;
}

interface SidebarProps {
  selectedRoom: string | null;
  onRoomSelect: (roomId: string) => void;
  onSettingsClick: () => void;
}

export function Sidebar({ selectedRoom, onRoomSelect, onSettingsClick }: SidebarProps) {
  const [user, setUser] = useState<User | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [aiRoom, setAiRoom] = useState<Room | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedRoomForAction, setSelectedRoomForAction] = useState<Room | null>(null);

  // Form states
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomPicture, setNewRoomPicture] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [editRoomName, setEditRoomName] = useState("");
  const [editRoomPicture, setEditRoomPicture] = useState("");

  useEffect(() => {
    // Load user from localStorage
    const userData = localStorage.getItem('user');
    if (userData) {
      setUser(JSON.parse(userData));
    }

    fetchRooms();
  }, []);

  const fetchRooms = async () => {
    try {
      const response = await api.get<{
        rooms: Array<{
          _id: string;
          room_name: string;
          room_picture?: string;
          members: Array<string>;
          owner: string;
          room_join_code: string;
          is_ai?: boolean;
        }>;
      }>('/api/rooms', {
        requireAuth: true,
      });
  
      if (response.success && response.data) {
        const allRooms: Room[] = response.data.rooms || [];
        const foundAiRoom = allRooms.find((r) => r.is_ai) ?? null;
        const normalRooms = allRooms.filter((r) => !r.is_ai);
        setAiRoom(foundAiRoom);
        setRooms(normalRooms);
      } else {
        notify.error(response.error || 'Failed to fetch rooms');
      }
    } catch (error: unknown) {
      if (error instanceof ApiError && error.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.reload();
      } else {
        notify.error('Failed to fetch rooms');
      }
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.reload();
  };

  const handleCreateRoom = async () => {
    if (!newRoomName.trim()) return;

    try {
      const response = await api.post('/api/rooms/create', {
        room_name: newRoomName,
        room_picture: newRoomPicture || null,
      });

      if (response.success) {
        notify.success('Room created successfully!');
        setNewRoomName("");
        setShowCreateModal(false);
        fetchRooms();
      } else {
        notify.error(response.error || 'Failed to create room');
      }
    } catch (error) {
      notify.error('Failed to create room');
    }
  };

  const handleJoinRoom = async () => {
    if (!joinCode.trim()) return;

    try {
      const response = await api.get(`/api/rooms/join?code=${joinCode}`);

      if (response.success) {
        notify.success('Joined room successfully!');
        setJoinCode("");
        setShowJoinModal(false);
        fetchRooms();
      } else {
        notify.error(response.error || 'Failed to join room');
      }
    } catch (error) {
      notify.error('Failed to join room');
    }
  };

  const handleLeaveRoom = async (roomId: string) => {
    try {
      const response = await api.get(`/api/rooms/leave?id=${roomId}`);

      if (response.success) {
        notify.success('Left room successfully');
        fetchRooms();

        if (selectedRoom === roomId) {
          onRoomSelect('685a64dcd94f6bbc0088f911');
        }
      } else {
        notify.error(response.error || 'Failed to leave room');
      }
    } catch (error) {
      notify.error('Failed to leave room');
    }
  };

  const handleEditRoom = async () => {
    if (!selectedRoomForAction || !editRoomName.trim()) return;

    try {
      const response = await api.put(`/api/rooms/${selectedRoomForAction._id}`, {
        room_name: editRoomName,
        room_picture: editRoomPicture || null,
      });

      if (response.success) {
        notify.success('Room updated successfully!');
        setEditRoomName("");
        setShowEditModal(false);
        setSelectedRoomForAction(null);
        fetchRooms();
      } else {
        notify.error(response.error || 'Failed to update room');
      }
    } catch (error) {
      notify.error('Failed to update room');
    }
  };

  const openShareModal = (room: Room) => {
    setSelectedRoomForAction(room);
    setShowShareModal(true);
  };

  const openEditModal = (room: Room) => {
    setSelectedRoomForAction(room);
    setEditRoomName(room.room_name);
    setShowEditModal(true);
  };

  const getUserInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  return (
    <>
      <div className="w-80 bg-card border-r border-border flex flex-col h-screen font-semibold">
        {/* Profile Section */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center space-x-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.avatar}`} />
              <AvatarFallback className="bg-secondary font-semibold">
                {user?.name ? getUserInitials(user.name) : 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.name}</p>
              <div className="flex items-center space-x-2">
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                      <Settings className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={onSettingsClick}>
                      <Settings className="mr-2 h-4 w-4" />
                      Settings
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={handleLogout}
                      className="text-destructive focus:text-destructive"
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      Log out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-4 space-y-2">
          <Button
            onClick={() => setShowCreateModal(true)}
            className="create-room-btn w-full justify-start bg-yellow-600 hover:bg-yellow-700 text-white font-semibold"
          >
            <Plus className="mr-2 h-4 w-4" />
            Create Room
          </Button>
          <Button
            onClick={() => setShowJoinModal(true)}
            className="join-room-btn w-full justify-start bg-green-600 hover:bg-green-700 text-white font-semibold"
          >
            <UserPlus className="mr-2 h-4 w-4" />
            Join Room
          </Button>
        </div>

        {/* Rooms List */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 pt-0">
            <h3 className="text-sm font-medium text-muted-foreground mb-3">Rooms</h3>

            {/* Default Rooms */}
            <div className="space-y-1">
              <button
                onClick={() => onRoomSelect('685a64dcd94f6bbc0088f911')}
                className={`room-card w-full flex items-center space-x-3 p-2 rounded-md text-left hover:bg-accent transition-colors ${
                  selectedRoom === 'public' ? 'room-selected' : ''
                }`}
              >
                <Globe className="h-4 w-4 text-blue-500" />
                <span className="text-sm font-medium font-semibold">Public Room</span>
              </button>

              <button
                onClick={() => onRoomSelect(aiRoom?._id ?? '')}
                className={`room-card w-full flex items-center space-x-3 p-2 rounded-md text-left hover:bg-accent transition-colors ${
                  selectedRoom === 'ai' ? 'room-selected' : ''
                }`}
              >
                <Bot className="h-4 w-4 text-purple-500" />
                <span className="text-sm font-medium font-semibold">AI Room</span>
                <span className="ml-2 px-2 py-0.5 rounded bg-purple-700 text-white text-[10px] font-semibold uppercase tracking-wide font-semibold">
                  Beta
                </span>
              </button>
            </div>

            <Separator className="my-3" />

            {/* Custom Rooms */}
            <div className="space-y-1">
              {rooms.map((room) => (
                <div
                  key={room._id}
                  className={`room-card w-full p-2 rounded-md hover:bg-accent transition-colors group ${
                    selectedRoom === room._id ? 'room-selected' : ''
                  }`}
                  onClick={() => onRoomSelect(room._id)}
                >
                  <div className="flex items-center space-x-3 cursor-pointer">
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={room.room_picture} />
                      <AvatarFallback className="bg-secondary text-xs">
                        {room.room_name
                          ? room.room_name
                              .split(' ')
                              .map((n) => n[0])
                              .join('')
                              .toUpperCase()
                          : '#'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate font-semibold">{room.room_name}</p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          onClick={(e) => e.stopPropagation()}
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 opacity-100 md:opacity-0 md:group-hover:opacity-100"
                        >
                          <MoreHorizontal className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={(e) => e.stopPropagation()}
                          onSelect={() => openShareModal(room)}
                        >
                          <Share2 className="mr-2 h-4 w-4" />
                          Share
                        </DropdownMenuItem>
                        {user?.name === room.owner ? (
                          <DropdownMenuItem
                            onClick={(e) => e.stopPropagation()} 
                            onSelect={() => openEditModal(room)}
                          >
                            <Edit3 className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            onClick={() => handleLeaveRoom(room._id)}
                            className="text-destructive focus:text-destructive"
                          >
                            <UserMinus className="mr-2 h-4 w-4" />
                            Leave
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="flex items-center space-x-1 mt-1 ml-7">
                    <Users className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                        {room.members.length} members
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Room</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Room name"
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
            />
            <Input
              placeholder="Room Picture URL (Leave empty for auto-generated)"
              value={newRoomPicture}
              onChange={(e) => setNewRoomPicture(e.target.value)}
            />
            <div className="flex space-x-2">
            {/* || !newRoomPicture.trim() */}
                <Button onClick={handleCreateRoom} disabled={!newRoomName.trim()}> 
                Create
                </Button>
              <Button variant="outline" onClick={() => setShowCreateModal(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showJoinModal} onOpenChange={setShowJoinModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Join Room</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Enter join code"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleJoinRoom()}
            />
            <div className="flex space-x-2">
              <Button onClick={handleJoinRoom} disabled={!joinCode.trim()}>
                Join
              </Button>
              <Button variant="outline" onClick={() => setShowJoinModal(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showShareModal} onOpenChange={setShowShareModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share Room</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              value={selectedRoomForAction?.room_join_code || ''}
              readOnly
              className="bg-secondary"
            />
            <p className="text-sm text-muted-foreground">
              Share this code with others to let them join the room.
            </p>
            <Button onClick={() => setShowShareModal(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Room</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Room name"
              value={editRoomName}
              onChange={(e) => setEditRoomName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleEditRoom()}
            />
            <Input
              placeholder="Room picture (optional)"
              value={editRoomPicture}
              onChange={(e) => setEditRoomPicture(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleEditRoom()}
            />
            <div className="flex space-x-2">
              <Button onClick={handleEditRoom} disabled={!editRoomName.trim()}>
                Update
              </Button>
              <Button variant="outline" onClick={() => setShowEditModal(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
