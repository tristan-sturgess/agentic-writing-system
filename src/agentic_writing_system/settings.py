"""Application settings from environment variables."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Settings:
    """Paths and install mode for the local or hosted application."""

    data_dir: Path
    install: str | None

    @property
    def app_db_path(self) -> Path:
        return self.data_dir / "app.sqlite"

    @classmethod
    def from_env(cls) -> Settings:
        data_dir = Path(os.environ.get("WRITING_DATA_DIR", "data"))
        if not data_dir.is_absolute():
            data_dir = Path.cwd() / data_dir
        install = os.environ.get("WRITING_INSTALL")
        return cls(data_dir=data_dir, install=install)
