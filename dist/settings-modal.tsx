"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { User, Mail, Image, Lock, Pencil } from "lucide-react";
import { notify } from "@/lib/notifications";
import { api, ApiError } from "@/lib/api";
import { error } from "console";

interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [user, setUser] = useState<User | null>(null);
  const [name, setName] = useState("");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [email, setEmail] = useState("");
  const [avatar, setAvatar] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailEditable, setEmailEditable] = useState(false);
  const [passwordEditable, setPasswordEditable] = useState(false);
  const [initialState, setInitialState] = useState({
    name: "",
    email: "",
    avatar: "default",
  });
  const [avatarChanged, setAvatarChanged] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const userData = localStorage.getItem('user');
      if (userData) {
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);
        setName(parsedUser.name || '');
        setEmail(parsedUser.email || '');
        setAvatar(parsedUser.avatar || 'default');
        setInitialState({
          name: parsedUser.name || '',
          email: parsedUser.email || '',
          avatar: parsedUser.avatar || 'default',
        });
        setEmailEditable(false);
        setPasswordEditable(false);
        setOldPassword("");
        setNewPassword("");
        setAvatarChanged(false);
      }
    }
  }, [isOpen]);

  const handleSave = async () => {
    setLoading(true);

    if (passwordEditable && oldPassword == newPassword) {
      notify.error("Old password should not match new password.");
      setLoading(false);
      return;
    }

    setTimeout(async () => {
      try {
        const response = await api.put('/api/users', {
          email: emailEditable ? email : null,
          old_password: passwordEditable ? oldPassword : null,
          new_password: passwordEditable ? newPassword : null,
          pfp: avatarChanged ? avatar : null,
        });

        if (response.success) {
          notify.success('Settings updated successfully!');
          const updatedUser = {
            ...user,
            name,
            email,
            avatar: avatar,
          };
    
          localStorage.setItem('user', JSON.stringify(updatedUser));
          setLoading(false);
          onClose();
          window.location.reload();
        } else {
          notify.error(response.error || 'Failed to update user settings');
          setLoading(false);
          onClose();
        }
      } catch (error) {
        notify.error('Failed to update user settings');
      }
    }, 1000);
  };

  const getUserInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const generateSeed = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let seed = "";
    for (let i = 0; i < 16; i++) {
      seed += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return seed;
  };
  
  const generateNewAvatar = () => {
    const seed = generateSeed();
    setAvatar(seed);
    setAvatarChanged(true);
  };

  const hasChanges =
    name !== initialState.name ||
    email !== initialState.email ||
    avatar !== initialState.avatar ||
    avatarChanged ||
    (passwordEditable && oldPassword && newPassword);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xs bg-card border-border text-foreground p-4">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Settings for {name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {/* Avatar Section */}
          <div className="flex flex-col items-center space-y-2">
            <Avatar className="h-14 w-14">
              <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${avatar}`} />
              <AvatarFallback className="bg-secondary text-base">
                {name ? getUserInitials(name) : 'U'}
              </AvatarFallback>
            </Avatar>
            <Button
              variant="outline"
              size="sm"
              onClick={generateNewAvatar}
              className="text-xs"
            >
              <Image className="mr-2 h-3 w-3" />
              Generate New Avatar
            </Button>
          </div>

          {/* Form Fields */}
          <div className="space-y-2">

            {/* Email Field */}
            <div className="space-y-2 relative">
              <Label htmlFor="email" className="text-sm font-medium">
                <Mail className="inline mr-2 h-4 w-4" />
                Email Address
              </Label>
              <div className="relative">
                <Input
                  id="email"
                  type="email"
                  placeholder="your.email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-secondary border-border pr-9" // add padding for icon
                  disabled={!emailEditable}
                  autoComplete="off"
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted transition"
                  onClick={() => setEmailEditable((v) => !v)}
                  tabIndex={-1}
                  aria-label="Edit Email"
                >
                  <Pencil className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-2 relative">
              <Label htmlFor="password" className="text-sm font-medium">
                <Lock className="inline mr-2 h-4 w-4" />
                Password
              </Label>
              <div className="relative">
                <Input
                  id="oldPassword"
                  type="password"
                  placeholder="Your old password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  className="bg-secondary border-border pr-9"
                  disabled={!passwordEditable}
                  autoComplete="off"
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted transition"
                  onClick={() => setPasswordEditable((v) => !v)}
                  tabIndex={-1}
                  aria-label="Edit Password"
                >
                  <Pencil className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
              <div className="flex items-center mt-2">
                <Input
                  id="newPassword"
                  type="password"
                  placeholder="Your new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="bg-secondary border-border flex-1"
                  disabled={!passwordEditable}
                  autoComplete="off"
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-2 pt-2">
            <Button
              onClick={handleSave}
              disabled={loading || !hasChanges || !name.trim() || !email.trim()}
              className={`flex-1 ${(!hasChanges || loading) ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
            <Button
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
