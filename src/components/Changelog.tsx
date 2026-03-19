import { Show, For, createSignal } from "solid-js";
import { marked } from "marked";
import { ChevronDown, ChevronRight } from "lucide-solid";
import type { ReleaseNote, SnapshotInfo } from "../types";

// ─── Pre-processing ────────────────────────────────────────────────────────

interface ParsedRelease {
  version: string;
  date: string;
  markdown: string;
  summary: { improvements: number; changes: number; bugfixes: number };
  channel: "stable" | "snapshot";
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

  return { version: note.version, date, markdown: md, summary: { improvements, changes, bugfixes }, channel: "stable" };
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
  snapshot?: SnapshotInfo | null;
}

function ReleaseAccordion(props: { release: ParsedRelease; defaultOpen: boolean }) {
  const [open, setOpen] = createSignal(props.defaultOpen);
  const isSnapshot = () => props.release.channel === "snapshot";

  return (
    <div class="sg-changelog-release" classList={{ "sg-changelog-snapshot": isSnapshot() }}>
      {/* Header — always visible, clickable */}
      <div class="sg-changelog-header" onClick={() => setOpen(!open())}>
        <span class="sg-changelog-chevron">
          <Show when={open()} fallback={<ChevronRight size={14} />}>
            <ChevronDown size={14} />
          </Show>
        </span>
        <span
          class="sg-changelog-version"
          classList={{ "sg-changelog-version-snapshot": isSnapshot() }}
        >
          {props.release.version}
        </span>
        <Show when={isSnapshot()}>
          <span class="sg-changelog-channel-badge">snapshot</span>
        </Show>
        <span class="sg-changelog-date">{props.release.date}</span>
        <span class="sg-changelog-summary">
          {isSnapshot() ? "latest dev build" : summaryText(props.release.summary)}
        </span>
      </div>

      {/* Body — collapsible content */}
      <Show when={open()}>
        <Show when={props.release.markdown} fallback={
          <div class="sg-changelog-body" style={{ color: "var(--sg-section-label)", "font-style": "italic" }}>
            Snapshot builds don't include changelogs. This is the latest development build — it may include unreleased improvements or experimental features.
          </div>
        }>
          <div class="sg-changelog-body" innerHTML={renderMarkdown(props.release.markdown)} />
        </Show>
      </Show>
    </div>
  );
}

export default function Changelog(props: ChangelogProps) {
  const parsed = (): ParsedRelease[] => {
    const stableNotes = props.notes.map(preprocessNote);

    // If there's a snapshot newer than stable, prepend it
    if (props.snapshot?.available && props.snapshot.newer_than_stable) {
      const snapshotEntry: ParsedRelease = {
        version: props.snapshot.commit,
        date: new Date(props.snapshot.date).toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        }),
        markdown: "",
        summary: { improvements: 0, changes: 0, bugfixes: 0 },
        channel: "snapshot",
      };
      return [snapshotEntry, ...stableNotes];
    }

    return stableNotes;
  };

  return (
    <div class="sg-changelog">
      <For each={parsed()}>
        {(release, i) => (
          <ReleaseAccordion release={release} defaultOpen={i() === 0 && release.channel === "stable"} />
        )}
      </For>
    </div>
  );
}
