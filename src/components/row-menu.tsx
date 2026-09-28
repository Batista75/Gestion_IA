"use client";

import Link from "next/link";
import { Ellipsis } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type RowMenuItem = { label: string; href: string; download?: boolean };

export function RowMenu({ label, items, size = "icon-sm" }: { label: string; items: RowMenuItem[]; size?: "icon-sm" | "icon" }) {
  if (items.length === 0) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label={label} className={buttonVariants({ variant: "ghost", size })}>
        <Ellipsis aria-hidden="true" className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-auto min-w-44">
        {items.map((item) => (
          <DropdownMenuItem
            key={`${item.label}-${item.href}`}
            render={item.download ? <a href={item.href} download /> : <Link href={item.href} />}
          >
            {item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
