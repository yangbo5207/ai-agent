import app from './app'
import type { ApiBindings } from './bindings'
import { processDueBackgroundSkillJobs } from './skills/background-processor'

export default {
  fetch: app.fetch,
  scheduled(_controller: ScheduledController, env: ApiBindings, context: ExecutionContext) {
    context.waitUntil(processDueBackgroundSkillJobs(env))
  },
} satisfies ExportedHandler<ApiBindings>
