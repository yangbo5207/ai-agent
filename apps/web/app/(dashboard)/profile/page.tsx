"use client"

import { useState, type ChangeEvent } from "react"
import {
  BadgeCheck,
  Bell,
  Brain,
  CheckCircle2,
  Clock3,
  Heart,
  ImageUp,
  KeyRound,
  LockKeyhole,
  MessageCircle,
  Palette,
  RefreshCw,
  ShieldCheck,
  UserRound,
} from "lucide-react"
import type { UserProfileResponse } from "@repo/contracts"

import { uploadWebUserAvatar } from "@/auth/api"
import { UserAvatar } from "@/components/user-avatar"
import { useWebDashboardContext } from "@/components/web-dashboard-guard"
import { DashboardShell } from "../_components/dashboard-shell"

const preferences = [
  { label: "回复语气", value: "直接但温柔", icon: MessageCircle },
  { label: "默认节奏", value: "低压推进", icon: Heart },
  { label: "记忆策略", value: "确认后保存", icon: Brain },
  { label: "界面风格", value: "简洁克制", icon: Palette },
]

const privacyItems = [
  { label: "长期记忆", value: "开启，需确认", icon: Brain },
  { label: "角色共享", value: "仅授权伴侣", icon: LockKeyhole },
  { label: "安全边界", value: "严格模式", icon: ShieldCheck },
]

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

const dateTimeFormatter = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
})

function formatDate(value: number | null) {
  if (value === null) {
    return "暂无记录"
  }

  return dateFormatter.format(new Date(value)).replaceAll("/", ".")
}

function formatDateTime(value: number | null) {
  if (value === null) {
    return "暂无记录"
  }

  return dateTimeFormatter.format(new Date(value)).replaceAll("/", ".")
}

function formatRelativeTime(value: number | null) {
  if (value === null) {
    return "暂无记录"
  }

  const diffMs = Math.max(0, Date.now() - value)
  const minutes = Math.floor(diffMs / 60000)

  if (minutes < 1) {
    return "刚刚"
  }

  if (minutes < 60) {
    return `${minutes} 分钟前`
  }

  const hours = Math.floor(minutes / 60)

  if (hours < 24) {
    return `${hours} 小时前`
  }

  const days = Math.floor(hours / 24)

  if (days < 7) {
    return `${days} 天前`
  }

  return formatDate(value)
}

function formatStatus(status: UserProfileResponse["status"]) {
  const statusMap: Record<UserProfileResponse["status"], string> = {
    active: "正常",
    suspended: "已暂停",
    deleted: "已删除",
  }

  return statusMap[status]
}

function formatRole(role: string) {
  const roleMap: Record<string, string> = {
    web_user: "Web 用户",
    admin_user: "管理员",
    admin_owner: "Owner",
  }

  return roleMap[role] ?? role.replaceAll("_", " ")
}

