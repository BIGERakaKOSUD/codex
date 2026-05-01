import { editableManualKeys } from "@ozon-unit-economics/shared";
import { z } from "zod";

export class RequestValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RequestValidationError";
  }
}

const nullableString = z
  .string()
  .trim()
  .min(1)
  .nullable()
  .optional()
  .transform((value) => value ?? null);

const editableValue = z.union([z.string(), z.number(), z.boolean(), z.null()]).optional();

const editableProductUpdateSchema = z.object({
  offer_id: nullableString,
  barcode: nullableString,
  field: z.string().refine((field) => editableManualKeys.has(field), "Field is not editable"),
  value: editableValue,
});

export type EditableProductUpdate = z.infer<typeof editableProductUpdateSchema>;

export function validateEditableProductUpdate(value: unknown): EditableProductUpdate {
  const parsed = editableProductUpdateSchema.safeParse(value);
  if (!parsed.success) {
    const fieldIssue = parsed.error.issues.find((issue) => issue.message === "Field is not editable");
    throw new RequestValidationError(fieldIssue?.message ?? parsed.error.issues[0]?.message ?? "Invalid request body");
  }

  return {
    offer_id: parsed.data.offer_id,
    barcode: parsed.data.barcode,
    field: parsed.data.field,
    value: parsed.data.value ?? null,
  };
}
