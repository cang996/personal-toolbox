import logging
import threading
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Protocol

from backend.app.exchange_rate.models import BankExchangeRate
from backend.app.exchange_rate.policies import BANK_SNAPSHOT_CACHE_TTL


LOGGER = logging.getLogger(__name__)


class BankRateClient(Protocol):
    bank_code: str
    bank_name: str

    def fetch_rates(self) -> list[BankExchangeRate]: ...


@dataclass(frozen=True)
class BankSnapshot:
    rates: tuple[BankExchangeRate, ...]
    retrieved_at: datetime

    def __post_init__(self) -> None:
        if self.retrieved_at.tzinfo is None or self.retrieved_at.utcoffset() is None:
            raise ValueError("BankSnapshot retrieved_at must be timezone-aware.")


class BankSnapshotUnavailable(RuntimeError):
    pass


class BankSnapshotCache:
    def __init__(
        self,
        client: BankRateClient,
        *,
        ttl: timedelta = BANK_SNAPSHOT_CACHE_TTL,
        clock: Callable[[], datetime] | None = None,
    ) -> None:
        self.bank_code = client.bank_code
        self.bank_name = client.bank_name
        self._client = client
        self._ttl = ttl
        self._clock = clock or (lambda: datetime.now(UTC))
        self._condition = threading.Condition()
        self._snapshot: BankSnapshot | None = None
        self._refreshing = False
        self._refresh_generation = 0
        self._last_refresh_attempt_at: datetime | None = None

    def get_snapshot(self) -> BankSnapshot:
        now = self._clock()
        _require_aware(now)
        stale_snapshot: BankSnapshot | None = None
        with self._condition:
            if self._is_valid(now):
                snapshot = self._snapshot
                if snapshot is None:
                    raise AssertionError("A valid cache must contain a snapshot.")
                return snapshot

            if self._snapshot is not None:
                stale_snapshot = self._snapshot
                if self._refreshing or not self._retry_window_elapsed(now):
                    return stale_snapshot
                self._refreshing = True
                self._last_refresh_attempt_at = now
            else:
                observed_generation = self._refresh_generation
                if self._refreshing:
                    self._condition.wait_for(lambda: not self._refreshing)
                    if self._refresh_generation != observed_generation:
                        if self._snapshot is not None:
                            return self._snapshot
                        raise BankSnapshotUnavailable(
                            f"No snapshot is available for {self.bank_code}."
                        )

                self._refreshing = True
                self._last_refresh_attempt_at = now

        if stale_snapshot is not None:
            self._start_background_refresh()
            return stale_snapshot

        try:
            refreshed = self._fetch_snapshot()
        except Exception:
            with self._condition:
                self._finish_refresh()
            raise

        with self._condition:
            self._snapshot = refreshed
            self._finish_refresh()
            return refreshed

    def _start_background_refresh(self) -> None:
        refresh_thread = threading.Thread(
            target=self._refresh_in_background,
            name=f"{self.bank_code.lower()}-snapshot-refresh",
            daemon=True,
        )
        try:
            refresh_thread.start()
        except Exception:
            with self._condition:
                self._finish_refresh()
            LOGGER.exception(
                "Could not start background bank snapshot refresh for %s",
                self.bank_code,
            )

    def _refresh_in_background(self) -> None:
        try:
            refreshed = self._fetch_snapshot()
        except Exception:
            with self._condition:
                self._finish_refresh()
            LOGGER.exception(
                "Bank snapshot refresh failed for %s; retaining last-known-good snapshot",
                self.bank_code,
            )
            return

        with self._condition:
            self._snapshot = refreshed
            self._finish_refresh()

    def _fetch_snapshot(self) -> BankSnapshot:
        rates = tuple(self._client.fetch_rates())
        if not rates:
            raise BankSnapshotUnavailable(
                f"The refreshed {self.bank_code} snapshot was empty."
            )
        retrieved_at = self._clock()
        _require_aware(retrieved_at)
        return BankSnapshot(rates=rates, retrieved_at=retrieved_at)

    def _is_valid(self, now: datetime) -> bool:
        return (
            self._snapshot is not None
            and now - self._snapshot.retrieved_at < self._ttl
        )

    def _retry_window_elapsed(self, now: datetime) -> bool:
        return (
            self._last_refresh_attempt_at is None
            or now - self._last_refresh_attempt_at >= self._ttl
        )

    def _finish_refresh(self) -> None:
        self._refresh_generation += 1
        self._refreshing = False
        self._condition.notify_all()


def _require_aware(value: datetime) -> None:
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError("Bank snapshot cache clock must return an aware datetime.")
