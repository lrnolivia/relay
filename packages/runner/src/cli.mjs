import { loadAllWorkers, loadWorker } from "./config.mjs";
import { runWorker } from "./runner.mjs";

const [command = "tick", id] = process.argv.slice(2);

if (command === "tick") {
  const workers = await loadAllWorkers();
  for (const worker of workers) {
    const state = await runWorker(worker);
    console.log(`${worker.id}: ${state.status}`);
  }
} else if (command === "run") {
  if (!id) throw new Error("Usage: npm run run -- <worker-id>");
  const worker = await loadWorker(id);
  const state = await runWorker(worker, { force: true });
  console.log(JSON.stringify(state, null, 2));
} else {
  throw new Error(`Unknown command: ${command}`);
}
