import { z } from 'zod'
import { eq, sql } from 'drizzle-orm'
import {
  agentConversationMessages,
} from '@/db/schema'
import {
  findDefaultAgentConversation,
  updateAgentConversationAfterMessage,
  updateUserAgentCompanionLatestAssistantMessage,
} from '@/auth/repository'
import type { BackgroundSkillDefinition } from '../../core/types'

export const goalCheckInPayloadSchema = z.object({
  agentId: z.string().trim().min(1),
  agentName: z.string().trim().min(1).max(80),
  conversationId: z.string().trim().min(1),
  note: z.string().trim().max(500).nullable(),
})

export const goalCheckInReminderSkill: BackgroundSkillDefinition = {
  manifest: {
    id: 'goal-check-in-reminder',
    version: '1.0.0',
    name: '目标复盘提醒',
    description: '在你指定的时间，由电子伴侣主动发起一次目标进展复盘。',
    kind: 'background',
    scopes: ['background'],
    triggerExamples: ['明天晚上提醒我复盘目标', '安排一次目标回顾'],
    priority: 70,
    enabledByDefault: true,
    permissions: [{
      code: 'proactive_message:write',
      riskLevel: 'L2',
      approvalMode: 'persistent',
    }],
  },
  payloadSchema: goalCheckInPayloadSchema,
  maxAttempts: 3,
  async execute({ db, userId, jobId, value }) {
    const payload = goalCheckInPayloadSchema.parse(value)
    const conversation = await findDefaultAgentConversation(db, {
      userId,
      agentId: payload.agentId,
    })

    if (!conversation || conversation.id !== payload.conversationId) {
      throw new Error('Background Skill conversation is unavailable')
    }

    const noteLine = payload.note ? `你当时留下的关注点是：“${payload.note}”` : '我们可以从完成了什么、遇到什么阻碍、下一步做什么开始。'
    const message = `我们约定的目标复盘时间到了。${noteLine} 现在进展到哪里了？`
    const nowMs = Date.now()
    const inserted = await db
      .insert(agentConversationMessages)
      .values({
        id: jobId,
        conversationId: conversation.id,
        userId,
        agentId: payload.agentId,
        role: 'assistant',
        content: message,
        status: 'completed',
        metadataJson: JSON.stringify({ source: 'skill_background', skillId: 'goal-check-in-reminder', jobId }),
        createdAtMs: nowMs,
      })
      .onConflictDoNothing()
      .returning({ id: agentConversationMessages.id })

    const countRow = await db
      .select({ count: sql<number>`count(*)` })
      .from(agentConversationMessages)
      .where(eq(agentConversationMessages.conversationId, conversation.id))
      .get()

    await updateUserAgentCompanionLatestAssistantMessage({
      db,
      userId,
      agentId: payload.agentId,
      message,
      nowMs,
    })
    await updateAgentConversationAfterMessage({
      db,
      userId,
      agentId: payload.agentId,
      conversationId: conversation.id,
      summary: conversation.summary,
      messageCount: Number(countRow?.count ?? conversation.messageCount + (inserted.length === 1 ? 1 : 0)),
      lastMessageAtMs: nowMs,
      nowMs,
    })
  },
}
