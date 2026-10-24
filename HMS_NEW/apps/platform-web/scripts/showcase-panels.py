# Builds the specialty and teleconsultation showcase mockups in the same HTML style as the
# existing marketing panels, and merges them into src/app/components/claude-asset-data.json.
# Run: python3 scripts/showcase-panels.py   (all names, times and figures are illustrative)
import json, pathlib

DATA = pathlib.Path(__file__).resolve().parent.parent / "src/app/components/claude-asset-data.json"
SKY, NAVY, CORAL = "#79B8EF", "#6095ca", "#EE927B"
NOISE = "url(&#x27;data:image/svg+xml;utf8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22260%22 height=%22260%22%3E%3Cfilter id=%22n%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%22.85%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3CfeColorMatrix values=%220 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .45 0%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23n)%22/%3E%3C/svg%3E&#x27;)"
PATHS = {
  "phone": '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"></path>',
  "calendar": '<rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M16 3v4M8 3v4M3 10h18"></path>',
  "message": '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"></path>',
  "check": '<path d="M5 12l5 5L20 7"></path>',
  "bell": '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8"></path><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"></path>',
  "video": '<rect x="2" y="6" width="14" height="12" rx="2"></rect><path d="M16 10l6-3v10l-6-3z"></path>',
  "flask": '<path d="M9 3h6M10 3v6L4.5 18.5A2 2 0 0 0 6.2 21.5h11.6a2 2 0 0 0 1.7-3L14 9V3"></path><path d="M7 15h10"></path>',
  "tooth": '<path d="M12 5.5C10 3.5 5 3 4.5 7.5c-.4 3.6 1.6 5.2 2.2 9 .4 2.6 1 4 2 4 1.6 0 1.4-5 3.3-5s1.7 5 3.3 5c1 0 1.6-1.4 2-4 .6-3.8 2.6-5.4 2.2-9C19 3 14 3.5 12 5.5z"></path>',
  "activity": '<path d="M3 12h4l3-8 4 16 3-8h4"></path>',
  "clock": '<circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path>',
  "arrow": '<path d="M5 12h14M13 6l6 6-6 6"></path>',
  "inbox": '<path d="M3 13l3-8h12l3 8v6H3z"></path><path d="M3 13h5l1 3h6l1-3h5"></path>',
  "file": '<path d="M14 3H6v18h12V7z"></path><path d="M14 3v4h4M9 13h6M9 17h4"></path>',
  "user": '<circle cx="12" cy="8" r="4"></circle><path d="M4 21a8 8 0 0 1 16 0"></path>',
  "mic": '<rect x="9" y="3" width="6" height="11" rx="3"></rect><path d="M5 11a7 7 0 0 0 14 0M12 18v3"></path>',
}
TONES = {  # pill text, pill background — taken from the existing panels
  "blue": ("#1F5E9E", "#E6F1FC"), "navy": ("#1e446b", "#e0eaf4"), "coral": ("#A2462F", "#FCEAE5"),
  "grey": ("#55544F", "#F1F1EF"), "green": ("#2E6B3E", "#E5F3E8"),
}
PEOPLE = {"Ananya Sharma": 1, "Rohan Mehta": 2, "Priya Nair": 3, "Kavya Rao": 4, "Meera Pillai": 5,
          "Dr Asha Rao": 1, "Dr Vikram Iyer": 2, "Dr Meera Shah": 3}

def icon(name, size=16, color="#2F74D9", width=2):
    return f'<svg width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" stroke="{color}" stroke-width="{width}" stroke-linecap="round" stroke-linejoin="round">{PATHS[name]}</svg>'

def avatar(name, size=30):
    return f'<img src="/assets/claude-showcases/portrait-{PEOPLE[name]}.jpg" style="width:{size}px;height:{size}px;border-radius:50%;object-fit:cover">'

def pill(text, tone="blue", size=14):
    fg, bg = TONES[tone]
    return f'<span style="font-size:{size}px;font-weight:500;color:{fg};background:{bg};padding:3px 10px;border-radius:20px;white-space:nowrap">{text}</span>'

def stage(w, h, color, inner, radius=24):
    return f'<div style="position:relative;width:{w}px;height:{h}px;border-radius:{radius}px;overflow:hidden;background:{color}">\n<div style="position:absolute;inset:0;opacity:.55;mix-blend-mode:multiply;background-image:{NOISE}"></div>\n{inner}\n</div>'

