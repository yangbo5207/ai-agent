import {
  Bot,
  Check,
  CheckCircle2,
  HelpCircle,
  Minus,
  ShieldCheck,
} from "lucide-react"

import { DashboardShell } from "../_components/dashboard-shell"

const plans = [
  {
    name: "基础版",
    description: "适合体验角色创建和轻量陪伴聊天。",
    price: "免费",
    period: "长期可用",
    status: "当前套餐",
    features: ["1 个 Agent 伴侣", "基础对话配置", "角色广场预览", "个人草稿"],
  },
  {
    name: "专业版",
    description: "适合高频聊天、多个角色和更完整的互动模式。",
    price: "¥99",
    period: "/月",
    status: "推荐",
    recommended: true,
    features: ["10 个 Agent 伴侣", "完整互动模式", "角色广场完整访问", "优先体验新能力"],
  },
  {
    name: "团队版",
    description: "适合团队共建角色、统一管理边界和协作资产。",
    price: "联系销售",
    period: "定制方案",
    status: "可咨询",
    features: ["更高 Agent 配额", "团队权限", "高级边界策略", "专属支持"],
  },
]

const comparisons = [
  { feature: "Agent 伴侣数量", basic: "1 个", pro: "10 个", team: "定制" },
  { feature: "角色广场访问", basic: "预览", pro: true, team: true },
  { feature: "互动模式配置", basic: "基础", pro: true, team: true },
  { feature: "多 Agent 联动", basic: false, pro: true, team: true },
  { feature: "团队权限", basic: false, pro: false, team: true },
]

const faqs = [
  {
    question: "什么时候可以升级套餐？",
    answer: "支付与自动升级入口后续接入，当前页面先用于展示套餐权益和产品边界。",
  },
  {
    question: "是否支持年付？",
    answer: "订阅模型已预留按月、按年和一次性付费周期，具体策略以后续配置为准。",
  },
  {
    question: "团队版适合什么场景？",
    answer: "适合需要统一管理多个 Agent 伴侣、权限、边界和协作资产的团队。",
  },
]

const currentPlanDetails = [
  { label: "Agent 伴侣", value: "1 / 1" },
  { label: "互动模式", value: "基础配置" },
  { label: "角色广场", value: "预览访问" },
]

function CapabilityValue({ value }: { value: string | boolean }) {
  if (value === true) {
    return (
      <span className="inline-flex items-center justify-center text-emerald-600">
        <Check className="size-4" />
        <span className="sr-only">支持</span>
      </span>
    )
  }

  if (value === false) {
    return (
      <span className="inline-flex items-center justify-center text-slate-300">
        <Minus className="size-4" />
        <span className="sr-only">暂不支持</span>
      </span>
    )
  }

  return <span>{value}</span>
}

