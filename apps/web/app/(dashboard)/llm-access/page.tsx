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
    <DashboardShell title="LLM 接入">
      <main className="min-h-[calc(100vh-4rem)] bg-slate-50/70">
        <section className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-[90rem] flex-col gap-5 px-5 py-6 lg:px-8 lg:py-7 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400">MODEL CONNECTIONS</p>
              <h1 className="mt-2 text-2xl font-semibold text-slate-950">LLM 接入</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                管理当前浏览器中的模型服务连接，并为聊天选择默认配置。
              </p>
            </div>
            <div className="grid grid-cols-3 border-t border-slate-200 pt-4 xl:border-t-0 xl:pt-0">
              {[
                { label: "已保存", value: String(store.items.length), icon: PlugZap },
                { label: "已启用", value: String(activeCount), icon: Power },
                { label: "默认模型", value: selectedConfig?.model ?? "平台默认", icon: RadioTower },
              ].map((item, index) => {
                const Icon = item.icon

                return (
                  <div className={index === 0 ? "pr-4" : "border-l border-slate-200 px-4 last:pr-0"} key={item.label}>
                    <Icon className="size-4 text-slate-400" />
                    <p className="mt-2 text-[11px] font-medium text-slate-400">{item.label}</p>
                    <p className="mt-1 max-w-28 truncate text-sm font-medium text-slate-700">{item.value}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-[90rem] gap-8 px-5 py-8 lg:px-8 xl:grid-cols-[18rem_minmax(0,1fr)] xl:items-start">
          <aside className="xl:sticky xl:top-20">
            <section className="border border-slate-200 bg-white">
              <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900">连接列表</p>
                  <p className="mt-1 text-xs text-slate-400">本机保存的配置</p>
                </div>
                <button
                  aria-label="新建配置"
                  className="flex size-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 transition-colors hover:bg-slate-50"
                  onClick={handleNew}
                  title="新建配置"
                  type="button"
                >
                  <Plus className="size-4" />
                </button>
              </div>

              <button
                className={store.selectedConfigId === null ? "flex w-full items-center gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3 text-left" : "flex w-full items-center gap-3 border-b border-slate-100 px-4 py-3 text-left transition-colors hover:bg-slate-50"}
                onClick={() => handleSelect(null)}
                type="button"
              >
                <span className="flex size-7 items-center justify-center bg-slate-100 text-slate-500"><RadioTower className="size-3.5" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-slate-700">平台默认</span>
                  <span className="mt-0.5 block text-xs text-slate-400">不使用本机连接</span>
                </span>
                {store.selectedConfigId === null ? <CheckCircle2 className="size-4 text-emerald-600" /> : null}
              </button>

              {store.items.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <PlugZap className="mx-auto size-7 text-slate-300" />
                  <p className="mt-3 text-sm font-medium text-slate-700">还没有连接</p>
                  <p className="mt-1 text-xs leading-5 text-slate-400">点击右上角新建一个模型服务。</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {store.items.map((item) => {
                    const isSelected = item.id === store.selectedConfigId
                    const isEditing = item.id === form.id

                    return (
                      <article className={isEditing ? "bg-slate-50" : "bg-white"} key={item.id}>
                        <button
                          className="block w-full px-4 pt-3 text-left"
                          onClick={() => handleEdit(item)}
                          type="button"
                        >
                          <span className="flex items-center gap-2">
                            <span className={item.enabled ? "size-1.5 rounded-full bg-emerald-500" : "size-1.5 rounded-full bg-slate-300"} />
                            <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">{item.name}</span>
                            {isSelected ? <CheckCircle2 className="size-3.5 shrink-0 text-emerald-600" /> : null}
                          </span>
                          <span className="mt-1 block truncate pl-3.5 text-xs text-slate-400">{item.model}</span>
                        </button>
                        <div className="flex items-center gap-1 px-3 pb-3 pt-2">
                          <button
                            aria-label={`设 ${item.name} 为默认`}
                            className={isSelected ? "flex size-7 items-center justify-center rounded-md bg-slate-900 text-white" : "flex size-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"}
                            onClick={() => handleSelect(item.id)}
                            title={isSelected ? "当前默认" : "设为默认"}
                            type="button"
                          >
                            <RadioTower className="size-3.5" />
                          </button>
                          <button
                            aria-label={`编辑 ${item.name}`}
                            className="flex size-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                            onClick={() => handleEdit(item)}
                            title="编辑"
                            type="button"
                          >
                            <PencilLine className="size-3.5" />
                          </button>
                          <button
                            aria-label={`${item.enabled ? "停用" : "启用"} ${item.name}`}
                            className={item.enabled ? "flex size-7 items-center justify-center rounded-md text-emerald-600 hover:bg-emerald-50" : "flex size-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100"}
                            onClick={() => handleToggle(item)}
                            title={item.enabled ? "停用" : "启用"}
                            type="button"
                          >
                            <Power className="size-3.5" />
                          </button>
                          <button
                            aria-label={`删除 ${item.name}`}
                            className="ml-auto flex size-7 items-center justify-center rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600"
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

              {store.items.length > 0 ? (
                <div className="border-t border-slate-200 p-3">
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

          <section className="min-w-0 border border-slate-200 bg-white">
            <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-7">
              <div>
                <p className="text-xs font-medium text-slate-400">CONNECTION DETAILS</p>
                <h2 className="mt-2 flex items-center gap-2 text-base font-semibold text-slate-900">
                  <KeyRound className="size-4 text-slate-400" />
                  {store.items.some((item) => item.id === form.id) ? "编辑连接" : "新建连接"}
                </h2>
              </div>
              <button
                className="inline-flex h-8 items-center gap-1.5 self-start rounded-md border border-slate-200 px-3 text-xs font-medium text-slate-600 hover:bg-slate-50"
                onClick={handleNew}
                type="button"
              >
                <Plus className="size-3.5" />
                新建连接
              </button>
            </div>

            <form
              className="px-5 py-6 sm:px-7"
              onSubmit={(event) => {
                event.preventDefault()
                handleSave()
              }}
            >
              <div className="grid gap-6">
                <div className="grid gap-5 md:grid-cols-2">
                  <label className="grid gap-2" htmlFor="llm-name">
                    <span className="text-sm font-medium text-slate-700">连接名称</span>
                    <input
                      className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition-colors placeholder:text-slate-300 focus:border-slate-500"
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
                    <span className="text-sm font-medium text-slate-700">服务名称</span>
                    <input
                      className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition-colors placeholder:text-slate-300 focus:border-slate-500"
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
                  <span className="text-sm font-medium text-slate-700">Base URL</span>
                  <input
                    className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition-colors placeholder:text-slate-300 focus:border-slate-500"
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

                <div className="grid gap-5 md:grid-cols-3">
                  <label className="grid gap-2" htmlFor="llm-wire-api">
                    <span className="text-sm font-medium text-slate-700">请求协议</span>
                    <select
                      className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition-colors focus:border-slate-500"
                      id="llm-wire-api"
                      onChange={(event) => {
                        const value = event.currentTarget.value === "responses" ? "responses" : "chat_completions"
                        setForm((current) => ({ ...current, wireApi: value }))
                        setNotice("")
                      }}
                      value={form.wireApi ?? "chat_completions"}
                    >
                      <option value="chat_completions">Chat Completions</option>
                      <option value="responses">Responses</option>
                    </select>
                  </label>

                  <label className="grid gap-2" htmlFor="llm-model">
                    <span className="text-sm font-medium text-slate-700">模型</span>
                    <input
                      className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition-colors placeholder:text-slate-300 focus:border-slate-500"
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
                    <span className="text-sm font-medium text-slate-700">推理强度</span>
                    <select
                      className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition-colors focus:border-slate-500"
                      id="llm-reasoning-effort"
                      onChange={(event) => {
                        const value = event.currentTarget.value
                        const reasoningEffort = ["minimal", "low", "medium", "high"].includes(value)
                          ? value as LocalLlmConfigItem["reasoningEffort"]
                          : undefined
                        setForm((current) => ({ ...current, reasoningEffort }))
                        setNotice("")
                      }}
                      value={form.reasoningEffort ?? ""}
                    >
                      <option value="">默认</option>
                      <option value="minimal">minimal</option>
                      <option value="low">low</option>
                      <option value="medium">medium</option>
                      <option value="high">high</option>
                    </select>
                  </label>
                </div>

                <label className="grid gap-2" htmlFor="llm-api-key">
                  <span className="text-sm font-medium text-slate-700">API Key</span>
                  <input
                    className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition-colors placeholder:text-slate-300 focus:border-slate-500"
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

                <div className="border border-slate-200 bg-slate-50/70 px-4 py-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-700">测试连接</p>
                      <p className="mt-1 text-xs leading-5 text-slate-400">使用当前表单发起一次最小模型请求，不会保存此配置。</p>
                    </div>
                    <button
                      className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
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

                <div className="flex items-center justify-between gap-5 border-y border-slate-100 py-5">
                  <div>
                    <p className="text-sm font-medium text-slate-700">启用此连接</p>
                    <p className="mt-1 text-xs leading-5 text-slate-400">停用后，聊天不会使用该配置。</p>
                  </div>
                  <button
                    aria-label="启用此连接"
                    aria-pressed={form.enabled}
                    className={form.enabled ? "h-6 w-10 rounded-full bg-slate-950 p-0.5" : "h-6 w-10 rounded-full bg-slate-200 p-0.5"}
                    onClick={() => setForm((current) => ({ ...current, enabled: !current.enabled }))}
                    type="button"
                  >
                    <span className={form.enabled ? "ml-auto block size-5 rounded-full bg-white" : "block size-5 rounded-full bg-white"} />
                  </button>
                </div>

                {notice ? <p className="border border-slate-200 bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-600">{notice}</p> : null}

                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="flex max-w-xl items-start gap-2 text-xs leading-5 text-slate-400">
                    <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
                    配置保存在当前浏览器。聊天时，选中的配置会随本次请求发送至 API 子站进行代理转发，不写入用户资料或 D1。
                  </p>
                  <button className="h-10 shrink-0 rounded-md bg-slate-950 px-5 text-sm font-medium text-white hover:bg-slate-800" type="submit">
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
