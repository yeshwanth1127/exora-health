"""Composable, deterministic conversation workflows for high-stakes actions.

Each discovery field is an independent step.  A workflow is only an ordered
list of steps, so hospitals can add, remove, reorder, or conditionally enable a
step without changing the engine.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from typing import Any, Awaitable, Callable
from zoneinfo import ZoneInfo


Operate = Callable[[str, dict, dict], Awaitable[Any]]
InferSpecialty = Callable[[str], Awaitable[dict]]

BOOKING_INTENT = re.compile(
    r"(?i)\b(book|booking|schedule|make|need|want|like)\b.{0,35}\b(appointment|consultation|visit)\b|"
    r"\b(appointment|consultation)\b.{0,25}\b(book|schedule)\b"
)
CANCEL_INTENT = re.compile(r"(?i)^\s*(?:please\s+)?(cancel|stop|never mind|nevermind|forget it)(?:\s+(?:the|this)\s+booking)?(?:\s+please)?[.! ]*$")
RESTART_INTENT = re.compile(r"(?i)^\s*(?:please\s+)?(start over|restart|start again)(?:\s+(?:the|this)\s+booking)?[.! ]*$")
YES = re.compile(r"(?i)^\s*(yes|yes please|confirm|confirmed|go ahead|book it|please do|that works|okay|ok)[.! ]*$")
NO = re.compile(r"(?i)^\s*(no|no thanks|do not|don't|change it|not that one)[.! ]*$")

DEPARTMENT_ALIASES = {
    "cardiology": ("cardiology", "cardiologist", "heart"),
    "orthopedics": ("orthopedics", "orthopaedics", "orthopedic", "orthopaedic", "joints", "bones"),
    "neurology": ("neurology", "neurologist"),
    "psychiatry": ("psychiatry", "psychiatrist", "mental health"),
    "pediatrics": ("pediatrics", "paediatrics", "pediatric", "paediatric", "child"),
    "dermatology": ("dermatology", "dermatologist", "skin"),
    "ent": ("ent", "ear nose", "ear, nose"),
    "dental": ("dental", "dentist", "teeth"),
    "metabolic": ("metabolic", "endocrinology", "endocrinologist", "weight management"),
    "general medicine": ("general medicine", "primary care", "physician"),
    "gastroenterology": ("gastroenterology", "gastroenterologist", "digestive"),
    "pulmonology": ("pulmonology", "pulmonologist", "respiratory", "lung"),
    "nephrology": ("nephrology", "nephrologist", "kidney"),
    "ophthalmology": ("ophthalmology", "ophthalmologist", "eye doctor", "eye specialist"),
    "urology": ("urology", "urologist"),
    "physiotherapy": ("physiotherapy", "physiotherapist", "physical therapy", "rehabilitation"),
    "obstetrics and gynecology": ("obstetrics", "gynecology", "gynaecology", "gynecologist", "gynaecologist"),
    "general surgery": ("general surgery", "surgeon"),
    "dietetics": ("dietetics", "dietitian", "nutrition"),
}
EMERGENCY_WORDING = re.compile(
    r"(?i)\b(chest pain|cannot breathe|can't breathe|difficulty breathing|severe bleeding|"
    r"heavy bleeding|unconscious|seizure|stroke|suicid|overdose|poisoning|severe allergic|"
    r"anaphylaxis|immediate danger)\b"
)


def _normal(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", (value or "").casefold()).strip()


def is_booking_intent(text: str) -> bool:
    lower = _normal(text)
    mentions_service = any(_normal(alias) in lower for aliases in DEPARTMENT_ALIASES.values() for alias in aliases)
    return bool(BOOKING_INTENT.search(text or "") or (mentions_service and re.search(r"\b(book|schedule)\b", lower)))


def requested_consultation_type(text: str) -> str | None:
    lower = _normal(text)
    if re.search(r"\b(virtual(?:ly)?|online|video|teleconsult|remote)\b", lower):
        return "virtual"
    if re.search(r"\b(in person|in clinic|at the clinic|face to face)\b", lower):
        return "in_person"
    return None


def _record(value: Any, label: str | None = None, source: str = "user") -> dict:
    return {"value": value, "label": label or str(value), "source": source, "status": "verified"}


def _ordinal(text: str) -> int | None:
    lower = _normal(text)
    names = (("first", 0), ("second", 1), ("third", 2), ("fourth", 3), ("fifth", 4),
             ("sixth", 5), ("seventh", 6), ("eighth", 7), ("ninth", 8),
             ("one", 0), ("two", 1), ("three", 2), ("four", 3), ("five", 4),
             ("six", 5), ("seven", 6), ("eight", 7), ("nine", 8))
    for word, index in names:
        if re.search(rf"\b{word}\b", lower):
            return index
    match = re.fullmatch(r"(?:(?:the|number|option|choice)\s+)?([1-9])(?:st|nd|rd|th)?(?:\s+one)?", lower)
    return int(match.group(1)) - 1 if match else None


def _match_option(text: str, options: list[dict], fields: tuple[str, ...]) -> dict | None:
    lower = _normal(text)
    for option in options:
        for field_name in fields:
            candidate = _normal(str(option.get(field_name) or ""))
            if candidate and (candidate in lower or (len(lower) >= 4 and lower in candidate)):
                return option
            significant = [word for word in candidate.split() if len(word) > 3 and word not in {"doctor", "clinic", "center", "specialty"}]
            if significant and all(re.search(rf"\b{re.escape(word)}\b", lower) for word in significant[:2]):
                return option
    index = _ordinal(text)
    return options[index] if index is not None and index < len(options) else None


def _match_named_option(text: str, options: list[dict], fields: tuple[str, ...]) -> dict | None:
    """Match an explicit label, never an ordinal that may belong to a later step."""
    lower = _normal(text)
    for option in options:
        for field_name in fields:
            candidate = _normal(str(option.get(field_name) or ""))
            if candidate and (candidate in lower or candidate.replace(" ", "") in lower.replace(" ", "")):
                return option
            words = [word for word in candidate.split() if len(word) > 3 and word not in {"doctor", "clinic", "center", "specialty"}]
            if words and all(re.search(rf"\b{re.escape(word)}\b", lower) for word in words[:2]):
                return option
    return None


def _parse_date(text: str, today: date) -> date | None:
    lower = _normal(text)
    if re.search(r"\btoday\b", lower):
        return today
    # Voice transcription and typed chat frequently produce these near-matches.
    if re.search(r"\b(?:tomorrow|tommorow|tomorow|tommorrow|tmrw)\b", lower):
        return today + timedelta(days=1)
    iso = re.search(r"\b(20\d{2})-(\d{1,2})-(\d{1,2})\b", text)
    if iso:
        try:
            return date(*map(int, iso.groups()))
        except ValueError:
            return None
    day_first = re.search(r"\b(\d{1,2})[/-](\d{1,2})(?:[/-](20\d{2}))?\b", text)
    if day_first:
        day, month, year = day_first.groups()
        try:
            candidate = date(int(year or today.year), int(month), int(day))
            return candidate if candidate >= today else date(candidate.year + 1, candidate.month, candidate.day)
        except ValueError:
            return None
    weekdays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
    for target, weekday in enumerate(weekdays):
        if re.search(rf"\b{weekday}\b", lower):
            delta = (target - today.weekday()) % 7
            if delta == 0 or "next" in lower:
                delta += 7
            return today + timedelta(days=delta)
    months = {name: number for number, name in enumerate(
        ("january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"), 1)}
    month_match = re.search(r"\b(" + "|".join(months) + r")\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(20\d{2}))?\b", lower)
    if month_match:
        month_name, day, year = month_match.groups()
        try:
            candidate = date(int(year or today.year), months[month_name], int(day))
            return candidate if candidate >= today else date(candidate.year + 1, candidate.month, candidate.day)
        except ValueError:
            return None
    day_month_match = re.search(r"\b(\d{1,2})(?:st|nd|rd|th)?\s+(" + "|".join(months) + r")(?:,?\s+(20\d{2}))?\b", lower)
    if day_month_match:
        day, month_name, year = day_month_match.groups()
        try:
            candidate = date(int(year or today.year), months[month_name], int(day))
            return candidate if candidate >= today else date(candidate.year + 1, candidate.month, candidate.day)
        except ValueError:
            return None
    return None


@dataclass
class WorkflowContext:
    text: str
    memory: dict
    operate: Operate
    infer_specialty: InferSpecialty | None = None
    state: dict = field(init=False)
    tool_calls: list[str] = field(default_factory=list)
    inference_metrics: dict = field(default_factory=dict)

    def __post_init__(self):
        self.state = self.memory.setdefault("workflow", {})
        self.state.setdefault("name", "booking")
        self.state.setdefault("active", True)
        self.state.setdefault("values", {})
        self.state.setdefault("options", {})

    @property
    def values(self) -> dict:
        return self.state["values"]

    @property
    def options(self) -> dict:
        return self.state["options"]

    def get(self, key: str, default=None):
        entry = self.values.get(key)
        return entry.get("value", default) if isinstance(entry, dict) else default

    def set(self, key: str, value: Any, label: str | None = None, source: str = "user"):
        self.values[key] = _record(value, label, source)

    def clear(self, *keys: str):
        for key in keys:
            self.values.pop(key, None)
            self.options.pop(key, None)

    async def call(self, name: str, args: dict):
        result = await self.operate(name, args, self.memory)
        if name not in self.tool_calls:
            self.tool_calls.append(name)
        return result

    async def release_hold(self):
        hold_id = self.get("slot")
        if hold_id:
            await self.call("release_slot_hold", {"hold_id": hold_id})


@dataclass
class DiscoveryStep:
    key: str
    depends_on: tuple[str, ...] = ()
    required: bool = True
    eager: bool = False

    def enabled(self, context: WorkflowContext) -> bool:
        return self.required and all(context.get(key) is not None for key in self.depends_on)

    def satisfied(self, context: WorkflowContext) -> bool:
        return context.get(self.key) is not None

    async def extract(self, context: WorkflowContext) -> bool:
        return False

    async def resolve(self, context: WorkflowContext) -> str | None:
        return None

    async def answer_question(self, context: WorkflowContext, *, refresh=True) -> str | None:
        """Answer a question about this step's live options without advancing it."""
        return None

    def can_revise(self, context: WorkflowContext) -> bool:
        return False

    def ask(self, context: WorkflowContext) -> str:
        raise NotImplementedError


