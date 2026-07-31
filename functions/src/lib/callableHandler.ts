import { HttpsError } from "firebase-functions/v2/https";
import type { CallableRequest } from "firebase-functions/v2/https";
import type { ZodType, z } from "zod";

// Wraps an onCall handler body with the two checks almost every callable in functions/src/
// index.ts hand-rolls today: the caller is authenticated, and request.data matches a given Zod
// schema. `handler` receives the already-validated, typed `data` plus the caller's uid, so
// individual onCall exports stay focused on business logic instead of repeating these guards.
// Future handlers (performAction, acknowledgeAction, ...) can adopt this once this pattern is
// proven - not converted in this pass.
export function withAuthAndSchema<Schema extends ZodType>(
  schema: Schema,
  handler: (args: { uid: string; data: z.infer<Schema>; request: CallableRequest }) => Promise<unknown>
) {
  return async (request: CallableRequest) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Login required.");

    const parsed = schema.safeParse(request.data);
    if (!parsed.success) {
      const message = parsed.error.issues
        .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
        .join("; ");
      throw new HttpsError("invalid-argument", message);
    }

    return handler({ uid, data: parsed.data, request });
  };
}
