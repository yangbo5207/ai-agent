"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Bot, Brain, Coins, Command, Compass, Heart, ImageIcon, Inbox, MessagesSquare, PlugZap, Puzzle, Sparkles, UserRound } from "lucide-react"

import { useWebDashboardContext } from "@/components/web-dashboard-guard"
import { NavUser } from "./nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/ui/sidebar"

const data = {
  navMain: [
    {
      title: "Chat",
      url: "/",
      icon: Inbox,
    },
    {
      title: "Agent Groups",
      url: "/group-chats",
      icon: MessagesSquare,
    },
    {
      title: "Image Generation",
      url: "/image-generation",
      icon: ImageIcon,
    },
    {
      title: "Discover",
      url: "/discover",
      icon: Compass,
    },
    {
      title: "Create Companion",
      url: "/create-agent-companion",
      icon: Bot,
    },
    {
      title: "My Companions",
      url: "/companions",
      icon: Heart,
    },
    {
      title: "Memory",
      url: "/memories",
      icon: Brain,
    },
    {
      title: "Skills",
      url: "/skills",
      icon: Puzzle,
    },
    {
      title: "Plans",
      url: "/subscription-plans",
      icon: Sparkles,
    },
    {
      title: "Buy Tokens",
      url: "/buy-tokens",
      icon: Coins,
    },
    {
      title: "LLM Access",
      url: "/llm-access",
      icon: PlugZap,
    },
    {
      title: "Profile",
      url: "/profile",
      icon: UserRound,
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()
  const { profile } = useWebDashboardContext()

  return (
    <Sidebar
      className="!bg-[#eef0f1] [&_[data-sidebar=sidebar]]:!bg-[#eef0f1]"
      collapsible="icon"
      variant="sidebar"
      {...props}
    >
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              asChild
              className="group-data-[collapsible=icon]:h-12! group-data-[collapsible=icon]:w-8!"
            >
              <Link href="/">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-[#27353a] text-[#d7bb89]">
                  <Command className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate text-[13px] font-semibold text-[#27353a]">Companion</span>
                  <span className="truncate text-[9px] uppercase tracking-[0.16em] text-[#9a8d7e]">Companion Space</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {data.navMain.map((item) => {
                const isActive =
                  item.url === "/" ? pathname === "/" : pathname.startsWith(item.url)

                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      className="text-[13px]"
                      tooltip={{
                        children: item.title,
                        hidden: false,
                      }}
                      isActive={isActive}
                    >
                      <Link href={item.url}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <NavUser
          user={{
            name: profile.name,
            email: profile.email,
            avatarKey: profile.avatarKey,
          }}
        />
      </SidebarFooter>
    </Sidebar>
  )
}