def window(box, tab, tab_icon, body, big=True):
    """box is CSS positioning such as 'left:72px;top:72px;right:0;bottom:0'; windows bleed off the right and bottom edges like the existing panels."""
    bar, dot, font = (48, 12, 14) if big else (40, 10, 14)
    dots = "".join(f'<span style="width:{dot}px;height:{dot}px;border-radius:50%;background:#DCDCD8"></span>' for _ in range(3))
    radius = "14px 0 0 0" if "right:0" in box else "14px 14px 0 0"
    return (f'<div style="position:absolute;{box};background:#fff;border-radius:{radius};overflow:hidden;box-shadow:0 0 0 1px rgba(0,0,0,.06),0 24px 60px rgba(20,40,70,.2)">'
            f'<div style="height:{bar}px;display:flex;align-items:center;gap:18px;padding:0 0 0 18px;background:#f4f6f8;border-bottom:1px solid #ECECE9"><div style="display:flex;gap:{dot - 4}px">{dots}</div>'
            + ('<span style="color:#A9A8A3;font-size:18px">‹ ›</span>' if big else "")
            + f'<div style="display:flex;align-items:center;gap:8px;height:{bar}px;padding:0 18px;background:#fff;border-left:1px solid #ECECE9;border-right:1px solid #ECECE9;font-size:{font}px;font-weight:500;min-width:{180 if big else 0}px">{icon(tab_icon)}{tab}</div>'
            + ('<span style="color:#A9A8A3;font-size:20px">+</span>' if big else "")
            + f'</div>{body}</div>')

def float_card(box, body, radius=16):
    return f'<div style="position:absolute;{box};background:#fff;border-radius:{radius}px;box-shadow:0 0 0 1px rgba(0,0,0,.05),0 18px 44px rgba(20,40,70,.24)">{body}</div>'

def chip(box, name, text, bg="#2F74D9"):
    return (f'<div style="position:absolute;{box};display:flex;align-items:center;gap:12px;background:#fff;padding:12px 20px 12px 12px;border-radius:40px;box-shadow:0 0 0 1px rgba(0,0,0,.05),0 14px 34px rgba(20,40,70,.22)">'
            f'<span style="width:36px;height:36px;border-radius:50%;background:{bg};display:flex;align-items:center;justify-content:center">{icon(name, 18, "#fff")}</span><span style="font-size:16px;font-weight:600;white-space:nowrap">{text}</span></div>')

def heading(title, sub, size=34, badge=None):
    b = f'<div style="width:56px;height:56px;border-radius:16px;background:#E6F1FC;display:flex;align-items:center;justify-content:center">{icon(badge, 28, "#2F74D9", 1.8)}</div>' if badge else ""
    return f'{b}<div style="display:flex;flex-direction:column;gap:8px"><div style="font-size:{size}px;font-weight:700;letter-spacing:-.02em">{title}</div><div style="font-size:17px;color:#6B6B66">{sub}</div></div>'

def rows(items, font=17, pad=15):
    """items: (lead html, main text, meta text, trailing html)"""
    out = []
    for i, (lead, main, meta, tail) in enumerate(items):
        line = "" if i == len(items) - 1 else "border-bottom:1px solid #eceef1;"
        meta_html = f'<span style="color:#6B6B66;white-space:nowrap">{meta}</span>' if meta else ""
        out.append(f'<div style="display:flex;align-items:center;gap:14px;padding:{pad}px 0;{line}font-size:{font}px">{lead}<span style="flex:1;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{main}</span>{meta_html}{tail}</div>')
    return f'<div style="display:flex;flex-direction:column">{"".join(out)}</div>'

def dot(color):
    return f'<span style="width:10px;height:10px;border-radius:50%;background:{color}"></span>'

def body(inner, pad="40px 44px", gap=26):
    return f'<div style="padding:{pad};display:flex;flex-direction:column;gap:{gap}px">{inner}</div>'

def field(label, value):
    return f'<div style="display:flex;flex-direction:column;gap:6px"><span style="font-size:13px;color:#9B9A97;font-weight:500">{label}</span><span style="font-size:17px;font-weight:500">{value}</span></div>'

def buttons(primary, secondary=None):
    s = f'<span style="font-size:15px;font-weight:500;color:#191918;background:#F1F1EF;padding:9px 16px;border-radius:9px">{secondary}</span>' if secondary else ""
    return f'<div style="display:flex;gap:10px"><span style="font-size:15px;font-weight:600;color:#fff;background:#2F74D9;padding:9px 16px;border-radius:9px">{primary}</span>{s}</div>'

def bubble(text, mine=False, meta=""):
    side, bg, fg = ("flex-end", "#2F74D9", "#fff") if mine else ("flex-start", "#F1F2F4", "#191918")
    m = f'<span style="font-size:13px;color:#9B9A97">{meta}</span>' if meta else ""
    return f'<div style="display:flex;flex-direction:column;align-items:{side};gap:6px"><div style="max-width:470px;font-size:17px;line-height:1.45;color:{fg};background:{bg};padding:12px 16px;border-radius:16px">{text}</div>{m}</div>'

