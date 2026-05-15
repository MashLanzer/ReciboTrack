import { z } from "zod"

export const receiptItemSchema = z.object({
  name: z.string(),
  price: z.number(),
  quantity: z.number().default(1),
})

export const ocrResultSchema = z.object({
  merchant: z.string().nullable(),
  date: z.string().nullable(),
  items: z.array(receiptItemSchema).default([]),
  subtotal: z.number().nullable(),
  tax: z.number().nullable(),
  total: z.number().nullable(),
  paymentMethod: z.string().nullable(),
  reference: z.string().nullable(),
  category: z
    .enum(["combustible", "comida", "supermercado", "transporte", "ocio", "salud", "hogar", "servicios", "otros"])
    .nullable(),
  currency: z.string().nullable(),
})

export const expenseInputSchema = z.object({
  merchant: z.string().min(1, "El comercio es requerido"),
  date: z.date(),
  items: z.array(receiptItemSchema).default([]),
  subtotal: z.number().min(0),
  tax: z.number().min(0),
  total: z.number().min(0),
  paymentMethod: z.string().nullable(),
  reference: z.string().nullable(),
  category: z.string().min(1, "La categoría es requerida"),
  currency: z.string().default("USD"),
  notes: z.string().default(""),
  tags: z.array(z.string()).default([]),
  receiptImageUrl: z.string().nullable(),
})

export const categoryInputSchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  icon: z.string().min(1, "El icono es requerido"),
  color: z.string().regex(/^#[0-9a-f]{6}$/i, "Color inválido"),
})

export const budgetInputSchema = z.object({
  categoryId: z.string().min(1, "La categoría es requerida"),
  monthlyLimit: z.number().min(0.01, "El límite debe ser mayor a 0"),
  currency: z.string().default("USD"),
})

export type OcrResultInput = z.infer<typeof ocrResultSchema>
export type ExpenseFormInput = z.infer<typeof expenseInputSchema>
export type CategoryFormInput = z.infer<typeof categoryInputSchema>
export type BudgetFormInput = z.infer<typeof budgetInputSchema>
