import { Hono } from 'hono'
import catalogRoute from './catalog/list.route'
import orderRoute from './order/detail.route'
import healthRoute from './system/health.route'
import pingRoute from './system/ping.route'
import userRoute from './user/profile.route'

type Bindings = {
  APP_ENV: 'development' | 'test' | 'production'
}

const routes = new Hono<{ Bindings: Bindings }>()

const appRoutes = routes
  .route('/health', healthRoute)
  .route('/rpc/system/ping', pingRoute)
  .route('/rpc/catalog', catalogRoute)
  .route('/rpc/user', userRoute)
  .route('/rpc/order', orderRoute)

export type RoutesType = typeof appRoutes

export default appRoutes
