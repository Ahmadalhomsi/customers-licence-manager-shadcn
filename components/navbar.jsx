"use client"

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeSwitch } from "@/components/theme-switch";
import { Menu, Briefcase, Archive, LogOut, User, Users, FileText, Package, LayoutDashboard } from "lucide-react";
import { BadgeNotification } from "@/components/BadgeNotification";
import { authManager } from "@/lib/auth";
import { simpleAuthenticatedGet } from "@/lib/simple-auth";

export function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  // The assistant connection page (/oauth/authorize) is a standalone sign-in screen like /login
  const isLoginPage = pathname === "/login" || pathname.startsWith("/oauth");
  const [notifications, setNotifications] = useState([]);
  const [adminName, setAdminName] = useState("");
  const [permissions, setPermissions] = useState(null);
  const [error, setError] = useState(null);

  const handleLogout = async () => {
    try {
      const res = await fetch("/api/logout");
      if (res.ok) {
        authManager.clearTokens();
        router.push("/login");
      } else {
        console.error("Logout failed:", await res.text());
      }
    } catch (error) {
      console.error("Logout error:", error);
      // Even if logout fails, clear tokens and redirect
      authManager.clearTokens();
      router.push("/login");
    }
  };

  useEffect(() => {
    const fetchAdminData = async () => {
      if (isLoginPage) return;

      try {
        setError(null);
        console.log("[Navbar] Fetching admin data...");

        const data = await simpleAuthenticatedGet("/api/auth/me");
        console.log("[Navbar] Admin data fetched successfully:", data);

        setAdminName(data.name || "");
        setPermissions(data.permissions || null);

      } catch (error) {
        console.error("[Navbar] Error fetching admin data:", error);

        // Don't show error for authentication issues - let auth manager handle
        if (error.message === 'Authentication required') {
          // Clear any existing state when authentication fails
          setAdminName("");
          setPermissions(null);
          return;
        }

        // For other errors, just log them but don't show to user in the navbar
        console.log("[Navbar] Non-auth error:", error.message);
      }
    };

    fetchAdminData();
  }, [pathname, isLoginPage]);

  if (isLoginPage) return null;

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center justify-between px-4 w-full">
        {/* Left Section */}
        <div className="flex items-center">
          <Link href="/" className="flex items-center gap-2 font-bold">
            <Image
              src="/MAPOS_LOGO.png"
              alt="MAPOS Logo"
              width={32}
              height={32}
              className="rounded-lg"
            />
            <span className="text-primary">MAPOS</span>
          </Link>
          {error && <div className="ml-4 text-xs text-destructive">{error}</div>}
        </div>

        {/* Middle Section (Links for Desktop) */}
        <div className="hidden md:flex items-center gap-6">
          <Link
            href="/"
            className={`flex items-center text-sm font-medium ${pathname === "/" ? "text-primary" : "text-muted-foreground hover:text-primary"}`}
          >
            <LayoutDashboard className="mr-2 h-4 w-4" />
            Dashboard
          </Link>

          {permissions?.canViewCustomers && (
            <Link
              href="/customers"
              className={`flex items-center text-sm font-medium ${pathname === "/customers" ? "text-primary" : "text-muted-foreground hover:text-primary"}`}
            >
              <Users className="mr-2 h-4 w-4" />
              Müşteriler
            </Link>
          )}

          {permissions?.canViewServices && (
            <>
              <Link
                href="/services"
                className={`flex items-center text-sm font-medium ${pathname === "/services" ? "text-primary" : "text-muted-foreground hover:text-primary"}`}
              >
                <Briefcase className="mr-2 h-4 w-4" />
                Hizmetler
              </Link>
              <Link
                href="/services/archive"
                className={`flex items-center text-sm font-medium ${pathname === "/services/archive" ? "text-primary" : "text-muted-foreground hover:text-primary"}`}
              >
                <Archive className="mr-2 h-4 w-4" />
                Arşiv
              </Link>
            </>
          )}


          <Link
            href="/products"
            className={`flex items-center text-sm font-medium ${pathname.startsWith("/products") ? "text-primary" : "text-muted-foreground hover:text-primary"}`}
          >
            <Package className="mr-2 h-4 w-4" />
            Fiziksel Ürünler
          </Link>


          <Link
            href="/log"
            className={`flex items-center text-sm font-medium ${pathname.startsWith("/log") ? "text-primary" : "text-muted-foreground hover:text-primary"}`}
          >
            <FileText className="mr-2 h-4 w-4" />
            Müşteri Hareketleri
          </Link>

          {permissions?.canViewAdmins && (
            <Link
              href="/admins"
              className={`flex items-center text-sm font-medium ${pathname.startsWith("/admins") ? "text-primary" : "text-muted-foreground hover:text-primary"}`}
            >
              <User className="mr-2 h-4 w-4" />
              Users
            </Link>
          )}
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-4">
          <BadgeNotification
            initialNotifications={notifications}
            onNotificationsChange={setNotifications}
          />
          <ThemeSwitch />

          {/* Show Admin Name */}
          {adminName && (
            <span className="text-sm font-medium text-primary">{adminName}</span>
          )}

          {/* Dropdown for Mobile */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild className={pathname === "/" ? "text-primary" : ""}>
                <Link href="/">
                  <LayoutDashboard className="mr-2 h-4 w-4" />
                  Dashboard
                </Link>
              </DropdownMenuItem>

              {permissions?.canViewCustomers && (
                <DropdownMenuItem asChild className={pathname === "/customers" ? "text-primary" : ""}>
                  <Link href="/customers">
                    <Users className="mr-2 h-4 w-4" />
                    Müşteriler
                  </Link>
                </DropdownMenuItem>
              )}

              {permissions?.canViewServices && (
                <DropdownMenuItem asChild className={pathname === "/services" ? "text-primary" : ""}>
                  <Link href="/services">
                    <Briefcase className="mr-2 h-4 w-4" />
                    Hizmetler
                  </Link>
                </DropdownMenuItem>
              )}

              {permissions?.canViewServices && (
                <DropdownMenuItem asChild className={pathname === "/services/archive" ? "text-primary" : ""}>
                  <Link href="/services/archive">
                    <Archive className="mr-2 h-4 w-4" />
                    Arşiv
                  </Link>
                </DropdownMenuItem>
              )}

              {permissions?.canViewPhysicalProducts && (
                <DropdownMenuItem asChild className={pathname.startsWith("/products") ? "text-primary" : ""}>
                  <Link href="/products">
                    <Package className="mr-2 h-4 w-4" />
                    Fiziksel Ürünler
                  </Link>
                </DropdownMenuItem>
              )}

              <DropdownMenuItem asChild className={pathname.startsWith("/log") ? "text-primary" : ""}>
                <Link href="/log">
                  <FileText className="mr-2 h-4 w-4" />
                  Müşteri Hareketleri
                </Link>
              </DropdownMenuItem>

              {permissions?.canViewAdmins && (
                <DropdownMenuItem asChild className={pathname.startsWith("/admins") ? "text-primary" : ""}>
                  <Link href="/admins">
                    <User className="mr-2 h-4 w-4" />
                    Admin
                  </Link>
                </DropdownMenuItem>
              )}

              <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Logout Button for Desktop */}
          <Button variant="destructive" size="sm" className="hidden md:flex" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>
      </div>
    </nav>
  );
}