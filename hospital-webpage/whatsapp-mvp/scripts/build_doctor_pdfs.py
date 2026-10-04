#!/usr/bin/env python3
"""Build the three local-test specialty PDFs from the WhatsApp demo catalog."""

import json
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[2]
MVP = ROOT / "whatsapp-mvp"
OUTPUT = ROOT / "output" / "pdf"
CATALOG = json.loads((MVP / "catalog.json").read_text(encoding="utf-8"))

INK = colors.HexColor("#154734")
CREAM = colors.HexColor("#F4F4E9")
MINT = colors.HexColor("#E5EDDD")
MUTED = colors.HexColor("#526B5C")


def fit_text(value, font, size, maximum):
    while size > 8 and stringWidth(value, font, size) > maximum:
        size -= 0.5
    return size


def draw_card(pdf, doctor, top):
    page_width, _ = A4
    x = 42
    width = page_width - 84
    height = 192
    bottom = top - height
    pdf.setFillColor(colors.white)
    pdf.roundRect(x, bottom, width, height, 16, fill=1, stroke=0)
    pdf.setStrokeColor(MINT)
    pdf.roundRect(x, bottom, width, height, 16, fill=0, stroke=1)

    image_path = MVP / doctor["image"]
    if not image_path.is_file():
        raise FileNotFoundError(image_path)
    pdf.drawImage(ImageReader(str(image_path)), x + 18, bottom + 22,
                  width=148, height=148, mask="auto")

    text_x = x + 185
    pdf.setFillColor(INK)
    pdf.setFont("Helvetica-Bold", fit_text(doctor["name"], "Helvetica-Bold", 21, width - 215))
    pdf.drawString(text_x, top - 38, doctor["name"])
    pdf.setFillColor(MUTED)
    pdf.setFont("Helvetica", fit_text(doctor["summary"], "Helvetica", 11, width - 215))
    pdf.drawString(text_x, top - 62, doctor["summary"])

    pdf.setFillColor(MINT)
    pdf.roundRect(text_x, bottom + 49, width - 210, 43, 9, fill=1, stroke=0)
    pdf.setFillColor(INK)
    pdf.setFont("Helvetica-Bold", 9)
    pdf.drawString(text_x + 12, bottom + 75, "SAMPLE TIMES (IST)")
    pdf.setFont("Helvetica", 11)
    pdf.drawString(text_x + 12, bottom + 57, " and ".join(doctor["times"]))


def build(specialty):
    doctors = [doctor for doctor in CATALOG["clinicians"]
               if doctor["specialtyId"] == specialty["id"]]
    if not doctors:
        raise ValueError(f"No demo clinicians for {specialty['id']}")

    OUTPUT.mkdir(parents=True, exist_ok=True)
    path = OUTPUT / specialty["pdf"]
    pdf = canvas.Canvas(str(path), pagesize=A4)
    pdf.setTitle(f"Avocado Health test doctor options - {specialty['name']}")
    pdf.setAuthor("Avocado Health local WhatsApp demo")
    page_width, page_height = A4

    pdf.setFillColor(CREAM)
    pdf.rect(0, 0, page_width, page_height, fill=1, stroke=0)
    pdf.setFillColor(INK)
    pdf.rect(0, page_height - 12, page_width, 12, fill=1, stroke=0)
    pdf.setFont("Helvetica-Bold", 14)
    pdf.drawString(42, page_height - 55, "AVOCADO / HEALTH")

    pdf.setFillColor(MINT)
    pdf.roundRect(42, page_height - 102, 116, 26, 13, fill=1, stroke=0)
    pdf.setFillColor(INK)
    pdf.setFont("Helvetica-Bold", 10)
    pdf.drawString(56, page_height - 93, "TEST DEMO")
    pdf.setFont("Helvetica-Bold", 30)
    pdf.drawString(42, page_height - 151, specialty["name"])
    pdf.setFont("Helvetica", 12)
    pdf.drawString(42, page_height - 176, "Sample doctor options for this specialty")
    pdf.setFillColor(MUTED)
    pdf.setFont("Helvetica", 10)
    pdf.drawString(42, page_height - 199,
                   "These profiles and times are fictional. This document is for a local chat test only.")

    top = page_height - 225
    for doctor in doctors:
        draw_card(pdf, doctor, top)
        top -= 210

    pdf.setFillColor(INK)
    pdf.setFont("Helvetica-Bold", 12)
    pdf.drawString(42, 127, "What happens next?")
    pdf.setFont("Helvetica", 10)
    pdf.drawString(42, 108, "Choose a name from the WhatsApp list. The bot will show a sample slot.")
    pdf.drawString(42, 91, "A TEST reference is not a confirmed clinic appointment.")
    pdf.setStrokeColor(colors.HexColor("#BCD2BD"))
    pdf.line(42, 70, page_width - 42, 70)
    pdf.setFillColor(MUTED)
    pdf.setFont("Helvetica", 9)
    pdf.drawString(42, 52, "Local WhatsApp prototype  |  No live clinician schedule or medical advice")
    pdf.drawRightString(page_width - 42, 52, "1 / 1")
    pdf.showPage()
    pdf.save()
    return path


if __name__ == "__main__":
    for item in CATALOG["specialties"]:
        print(build(item))
