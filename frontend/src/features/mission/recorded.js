/**
 * One recorded run (content/replays/workflow-audit.json, offline agents) grouped into the steps the scroll scene
 * walks through. Bundled so the scene works with the server asleep.
 */
export const STEPS = [
  { agent: "task", label: "A visitor's task arrives" },
  { agent: "planner", label: "Planner splits it into steps" },
  { agent: "researcher", label: "Researcher checks Justin's past projects" },
  { agent: "brain", label: "Shared brain returns matching patterns" },
  { agent: "builder", label: "Builder writes the deliverable" },
  { agent: "reviewer", label: "Reviewer approves it" },
];

const RAW = [
  [1, "planner", "step_started", "Breaking the task into steps"],
  [1, "planner", "step_progress", "4 steps: restate the process, score each step, rank the opportunities, recommend the first to automate"],
  [1, "planner", "step_done", "Plan ready"],
  [2, "planner", "handoff", "Handing the plan to the Researcher"],
  [2, "researcher", "step_started", "Checking past project patterns in the shared brain"],
  [2, "researcher", "step_progress", "“workflow automation agentic AI” → projects/hotel-scan-to-order, profile/1"],
  [3, "researcher", "step_progress", "“replace phone-based manual process” → projects/botpoints"],
  [3, "researcher", "step_progress", "“automation pipelines scheduled jobs” → education/1"],
  [4, "researcher", "step_done", "4 relevant patterns found"],
  [4, "researcher", "handoff", "Handing findings to the Builder"],
  [4, "builder", "step_started", "Writing the deliverable"],
  [5, "builder", "step_done", "Draft 1 written (359 words)"],
  [5, "builder", "handoff", "Handing the draft to the Reviewer"],
  [5, "reviewer", "step_started", "Checking quality and scope"],
  [5, "reviewer", "step_done", "Approved: all sections present and on scope"],
  [5, "reviewer", "complete", "Mission complete: deliverable ready"],
];

/** Events in the shape the graph and log expect, each tagged with the step that reveals it. */
export const RECORDED_RUN = RAW.map(([step, agent, type, message], i) => ({ seq: i + 1, step, agent, type, message }));
