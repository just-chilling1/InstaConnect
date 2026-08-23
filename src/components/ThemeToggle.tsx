"use client";

import { useTheme } from "next-themes";
import { IconSun, IconMoon, IconDeviceDesktop, IconCheck } from "@tabler/icons-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

const OPTIONS = [
  { value: "light", label: "Light", Icon: IconSun },
  { value: "dark", label: "Dark", Icon: IconMoon },
  { value: "system", label: "System", Icon: IconDeviceDesktop },
] as const;

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  // next-themes reports `theme` as undefined until it has read the
  // persisted/system preference on the client. Rendering a neutral
  // placeholder until then avoids a server/client markup mismatch --
  // without needing a `useEffect` + setState "mounted" flag.
  if (theme === undefined) {
    return <div className="w-10 h-10" aria-hidden="true" />;
  }

  const current = OPTIONS.find((o) => o.value === theme) ?? OPTIONS[2];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex items-center justify-center w-10 h-10 rounded-lg text-text-muted hover:bg-surface-2 hover:text-text transition-colors"
          aria-label="Change theme"
        >
          <current.Icon size={20} />
        </button>
      </DropdownMenuTrigger>

      {/*
        Root cause of the clipped menu: the old version always opened
        downward and anchored to its own right edge, which assumed there
        was room both below and to the left of the trigger. Neither is true
        for this button -- it sits in the bottom-left corner of the
        sidebar. `side="top"` opens it upward (away from the bottom edge),
        and `align="start"` anchors it to the trigger's *left* edge so it
        extends rightward, into the page, instead of further left, off the
        screen. Radix still measures the real viewport on every open and
        flips both of these automatically if the trigger ever ends up
        somewhere those defaults don't fit (e.g. the same button rendered
        higher up on a very short viewport), so it stays fully on-screen
        wherever it's placed -- including inside the mobile menu.
      */}
      <DropdownMenuContent side="top" align="start">
        {OPTIONS.map((option) => (
          <DropdownMenuItem
            key={option.value}
            active={theme === option.value}
            onSelect={() => setTheme(option.value)}
          >
            <option.Icon size={16} />
            <span className="flex-1">{option.label}</span>
            {theme === option.value && <IconCheck size={14} />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