class SpecialtyStep(DiscoveryStep):
    def __init__(self):
        super().__init__("specialty", eager=True)

    async def extract(self, context):
        pending = context.state.get("pending_specialty")
        normalized = _normal(context.text)
        if pending and normalized in {"yes", "yes please", "okay", "ok", "sure", "go ahead", "that works"}:
            selected = pending["specialty"]
            context.state.pop("pending_specialty", None)
            context.set(self.key, selected, selected.title(), "llm_suggestion_confirmed_by_user")
            return True
        if pending and normalized in {"no", "no thanks", "not sure", "something else"}:
            context.state.pop("pending_specialty", None)
            context.state["specialty_suggestion_declined"] = True
            return False
        lower = _normal(context.text)
        selected = next((name for name, aliases in DEPARTMENT_ALIASES.items()
                         if any(re.search(rf"\b{re.escape(_normal(alias))}\b", lower) for alias in aliases)), None)
        if not selected:
            return False
        if context.get(self.key) != selected:
            context.state.pop("pending_specialty", None)
            context.state.pop("specialty_suggestion_declined", None)
            await context.release_hold()
            context.clear("doctor", "branch", "slot", "patient_name", "patient_phone", "confirmation")
            context.options.pop("doctors", None)
            context.options.pop("all_doctors", None)
            context.options.pop("branches", None)
            context.options.pop("slots", None)
        context.set(self.key, selected, selected.title())
        return True

    def ask(self, context):
        return "Certainly. Which department or specialty do you need?"

    async def resolve(self, context):
        if EMERGENCY_WORDING.search(context.text or ""):
            return "This may need urgent attention. Please contact local emergency services or go to the nearest emergency department now."
        if context.state.pop("specialty_suggestion_declined", False):
            return "No problem. Which department would you prefer?"
        pending = context.state.get("pending_specialty")
        if pending:
            return self._suggestion(pending)
        normalized = _normal(context.text)
        generic_booking = bool(BOOKING_INTENT.search(context.text or "") and not re.search(
            r"\b(pain|ache|hurt|injur|swelling|rash|skin|fever|headache|dizzy|numb|tingl|cough|stomach|leg|arm|back|knee|shoulder|ear|tooth|teeth)\b",
            normalized,
        ))
        if context.infer_specialty and len(normalized.split()) >= 2 and not generic_booking:
            inferred = await context.infer_specialty(context.text)
            context.inference_metrics = inferred.pop("_metrics", {})
            if "infer_specialty" not in context.tool_calls:
                context.tool_calls.append("infer_specialty")
            specialty = inferred.get("specialty")
            confidence = float(inferred.get("confidence") or 0)
            if specialty == "emergency":
                return "This may need urgent attention. Please contact local emergency services or go to the nearest emergency department now."
            if specialty in DEPARTMENT_ALIASES and confidence >= 0.55:
                pending = {
                    "specialty": specialty,
                    "reason": (inferred.get("reason") or "That department may be a suitable starting point.")[:180],
                }
                context.state["pending_specialty"] = pending
                return self._suggestion(pending)
            if specialty == "unknown" and re.search(
                r"\b(pain|ache|hurt|swelling|fever|headache|dizzy|numb|tingl|cough|stomach|leg|arm|back|knee|shoulder)\b",
                normalized,
            ):
                pending = {
                    "specialty": "general medicine",
                    "reason": "General Medicine is a suitable starting point when the right specialty is not yet clear.",
                }
                context.state["pending_specialty"] = pending
                return self._suggestion(pending)
            question = (inferred.get("clarifying_question") or "Which department or type of specialist would you prefer?").strip()
            return question[:240]
        return self.ask(context)

    @staticmethod
    def _suggestion(pending):
        label = pending["specialty"].title()
        reason = pending.get("reason") or "That department may be a suitable starting point."
        return f"{reason} This is only appointment routing, not a diagnosis. Would you like me to continue with {label}?"


