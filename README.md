# 付费小册

本实战项目是付费小册[AI Agent 企业级实战](https://aicompanion.usehook.cn/) 中一点一点实现的详细案例，要深入学习的朋友可以购买学习，目前小册已经更新 234 章，讲得很详细，欢迎大家了解

# AI Agent

这是一个基于 pnpm workspace + Turborepo 的 monorepo，包含：

- `apps/api`: Cloudflare Workers / Hono API
- `apps/web`: Web 用户端，Next.js，默认端口 `3005`
- `apps/admin`: Admin 管理端，Next.js，默认端口 `3006`
- `packages/*`: 共享 UI、contracts、ESLint 和 TypeScript 配置

## 环境要求

- Node.js `>= 18`
- pnpm `10.33.1`

建议使用 Corepack 启用 pnpm：

```bash
node -v
corepack enable
corepack prepare pnpm@10.33.1 --activate
pnpm -v
```

如果执行 `corepack prepare` 时遇到 `Cannot find matching keyid`，通常是本机 Corepack 版本过旧，先升级：

```bash
npm install -g corepack@latest
corepack enable
corepack prepare pnpm@10.33.1 --activate
```

也可以临时直接安装 pnpm：

```bash
npm install -g pnpm@10.33.1
```

## 安装依赖

在项目根目录执行：

```bash
pnpm install
```

## 准备环境变量

复制本地环境变量文件：

```bash
cp apps/api/.dev.vars.example apps/api/.dev.vars
cp apps/web/.env.example apps/web/.env.local
cp apps/admin/.env.example apps/admin/.env.local
```

如果需要使用聊天或 LLM 能力，可以在 `apps/api/.dev.vars` 中补充：

```bash
DEEPSEEK_API_KEY=你的_key
```

GitHub OAuth 是可选配置；只验证密码登录时可以先不填写。

## 初始化本地 D1 数据库

首次本地运行前，执行 D1 migration 和 seed：

```bash
pnpm --filter @repo/api db:migrate:local
pnpm --filter @repo/api db:seed:local
```

## 启动项目

建议首次本地调试时分别开三个终端，方便定位哪个服务报错。

启动 API：

```bash
pnpm dev:api
```

启动 Web 用户端：

```bash
pnpm dev:web
```

启动 Admin 管理端：

```bash
pnpm dev:admin
```

访问地址：

- Web 用户端: http://localhost:3005
- Admin 管理端: http://localhost:3006
- API: http://127.0.0.1:8787

也可以一次性启动所有服务：

```bash
pnpm dev
```

## 本地默认账号

Admin 管理端：

```txt
admin@example.com
Admin123456!
```

Web 用户端：

```txt
user01@example.com
Admin123456!
```

## 常用命令

```bash
pnpm lint
pnpm check-types
pnpm build
```

单独启动某个应用：

```bash
pnpm dev:api
pnpm dev:web
pnpm dev:admin
```

本地 D1：

```bash
pnpm --filter @repo/api db:migrate:local
pnpm --filter @repo/api db:seed:local
```
