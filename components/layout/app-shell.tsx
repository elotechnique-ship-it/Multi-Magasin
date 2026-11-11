"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BarChart3, Boxes, ClipboardList, CreditCard, LayoutDashboard, LifeBuoy, LogOut, Megaphone, Menu, Package,
  Receipt, Settings, ShoppingBag, ShoppingCart, Store, Tags, Truck, UserCog, Users, Wallet, X,
  type LucideIcon,
} from "lucide-react";
import type { IconName, MenuEntry } from "@/lib/modules/types";
import { signOut } from "@/lib/auth/actions";
import { fr } from "@/lib/i18n/fr";
import { cn } from "@/lib/utils/cn";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const ICONS: Record<IconName, LucideIcon> = {
  "layout-dashboard": LayoutDashboard, "shopping-cart": ShoppingCart, package: Package, boxes: Boxes, receipt: Receipt,
  users: Users, truck: Truck, "clipboard-list": ClipboardList, wallet: Wallet, "shopping-bag": ShoppingBag,
  megaphone: Megaphone, "user-cog": UserCog, settings: Settings, store: Store, tags: Tags, "credit-card": CreditCard,
  "life-buoy": LifeBuoy, "bar-chart": BarChart3,
};

export interface AppShellProps {
  title: string;
  area: string;
  basePath: string;
  menu: MenuEntry[];
  userEmail: string;
  banner?: string;
  children: React.ReactNode;
}

export function AppShell({ title, area, basePath, menu, userEmail, banner, children }: AppShellProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const nav = (
    <nav aria-label="Navigation principale" className="flex flex-col gap-1 p-3">
      {menu.map((item) => {
        const Icon = ICONS[item.icon];
        const href = item.href ? `${basePath}/${item.href}` : basePath;
        const active = item.href ? pathname.startsWith(href) : pathname === basePath;
        const base = "flex min-h-11 items-center gap-3 rounded-md px-3 text-sm";
        if (!item.enabled) {
          return (
            <span key={item.id} aria-disabled="true" className={cn(base, "cursor-not-allowed text-[var(--sidebar-foreground)] opacity-60")}>
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="flex-1">{item.label}</span>
              <Badge tone="neutral" className="text-[10px]">{fr.shell.soon}</Badge>
            </span>
          );
        }
        return (
          <Link
            key={item.id}
            href={href}
            onClick={() => setOpen(false)}
            aria-current={active ? "page" : undefined}
            className={cn(base, "text-[var(--sidebar-foreground)] hover:bg-white/10", active && "border-l-4 border-primary-accent bg-white/10 font-semibold")}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-screen">
      {/* Barre latérale : fixe sur ordinateur, tiroir sur mobile */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 transform overflow-y-auto bg-navy transition-transform md:static md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 items-center justify-between px-5">
          <span className="truncate text-base font-semibold text-white">{title}</span>
          <button className="md:hidden text-white" onClick={() => setOpen(false)} aria-label="Fermer le menu">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        {nav}
      </aside>
      {open ? <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={() => setOpen(false)} aria-hidden="true" /> : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-surface px-4">
          <button className="md:hidden min-h-11 min-w-11" onClick={() => setOpen(true)} aria-label="Ouvrir le menu">
            <Menu className="mx-auto h-5 w-5" aria-hidden="true" />
          </button>
          <span className="text-sm font-medium text-muted-foreground">{area}</span>
          <div className="ml-auto flex items-center gap-3">
            <input
              type="search"
              disabled
              aria-label={fr.shell.search}
              placeholder={fr.shell.search}
              className="hidden min-h-11 w-64 rounded-md border border-border bg-muted px-3 text-sm md:block"
            />
            <span className="hidden max-w-[14rem] truncate text-sm text-muted-foreground sm:block">{userEmail}</span>
            <form action={signOut}>
              <Button type="submit" variant="ghost" size="md" aria-label={fr.auth.logout}>
                <LogOut className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">{fr.auth.logout}</span>
              </Button>
            </form>
          </div>
        </header>
        {banner ? (
          <div role="status" className="bg-accent px-4 py-2 text-sm font-medium text-accent-foreground">{banner}</div>
        ) : null}
        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
