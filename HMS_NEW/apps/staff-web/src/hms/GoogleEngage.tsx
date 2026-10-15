import { useRef, useState } from "react";
import {
  AlertTriangle,
  CalendarCheck,
  Copy,
  ImagePlus,
  Phone,
  Send,
  Star,
  X,
} from "lucide-react";
import { WhatsAppIcon } from "@/components/brand-icons";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { checkUpload, type Attachment } from "./whatsapp-setup";
import { FileSlot, HeaderPreview, Pick } from "./whatsapp-ui";
import {
  photoSlots,
  privacyIssues,
  suggestReply,
  uid,
  type Exora,
  type GbpData,
  type Photo,
  type PhotoSlot,
  type Post,
  type PostKind,
} from "./google-profile";
import {
  copy,
  Delta,
  PhotoThumb,
  photoUrls,
  type GChange,
} from "./GoogleBusiness";
import { Chip } from "./GoogleProfile";

const DAY = 86_400_000;
const since = (at: number) => {
  const d = Math.floor((Date.now() - at) / DAY);
  return d < 1
    ? "today"
    : d < 30
      ? `${d} day${d === 1 ? "" : "s"} ago`
      : `${Math.floor(d / 30)} month${d < 60 ? "" : "s"} ago`;
};
function Stars({ n, className = "" }: { n: number; className?: string }) {
  return (
    <span
      className={`text-[#fbbc04] ${className}`}
      aria-label={`${n} out of 5 stars`}
    >
      {"★".repeat(n)}
      <span className="text-muted-foreground/30">{"★".repeat(5 - n)}</span>
    </span>
  );
}