class DoctorStep(DiscoveryStep):
    def __init__(self):
        super().__init__("doctor", ("specialty",))

    async def extract(self, context):
        doctors = context.options.get("doctors") or []
        selected = (_match_named_option(context.text, doctors, ("name", "title"))
                    if self.satisfied(context) else _match_option(context.text, doctors, ("name", "title")))
        if not selected:
            return False
        if context.get(self.key) != selected["id"]:
            await context.release_hold()
            context.clear("branch", "slot", "patient_name", "patient_phone", "confirmation")
            context.options.pop("branches", None)
            context.options.pop("slots", None)
        context.set(self.key, selected["id"], selected["name"], "hospital_backend")
        context.options["selected_doctor"] = selected
        return True

    def can_revise(self, context):
        selected = _match_named_option(context.text, context.options.get("doctors") or [], ("name", "title"))
        return bool(selected and selected.get("id") != context.get(self.key))

    async def resolve(self, context):
        all_doctors = context.options.get("all_doctors")
        if all_doctors is None:
            all_doctors = await context.call("find_doctors", {"department": context.get("specialty")})
            context.options["all_doctors"] = all_doctors
        doctors = all_doctors
        if context.get("consultation_type", "in_person") == "virtual":
            doctors = [doctor for doctor in all_doctors if doctor.get("accepts_virtual")]
            if not doctors:
                context.state["awaiting_in_person"] = True
                return "No doctor in that specialty currently lists virtual consultations. Would you like an in-person appointment instead?"
        context.options["doctors"] = doctors
        if not doctors:
            context.clear("specialty")
            return "I couldn't find an active doctor for that specialty. Which other department would you like?"
        option_answer = await self.answer_question(context, refresh=False)
        if option_answer:
            return option_answer
        if len(doctors) == 1:
            doctor = doctors[0]
            context.set(self.key, doctor["id"], doctor["name"], "hospital_backend")
            context.options["selected_doctor"] = doctor
            return None
        if await self.extract(context):
            return None
        return self.ask(context)

    def ask(self, context):
        doctors = context.options.get("doctors") or []
        names = "; ".join(f"{index + 1}, {item['name']}" for index, item in enumerate(doctors))
        return f"I found {names}. Which doctor would you prefer?"

    async def answer_question(self, context, *, refresh=True):
        normalized = _normal(context.text)
        asks_price = bool(re.search(r"\b(price|prices|cost|costs|fee|fees|charge|charges|how much)\b", normalized))
        asks_virtual = bool(re.search(r"\b(online|virtual(?:ly)?|video|teleconsult|remote)\b", normalized))
        if not asks_price and not asks_virtual:
            return None
        if refresh:
            # Fees and consultation modes are operational data. Always refresh
            # them from the clinic API when the caller explicitly asks.
            doctors = await context.call("find_doctors", {"department": context.get("specialty")})
            context.options["all_doctors"] = doctors
            context.options["doctors"] = doctors
        else:
            doctors = context.options.get("doctors") or []
        if not doctors:
            return "I couldn't find a current doctor listing for that specialty. Which other department would you like?"
        if asks_price:
            prices = []
            for doctor in doctors:
                fee = doctor.get("fee_inr")
                if fee is None:
                    prices.append(f"{doctor['name']}, fee not listed")
                else:
                    try:
                        amount = f"{int(fee):,}"
                    except (TypeError, ValueError):
                        amount = str(fee)
                    prices.append(f"{doctor['name']}, {amount} rupees")
            answer = "The listed consultation fee is " if len(prices) == 1 else "The listed consultation fees are "
            answer += "; ".join(prices) + "."
            if len(doctors) == 1:
                return answer + f" Would you like to continue with {doctors[0]['name']}?"
            return answer + " Which doctor would you prefer?"
        if asks_virtual:
            available = [doctor["name"] for doctor in doctors if doctor.get("accepts_virtual")]
            if available:
                answer = f"Virtual consultations are listed for {', '.join(available)}."
                if len(doctors) == 1:
                    return answer + f" Would you like to continue with {doctors[0]['name']}?"
                return answer + " Which doctor would you prefer?"
            if len(doctors) == 1:
                return f"{doctors[0]['name']} does not currently list virtual consultations. Would you like an in-person appointment instead?"
            return "None of these doctors currently lists virtual consultations. Would you like an in-person appointment instead?"
        return None


