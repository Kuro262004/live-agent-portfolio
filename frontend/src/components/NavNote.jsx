import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import { useApp } from "../stores/app";

/** The one-line answer after ask-to-navigate, for a few seconds at the bottom; it says where the answer came from. */
export default function NavNote() {
  const note = useApp((s) => s.navNote);
  const setNote = useApp((s) => s.setNavNote);
  useEffect(() => {
    if (!note) return undefined;
    const t = setTimeout(() => setNote(null), 4500);
    return () => clearTimeout(t);
  }, [note, setNote]);
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center px-4 max-md:bottom-24">
      <AnimatePresence>
        {note && (
          <motion.p
            key={note.text}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="rounded-full border border-rule/10 bg-raised px-4 py-2 text-sm text-ink shadow-2xl"
          >
            {note.text}
            {note.source && <span className="ml-2 font-mono text-[10px] text-mute">· {note.source}</span>}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