def request_card(box, label, title, who, primary, secondary=None, badge="calendar"):
    return float_card(box, f'<div style="padding:22px 24px;display:flex;flex-direction:column;gap:16px"><div style="display:flex;gap:14px;align-items:center"><span style="width:44px;height:44px;border-radius:12px;background:#E6F1FC;display:flex;align-items:center;justify-content:center">{icon(badge, 22)}</span><div style="display:flex;flex-direction:column;gap:3px"><span style="font-size:13px;color:#9B9A97">{label}</span><span style="font-size:22px;font-weight:700;letter-spacing:-.01em">{title}</span></div></div><div style="font-size:15px;color:#6B6B66">{who}</div>{buttons(primary, secondary)}</div>')

def slots(times, picked):
    return '<div style="display:flex;gap:10px;flex-wrap:wrap">' + "".join(
        f'<span style="font-size:16px;font-weight:500;padding:9px 16px;border-radius:10px;{"color:#fff;background:#2F74D9" if t == picked else "color:#191918;background:#F1F1EF"}">{t}</span>' for t in times) + "</div>"

def timeline(entries):
    """entries: (time, name, detail, tone, status)"""
    out = []
    for t, name, detail, tone, status in entries:
        out.append(f'<div style="display:flex;align-items:center;gap:16px;padding:13px 0;border-bottom:1px solid #eceef1;font-size:17px"><span style="width:62px;color:#9B9A97;font-size:15px">{t}</span>{avatar(name)}<div style="flex:1;display:flex;flex-direction:column;gap:2px;min-width:0"><span style="font-weight:500">{name}</span><span style="font-size:14px;color:#6B6B66;white-space:nowrap">{detail}</span></div>{pill(status, tone)}</div>')
    return f'<div style="display:flex;flex-direction:column">{"".join(out)}</div>'

def progress(done, total, missed=()):
    cells = "".join(f'<span style="flex:1;height:10px;border-radius:5px;background:{"#E8846B" if i in missed else "#2F74D9" if i < done else "#E6EAEE"}"></span>' for i in range(total))
    return f'<div style="display:flex;gap:6px">{cells}</div>'

W, H = 1080, 720

def wf(color, *parts):
    return stage(W, H, color, "\n".join(parts))

# ---- workflow rows (1080 x 720) -------------------------------------------------------
panels = {}
panels["labs-workflow-1"] = ("Enquiries → booking request → centre-approved preparation note", wf(SKY,
  window("left:48px;top:84px;width:520px;bottom:0", "Enquiries", "inbox", body(heading("Enquiries", "Today · 26 answered by reception", 36, "inbox") + rows([
    (dot("#4A9BE8"), "Lipid profile booking", "Ananya Sharma", pill("Booking", "blue")),
    (dot("#4a84bf"), "Opening hours on Sunday", "Answered", pill("Answered", "navy")),
    (dot("#E8846B"), "Home sample collection", "Priya Nair", pill("Needs staff", "coral")),
    (dot("#C9C8C3"), "Thyroid panel price", "Kavya Rao", pill("New", "grey")),
  ]))),
  window("left:540px;top:196px;right:0;bottom:0", "Booking · Ananya Sharma", "calendar", body(
    f'<div style="display:flex;align-items:center;gap:14px">{avatar("Ananya Sharma", 44)}<div style="display:flex;flex-direction:column;gap:4px"><span style="font-size:26px;font-weight:700;letter-spacing:-.02em">Ananya Sharma</span><span style="font-size:15px;color:#6B6B66">Requested by phone · 9:12</span></div></div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">' + field("Service", "Lipid profile") + field("Requested time", "Sat, 8:00 AM") + "</div>"
    + f'<div style="border:1px solid #E6EAEE;border-radius:14px;padding:18px 20px;display:flex;flex-direction:column;gap:10px;background:#FAFBFC"><div style="display:flex;align-items:center;gap:10px">{icon("file", 18)}<span style="font-size:16px;font-weight:600">Preparation note</span>{pill("Approved by your centre", "green", 13)}</div><div style="display:flex;flex-direction:column;gap:8px"><span style="height:10px;width:92%;border-radius:5px;background:#E6EAEE"></span><span style="height:10px;width:78%;border-radius:5px;background:#E6EAEE"></span><span style="height:10px;width:60%;border-radius:5px;background:#E6EAEE"></span></div></div>'
    + buttons("Send with confirmation", "Edit booking"))),
  chip("left:372px;top:22px", "check", "Booking request captured")))