class BranchStep(DiscoveryStep):
    def __init__(self):
        super().__init__("branch", ("doctor",))

    async def extract(self, context):
        branches = context.options.get("branches") or []
        selected = (_match_named_option(context.text, branches, ("name", "area", "slug"))
                    if self.satisfied(context) else _match_option(context.text, branches, ("name", "area", "slug")))
        if not selected and len(branches) == 1 and YES.fullmatch(context.text or ""):
            selected = branches[0]
        if not selected:
            return False
        if context.get(self.key) != selected["id"]:
            await context.release_hold()
            context.clear("slot", "patient_name", "patient_phone", "confirmation")
            context.options.pop("slots", None)
        context.set(self.key, selected["id"], selected.get("area") or selected["name"], "hospital_backend")
        context.options["selected_branch"] = selected
        return True

    def can_revise(self, context):
        selected = _match_named_option(context.text, context.options.get("branches") or [], ("name", "area", "slug"))
        return bool(selected and selected.get("id") != context.get(self.key))

    async def answer_question(self, context, *, refresh=True):
        normalized = _normal(context.text)
        aliases = {
            "indiranagar": "Indiranagar", "koramangala": "Koramangala",
            "whitefield": "Whitefield", "white field": "Whitefield",
            "jayanagar": "Jayanagar",
        }
        requested = next((label for alias, label in aliases.items()
                          if re.search(rf"\b{re.escape(alias)}\b", normalized)), None)
        if not requested:
            return None
        branches = context.options.get("branches") or []
        selected = _match_named_option(context.text, branches, ("name", "area", "slug"))
        if selected:
            return None
        doctor = context.options.get("selected_doctor") or {}
        doctor_name = doctor.get("name") or context.values.get("doctor", {}).get("label") or "That doctor"
        labels = ", ".join(item.get("area") or item["name"] for item in branches)
        if labels:
            context.state["awaiting_branch_reaffirmation"] = {
                "requested": requested, "available": labels,
            }
            return (f"{doctor_name} has no active schedule at {requested}. "
                    f"The currently bookable location is {labels}. Would you like {labels}?")
        return f"{doctor_name} has no active schedule at {requested}. Which other doctor would you prefer?"

    async def resolve(self, context):
        doctor = context.options.get("selected_doctor") or {}
        mode = context.get("consultation_type", "in_person")
        branch_key = "virtual_branches" if mode == "virtual" else "in_person_branches"
        branches = doctor.get(branch_key)
        if branches is None:
            branches = doctor.get("branches") or []
        context.options["branches"] = branches
        if not branches:
            doctor_name = doctor.get("name") or context.values.get("doctor", {}).get("label") or "That doctor"
            remaining = [item for item in context.options.get("doctors") or []
                         if item.get("id") != context.get("doctor") and item.get("branches")]
            context.clear("doctor", "branch", "slot", "patient_name", "patient_phone", "confirmation")
            context.options.pop("selected_doctor", None)
            context.options.pop("selected_branch", None)
            context.options.pop("slots", None)
            if remaining:
                context.options["doctors"] = remaining
                names = "; ".join(f"{index + 1}, {item['name']}" for index, item in enumerate(remaining))
                return f"{doctor_name} has no bookable clinic location right now. The other options are {names}. Which doctor would you prefer?"
            context.clear("specialty")
            context.options.pop("doctors", None)
            context.options.pop("all_doctors", None)
            return f"{doctor_name} has no bookable clinic location right now. Which other specialty would you like?"
        if await self.extract(context):
            return None
        return self.ask(context)

    def ask(self, context):
        branches = context.options.get("branches") or []
        doctor = context.options.get("selected_doctor") or {}
        if len(branches) == 1:
            label = branches[0].get("area") or branches[0]["name"]
            doctor_name = doctor.get("name") or "That doctor"
            return f"{doctor_name} currently has appointments at {label}. Would you like that location?"
        labels = ", ".join(item.get("area") or item["name"] for item in branches)
        return f"Which clinic location works for you: {labels}?"


