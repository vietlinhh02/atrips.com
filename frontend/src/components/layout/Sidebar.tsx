"use client";

import { useState, useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Badge } from "@/src/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/src/components/ui/avatar";
import useAuthStore from "@/src/stores/authStore";
import useSidebarStore from "@/src/stores/sidebarStore";
import { useRouter, usePathname } from "next/navigation";
import { cn } from "@/src/lib/utils";
import { getDefaultAvatarUrl } from "@/src/lib/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/src/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/src/components/ui/tooltip";
import {
  MagnifyingGlass,
  SquaresFour,
  CaretDown,
  SidebarSimple,
  ChatCircleDots,
  Compass,
  BookmarkSimple,
  Notebook,
  MapTrifold,
  Article,
  UsersThree,
  CurrencyCircleDollar,
  SignOut,
  Gear,
  CreditCard,
  Question,
  Moon,
  Sun,
  Bell as BellIcon,
  ArrowLeft,
  ClockCounterClockwise,
  Trophy,
  Confetti,
  AirplaneTilt,
} from "@phosphor-icons/react";

export default function Sidebar() {
  const [isMobile, setIsMobile] = useState(false);
  const [showRecentsView, setShowRecentsView] = useState(false);
  const prevIsMobileRef = useRef(false);
  const { resolvedTheme } = useTheme();
  const ThemeIcon = resolvedTheme === "dark" ? Moon : Sun;

  // Use Sidebar Store
  const {
    isCollapsed,
    toggleCollapse,
    setCollapsed,
    recentConversations,
    tripCount,
    unreadAssistantCount,
    showProfileView,
    setShowProfileView,
    fetchSidebarData
  } = useSidebarStore();

  const userId = useAuthStore((state) => state.user?.id);
  const user = useAuthStore((state) => state.user);
  const subscription = useAuthStore((state) => state.subscription);
  const logout = useAuthStore((state) => state.logout);
  const router = useRouter();
  const pathname = usePathname();
  const sidebarRef = useRef<HTMLDivElement>(null);
  const topSectionRef = useRef<HTMLDivElement>(null);
  const bottomSectionRef = useRef<HTMLDivElement>(null);

  // Get current conversation ID from URL
  const currentConversationId = pathname?.match(/\/chat\/([^/]+)/)?.[1] || null;

  // Detect mobile on mount and resize, and reset views on mobile→desktop transition
  useEffect(() => {
    const checkMobile = () => {
      const wasMobile = prevIsMobileRef.current;
      const nowMobile = window.innerWidth < 768;
      prevIsMobileRef.current = nowMobile;
      setIsMobile(nowMobile);

      // Reset views when transitioning FROM mobile TO desktop
      if (wasMobile && !nowMobile) {
        setShowProfileView(false);
        setShowRecentsView(false);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, [setShowProfileView]);

  // Derive effective recents view: auto-hide when sidebar is collapsed on desktop
  const effectiveShowRecentsView = (isCollapsed && !isMobile) ? false : showRecentsView;

  // Handle click outside on mobile
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Only handle on mobile (window width < 768px) and when sidebar is OPEN (!isCollapsed)
      if (window.innerWidth < 768 && !isCollapsed && sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
        setCollapsed(true);
        // Reset views when closing sidebar on mobile
        setShowRecentsView(false);
        setShowProfileView(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isCollapsed, setCollapsed, setShowProfileView]);

  // Fetch data on mount (only when userId changes, not user object reference)
  useEffect(() => {
    if (userId) {
      fetchSidebarData();
    }
  }, [userId, fetchSidebarData]);

  useEffect(() => {
    if (!recentConversations?.length) return;
    recentConversations.slice(0, 12).forEach((conversation) => {
      router.prefetch(`/chat/${conversation.id}`);
    });
  }, [recentConversations, router]);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  // Handle navigation - close sidebar, profile view, and recents view
  const handleMobileNavigation = (path: string) => {
    setShowProfileView(false);
    setShowRecentsView(false);
    if (isMobile) {
      setCollapsed(true);
    }
    if (pathname === path) {
      return;
    }
    router.push(path, { scroll: false });
  };

  const navigationItems = [
    {
      label: "Travel Assistant",
      icon: SquaresFour,
      href: "/",
      match: (p: string) => p === '/' || p.startsWith('/chat'),
      badge: unreadAssistantCount > 0 ? unreadAssistantCount.toString() : undefined
    },
    { label: "Explore", icon: Compass, href: "/explore" },
    { label: "Collections", icon: BookmarkSimple, href: "/collections" },
    { label: "Stories", icon: Notebook, href: "/stories" },
    { label: "Achievements", icon: Trophy, href: "/achievements" },
    { label: "Events", icon: Confetti, href: "/events" },
    { label: "Flights", icon: AirplaneTilt, href: "/flights" },
    {
      label: "My Trips",
      icon: MapTrifold,
      href: "/trips",
      badge: tripCount > 0 ? tripCount.toString() : undefined
    },
    { label: "Guides", icon: Article, href: "/guides" },
    { label: "Community", icon: UsersThree, href: "/community" },
    { label: "Trip Budget", icon: CurrencyCircleDollar, href: "/budget" },
  ];

  return (
    <TooltipProvider delayDuration={200}>
      <div
        ref={sidebarRef}
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex h-full flex-col justify-between border-r border-[var(--neutral-30)] bg-[var(--neutral-10)] transition-all duration-300 ease-in-out md:relative",
          isCollapsed ? "w-[60px]" : "w-[268px]",
          isCollapsed ? "-translate-x-full md:translate-x-0" : "translate-x-0",
          isCollapsed ? "p-2" : "p-3" // Smaller padding when collapsed
        )}
      >
      <div className="relative w-full h-full overflow-hidden">
        <div
          className={cn(
            "flex h-full transition-transform duration-300 ease-in-out",
            isMobile ? "w-[300%]" : "w-[200%]",
            isMobile && showProfileView ? "-translate-x-[66.666%]" :
            effectiveShowRecentsView ? (isMobile ? "-translate-x-[33.333%]" : "-translate-x-1/2") :
            "translate-x-0"
          )}
          style={{
            // Only apply will-change during transitions to improve performance
            willChange: 'transform'
          }}
        >
          {/* Main Sidebar (Left) */}
          <div className={cn("h-full flex flex-col justify-between shrink-0", isMobile ? "w-1/3" : "w-1/2")}>
            {/* Top Section - Main Sidebar */}
            <div ref={topSectionRef} className="flex flex-col gap-4 w-full shrink-0">
              {/* Logo and Menu Toggle */}
              <div className={cn("flex items-center relative", isCollapsed ? "justify-center h-12" : "justify-between h-12")}>
                {/* Logo Container with Slide Effect */}
                <div className={cn("flex items-center overflow-hidden transition-all duration-300", isCollapsed ? "w-0 opacity-0 h-0" : "w-auto opacity-100 h-auto")}>
                  <button
                    onClick={() => router.push('/')}
                    className="text-2xl font-normal text-[#073e71] font-logo whitespace-nowrap hover:opacity-80 transition-opacity bg-transparent border-none p-0 cursor-pointer"
                    aria-label="Go to home"
                  >
                    atrips.me
                  </button>
                </div>

                {/* Collapsed Logo (Center aligned) */}
                {isCollapsed && (
                  <div className="flex justify-center items-center w-full h-full">
                    <button
                      onClick={toggleCollapse}
                      className="text-2xl font-normal text-[#073e71] font-logo hover:opacity-80 transition-opacity bg-transparent border-none p-0 cursor-pointer"
                      aria-label="Expand sidebar"
                    >
                      A
                    </button>
                  </div>
                )}

                {!isCollapsed && (
                  <button
                    className="flex h-8 w-8 items-center justify-center hidden md:flex"
                    onClick={toggleCollapse}
                  >
                    <SidebarSimple className="h-5 w-5 text-neutral-600" />
                  </button>
                )}

                {/* Mobile Close Button */}
                {!isCollapsed && (
                  <button
                    className="flex h-8 w-8 items-center justify-center md:hidden absolute right-3"
                    onClick={toggleCollapse}
                  >
                    <SidebarSimple className="h-5 w-5 text-neutral-600" />
                  </button>
                )}
              </div>

              {/* CTA Buttons - Expand/Collapse Height & Opacity */}
              <div className={cn("overflow-hidden transition-all duration-300 ease-in-out", isCollapsed ? "h-0 opacity-0 mb-0" : "h-auto opacity-100")}>
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleMobileNavigation('/')}
                    className="h-8 flex-1 bg-[#073e71] text-white hover:bg-[#073e71]/90 rounded-[10px] shadow-[6px_6px_32px_0px_rgba(0,0,0,0.06)] text-[12px] py-1.5 whitespace-nowrap"
                  >
                    New Chat
                  </Button>
                  <Button
                    onClick={() => {
                      setShowRecentsView(!showRecentsView);
                      if (isMobile && !showRecentsView) setShowProfileView(false);
                    }}
                    className="h-8 w-8 p-0 bg-white border border-[#073e71] text-[#073e71] hover:bg-[#f2f8fd] rounded-[10px] shadow-[6px_6px_32px_0px_rgba(0,0,0,0.06)]"
                    title="View Recent Chats"
                  >
                    <ClockCounterClockwise className="h-4 w-4" weight="bold" />
                  </Button>
                </div>
              </div>

            </div>

            {/* Navigation Section - Scrollable */}
            <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide w-full pt-2">
              <div className="flex flex-col gap-6">
                {/* Navigation Label */}
                <div className={cn("overflow-hidden transition-all duration-300", isCollapsed ? "h-0 opacity-0" : "h-auto opacity-100")}>
                  <p className="text-xs font-medium text-neutral-500 uppercase whitespace-nowrap">
                    NAVIGATION
                  </p>
                </div>

                {/* Navigation Items */}
                <div className="flex flex-col gap-2">
                  {navigationItems.map((item, index) => {
                    const isActive = item.match
                      ? item.match(pathname || '')
                      : pathname === item.href || (pathname || '').startsWith(item.href + '/');
                    const navButton = (
                      <button
                        key={index}
                        onClick={() => handleMobileNavigation(item.href)}
                        className={cn(
                          "flex items-center rounded transition-colors relative group cursor-pointer",
                          isActive ? "bg-[#f2f8fd] border border-[#cce7e4]" : "hover:bg-neutral-50",
                          isCollapsed ? "justify-center px-0 w-9 mx-auto h-9 border-transparent bg-transparent hover:bg-neutral-100" : "px-3 py-2.5 justify-between w-full border-transparent"
                        )}
                      >
                        {/* Active background for collapsed state specific */}
                        {isCollapsed && isActive && (
                          <div className="absolute inset-0 bg-[#f2f8fd] border border-[#cce7e4] rounded opacity-100" />
                        )}

                        <div className={cn("flex items-center z-10", isCollapsed ? "gap-0" : "gap-3")}>
                          <item.icon
                            className={cn(
                              "shrink-0 transition-colors",
                              isCollapsed ? "h-4 w-4" : "h-5 w-5",
                              isActive ? "text-[#073e71]" : "text-neutral-600"
                            )}
                          />
                          <span
                            className={cn(
                              "text-[15px] whitespace-nowrap overflow-hidden transition-all duration-300",
                              isActive ? "text-[#000d26] font-medium" : "text-neutral-700",
                              isCollapsed ? "w-0 opacity-0" : "w-auto opacity-100"
                            )}
                          >
                            {item.label}
                          </span>
                        </div>

                        {/* Badge */}
                        {item.badge && (
                          <div className={cn("transition-all duration-300 overflow-hidden", isCollapsed ? "w-0 opacity-0" : "w-auto opacity-100 ml-auto")}>
                            <Badge
                              className={cn(
                                "h-5 px-1.5",
                                isActive ? "bg-[#073e71] text-white hover:bg-[#073e71]" : "bg-[#f2f8fd] text-[#073e71] hover:bg-[#f2f8fd]"
                              )}
                            >
                              {item.badge}
                            </Badge>
                          </div>
                        )}
                      </button>
                    );

                    return isCollapsed ? (
                      <Tooltip key={index}>
                        <TooltipTrigger asChild>
                          {navButton}
                        </TooltipTrigger>
                        <TooltipContent side="right" sideOffset={12}>
                          <p className="font-medium">{item.label}</p>
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      navButton
                    );
                  })}
                </div>

                {/* Divider */}
                <div className={cn("h-px bg-neutral-200 transition-all duration-300", isCollapsed ? "opacity-0" : "opacity-100")} />
              </div>
            </div>

            {/* Bottom Section */}
            <div ref={bottomSectionRef} className="flex flex-col gap-3 w-full shrink-0 bg-[var(--neutral-10)] pb-3">
              {/* User Profile or Login */}
              <div className="flex-shrink-0">
              {!user ? (
                isCollapsed ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={() => router.push('/login')}
                        className="w-full bg-[var(--primary-main)] text-white hover:bg-[var(--primary-hover)] rounded-[10px] shadow-sm transition-all duration-300 h-9 px-0"
                      >
                        <div className="flex items-center justify-center w-full">
                          <UsersThree size={16} weight="bold" className="shrink-0" />
                        </div>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right" sideOffset={12}>
                      <p className="font-medium">Login / Sign Up</p>
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <Button
                    onClick={() => router.push('/login')}
                    className="w-full bg-[var(--primary-main)] text-white hover:bg-[var(--primary-hover)] rounded-[10px] shadow-sm transition-all duration-300 h-10 px-4"
                  >
                    <div className="flex items-center justify-center w-full">
                      <UsersThree size={20} weight="bold" className="shrink-0" />
                      <span className="whitespace-nowrap ml-2">
                        Login / Sign Up
                      </span>
                    </div>
                  </Button>
                )
              ) : isMobile ? (
                // Mobile: Click to toggle profile view in sidebar
                <button
                  onClick={() => {
                    setShowProfileView(!showProfileView);
                    if (!showProfileView) setShowRecentsView(false);
                  }}
                  className={cn(
                    "flex items-center rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 transition-all duration-300",
                    isCollapsed ? "justify-center p-1.5 w-full" : "justify-between w-full gap-2 p-2"
                  )}
                >
                  <div className={cn("relative shrink-0", isCollapsed && "mx-auto")}>
                    <Avatar className={cn("shadow-[6px_6px_32px_0px_rgba(0,0,0,0.06)]", isCollapsed ? "h-7 w-7" : "h-8 w-8")}>
                      <AvatarImage
                        src={user?.avatarUrl || getDefaultAvatarUrl(user?.email, user?.name)}
                        alt="User"
                      />
                      <AvatarFallback>{(user?.name || user?.displayName)?.charAt(0) || 'U'}</AvatarFallback>
                    </Avatar>
                    <div className={cn("absolute bottom-0 right-0 rounded-full bg-green-500 border-2 border-white", isCollapsed ? "h-2 w-2" : "h-3 w-3")} />
                  </div>

                  <div className={cn("flex flex-1 items-center justify-between overflow-hidden transition-all duration-300", isCollapsed ? "w-0 opacity-0" : "w-full opacity-100")}>
                    <div className="flex flex-col items-start text-xs overflow-hidden px-2">
                      <div className="flex items-center gap-1 w-full">
                        <p className="text-neutral-900 truncate font-medium max-w-[120px]">{user?.name || user?.displayName || "User"}</p>
                        {subscription?.tier && subscription.tier !== 'FREE' && (
                          <span className="shrink-0 rounded-full bg-[var(--primary-main)] px-1.5 py-0.5 text-[10px] font-semibold text-white">
                            {subscription.tier}
                          </span>
                        )}
                      </div>
                      <p className="text-neutral-600 truncate w-full max-w-[120px]">{user?.email || ""}</p>
                    </div>
                    <CaretDown className="h-4 w-4 text-neutral-600 shrink-0" />
                  </div>
                </button>
              ) : (
                // Desktop: Show dropdown menu with tooltip on collapsed
                <DropdownMenu>
                  {isCollapsed ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <DropdownMenuTrigger asChild>
                          <button
                            className="flex items-center rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 transition-all duration-300 justify-center p-1.5 w-full"
                          >
                            <div className="relative shrink-0 mx-auto">
                              <Avatar className="shadow-[6px_6px_32px_0px_rgba(0,0,0,0.06)] h-7 w-7">
                                <AvatarImage
                                  src={user?.avatarUrl || getDefaultAvatarUrl(user?.email, user?.name)}
                                  alt="User"
                                />
                                <AvatarFallback>{(user?.name || user?.displayName)?.charAt(0) || 'U'}</AvatarFallback>
                              </Avatar>
                              <div className="absolute bottom-0 right-0 rounded-full bg-green-500 border-2 border-white h-2 w-2" />
                            </div>
                          </button>
                        </DropdownMenuTrigger>
                      </TooltipTrigger>
                      <TooltipContent side="right" sideOffset={12}>
                        <p className="font-medium">{user?.name || user?.displayName || "User"}</p>
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <DropdownMenuTrigger asChild>
                      <button
                        className="flex items-center rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 transition-all duration-300 justify-between w-full gap-2 p-2"
                      >
                        <div className="relative shrink-0">
                          <Avatar className="shadow-[6px_6px_32px_0px_rgba(0,0,0,0.06)] h-8 w-8">
                            <AvatarImage
                              src={user?.avatarUrl || getDefaultAvatarUrl(user?.email, user?.name)}
                              alt="User"
                            />
                            <AvatarFallback>{(user?.name || user?.displayName)?.charAt(0) || 'U'}</AvatarFallback>
                          </Avatar>
                          <div className="absolute bottom-0 right-0 rounded-full bg-green-500 border-2 border-white h-3 w-3" />
                        </div>

                        <div className="flex flex-1 items-center justify-between overflow-hidden transition-all duration-300 w-full opacity-100">
                          <div className="flex flex-col items-start text-xs overflow-hidden px-2">
                            <div className="flex items-center gap-1 w-full">
                              <p className="text-neutral-900 truncate font-medium max-w-[120px]">{user?.name || user?.displayName || "User"}</p>
                              {subscription?.tier && subscription.tier !== 'FREE' && (
                                <span className="shrink-0 rounded-full bg-[var(--primary-main)] px-1.5 py-0.5 text-[10px] font-semibold text-white">
                                  {subscription.tier}
                                </span>
                              )}
                            </div>
                            <p className="text-neutral-600 truncate w-full max-w-[120px]">{user?.email || ""}</p>
                          </div>
                          <CaretDown className="h-4 w-4 text-neutral-600 shrink-0" />
                        </div>
                      </button>
                    </DropdownMenuTrigger>
                  )}
                  <DropdownMenuContent
                    align="start"
                    className="w-72 p-2 max-h-[80vh] overflow-y-auto"
                    side="right"
                    sideOffset={12}
                  >
                    {/* User Info Header */}
                    <div className="px-3 py-3 mb-2">
                      <div className="flex items-center gap-3 mb-3">
                        <Avatar className="h-12 w-12 shadow-md">
                          <AvatarImage
                            src={user?.avatarUrl || getDefaultAvatarUrl(user?.email, user?.name)}
                            alt="User"
                          />
                          <AvatarFallback className="bg-[#073e71] text-white text-lg">
                            {(user?.name || user?.displayName)?.charAt(0) || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1">
                            <p className="text-sm font-semibold text-neutral-900 truncate">
                              {user?.name || user?.displayName || "User"}
                            </p>
                            {subscription?.tier && subscription.tier !== 'FREE' && (
                              <span className="shrink-0 rounded-full bg-[var(--primary-main)] px-1.5 py-0.5 text-[10px] font-semibold text-white">
                                {subscription.tier}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-neutral-500 truncate">{user?.email || ""}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => router.push('/profile')}
                        className="w-full bg-[#073e71] hover:bg-[#073e71]/90 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors"
                      >
                        View Profile
                      </button>
                    </div>

                    <DropdownMenuSeparator />

                    {/* Account Section */}
                    <div className="py-1">
                      <DropdownMenuLabel className="text-xs font-semibold text-neutral-400 uppercase px-2 py-1.5">
                        Account
                      </DropdownMenuLabel>
                      <DropdownMenuItem
                        onClick={() => router.push('/settings')}
                        className="cursor-pointer rounded-md mx-1 px-2 py-2.5 focus:bg-[#f2f8fd] focus:text-[#073e71]"
                      >
                        <Gear className="mr-3 h-4 w-4" />
                        <span className="text-sm">Settings</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => router.push('/subscription')}
                        className="cursor-pointer rounded-md mx-1 px-2 py-2.5 focus:bg-[#f2f8fd] focus:text-[#073e71]"
                      >
                        <CreditCard className="mr-3 h-4 w-4" />
                        <div className="flex flex-col items-start">
                          <span className="text-sm">Subscription</span>
                          <span className="text-xs text-neutral-500">{user?.tier || 'FREE'} Plan</span>
                        </div>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => router.push('/notifications')}
                        className="cursor-pointer rounded-md mx-1 px-2 py-2.5 focus:bg-[#f2f8fd] focus:text-[#073e71]"
                      >
                        <BellIcon className="mr-3 h-4 w-4" />
                        <span className="text-sm">Notifications</span>
                      </DropdownMenuItem>
                    </div>

                    <DropdownMenuSeparator />

                    {/* Preferences Section */}
                    <div className="py-1">
                      <DropdownMenuLabel className="text-xs font-semibold text-neutral-400 uppercase px-2 py-1.5">
                        Preferences
                      </DropdownMenuLabel>
                      <DropdownMenuItem
                        onClick={() => router.push('/appearance')}
                        className="cursor-pointer rounded-md mx-1 px-2 py-2.5 focus:bg-[#f2f8fd] focus:text-[#073e71]"
                      >
                        <ThemeIcon className="mr-3 h-4 w-4" />
                        <span className="text-sm">Appearance</span>
                      </DropdownMenuItem>
                    </div>

                    <DropdownMenuSeparator />

                    {/* Help Section */}
                    <div className="py-1">
                      <DropdownMenuItem
                        onClick={() => router.push('/help')}
                        className="cursor-pointer rounded-md mx-1 px-2 py-2.5 focus:bg-[#f2f8fd] focus:text-[#073e71]"
                      >
                        <Question className="mr-3 h-4 w-4" />
                        <span className="text-sm">Help & Support</span>
                      </DropdownMenuItem>
                    </div>

                    <DropdownMenuSeparator />

                    {/* Logout */}
                    <div className="py-1">
                      <DropdownMenuItem
                        onClick={handleLogout}
                        className="text-red-600 cursor-pointer rounded-md mx-1 px-2 py-2.5 focus:text-red-600 focus:bg-red-50"
                      >
                        <SignOut className="mr-3 h-4 w-4" />
                        <span className="text-sm font-medium">Log out</span>
                      </DropdownMenuItem>
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              </div>
            </div>
          </div>

          {/* Recents Sidebar View (Middle) */}
          <div className={cn("h-full flex flex-col justify-between shrink-0", isMobile ? "w-1/3" : "w-1/2")}>
            {/* Top Section - Recents View */}
            <div className="flex flex-col gap-4 w-full flex-1 overflow-hidden">
              {/* Back Button Header */}
              <div className="flex items-center py-2 h-12 gap-3 flex-shrink-0">
                <button
                  onClick={() => setShowRecentsView(false)}
                  className="flex h-8 w-8 items-center justify-center hover:bg-neutral-100 active:scale-95 rounded-lg transition-all duration-150"
                >
                  <ArrowLeft className="h-5 w-5 text-neutral-600" />
                </button>
                <h2 className="text-lg font-semibold text-[#073e71]">Recent Chats</h2>
              </div>

              {/* Search Input */}
              <div className="relative flex-shrink-0">
                <label htmlFor="search-conversations" className="sr-only">Search conversations</label>
                <MagnifyingGlass className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                <Input
                  id="search-conversations"
                  type="search"
                  name="search"
                  autoComplete="off"
                  placeholder="Search conversations..."
                  className="h-9 pl-8 py-1.5 border-[var(--neutral-30)] text-[14px] placeholder:text-[var(--neutral-60)]"
                />
              </div>

              {/* Recent Conversations List */}
              {recentConversations && recentConversations.length > 0 ? (
                <div className="flex flex-col gap-1 overflow-y-auto flex-1 scrollbar-hide">
                  {recentConversations.map((conversation) => {
                    const isActive = currentConversationId === conversation.id;

                    return (
                      <button
                        key={conversation.id}
                        onClick={() => {
                          if (isActive) {
                            setShowRecentsView(false);
                            if (isMobile) setCollapsed(true);
                            return;
                          }
                          handleMobileNavigation(`/chat/${conversation.id}`);
                          setShowRecentsView(false);
                        }}
                        onMouseEnter={() => router.prefetch(`/chat/${conversation.id}`)}
                        className={cn(
                          "flex items-center gap-2 rounded px-2 py-2 text-left w-full cursor-pointer transition-all",
                          isActive
                            ? "bg-[#f2f8fd] border border-[#073e71] hover:bg-[#e8f4fb]"
                            : "border border-transparent hover:bg-neutral-50"
                        )}
                      >
                        <ChatCircleDots
                          className={cn(
                            "h-4 w-4 shrink-0",
                            isActive ? "text-[#073e71]" : "text-neutral-500"
                          )}
                        />
                        <span className={cn(
                          "text-sm truncate block",
                          isActive ? "text-[#073e71] font-medium" : "text-neutral-700"
                        )}>
                          {conversation.title || 'New Conversation'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center flex-1">
                  <ChatCircleDots className="h-12 w-12 text-neutral-300 mb-3" />
                  <p className="text-sm text-neutral-500">No recent conversations</p>
                </div>
              )}
            </div>

            {/* Bottom Section - User Profile */}
            <div className="flex-shrink-0 w-full sticky bottom-0 z-20 bg-[var(--neutral-10)] pb-3">
              {!user ? (
                <Button
                  onClick={() => router.push('/login')}
                  className="w-full bg-[var(--primary-main)] text-white hover:bg-[var(--primary-hover)] rounded-[10px] shadow-sm transition-all duration-300 h-10"
                  title="Login / Sign Up"
                >
                  <div className="flex items-center justify-center w-full">
                    <UsersThree size={20} weight="bold" className="shrink-0" />
                  </div>
                </Button>
              ) : isMobile ? (
                // Mobile: Click to toggle profile view
                <button
                  onClick={() => {
                    setShowProfileView(!showProfileView);
                    if (!showProfileView) setShowRecentsView(false);
                  }}
                  className="flex items-center rounded-lg border border-neutral-200 bg-white p-2 hover:bg-neutral-50 transition-all duration-300 justify-between w-full gap-2"
                >
                  <div className="relative shrink-0">
                    <Avatar className="h-8 w-8 shadow-[6px_6px_32px_0px_rgba(0,0,0,0.06)]">
                      <AvatarImage
                        src={user?.avatarUrl || getDefaultAvatarUrl(user?.email, user?.name)}
                        alt="User"
                      />
                      <AvatarFallback>{(user?.name || user?.displayName)?.charAt(0) || 'U'}</AvatarFallback>
                    </Avatar>
                    <div className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500 border-2 border-white" />
                  </div>

                  <div className="flex flex-1 items-center justify-between overflow-hidden transition-all duration-300 w-full opacity-100">
                    <div className="flex flex-col items-start text-xs overflow-hidden px-2">
                      <p className="text-neutral-900 truncate w-full font-medium max-w-[120px]">{user?.name || user?.displayName || "User"}</p>
                      <p className="text-neutral-600 truncate w-full max-w-[120px]">{user?.email || ""}</p>
                    </div>
                    <CaretDown className="h-4 w-4 text-neutral-600 shrink-0" />
                  </div>
                </button>
              ) : (
                // Desktop: Show dropdown menu
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center rounded-lg border border-neutral-200 bg-white p-2 hover:bg-neutral-50 transition-all duration-300 justify-between w-full gap-2">
                      <div className="relative shrink-0">
                        <Avatar className="h-8 w-8 shadow-[6px_6px_32px_0px_rgba(0,0,0,0.06)]">
                          <AvatarImage
                            src={user?.avatarUrl || getDefaultAvatarUrl(user?.email, user?.name)}
                            alt="User"
                          />
                          <AvatarFallback>{(user?.name || user?.displayName)?.charAt(0) || 'U'}</AvatarFallback>
                        </Avatar>
                        <div className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500 border-2 border-white" />
                      </div>

                      <div className="flex flex-1 items-center justify-between overflow-hidden transition-all duration-300 w-full opacity-100">
                        <div className="flex flex-col items-start text-xs overflow-hidden px-2">
                          <p className="text-neutral-900 truncate w-full font-medium max-w-[120px]">{user?.name || user?.displayName || "User"}</p>
                          <p className="text-neutral-600 truncate w-full max-w-[120px]">{user?.email || ""}</p>
                        </div>
                        <CaretDown className="h-4 w-4 text-neutral-600 shrink-0" />
                      </div>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="start"
                    className="w-72 p-2 max-h-[80vh] overflow-y-auto"
                    side="right"
                    sideOffset={12}
                  >
                    {/* User Info Header */}
                    <div className="px-3 py-3 mb-2">
                      <div className="flex items-center gap-3 mb-3">
                        <Avatar className="h-12 w-12 shadow-md">
                          <AvatarImage
                            src={user?.avatarUrl || getDefaultAvatarUrl(user?.email, user?.name)}
                            alt="User"
                          />
                          <AvatarFallback className="bg-[#073e71] text-white text-lg">
                            {(user?.name || user?.displayName)?.charAt(0) || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1">
                            <p className="text-sm font-semibold text-neutral-900 truncate">
                              {user?.name || user?.displayName || "User"}
                            </p>
                            {subscription?.tier && subscription.tier !== 'FREE' && (
                              <span className="shrink-0 rounded-full bg-[var(--primary-main)] px-1.5 py-0.5 text-[10px] font-semibold text-white">
                                {subscription.tier}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-neutral-500 truncate">{user?.email || ""}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => router.push('/profile')}
                        className="w-full bg-[#073e71] hover:bg-[#073e71]/90 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors"
                      >
                        View Profile
                      </button>
                    </div>

                    <DropdownMenuSeparator />

                    {/* Account Section */}
                    <div className="py-1">
                      <DropdownMenuLabel className="text-xs font-semibold text-neutral-400 uppercase px-2 py-1.5">
                        Account
                      </DropdownMenuLabel>
                      <DropdownMenuItem
                        onClick={() => router.push('/settings')}
                        className="cursor-pointer rounded-md mx-1 px-2 py-2.5 focus:bg-[#f2f8fd] focus:text-[#073e71]"
                      >
                        <Gear className="mr-3 h-4 w-4" />
                        <span className="text-sm">Settings</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => router.push('/subscription')}
                        className="cursor-pointer rounded-md mx-1 px-2 py-2.5 focus:bg-[#f2f8fd] focus:text-[#073e71]"
                      >
                        <CreditCard className="mr-3 h-4 w-4" />
                        <div className="flex flex-col items-start">
                          <span className="text-sm">Subscription</span>
                          <span className="text-xs text-neutral-500">{user?.tier || 'FREE'} Plan</span>
                        </div>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => router.push('/notifications')}
                        className="cursor-pointer rounded-md mx-1 px-2 py-2.5 focus:bg-[#f2f8fd] focus:text-[#073e71]"
                      >
                        <BellIcon className="mr-3 h-4 w-4" />
                        <span className="text-sm">Notifications</span>
                      </DropdownMenuItem>
                    </div>

                    <DropdownMenuSeparator />

                    {/* Preferences Section */}
                    <div className="py-1">
                      <DropdownMenuLabel className="text-xs font-semibold text-neutral-400 uppercase px-2 py-1.5">
                        Preferences
                      </DropdownMenuLabel>
                      <DropdownMenuItem
                        onClick={() => router.push('/appearance')}
                        className="cursor-pointer rounded-md mx-1 px-2 py-2.5 focus:bg-[#f2f8fd] focus:text-[#073e71]"
                      >
                        <ThemeIcon className="mr-3 h-4 w-4" />
                        <span className="text-sm">Appearance</span>
                      </DropdownMenuItem>
                    </div>

                    <DropdownMenuSeparator />

                    {/* Help Section */}
                    <div className="py-1">
                      <DropdownMenuItem
                        onClick={() => router.push('/help')}
                        className="cursor-pointer rounded-md mx-1 px-2 py-2.5 focus:bg-[#f2f8fd] focus:text-[#073e71]"
                      >
                        <Question className="mr-3 h-4 w-4" />
                        <span className="text-sm">Help & Support</span>
                      </DropdownMenuItem>
                    </div>

                    <DropdownMenuSeparator />

                    {/* Logout */}
                    <div className="py-1">
                      <DropdownMenuItem
                        onClick={handleLogout}
                        className="text-red-600 cursor-pointer rounded-md mx-1 px-2 py-2.5 focus:text-red-600 focus:bg-red-50"
                      >
                        <SignOut className="mr-3 h-4 w-4" />
                        <span className="text-sm font-medium">Log out</span>
                      </DropdownMenuItem>
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>

          {/* Profile Sidebar View (Right) */}
          <div className={cn("h-full flex flex-col justify-between shrink-0", isMobile ? "w-1/3" : "hidden")}>
            {/* Top Section - Profile View */}
            <div className="flex flex-col gap-4 w-full flex-1 min-h-0 overflow-y-auto scrollbar-hide">
              {/* Back Button Header */}
              <div className="flex items-center py-2 h-12 gap-3">
                <button
                  onClick={() => setShowProfileView(false)}
                  className="flex h-8 w-8 items-center justify-center hover:bg-neutral-100 active:scale-95 rounded-lg transition-all duration-150"
                >
                  <ArrowLeft className="h-5 w-5 text-neutral-600" />
                </button>
                <h2 className="text-lg font-semibold text-[#073e71]">Account</h2>
              </div>

              {/* User Profile Card */}
              <div className="bg-gradient-to-br from-[#073e71] to-[#0a5a8a] rounded-xl p-4 text-white">
                <div className="flex items-center gap-3 mb-4">
                  <Avatar className="h-16 w-16 shadow-lg border-2 border-white">
                    <AvatarImage
                      src={user?.avatarUrl || getDefaultAvatarUrl(user?.email, user?.name)}
                      alt="User"
                    />
                    <AvatarFallback className="bg-white text-[#073e71] text-xl font-semibold">
                      {(user?.name || user?.displayName)?.charAt(0) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-semibold truncate">{user?.name || user?.displayName || "User"}</p>
                    <p className="text-sm opacity-90 truncate">{user?.email || ""}</p>
                    <div className="mt-1 inline-block px-2 py-0.5 bg-white/20 rounded-full text-xs font-medium">
                      {user?.tier || 'FREE'} Plan
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleMobileNavigation('/profile')}
                  className="w-full bg-white text-[#073e71] hover:bg-white/90 active:scale-[0.98] text-sm font-semibold py-2.5 px-4 rounded-lg transition-all duration-150"
                >
                  View Full Profile
                </button>
              </div>

              {/* Menu Items */}
              <div className="flex flex-col gap-1">
                {/* Account Section */}
                <div className="mb-2">
                  <p className="text-xs font-semibold text-neutral-400 uppercase px-2 mb-2">Account</p>

                  <button
                    onClick={() => handleMobileNavigation('/settings')}
                    className="w-full flex items-center gap-3 px-3 py-3 hover:bg-[#f2f8fd] active:scale-[0.98] rounded-lg transition-all duration-150 text-left"
                  >
                    <Gear className="h-5 w-5 text-[#073e71]" />
                    <span className="text-sm text-neutral-900">Settings</span>
                  </button>

                  <button
                    onClick={() => handleMobileNavigation('/subscription')}
                    className="w-full flex items-center gap-3 px-3 py-3 hover:bg-[#f2f8fd] active:scale-[0.98] rounded-lg transition-all duration-150 text-left"
                  >
                    <CreditCard className="h-5 w-5 text-[#073e71]" />
                    <div className="flex flex-col">
                      <span className="text-sm text-neutral-900">Subscription</span>
                      <span className="text-xs text-neutral-500">Manage your plan</span>
                    </div>
                  </button>

                  <button
                    onClick={() => handleMobileNavigation('/notifications')}
                    className="w-full flex items-center gap-3 px-3 py-3 hover:bg-[#f2f8fd] active:scale-[0.98] rounded-lg transition-all duration-150 text-left"
                  >
                    <BellIcon className="h-5 w-5 text-[#073e71]" />
                    <span className="text-sm text-neutral-900">Notifications</span>
                  </button>
                </div>

                {/* Preferences Section */}
                <div className="mb-2">
                  <p className="text-xs font-semibold text-neutral-400 uppercase px-2 mb-2">Preferences</p>

                  <button
                    onClick={() => handleMobileNavigation('/appearance')}
                    className="w-full flex items-center gap-3 px-3 py-3 hover:bg-[#f2f8fd] active:scale-[0.98] rounded-lg transition-all duration-150 text-left"
                  >
                    <ThemeIcon className="h-5 w-5 text-[#073e71]" />
                    <span className="text-sm text-neutral-900">Appearance</span>
                  </button>
                </div>

                {/* Help Section */}
                <div className="mb-2">
                  <button
                    onClick={() => handleMobileNavigation('/help')}
                    className="w-full flex items-center gap-3 px-3 py-3 hover:bg-[#f2f8fd] active:scale-[0.98] rounded-lg transition-all duration-150 text-left"
                  >
                    <Question className="h-5 w-5 text-[#073e71]" />
                    <span className="text-sm text-neutral-900">Help & Support</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Bottom Section - Logout */}
            <div className="w-full py-2">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 p-2 hover:bg-red-50 active:scale-[0.98] rounded-lg transition-all duration-150 text-left border border-red-200"
              >
                <div className="flex h-8 w-8 items-center justify-center shrink-0">
                  <SignOut className="h-5 w-5 text-red-600" />
                </div>
                <span className="text-sm font-semibold text-red-600">Log out</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
    </TooltipProvider>
  );
}
