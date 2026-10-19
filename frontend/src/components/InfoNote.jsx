import { useStatus } from "../lib/queries";
import { jumpTo } from "../lib/motion";

/** A calm notice: limits and recorded runs are normal, so they get an info style, not an error style. */
export function InfoNote({ children, className = "" }) {
  return (
    <p role="status" className={`rounded-lg border border-researcher/30 bg-researcher/10 px-3 py-2 text-sm leading-6 text-ink/90 ${className}`}>
      {children}
    </p>
  );
}

/** "book a call with the real Justin": the booking link when one is set, otherwise the contact section. */
export function BookCallLink({ children = "book a call with the real Justin" }) {
  const { data: status } = useStatus();
  const url = status?.booking_url;
  return url ? (
    <a href={url} target="_blank" rel="noreferrer" className="font-semibold text-researcher underline underline-offset-2">
      {children}
    </a>
  ) : (
    <a
      href="#contact"
      onClick={(e) => {
        e.preventDefault();
        jumpTo("contact");
      }}
      className="font-semibold text-researcher underline underline-offset-2"
    >
      {children}
    </a>
  );
}
