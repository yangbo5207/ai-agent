"use client"

import { useEffect, useMemo, useState } from "react"
import {
  CheckCircle2,
  CircleAlert,
  KeyRound,
  Loader2,
  PencilLine,
  PlugZap,
  Plus,
  Power,
  RadioTower,
  ShieldCheck,
  Trash2,
} from "lucide-react"

import {
  createDefaultLlmConfigItem,
  deleteLocalLlmConfigItem,
  localLlmConfigChangedEventName,
  readLocalLlmConfigStore,
  saveLocalLlmConfigStore,
  selectLocalLlmConfig,
  upsertLocalLlmConfigItem,
  type LocalLlmConfigItem,
  type LocalLlmConfigStore,
} from "@/auth/local-llm-config"
import { testLlmConnection } from "@/auth/api"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { DashboardShell } from "../_components/dashboard-shell"

function createEmptyForm(): LocalLlmConfigItem {
  return createDefaultLlmConfigItem()
}

type ConnectionTestState = {
  latencyMs?: number
  message: string
  status: "error" | "success"
}

export default function LlmAccessPage() {
  const [store, setStore] = useState<LocalLlmConfigStore>({ selectedConfigId: null, items: [] })
  const [form, setForm] = useState<LocalLlmConfigItem>(() => createEmptyForm())
  const [notice, setNotice] = useState("")
  const [connectionTest, setConnectionTest] = useState<ConnectionTestState | null>(null)
  const [isTestingConnection, setIsTestingConnection] = useState(false)
  const selectedConfig = useMemo(
    () => store.items.find((item) => item.id === store.selectedConfigId) ?? null,
    [store],
  )
  const activeCount = store.items.filter((item) => item.enabled).length

  function reloadStore() {
    setStore(readLocalLlmConfigStore())
  }

  useEffect(() => {
    reloadStore()

    function handleChanged() {
      reloadStore()
    }

    window.addEventListener(localLlmConfigChangedEventName, handleChanged)

    return () => {
      window.removeEventListener(localLlmConfigChangedEventName, handleChanged)
    }
  }, [])

  useEffect(() => {
    setConnectionTest(null)
  }, [form.apiKey, form.baseURL, form.model, form.reasoningEffort, form.wireApi])

  function handleSave() {
    const nextForm: LocalLlmConfigItem = {
      ...form,
      name: form.name.trim(),
      providerName: form.providerName?.trim() || "OpenAI Compatible",
      baseURL: form.baseURL.trim(),
      model: form.model.trim(),
      apiKey: form.apiKey.trim(),
      wireApi: form.wireApi === "responses" ? "responses" : "chat_completions",
      reasoningEffort: form.reasoningEffort,
    }

    if (!nextForm.name || !nextForm.baseURL || !nextForm.model || !nextForm.apiKey) {
      setNotice("请完整填写名称、Base URL、Model 和 API Key。")
      return
    }

    const savedItem = upsertLocalLlmConfigItem(nextForm)
    const nextStore = readLocalLlmConfigStore()

    setStore(nextStore)
    setForm(savedItem)
    setNotice("配置已保存到当前浏览器。")
  }

  function handleNew() {
    setForm(createEmptyForm())
    setNotice("")
  }

  function handleEdit(item: LocalLlmConfigItem) {
    setForm(item)
    setNotice("")
  }

  function handleDelete(id: string) {
    deleteLocalLlmConfigItem(id)
    setStore(readLocalLlmConfigStore())

    if (form.id === id) {
      setForm(createEmptyForm())
    }

    setNotice("配置已从当前浏览器删除。")
  }

  function handleSelect(id: string | null) {
    selectLocalLlmConfig(id)
    setStore(readLocalLlmConfigStore())
    setNotice(id ? "已设为聊天默认 LLM。" : "已切回平台默认 LLM。")
  }

  function handleToggle(item: LocalLlmConfigItem) {
    const nextItem = {
      ...item,
      enabled: !item.enabled,
    }

    upsertLocalLlmConfigItem(nextItem)
    setStore(readLocalLlmConfigStore())

    if (form.id === item.id) {
      setForm(nextItem)
    }
  }

  function handleClearAll() {
    saveLocalLlmConfigStore({ selectedConfigId: null, items: [] })
    setStore({ selectedConfigId: null, items: [] })
    setForm(createEmptyForm())
    setNotice("全部本机 LLM 配置已清空。")
  }

  async function handleTestConnection() {
    const config = {
      baseURL: form.baseURL.trim(),
      apiKey: form.apiKey.trim(),
      model: form.model.trim(),
      wireApi: form.wireApi === "responses" ? "responses" as const : "chat_completions" as const,
      ...(form.reasoningEffort ? { reasoningEffort: form.reasoningEffort } : {}),
    }

    if (!config.baseURL || !config.apiKey || !config.model) {
      setConnectionTest({
        status: "error",
        message: "请先填写 Base URL、Model 和 API Key。",
      })
      return
    }

    setIsTestingConnection(true)
    setConnectionTest(null)

    try {
      const result = await testLlmConnection({ config })
      const protocol = result.protocol === "responses" ? "Responses" : "Chat Completions"

      setConnectionTest({
        status: "success",
        latencyMs: result.latencyMs,
        message: `连接成功，${protocol} 返回 HTTP ${result.upstreamStatus}。`,
      })
    } catch (error) {
      setConnectionTest({
        status: "error",
        message: error instanceof Error ? error.message : "连接测试失败，请检查配置后重试。",
      })
    } finally {
      setIsTestingConnection(false)
    }
  }

  return (
    <DashboardShell
      headerRight={
        <div className="flex max-w-full flex-wrap items-center justify-end gap-2">
          {[
            { label: "已保存", value: String(store.items.length), icon: PlugZap },
            { label: "已启用", value: String(activeCount), icon: Power },
            { label: "默认模型", value: selectedConfig?.model ?? "平台默认", icon: RadioTower },
          ].map((item) => {
            const Icon = item.icon

            return (
              <span className="inline-flex h-7 max-w-44 items-center gap-1.5 rounded-full border border-[#d9dfdc] bg-[#fbfaf7] px-2.5 text-[10px] font-medium text-[#53615e]" key={item.label}>
                <Icon className="size-3 text-[#a37b4f]" />
                <span className="text-[#9a8d7e]">{item.label}</span>
                <span className="truncate font-semibold text-[#27353a]">{item.value}</span>
              </span>
            )
          })}
        </div>
      }
      title="LLM 接入"
    >
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
        <section className="grid min-h-0 w-full flex-1 overflow-y-auto bg-white px-0 py-0 lg:h-full lg:overflow-hidden lg:grid-cols-[18rem_minmax(0,1fr)]">
          <aside className="flex h-56 min-h-0 shrink-0 flex-col overflow-hidden border-b border-[#e3e6e4] bg-white lg:h-full lg:border-r lg:border-b-0">
            <section className="flex min-h-0 flex-1 flex-col bg-[#fffefa]">
              <div className="flex h-11 shrink-0 items-center justify-between border-b border-[#e3e6e4] bg-[#fffefa] px-3">
                <div>
                  <p className="flex items-center gap-2 text-[13px] font-semibold text-[#27353a]"><PlugZap className="size-3.5 text-[#a37b4f]" />连接列表</p>
                  <p className="mt-0.5 text-[10px] text-[#929b98]">本机保存的配置</p>
                </div>
                <button
                  aria-label="新建配置"
                  className="flex size-7 items-center justify-center rounded-md text-[#687572] transition-colors hover:bg-[#f1f3f2] hover:text-[#27353a]"
                  onClick={handleNew}
                  title="新建配置"
                  type="button"
                >
                  <Plus className="size-4" />
                </button>
              </div>

              <button
                className={cn(
                  "group relative flex w-full items-center gap-3 border-b border-[#e7e9e8] px-3 py-3 text-left transition-[background-color,opacity] duration-200 before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-[linear-gradient(90deg,transparent_0%,#d6e1db_22%,#d6e1db_78%,transparent_100%)] before:opacity-0 after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-[linear-gradient(90deg,transparent_0%,#d6e1db_22%,#d6e1db_78%,transparent_100%)] after:opacity-0",
                  store.selectedConfigId === null ? "bg-[#f1f5f2] before:opacity-100 after:opacity-100" : "hover:bg-[#f7f9f7] hover:before:opacity-100 hover:after:opacity-100",
                )}
                onClick={() => handleSelect(null)}
                type="button"
              >
                <span className="flex size-7 items-center justify-center rounded-md bg-[#f1f3f2] text-[#687572]"><RadioTower className="size-3.5" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold text-[#27353a]">平台默认</span>
                  <span className="mt-0.5 block text-[10px] text-[#929b98]">不使用本机连接</span>
                </span>
                {store.selectedConfigId === null ? <CheckCircle2 className="size-4 text-[#5e9679]" /> : null}
              </button>

              <div className="min-h-0 flex-1 overflow-y-auto">
              {store.items.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <PlugZap className="mx-auto size-7 text-[#c8cecb]" />
                  <p className="mt-3 text-[13px] font-medium text-[#53615e]">还没有连接</p>
                  <p className="mt-1 text-[10px] leading-5 text-[#929b98]">点击右上角新建一个模型服务。</p>
                </div>
              ) : (
                <div className="divide-y divide-[#e7e9e8]">
                  {store.items.map((item) => {
                    const isSelected = item.id === store.selectedConfigId
                    const isEditing = item.id === form.id

                    return (
                      <article className={cn("relative", isEditing ? "bg-[#f1f5f2]" : "bg-[#fffefa]")} key={item.id}>
                        <button
                          className="block w-full px-3 pt-3 text-left transition-colors hover:bg-[#f7f9f7]"
                          onClick={() => handleEdit(item)}
                          type="button"
                        >
                          <span className="flex items-center gap-2">
                            <span className={item.enabled ? "size-1.5 rounded-full bg-emerald-500" : "size-1.5 rounded-full bg-slate-300"} />
                            <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-[#27353a]">{item.name}</span>
                            {isSelected ? <CheckCircle2 className="size-3.5 shrink-0 text-[#5e9679]" /> : null}
                          </span>
                          <span className="mt-1 block truncate pl-3.5 text-[10px] text-[#929b98]">{item.model}</span>
                        </button>
                        <div className="flex items-center gap-1 px-3 pb-3 pt-2">
                          <button
                            aria-label={`设 ${item.name} 为默认`}
                            className={isSelected ? "flex size-7 items-center justify-center rounded-md bg-[#27353a] text-white" : "flex size-7 items-center justify-center rounded-md text-[#a4ada9] hover:bg-[#eef1ef] hover:text-[#53615e]"}
                            onClick={() => handleSelect(item.id)}
                            title={isSelected ? "当前默认" : "设为默认"}
                            type="button"
                          >
                            <RadioTower className="size-3.5" />
                          </button>
                          <button
                            aria-label={`编辑 ${item.name}`}
                            className="flex size-7 items-center justify-center rounded-md text-[#a4ada9] hover:bg-[#eef1ef] hover:text-[#53615e]"
                            onClick={() => handleEdit(item)}
                            title="编辑"
                            type="button"
                          >
                            <PencilLine className="size-3.5" />
                          </button>
                          <button
                            aria-label={`${item.enabled ? "停用" : "启用"} ${item.name}`}
                            className={item.enabled ? "flex size-7 items-center justify-center rounded-md text-[#5e9679] hover:bg-[#edf7f1]" : "flex size-7 items-center justify-center rounded-md text-[#a4ada9] hover:bg-[#eef1ef]"}
                            onClick={() => handleToggle(item)}
                            title={item.enabled ? "停用" : "启用"}
                            type="button"
                          >
                            <Power className="size-3.5" />
                          </button>
                          <button
                            aria-label={`删除 ${item.name}`}
                            className="ml-auto flex size-7 items-center justify-center rounded-md text-[#a4ada9] hover:bg-red-50 hover:text-red-600"
                            onClick={() => handleDelete(item.id)}
                            title="删除"
                            type="button"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </article>
                    )
                  })}
                </div>
              )}
              </div>

              {store.items.length > 0 ? (
                <div className="border-t border-[#e3e6e4] p-3">
                  <button
                    className="flex h-8 w-full items-center justify-center gap-1.5 rounded-md text-xs font-medium text-slate-500 hover:bg-red-50 hover:text-red-600"
                    onClick={handleClearAll}
                    type="button"
                  >
                    <Trash2 className="size-3.5" />
                    清空全部连接
                  </button>
                </div>
              ) : null}
            </section>
          </aside>

          <section className="flex min-h-[36rem] min-w-0 flex-col overflow-hidden bg-[#fffefa] lg:h-full lg:min-h-0">
            <div className="flex min-h-14 shrink-0 items-center justify-between gap-3 border-b border-[#e3e6e4] bg-[#fbfaf7] px-4 py-2.5 sm:px-6">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-[#a37b4f]">Connection details</p>
                <h2 className="mt-1 flex items-center gap-2 text-[13px] font-semibold text-[#27353a]">
                  <KeyRound className="size-3.5 text-[#a37b4f]" />
                  {store.items.some((item) => item.id === form.id) ? "编辑连接" : "新建连接"}
                </h2>
              </div>
              <button
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#d9dfdc] bg-[#fffefa] px-3 text-xs font-medium text-[#53615e] hover:bg-[#f1f3f2]"
                onClick={handleNew}
                type="button"
              >
                <Plus className="size-3.5" />
                新建连接
              </button>
            </div>

            <form
              className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7 lg:px-8"
              onSubmit={(event) => {
                event.preventDefault()
                handleSave()
              }}
            >
              <div className="mx-auto grid w-full max-w-[56rem] gap-6">
                <div className="grid gap-5 md:grid-cols-2">
                  <label className="grid gap-2" htmlFor="llm-name">
                    <span className="text-[11px] font-medium text-[#687572]">连接名称</span>
                    <input
                      className="h-9 rounded-md border border-[#d9dfdc] bg-[#fffefa] px-3 text-sm text-[#53615e] outline-none transition-colors placeholder:text-[#b0b8b4] focus:border-[#9baba4] focus:ring-2 focus:ring-[#dce5e0]"
                      id="llm-name"
                      onChange={(event) => {
                        const value = event.currentTarget.value
                        setForm((current) => ({ ...current, name: value }))
                        setNotice("")
                      }}
                      placeholder="例如：我的主力模型"
                      value={form.name}
                    />
                  </label>

                  <label className="grid gap-2" htmlFor="llm-provider">
                    <span className="text-[11px] font-medium text-[#687572]">服务名称</span>
                    <input
                      className="h-9 rounded-md border border-[#d9dfdc] bg-[#fffefa] px-3 text-sm text-[#53615e] outline-none transition-colors placeholder:text-[#b0b8b4] focus:border-[#9baba4] focus:ring-2 focus:ring-[#dce5e0]"
                      id="llm-provider"
                      onChange={(event) => {
                        const value = event.currentTarget.value
                        setForm((current) => ({ ...current, providerName: value }))
                        setNotice("")
                      }}
                      placeholder="例如：OpenAI Compatible"
                      value={form.providerName ?? ""}
                    />
                  </label>
                </div>

                <label className="grid gap-2" htmlFor="llm-base-url">
                  <span className="text-[11px] font-medium text-[#687572]">Base URL</span>
                  <input
                    className="h-9 rounded-md border border-[#d9dfdc] bg-[#fffefa] px-3 text-sm text-[#53615e] outline-none transition-colors placeholder:text-[#b0b8b4] focus:border-[#9baba4] focus:ring-2 focus:ring-[#dce5e0]"
                    id="llm-base-url"
                    onChange={(event) => {
                      const value = event.currentTarget.value
                      setForm((current) => ({ ...current, baseURL: value }))
                      setNotice("")
                    }}
                    placeholder="https://api.example.com/v1"
                    value={form.baseURL}
                  />
                </label>

                <div className="grid gap-5 md:grid-cols-[1.05fr_1.35fr_1fr]">
                  <label className="grid gap-2" htmlFor="llm-wire-api">
                    <span className="text-[11px] font-medium text-[#687572]">请求协议</span>
                    <Select
                      onValueChange={(value) => {
                        const nextValue = value === "responses" ? "responses" : "chat_completions"
                        setForm((current) => ({ ...current, wireApi: nextValue }))
                        setNotice("")
                      }}
                      value={form.wireApi ?? "chat_completions"}
                    >
                      <SelectTrigger className="h-9 w-full border-[#d9dfdc] bg-[#fffefa] text-sm text-[#53615e]" id="llm-wire-api">
                        <SelectValue placeholder="选择协议" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="chat_completions">Chat Completions</SelectItem>
                        <SelectItem value="responses">Responses</SelectItem>
                      </SelectContent>
                    </Select>
                  </label>

                  <label className="grid gap-2" htmlFor="llm-model">
                    <span className="text-[11px] font-medium text-[#687572]">模型</span>
                    <input
                      className="h-9 rounded-md border border-[#d9dfdc] bg-[#fffefa] px-3 text-sm text-[#53615e] outline-none transition-colors placeholder:text-[#b0b8b4] focus:border-[#9baba4] focus:ring-2 focus:ring-[#dce5e0]"
                      id="llm-model"
                      onChange={(event) => {
                        const value = event.currentTarget.value
                        setForm((current) => ({ ...current, model: value }))
                        setNotice("")
                      }}
                      placeholder="gpt-4o-mini"
                      value={form.model}
                    />
                  </label>

                  <label className="grid gap-2" htmlFor="llm-reasoning-effort">
                    <span className="text-[11px] font-medium text-[#687572]">推理强度</span>
                    <Select
                      onValueChange={(value) => {
                        const reasoningEffort = ["minimal", "low", "medium", "high"].includes(value)
                          ? value as LocalLlmConfigItem["reasoningEffort"]
                          : undefined
                        setForm((current) => ({ ...current, reasoningEffort }))
                        setNotice("")
                      }}
                      value={form.reasoningEffort ?? "default"}
                    >
                      <SelectTrigger className="h-9 w-full border-[#d9dfdc] bg-[#fffefa] text-sm text-[#53615e]" id="llm-reasoning-effort">
                        <SelectValue placeholder="默认" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="default">默认</SelectItem>
                        <SelectItem value="minimal">minimal</SelectItem>
                        <SelectItem value="low">low</SelectItem>
                        <SelectItem value="medium">medium</SelectItem>
                        <SelectItem value="high">high</SelectItem>
                      </SelectContent>
                    </Select>
                  </label>
                </div>

                <label className="grid gap-2" htmlFor="llm-api-key">
                  <span className="text-[11px] font-medium text-[#687572]">API Key</span>
                  <input
                    className="h-9 rounded-md border border-[#d9dfdc] bg-[#fffefa] px-3 text-sm text-[#53615e] outline-none transition-colors placeholder:text-[#b0b8b4] focus:border-[#9baba4] focus:ring-2 focus:ring-[#dce5e0]"
                    id="llm-api-key"
                    onChange={(event) => {
                      const value = event.currentTarget.value
                      setForm((current) => ({ ...current, apiKey: value }))
                      setNotice("")
                    }}
                    placeholder="sk-..."
                    type="password"
                    value={form.apiKey}
                  />
                </label>

                <div className="border-y border-[#e3e6e4] bg-[#fbfaf7] px-4 py-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-[13px] font-semibold text-[#27353a]">测试连接</p>
                      <p className="mt-1 text-[11px] leading-5 text-[#929b98]">使用当前表单发起一次最小模型请求，不会保存此配置。</p>
                    </div>
                    <button
                      className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md border border-[#d9dfdc] bg-[#fffefa] px-3 text-sm font-medium text-[#53615e] hover:bg-[#f1f3f2] disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={isTestingConnection}
                      onClick={() => void handleTestConnection()}
                      type="button"
                    >
                      {isTestingConnection ? <Loader2 className="size-4 animate-spin" /> : <PlugZap className="size-4" />}
                      {isTestingConnection ? "测试中..." : "测试连接"}
                    </button>
                  </div>
                  {connectionTest ? (
                    <div className={connectionTest.status === "success" ? "mt-3 flex items-start gap-2 border-t border-emerald-200 pt-3 text-sm text-emerald-700" : "mt-3 flex items-start gap-2 border-t border-red-200 pt-3 text-sm text-red-700"}>
                      {connectionTest.status === "success" ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> : <CircleAlert className="mt-0.5 size-4 shrink-0" />}
                      <p className="leading-6">
                        {connectionTest.message}
                        {connectionTest.latencyMs !== undefined ? ` 用时 ${connectionTest.latencyMs}ms。` : ""}
                      </p>
                    </div>
                  ) : null}
                </div>

                <div className="flex items-center justify-between gap-5 border-y border-[#edf0ee] py-5">
                  <div>
                    <p className="text-[13px] font-semibold text-[#27353a]">启用此连接</p>
                    <p className="mt-1 text-[11px] leading-5 text-[#929b98]">停用后，聊天不会使用该配置。</p>
                  </div>
                  <button
                    aria-label="启用此连接"
                    aria-pressed={form.enabled}
                    className={form.enabled ? "h-6 w-10 rounded-full bg-[#27353a] p-0.5" : "h-6 w-10 rounded-full bg-[#dfe3e1] p-0.5"}
                    onClick={() => setForm((current) => ({ ...current, enabled: !current.enabled }))}
                    type="button"
                  >
                    <span className={form.enabled ? "ml-auto block size-5 rounded-full bg-white" : "block size-5 rounded-full bg-white"} />
                  </button>
                </div>

                {notice ? <p className="border border-[#dfe3e1] bg-[#f6f7f5] px-3 py-2 text-sm leading-6 text-[#53615e]">{notice}</p> : null}

                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="flex max-w-xl items-start gap-2 text-[11px] leading-5 text-[#89928f]">
                    <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
                    配置保存在当前浏览器。聊天时，选中的配置会随本次请求发送至 API 子站进行代理转发，不写入用户资料或 D1。
                  </p>
                  <button className="h-10 shrink-0 rounded-md bg-[#27353a] px-5 text-sm font-medium text-white hover:bg-[#35484c]" type="submit">
                    保存连接
                  </button>
                </div>
              </div>
            </form>
          </section>
        </section>
      </main>
    </DashboardShell>
  )
}