class DateStep(DiscoveryStep):
    def __init__(self, today: Callable[[], date] | None = None):
        super().__init__("date", ("branch",), eager=True)
        self.today = today or (lambda: datetime.now(ZoneInfo("Asia/Kolkata")).date())

    async def extract(self, context):
        selected = _parse_date(context.text, self.today())
        if not selected:
            return False
        if selected < self.today():
            return False
        if context.get(self.key) != selected.isoformat():
            await context.release_hold()
            context.clear("slot", "patient_name", "patient_phone", "confirmation")
            context.options.pop("slots", None)
        context.set(self.key, selected.isoformat(), selected.strftime("%A, %d %B"))
        return True

    def ask(self, context):
        return "What date would you prefer? You can say tomorrow, a weekday, or a specific date."


class SlotStep(DiscoveryStep):
    def __init__(self):
        super().__init__("slot", ("doctor", "branch", "date"))

    async def extract(self, context):
        slots = context.options.get("slots") or []
        selected = _match_named_option(context.text, slots, ("label", "starts_at"))
        if not selected and len(slots) == 1 and YES.fullmatch(context.text or ""):
            selected = slots[0]
        if not selected:
            time_match = re.search(r"\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b", context.text, re.I)
            if time_match:
                hour, minute, meridiem = time_match.groups()
                hour = int(hour) % 12 + (12 if meridiem.casefold() == "pm" else 0)
                needle = f"T{hour:02d}:{int(minute or 0):02d}"
                selected = next((item for item in slots if needle in item.get("starts_at", "")), None)
        if not selected:
            index = _ordinal(context.text)
            page = max(0, int(context.state.get("slot_page") or 0))
            page_slots = slots[page * 4:(page + 1) * 4]
            if index is not None and index < len(page_slots):
                selected = page_slots[index]
        if not selected:
            return False
        existing_hold = context.get(self.key)
        existing = context.options.get("selected_slot") or {}
        if existing_hold and existing.get("starts_at") == selected.get("starts_at"):
            return False
        if existing_hold:
            await context.release_hold()
            context.clear("patient_name", "patient_phone", "confirmation")
        hold = await context.call("create_slot_hold", {
            "doctor_id": context.get("doctor"), "branch_id": context.get("branch"),
            "starts_at": selected["starts_at"], "ends_at": selected["ends_at"],
            "consultation_type": context.get("consultation_type", "in_person"),
        })
        context.set(self.key, hold["id"], selected["label"], "hospital_backend")
        context.options["selected_slot"] = selected
        return True

    def can_revise(self, context):
        lower = _normal(context.text)
        explicitly_about_slot = bool(re.search(r"\b(slot|time|instead|change|actually)\b", lower))
        return explicitly_about_slot and bool(_ordinal(context.text) is not None or re.search(r"\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b", context.text, re.I))

    async def answer_question(self, context, *, refresh=True):
        slots = context.options.get("slots") or []
        if not slots:
            return None
        normalized = _normal(context.text)
        page = max(0, int(context.state.get("slot_page") or 0))
        if re.fullmatch(r"(?:show me )?(?:more|next|later|other)(?: times| slots| options)?", normalized):
            if (page + 1) * 4 >= len(slots):
                return "Those are all the available times for that date. Which time would you like?"
            context.state["slot_page"] = page + 1
            return self.ask(context)
        if re.fullmatch(r"(?:go )?(?:back|previous|earlier)(?: times| slots| options)?", normalized):
            if page == 0:
                return "Those are the earliest available times for that date. Which time would you like?"
            context.state["slot_page"] = page - 1
            return self.ask(context)
        return None

    async def resolve(self, context):
        slots = context.options.get("slots")
        if slots is None:
            data = await context.call("get_availability", {
                "doctor_id": context.get("doctor"), "branch_id": context.get("branch"),
                "start_date": context.get("date"), "end_date": context.get("date"),
                "consultation_type": context.get("consultation_type", "in_person"),
            })
            slots = []
            timezone_name = data.get("timezone") or "Asia/Kolkata"
            timezone = ZoneInfo(timezone_name)
            for item in data.get("slots") or []:
                starts = datetime.fromisoformat(item["starts_at"])
                if starts.tzinfo is not None:
                    starts = starts.astimezone(timezone)
                item = dict(item)
                item["label"] = starts.strftime("%-I:%M %p")
                slots.append(item)
            context.options["slots"] = slots
            context.state["slot_page"] = 0
        if not slots:
            context.clear("date")
            context.options.pop("slots", None)
            return "There are no open appointments at that clinic on that date. What other date would you like?"
        if await self.extract(context):
            return None
        return self.ask(context)

    def ask(self, context):
        slots = context.options.get("slots") or []
        if len(slots) == 1:
            return f"The only available time is {slots[0]['label']}. Would you like that time?"
        page = max(0, int(context.state.get("slot_page") or 0))
        visible = slots[page * 4:(page + 1) * 4]
        labels = ", ".join(f"{index + 1}, {item['label']}" for index, item in enumerate(visible))
        if page == 0 and len(slots) > 4:
            return f"The first available times are {labels}. Say more for later times, or choose one."
        prefix = "The available times are" if page == 0 else "The next available times are"
        if (page + 1) * 4 < len(slots):
            return f"{prefix} {labels}. Say more for later times, or choose one."
        return f"{prefix} {labels}. Which time would you like?"


