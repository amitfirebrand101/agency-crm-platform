"use client";

import {
  Columns2,
  FormInput,
  Grid3x3,
  Image as ImageIcon,
  Megaphone,
  Minus,
  MousePointerClick,
  MoveVertical,
  PanelBottom,
  Quote,
  Square,
  Type,
  type LucideIcon,
} from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  Megaphone,
  Type,
  Image: ImageIcon,
  MousePointerClick,
  Columns2,
  Grid3x3,
  Quote,
  FormInput,
  MoveVertical,
  Minus,
  PanelBottom,
};

export function BlockIcon({ name, size = 16, className }: { name: string; size?: number; className?: string }) {
  const Icon = ICON_MAP[name] ?? Square;
  return <Icon size={size} className={className} />;
}
