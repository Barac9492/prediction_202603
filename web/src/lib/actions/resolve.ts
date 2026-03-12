"use server";

import { resolvePrediction } from "@/lib/db/queries";
import { revalidatePath } from "next/cache";

export async function resolveAction(
  predictionId: number,
  outcome: string,
  notes: string
) {
  await resolvePrediction(predictionId, outcome, notes);
  revalidatePath("/log");
  revalidatePath(`/predictions/${predictionId}`);
  revalidatePath("/dashboard");
}
