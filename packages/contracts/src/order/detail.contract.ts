import { z } from 'zod'

export const OrderDetailRequestSchema = z.object({
  id: z.string().trim().min(1),
})

export type OrderDetailRequest = z.infer<typeof OrderDetailRequestSchema>

export const OrderDetailResponseSchema = z.object({
  id: z.string(),
  status: z.string(),
  total: z.number(),
})

export type OrderDetailResponse = z.infer<typeof OrderDetailResponseSchema>
