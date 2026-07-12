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
    <DashboardShell title="个人中心">
      <main className="min-h-[calc(100vh-4rem)] bg-slate-50/70">
        <section className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-[90rem] flex-col gap-5 px-5 py-6 lg:px-8 lg:py-7 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400">ACCOUNT</p>
              <h1 className="mt-2 text-2xl font-semibold text-slate-950">个人中心</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">查看账户资料、当前偏好、隐私边界与会话状态。</p>
            </div>
            <button
              aria-label="刷新资料"
              className="flex size-9 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isRefreshing}
              onClick={() => {
                void handleRefreshProfile()
              }}
              title={isRefreshing ? "同步中" : "刷新资料"}
              type="button"
            >
              <RefreshCw className={isRefreshing ? "size-4 animate-spin" : "size-4"} />
            </button>
          </div>
        </section>

        <section className="mx-auto grid max-w-[90rem] gap-8 px-5 py-8 lg:px-8 xl:grid-cols-[18rem_minmax(0,1fr)] xl:items-start">
          <aside className="xl:sticky xl:top-20">
            <section className="border border-slate-200 bg-white p-5">
              <div className="flex items-start gap-4">
                <UserAvatar user={profile} size="lg" />
                <div className="min-w-0 pt-1">
                  <p className="truncate text-lg font-semibold text-slate-950">{profile.name}</p>
                  <p className="mt-1 truncate text-sm text-slate-500">{profile.email}</p>
                  <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700">
                    <BadgeCheck className="size-3.5" />
                    {formatStatus(profile.status)}
                  </span>
                </div>
              </div>

              <div className="mt-6 border-y border-slate-100 py-5">
                <p className="text-xs font-medium text-slate-400">头像</p>
                <label className="mt-3 inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
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
                <p className="mt-2 text-xs leading-5 text-slate-400">JPG、PNG、WebP，文件不超过 2MB。</p>
                {avatarUploadMessage ? <p className="mt-2 text-xs leading-5 text-slate-600">{avatarUploadMessage}</p> : null}
              </div>

              <div className="py-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-800">账户完整度</p>
                  <span className="text-xs text-slate-400">{incompleteCount === 0 ? "已完成" : `待补 ${incompleteCount} 项`}</span>
                </div>
                <div className="mt-3 grid gap-2">
                  {accountChecks.map((item) => (
                    <div className="flex items-center gap-2" key={item.label}>
                      <span className={item.done ? "text-emerald-600" : "text-slate-300"}>
                        <CheckCircle2 className="size-4" />
                      </span>
                      <span className="text-sm text-slate-600">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-slate-100 pt-5">
                <p className="flex items-center gap-2 text-xs text-slate-400"><Clock3 className="size-3.5" /> 最近同步</p>
                <p className="mt-2 text-sm text-slate-600">{formatRelativeTime(profile.updatedAtMs)}</p>
              </div>
            </section>
          </aside>

          <div className="min-w-0 space-y-8">
            <section className="border border-slate-200 bg-white" aria-labelledby="account-details-heading">
              <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-4 sm:px-6">
                <UserRound className="size-4 text-slate-400" />
                <h2 className="text-sm font-semibold text-slate-900" id="account-details-heading">账户资料</h2>
              </div>
              <dl className="divide-y divide-slate-100 px-5 sm:px-6">
                <div className="grid gap-1 py-4 sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-center sm:gap-6">
                  <dt className="text-sm text-slate-400">登录邮箱</dt>
                  <dd className="truncate text-sm font-medium text-slate-700">{profile.email}</dd>
                </div>
                <div className="grid gap-1 py-4 sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-center sm:gap-6">
                  <dt className="text-sm text-slate-400">账户角色</dt>
                  <dd className="flex flex-wrap gap-1.5">
                    {profile.roles.map((role) => <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600" key={role}>{formatRole(role)}</span>)}
                  </dd>
                </div>
                <div className="grid gap-1 py-4 sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-center sm:gap-6">
                  <dt className="text-sm text-slate-400">加入时间</dt>
                  <dd className="text-sm font-medium text-slate-700">{formatDate(profile.createdAtMs)}</dd>
                </div>
                <div className="grid gap-1 py-4 sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-center sm:gap-6">
                  <dt className="text-sm text-slate-400">用户 ID</dt>
                  <dd className="truncate text-sm font-medium text-slate-700" title={profile.id}>{profile.id}</dd>
                </div>
              </dl>
            </section>

            <div className="grid gap-6 lg:grid-cols-2">
              <section className="border border-slate-200 bg-white" aria-labelledby="preferences-heading">
                <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-4">
                  <MessageCircle className="size-4 text-slate-400" />
                  <h2 className="text-sm font-semibold text-slate-900" id="preferences-heading">聊天偏好</h2>
                </div>
                <dl className="divide-y divide-slate-100 px-5">
                  {preferences.map((item) => {
                    const Icon = item.icon

                    return (
                      <div className="flex items-center gap-3 py-4" key={item.label}>
                        <Icon className="size-4 shrink-0 text-slate-400" />
                        <dt className="min-w-0 flex-1 text-sm text-slate-500">{item.label}</dt>
                        <dd className="text-right text-sm font-medium text-slate-700">{item.value}</dd>
                      </div>
                    )
                  })}
                </dl>
              </section>

              <section className="border border-slate-200 bg-white" aria-labelledby="privacy-heading">
                <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-4">
                  <LockKeyhole className="size-4 text-slate-400" />
                  <h2 className="text-sm font-semibold text-slate-900" id="privacy-heading">隐私与记忆</h2>
                </div>
                <dl className="divide-y divide-slate-100 px-5">
                  {privacyItems.map((item) => {
                    const Icon = item.icon

                    return (
                      <div className="flex items-center gap-3 py-4" key={item.label}>
                        <Icon className="size-4 shrink-0 text-slate-400" />
                        <dt className="min-w-0 flex-1 text-sm text-slate-500">{item.label}</dt>
                        <dd className="text-right text-sm font-medium text-slate-700">{item.value}</dd>
                      </div>
                    )
                  })}
                </dl>
              </section>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <section className="border border-slate-200 bg-white" aria-labelledby="notification-heading">
                <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-4">
                  <Bell className="size-4 text-slate-400" />
                  <h2 className="text-sm font-semibold text-slate-900" id="notification-heading">通知状态</h2>
                </div>
                <div className="divide-y divide-slate-100 px-5">
                  {["重要聊天提醒", "记忆确认提醒", "伴侣动态提醒"].map((item, index) => (
                    <div className="flex items-center justify-between gap-4 py-4" key={item}>
                      <span className="text-sm text-slate-600">{item}</span>
                      <span className={index === 2 ? "rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-500" : "rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700"}>
                        {index === 2 ? "未开启" : "已开启"}
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="border border-slate-200 bg-white" aria-labelledby="security-heading">
                <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-4">
                  <KeyRound className="size-4 text-slate-400" />
                  <h2 className="text-sm font-semibold text-slate-900" id="security-heading">会话与安全</h2>
                </div>
                <dl className="divide-y divide-slate-100 px-5">
                  <div className="py-4">
                    <dt className="text-xs font-medium text-slate-400">最近登录</dt>
                    <dd className="mt-1 text-sm font-medium text-slate-700">{formatDateTime(profile.lastLoginAtMs)}</dd>
                  </div>
                  <div className="py-4">
                    <dt className="text-xs font-medium text-slate-400">当前会话有效期</dt>
                    <dd className="mt-1 text-sm font-medium text-slate-700">{formatDateTime(session.expiresAtMs)}</dd>
                  </div>
                  <div className="py-4">
                    <dt className="text-xs font-medium text-slate-400">会话标识</dt>
                    <dd className="mt-1 text-sm font-medium text-slate-700">{session.sessionId.slice(0, 8)}</dd>
                  </div>
                </dl>
              </section>
            </div>

            <section className="border border-slate-200 bg-white px-5 py-5 sm:px-6">
              <p className="flex items-center gap-2 text-sm font-semibold text-slate-900"><ShieldCheck className="size-4 text-slate-400" /> 数据边界</p>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">伴侣只能使用你授权的偏好、边界和已确认记忆。待确认记忆不会自动进入长期上下文。</p>
            </section>
          </div>
        </section>
      </main>
    </DashboardShell>
  )
}