panels["labs-workflow-2"] = ("Today’s test appointments → arrivals → front-desk handoff", wf(NAVY,
  window("left:56px;top:64px;right:0;bottom:0", "Front desk", "flask", body(
    '<div style="display:flex;justify-content:space-between;align-items:flex-end">' + heading("Today’s appointments", "Sample collection · 34 booked · 21 arrived", 38) + f'<div style="display:flex;gap:10px">{pill("All", "navy", 15)}{pill("Arrived", "grey", 15)}{pill("Expected", "grey", 15)}</div></div>'
    + timeline([
      ("8:00", "Ananya Sharma", "Lipid profile · Counter 1", "green", "Arrived"),
      ("8:15", "Rohan Mehta", "Thyroid panel · Counter 2", "blue", "Called"),
      ("8:30", "Kavya Rao", "Complete blood count", "coral", "Needs handoff"),
      ("8:45", "Priya Nair", "Ultrasound · Room 3", "grey", "Expected"),
    ]), "44px 48px 0 48px", 30)),
  request_card("right:40px;bottom:40px;width:400px", "Handoff to imaging desk", "Kavya Rao · 8:30", "Arrived early for an ultrasound follow-up", "Hand over", "Message", "arrow"),
  chip("right:40px;top:20px", "user", "Rohan Mehta has arrived")))

panels["labs-workflow-3"] = ("Visit reminder → patient reply → routed to the reports team", wf(CORAL,
  window("left:48px;top:72px;width:520px;bottom:0", "Messages", "message", body(heading("Patient messages", "Connected messaging · 9 need a reply", 34) + rows([
    (avatar("Rohan Mehta"), "Rohan Mehta", "Report question", pill("Reports team", "navy")),
    (avatar("Ananya Sharma"), "Ananya Sharma", "Confirmed", pill("Reminder", "blue")),
    (avatar("Kavya Rao"), "Kavya Rao", "Reschedule", pill("Reception", "grey")),
    (avatar("Priya Nair"), "Priya Nair", "Directions", pill("Answered", "green")),
  ]))),
  window("left:540px;top:160px;right:0;bottom:0", "Rohan Mehta", "message", body(
    bubble("Hi Rohan, your thyroid panel is tomorrow at 8:15 AM. Reply here if you need to change the time.", True, "Reminder · sent yesterday")
    + bubble("Thanks! When will my report be ready?", False, "Rohan · 10:42")
    + bubble("We’ve passed your question to our reports team. They’ll reply here with the timing.", True, "Front desk · 10:44")
    + f'<div style="display:flex;align-items:center;gap:10px;font-size:15px;color:#6B6B66">{icon("arrow", 16, "#6B6B66")}Routed to <b style="color:#191918;font-weight:600">Reports team</b> · reporting system unchanged</div>', "36px 40px", 18)),
  chip("left:372px;top:22px", "bell", "Reminder sent · Tomorrow 8:15 AM")))

panels["dental-workflow-1"] = ("New-patient call → consultation request → clinician booked", wf(SKY,
  window("left:48px;top:84px;width:520px;bottom:0", "New patients", "tooth", body(heading("New enquiries", "This week · 14 new patients", 36, "tooth") + rows([
    (avatar("Ananya Sharma"), "Ananya Sharma", "Check-up", pill("Consultation", "blue")),
    (avatar("Rohan Mehta"), "Rohan Mehta", "Braces", pill("Needs clinician", "coral")),
    (avatar("Priya Nair"), "Priya Nair", "Price question", pill("Answered", "green")),
    (avatar("Meera Pillai"), "Meera Pillai", "Second opinion", pill("New", "grey")),
  ]))),
  window("left:540px;top:196px;right:0;bottom:0", "Enquiry · Rohan Mehta", "phone", body(
    f'<div style="display:flex;align-items:center;gap:14px">{avatar("Rohan Mehta", 44)}<div style="display:flex;flex-direction:column;gap:4px"><span style="font-size:26px;font-weight:700;letter-spacing:-.02em">Rohan Mehta</span><span style="font-size:15px;color:#6B6B66">New patient · called at 11:20</span></div></div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">' + field("Reason for enquiry", "Braces consultation") + field("Preferred", "Weekday evening") + "</div>"
    + '<div style="display:flex;flex-direction:column;gap:12px"><span style="font-size:13px;color:#9B9A97;font-weight:500">Dr Vikram Iyer · Thursday</span>' + slots(["4:00 PM", "4:30 PM", "6:15 PM"], "4:30 PM") + "</div>"
    + buttons("Book consultation", "Call back"))),
  chip("left:372px;top:22px", "calendar", "Consultation booked · Thu 4:30 PM")))