export function Reviews({
  data,
  change,
  exora,
  canManage,
}: {
  data: GbpData;
  change: GChange;
  exora: Exora;
  canManage: boolean;
}) {
  const [filter, setFilter] = useState<"waiting" | "all" | "low">("waiting");
  const [editing, setEditing] = useState<string | null>(null);
  const [text, setText] = useState("");
  const list = data.reviews
    .filter((r) =>
      filter === "waiting" ? !r.reply : filter === "low" ? r.stars <= 2 : true,
    )
    .sort((a, b) => b.at - a.at);
  const avg =
    data.reviews.reduce((n, r) => n + r.stars, 0) /
    Math.max(data.reviews.length, 1);
  const link = data.reviewUrl ?? "";
  const flagged = privacyIssues(text);
  const save = (id: string) => {
    change((d) => ({
      ...d,
      reviews: d.reviews.map((r) =>
        r.id === id
          ? { ...r, reply: { text: text.trim(), at: Date.now() } }
          : r,
      ),
    }));
    setEditing(null);
  };
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {(
            [
              [
                "waiting",
                `Needs a reply (${data.reviews.filter((r) => !r.reply).length})`,
              ],
              ["low", "1–2 stars"],
              ["all", `All (${data.reviews.length})`],
            ] as const
          ).map(([k, label]) => (
            <Chip key={k} on={filter === k} onClick={() => setFilter(k)}>
              {label}
            </Chip>
          ))}
        </div>
        {list.map((r) => (
          <Card key={r.id} className="gap-3 p-5 shadow-none">
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#e8f0fe] text-sm font-medium text-[#1967d2]">
                {r.author[0]}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{r.author}</p>
                <p className="text-xs text-muted-foreground">
                  <Stars n={r.stars} /> · {since(r.at)}
                </p>
              </div>
              {!r.reply && (
                <Badge
                  variant={r.stars <= 2 ? "destructive" : "secondary"}
                  className="font-normal"
                >
                  Needs a reply
                </Badge>
              )}
            </div>
            <p className="text-sm">{r.text}</p>
            {editing === r.id ? (
              <div className="space-y-2 rounded-lg bg-muted/40 p-3">
                <Label htmlFor={`reply-${r.id}`}>Your reply (public)</Label>
                <Textarea
                  id={`reply-${r.id}`}
                  rows={3}
                  maxLength={4096}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                />
                {flagged.length > 0 && (
                  <p className="flex gap-2 text-xs text-amber-800 dark:text-amber-200">
                    <AlertTriangle className="size-3.5 shrink-0" />
                    Replies are public. “{flagged.join("”, “")}” could confirm
                    this person is a patient or reveal health details. Keep it
                    general and invite them to call.
                  </p>
                )}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={!text.trim()}
                    onClick={() => save(r.id)}
                  >
                    <Send /> {flagged.length ? "Post anyway" : "Post reply"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditing(null)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : r.reply ? (
              <div className="rounded-lg border-l-2 border-[#1a73e8] bg-muted/30 p-3 text-sm">
                <p className="mb-1 text-xs text-muted-foreground">
                  Your reply · {since(r.reply.at)}
                </p>
                {r.reply.text}
                {canManage && (
                  <div className="mt-2 flex gap-2">
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={() => (setEditing(r.id), setText(r.reply!.text))}
                    >
                      Edit
                    </Button>
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={() =>
                        window.confirm("Delete this reply from Google?") &&
                        change((d) => ({
                          ...d,
                          reviews: d.reviews.map((x) =>
                            x.id === r.id ? { ...x, reply: null } : x,
                          ),
                        }))
                      }
                    >
                      Delete
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              canManage && (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-fit"
                  onClick={() => (
                    setEditing(r.id),
                    setText(
                      suggestReply(
                        r,
                        exora.name,
                        exora.phone || "our reception",
                      ),
                    )
                  )}
                >
                  Reply
                </Button>
              )
            )}
          </Card>
        ))}
        {!list.length && (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Nothing here. Every review has a reply.
          </p>
        )}
      </div>
      <div className="space-y-4 xl:sticky xl:top-6 xl:self-start">
        <Card className="gap-3 p-5 shadow-none">
          <div className="flex items-end gap-3">
            <p className="text-4xl font-semibold tabular-nums">
              {avg.toFixed(1)}
            </p>
            <div className="pb-1">
              <Stars n={Math.round(avg)} />
              <p className="text-xs text-muted-foreground">
                {data.reviews.length} reviews
              </p>
            </div>
          </div>
          {[5, 4, 3, 2, 1].map((n) => {
            const c = data.reviews.filter((r) => r.stars === n).length;
            return (
              <div key={n} className="flex items-center gap-2 text-xs">
                <span className="w-3">{n}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <span
                    className="block h-full bg-[#fbbc04]"
                    style={{
                      width: `${(c / Math.max(data.reviews.length, 1)) * 100}%`,
                    }}
                  />
                </span>
                <span className="w-4 text-right text-muted-foreground">
                  {c}
                </span>
              </div>
            );
          })}
        </Card>
        <Card className="gap-3 p-5 shadow-none">
          <h2 className="text-sm font-semibold">Get more reviews</h2>
          <p className="text-xs text-muted-foreground">
            Share your review link with patients after their visit.
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={!link}
              onClick={() => copy(link, "Review link copied")}
            >
              <Copy /> Copy link
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!link}
              nativeButton={false}
              render={
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(`Thank you for visiting ${exora.name}. If you have a minute, please share your experience: ${link}`)}`}
                  target="_blank"
                  rel="noreferrer"
                />
              }
            >
              <WhatsAppIcon /> Share
            </Button>
          </div>
          <label className="flex items-start justify-between gap-3 border-t pt-3 text-sm">
            <span>
              <span className="block font-medium">
                Ask every patient after their visit
              </span>
              <span className="text-xs text-muted-foreground">
                Sent on WhatsApp 2 hours after the visit. Google doesn't allow
                asking only happy patients, so everyone gets it.
              </span>
            </span>
            <Switch
              checked={data.askReviews}
              disabled={true}
              aria-label="Ask every patient for a review"
              onCheckedChange={(askReviews) =>
                change((d) => ({ ...d, askReviews }))
              }
            />
          </label>
        </Card>
      </div>
    </div>
  );
}

const templates: [string, PostKind, string, string, Post["button"]][] = [
  [
    "Health camp",
    "event",
    "Free health camp",
    "Free health check-up camp this Sunday, 8 am to 1 pm: blood pressure, sugar and BMI. Walk in or book a slot.",
    "book",
  ],
  [
    "New doctor",
    "update",
    "",
    "We're happy to welcome a new specialist to our team. Appointments are open now.",
    "book",
  ],
  [
    "Holiday hours",
    "update",
    "",
    "We will be closed on the holiday. Emergency services remain open as usual.",
    "call",
  ],
  [
    "Health package",
    "offer",
    "Full body check-up",
    "Our full body check-up covers 60+ tests with a doctor's review. Book online and pick a morning slot.",
    "book",
  ],
  ["General update", "update", "", "", null],
];
const buttonText = {
  book: "Book",
  call: "Call now",
  learn: "Learn more",
} as const;
const day = (iso: string) =>
  new Date(`${iso}T00:00`).toLocaleDateString([], {
    day: "numeric",
    month: "short",
  });

export function Posts({
  data,
  change,
  exora,
  canManage,
}: {
  data: GbpData;
  change: GChange;
  exora: Exora;
  canManage: boolean;
}) {
  const [kind, setKind] = useState<PostKind>("update");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [button, setButton] = useState<Post["button"]>("book");
  const [image, setImage] = useState<Attachment | null>(null);
  const [when, setWhen] = useState<"now" | "later">("now");
  const [at, setAt] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const problems = [
    !text.trim() && "Write the post.",
    text.length > 1500 && "Keep it under 1500 characters.",
    kind !== "update" && !title.trim() && "Add a title.",
    kind !== "update" &&
      !(from && to) &&
      `Pick when the ${kind} starts and ends.`,
    kind !== "update" &&
      from &&
      to &&
      to < from &&
      "The end date is before the start date.",
    /\b\d{10}\b|\+91/.test(text) &&
      "Remove phone numbers. Use the Call button instead.",
    when === "later" && "Scheduling is not available yet. Choose publish now.",
    image && "Post images are not available yet.",
  ].filter(Boolean) as string[];
  const publish = () => {
    const post: Post = {
      id: uid(),
      kind,
      title: title.trim(),
      text: text.trim(),
      button,
      image,
      dates: kind === "update" ? undefined : { from, to },
      at: when === "later" ? new Date(at).getTime() : Date.now(),
      status: when === "later" ? "scheduled" : "checking",
      views: 0,
    };
    change((d) => ({ ...d, posts: [post, ...d.posts] }));
    setText("");
    setTitle("");
    setFrom("");
    setTo("");
    setImage(null);
    toast.success(when === "later" ? "Post scheduled" : "Posted to Google");
  };
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-6">
        <Card className="gap-0 p-5 shadow-none">
          <h2 className="text-sm font-semibold">New post</h2>
          <p className="mb-4 text-xs text-muted-foreground">
            Posts show on your listing for patients searching for you. Post
            every two weeks.
          </p>
          <fieldset disabled={!canManage} className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {templates.map(([label, k, t, body, b]) => (
                <Chip
                  key={label}
                  on={false}
                  onClick={() => (
                    setKind(k),
                    setTitle(t),
                    setText(body),
                    setButton(b)
                  )}
                >
                  {label}
                </Chip>
              ))}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="post-kind">Type</Label>
                <Pick
                  id="post-kind"
                  value={kind}
                  options={[
                    ["update", "Update"],
                    ["offer", "Offer"],
                    ["event", "Event"],
                  ]}
                  onChange={setKind}
                />
              </div>
              {kind !== "update" && (
                <div className="space-y-2">
                  <Label htmlFor="post-title">Title</Label>
                  <Input
                    id="post-title"
                    maxLength={58}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>
              )}
              {kind !== "update" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="post-from">Starts</Label>
                    <Input
                      id="post-from"
                      type="date"
                      value={from}
                      onChange={(e) => setFrom(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="post-to">Ends</Label>
                    <Input
                      id="post-to"
                      type="date"
                      min={from}
                      value={to}
                      onChange={(e) => setTo(e.target.value)}
                    />
                  </div>
                </>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="post-text">Text</Label>
              <Textarea
                id="post-text"
                rows={4}
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              <p className="text-right text-xs text-muted-foreground tabular-nums">
                {text.length}/1500
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Photo</Label>
                <FileSlot
                  id="post:new"
                  label="Photo"
                  accept="image/jpeg,image/png"
                  value={image}
                  onChange={setImage}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="post-button">Button</Label>
                <Pick
                  id="post-button"
                  value={button ?? "none"}
                  options={[
                    ["book", "Book"],
                    ["call", "Call now"],
                    ["learn", "Learn more"],
                    ["none", "No button"],
                  ]}
                  onChange={(v) => setButton(v === "none" ? null : v)}
                />
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-2">
                <Label htmlFor="post-when">When</Label>
                <Pick
                  id="post-when"
                  className="w-44"
                  value={when}
                  options={[
                    ["now", "Post now"],
                    ["later", "Schedule"],
                  ]}
                  onChange={setWhen}
                />
              </div>
              {when === "later" && (
                <Input
                  type="datetime-local"
                  className="w-56"
                  aria-label="Post at"
                  value={at}
                  onChange={(e) => setAt(e.target.value)}
                />
              )}
            </div>
            {problems.length > 0 && text && (
              <ul className="space-y-1 text-xs text-muted-foreground">
                {problems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            )}
            <Button disabled={problems.length > 0} onClick={publish}>
              <Send /> {when === "later" ? "Schedule post" : "Post to Google"}
            </Button>
          </fieldset>
        </Card>
        <div>
          <h2 className="mb-3 text-sm font-semibold">Your posts</h2>
          <Card className="gap-0 divide-y p-0 shadow-none">
            {data.posts.map((p) => (
              <div
                key={p.id}
                className="flex items-start gap-3 px-5 py-3 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {p.title || p.text.slice(0, 60)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {p.kind[0].toUpperCase() + p.kind.slice(1)} ·{" "}
                    {p.status === "scheduled"
                      ? `Scheduled for ${new Date(p.at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}`
                      : since(p.at)}
                    {p.dates &&
                      ` · runs ${day(p.dates.from)}–${day(p.dates.to)}`}
                    {p.status === "live" &&
                      p.views > 0 &&
                      ` · ${p.views} views`}
                  </p>
                </div>
                <Badge variant="outline" className="font-normal">
                  {p.status === "checking"
                    ? "Google is checking"
                    : p.status === "scheduled"
                      ? "Scheduled"
                      : p.status === "rejected"
                        ? "Not accepted"
                        : "Live"}
                </Badge>
                {canManage && (
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    aria-label="Delete post"
                    onClick={() =>
                      window.confirm("Delete this post from Google?") &&
                      change((d) => ({
                        ...d,
                        posts: d.posts.filter((x) => x.id !== p.id),
                      }))
                    }
                  >
                    <X />
                  </Button>
                )}
              </div>
            ))}
            {!data.posts.length && (
              <p className="p-6 text-center text-sm text-muted-foreground">
                No posts yet.
              </p>
            )}
          </Card>
        </div>
      </div>
      <div className="xl:sticky xl:top-6 xl:self-start">
        <p className="mb-2 text-xs font-medium text-muted-foreground">
          Preview
        </p>
        <div className="overflow-hidden rounded-xl border bg-white text-[#202124] shadow-sm">
          <div className="flex items-center gap-2 p-3">
            <span className="grid size-8 place-items-center rounded-full bg-[#e8f0fe] text-sm font-medium text-[#1967d2]">
              {exora.name[0]}
            </span>
            <span className="text-sm">
              {exora.name}
              <span className="block text-[11px] text-[#70757a]">Just now</span>
            </span>
          </div>
          {image ? (
            <div className="px-3">
              <HeaderPreview id="post:new" header={image} />
            </div>
          ) : null}
          <div className="space-y-2 p-3 text-[13px]">
            {kind !== "update" && title && (
              <p className="text-base font-medium">{title}</p>
            )}
            {kind !== "update" && from && to && (
              <p className="text-xs text-[#70757a]">
                {day(from)} – {day(to)}
              </p>
            )}
            <p className="whitespace-pre-wrap text-[#4d5156]">
              {text || "Your post text appears here."}
            </p>
            {button && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#dadce0] px-3 py-1.5 text-[#1a73e8]">
                {button === "call" ? (
                  <Phone className="size-3.5" />
                ) : (
                  <CalendarCheck className="size-3.5" />
                )}
                {buttonText[button]}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function Photos({
  data,
  change,
  canManage,
}: {
  data: GbpData;
  change: GChange;
  canManage: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [slot, setSlot] = useState<PhotoSlot>("logo");
  const add = (files: FileList | null) => {
    const room = photoSlots[slot].max - data.listing.photos[slot].length;
    const ok: Photo[] = [];
    for (const f of [...(files ?? [])].slice(0, room)) {
      if (f.type === "application/pdf") {
        toast.error("Use JPG or PNG photos.");
        continue;
      }
      const err = checkUpload(f);
      if (err) {
        toast.error(err);
        continue;
      }
      const id = uid();
      photoUrls.set(id, URL.createObjectURL(f));
      ok.push({ id, name: f.name, status: "checking", at: Date.now() });
    }
    if (ok.length)
      change((d) => ({
        ...d,
        listing: {
          ...d.listing,
          photos: {
            ...d.listing.photos,
            [slot]: [...d.listing.photos[slot], ...ok],
          },
        },
      }));
  };
  const remove = (s: PhotoSlot, id: string) =>
    change((d) => ({
      ...d,
      listing: {
        ...d.listing,
        photos: {
          ...d.listing.photos,
          [s]: d.listing.photos[s].filter((p) => p.id !== id),
        },
      },
    }));
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Real photos of your entrance, reception and team help patients find you
        and feel at ease. Google checks each photo before it shows.
      </p>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png"
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-label="Choose photos"
        onChange={(e) => {
          add(e.target.files);
          e.target.value = "";
        }}
      />
      {(Object.keys(photoSlots) as PhotoSlot[]).map((s) => {
        const info = photoSlots[s];
        const list = data.listing.photos[s];
        return (
          <section key={s}>
            <div className="mb-2 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">{info.title}</h2>
                <p className="text-xs text-muted-foreground">{info.hint}</p>
              </div>
              {canManage && list.length < info.max && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => (
                    setSlot(s),
                    requestAnimationFrame(() => input.current?.click())
                  )}
                >
                  <ImagePlus /> Add {info.max === 1 ? "" : "photos"}
                </Button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              {list.map((p) => (
                <div
                  key={p.id}
                  className="group relative aspect-square overflow-hidden rounded-lg border bg-muted text-xs"
                >
                  <div className="grid size-full place-items-center text-muted-foreground">
                    <PhotoThumb id={p.id} name={p.name} />
                  </div>
                  <Badge
                    variant={
                      p.status === "rejected" ? "destructive" : "outline"
                    }
                    className="absolute bottom-1.5 left-1.5 bg-background/90 font-normal"
                  >
                    {p.status === "live"
                      ? "Live"
                      : p.status === "checking"
                        ? "Google is checking"
                        : "Not accepted"}
                  </Badge>
                  {canManage && (
                    <Button
                      size="icon-xs"
                      variant="secondary"
                      className="absolute top-1.5 right-1.5"
                      aria-label={`Remove ${p.name}`}
                      onClick={() => remove(s, p.id)}
                    >
                      <X />
                    </Button>
                  )}
                </div>
              ))}
              {!list.length && (
                <div className="grid aspect-square place-items-center rounded-lg border border-dashed text-center text-xs text-muted-foreground">
                  <Star className="size-4" />
                  None yet
                </div>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export function Insights({ data }: { data: GbpData }) {
  const m = data.month,
    p = data.lastMonth;
  const views = m.search + m.maps;
  const max = Math.max(...data.daily.map((d) => d.views), 1);
  const top = data.keywords[0];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
        {(
          [
            ["Profile views", views, p.search + p.maps],
            ["On Search", m.search, p.search],
            ["On Maps", m.maps, p.maps],
            ["Calls", m.calls, p.calls],
            ["Directions", m.directions, p.directions],
            ["Website clicks", m.website, p.website],
            ["Bookings", m.bookings, p.bookings],
          ] as const
        ).map(([label, n, before]) => (
          <Card key={label} className="gap-0 p-4 shadow-none">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-xl font-semibold tabular-nums">
              {n.toLocaleString()}
            </p>
            <Delta now={n} before={before} />
          </Card>
        ))}
      </div>
      <Card className="gap-3 p-5 shadow-none">
        <div>
          <h2 className="text-sm font-semibold">Profile views, last 30 days</h2>
          <p className="text-xs text-muted-foreground">
            {Math.round((m.search / Math.max(views, 1)) * 100)}% found you on
            Google Search, the rest on Maps.
          </p>
        </div>
        <div
          className="flex h-36 items-end gap-1"
          role="img"
          aria-label="Daily profile views"
        >
          {data.daily.map((d) => (
            <div
              key={d.day}
              className="flex-1 rounded-t bg-[#1a73e8]/70 hover:bg-[#1a73e8]"
              style={{ height: `${(d.views / max) * 100}%` }}
              title={`${d.day}: ${d.views} views`}
            />
          ))}
        </div>
      </Card>
      <Card className="gap-3 p-5 shadow-none">
        <div>
          <h2 className="text-sm font-semibold">
            What people searched to find you
          </h2>
          {top && (
            <p className="text-xs text-muted-foreground">
              Most people found you searching “{top.term}”.
            </p>
          )}
        </div>
        <ul className="space-y-2">
          {data.keywords.map((k) => (
            <li key={k.term} className="flex items-center gap-3 text-sm">
              <span className="w-56 truncate">{k.term}</span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <span
                  className="block h-full bg-[#34a853]"
                  style={{
                    width: `${(k.count / data.keywords[0].count) * 100}%`,
                  }}
                />
              </span>
              <span className="w-12 text-right tabular-nums text-muted-foreground">
                {k.count}
              </span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">
          Bookings start counting once your Book button is live.
        </p>
      </Card>
    </div>
  );
}