class PatientNameStep(DiscoveryStep):
    def __init__(self):
        super().__init__("patient_name", ("slot",), eager=True)

    async def extract(self, context):
        match = re.search(r"(?i)\b(?:my name is|this is|call me)\s+([a-z][a-z .'-]{1,60}?)(?=\s+(?:and|my phone|phone|number)\b|[.!?]|$)", context.text)
        if not match and self.enabled(context) and not self.satisfied(context):
            bare = re.fullmatch(r"\s*([A-Za-z][A-Za-z .'-]{1,60})\s*", context.text)
            rejected = bool(re.search(
                r"(?i)\b(don't know|do not know|not sure|skip|prefer not|why|what|when|where|how|who|"
                r"want|appointment|book|booking|clinic|location|branch|field|instead|change|cool|that'?s|"
                r"yes|okay|confirm|available|availability|doctor|time|date)\b",
                context.text or "",
            ))
            words = re.findall(r"[A-Za-z]+(?:['-][A-Za-z]+)?", context.text or "")
            name_like = 1 <= len(words) <= 5 and all(len(word.replace("'", "").replace("-", "")) >= 2 for word in words)
            if bare and name_like and not rejected and _ordinal(context.text) is None and _normal(context.text) not in {
                "yes", "yes please", "no", "no thanks", "confirm", "go ahead", "book it"
            }:
                match = bare
        if not match:
            return False
        name = " ".join(match.group(1).split()).title()
        if re.search(r"(?i)\b(want|appointment|book|clinic|location|branch|field|instead|change|cool|that'?s|confirm)\b", name):
            return False
        context.set(self.key, name, name)
        return True

    def ask(self, context):
        return "What name should I use for the appointment?"


