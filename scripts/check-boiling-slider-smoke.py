#!/usr/bin/env python3

from __future__ import annotations

import argparse
import asyncio
from typing import List

from playwright.async_api import async_playwright


DEFAULT_URL = "https://boling.vercel.app"
SLIDER_LABEL = "보일링 애니메이션 폭"


def parse_base_frequency(raw_value: str | None) -> float | None:
    if not raw_value:
        return None

    first_value = raw_value.split()[0]
    try:
        return float(first_value)
    except ValueError:
        return None


async def sample_base_frequencies(
    page, sample_count: int, delay_ms: int
) -> List[float]:
    values: List[float] = []
    for _ in range(sample_count):
        raw = await page.locator("svg feTurbulence").first.get_attribute(
            "baseFrequency"
        )
        value = parse_base_frequency(raw)
        if value is None:
            raise RuntimeError("feTurbulence baseFrequency is unavailable")

        values.append(value)
        await page.wait_for_timeout(delay_ms)

    return values


def validate_series(
    values: List[float], tag: str, min_delta: float = 0.0001
) -> tuple[float, float, float]:
    current_min = min(values)
    current_max = max(values)
    spread = current_max - current_min
    if spread < min_delta:
        raise RuntimeError(f"{tag} baseFrequency spread too small ({spread})")

    return current_min, current_max, spread


async def set_slider(page, slider_locator, value: float) -> None:
    value_text = f"{value:.2f}".rstrip("0").rstrip(".")
    await slider_locator.fill(value_text)
    await page.wait_for_timeout(250)


async def run_check(url: str, sample_count: int, delay_ms: int) -> None:
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch()
        page = await browser.new_page(viewport={"width": 390, "height": 844})
        try:
            await page.goto(url, wait_until="domcontentloaded")

            slider = page.get_by_role("slider", name=SLIDER_LABEL)
            await slider.wait_for(state="visible", timeout=10_000)

            await set_slider(page, slider, 0.01)
            min_values = await sample_base_frequencies(
                page, sample_count=sample_count, delay_ms=delay_ms
            )
            min_min, min_max, min_spread = validate_series(min_values, "Minimum scale")

            await set_slider(page, slider, 1)
            max_values = await sample_base_frequencies(
                page, sample_count=sample_count, delay_ms=delay_ms
            )
            max_min, max_max, max_spread = validate_series(max_values, "Maximum scale")

            if max_spread < min_spread * 1.5:
                raise RuntimeError(
                    "Maximum-scale response did not widen enough compared to minimum scale: "
                    f"min_spread={min_spread}, max_spread={max_spread}"
                )

            if max_spread < 0.002:
                raise RuntimeError(f"Maximum-scale spread is too small: {max_spread}")

            print(
                "[ok] 보일링 폭 슬라이더가 애니메이션 반영과 함께 라이브 업데이트됩니다."
            )
            print(
                f"[details] min scale -> min={min_min:.6f}, max={min_max:.6f}, spread={min_spread:.6f}"
            )
            print(
                f"[details] max scale -> min={max_min:.6f}, max={max_max:.6f}, spread={max_spread:.6f}"
            )
        finally:
            await browser.close()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Check boiling scale slider on deployed app"
    )
    parser.add_argument("--url", default=DEFAULT_URL)
    parser.add_argument("--samples", type=int, default=20)
    parser.add_argument("--delay", type=int, default=120)
    args = parser.parse_args()

    try:
        asyncio.run(run_check(args.url, sample_count=args.samples, delay_ms=args.delay))
    except Exception as exc:
        print(f"[fail] {exc}")
        raise SystemExit(1)


if __name__ == "__main__":
    main()
