import { motion } from "framer-motion";
import { Check, Download } from "lucide-react";
import { useEffect, useState } from "react";
import { prefersReducedMotion } from "../../lib/motion";

const PARTICLES = Array.from({ length: 8 }, (_, i) => {
  const a = (i / 8) * Math.PI * 2;
  return { x: Math.cos(a) * 18, y: Math.sin(a) * 18 };
});

/** When the deliverable is ready the icon becomes a check with a tiny particle burst, then settles back to the download arrow. */
export default function DownloadButton({ href }) {
  const reduced = prefersReducedMotion();
  const [celebrating, setCelebrating] = useState(!reduced);

  useEffect(() => {
    if (!celebrating) return undefined;
    const t = setTimeout(() => setCelebrating(false), 1500);
    return () => clearTimeout(t);
  }, [celebrating]);

  return (
    <a href={href} className="relative inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-semibold hover:border-reviewer" download>
      <span className="relative flex h-3.5 w-3.5 items-center justify-center">
        {celebrating ? (
          <>
            <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 16 }} className="flex text-reviewer">
              <Check size={14} />
            </motion.span>
            {PARTICLES.map((p, i) => (
              <motion.span
                key={i}
                aria-hidden="true"
                className="absolute h-1 w-1 rounded-full bg-reviewer"
                initial={{ x: 0, y: 0, opacity: 1 }}
                animate={{ x: p.x, y: p.y, opacity: 0 }}
                transition={{ duration: 0.7, ease: "easeOut" }}
              />
            ))}
          </>
        ) : (
          <Download size={14} />
        )}
      </span>
      Download
    </a>
  );
}
