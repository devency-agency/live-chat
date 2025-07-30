"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Users, Send, Globe, Bot } from "lucide-react";
import { api } from "@/lib/api";
import { ApiError } from "@/lib/api";
import { notify } from "@/lib/notifications";
import { getSocket } from "@/lib/sockets";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose, DialogTrigger } from "@/components/ui/dialog";

interface Message {
  _id: string;
  room_id: string;
  user: string;
  pfp: string;
  message: string;
  timestamp: string;
}

interface Room {
  _id: string;
  room_name: string;
  members: number;
  room_picture: string;
  is_ai?: boolean;
}

interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  ai_room?: string;
}

interface ChatPanelProps {
  selectedRoom: string | null;
}

export function ChatPanel({ selectedRoom }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [placeholder, setPlaceholder] = useState(false);
  const [animatedPlaceholder, setAnimatedPlaceholder] = useState("");
  const typingText = "Generating your response...";
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [isRoomSwitching, setIsRoomSwitching] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [fade, setFade] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [user, setUser] = useState<User | null>(null);
  const [showTos, setShowTos] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (placeholder) {
      setAnimatedPlaceholder("");
      let i = 0;
      const interval = setInterval(() => {
        setAnimatedPlaceholder(typingText.slice(0, i + 1));
        i++;
        if (i === typingText.length) clearInterval(interval);
      }, 40);
      return () => clearInterval(interval);
    } else {
      setAnimatedPlaceholder("");
    }
  }, [placeholder]);

  const fetchRoomData = useCallback(async () => {
    if (!selectedRoom) return;
    if (selectedRoom === "685a64dcd94f6bbc0088f911" || selectedRoom === "ai") {
      setCurrentRoom(
        selectedRoom === "ai"
          ? { _id: "ai", room_name: "AI Room", members: 0, room_picture: "null", is_ai: true }
          : { _id: "685a64dcd94f6bbc0088f911", room_name: "Public Room", members: 0, room_picture: "null" }
      );
      return;
    }
    const res = await api.get<{ room: Room }>(`/api/rooms/${selectedRoom}`);
    if (res.success && res.data) {
      setCurrentRoom(res.data.room);
    }
  }, [selectedRoom]);

  const fetchMessages = useCallback(async () => {
    if (!selectedRoom || selectedRoom === "ai") {
      setMessages([]);
      return;
    }

    const res = await api.get<{ messages: Message[] }>(`/api/rooms/${selectedRoom}/messages`);
    if (res.success && res.data) {
      setMessages(res.data.messages);
    }
  }, [selectedRoom]);

  useEffect(() => {
    if (!selectedRoom) return;
    setFade(false);
    setIsRoomSwitching(true);

    const timer = setTimeout(async () => {
      await fetchRoomData();
      await fetchMessages();
      setIsRoomSwitching(false);
      setFade(true);
    }, 200);

    return () => clearTimeout(timer);
  }, [selectedRoom, fetchRoomData, fetchMessages]);

  useEffect(() => {
    if (!selectedRoom) return;
  
    const token = localStorage.getItem("token") || "";
    const socket = getSocket(token);
  
    socket.emit("join", { room_uuid: selectedRoom });
  
    const handleMessage = (data: Message[]) => {
      setMessages(prev => [...prev, ...data]);
      if (data[0]?.user === "AI") {
        setLoading(false);
        setPlaceholder(false);
      }
    };
  
    const handleError = (error: unknown) => {
      let msg: string;

      if (typeof error === "string") {
        msg = error;
      } else if (error instanceof ApiError || error instanceof Error) {
        msg = error.message;
      } else if (typeof error === "object" && error !== null && "error" in error) {
        msg = (error as { error: string }).error;
      } else {
        msg = JSON.stringify(error);
      }

      notify.error(msg);
      setLoading(false);
      setPlaceholder(false);
    };
  
    socket.on("message", handleMessage);
    socket.on("error", handleError);
  
    return () => {
      socket.off("message", handleMessage);
      socket.off("error", handleError);
    };
  }, [selectedRoom]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (cooldownRemaining > 0) {
      const timer = setTimeout(() => setCooldownRemaining(cooldownRemaining - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldownRemaining]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedRoom || loading || cooldownRemaining > 0) {
      return;
    }

    if (messageInput.length > 1500) {
      notify.error('Message is too long. Maximum 1,500 characters allowed.');
      return;
    }

    setLoading(true);
    const tempMessage = messageInput;
    if (currentRoom?.is_ai) {
      setPlaceholder(true);
    }
    setMessageInput("");

    try {

      const token = localStorage.getItem('token') || '';
      const socket = getSocket(token);
      
      socket.emit("message", { 
        room_uuid: selectedRoom, 
        message: tempMessage, 
        ...(currentRoom?.is_ai ? { is_ai: true } : {}) 
      });
      setCooldownRemaining(3);

    } catch (error) {
      notify.error('Failed to send message');
      setMessageInput(tempMessage);
    } finally {
      if (currentRoom?.is_ai) {
        return;
      }
      setLoading(false);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString();
  };

  const getUserInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const getRoomIcon = () => {
    if (selectedRoom === '685a64dcd94f6bbc0088f911') return <Globe className="h-5 w-5 text-blue-500" />;
    if (currentRoom?.is_ai) return <Bot className="h-5 w-5 text-purple-500" />;
    return (
      <Avatar className="h-7 w-7">
        <AvatarImage src={currentRoom?.room_picture} />
        <AvatarFallback className="bg-secondary text-xs">
          {currentRoom?.room_name
            ? currentRoom.room_name
                .split(' ')
                .map((n) => n[0])
                .join('')
                .toUpperCase()
            : '#'}
        </AvatarFallback>
      </Avatar>
    );
  };

  if (!selectedRoom) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="text-center">
          <h3 className="text-lg font-semibold mb-2">Welcome to Live Chat</h3>
          <p className="text-muted-foreground">Select a room from the sidebar to start chatting</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col bg-background h-screen transition-opacity duration-300 ${fade ? 'opacity-100' : 'opacity-0'}`}
    >
      {/* Chat Header */}
      <div className="chat-header border-b border-border p-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {getRoomIcon()}
          <div>
            <h2 className="font-semibold">{currentRoom?.room_name}</h2>
          </div>
        </div>
        <div className="flex items-center space-x-2 text-muted-foreground">
          {currentRoom &&
            !currentRoom.is_ai &&
            currentRoom._id !== '685a64dcd94f6bbc0088f911' && (
              <div className="flex items-center space-x-1">
                <Users className="h-4 w-4" />
                <span className="text-sm">{currentRoom.members} members</span>
              </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 relative">
        {messages.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-xs text-muted-foreground text-center max-w-xs">
              {currentRoom?.is_ai
                ? (
                  <>
                    This feature is BETA. Please don’t violate the{' '}
                    <button
                      className="underline hover:text-primary text-xs"
                      onClick={() => setShowTos(true)}
                      type="button"
                    >
                      Terms of Service
                    </button>
                    . AI can make mistakes and may generate incorrect or inappropriate responses.
                  </>
                )
                : (
                  <>
                    Keep conversations respectful. Do not share personal information or violate the{' '}
                    <button
                      className="underline hover:text-primary text-xs"
                      onClick={() => setShowTos(true)}
                      type="button"
                    >
                      Terms of Service
                    </button>
                    .
                  </>
                )
              }
            </div>

            <Dialog open={showTos} onOpenChange={setShowTos}>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Terms of Service &amp; Privacy Policy</DialogTitle>
                  <DialogDescription>
                    <div className="text-sm mt-4 space-y-3">
                      <div>
                        <strong>Terms of Service:</strong> By using this chat, you agree to keep conversations respectful and not to share personal or sensitive information. Do not violate any applicable laws or the platform’s rules.
                      </div>
                      <div>
                        <strong>Privacy Policy:</strong> Your messages may be stored for moderation and service improvement. We do not sell your data.
                      </div>
                    </div>
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="secondary">Close</Button>
                  </DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}
        {messages.map((message) => (
          <div key={message._id} className="flex space-x-3 fade-in-message">
            <Avatar className="h-8 w-8 flex-shrink-0">
              {message.user === 'AI' ? (
                <span className="flex items-center justify-center w-full h-full bg-secondary rounded-full">
                  <Bot className="h-5 w-5 text-purple-500" />
                </span>
              ) : (
                <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${message.pfp}`} />
              )}
              {message.user !== 'AI' ? (
                <AvatarFallback className="bg-secondary text-xs">
                  {getUserInitials(message.user)}
                </AvatarFallback>
              ) : null}
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2 mb-1">
                <span className="text-sm font-medium">{message.user}</span>
                <span className="text-xs text-muted-foreground">
                  {formatTimestamp(message.timestamp)}
                </span>
              </div>
                <p className="text-sm text-foreground whitespace-normal break-words">
                  {message.message}
                </p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="border-t border-border p-4">
        <div className="flex space-x-2">
          <div className="flex-1">
            {placeholder ? (
              <Input
                key={`ai-typing-${Date.now()}`}
                placeholder={animatedPlaceholder || "Generating your response..."}
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                disabled={loading || cooldownRemaining > 0}
                className="bg-secondary border-border input-neon"
                maxLength={1500}
              />
            ) : (
              <Input
                key="normal-input"
                placeholder={`Message in ${currentRoom?.room_name || 'room'}...`}
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                disabled={loading || cooldownRemaining > 0}
                className="bg-secondary border-border"
                maxLength={1500}
              />
            )}
            <div className="flex justify-between items-center mt-1">
              <div className="text-xs text-muted-foreground">
                {messageInput.length}/1500
                {messageInput.length > 1400 && (
                  <span className="text-yellow-500 ml-2">
                    {1500 - messageInput.length} characters remaining
                  </span>
                )}
              </div>
              {cooldownRemaining > 0 && (
                <div className="text-xs text-muted-foreground">
                  Cooldown: {cooldownRemaining}s
                </div>
              )}
            </div>
          </div>
          <Button
            onClick={handleSendMessage}
            disabled={loading || cooldownRemaining > 0 || !messageInput.trim()}
            size="icon"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        
      </div>
    </div>
  );
}
