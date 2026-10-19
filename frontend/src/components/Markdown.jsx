import { motion } from "framer-motion";
import { Fragment } from "react";
import { prefersReducedMotion } from "../lib/motion";

/** Minimal Markdown → React (headings, lists, tables, bold/italic/code). Renders text nodes only, so no HTML injection. */
function inline(text, keyBase) {
  const out = [];
  const rx = /(\*\*[^*]+\*\*|`[^`]+`|_[^_]+_)/g;
  let last = 0;
  let m;
  let i = 0;
  while ((m = rx.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    const k = `${keyBase}-${i++}`;
    if (tok.startsWith("**")) out.push(<strong key={k} className="font-semibold text-ink">{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith("`")) out.push(<code key={k} className="rounded bg-raised px-1 font-mono text-[0.85em] text-researcher">{tok.slice(1, -1)}</code>);
    else out.push(<em key={k}>{tok.slice(1, -1)}</em>);
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const cells = (line) => line.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());

export function parseBlocks(md) {
  const lines = md.replace(/\r/g, "").split("\n");
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) { blocks.push({ t: "h", level: h[1].length, text: h[2] }); i++; continue; }
    if (line.trim().startsWith("|") && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1] ?? "")) {
      const head = cells(line);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) rows.push(cells(lines[i++]));
      blocks.push({ t: "table", head, rows });
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*[-*]\s+/, ""));
      blocks.push({ t: "ul", items });
      continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*\d+\.\s+/, ""));
      blocks.push({ t: "ol", items });
      continue;
    }
    const para = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,3}\s|\s*[-*]\s|\s*\d+\.\s|\s*\|)/.test(lines[i])) para.push(lines[i++]);
    if (para.length) blocks.push({ t: "p", text: para.join(" ") });
    else i++;
  }
  return blocks;
}

export default function Markdown({ source, reveal = false }) {
  const blocks = parseBlocks(source);
  const animate = reveal && !prefersReducedMotion();
  // "printing": blocks appear one after another, sliding up 8px; capped so a long document still prints in ~2 s
  const stagger = Math.min(0.12, 2 / Math.max(blocks.length, 1));
  const Wrap = animate ? motion.div : "div";
  const Item = animate ? motion.div : "div";
  const itemProps = animate ? { variants: { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } } } : {};
  return (
    <Wrap
      className="space-y-3 text-sm leading-6 text-ink/90"
      {...(animate ? { initial: "hidden", animate: "show", variants: { show: { transition: { staggerChildren: stagger } } } } : {})}
    >
      {blocks.map((b, n) => {
        const k = `b${n}`;
        let node;
        switch (b.t) {
          case "h":
            node =
              b.level === 1 ? (
                <h3 className="font-mono text-lg font-bold text-ink">{inline(b.text, k)}</h3>
              ) : (
                <h4 className="pt-2 font-mono text-xs font-bold uppercase tracking-widest text-researcher">{inline(b.text, k)}</h4>
              );
            break;
          case "ul":
            node = <ul className="list-disc space-y-1 pl-5 marker:text-mute">{b.items.map((t, j) => <li key={j}>{inline(t, `${k}-${j}`)}</li>)}</ul>;
            break;
          case "ol":
            node = <ol className="list-decimal space-y-1 pl-5 marker:text-mute">{b.items.map((t, j) => <li key={j}>{inline(t, `${k}-${j}`)}</li>)}</ol>;
            break;
          case "table":
            node = (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr>{b.head.map((c, j) => <th key={j} className="border-b border-line px-2 py-1.5 font-mono text-mute">{c}</th>)}</tr>
                  </thead>
                  <tbody>
                    {b.rows.map((r, j) => (
                      <tr key={j}>{r.map((c, x) => <td key={x} className="border-b border-line/60 px-2 py-1.5 align-top"><Fragment>{inline(c, `${k}-${j}-${x}`)}</Fragment></td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
            break;
          default:
            node = <p>{inline(b.text, k)}</p>;
        }
        return <Item key={k} {...itemProps}>{node}</Item>;
      })}
    </Wrap>
  );
}
