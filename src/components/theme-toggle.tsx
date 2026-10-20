"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Change theme">
          <Sun className="scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
          <Moon className="absolute scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-36">
        <DropdownMenuCheckItem checked={theme === "light"} onSelect={() => setTheme("light")}>
          <Sun /> Light
        </DropdownMenuCheckItem>
        <DropdownMenuCheckItem checked={theme === "dark"} onSelect={() => setTheme("dark")}>
          <Moon /> Dark
        </DropdownMenuCheckItem>
        <DropdownMenuCheckItem checked={theme === "system"} onSelect={() => setTheme("system")}>
          <Monitor /> System
        </DropdownMenuCheckItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
