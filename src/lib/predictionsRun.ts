// Entry point for the live-refresh workflow: open predictions for upcoming big
// matches, then resolve the ones whose match has finished.
// Local dry check: npx tsx --env-file=.env src/lib/predictionsRun.ts
import { createMissingPredictions, resolveFinishedPredictions } from "./predictionsStore";

async function main() {
  const dry = process.env.PREDICTIONS_DRY_RUN === "1";
  const created = await createMissingPredictions(new Date(), dry);
  if (dry) return console.log(`[predictions] dry run: ${created} would be opened`);
  const { resolved, voided } = await resolveFinishedPredictions();
  console.log(`[predictions] created ${created}, resolved ${resolved}, voided ${voided}`);
}

main().catch((err) => {
  console.error("[predictions] failed:", err);
  process.exit(1);
});
