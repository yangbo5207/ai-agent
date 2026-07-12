import {
  BadgePercent,
  Banknote,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Coins,
  MessageCircle,
  Receipt,
  ShieldCheck,
  Sparkles,
  TicketPercent,
  TrendingDown,
  WalletCards,
  Zap,
} from "lucide-react"

import { DashboardShell } from "../_components/dashboard-shell"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const regularPlans = [
  {
    name: "日常版",
    tag: "新增",
    price: 200,
    dailyLimit: "30 美元/日",
    weeklyLimit: "150 美元/周",
    monthlyLimit: "600 美元/月",
    usage: [
      "GPT-5.6：日常开发与 Agent 协作",
      "稳定额度：适合持续使用",
    ],
    borderClassName: "border-slate-900",
    toneClassName: "bg-slate-950 text-white",
  },
  {
    name: "Pro 5X",
    tag: "推荐",
    price: 560,
    dailyLimit: "60 美元/日",
    weeklyLimit: "360 美元/周",
    monthlyLimit: "1440 美元/月",
    usage: [
      "5.4 High：单线程 8-10 小时",
      "5.5 XHigh：单线程 4-5 小时",
    ],
    borderClassName: "border-emerald-200",
    toneClassName: "bg-emerald-50 text-emerald-700",
  },
  {
    name: "Pro 10X",
    tag: "进阶",
    price: 900,
    dailyLimit: "120 美元/日",
    weeklyLimit: "720 美元/周",
    monthlyLimit: "2880 美元/月",
    usage: [
      "5.4 High：单线程 16-20 小时",
      "5.5 XHigh：单线程 8-10 小时",
    ],
    borderClassName: "border-lime-200",
    toneClassName: "bg-lime-50 text-lime-700",
  },
  {
    name: "Pro 20X",
    tag: "顶级",
    price: 1800,
    dailyLimit: "240 美元/日",
    weeklyLimit: "1440 美元/周",
    monthlyLimit: "5760 美元/月",
    usage: [
      "5.4 High：单线程 32-40 小时",
      "5.5 XHigh：单线程 16-20 小时",
    ],
    borderClassName: "border-cyan-200",
    toneClassName: "bg-cyan-50 text-cyan-700",
  },
]

const pro5xOriginalMonthlyPrice = 560
const pro5xMonthlyDealBaselinePrice = 400
const pro5xDeals = [
  {
    title: "单月体验",
    months: 1,
    salePrice: 400,
    badge: "立刻开通",
    description: "适合先体验 tocodex.space Pro 5X 通道稳定性的用户。",
    spanClassName: "",
  },
  {
    title: "季度锁价",
    months: 3,
    salePrice: 1000,
    badge: "推荐周期",
    description: "比逐月购买更稳，适合已经确认要持续使用 Codex 的用户。",
    recommended: true,
    spanClassName: "md:col-span-2 2xl:col-span-1",
  },
  {
    title: "半年省心",
    months: 6,
    salePrice: 1850,
    badge: "长期优惠",
    description: "适合高频开发、长期技术写作和多项目并行使用。",
    spanClassName: "",
  },
  {
    title: "全年通道",
    months: 12,
    salePrice: 3600,
    badge: "最大优惠",
    description: "全年锁定 Pro 5X 优惠价，适合重度 Codex 使用者。",
    spanClassName: "md:col-span-2 2xl:col-span-1",
  },
]

const highlights = [
  { label: "已支持模型", value: "GPT-5.6", icon: Sparkles },
  { label: "日常原价", value: "¥560/月", icon: Receipt },
  { label: "单月基准", value: "¥400/月", icon: Banknote },
  { label: "最低月均", value: "¥300/月", icon: TrendingDown },
  { label: "560 最高省", value: "¥3120", icon: BadgePercent },
  { label: "400 最高省", value: "¥1200", icon: TicketPercent },
]

const policyItems = [
  "购买后单独开通 Pro 套餐，支持 GPT-5.6、GPT-5.5 与 GPT-5.4 模型稳定调用。",
  "独享 API Key 与高速通道，适合 Codex、Agent、技术写作和自动化开发场景。",
  "本活动仅针对 Pro 5X 做周期优惠；Pro 10X 与 Pro 20X 仍按日常套餐价格展示。",
]