panels["dental-workflow-2"] = ("Clinician schedules → treatment visits → rescheduling request", wf(NAVY,
  window("left:56px;top:64px;right:0;bottom:0", "Appointments", "calendar", body(
    heading("Thursday", "18 treatment visits · 2 reschedule requests", 38)
    + '<div style="display:grid;grid-template-columns:70px 1fr 1fr 1fr;gap:12px;font-size:15px">'
    + '<span></span>' + "".join(f'<div style="display:flex;align-items:center;gap:10px;font-weight:600;font-size:16px">{avatar(d, 28)}{d}</div>' for d in ["Dr Asha Rao", "Dr Vikram Iyer", "Dr Meera Shah"])
    + "".join(
        f'<span style="color:#9B9A97;padding-top:12px">{t}</span>' + "".join(
          (f'<div style="height:72px;border-radius:12px;padding:12px 14px;background:{bg};border-left:4px solid {edge};display:flex;flex-direction:column;gap:4px"><span style="font-weight:600;color:#191918">{who}</span><span style="color:#55544F">{what}</span></div>' if who else '<div style="height:72px;border-radius:12px;border:1px dashed #E1E4E8"></div>')
          for who, what, bg, edge in cells)
        for t, cells in [
          ("10:00", [("Ananya Sharma", "Cleaning", "#E6F1FC", "#4A9BE8"), ("Rohan Mehta", "Consultation", "#e0eaf4", "#4a84bf"), (None, None, None, None)]),
          ("11:00", [("Priya Nair", "Filling · arrived", "#E5F3E8", "#5BA36F"), (None, None, None, None), ("Meera Pillai", "Check-up", "#E6F1FC", "#4A9BE8")]),
          ("12:00", [(None, None, None, None), ("Kavya Rao", "Treatment visit", "#FCEAE5", "#E8846B"), ("Ananya Sharma", "Review", "#e0eaf4", "#4a84bf")]),
          ("2:00", [("Rohan Mehta", "Follow-up visit", "#E6F1FC", "#4A9BE8"), (None, None, None, None), (None, None, None, None)]),
        ])
    + "</div>", "40px 48px 0 48px", 28)),
  request_card("right:40px;bottom:40px;width:400px", "Reschedule request · WhatsApp", "Kavya Rao · Thu 12:00", "Asked to move to next week, same clinician", "Offer Tue 12:00", "Reply", "calendar"),
  chip("right:40px;top:20px", "user", "Priya Nair checked in")))

panels["dental-workflow-3"] = ("Recall list → reminder → patient books the next visit", wf(CORAL,
  window("left:48px;top:72px;width:520px;bottom:0", "Recalls", "bell", body(heading("Recalls due", "Timing set by your dental team · 12 this week", 34) + rows([
    (avatar("Ananya Sharma"), "Ananya Sharma", "6-month check-up", pill("Replied", "green")),
    (avatar("Meera Pillai"), "Meera Pillai", "Hygiene visit", pill("Reminder sent", "blue")),
    (avatar("Rohan Mehta"), "Rohan Mehta", "Review", pill("Due Fri", "grey")),
    (avatar("Priya Nair"), "Priya Nair", "Check-up", pill("Due Sat", "grey")),
  ]))),
  window("left:540px;top:160px;right:0;bottom:0", "Ananya Sharma", "message", body(
    bubble("Hi Ananya, it’s time for the check-up Dr Asha Rao recommended. Would you like to book a visit?", True, "Recall reminder · 9:30")
    + bubble("Yes please. Is Saturday morning free?", False, "Ananya · 9:41")
    + bubble("Saturday at 10:30 AM with Dr Asha Rao is available. Shall I confirm it?", True, "Reception · 9:43")
    + bubble("Perfect, thank you!", False, "Ananya · 9:44"), "36px 40px", 16)),
  chip("left:372px;top:22px", "check", "Check-up booked · Sat 10:30 AM")))

panels["physiotherapy-workflow-1"] = ("Enquiry → initial assessment request → clinician availability", wf(SKY,
  window("left:48px;top:84px;width:520px;bottom:0", "Assessments", "activity", body(heading("Assessment requests", "This week · 11 new requests", 34, "activity") + rows([
    (avatar("Rohan Mehta"), "Rohan Mehta", "Knee", pill("To book", "blue")),
    (avatar("Meera Pillai"), "Meera Pillai", "Lower back", pill("Needs clinician", "coral")),
    (avatar("Priya Nair"), "Priya Nair", "Shoulder", pill("Booked", "green")),
    (avatar("Kavya Rao"), "Kavya Rao", "Post-surgery", pill("New", "grey")),
  ]))),
  window("left:540px;top:196px;right:0;bottom:0", "Assessment · Rohan Mehta", "calendar", body(
    f'<div style="display:flex;align-items:center;gap:14px">{avatar("Rohan Mehta", 44)}<div style="display:flex;flex-direction:column;gap:4px"><span style="font-size:26px;font-weight:700;letter-spacing:-.02em">Initial assessment</span><span style="font-size:15px;color:#6B6B66">Rohan Mehta · requested on WhatsApp</span></div></div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">' + field("Clinician", "Dr Meera Shah") + field("Length", "45 minutes") + "</div>"
    + '<div style="display:flex;flex-direction:column;gap:12px"><span style="font-size:13px;color:#9B9A97;font-weight:500">Available on Monday</span>' + slots(["9:00 AM", "11:30 AM", "5:45 PM"], "5:45 PM") + "</div>"
    + buttons("Book assessment", "Suggest another day"))),
  chip("left:372px;top:22px", "message", "Assessment request · Rohan Mehta")))

