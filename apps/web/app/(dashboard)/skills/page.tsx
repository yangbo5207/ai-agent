"use client"

import { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type {
  CompanionSkillBindingSource,
  CompanionSkillBindingTarget,
  CompanionSkillCatalogItem,
  CompanionSkillPermissionCode,
} from "@repo/contracts"
import {
  Activity,
  BellRing,
  Bot,
  CalendarClock,
  CheckCircle2,
  CircleSlash2,
  Ear,
  ListChecks,
  LockKeyhole,
  Puzzle,
  RefreshCcw,
  Scale,
  Search,
  ShieldCheck,
  Target,
  UsersRound,
  X,
} from "lucide-react"

import { DashboardShell } from "../_components/dashboard-shell"
import {
  getAgentGroupChats,
  getCompanionSkillCatalog,
  getCompanionSkillEvaluationSummary,
  getCompanionSkillRuns,
  getCompanionSkillSessions,
  getMyAgentInbox,
  updateCompanionSkillBinding,
  cancelCompanionSkillSession,
  cancelCompanionSkillBackgroundJob,
  createCompanionSkillBackgroundJob,
  getCompanionSkillBackgroundJobs,
  getCompanionSkillPermissionGrants,
  updateCompanionSkillPermissionGrant,
} from "@/auth/api"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@repo/ui/switch"
import { Badge } from "@repo/ui/badge"
import { Button } from "@repo/ui/button"
import { Input } from "@repo/ui/input"

const skillIcons = {
  "active-listening": Ear,
  "decision-clarifier": Scale,
  "goal-breakdown": ListChecks,
  "group-roundtable": UsersRound,
  "long-term-goal-planning": Target,
  "memory-recall": Search,
  "goal-check-in-reminder": BellRing,
} as const

const sourceLabels: Record<CompanionSkillBindingSource, string> = {
  default: "系统默认",
  user: "全局设置",
  agent: "Agent 设置",
  group: "群聊设置",
  conversation: "会话设置",
}

const scopeLabels = {
  single_chat: "单聊",
  group_chat: "群聊",
  background: "后台",
} as const

const permissionRows: Array<{
  skillId: string
  permissionCode: CompanionSkillPermissionCode
  name: string
  detail: string
  risk: string
  icon: typeof Search
}> = [
  {
    skillId: "memory-recall",
    permissionCode: "memory:read",
    name: "读取 Agent 记忆",
    detail: "允许记忆检索 Skill 读取当前 Agent 已保存的长期记忆。",
    risk: "L1 · 只读",
    icon: Search,
  },
  {
    skillId: "goal-check-in-reminder",
    permissionCode: "proactive_message:write",
    name: "发送主动提醒",
    detail: "允许已安排的后台任务向你的 Agent 会话写入一条复盘提醒。",
    risk: "L2 · 写入",
    icon: BellRing,
  },
]

const backgroundStatusLabels = {
  scheduled: "等待执行",
  running: "正在执行",
  retrying: "等待重试",
  completed: "已完成",
  failed: "失败",
  cancelled: "已取消",
} as const

type ScopeOption = {
  value: string
  label: string
  detail: string
  target: CompanionSkillBindingTarget
}

function formatRunTime(value: number) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

function minimumLocalScheduleTime() {
  const value = new Date(Date.now() + 60_000)
  value.setMinutes(value.getMinutes() - value.getTimezoneOffset())
  return value.toISOString().slice(0, 16)
}

function SkillItem({
  item,
  pending,
  onChange,
  onReset,
}: {
  item: CompanionSkillCatalogItem
  pending: boolean
  onChange: (enabled: boolean) => void
  onReset: () => void
}) {
  const Icon = skillIcons[item.manifest.id as keyof typeof skillIcons] ?? Puzzle

  return (
    <article className="border border-slate-200 bg-white p-5 shadow-sm shadow-slate-950/[0.02] sm:p-6">
      <div className="flex items-start gap-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600">
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h2 className="text-base font-semibold text-slate-950">{item.manifest.name}</h2>
            <span className="font-mono text-[11px] text-slate-400">v{item.manifest.version}</span>
            {item.manifest.kind === "workflow" ? (
              <Badge className="rounded-md border-amber-200 bg-amber-50 text-amber-700" variant="outline">
                多轮 Workflow
              </Badge>
            ) : item.manifest.kind === "tool" ? (
              <Badge className="rounded-md border-sky-200 bg-sky-50 text-sky-700" variant="outline">
                受控工具
              </Badge>
            ) : item.manifest.kind === "background" ? (
              <Badge className="rounded-md border-violet-200 bg-violet-50 text-violet-700" variant="outline">
                后台任务
              </Badge>
            ) : null}
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{item.manifest.description}</p>
        </div>
        <Switch
          aria-label={`${item.effectiveEnabled ? "停用" : "启用"}${item.manifest.name}`}
          checked={item.effectiveEnabled}
          disabled={pending}
          onCheckedChange={onChange}
        />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
        {item.manifest.scopes.map((scope) => (
          <Badge className="rounded-md border-slate-200 bg-white text-slate-500" key={scope} variant="outline">
            {scopeLabels[scope]}
          </Badge>
        ))}
        <Badge
          className={item.effectiveEnabled
            ? "rounded-md border-emerald-200 bg-emerald-50 text-emerald-700"
            : "rounded-md border-slate-200 bg-slate-50 text-slate-500"}
          variant="outline"
        >
          {item.effectiveEnabled ? "已启用" : "已停用"}
        </Badge>
        <span className="text-xs text-slate-400">来源：{sourceLabels[item.bindingSource]}</span>
        {item.overrideEnabled !== null ? (
          <button
            aria-label={`恢复 ${item.manifest.name} 的继承设置`}
            className="ml-auto flex size-8 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            disabled={pending}
            onClick={onReset}
            title="恢复继承"
            type="button"
          >
            <RefreshCcw className="size-4" />
          </button>
        ) : null}
      </div>
    </article>
  )
}

export default function SkillsPage() {
  const queryClient = useQueryClient()
  const [selectedTargetValue, setSelectedTargetValue] = useState("user:")
  const [pendingSkillId, setPendingSkillId] = useState<string | null>(null)
  const [pendingPermission, setPendingPermission] = useState<string | null>(null)
  const [scheduleAgentId, setScheduleAgentId] = useState("")
  const [scheduleAt, setScheduleAt] = useState("")
  const [scheduleNote, setScheduleNote] = useState("")
  const agentsQuery = useQuery({
    queryKey: ["dashboard", "my-agent-inbox"],
    queryFn: getMyAgentInbox,
  })
  const groupsQuery = useQuery({
    queryKey: ["agent-group-chats"],
    queryFn: getAgentGroupChats,
  })
  const scopeOptions = useMemo<ScopeOption[]>(() => [
    {
      value: "user:",
      label: "全部聊天",
      detail: "全局设置",
      target: { scopeType: "user", scopeId: null },
    },
    ...(agentsQuery.data?.items ?? []).map((agent) => ({
      value: `agent:${agent.id}`,
      label: agent.name,
      detail: "单聊 Agent",
      target: { scopeType: "agent" as const, scopeId: agent.id },
    })),
    ...(groupsQuery.data?.items ?? []).map((group) => ({
      value: `group:${group.id}`,
      label: group.title,
      detail: "Agent 群聊",
      target: { scopeType: "group" as const, scopeId: group.id },
    })),
  ], [agentsQuery.data?.items, groupsQuery.data?.items])
  const selectedOption = scopeOptions.find((option) => option.value === selectedTargetValue) ?? scopeOptions[0]!

  useEffect(() => {
    if (!scopeOptions.some((option) => option.value === selectedTargetValue)) {
      setSelectedTargetValue("user:")
    }
  }, [scopeOptions, selectedTargetValue])

  useEffect(() => {
    if (!scheduleAgentId && agentsQuery.data?.items[0]?.id) {
      setScheduleAgentId(agentsQuery.data.items[0].id)
    }
  }, [agentsQuery.data?.items, scheduleAgentId])

  const catalogQuery = useQuery({
    queryKey: ["companion-skills", "catalog", selectedOption.value],
    queryFn: () => getCompanionSkillCatalog(selectedOption.target),
  })
  const runsQuery = useQuery({
    queryKey: ["companion-skills", "runs"],
    queryFn: () => getCompanionSkillRuns(24),
  })
  const sessionsQuery = useQuery({
    queryKey: ["companion-skills", "sessions", "active"],
    queryFn: () => getCompanionSkillSessions(true, 12),
  })
  const evaluationQuery = useQuery({
    queryKey: ["companion-skills", "evaluation"],
    queryFn: getCompanionSkillEvaluationSummary,
  })
  const permissionsQuery = useQuery({
    queryKey: ["companion-skills", "permissions"],
    queryFn: getCompanionSkillPermissionGrants,
  })
  const backgroundJobsQuery = useQuery({
    queryKey: ["companion-skills", "background-jobs"],
    queryFn: () => getCompanionSkillBackgroundJobs(20),
  })
  const bindingMutation = useMutation({
    mutationFn: updateCompanionSkillBinding,
    onSettled: async () => {
      setPendingSkillId(null)
      await queryClient.invalidateQueries({ queryKey: ["companion-skills", "catalog", selectedOption.value] })
    },
  })
  const cancelSessionMutation = useMutation({
    mutationFn: cancelCompanionSkillSession,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["companion-skills", "sessions"] }),
        queryClient.invalidateQueries({ queryKey: ["companion-skills", "runs"] }),
      ])
    },
  })
  const permissionMutation = useMutation({
    mutationFn: updateCompanionSkillPermissionGrant,
    onSettled: async () => {
      setPendingPermission(null)
      await queryClient.invalidateQueries({ queryKey: ["companion-skills", "permissions"] })
    },
  })
  const createBackgroundJobMutation = useMutation({
    mutationFn: createCompanionSkillBackgroundJob,
    onSuccess: async () => {
      setScheduleNote("")
      setScheduleAt("")
      await queryClient.invalidateQueries({ queryKey: ["companion-skills", "background-jobs"] })
    },
  })
  const cancelBackgroundJobMutation = useMutation({
    mutationFn: cancelCompanionSkillBackgroundJob,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["companion-skills", "background-jobs"] })
    },
  })
  const skills = catalogQuery.data?.items ?? []
  const enabledCount = skills.filter((item) => item.effectiveEnabled).length
  const overriddenCount = skills.filter((item) => item.overrideEnabled !== null).length
  const evaluation = evaluationQuery.data
  const grants = permissionsQuery.data?.items ?? []
  const proactivePermissionGranted = grants.some((grant) => (
    grant.skillId === "goal-check-in-reminder"
    && grant.permissionCode === "proactive_message:write"
    && grant.scopeType === "user"
    && grant.status === "active"
  ))

  function updateBinding(skillId: string, enabled: boolean | null) {
    setPendingSkillId(skillId)
    bindingMutation.mutate({
      target: selectedOption.target,
      skillId,
      enabled,
    })
  }

  function permissionIsGranted(skillId: string, permissionCode: CompanionSkillPermissionCode) {
    return grants.some((grant) => (
      grant.skillId === skillId
      && grant.permissionCode === permissionCode
      && grant.scopeType === "user"
      && grant.status === "active"
    ))
  }

  function updatePermission(skillId: string, permissionCode: CompanionSkillPermissionCode, granted: boolean) {
    setPendingPermission(`${skillId}:${permissionCode}`)
    permissionMutation.mutate({
      target: { scopeType: "user", scopeId: null },
      skillId,
      permissionCode,
      granted,
    })
  }

  function scheduleGoalCheckIn() {
    const scheduledAtMs = new Date(scheduleAt).getTime()
    if (!scheduleAgentId || !Number.isFinite(scheduledAtMs)) return
    createBackgroundJobMutation.mutate({
      skillId: "goal-check-in-reminder",
      agentId: scheduleAgentId,
      scheduledAtMs,
      note: scheduleNote.trim() || undefined,
    })
  }

  return (
    <DashboardShell title="Skills">
      <main className="min-h-full bg-[#fffefa]">
        <section className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-[90rem] flex-col gap-6 px-5 py-7 lg:flex-row lg:items-end lg:justify-between lg:px-8">
            <div>
              <p className="text-xs font-medium text-slate-400">COMPANION CAPABILITIES</p>
              <h1 className="mt-2 text-2xl font-semibold text-slate-950">Skills</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                管理电子伴侣在不同聊天范围内使用的过程能力。
              </p>
            </div>
            <div className="grid grid-cols-3 border-t border-slate-200 pt-4 lg:border-t-0 lg:pt-0">
              {[
                { label: "当前启用", value: `${enabledCount}/${skills.length}`, icon: CheckCircle2 },
                { label: "当前覆盖", value: String(overriddenCount), icon: CircleSlash2 },
                { label: "规则评测", value: evaluation ? `${evaluation.passed}/${evaluation.total}` : "--", icon: Activity },
              ].map((stat, index) => {
                const Icon = stat.icon
                return (
                  <div className={index === 0 ? "pr-5" : "border-l border-slate-200 px-5 last:pr-0"} key={stat.label}>
                    <Icon className="size-4 text-slate-400" />
                    <p className="mt-2 text-[11px] font-medium text-slate-400">{stat.label}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-800">{stat.value}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-[90rem] gap-8 px-5 py-8 lg:px-8 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
          <div className="min-w-0">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">能力配置</p>
                <p className="mt-1 text-xs text-slate-400">{selectedOption.detail} · {selectedOption.label}</p>
              </div>
              <Select onValueChange={setSelectedTargetValue} value={selectedOption.value}>
                <SelectTrigger className="h-10 w-full rounded-md border-slate-200 bg-white sm:w-64">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper">
                  {scopeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <span className="flex min-w-0 items-center gap-2">
                        {option.target.scopeType === "user" ? <Puzzle className="size-4" /> : option.target.scopeType === "agent" ? <Bot className="size-4" /> : <UsersRound className="size-4" />}
                        <span className="truncate">{option.label}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {catalogQuery.isLoading ? (
              <div className="border border-slate-200 bg-white px-5 py-14 text-center text-sm text-slate-400">正在加载 Skills...</div>
            ) : catalogQuery.isError ? (
              <div className="border border-red-200 bg-red-50 px-5 py-8 text-sm text-red-700">Skills 加载失败，请稍后重试。</div>
            ) : (
              <div className="grid gap-4">
                {skills.map((item) => (
                  <SkillItem
                    item={item}
                    key={item.manifest.id}
                    onChange={(enabled) => updateBinding(item.manifest.id, enabled)}
                    onReset={() => updateBinding(item.manifest.id, null)}
                    pending={pendingSkillId === item.manifest.id}
                  />
                ))}
              </div>
            )}

            <section className="mt-10 border-t border-slate-200 pt-8">
              <div className="mb-5 flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-slate-900 text-white">
                  <LockKeyhole className="size-4" />
                </span>
                <div>
                  <h2 className="text-sm font-semibold text-slate-950">执行权限</h2>
                  <p className="mt-1 text-xs leading-5 text-slate-500">Tool 与后台任务只有在获得明确授权后才能访问数据或写入消息。</p>
                </div>
              </div>
              <div className="divide-y divide-slate-100 border border-slate-200 bg-white">
                {permissionRows.map((permission) => {
                  const Icon = permission.icon
                  const key = `${permission.skillId}:${permission.permissionCode}`
                  const granted = permissionIsGranted(permission.skillId, permission.permissionCode)
                  return (
                    <div className="flex items-start gap-4 px-5 py-5" key={key}>
                      <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600">
                        <Icon className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium text-slate-900">{permission.name}</p>
                          <Badge className="rounded-md border-slate-200 bg-white text-slate-500" variant="outline">{permission.risk}</Badge>
                        </div>
                        <p className="mt-1.5 text-xs leading-5 text-slate-500">{permission.detail}</p>
                      </div>
                      <Switch
                        aria-label={`${granted ? "撤销" : "授予"}${permission.name}`}
                        checked={granted}
                        disabled={permissionsQuery.isLoading || pendingPermission === key}
                        onCheckedChange={(checked) => updatePermission(permission.skillId, permission.permissionCode, checked)}
                      />
                    </div>
                  )
                })}
              </div>
            </section>

            <section className="mt-10 border-t border-slate-200 pt-8">
              <div className="mb-5 flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-slate-900 text-white">
                  <CalendarClock className="size-4" />
                </span>
                <div>
                  <h2 className="text-sm font-semibold text-slate-950">目标复盘提醒</h2>
                  <p className="mt-1 text-xs leading-5 text-slate-500">选择 Agent 和时间，安排一次可取消、可追踪的主动复盘。</p>
                </div>
              </div>

              <div className="border border-slate-200 bg-white p-5 sm:p-6">
                {!proactivePermissionGranted ? (
                  <div className="mb-5 flex items-start gap-3 border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800">
                    <ShieldCheck className="mt-0.5 size-4 shrink-0" />
                    请先在上方开启“发送主动提醒”权限，再创建复盘任务。
                  </div>
                ) : null}
                <div className="grid gap-5 md:grid-cols-2">
                  <label className="grid gap-2 text-xs font-medium text-slate-700">
                    复盘 Agent
                    <Select onValueChange={setScheduleAgentId} value={scheduleAgentId}>
                      <SelectTrigger className="h-10 rounded-md border-slate-200 bg-white">
                        <SelectValue placeholder="选择 Agent" />
                      </SelectTrigger>
                      <SelectContent position="popper">
                        {(agentsQuery.data?.items ?? []).map((agent) => (
                          <SelectItem key={agent.id} value={agent.id}>{agent.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>
                  <label className="grid gap-2 text-xs font-medium text-slate-700">
                    提醒时间
                    <Input className="h-10 border-slate-200 bg-white" min={minimumLocalScheduleTime()} onChange={(event) => setScheduleAt(event.target.value)} type="datetime-local" value={scheduleAt} />
                  </label>
                </div>
                <label className="mt-5 grid gap-2 text-xs font-medium text-slate-700">
                  复盘关注点 <span className="font-normal text-slate-400">可选</span>
                  <textarea
                    className="min-h-24 w-full resize-y rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal text-slate-800 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                    maxLength={500}
                    onChange={(event) => setScheduleNote(event.target.value)}
                    placeholder="例如：确认本周写作计划是否按时推进"
                    value={scheduleNote}
                  />
                </label>
                <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-slate-400">定时器每 5 分钟扫描一次，到点后可能有少量延迟。</p>
                  <Button
                    className="bg-slate-900 text-white hover:bg-slate-800"
                    disabled={!proactivePermissionGranted || !scheduleAgentId || !scheduleAt || createBackgroundJobMutation.isPending}
                    onClick={scheduleGoalCheckIn}
                    type="button"
                  >
                    <BellRing className="size-4" />
                    安排提醒
                  </Button>
                </div>
              </div>

              <div className="mt-4 divide-y divide-slate-100 border border-slate-200 bg-white">
                {(backgroundJobsQuery.data?.items.length ?? 0) === 0 ? (
                  <div className="px-5 py-10 text-center text-sm text-slate-400">暂无复盘提醒</div>
                ) : backgroundJobsQuery.data?.items.map((job) => (
                  <div className="flex items-start gap-4 px-5 py-4" key={job.id}>
                    <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600">
                      <Bot className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-slate-900">{job.agentName}</p>
                        <Badge className="rounded-md border-slate-200 bg-white text-slate-500" variant="outline">{backgroundStatusLabels[job.status]}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{formatRunTime(job.scheduledAtMs)}{job.note ? ` · ${job.note}` : ""}</p>
                      {job.lastError ? <p className="mt-1 line-clamp-1 text-xs text-red-600">{job.lastError}</p> : null}
                    </div>
                    {["scheduled", "retrying"].includes(job.status) ? (
                      <Button
                        aria-label={`取消 ${job.agentName} 的复盘提醒`}
                        disabled={cancelBackgroundJobMutation.isPending}
                        onClick={() => cancelBackgroundJobMutation.mutate(job.id)}
                        size="icon-sm"
                        title="取消提醒"
                        type="button"
                        variant="ghost"
                      >
                        <X className="size-4" />
                      </Button>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          </div>

          <aside className="border border-slate-200 bg-white xl:sticky xl:top-20">
            <div className="border-b border-slate-200 px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">进行中的任务</p>
                  <p className="mt-1 text-xs text-slate-400">可恢复的 Workflow Session</p>
                </div>
                <Target className="size-4 text-slate-400" />
              </div>
            </div>
            {sessionsQuery.isLoading ? (
              <div className="border-b border-slate-200 px-5 py-8 text-center text-sm text-slate-400">正在加载...</div>
            ) : (sessionsQuery.data?.items.length ?? 0) === 0 ? (
              <div className="border-b border-slate-200 px-5 py-8 text-center text-sm text-slate-400">暂无进行中的任务</div>
            ) : (
              <div className="divide-y divide-slate-100 border-b border-slate-200">
                {sessionsQuery.data?.items.map((session) => (
                  <div className="px-5 py-4" key={session.id}>
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-800">{session.skillName}</p>
                        <p className="mt-1 text-xs text-slate-400">等待下一步 · v{session.skillVersion}</p>
                      </div>
                      <button
                        aria-label={`取消 ${session.skillName}`}
                        className="flex size-8 shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                        disabled={cancelSessionMutation.isPending}
                        onClick={() => cancelSessionMutation.mutate(session.id)}
                        title="取消任务"
                        type="button"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                    {session.pendingQuestion ? (
                      <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">{session.pendingQuestion}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
            <div className="border-b border-slate-200 px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">最近运行</p>
                  <p className="mt-1 text-xs text-slate-400">仅记录选择元数据</p>
                </div>
                <Activity className="size-4 text-slate-400" />
              </div>
            </div>
            {runsQuery.isLoading ? (
              <div className="px-5 py-10 text-center text-sm text-slate-400">正在加载...</div>
            ) : (runsQuery.data?.items.length ?? 0) === 0 ? (
              <div className="px-5 py-10 text-center">
                <Puzzle className="mx-auto size-6 text-slate-300" />
                <p className="mt-3 text-sm font-medium text-slate-700">暂无运行记录</p>
              </div>
            ) : (
              <div className="max-h-[42rem] divide-y divide-slate-100 overflow-y-auto">
                {runsQuery.data?.items.map((run) => (
                  <div className="px-5 py-4" key={run.id}>
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-medium text-slate-800">{run.skillName}</p>
                      <span className="shrink-0 text-[11px] text-slate-400">{formatRunTime(run.createdAtMs)}</span>
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-slate-500">{run.reason}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                      <span>{run.trigger === "explicit" ? "显式启用" : run.trigger === "session" ? "Session 继续" : run.trigger === "schedule" ? "定时触发" : "规则命中"}</span>
                      <span>·</span>
                      <span>{scopeLabels[run.chatScope]}</span>
                      <span>·</span>
                      <span>{run.latencyMs}ms</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </aside>
        </section>
      </main>
    </DashboardShell>
  )
}