const topUpPack = {
  name: "月包加油包",
  price: 100,
  credit: "200 美元",
  validity: "开通起 1 个月",
  usage: "额度内不限制使用",
}

const recommendationStats = [
  { label: "原价总额", value: "¥6720", helper: "按 ¥560/月", valueClassName: "text-slate-700" },
  { label: "活动节省", value: "¥3120", helper: "相对日常原价", valueClassName: "text-emerald-700" },
  { label: "优惠节省", value: "¥1200", helper: "相对 ¥400/月", valueClassName: "text-slate-700" },
  { label: "月均成本", value: "¥300", helper: "全年平均", valueClassName: "text-slate-700" },
]

const selectionGuideItems = [
  {
    title: "想先试用",
    plan: "单月体验",
    description: "先确认 tocodex.space Pro 5X 通道是否适合自己的日常开发节奏。",
    saving: "按 560 省 ¥160",
  },
  {
    title: "连续开发",
    plan: "季度锁价",
    description: "适合已经确定要持续使用 Codex，但暂时不想一次性锁定太久的用户。",
    saving: "按 400 省 ¥200",
  },
  {
    title: "长期高频",
    plan: "半年省心",
    description: "适合多项目并行、长期技术写作、经常需要高频调用模型的使用方式。",
    saving: "按 400 省 ¥550",
  },
  {
    title: "重度使用",
    plan: "全年通道",
    description: "适合每天稳定使用 Codex，希望把月均成本压到最低的长期用户。",
    saving: "按 400 省 ¥1200",
  },
]

const offerStatusItems = [
  { label: "套餐", value: "Pro 5X", helper: "本次优惠" },
  { label: "周期", value: "4 档", helper: "1 / 3 / 6 / 12 月" },
  { label: "最低月均", value: "¥300", helper: "全年通道" },
]

function formatCurrency(value: number) {
  return `¥${value.toLocaleString("zh-CN")}`
}

function getDealMetrics(months: number, salePrice: number) {
  const originalPrice = pro5xOriginalMonthlyPrice * months
  const dealBaselinePrice = pro5xMonthlyDealBaselinePrice * months
  const saved = originalPrice - salePrice
  const savedByDealBaseline = Math.max(0, dealBaselinePrice - salePrice)
  const monthlyAverage = Math.round(salePrice / months)
  const discount = (salePrice / originalPrice) * 10
  const dealBaselineDiscount = (salePrice / dealBaselinePrice) * 10

  return {
    originalPrice,
    dealBaselinePrice,
    saved,
    savedByDealBaseline,
    monthlyAverage,
    discount,
    dealBaselineDiscount,
  }
}

function formatDiscount(value: number) {
  return `${value.toFixed(1)} 折`
}