panels["physiotherapy-workflow-2"] = ("Agreed session plan → attendance → next session booked", wf(NAVY,
  window("left:56px;top:64px;right:0;bottom:0", "Sessions", "activity", body(
    f'<div style="display:flex;align-items:center;gap:18px">{avatar("Rohan Mehta", 56)}' + heading("Rohan Mehta", "Knee rehabilitation · plan agreed with Dr Meera Shah", 36) + "</div>"
    + f'<div style="display:flex;flex-direction:column;gap:12px"><div style="display:flex;justify-content:space-between;font-size:16px"><span style="font-weight:600">Session 5 of 8</span><span style="color:#6B6B66">Twice a week · set by the clinician</span></div>{progress(4, 8, (2,))}</div>'
    + timeline([
      ("Mon", "Rohan Mehta", "Session 4 · Dr Meera Shah", "green", "Attended"),
      ("Thu", "Rohan Mehta", "Session 3 · rescheduled from Wed", "coral", "Missed"),
      ("Mon", "Rohan Mehta", "Session 5 · 6:00 PM", "blue", "Today"),
      ("Thu", "Rohan Mehta", "Session 6 · 6:00 PM", "grey", "Booked"),
    ]), "40px 48px 0 48px", 28)),
  request_card("right:40px;bottom:40px;width:400px", "Next session", "Thu, 6:00 PM", "Dr Meera Shah · Session 6 of 8", "Send confirmation", "Change", "calendar"),
  chip("right:40px;top:20px", "check", "Session 5 · checked in")))

panels["physiotherapy-workflow-3"] = ("Session reminder → patient replies → clinician handoff", wf(CORAL,
  window("left:48px;top:72px;width:520px;bottom:0", "Replies", "inbox", body(heading("Patient replies", "Connected messaging · 7 open", 34) + rows([
    (avatar("Kavya Rao"), "Kavya Rao", "Move Thursday", pill("Reception", "blue")),
    (avatar("Rohan Mehta"), "Rohan Mehta", "Exercise question", pill("Clinician", "coral")),
    (avatar("Meera Pillai"), "Meera Pillai", "Confirmed", pill("Reminder", "navy")),
    (avatar("Priya Nair"), "Priya Nair", "Parking", pill("Answered", "green")),
  ]))),
  window("left:540px;top:160px;right:0;bottom:0", "Rohan Mehta", "message", body(
    bubble("Hi Rohan, a reminder about your session tomorrow at 6:00 PM with Dr Meera Shah.", True, "Session reminder · 5:00 PM")
    + bubble("Thanks. My knee felt sore after the last exercises, is that normal?", False, "Rohan · 5:12")
    + bubble("Thanks for letting us know. I’ve passed this to Dr Meera Shah, who will reply before your session.", True, "Reception · 5:15")
    + f'<div style="display:flex;align-items:center;gap:10px;font-size:15px;color:#6B6B66">{icon("arrow", 16, "#6B6B66")}Handed to <b style="color:#191918;font-weight:600">Dr Meera Shah</b> · clinical question</div>', "36px 40px", 18)),
  chip("left:372px;top:22px", "bell", "Session reminder sent")))

