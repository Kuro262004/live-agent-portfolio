import { lazy, Suspense, useEffect } from "react";
import GLBoundary from "../../components/GLBoundary";
import { useRichMode } from "../../lib/useRichMode";
import { useWorld } from "../world/store";

const World = lazy(() => import("../world/World"));

const Lite = () => <div className="backdrop-lite" aria-hidden="true" />;

/** WebGL couldn't start: say so (the hero switches to its 2D picture) and show the still backdrop. */
function Failed() {
  const setFailed = useWorld((s) => s.setFailed);
  useEffect(() => setFailed(), [setFailed]);
  return <Lite />;
}

/** The page background: the one 3D world in rich mode, the same colours as a still CSS gradient otherwise. */
export default function Backdrop() {
  const rich = useRichMode();
  if (!rich) return <Lite />;
  return (
    <GLBoundary fallback={<Failed />}>
      <Suspense fallback={<Lite />}>
        <World />
      </Suspense>
    </GLBoundary>
  );
}
