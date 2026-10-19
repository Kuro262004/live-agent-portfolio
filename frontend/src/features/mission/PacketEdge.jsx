import { AGENT_HEX } from "../../lib/agents";
import { BaseEdge, getBezierPath, getSmoothStepPath } from "@xyflow/react";
import { useReducedMotionPref } from "../../lib/motion";

/**
 * A graph edge that sends glowing packets along it while a handoff is active.
 * data: { active, revision (amber when the reviewer sends a draft back), back (smooth-step loop edge) }.
 */
export default function PacketEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, style }) {
  const reduced = useReducedMotionPref();
  const geometry = { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition };
  const [path] = data?.back ? getSmoothStepPath(geometry) : getBezierPath(geometry);
  const color = data?.revision ? AGENT_HEX.builder : AGENT_HEX.researcher;

  return (
    <>
      <BaseEdge id={id} path={path} style={{ ...style, stroke: data?.active ? color : style?.stroke, transition: "stroke .3s" }} />
      {data?.active &&
        !reduced &&
        [0, 0.3, 0.6].map((delay) => (
          // hidden until the motion begins, so a packet never shows at the SVG origin
          <circle key={delay} r="3.5" fill={color} opacity="0" style={{ filter: `drop-shadow(0 0 6px ${color})` }} aria-hidden="true">
            <animate attributeName="opacity" from="0" to="1" begin={`${delay}s`} dur="0.01s" fill="freeze" />
            <animateMotion dur="1s" begin={`${delay}s`} repeatCount="indefinite" path={path} />
          </circle>
        ))}
    </>
  );
}