class PatientPhoneStep(DiscoveryStep):
    def __init__(self):
        super().__init__("patient_phone", ("patient_name",), eager=True)

    async def extract(self, context):
        match = re.search(r"(?<!\d)(\+?\d[\d ()-]{5,20}\d)(?!\d)", context.text)
        if not match:
            return False
        phone = re.sub(r"[^\d+]", "", match.group(1))
        digits = re.sub(r"\D", "", phone)
        if not 7 <= len(digits) <= 15:
            return False
        context.set(self.key, phone, phone)
        return True

    def ask(self, context):
        return "What phone number should the hospital use for this appointment?"


class ConfirmationStep(DiscoveryStep):
    def __init__(self):
        super().__init__("confirmation", ("slot", "patient_name", "patient_phone"))

    async def extract(self, context):
        normalized = _normal(context.text)
        if normalized in {"yes", "yes please", "confirm", "confirmed", "go ahead", "book it", "please do", "that works", "okay", "ok"}:
            appointment = await context.call("confirm_appointment", {
                "hold_id": context.get("slot"), "patient_name": context.get("patient_name"),
                "patient_phone": context.get("patient_phone"),
            })
            context.set(self.key, appointment["confirmation_code"], appointment["confirmation_code"], "hospital_backend")
            context.options["appointment"] = appointment
            context.state["active"] = False
            return True
        if normalized in {"no", "no thanks", "do not", "don t", "change it", "not that one"}:
            await context.call("release_slot_hold", {"hold_id": context.get("slot")})
            context.clear("slot", "patient_name", "patient_phone")
            context.options.pop("slots", None)
            return True
        return False

    def ask(self, context):
        doctor = context.values["doctor"]["label"]
        branch = context.values["branch"]["label"]
        slot = context.values["slot"]["label"]
        name = context.values["patient_name"]["label"]
        mode = "virtual" if context.get("consultation_type", "in_person") == "virtual" else "in person"
        article = "a virtual" if mode == "virtual" else "an in-person"
        return f"Please confirm: {article} appointment with {doctor} at {branch}, {context.values['date']['label']} at {slot}, for {name}. Should I book it?"


BOOKING_STEPS = [
    SpecialtyStep(), DoctorStep(), BranchStep(), DateStep(), SlotStep(),
    PatientNameStep(), PatientPhoneStep(), ConfirmationStep(),
]