panels["teleconsultations-workflow-1"] = ("Appointment request → remote visit → joining instructions", wf(SKY,
  window("left:48px;top:84px;width:520px;bottom:0", "Appointment requests", "calendar", body(heading("Requests", "Today · 9 to review", 36, "calendar") + rows([
    (avatar("Meera Pillai"), "Meera Pillai", "Follow-up · remote", pill("Remote", "blue")),
    (avatar("Ananya Sharma"), "Ananya Sharma", "New visit", pill("In person", "grey")),
    (avatar("Rohan Mehta"), "Rohan Mehta", "Review · remote", pill("Remote", "blue")),
    (avatar("Kavya Rao"), "Kavya Rao", "Reschedule", pill("Needs reply", "coral")),
  ]))),
  window("left:540px;top:196px;right:0;bottom:0", "Visit · Meera Pillai", "video", body(
    f'<div style="display:flex;align-items:center;gap:14px">{avatar("Meera Pillai", 44)}<div style="display:flex;flex-direction:column;gap:4px"><span style="font-size:26px;font-weight:700;letter-spacing:-.02em">Remote follow-up</span><span style="font-size:15px;color:#6B6B66">Meera Pillai · Dr Vikram Iyer</span></div></div>'
    + '<div style="display:flex;gap:8px;padding:5px;background:#F1F2F4;border-radius:12px;width:max-content"><span style="font-size:15px;color:#6B6B66;padding:8px 16px">In person</span><span style="font-size:15px;font-weight:600;background:#fff;padding:8px 16px;border-radius:9px;box-shadow:0 1px 3px rgba(0,0,0,.08)">' + icon("video", 15) + ' Remote</span></div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">' + field("Date", "Fri, 11:30 AM") + field("Joining instructions", "Ready to send") + "</div>"
    + buttons("Confirm remote visit", "Edit"))),
  chip("left:372px;top:22px", "video", "Remote visit requested")))

panels["teleconsultations-workflow-2"] = ("In-person and remote visits in one day → configured joining workflow", wf(NAVY,
  window("left:56px;top:64px;right:0;bottom:0", "Today", "calendar", body(
    heading("Today’s visits", "24 in person · 6 remote", 38)
    + timeline([
      ("10:30", "Ananya Sharma", "In person · Dr Asha Rao", "green", "Checked in"),
      ("11:00", "Rohan Mehta", "Remote · Dr Vikram Iyer", "blue", "Joining sent"),
      ("11:30", "Meera Pillai", "Remote · Dr Vikram Iyer", "blue", "Waiting"),
      ("12:00", "Kavya Rao", "In person · Dr Meera Shah", "grey", "Expected"),
    ]), "40px 48px 0 48px", 28)),
  float_card("right:40px;bottom:40px;width:400px", f'<div style="padding:22px 24px;display:flex;flex-direction:column;gap:16px"><div style="display:flex;align-items:center;gap:12px">{avatar("Meera Pillai", 44)}<div style="display:flex;flex-direction:column;gap:3px"><span style="font-size:13px;color:#9B9A97">Remote visit · 11:30</span><span style="font-size:22px;font-weight:700">Meera Pillai</span></div></div><div style="display:flex;align-items:center;gap:10px;font-size:15px;color:#6B6B66">{icon("check", 16, "#5BA36F")}Joins with your configured consultation service</div>{buttons("Open visit", "Message patient")}</div>'),
  chip("right:40px;top:20px", "video", "Meera Pillai is waiting")))

panels["teleconsultations-workflow-3"] = ("Remote visit complete → follow-ups → next appointment", wf(CORAL,
  window("left:48px;top:72px;width:520px;bottom:0", "After the visit", "file", body(heading("Follow-ups", "Remote visit · Rohan Mehta · Dr Vikram Iyer", 32) + rows([
    (icon("calendar", 20), "Book the next appointment", "", pill("Reception", "blue")),
    (icon("message", 20), "Send the clinician’s next steps", "", pill("Sent", "green")),
    (icon("user", 20), "Clinical question from patient", "", pill("Care team", "coral")),
    (icon("file", 20), "Update contact details", "", pill("Done", "grey")),
  ]))),
  window("left:540px;top:160px;right:0;bottom:0", "Rohan Mehta", "message", body(
    bubble("Hi Rohan, thanks for today’s remote visit. Dr Vikram Iyer would like to see you in person in two weeks. Shall we book it?", True, "Reception · 12:10")
    + bubble("Yes, a Tuesday morning works best.", False, "Rohan · 12:18")
    + bubble("Booked: Tue 14 Nov, 10:00 AM at the clinic. You’ll get a reminder the day before.", True, "Reception · 12:20"), "36px 40px", 16)),
  chip("left:372px;top:22px", "check", "Next visit booked · in person")))

# ---- starter cards (840 x 480) -------------------------------------------------------
def starter(color, tab, tab_icon, title, sub, items, chip_icon, chip_text):
    return stage(840, 480, color, window("left:48px;top:48px;right:0;bottom:0", tab, tab_icon, body(
        f'<div style="display:flex;align-items:baseline;gap:14px"><span style="font-size:30px;font-weight:700;letter-spacing:-.02em">{title}</span><span style="font-size:16px;color:#6B6B66">{sub}</span></div>' + rows(items, 17, 12), "30px 36px", 16), big=False)
        + "\n" + chip("right:36px;top:24px", chip_icon, chip_text), 20)

