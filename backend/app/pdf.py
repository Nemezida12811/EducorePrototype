import io
from pathlib import Path

from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen.canvas import Canvas

_fonts = Path(__file__).parent / "assets" / "fonts"
pdfmetrics.registerFont(TTFont("Body", str(_fonts / "DejaVuSans.ttf")))  # embedded Unicode font: Slovak diacritics render correctly
pdfmetrics.registerFont(TTFont("Bold", str(_fonts / "DejaVuSans-Bold.ttf")))


class Doc:
    """Minimal top-to-bottom text writer with automatic page breaks."""
    def __init__(self) -> None:
        self.buf = io.BytesIO()
        self.c = Canvas(self.buf, pagesize=A4)
        self.w, self.h = A4
        self.y = self.h - 60

    def line(self, text: str, size: int = 10, bold: bool = False, gap: float = 4, center: bool = False) -> None:
        if self.y < 60: self.c.showPage(); self.y = self.h - 60
        self.c.setFont("Bold" if bold else "Body", size)
        (self.c.drawCentredString(self.w / 2, self.y, text) if center else self.c.drawString(50, self.y, text))
        self.y -= size + gap

    def space(self, n: float = 10) -> None: self.y -= n

    def render(self) -> bytes:
        self.c.save()
        return self.buf.getvalue()
