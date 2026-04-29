import { z } from 'zod'

export const UserProfileResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.string(),
})

export type UserProfileResponse = z.infer<typeof UserProfileResponseSchema>
