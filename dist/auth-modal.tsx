"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { notify } from "@/lib/notifications";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [isAnimating, setIsAnimating] = useState(false);
  const [loading, setLoading] = useState(false);

  // Login form state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Register form state
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState("");
  const [registerName, setRegisterName] = useState("");

  const switchMode = () => {
    setIsAnimating(true);
    setTimeout(() => {
      setIsLogin(!isLogin);
      setIsAnimating(false);
    }, 150);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    setTimeout(async () => {
      if (loginEmail && loginPassword) {
        const token_response = await api.post<{ access_token: string }>('/api/auth/login', {
          email: loginEmail,
          password: loginPassword,
        });
        if (!token_response.success || !token_response.data) {
          notify.error(token_response.error || "Login failed");
          setLoading(false);
          return;
        }
        const token = token_response.data.access_token;

        const user_response = await api.get<{
          user: {
            _id: string;
            username: string;
            email: string;
            profile_picture: string;
            ai_room?: string;
          }
        }>('/api/users', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          requireAuth: false,
        });
        if (!user_response.success || !user_response.data) {
          notify.error(user_response.error || 'Failed to fetch user data');
          setLoading(false);
          return;
        }
        const user = {
          id: user_response.data.user._id,
          name: user_response.data.user.username,
          email: user_response.data.user.email,
          avatar: user_response.data.user.profile_picture,
          ai_room: user_response.data.user.ai_room
        };

        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
        notify.success('Login successful!');
        onClose();
        window.location.reload();
      } else {
        notify.error('Please enter email and password');
      }
      setLoading(false);
    }, 1000);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (registerPassword !== registerConfirmPassword) {
      notify.error('Passwords do not match');
      return;
    }

    setLoading(true);

    setTimeout(async () => {
      const token_response = await api.post<{ access_token: string }>('/api/auth/register', {
        email: registerEmail,
        username: registerName,
        password: registerPassword,
      });
      if (!token_response.success || !token_response.data) {
        notify.error(token_response.error || 'Failed to register');
        setLoading(false);
        return;
      }
      const token = token_response.data.access_token;

      const user_response = await api.get<{
        user: {
          _id: string;
          username: string;
          email: string;
          profile_picture: string;
          ai_room?: string;
        }
      }>('/api/users', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        requireAuth: false,
      });
      if (!user_response.success || !user_response.data) {
        notify.error(user_response.error || 'Failed to fetch user data');
        setLoading(false);
        return;
      }
      const user = {
        id: user_response.data.user._id,
        name: user_response.data.user.username,
        email: user_response.data.user.email,
        avatar: user_response.data.user.profile_picture,
        ai_room: user_response.data.user.ai_room
      };

      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      notify.success('Registration successful!');
      onClose();
      window.location.reload();
      setLoading(false);
    }, 1000);
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md bg-card border-border text-foreground">
        <DialogHeader>
          <DialogTitle className="sr-only">Authentication</DialogTitle>
        </DialogHeader>
        <div className="relative overflow-hidden">
          {/* Login Form */}
          <div
            className={`transition-all duration-300 ease-in-out ${
              isLogin && !isAnimating
                ? 'opacity-100 transform translate-x-0'
                : 'opacity-0 transform -translate-x-full absolute inset-0'
            }`}
          >
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold">Welcome back</h2>
              <p className="text-muted-foreground mt-2">Sign in to your account</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <Input
                  type="email"
                  placeholder="Email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  required
                  className="bg-secondary border-border"
                />
              </div>
              <div>
                <Input
                  type="password"
                  placeholder="Password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                  className="bg-secondary border-border"
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={loading}
              >
                {loading ? 'Signing in...' : 'Sign in'}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-muted-foreground">
                New here?{' '}
                <button
                  type="button"
                  onClick={switchMode}
                  className="text-primary hover:underline"
                  disabled={loading}
                >
                  Register here
                </button>
              </p>
            </div>
          </div>

          {/* Register Form */}
          <div
            className={`transition-all duration-300 ease-in-out ${
              !isLogin && !isAnimating
                ? 'opacity-100 transform translate-x-0'
                : 'opacity-0 transform translate-x-full absolute inset-0'
            }`}
          >
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold">Create account</h2>
              <p className="text-muted-foreground mt-2">Join our community today</p>
            </div>

            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <Input
                  type="text"
                  placeholder="Username"
                  value={registerName}
                  onChange={(e) => setRegisterName(e.target.value)}
                  required
                  className="bg-secondary border-border"
                />
              </div>
              <div>
                <Input
                  type="email"
                  placeholder="Email"
                  value={registerEmail}
                  onChange={(e) => setRegisterEmail(e.target.value)}
                  required
                  className="bg-secondary border-border"
                />
              </div>
              <div>
                <Input
                  type="password"
                  placeholder="Password"
                  value={registerPassword}
                  onChange={(e) => setRegisterPassword(e.target.value)}
                  required
                  className="bg-secondary border-border"
                />
              </div>
              <div>
                <Input
                  type="password"
                  placeholder="Confirm password"
                  value={registerConfirmPassword}
                  onChange={(e) => setRegisterConfirmPassword(e.target.value)}
                  required
                  className="bg-secondary border-border"
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={loading}
              >
                {loading ? 'Creating account...' : 'Create account'}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-muted-foreground">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={switchMode}
                  className="text-primary hover:underline"
                  disabled={loading}
                >
                  Sign in here
                </button>
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
