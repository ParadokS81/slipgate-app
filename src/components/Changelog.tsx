import { Show, For, createSignal } from "solid-js";
import { marked } from "marked";
import { ChevronDown, ChevronRight } from "lucide-solid";
import type { ReleaseNote } from "../types";

// ─── Pre-processing ────────────────────────────────────────────────────────

interface ParsedRelease {
  version: string;
  date: string;
  markdown: string;
  summary: { improvements: number; changes: number; bugfixes: number };
}

/** Clean up raw release note markdown for better display */
function preprocessNote(note: ReleaseNote): ParsedRelease {
  let md = note.body;

  // Strip the "## ezQuake X.Y.Z Release Notes" header — we show version separately
  md = md.replace(/^##\s+.*Release Notes\s*/im, "");

  // Strip long GitHub commit URLs (keep the text before them)
  md = md.replace(/\s*https:\/\/github\.com\/[^\s)]+/g, "");

  // Remove empty sections: "### Category:\n" followed by another "###" or end
  md = md.replace(/###\s+[^:\n]+:\s*\n(?=###|\s*$)/gm, "");

  // Clean up excess blank lines
  md = md.replace(/\n{3,}/g, "\n\n").trim();

  // Count items per category
  const improvements = countItemsInSection(note.body, "Improvements");
  const changes = countItemsInSection(note.body, "Changes");
  const bugfixes = countItemsInSection(note.body, "Bugfixes");

  // Format date
  const date = note.published_at
    ? new Date(note.published_at).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "";

  return { version: note.version, date, markdown: md, summary: { improvements, changes, bugfixes } };
}

/** Count bullet items under a ### section */
function countItemsInSection(body: string, section: string): number {
  const pattern = new RegExp(
    `###\\s+${section}[:\\s]*\\n([\\s\\S]*?)(?=###|$)`,
    "i"
  );
  const match = body.match(pattern);
  if (!match) return 0;
  return (match[1].match(/^- /gm) || []).length;
}

/** Build a compact summary string like "8 improvements, 2 changes, 1 fix" */
function summaryText(s: { improvements: number; changes: number; bugfixes: number }): string {
  const parts: string[] = [];
  if (s.improvements > 0) parts.push(`${s.improvements} improvement${s.improvements !== 1 ? "s" : ""}`);
  if (s.changes > 0) parts.push(`${s.changes} change${s.changes !== 1 ? "s" : ""}`);
  if (s.bugfixes > 0) parts.push(`${s.bugfixes} fix${s.bugfixes !== 1 ? "es" : ""}`);
  return parts.join(", ") || "maintenance";
}

// ─── Markdown rendering ────────────────────────────────────────────────────

// Configure marked for compact output
marked.setOptions({
  gfm: true,
  breaks: false,
});

function renderMarkdown(md: string): string {
  return marked.parse(md, { async: false }) as string;
}

// ─── Component ─────────────────────────────────────────────────────────────

interface ChangelogProps {
  notes: ReleaseNote[];
}

function ReleaseAccordion(props: { release: ParsedRelease; defaultOpen: boolean }) {
  const [open, setOpen] = createSignal(props.defaultOpen);

  return (
    <div class="sg-changelog-release">
      {/* Header — always visible, clickable */}
      <div class="sg-changelog-header" onClick={() => setOpen(!open())}>
        <span class="sg-changelog-chevron">
          <Show when={open()} fallback={<ChevronRight size={14} />}>
            <ChevronDown size={14} />
          </Show>
        </span>
        <span class="sg-changelog-version">{props.release.version}</span>
        <span class="sg-changelog-date">{props.release.date}</span>
        <span class="sg-changelog-summary">{summaryText(props.release.summary)}</span>
      </div>

      {/* Body — collapsible markdown content */}
      <Show when={open()}>
        <div class="sg-changelog-body" innerHTML={renderMarkdown(props.release.markdown)} />
      </Show>
    </div>
  );
}

export default function Changelog(props: ChangelogProps) {
  const parsed = () => props.notes.map(preprocessNote);

  return (
    <div class="sg-changelog">
      <For each={parsed()}>
        {(release, i) => (
          <ReleaseAccordion release={release} defaultOpen={i() === 0} />
        )}
      </For>
    </div>
  );
}
