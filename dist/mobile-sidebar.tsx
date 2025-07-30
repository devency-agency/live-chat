"use client";

import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import { Sidebar } from "./sidebar";

interface MobileSidebarProps {
  selectedRoom: string | null;
  onRoomSelect: (roomId: string) => void;
  onSettingsClick: () => void;
}

export function MobileSidebar({ selectedRoom, onRoomSelect, onSettingsClick }: MobileSidebarProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleRoomSelect = (roomId: string) => {
    onRoomSelect(roomId);
    setIsOpen(false); // Close sidebar on mobile after selection
  };

  const handleSettingsClick = () => {
    onSettingsClick();
    setIsOpen(false);
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="p-0 w-80">
        <Sidebar
          selectedRoom={selectedRoom}
          onRoomSelect={handleRoomSelect}
          onSettingsClick={handleSettingsClick}
        />
      </SheetContent>
    </Sheet>
  );
}
