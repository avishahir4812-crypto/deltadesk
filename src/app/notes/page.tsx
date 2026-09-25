"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check, FileText, Pin, PinOff, Plus, Search, Trash2 } from "lucide-react";
import type { Note } from "@/lib/types";
import { timeAgo } from "@/lib/format";
import { usePolling } from "@/lib/hooks";
import { Btn, Card, CardHeader, Chip, EmptyState, Input, Skeleton, Textarea } from "@/components/ui";
import { cn } from "@/lib/utils";

function NotesInner() {
  const sp = useSearchParams();
  const list = usePolling<{ notes: Note[] }>("/api/notes", 0);
  const [selected, setSelected] = useState<string | "new" | null>(null);
  const [filter, setFilter] = useState("");

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tags, setTags] = useState("");
  const [pinned, setPinned] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  const notes = useMemo(() => list.data?.notes ?? [], [list.data]);
  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter(
      (n) => n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q) || n.tags.some((t) => t.toLowerCase().includes(q))
    );
  }, [notes, filter]);

  const current = selected && selected !== "new" ? notes.find((n) => n.id === selected) : null;

  const openNote = (n: Note) => {
    setSelected(n.id);
    setTitle(n.title);
    setBody(n.body);
    setTags(n.tags.join(", "));
    setPinned(n.pinned);
  };

  const openNew = () => {
    setSelected("new");
    setTitle("");
    setBody("");
    setTags("");
    setPinned(false);
  };

  useEffect(() => {
    if (sp.get("new")) openNew();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // auto-select first note once loaded
  useEffect(() => {
    if (selected === null && notes.length > 0) openNote(notes[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes]);

  const dirty = current
    ? title !== current.title || body !== current.body || tags !== current.tags.join(", ") || pinned !== current.pinned
    : selected === "new" && (title.trim() !== "" || body.trim() !== "");

  const save = async () => {
    const payload = {
      title: title.trim() || "Untitled note",
      body,
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 8),
      pinned,
    };
    if (selected === "new") {
      const res = await fetch("/api/notes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const d = await res.json().catch(() => null);
      if (d?.note?.id) setSelected(d.note.id);
    } else if (current) {
      await fetch(`/api/notes/${current.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    }
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1600);
    list.refresh();
  };

  const remove = async () => {
    if (!current) return;
    await fetch(`/api/notes/${current.id}`, { method: "DELETE" });
    setSelected(null);
    list.refresh();
  };

  const togglePin = async () => {
    setPinned(!pinned);
    if (current) {
      await fetch(`/api/notes/${current.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pinned: !pinned }) });
      list.refresh();
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[300px_1fr] animate-rise">
      {/* list */}
      <Card className="flex h-fit max-h-[78vh] flex-col lg:sticky lg:top-[84px]">
        <div className="space-y-2 border-b border-line p-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
            <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search notes or tags…" className="pl-8" />
          </div>
          <Btn variant="solid" size="sm" className="w-full" onClick={openNew}><Plus size={14} /> New note</Btn>
        </div>
        <div className="flex-1 overflow-y-auto p-1.5">
          {filtered.map((n) => (
            <button
              key={n.id}
              onClick={() => openNote(n)}
              className={cn(
                "group w-full rounded-lg px-2.5 py-2 text-left transition-colors",
                selected === n.id ? "bg-brand-soft/70" : "hover:bg-paper"
              )}
            >
              <div className="flex items-center gap-1.5">
                {n.pinned && <Pin size={10} className="shrink-0 text-brand" />}
                <p className={cn("flex-1 truncate text-[12.5px] font-semibold", selected === n.id && "text-brand-deep")}>{n.title}</p>
                <span className="shrink-0 text-[9.5px] text-faint">{timeAgo(n.updatedAt)}</span>
              </div>
              <p className="mt-0.5 line-clamp-1 text-[11px] text-faint">{n.body.split("\n")[0]}</p>
              {n.tags.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {n.tags.slice(0, 3).map((t) => (
                    <span key={t} className="rounded bg-[#efeee9] px-1 py-px text-[9px] font-semibold text-faint">{t}</span>
                  ))}
                </div>
              )}
            </button>
          ))}
          {!list.data && <div className="space-y-2 p-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}</div>}
          {list.data && filtered.length === 0 && (
            <p className="px-3 py-6 text-center text-[11.5px] text-faint">No notes match.</p>
          )}
        </div>
      </Card>

      {/* editor */}
      <Card className="min-h-[74vh]">
        {selected === null || (selected !== "new" && !current) ? (
          <EmptyState
            icon={<FileText size={18} />}
            title="Select a note or start a new one"
            sub="Desk notes persist to Postgres — playbooks, checklists and post-trade reviews."
          />
        ) : (
          <>
            <CardHeader
              title={selected === "new" ? "New note" : "Editing note"}
              sub={current ? `Created ${timeAgo(current.createdAt)} · updated ${timeAgo(current.updatedAt)}` : "Draft"}
              right={
                <div className="flex items-center gap-1.5">
                  <Btn variant="ghost" size="sm" onClick={togglePin} title={pinned ? "Unpin" : "Pin"} className={cn(pinned && "text-brand")}>
                    {pinned ? <PinOff size={14} /> : <Pin size={14} />}
                  </Btn>
                  {current && (
                    <Btn variant="ghost" size="sm" onClick={remove} title="Delete note" className="text-faint hover:text-down">
                      <Trash2 size={14} />
                    </Btn>
                  )}
                  <Btn variant="solid" size="sm" onClick={save} disabled={selected === "new" ? false : !dirty}>
                    {savedFlash ? <Check size={14} /> : null}
                    {savedFlash ? "Saved" : "Save"}
                  </Btn>
                </div>
              }
            />
            <div className="space-y-3 p-4">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Note title — e.g. Expiry-day gamma checklist"
                maxLength={140}
                className="h-10 text-[14px] font-semibold"
              />
              <Input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="Tags, comma separated — e.g. nifty, oi, expiry"
              />
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder={"Write like a desk note: observation → evidence → levels → invalidation.\n\nTip: “- [ ] ” lines read as checklist items."}
                className="min-h-[46vh] resize-y font-mono text-[12.5px] leading-relaxed"
              />
              <div className="flex items-center justify-between text-[10.5px] text-faint">
                <span>{body.trim() ? body.trim().split(/\s+/).length : 0} words · {body.length} chars</span>
                {dirty && <Chip tone="warn">unsaved changes</Chip>}
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

export default function NotesPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[600px]" />}>
      <NotesInner />
    </Suspense>
  );
}
