import { z } from "zod";

/** RFC 9457 problem details, returned by every /api/v1 error. */
export const ProblemDetailsSchema = z
  .object({
    type: z.string().meta({ example: "about:blank" }),
    title: z.string().meta({ example: "Unauthorized" }),
    status: z.number().int().min(400).max(599).meta({ example: 401 }),
    detail: z.string().optional(),
    instance: z.string().optional(),
    errors: z
      .array(z.object({ path: z.string(), message: z.string() }))
      .optional()
      .meta({ description: "Validation errors, one per invalid field." }),
  })
  .meta({ id: "ProblemDetails" });

export type ProblemDetails = z.infer<typeof ProblemDetailsSchema>;

export const PROBLEM_CONTENT_TYPE = "application/problem+json";