export default function BuyTokensPage() {
  const bestDeal = pro5xDeals.reduce((currentBest, deal) => {
    const currentSaved = getDealMetrics(deal.months, deal.salePrice).saved
    const bestSaved = getDealMetrics(currentBest.months, currentBest.salePrice).saved

    return currentSaved > bestSaved ? deal : currentBest
  }, pro5xDeals[0]!)

  return (
    <DashboardShell title="购买 Token">
      <main className="min-h-[calc(100vh-4rem)] bg-slate-50/70">
        <section className="border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-7xl px-4 py-7 sm:px-5 sm:py-8 lg:px-8">
            <div className="grid gap-6">
              <div className="flex min-w-0 gap-3 sm:gap-4">
                <div className="hidden size-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 sm:flex">
                  <Coins className="size-5" />
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium text-slate-400">
                    <span>tocodex.space</span>
                    <span className="h-px w-8 bg-slate-200" />
                    <span>Token Offer</span>
                  </div>
                  <h1 className="mt-2 text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl">
                    Token 套餐与优惠
                  </h1>
                  <p className="mt-2 max-w-5xl text-[15px] leading-7 text-slate-600">
                    日常套餐、月包加油包与 Pro 5X 长周期优惠会在同一处展示，方便按使用频率、额度和购买周期进行判断。
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-slate-100 px-2.5 text-[11px] font-medium text-slate-500">
                      <ShieldCheck className="size-3.5" />
                      独享 API Key
                    </span>
                    <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-slate-100 px-2.5 text-[11px] font-medium text-slate-500">
                      <Zap className="size-3.5" />
                      高速通道
                    </span>
                    <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-slate-100 px-2.5 text-[11px] font-medium text-slate-500">
                      <Sparkles className="size-3.5" />
                      GPT-5.6 / GPT-5.5 / GPT-5.4
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid w-full grid-cols-2 gap-px overflow-hidden border border-slate-200 bg-slate-100 sm:grid-cols-3 xl:grid-cols-6">
                {highlights.map((item) => {
                  const Icon = item.icon

                  return (
                    <div
                      className="flex min-w-0 items-center gap-3 bg-white px-3 py-3"
                      key={item.label}
                    >
                      <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                        <Icon className="size-3.5" />
                      </div>
                      <p className="min-w-0 flex-1 text-xs font-medium text-slate-400">{item.label}</p>
                      <p className="shrink-0 text-sm font-medium leading-none text-slate-700">{item.value}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </section>

        <section className="px-4 py-8 sm:px-5 sm:py-10 lg:px-8">
          <div className="mx-auto max-w-7xl space-y-10">
            <div className="grid gap-5">
              <section>
                <div className="grid gap-5">
                  <article className="rounded-md border border-slate-200 bg-white p-5 sm:p-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <p className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                          <WalletCards className="size-4 text-slate-500" />
                          日常套餐透明定价
                        </p>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                          日常版新增 ¥200/月档位；Pro 5X 长周期优惠仍同时展示两个节省口径：按日常原价 ¥560/月计算，以及按单月优惠价 ¥400/月计算。
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-y-3 border-t border-slate-200 pt-3 sm:w-[38rem] sm:grid-cols-5 sm:gap-y-0 sm:border-t-0 sm:pt-0">
                        {[
                          { label: "日常版", value: "¥200/月" },
                          { label: "5X 原价", value: "¥560/月" },
                          { label: "5X 单月", value: "¥400/月" },
                          { label: "10X 原价", value: "¥900/月" },
                          { label: "20X 原价", value: "¥1800/月" },
                        ].map((item, index) => (
                          <div
                            className={cn(
                              "px-3 first:pl-0 sm:px-4 sm:first:pl-0 sm:last:pr-0",
                              index % 2 === 1 && "border-l border-slate-200",
                              index > 1 && "border-t border-slate-100 pt-3 sm:border-t-0 sm:pt-0",
                              index > 0 && "sm:border-l sm:border-slate-200",
                            )}
                            key={item.label}
                          >
                            <p className="text-[10px] font-medium text-slate-400">{item.label}</p>
                            <p className="mt-1 text-sm font-medium text-slate-700">{item.value}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </article>

                  <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-4">
                    {regularPlans.map((plan) => (
                      <article
                        className={cn(
                          "flex h-full flex-col rounded-md border bg-white p-5 sm:p-6",
                          plan.borderClassName,
                        )}
                        key={plan.name}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <span className={cn("inline-flex h-6 items-center rounded-full px-2.5 text-[11px] font-medium", plan.toneClassName)}>
                              {plan.tag}
                            </span>
                            <h2 className="mt-4 text-2xl font-semibold tracking-tight text-slate-950">{plan.name}</h2>
                          </div>
                          <Coins className="size-5 text-slate-300" />
                        </div>

                        <div className="mt-7 flex items-end justify-center gap-1 sm:mt-8">
                          <span className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                            {formatCurrency(plan.price)}
                          </span>
                          <span className="pb-1 text-sm text-slate-500">/月</span>
                        </div>

                        <p className="mt-4 text-center text-sm leading-6 text-slate-600">
                          付费之后，单独开启 Pro 套餐，支持 GPT-5.6、GPT-5.5 与 GPT-5.4 模型稳定调用。
                        </p>

                        <div className="mt-6 border-y border-slate-200 py-4">
                          {[
                            { label: "使用体验", value: plan.usage },
                            { label: "每日限制", value: plan.dailyLimit },
                            { label: "每周限制", value: plan.weeklyLimit },
                            { label: "每月限制", value: plan.monthlyLimit },
                          ].map(({ label, value }) => (
                            <div className="grid gap-1 py-2 text-sm sm:flex sm:items-start sm:justify-between sm:gap-4" key={label}>
                              <span className="text-slate-400">{label}</span>
                              {Array.isArray(value) ? (
                                <span className="grid gap-1 font-medium text-slate-800 sm:text-right">
                                  {value.map((item) => (
                                    <span key={item}>{item}</span>
                                  ))}
                                </span>
                              ) : (
                                <span className="font-medium text-slate-800 sm:text-right">{value}</span>
                              )}
                            </div>
                          ))}
                        </div>

                        <ul className="mt-5 space-y-3 text-sm font-medium text-slate-700">
                          {["GPT-5.6 可用", "GPT-5.5 / GPT-5.4 可用", "独享 API Key & 高速通道"].map((feature) => (
                            <li className="flex items-center gap-3" key={feature}>
                              <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
                              <span>{feature}</span>
                            </li>
                          ))}
                        </ul>

                        <Button className="mt-6 w-full rounded-md" disabled type="button">
                          咨询开通
                        </Button>
                      </article>
                    ))}
                  </div>
                </div>
              </section>

              <section className="rounded-md border border-slate-200 bg-white">
                <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_14rem] lg:items-end">
                  <div>
                    <p className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                      <Zap className="size-4 text-slate-500" />
                      {topUpPack.name}
                    </p>
                    <h2 className="mt-2 text-xl font-semibold text-slate-950">一个月内自由使用的补充额度</h2>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                      适合短期高强度开发、批量任务或临时项目需求。开通后在一个月以内不限制使用频率，仅受总额度约束。
                    </p>
                  </div>
                  <div className="border-t border-slate-200 pt-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
                    <p className="text-[10px] font-medium text-slate-400">加油包价格</p>
                    <p className="mt-1 text-3xl font-semibold text-slate-950">{formatCurrency(topUpPack.price)}</p>
                    <Button className="mt-4 w-full rounded-md" disabled type="button" variant="outline">
                      加油包即将开放
                    </Button>
                  </div>
                </div>
                <div className="grid border-t border-slate-200 sm:grid-cols-3">
                  {[
                    { label: "总额度", value: topUpPack.credit },
                    { label: "有效期", value: topUpPack.validity },
                    { label: "使用限制", value: topUpPack.usage },
                  ].map((item, index) => (
                    <div
                      className={cn("px-5 py-5 sm:px-6", index > 0 && "border-t border-slate-100 sm:border-l sm:border-t-0")}
                      key={item.label}
                    >
                      <p className="text-[10px] font-medium text-slate-400">{item.label}</p>
                      <p className="mt-2 text-sm font-semibold text-slate-800">{item.value}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2 2xl:grid-cols-4">
                  <article className="rounded-md bg-slate-950 p-5 text-white sm:p-6 md:col-span-2 2xl:col-span-4">
                    <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
                      <div>
                        <p className="flex items-center gap-2 text-sm font-semibold text-white">
                          <TicketPercent className="size-4 text-emerald-300" />
                          Pro 5X 专属优惠
                        </p>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                          同时展示两套节省：按日常原价 ¥560/月最高省 ¥3120；按单月优惠基准 ¥400/月最高仍省 ¥1200。
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-y-3 border-t border-white/15 pt-3 sm:min-w-[30rem] sm:grid-cols-4 sm:gap-y-0 sm:border-t-0 sm:pt-0">
                        {[
                          { label: "日常基准", value: "¥560/月" },
                          { label: "单月基准", value: "¥400/月" },
                          { label: "最低月均", value: "¥300/月" },
                          { label: "最高折扣", value: "5.4 折" },
                        ].map((item, index) => (
                          <div
                            className={cn(
                              index === 0 ? "pr-3 sm:pr-4" : "border-l border-white/15 pl-3 sm:px-4 sm:last:pr-0",
                              index > 1 && "border-t border-white/10 pt-3 sm:border-t-0 sm:pt-0",
                            )}
                            key={item.label}
                          >
                            <p className="text-[10px] font-medium text-slate-400">{item.label}</p>
                            <p className="mt-1 text-sm font-medium leading-none text-white">{item.value}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </article>

                  {pro5xDeals.map((deal) => {
                    const metrics = getDealMetrics(deal.months, deal.salePrice)
                    const isBestDeal = deal.title === bestDeal.title

                    return (
                      <article
                        className={cn(
                          deal.spanClassName,
                          "relative flex min-h-[30rem] flex-col rounded-md border border-slate-200 bg-white p-5 sm:p-6",
                          deal.recommended && "bg-slate-100",
                        )}
                        key={deal.title}
                      >
                        {deal.recommended ? <span className="absolute inset-x-5 top-0 h-px bg-slate-950" /> : null}

                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <span
                              className={cn(
                                "inline-flex h-6 items-center rounded-full px-2.5 text-[11px] font-medium",
                                deal.recommended ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-600",
                              )}
                            >
                              {deal.badge}
                            </span>
                            <h3 className="mt-4 text-xl font-semibold tracking-tight text-slate-950">{deal.title}</h3>
                            <p className="mt-2 text-sm leading-6 text-slate-600">{deal.description}</p>
                          </div>
                          <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-white text-slate-500 ring-1 ring-inset ring-slate-200">
                            <Clock3 className="size-4" />
                          </span>
                        </div>

                        <div className="mt-6 flex items-end gap-2">
                          <span className="text-3xl font-semibold tracking-tight text-slate-950">
                            {formatCurrency(deal.salePrice)}
                          </span>
                          <span className="pb-1 text-sm text-slate-500">/{deal.months === 1 ? "月" : `${deal.months} 月`}</span>
                        </div>
                        <p className="mt-2 text-sm text-slate-400">
                          原价 <span className="line-through">{formatCurrency(metrics.originalPrice)}</span>
                          <span className="mx-2">·</span>
                          月均 {formatCurrency(metrics.monthlyAverage)}
                        </p>

                        <div className="mt-5 grid grid-cols-2 border-y border-slate-200 py-3">
                          <div className="pr-3">
                            <p className="text-[10px] font-medium text-slate-400">按 560 省</p>
                            <p className="mt-1 text-sm font-semibold text-emerald-700">{formatCurrency(metrics.saved)}</p>
                          </div>
                          <div className="border-l border-slate-200 pl-3">
                            <p className="text-[10px] font-medium text-slate-400">按 400 省</p>
                            <p className="mt-1 text-sm font-semibold text-slate-800">{formatCurrency(metrics.savedByDealBaseline)}</p>
                          </div>
                          <div className="mt-3 border-t border-slate-100 pr-3 pt-3">
                            <p className="text-[10px] font-medium text-slate-400">折扣</p>
                            <p className="mt-1 text-sm font-semibold text-slate-800">{formatDiscount(metrics.discount)}</p>
                          </div>
                          <div className="mt-3 border-l border-t border-slate-100 pl-3 pt-3">
                            <p className="text-[10px] font-medium text-slate-400">周期</p>
                            <p className="mt-1 text-sm font-semibold text-slate-800">{deal.months} 月</p>
                          </div>
                        </div>

                        <Button className="mt-6 w-full rounded-md" disabled={!isBestDeal} type="button" variant={isBestDeal ? "default" : "outline"}>
                          {isBestDeal ? "最大优惠方案" : "咨询购买"}
                        </Button>
                      </article>
                    )
                  })}
                </div>
              </section>

              <section className="rounded-md border border-slate-200 bg-white p-5 sm:p-6">
                <div className="flex flex-col gap-2 border-b border-slate-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                      <Receipt className="size-4 text-slate-500" />
                      原价与优惠对比
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      下面同时展示两种节省金额：一列按日常原价 ¥560/月计算，一列按单月优惠基准 ¥400/月计算。
                    </p>
                  </div>
                  <span className="text-[11px] font-medium text-slate-400">Savings matrix</span>
                </div>

                <div className="mt-4 grid gap-3 sm:hidden">
                  {pro5xDeals.map((deal) => {
                    const metrics = getDealMetrics(deal.months, deal.salePrice)

                    return (
                      <div className="border-t border-slate-100 pt-3 first:border-t-0 first:pt-0" key={deal.title}>
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-slate-800">{deal.title}</p>
                          <p className="text-sm font-semibold text-slate-950">{formatCurrency(deal.salePrice)}</p>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <p className="text-slate-400">560 基准</p>
                            <p className="mt-1 text-slate-500 line-through">{formatCurrency(metrics.originalPrice)}</p>
                          </div>
                          <div>
                            <p className="text-slate-400">400 基准</p>
                            <p className="mt-1 text-slate-500 line-through">{formatCurrency(metrics.dealBaselinePrice)}</p>
                          </div>
                          <div>
                            <p className="text-slate-400">月均</p>
                            <p className="mt-1 font-medium text-slate-700">{formatCurrency(metrics.monthlyAverage)}</p>
                          </div>
                          <div>
                            <p className="text-slate-400">560 折扣</p>
                            <p className="mt-1 font-medium text-slate-700">{formatDiscount(metrics.discount)}</p>
                          </div>
                          <div>
                            <p className="text-slate-400">按 560 省</p>
                            <p className="mt-1 font-semibold text-emerald-700">{formatCurrency(metrics.saved)}</p>
                          </div>
                          <div>
                            <p className="text-slate-400">按 400 省</p>
                            <p className="mt-1 font-semibold text-slate-700">{formatCurrency(metrics.savedByDealBaseline)}</p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div className="mt-4 hidden overflow-x-auto sm:block">
                  <div className="min-w-[52rem]">
                    <div className="grid grid-cols-8 border-b border-slate-200 pb-3 text-xs font-semibold text-slate-500">
                      <span>购买周期</span>
                      <span className="text-center">560 基准</span>
                      <span className="text-center">400 基准</span>
                      <span className="text-center">活动价</span>
                      <span className="text-center">月均</span>
                      <span className="text-center">按 560 省</span>
                      <span className="text-center">按 400 省</span>
                      <span className="text-right">560 折扣</span>
                    </div>
                    {pro5xDeals.map((deal) => {
                      const metrics = getDealMetrics(deal.months, deal.salePrice)

                      return (
                        <div
                          className="grid grid-cols-8 border-b border-slate-100 py-3 text-sm last:border-b-0"
                          key={deal.title}
                        >
                          <span className="font-medium text-slate-800">{deal.title}</span>
                          <span className="text-center text-slate-500 line-through">{formatCurrency(metrics.originalPrice)}</span>
                          <span className="text-center text-slate-500 line-through">{formatCurrency(metrics.dealBaselinePrice)}</span>
                          <span className="text-center font-semibold text-slate-950">{formatCurrency(deal.salePrice)}</span>
                          <span className="text-center text-slate-700">{formatCurrency(metrics.monthlyAverage)}</span>
                          <span className="text-center font-semibold text-emerald-700">{formatCurrency(metrics.saved)}</span>
                          <span className="text-center font-semibold text-slate-700">{formatCurrency(metrics.savedByDealBaseline)}</span>
                          <span className="text-right text-slate-700">{formatDiscount(metrics.discount)}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </section>
            </div>

            <div className="grid w-full gap-6 lg:grid-cols-2">
              <section className="overflow-hidden rounded-md border border-slate-200 bg-white lg:col-span-2">
                <div className="grid gap-6 p-5 sm:p-6 sm:grid-cols-[minmax(0,1fr)_13rem] sm:items-end">
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white">
                        <BadgePercent className="size-4" />
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-slate-950">推荐购买</p>
                        <p className="mt-1 text-xs leading-5 text-slate-400">全年通道节省最多，月均成本最低。</p>
                      </div>
                    </div>

                    <div className="mt-6 flex items-end gap-2">
                      <span className="text-4xl font-semibold tracking-tight text-slate-950">¥3600</span>
                      <span className="pb-1.5 text-sm text-slate-500">/ 年</span>
                    </div>
                    <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
                      按 ¥560/月日常原价计算，全年原价 ¥6720，活动价直接节省 ¥3120；即使按 ¥400/月单月优惠基准计算，也仍然节省 ¥1200。
                    </p>
                  </div>

                  <div className="border-t border-slate-200 pt-4 sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0">
                    <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-slate-400">best value</p>
                    <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">¥300</p>
                    <p className="mt-1 text-xs text-slate-500">最低月均成本</p>
                    <Button className="mt-4 w-full rounded-md" disabled type="button">
                      联系开通
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 border-t border-slate-100 sm:grid-cols-4">
                  {recommendationStats.map((item, index) => (
                    <div
                      className={cn(
                        "p-4",
                        index > 1 && "border-t border-slate-100 sm:border-t-0",
                        index % 2 === 1 && "border-l border-slate-100",
                        index > 0 && "sm:border-l sm:border-t-0",
                      )}
                      key={item.label}
                    >
                      <p className="text-[10px] font-medium text-slate-400">{item.label}</p>
                      <p className={cn("mt-2 text-lg font-semibold tracking-tight", item.valueClassName)}>
                        {item.value}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-slate-400">{item.helper}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-md border border-slate-200 bg-white p-5 sm:p-6">
                <div className="flex items-start gap-3 border-b border-slate-200 pb-4">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                    <CircleDollarSign className="size-4" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-slate-950">怎么选择</p>
                    <p className="mt-1 text-sm leading-6 text-slate-500">
                      根据你的使用频率从上到下判断，越长期的周期越适合稳定、高频的 Codex 使用场景。
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid gap-0">
                  {selectionGuideItems.map((item, index) => (
                    <div
                      className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3 border-t border-slate-100 py-4 first:border-t-0 first:pt-0 last:pb-0"
                      key={item.title}
                    >
                      <div className="flex flex-col items-center">
                        <span className="flex size-7 items-center justify-center rounded-full bg-slate-950 text-xs font-semibold text-white">
                          {index + 1}
                        </span>
                        {index < selectionGuideItems.length - 1 ? (
                          <span className="mt-2 h-full min-h-8 w-px bg-slate-100" />
                        ) : null}
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                          <span className="inline-flex h-6 items-center rounded-full bg-slate-100 px-2.5 text-[11px] font-medium text-slate-500">
                            {item.plan}
                          </span>
                          <span className="inline-flex h-6 items-center rounded-full bg-emerald-50 px-2.5 text-[11px] font-medium text-emerald-700">
                            {item.saving}
                          </span>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-slate-500">{item.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-md border border-slate-200 bg-white p-5 sm:p-6">
                <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-4">
                  <div className="flex items-start gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                      <MessageCircle className="size-4" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-slate-950">活动说明</p>
                      <p className="mt-1 text-sm leading-6 text-slate-500">购买前需要确认的开通范围和使用边界。</p>
                    </div>
                  </div>
                  <span className="hidden text-[11px] font-medium text-slate-400 sm:inline">Policy</span>
                </div>

                <div className="mt-5 grid gap-3">
                  {policyItems.map((item, index) => (
                    <div className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-3" key={item}>
                      <span className="flex size-7 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-400">
                        {index + 1}
                      </span>
                      <p className="text-sm leading-6 text-slate-600">{item}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-md border border-slate-200 bg-white p-5 sm:p-6 lg:col-span-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">优惠状态</p>
                    <p className="mt-1 text-sm leading-6 text-slate-500">当前页面展示的是 Pro 5X 周期优惠方案。</p>
                  </div>
                  <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                    <Banknote className="size-3.5" />
                    active
                  </span>
                </div>

                <div className="mt-5 grid border-t border-slate-100 pt-4 sm:grid-cols-3">
                  {offerStatusItems.map((item, index) => (
                    <div
                      className={cn(
                        "py-3 first:pt-0 last:pb-0 sm:px-4 sm:py-0",
                        index > 0 && "border-t border-slate-100 sm:border-l sm:border-t-0",
                        index === 0 && "sm:pl-0",
                        index === offerStatusItems.length - 1 && "sm:pr-0",
                      )}
                      key={item.label}
                    >
                      <p className="text-[10px] font-medium text-slate-400">{item.label}</p>
                      <p className="mt-2 text-base font-semibold text-slate-800">{item.value}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-400">{item.helper}</p>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </section>
      </main>
    </DashboardShell>
  )
}
