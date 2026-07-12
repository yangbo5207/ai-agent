import { Hono } from 'hono'
import type { ApiBindings } from '@/bindings'
import adminAuthRoute from './auth/admin.route'
import webAuthRoute from './auth/web.route'
import myAgentRoute from './agent/my.route'
import catalogRoute from './catalog/list.route'
import groupChatRoute from './chat/group.route'
import inboxChatRoute from './chat/inbox.route'
import financialBillRoute from './financial/bill.route'
import imageGenerationProxyRoute from './image-generation/proxy.route'
import llmTestConnectionRoute from './llm/test-connection.route'
import orderRoute from './order/detail.route'
import roleRoute from './role/management.route'
import subscriptionPlanRoute from './subscription/plan.route'
import subscriptionUserRoute from './subscription/user.route'
import healthRoute from './system/health.route'
import pingRoute from './system/ping.route'
import userRoute from './user/profile.route'

const routes = new Hono<{ Bindings: ApiBindings }>()

const appRoutes = routes
  .route('/health', healthRoute)
  .route('/auth/admin', adminAuthRoute)
  .route('/auth/web', webAuthRoute)
  .route('/rpc/agent/my', myAgentRoute)
  .route('/rpc/system/ping', pingRoute)
  .route('/rpc/catalog', catalogRoute)
  .route('/rpc/chat/group', groupChatRoute)
  .route('/rpc/chat/inbox', inboxChatRoute)
  .route('/rpc/financial/bill', financialBillRoute)
  .route('/rpc/image-generation', imageGenerationProxyRoute)
  .route('/rpc/llm/test-connection', llmTestConnectionRoute)
  .route('/rpc/user', userRoute)
  .route('/rpc/role', roleRoute)
  .route('/rpc/subscription/plan', subscriptionPlanRoute)
  .route('/rpc/subscription/user', subscriptionUserRoute)
  .route('/rpc/order', orderRoute)

export type RoutesType = typeof appRoutes

export default appRoutes