def r(name, meta, status, tone):
    return (avatar(name), name, f'<span style="width:170px;display:inline-block">{meta}</span>', f'<span style="width:120px;text-align:center;display:inline-block">{pill(status, tone)}</span>')

panels["labs-starter-1"] = ("Enquiries & test appointments", starter(SKY, "Front desk", "flask", "Test appointments", "Saturday · 34 booked",
  [r("Ananya Sharma", "8:00 · Lipid profile", "Confirmed", "blue"), r("Rohan Mehta", "8:15 · Thyroid", "Note sent", "navy"), r("Kavya Rao", "8:30 · Blood count", "Requested", "grey")], "calendar", "New booking request"))
panels["labs-starter-2"] = ("Reminders & patient replies", starter(CORAL, "Messages", "message", "Replies", "Today · 9 open",
  [r("Priya Nair", "Directions", "Answered", "green"), r("Rohan Mehta", "Report timing", "Reports team", "navy"), r("Meera Pillai", "Change time", "Reception", "grey")], "bell", "Reminders sent · 28"))
panels["dental-starter-1"] = ("New-patient enquiries", starter(SKY, "New patients", "tooth", "New patients", "This week · 14",
  [r("Ananya Sharma", "Check-up · Dr Rao", "Booked", "blue"), r("Rohan Mehta", "Braces · Dr Iyer", "Consultation", "navy"), r("Meera Pillai", "Second opinion", "Call back", "grey")], "phone", "New-patient call"))
panels["dental-starter-2"] = ("Appointment follow-through", starter(CORAL, "Follow-ups", "bell", "Follow-ups", "Today · 11 to review",
  [r("Kavya Rao", "Reschedule request", "Offered Tue", "blue"), r("Ananya Sharma", "6-month recall", "Replied", "green"), r("Priya Nair", "Visit reminder", "Sent", "grey")], "calendar", "Recall booked · Sat 10:30"))
panels["physiotherapy-starter-1"] = ("Assessment & ongoing visits", starter(SKY, "Sessions", "activity", "Sessions", "Monday · 22 booked",
  [r("Rohan Mehta", "Session 5 of 8", "Today", "blue"), r("Priya Nair", "Initial assessment", "Booked", "navy"), r("Meera Pillai", "Session 2 of 6", "Thu", "grey")], "calendar", "Assessment booked"))
panels["physiotherapy-starter-2"] = ("Attendance & follow-ups", starter(CORAL, "Attendance", "check", "Attendance", "This week · 61 sessions",
  [r("Kavya Rao", "Missed · Wed", "Follow up", "coral"), r("Rohan Mehta", "Attended · Mon", "Attended", "green"), r("Meera Pillai", "Asked to move", "Reception", "grey")], "message", "Kavya Rao replied"))

# ---- remote-care callout (960 x 640) --------------------------------------------------
tile = lambda name, w, h: f'<div style="position:relative;width:{w}px;height:{h}px;border-radius:14px;overflow:hidden;background:#DCE6F0"><img src="/assets/claude-showcases/portrait-{PEOPLE[name]}.jpg" style="width:100%;height:100%;object-fit:cover"><span style="position:absolute;left:12px;bottom:12px;font-size:14px;font-weight:600;color:#fff;background:rgba(20,30,40,.55);padding:4px 10px;border-radius:8px">{name}</span></div>'
ctrl = lambda name, bg: f'<span style="width:48px;height:48px;border-radius:50%;background:{bg};display:flex;align-items:center;justify-content:center">{icon(name, 22, "#fff")}</span>'
panels["teleconsultations-callout"] = ("A doctor and patient connected remotely", stage(960, 640, NAVY,
  window("left:64px;top:64px;right:0;bottom:0", "Remote visit · Meera Pillai", "video", body(
    f'<div style="display:flex;gap:16px">{tile("Dr Vikram Iyer", 420, 330)}{tile("Meera Pillai", 340, 330)}</div>'
    + f'<div style="display:flex;justify-content:center;gap:14px">{ctrl("mic", "#55544F")}{ctrl("video", "#55544F")}{ctrl("phone", "#E8846B")}</div>', "28px 32px", 20), big=False)
  + "\n" + chip("right:40px;top:24px", "clock", "Remote follow-up · 11:30"), 24))

# ---- merge ----------------------------------------------------------------------------
data = json.loads(DATA.read_text())
for name, (label, html) in panels.items():
    w, h = (960, 640) if name.endswith("callout") else (840, 480) if "-starter-" in name else (W, H)
    data[name] = {"width": w, "height": h, "label": label, "html": html}
DATA.write_text(json.dumps(data, ensure_ascii=False, indent=2))
print(f"{len(panels)} panels written to {DATA.name}")