export default function ProfilePage() {
  const { profile, session, refreshProfile } = useWebDashboardContext()
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [avatarUploadMessage, setAvatarUploadMessage] = useState<string | null>(null)
  const accountChecks = [
    { label: "账号资料", done: Boolean(profile.name && profile.email) },
    { label: "账号状态", done: profile.status === "active" },
    { label: "角色权限", done: profile.roles.length > 0 },
    { label: "头像形象", done: Boolean(profile.avatarKey) },
  ]
  const incompleteCount = accountChecks.filter((item) => !item.done).length

  async function handleRefreshProfile() {
    setIsRefreshing(true)

    try {
      await refreshProfile()
    } finally {
      setIsRefreshing(false)
    }
  }

  async function handleAvatarFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]

    event.currentTarget.value = ""

    if (!file) {
      return
    }

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setAvatarUploadMessage("请选择 JPG、PNG 或 WebP 图片。")
      return
    }

    if (file.size > 2 * 1024 * 1024) {
      setAvatarUploadMessage("头像文件不能超过 2MB。")
      return
    }

    setIsUploadingAvatar(true)
    setAvatarUploadMessage(null)

    try {
      await uploadWebUserAvatar(file)
      await refreshProfile()
      setAvatarUploadMessage("头像已更新。")
    } catch (error) {
      setAvatarUploadMessage(error instanceof Error ? error.message : "头像上传失败。")
    } finally {
      setIsUploadingAvatar(false)
    }
  }

  return (
    <DashboardShell
      headerRight={
        <div className="flex max-w-full flex-wrap items-center justify-end gap-2">
          <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-[#d9dfdc] bg-[#fbfaf7] px-2.5 text-[10px] font-medium text-[#53615e]">
            <BadgeCheck className="size-3 text-[#5e9679]" />
            <span className="text-[#9a8d7e]">状态</span>
            <span className="font-semibold text-[#27353a]">{formatStatus(profile.status)}</span>
          </span>
          <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-[#d9dfdc] bg-[#fbfaf7] px-2.5 text-[10px] font-medium text-[#53615e]">
            <ShieldCheck className="size-3 text-[#a37b4f]" />
            <span className="text-[#9a8d7e]">角色</span>
            <span className="font-semibold text-[#27353a]">{profile.roles.length}</span>
          </span>
          <button
            aria-label="刷新资料"
            className="flex size-7 items-center justify-center rounded-md text-[#687572] hover:bg-[#f0f2f1] hover:text-[#27353a] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isRefreshing}
            onClick={() => {
              void handleRefreshProfile()
            }}
            title={isRefreshing ? "同步中" : "刷新资料"}
            type="button"
          >
            <RefreshCw className={isRefreshing ? "size-3.5 animate-spin" : "size-3.5"} />
          </button>
        </div>
      }
      title="个人中心"
    >
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
        <section className="grid min-h-0 w-full flex-1 overflow-y-auto bg-white px-0 py-0 lg:h-full lg:overflow-hidden lg:grid-cols-[18rem_minmax(0,1fr)]">
          <aside className="min-h-0 overflow-y-auto border-b border-[#e3e6e4] bg-white lg:h-full lg:border-r lg:border-b-0">
            <section className="bg-[#fffefa] p-5">
              <div className="flex items-start gap-4">
                <UserAvatar user={profile} size="lg" />
                <div className="min-w-0 pt-1">
                  <p className="truncate text-[15px] font-semibold text-[#27353a]">{profile.name}</p>
                  <p className="mt-1 truncate text-[11px] text-[#89928f]">{profile.email}</p>
                  <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-medium text-emerald-700">
                    <BadgeCheck className="size-3.5" />
                    {formatStatus(profile.status)}
                  </span>
                </div>
              </div>

              <div className="mt-6 border-y border-[#edf0ee] py-5">
                <p className="text-[10px] font-medium text-[#929b98]">头像</p>
                <label className="mt-3 inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md border border-[#d9dfdc] px-3 text-[12px] font-medium text-[#53615e] hover:bg-[#f1f3f2]">
                  <input
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    disabled={isUploadingAvatar}
                    onChange={handleAvatarFileChange}
                    type="file"
                  />
                  <ImageUp className="size-4" />
                  {isUploadingAvatar ? "上传中" : profile.avatarKey ? "更换头像" : "上传头像"}
                </label>
                <p className="mt-2 text-[10px] leading-5 text-[#929b98]">JPG、PNG、WebP，文件不超过 2MB。</p>
                {avatarUploadMessage ? <p className="mt-2 text-[11px] leading-5 text-[#53615e]">{avatarUploadMessage}</p> : null}
              </div>

              <div className="py-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[13px] font-semibold text-[#27353a]">账户完整度</p>
                  <span className="text-[10px] text-[#929b98]">{incompleteCount === 0 ? "已完成" : `待补 ${incompleteCount} 项`}</span>
                </div>
                <div className="mt-3 grid gap-2">
                  {accountChecks.map((item) => (
                    <div className="flex items-center gap-2" key={item.label}>
                      <span className={item.done ? "text-[#5e9679]" : "text-[#c8cecb]"}>
                        <CheckCircle2 className="size-4" />
                      </span>
                      <span className="text-[12px] text-[#687572]">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-[#edf0ee] pt-5">
                <p className="flex items-center gap-2 text-[10px] text-[#929b98]"><Clock3 className="size-3.5" /> 最近同步</p>
                <p className="mt-2 text-[12px] text-[#687572]">{formatRelativeTime(profile.updatedAtMs)}</p>
              </div>
            </section>
          </aside>

          <div className="flex min-h-[40rem] min-w-0 flex-col overflow-hidden bg-[#fffefa] lg:h-full lg:min-h-0">
            <div className="flex min-h-14 shrink-0 items-center justify-between gap-3 border-b border-[#e3e6e4] bg-[#fbfaf7] px-5 py-2.5 sm:px-6">
              <div>
                <p className="flex items-center gap-2 text-[13px] font-semibold text-[#27353a]"><UserRound className="size-3.5 text-[#a37b4f]" />账户与偏好</p>
                <p className="mt-0.5 text-[10px] text-[#929b98]">资料、偏好、隐私与会话状态</p>
              </div>
              <span className="text-[10px] text-[#9a8d7e]">{formatRelativeTime(profile.updatedAtMs)}同步</span>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="mx-auto w-full max-w-[68rem]">
            <section className="border-b border-[#e3e6e4] bg-[#fffefa]" aria-labelledby="account-details-heading">
              <div className="flex items-center gap-2 border-b border-[#edf0ee] px-5 py-3.5 sm:px-6">
                <UserRound className="size-3.5 text-[#a37b4f]" />
                <h2 className="text-[13px] font-semibold text-[#27353a]" id="account-details-heading">账户资料</h2>
              </div>
              <dl className="divide-y divide-[#edf0ee] px-5 sm:px-6">
                <div className="grid gap-1 py-4 sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-center sm:gap-6">
                  <dt className="text-[12px] text-[#929b98]">登录邮箱</dt>
                  <dd className="truncate text-[13px] font-medium text-[#53615e]">{profile.email}</dd>
                </div>
                <div className="grid gap-1 py-4 sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-center sm:gap-6">
                  <dt className="text-[12px] text-[#929b98]">账户角色</dt>
                  <dd className="flex flex-wrap gap-1.5">
                    {profile.roles.map((role) => <span className="rounded-full border border-[#dfe3e1] bg-[#f6f7f5] px-2 py-1 text-[10px] font-medium text-[#687572]" key={role}>{formatRole(role)}</span>)}
                  </dd>
                </div>
                <div className="grid gap-1 py-4 sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-center sm:gap-6">
                  <dt className="text-[12px] text-[#929b98]">加入时间</dt>
                  <dd className="text-[13px] font-medium text-[#53615e]">{formatDate(profile.createdAtMs)}</dd>
                </div>
                <div className="grid gap-1 py-4 sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-center sm:gap-6">
                  <dt className="text-[12px] text-[#929b98]">用户 ID</dt>
                  <dd className="truncate text-[13px] font-medium text-[#53615e]" title={profile.id}>{profile.id}</dd>
                </div>
              </dl>
            </section>

            <div className="grid border-b border-[#e3e6e4] lg:grid-cols-2 lg:divide-x lg:divide-[#e3e6e4]">
              <section className="bg-[#fffefa]" aria-labelledby="preferences-heading">
                <div className="flex items-center gap-2 border-b border-[#edf0ee] px-5 py-3.5">
                  <MessageCircle className="size-3.5 text-[#a37b4f]" />
                  <h2 className="text-[13px] font-semibold text-[#27353a]" id="preferences-heading">聊天偏好</h2>
                </div>
                <dl className="divide-y divide-[#edf0ee] px-5">
                  {preferences.map((item) => {
                    const Icon = item.icon

                    return (
                      <div className="flex items-center gap-3 py-4" key={item.label}>
                        <Icon className="size-3.5 shrink-0 text-[#a4ada9]" />
                        <dt className="min-w-0 flex-1 text-[12px] text-[#89928f]">{item.label}</dt>
                        <dd className="text-right text-[12px] font-medium text-[#53615e]">{item.value}</dd>
                      </div>
                    )
                  })}
                </dl>
              </section>

              <section className="border-t border-[#e3e6e4] bg-[#fffefa] lg:border-t-0" aria-labelledby="privacy-heading">
                <div className="flex items-center gap-2 border-b border-[#edf0ee] px-5 py-3.5">
                  <LockKeyhole className="size-3.5 text-[#a37b4f]" />
                  <h2 className="text-[13px] font-semibold text-[#27353a]" id="privacy-heading">隐私与记忆</h2>
                </div>
                <dl className="divide-y divide-[#edf0ee] px-5">
                  {privacyItems.map((item) => {
                    const Icon = item.icon

                    return (
                      <div className="flex items-center gap-3 py-4" key={item.label}>
                        <Icon className="size-3.5 shrink-0 text-[#a4ada9]" />
                        <dt className="min-w-0 flex-1 text-[12px] text-[#89928f]">{item.label}</dt>
                        <dd className="text-right text-[12px] font-medium text-[#53615e]">{item.value}</dd>
                      </div>
                    )
                  })}
                </dl>
              </section>
            </div>

            <div className="grid border-b border-[#e3e6e4] lg:grid-cols-2 lg:divide-x lg:divide-[#e3e6e4]">
              <section className="bg-[#fffefa]" aria-labelledby="notification-heading">
                <div className="flex items-center gap-2 border-b border-[#edf0ee] px-5 py-3.5">
                  <Bell className="size-3.5 text-[#a37b4f]" />
                  <h2 className="text-[13px] font-semibold text-[#27353a]" id="notification-heading">通知状态</h2>
                </div>
                <div className="divide-y divide-[#edf0ee] px-5">
                  {["重要聊天提醒", "记忆确认提醒", "伴侣动态提醒"].map((item, index) => (
                    <div className="flex items-center justify-between gap-4 py-4" key={item}>
                      <span className="text-[12px] text-[#687572]">{item}</span>
                      <span className={index === 2 ? "rounded-full border border-[#dfe3e1] bg-[#f1f3f2] px-2 py-1 text-[10px] font-medium text-[#89928f]" : "rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-medium text-emerald-700"}>
                        {index === 2 ? "未开启" : "已开启"}
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="border-t border-[#e3e6e4] bg-[#fffefa] lg:border-t-0" aria-labelledby="security-heading">
                <div className="flex items-center gap-2 border-b border-[#edf0ee] px-5 py-3.5">
                  <KeyRound className="size-3.5 text-[#a37b4f]" />
                  <h2 className="text-[13px] font-semibold text-[#27353a]" id="security-heading">会话与安全</h2>
                </div>
                <dl className="divide-y divide-[#edf0ee] px-5">
                  <div className="py-4">
                    <dt className="text-[10px] font-medium text-[#929b98]">最近登录</dt>
                    <dd className="mt-1 text-[12px] font-medium text-[#53615e]">{formatDateTime(profile.lastLoginAtMs)}</dd>
                  </div>
                  <div className="py-4">
                    <dt className="text-[10px] font-medium text-[#929b98]">当前会话有效期</dt>
                    <dd className="mt-1 text-[12px] font-medium text-[#53615e]">{formatDateTime(session.expiresAtMs)}</dd>
                  </div>
                  <div className="py-4">
                    <dt className="text-[10px] font-medium text-[#929b98]">会话标识</dt>
                    <dd className="mt-1 text-[12px] font-medium text-[#53615e]">{session.sessionId.slice(0, 8)}</dd>
                  </div>
                </dl>
              </section>
            </div>

            <section className="bg-[#fbfaf7] px-5 py-5 sm:px-6">
              <p className="flex items-center gap-2 text-[13px] font-semibold text-[#27353a]"><ShieldCheck className="size-3.5 text-[#a37b4f]" /> 数据边界</p>
              <p className="mt-2 max-w-3xl text-[12px] leading-6 text-[#687572]">伴侣只能使用你授权的偏好、边界和已确认记忆。待确认记忆不会自动进入长期上下文。</p>
            </section>
              </div>
            </div>
          </div>
        </section>
      </main>
    </DashboardShell>
  )
}
