/**
 * Zod schemas para validar los cuerpos de las peticiones a las rutas de API.
 * Importar en cada route handler y usar .safeParse() para validar el body.
 */
import { z } from "zod"

export const AiSummarySchema = z.object({
  expenses: z.array(z.object({
    total:    z.number(),
    merchant: z.string(),
    category: z.string(),
  })).max(500),
  categories: z.array(z.object({
    name:  z.string(),
    total: z.number(),
    delta: z.number(),
  })).max(50),
  month: z.string().max(50),
})

export const AiSuggestionsSchema = z.object({
  expenses: z.array(z.object({
    total:          z.number(),
    merchant:       z.string().max(100),
    category:       z.string().max(50),
    paymentMethod:  z.string().max(50).optional(),
  })).max(500),
})

export const AskFinanceSchema = z.object({
  question: z.string().min(1).max(500),
  context:  z.object({
    monthTotal:     z.number().optional(),
    prevMonthTotal: z.number().optional(),
    topCategories:  z.array(z.unknown()).max(20).optional(),
    savingsRate:    z.number().nullable().optional(),
    currency:       z.string().max(10).optional(),
  }).optional(),
})

export const OcrSchema = z.object({
  base64:    z.string().min(1),
  mediaType: z.string().max(50),
  provider:  z.enum(["gemini", "groq"]).optional(),
})

export const PayLinkSchema = z.object({
  from:     z.string().min(1).max(100),
  to:       z.string().min(1).max(100),
  amount:   z.number().positive(),
  concept:  z.string().max(200).optional(),
  currency: z.string().max(10).optional(),
})
