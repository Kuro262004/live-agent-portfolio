import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Markdown, { parseBlocks } from "../src/components/Markdown";

const md = [
  "# Plan — Kape",
  "",
  "## Goal",
  "Serve **faster** with `WebSockets`.",
  "",
  "- one",
  "- two",
  "",
  "1. first",
  "2. second",
  "",
  "| Rank | Step |",
  "|---|---|",
  "| 1 | Copy |",
  "",
].join("\n");

describe("Markdown", () => {
  it("parses blocks", () => {
    expect(parseBlocks(md).map((b) => b.t)).toEqual(["h", "h", "p", "ul", "ol", "table"]);
  });

  it("renders headings, emphasis, lists and tables", () => {
    render(<Markdown source={md} />);
    expect(screen.getByRole("heading", { name: "Plan — Kape" })).toBeInTheDocument();
    expect(screen.getByText("faster").tagName).toBe("STRONG");
    expect(screen.getByText("WebSockets").tagName).toBe("CODE");
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
    expect(screen.getByRole("columnheader", { name: "Rank" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Copy" })).toBeInTheDocument();
  });

  it("never turns text into HTML", () => {
    const { container } = render(<Markdown source={'Hello <img src=x onerror="alert(1)"> **b**'} />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toContain("<img src=x");
  });
});