class WorkflowEngine:
    def __init__(self, definitions: dict[str, list[DiscoveryStep]] | None = None):
        self.definitions = definitions or {"booking": BOOKING_STEPS}

    async def run(self, text: str, memory: dict, operate: Operate | None,
                  infer_specialty: InferSpecialty | None = None) -> dict | None:
        state = memory.get("workflow") or {}
        active = state.get("active") and state.get("name") in self.definitions
        if not active and not is_booking_intent(text):
            return None
        if not operate:
            return None
        orphan_hold_released = False
        if not active:
            if memory.get("current_hold"):
                await operate("release_slot_hold", {}, memory)
                orphan_hold_released = True
            # A cancelled, completed, or emergency-stopped workflow must never
            # leak its doctor, slot, patient, or confirmation into a new booking.
            memory["workflow"] = {
                "name": "booking", "active": True, "values": {}, "options": {},
            }

        context = WorkflowContext(text=text, memory=memory, operate=operate, infer_specialty=infer_specialty)
        if orphan_hold_released:
            context.tool_calls.append("release_slot_hold")
        steps = self.definitions[context.state["name"]]
        if EMERGENCY_WORDING.search(text or ""):
            if context.get("slot"):
                await context.call("release_slot_hold", {"hold_id": context.get("slot")})
            context.state["active"] = False
            return self._context_result(
                context,
                "This may need urgent attention. Please contact local emergency services or go to the nearest emergency department now.",
                "emergency",
            )
        pending_in_person = context.state.get("awaiting_in_person")
        if pending_in_person and YES.fullmatch(text or ""):
            context.state.pop("awaiting_in_person", None)
            context.set("consultation_type", "in_person", "in person")
            context.options["doctors"] = context.options.get("all_doctors") or []
            # This yes answers only the consultation-mode question. Do not
            # reuse it to silently accept a doctor, location, slot, or booking.
            context.text = ""
        elif pending_in_person and NO.fullmatch(text or ""):
            context.state.pop("awaiting_in_person", None)
            context.state["active"] = False
            return self._context_result(context, "Okay, I stopped this booking. How else can I help?", "cancelled")
        consultation_type = requested_consultation_type(text)
        if consultation_type and consultation_type != context.get("consultation_type"):
            if context.get("slot"):
                await context.call("release_slot_hold", {"hold_id": context.get("slot")})
            context.clear("doctor", "branch", "slot", "patient_name", "patient_phone", "confirmation")
            context.options.pop("doctors", None)
            context.options.pop("selected_doctor", None)
            context.options.pop("branches", None)
            context.options.pop("selected_branch", None)
            context.options.pop("slots", None)
            context.set("consultation_type", consultation_type,
                        "virtual" if consultation_type == "virtual" else "in person")
        if CANCEL_INTENT.fullmatch(text or ""):
            if context.get("slot"):
                await context.call("release_slot_hold", {"hold_id": context.get("slot")})
            context.state["active"] = False
            return self._context_result(context, "Okay, I stopped this booking. How else can I help?", "cancelled")
        if RESTART_INTENT.fullmatch(text or ""):
            if context.get("slot"):
                await context.call("release_slot_hold", {"hold_id": context.get("slot")})
            memory["workflow"] = {
                "name": "booking", "active": True, "values": {}, "options": {},
            }
            context = WorkflowContext(text=text, memory=memory, operate=operate, infer_specialty=infer_specialty)
            return self._context_result(context, "Okay, let's start over. Which department or specialty do you need?", "specialty")

        pending_branch = context.state.get("awaiting_branch_reaffirmation")
        if pending_branch:
            if YES.fullmatch(text or ""):
                context.state.pop("awaiting_branch_reaffirmation", None)
                missing = next((step for step in steps
                                if step.enabled(context) and not step.satisfied(context)), None)
                if missing:
                    return self._context_result(
                        context,
                        f"Okay, keeping {pending_branch['available']}. {missing.ask(context)}",
                        missing.key,
                    )
                confirmation = next(step for step in steps if step.key == "confirmation")
                return self._context_result(
                    context,
                    f"Okay, keeping {pending_branch['available']}. {confirmation.ask(context)}",
                    "confirmation",
                )
            if NO.fullmatch(text or ""):
                context.state.pop("awaiting_branch_reaffirmation", None)
                if context.get("slot"):
                    await context.call("release_slot_hold", {"hold_id": context.get("slot")})
                context.state["active"] = False
                return self._context_result(
                    context,
                    "Okay, I stopped this booking because that location is unavailable. Which doctor would you like instead?",
                    "cancelled",
                )
            return self._context_result(
                context,
                f"The available location is {pending_branch['available']}. Would you like to keep that location?",
                "branch",
            )

        # Each discovery module may answer questions about the live options it
        # owns without consuming or advancing the workflow state.
        for step in steps:
            if not (step.enabled(context) or step.satisfied(context)):
                continue
            option_answer = await step.answer_question(context)
            if option_answer:
                return self._context_result(context, option_answer, step.key)

        # Extract from every enabled module. Repeat because resolving one step can
        # expose options needed to understand another value in the same utterance.
        for _ in range(len(steps) + 1):
            changed = False
            for step in steps:
                if ((step.enabled(context) and not step.satisfied(context)) or step.eager
                        or (step.satisfied(context) and step.can_revise(context))):
                    changed = await step.extract(context) or changed
            missing = next((step for step in steps if step.enabled(context) and not step.satisfied(context)), None)
            if missing is None:
                confirmation = context.get("confirmation")
                if confirmation:
                    appointment = context.options.get("appointment") or {}
                    if context.get("consultation_type", "in_person") == "virtual":
                        message = (f"Your virtual appointment is confirmed. Your confirmation code is {confirmation}. "
                                   "Sign in to the hospital website before the appointment, accept telemedicine consent, "
                                   "and use the Virtual OPD waiting room. The video room opens only after your assigned doctor starts the consultation.")
                    else:
                        message = f"Your appointment is confirmed. Your confirmation code is {confirmation}."
                    return self._context_result(
                        context,
                        message,
                        "completed", appointment=appointment,
                    )
                break
            response = await missing.resolve(context)
            if response:
                return self._context_result(context, response, missing.key)
            if not missing.satisfied(context):
                return self._context_result(context, missing.ask(context), missing.key)
            changed = True
            if not changed:
                break

        missing = next((step for step in steps if step.enabled(context) and not step.satisfied(context)), None)
        if missing:
            return self._context_result(context, missing.ask(context), missing.key)
        return self._context_result(context, "I couldn't continue that booking safely. Please try again.", "error")

    @staticmethod
    def _context_result(context: WorkflowContext, answer: str, stage: str, **extra) -> dict:
        return WorkflowEngine._result(
            answer, context.tool_calls, stage,
            inference_metrics=context.inference_metrics, **extra,
        )

    @staticmethod
    def _result(answer: str, tool_calls: list[str], stage: str, **extra) -> dict:
        return {"answer": answer, "tool_calls": tool_calls, "stage": stage, **extra}
