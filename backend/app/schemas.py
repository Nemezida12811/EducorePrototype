import re

from pydantic import BaseModel, ConfigDict, Field, field_validator

from .models import camel

HHMM = r"^([01]\d|2[0-3]):[0-5]\d$"
Password = Field(min_length=12, max_length=128)


class CamelModel(BaseModel):
    """Accepts and emits camelCase (matching the frontend), unknown fields rejected."""
    model_config = ConfigDict(alias_generator=camel, populate_by_name=True, extra="forbid")


class Email(str):
    pass


def norm_email(v: str) -> str:
    v = v.strip().lower()
    if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", v) or len(v) > 320: raise ValueError("invalid e-mail")
    return v


class EmailMixin(CamelModel):
    email: str
    @field_validator("email")
    @classmethod
    def _e(cls, v: str) -> str: return norm_email(v)