export default function SubscriptionPlansPage() {
  return (
    <DashboardShell title="订阅套餐">
      <main className="min-h-full bg-[#fffefa]">
        <section className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-[90rem] flex-col gap-5 px-5 py-6 lg:px-8 lg:py-7 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400">MEMBERSHIP</p>
              <h1 className="mt-2 text-2xl font-semibold text-slate-950">订阅套餐</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                根据角色数量、互动方式和协作需求，选择适合当前使用节奏的套餐。
              </p>
            </div>
            <div className="flex items-center gap-3 border-t border-slate-200 pt-4 xl:border-t-0 xl:pt-0">
              <span className="flex size-9 items-center justify-center bg-slate-100 text-slate-500">
                <ShieldCheck className="size-4" />
              </span>
              <div>
                <p className="text-xs font-medium text-slate-400">当前套餐</p>
                <p className="mt-1 text-sm font-medium text-slate-800">基础版 · 正常使用中</p>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[90rem] px-5 py-8 lg:px-8">
          <section className="border border-slate-200 bg-white px-5 py-5 sm:px-6" aria-labelledby="current-plan-heading">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center bg-slate-100 text-slate-500">
                  <Bot className="size-4" />
                </span>
                <div>
                  <h2 className="text-sm font-semibold text-slate-900" id="current-plan-heading">你的基础版权益</h2>
                  <p className="mt-1 text-xs leading-5 text-slate-500">可随时在这里查看当前可用范围。</p>
                </div>
              </div>
              <div className="grid grid-cols-3 border-t border-slate-100 pt-4 text-left sm:border-t-0 sm:pt-0">
                {currentPlanDetails.map((item, index) => (
                  <div className={index === 0 ? "pr-4" : "border-l border-slate-100 px-4 last:pr-0"} key={item.label}>
                    <p className="text-[11px] font-medium text-slate-400">{item.label}</p>
                    <p className="mt-1 text-sm font-medium text-slate-700">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="mt-10" aria-labelledby="plan-options-heading">
            <div className="flex flex-col gap-2 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-medium text-slate-400">PLAN OPTIONS</p>
                <h2 className="mt-2 text-lg font-semibold text-slate-950" id="plan-options-heading">选择套餐</h2>
              </div>
              <p className="text-sm text-slate-500">所有权益清晰列示，不含隐藏限制。</p>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-3">
              {plans.map((plan) => (
                <article
                  className={plan.recommended ? "relative flex min-h-[27rem] flex-col border border-slate-900 bg-white p-6" : "flex min-h-[27rem] flex-col border border-slate-200 bg-white p-6"}
                  key={plan.name}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-950">{plan.name}</h3>
                      <p className="mt-2 max-w-xs text-sm leading-6 text-slate-600">{plan.description}</p>
                    </div>
                    <span className={plan.recommended ? "shrink-0 rounded-full bg-slate-950 px-2.5 py-1 text-[11px] font-medium text-white" : "shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600"}>
                      {plan.status}
                    </span>
                  </div>

                  <div className="mt-8 flex items-end gap-1 border-b border-slate-100 pb-6">
                    <span className="text-3xl font-semibold text-slate-950">{plan.price}</span>
                    <span className="pb-1 text-sm text-slate-400">{plan.period}</span>
                  </div>

                  <ul className="mt-6 space-y-3 text-sm text-slate-700">
                    {plan.features.map((feature) => (
                      <li className="flex items-start gap-3" key={feature}>
                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    className={plan.recommended ? "mt-auto inline-flex h-10 w-full items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50" : "mt-auto inline-flex h-10 w-full items-center justify-center rounded-md border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"}
                    disabled
                    type="button"
                  >
                    {plan.recommended ? "升级入口即将开放" : plan.name === "基础版" ? "当前套餐" : "联系团队开通"}
                  </button>
                </article>
              ))}
            </div>
          </section>

          <section className="mt-12" aria-labelledby="comparison-heading">
            <div className="flex flex-col gap-2 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-medium text-slate-400">CAPABILITIES</p>
                <h2 className="mt-2 text-lg font-semibold text-slate-950" id="comparison-heading">权益对比</h2>
              </div>
              <p className="text-sm text-slate-500">按能力边界快速比较。</p>
            </div>

            <div className="mt-6 overflow-x-auto border border-slate-200 bg-white">
              <div className="min-w-[38rem]">
                <div className="grid grid-cols-[minmax(12rem,1.5fr)_repeat(3,minmax(7rem,1fr))] border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-medium text-slate-500">
                  <span>能力</span>
                  <span className="text-center">基础版</span>
                  <span className="text-center">专业版</span>
                  <span className="text-center">团队版</span>
                </div>
                {comparisons.map((row) => (
                  <div className="grid grid-cols-[minmax(12rem,1.5fr)_repeat(3,minmax(7rem,1fr))] border-b border-slate-100 px-5 py-4 text-sm last:border-b-0" key={row.feature}>
                    <span className="font-medium text-slate-700">{row.feature}</span>
                    <span className="text-center text-slate-500"><CapabilityValue value={row.basic} /></span>
                    <span className="text-center text-slate-500"><CapabilityValue value={row.pro} /></span>
                    <span className="text-center text-slate-500"><CapabilityValue value={row.team} /></span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="mt-12 border-t border-slate-200 pt-8" aria-labelledby="faq-heading">
            <div className="flex items-center gap-2">
              <HelpCircle className="size-4 text-slate-400" />
              <h2 className="text-lg font-semibold text-slate-950" id="faq-heading">常见问题</h2>
            </div>
            <div className="mt-5 divide-y divide-slate-200 border-y border-slate-200 bg-white px-5 sm:px-6">
              {faqs.map((faq) => (
                <details className="group py-4" key={faq.question}>
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium text-slate-800">
                    {faq.question}
                    <span className="text-slate-400 transition-transform group-open:rotate-45">+</span>
                  </summary>
                  <p className="max-w-3xl pt-3 text-sm leading-6 text-slate-500">{faq.answer}</p>
                </details>
              ))}
            </div>
          </section>
        </section>
      </main>
    </DashboardShell>
  )
}
