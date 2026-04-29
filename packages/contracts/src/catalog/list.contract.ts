import { z } from 'zod'

export const CatalogListResponseSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      category: z.string(),
    }),
  ),
})

export type CatalogListResponse = z.infer<typeof CatalogListResponseSchema>
