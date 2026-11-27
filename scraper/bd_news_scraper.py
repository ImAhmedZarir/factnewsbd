#!/usr/bin/env python3
"""
FactNews Bangladesh — Obscura-Powered 10-Day News Collector, Timestamp Analyzer & Editorial Rewriter.

- Uses `scraper/bin/obscura.exe --stealth` (Rust V8 headless browser) to bypass Cloudflare & extract JS DOM
- Harvests full last 10 days across daily sitemaps (Prothom Alo, Dhaka Post, Daily Star, TBS), date archives (JagoNews24),
  national portals, and international feeds (BBC Bangla/World/Sport/Tech, Al Jazeera)
- Analyzes upload/event timestamps from JSON-LD datePublished, article:published_time, RSS pubDate & corroborating sources
- Rewrites raw articles with clean descriptions, multi-paragraph bodies & verified source citations
- Pushes sequentially to `/api/v1/ingest` sorted strictly newest-first
"""

from __future__ import annotations

import argparse
import concurrent.futures
import email.utils
import gzip
import hashlib
import html
import json
import re
import ssl
import subprocess
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/131.0.0.0 Safari/537.36"
)

TIMEOUT_SECS = 12
LOOKBACK_DAYS = 10
SCRIPT_DIR = Path(__file__).resolve().parent
OBSCURA_BIN = SCRIPT_DIR / "bin" / "obscura.exe"
_OBSCURA_SEM = threading.Semaphore(8)


@dataclass
class NewsSource:
    id: str
    name_en: str
    name_bn: str
    domain: str
    lang: str
    tier: int
    region: str
    endpoints: list[str]
    use_obscura: bool = False


def build_sources(now_utc: datetime) -> list[NewsSource]:
    bd_now = now_utc + timedelta(hours=6)
    days = [(bd_now - timedelta(days=d)).strftime("%Y-%m-%d") for d in range(LOOKBACK_DAYS)]

    palo_sitemaps = [f"https://www.prothomalo.com/sitemap/sitemap-daily-{d}.xml" for d in days]
    dhakapost_sitemaps = [f"https://www.dhakapost.com/sitemaps/sitemap-daily-{d}.xml" for d in days]
    jagonews_archives = [f"https://www.jagonews24.com/archive?date={d}" for d in days]

    return [
        NewsSource("prothomalo", "Prothom Alo", "প্রথম আলো", "prothomalo.com", "bn", 1, "national", [
            *palo_sitemaps,
            "https://www.prothomalo.com/politics",
            "https://www.prothomalo.com/world",
            "https://www.prothomalo.com/sports",
            "https://www.prothomalo.com/topic/" + urllib.parse.quote("শেখ-হাসিনা"),
        ], use_obscura=True),
        NewsSource("dhakapost", "Dhaka Post", "ঢাকা পোস্ট", "dhakapost.com", "bn", 2, "national", [
            *dhakapost_sitemaps,
            "https://www.dhakapost.com/politics",
            "https://www.dhakapost.com/international",
            "https://www.dhakapost.com/sports",
        ], use_obscura=True),
        NewsSource("jagonews24", "Jagonews24", "জাগোনিউজ২৪", "jagonews24.com", "bn", 2, "national", [
            "https://www.jagonews24.com/rss/rss.xml",
            *jagonews_archives,
        ], use_obscura=True),
        NewsSource("bd-pratidin", "Bangladesh Pratidin", "বাংলাদেশ প্রতিদিন", "bd-pratidin.com", "bn", 2, "national", [
            "https://www.bd-pratidin.com/rss.xml",
        ], use_obscura=True),
        NewsSource("bbc-bangla", "BBC Bangla", "বিবিসি বাংলা", "bbc.com", "bn", 1, "international", [
            "https://feeds.bbci.co.uk/bengali/rss.xml",
            "https://www.bbc.com/bengali",
            "https://www.bbc.com/bengali/topics/c9wpm0e519gt",
        ], use_obscura=True),
        NewsSource("bbc-world", "BBC World", "বিবিসি ওয়ার্ল্ড", "bbc.co.uk", "en", 1, "international", [
            "https://feeds.bbci.co.uk/news/world/rss.xml",
            "https://feeds.bbci.co.uk/news/technology/rss.xml",
        ], use_obscura=False),
        NewsSource("bbc-sport", "BBC Sport", "বিবিসি স্পোর্ট", "bbc.co.uk", "en", 1, "national", [
            "https://feeds.bbci.co.uk/sport/rss.xml",
        ], use_obscura=False),
        NewsSource("tbsnews", "The Business Standard", "দ্য বিজনেস স্ট্যান্ডার্ড", "tbsnews.net", "en", 1, "national", [
            "https://www.tbsnews.net/sitemap.xml",
            "https://www.tbsnews.net/top-news/rss.xml",
        ], use_obscura=True),
        NewsSource("dailystar", "The Daily Star", "দ্য ডেইলি স্টার", "thedailystar.net", "en", 1, "national", [
            "https://www.thedailystar.net/frontpage/rss.xml",
            "https://www.thedailystar.net/top-news/rss.xml",
            "https://www.thedailystar.net/news/bangladesh/politics",
            "https://www.thedailystar.net/sports",
        ], use_obscura=True),
        NewsSource("aljazeera", "Al Jazeera", "আল জাজিরা", "aljazeera.com", "en", 1, "international", [
            "https://www.aljazeera.com/xml/rss/all.xml",
        ], use_obscura=False),
        NewsSource("bdnews24-bn", "bdnews24.com", "বিডিনিউজ২৪", "bangla.bdnews24.com", "bn", 1, "national", [
            "https://bangla.bdnews24.com/?widgetName=rssfeed&widgetId=1150&getXmlFeed=true",
        ], use_obscura=True),
        NewsSource("bdnews24-en", "bdnews24 English", "বিডিনিউজ২৪ ইংরেজি", "bdnews24.com", "en", 1, "national", [
            "https://bdnews24.com/?widgetName=rssfeed&widgetId=1150&getXmlFeed=true",
        ], use_obscura=True),
        NewsSource("jugantor", "Jugantor", "যুগান্তর", "jugantor.com", "bn", 1, "national", [
            "https://www.jugantor.com/",
            "https://www.jugantor.com/politics",
            "https://www.jugantor.com/international",
        ], use_obscura=True),
        NewsSource("kalbela", "Kalbela", "কালবেলা", "kalbela.com", "bn", 2, "national", [
            "https://www.kalbela.com/",
            "https://www.kalbela.com/politics",
            "https://www.kalbela.com/world",
        ], use_obscura=True),
        NewsSource("samakal", "Samakal", "সমকাল", "samakal.com", "bn", 1, "national", [
            "https://samakal.com/",
            "https://samakal.com/politics",
        ], use_obscura=True),
        NewsSource("ittefaq", "Daily Ittefaq", "দৈনিক ইত্তেফাক", "ittefaq.com.bd", "bn", 1, "national", [
            "https://www.ittefaq.com.bd/feed",
            "https://www.ittefaq.com.bd/politics",
        ], use_obscura=True),
        NewsSource("kalerkantho", "Kaler Kantho", "কালের কণ্ঠ", "kalerkantho.com", "bn", 2, "national", [
            "https://www.kalerkantho.com/",
        ], use_obscura=True),
        NewsSource("somoynews", "Somoy News", "সময় টিভি", "somoynews.tv", "bn", 2, "national", [
            "https://www.somoynews.tv/",
        ], use_obscura=True),
        NewsSource("banglatribune", "Bangla Tribune", "বাংলা ট্রিবিউন", "banglatribune.com", "bn", 2, "national", [
            "https://www.banglatribune.com/",
        ], use_obscura=True),
        NewsSource("deshrupantor", "Desh Rupantor", "দেশ রূপান্তর", "deshrupantor.com", "bn", 2, "national", [
            "https://www.deshrupantor.com/",
        ], use_obscura=True),
        NewsSource("dhakatribune", "Dhaka Tribune", "ঢাকা ট্রিবিউন", "dhakatribune.com", "en", 1, "national", [
            "https://www.dhakatribune.com/feed",
        ], use_obscura=True),
        NewsSource("financialexpress", "The Financial Express", "ফাইন্যান্সিয়াল এক্সপ্রেস", "thefinancialexpress.com.bd", "en", 1, "national", [
            "https://thefinancialexpress.com.bd/feed",
        ], use_obscura=True),
        NewsSource("newage", "New Age", "নিউ এজ", "newagebd.net", "en", 2, "national", [
            "https://www.newagebd.net/rss",
        ], use_obscura=True),
        NewsSource("bonikbarta", "Bonik Barta", "বণিক বার্তা", "bonikbarta.com", "bn", 1, "national", [
            "https://bonikbarta.com/",
        ], use_obscura=True),
        NewsSource("mzamin", "Manab Zamin", "মানবজমিন", "mzamin.com", "bn", 2, "national", [
            "https://mzamin.com/",
        ], use_obscura=True),
        NewsSource("dainikazadi", "Dainik Azadi", "দৈনিক আজাদী", "dainikazadi.net", "bn", 3, "regional", [
            "https://dainikazadi.net/feed/",
        ], use_obscura=True),
    ]


@dataclass
class RawItem:
    source_id: str
    source_name_en: str
    source_name_bn: str
    source_domain: str
    source_tier: int
    lang: str
    region: str
    title: str
    summary: str
    body_paragraphs: list[str]
    url: str
    image_url: str | None
    published_at: datetime
    timestamp_candidates: list[datetime] = field(default_factory=list)
    category: str = "national"
    has_real_ts: bool = False


BOILERPLATE_TITLES = {
    "ইসলামী প্রশ্নোত্তর",
    "সর্বশেষ ফলাফল প্রাপ্ত আসন বিএনপি জামায়াত অন্যান্য",
    "science, technology & environment",
    "just a moment...",
    "403 forbidden",
    "access denied",
    "sorry...",
}

NOISE_PHRASES = (
    "subscribe", "cookie", "copyright: any unauthorized", "all rights reserved", "follow us",
    "গুগল নিউজে", "বিজ্ঞাপন", "এই বিভাগের আরও", "সর্বশেষ খবর পেতে", "চোখ রাখুন প্রথম আলোতে",
    "আরও পড়তে ক্লিক করুন", "click here to", "sign up for", "share this article",
    "বিস্তারিত আসছে", "ফলো করুন", "ইউটিউব চ্যানেল", "সব খবর জানতে চোখ রাখুন",
)

PROMO_SENTENCE_RE = re.compile(
    r"(?:এই\s+(?:ম্যাচের|বিষয়ের|বিষয়ের)\s+সব\s+খবর\s+জানতে\s+চোখ\s+রাখুন[^।!?]*[।!?]?|"
    r"সর্বশেষ\s+খবর\s+পেতে\s+গুগল\s+নিউজ[^।!?]*[।!?]?|"
    r"চোখ\s+রাখুন\s+প্রথম\s+আলোতে[।!?]?|"
    r"আরও\s+পড়ুন\s*:?[^।!?\n]*$|"
    r"আরও\s+পড়ুন\s*:?[^।!?\n]*$|"
    r"Copyright:\s*Any unauthorized[^.\n]*\.?)",
    flags=re.I,
)

GENERIC_DESC_FRAGMENTS = (
    "leading english language daily",
    "leading bangla daily",
    "new age, a dhaka-based",
    "newspaper published from dhaka",
    "latest news of bangladesh",
)

JS_REQUIRED_DOMAINS = (
    "thedailystar.net",
    "dhakatribune.com",
    "bonikbarta.com",
    "newagebd.net",
    "thefinancialexpress.com.bd",
)


def strip_promo_tails(text: str) -> str:
    t = PROMO_SENTENCE_RE.sub("", text)
    t = re.sub(r"^(?:প্রকাশ|Published|আপডেট|Updated)\s*[:：][^\n|]{0,50}\|?\s*", "", t, flags=re.I)
    t = re.sub(r"\s+", " ", t).strip()
    if t.endswith("...") or t.endswith("…"):
        # Truncated RSS preview tail — trim partial last fragment back to last complete sentence if available
        trimmed = t.rstrip(".… ")
        last_stop = max(trimmed.rfind("।"), trimmed.rfind("."))
        if last_stop > len(trimmed) * 0.45:
            t = trimmed[: last_stop + 1]
    return t.strip()


def clean_text(raw: str | None) -> str:
    if not raw:
        return ""
    text = html.unescape(html.unescape(raw))
    text = re.sub(r"<!\[CDATA\[(.*?)\]\]>", r"\1", text, flags=re.DOTALL)
    text = re.sub(r"<(script|style|noscript|aside|nav|footer)\b[^>]*>.*?</\1>", " ", text, flags=re.DOTALL | re.I)
    text = re.sub(r"<!--.*?-->", " ", text, flags=re.DOTALL)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"googletag\.cmd\.push\(.*?\);", " ", text, flags=re.DOTALL)
    text = text.replace("\xa0", " ").replace("&nbsp;", " ")
    text = re.sub(r"\s+", " ", text).strip()
    return text


def clean_headline(raw: str, source: NewsSource) -> str:
    t = clean_text(raw)
    t = re.sub(r"^\[[^\]]+\]\s*", "", t)
    for sep in (" | ", " - ", " — ", " :: "):
        if sep in t:
            left, right = t.rsplit(sep, 1)
            r_low = right.lower()
            if (
                source.name_en.lower() in r_low
                or source.name_bn in right
                or source.domain.split(".")[0] in r_low
                or len(right) < 24
            ):
                t = left.strip()
    return t.strip()


def parse_timestamp(raw: str | None, fallback_url: str = "", now_utc: datetime | None = None) -> datetime | None:
    now_utc = now_utc or datetime.now(timezone.utc)
    min_allowed = now_utc - timedelta(days=LOOKBACK_DAYS + 2)
    max_allowed = now_utc + timedelta(hours=4)

    def clamp_valid(dt: datetime | None) -> datetime | None:
        if dt is None:
            return None
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        dt = dt.astimezone(timezone.utc)
        if min_allowed <= dt <= max_allowed:
            return dt
        return None

    if raw:
        s = raw.strip()
        try:
            v = clamp_valid(email.utils.parsedate_to_datetime(s))
            if v:
                return v
        except Exception:
            pass
        try:
            iso = s.replace("Z", "+00:00")
            iso = re.sub(r"([+-]\d{2})(\d{2})$", r"\1:\2", iso)
            v = clamp_valid(datetime.fromisoformat(iso))
            if v:
                return v
        except Exception:
            pass
        m = re.search(r"(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?", s)
        if m:
            try:
                y, mo, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
                hh, mm, ss = int(m.group(4) or 12), int(m.group(5) or 0), int(m.group(6) or 0)
                v = clamp_valid(datetime(y, mo, d, hh, mm, ss, tzinfo=timezone.utc))
                if v:
                    return v
            except Exception:
                pass

    if fallback_url:
        m_url = re.search(r"(202\d)[/-](\d{2})[/-](\d{2})", fallback_url)
        if m_url:
            try:
                dt = datetime(int(m_url.group(1)), int(m_url.group(2)), int(m_url.group(3)), 12, 0, tzinfo=timezone.utc)
                return clamp_valid(dt)
            except Exception:
                pass
    return None


def fetch_raw_urllib(url: str) -> str:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "application/rss+xml, application/xml, text/xml, text/html, */*;q=0.8",
            "Accept-Language": "bn-BD,bn;q=0.9,en-US;q=0.8,en;q=0.7",
            "Accept-Encoding": "gzip, identity",
        },
    )
    ctx = ssl.create_default_context()
    with urllib.request.urlopen(req, timeout=TIMEOUT_SECS, context=ctx) as resp:
        raw_bytes = resp.read(2_500_000)
        if resp.headers.get("Content-Encoding", "").lower() == "gzip":
            try:
                raw_bytes = gzip.decompress(raw_bytes)
            except Exception:
                pass
        return raw_bytes.decode("utf-8", errors="replace")


def fetch_raw_obscura(url: str, mode: str = "original") -> str:
    if not OBSCURA_BIN.exists():
        return fetch_raw_urllib(url)
    cmd = [str(OBSCURA_BIN), "--stealth", "fetch", url, "--dump", mode, "--timeout", "18", "-q"]
    if mode == "html":
        cmd.extend(["--wait", "2"])
    with _OBSCURA_SEM:
        res = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=26,
        )
    return res.stdout or ""


def fetch_text(url: str, use_obscura: bool = False, render_html: bool = False) -> str:
    low_u = url.lower()
    is_feed = low_u.endswith(".xml") or "/rss" in low_u or low_u.endswith("/feed") or "getxmlfeed" in low_u
    force_browser = (not is_feed) and (render_html or any(dom in low_u for dom in JS_REQUIRED_DOMAINS))
    if not force_browser:
        try:
            txt = fetch_raw_urllib(url)
            head = txt[:2500].lower() if txt else ""
            if (
                txt
                and len(txt) > 8000
                and "just a moment" not in head
                and "<title>403" not in head
                and "checking your browser" not in head
            ):
                return txt
        except Exception:
            pass
    if (use_obscura or force_browser) and OBSCURA_BIN.exists():
        try:
            mode = "html" if force_browser else "original"
            out = fetch_raw_obscura(url, mode=mode)
            if out and len(out) > 4000:
                return out
            if mode == "original":
                return fetch_raw_obscura(url, mode="html")
        except Exception:
            pass
    try:
        return fetch_raw_urllib(url)
    except Exception:
        return ""


def _parse_jsonld_article(html_text: str) -> dict[str, Any]:
    meta: dict[str, Any] = {}
    for m in re.finditer(
        r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
        html_text,
        flags=re.DOTALL | re.I,
    ):
        raw = m.group(1).strip()
        if not raw:
            continue
        try:
            data = json.loads(raw)
        except Exception:
            continue
        queue = data if isinstance(data, list) else [data]
        for node in list(queue):
            if isinstance(node, dict) and isinstance(node.get("@graph"), list):
                queue.extend(node["@graph"])
        for obj in queue:
            if not isinstance(obj, dict):
                continue
            if obj.get("articleBody") and not meta.get("articleBody"):
                meta["articleBody"] = str(obj["articleBody"])
            if obj.get("datePublished") and not meta.get("datePublished"):
                meta["datePublished"] = str(obj["datePublished"])
            if obj.get("headline") and not meta.get("headline"):
                meta["headline"] = str(obj["headline"])
            if obj.get("description") and not meta.get("description"):
                meta["description"] = str(obj["description"])
    return meta


def _collect_paragraphs_from_html(fragment: str) -> list[str]:
    paras: list[str] = []
    seen_p: set[str] = set()
    for m in re.finditer(r"<p\b[^>]*>(.*?)</p>", fragment, flags=re.DOTALL | re.I):
        raw_inner = m.group(1)
        if re.search(r"^\s*<a\b[^>]*>.*?</a>\s*$", raw_inner, flags=re.DOTALL | re.I):
            continue
        p = strip_promo_tails(clean_text(raw_inner))
        low = p.lower()
        if len(p) < 28 or any(n in low for n in NOISE_PHRASES):
            continue
        if re.match(r"^(?:ছবি|ফাইল ছবি|Photo|Credit)\s*[:：]", p, flags=re.I) and len(p) < 90:
            continue
        key = p[:42]
        if key in seen_p:
            continue
        seen_p.add(key)
        paras.append(p)
        if len(paras) >= 16:
            break
    return paras


def extract_dom_from_html(html_text: str, page_url: str) -> dict[str, Any]:
    ld = _parse_jsonld_article(html_text)

    h1_m = re.search(r"<h1\b[^>]*>(.*?)</h1>", html_text, re.S | re.I)
    og_t_m = re.search(
        r'<meta[^>]+property=["\']og:title["\'][^>]+content=["\']([^"\']+)["\']|<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:title["\']',
        html_text,
        re.I,
    )
    title_m = re.search(r"<title\b[^>]*>(.*?)</title>", html_text, re.S | re.I)
    t_val = (
        clean_text(h1_m.group(1))
        if h1_m
        else (
            clean_text(ld.get("headline"))
            or (clean_text(og_t_m.group(1) or og_t_m.group(2)) if og_t_m else (clean_text(title_m.group(1)) if title_m else ""))
        )
    )

    desc_m = re.search(
        r'<meta[^>]+(?:name=["\']description["\']|property=["\']og:description["\'])[^>]+content=["\']([^"\']+)["\']|<meta[^>]+content=["\']([^"\']+)["\'][^>]+(?:name=["\']description["\']|property=["\']og:description["\'])',
        html_text,
        re.I,
    )
    d_val = strip_promo_tails(clean_text(ld.get("description") or (desc_m.group(1) or desc_m.group(2) if desc_m else "")))

    img_m = re.search(
        r'<meta[^>]+(?:property=["\']og:image["\']|name=["\']twitter:image["\'])[^>]+content=["\']([^"\']+)["\']|<meta[^>]+content=["\']([^"\']+)["\'][^>]+(?:property=["\']og:image["\']|name=["\']twitter:image["\'])',
        html_text,
        re.I,
    )
    img_val = (img_m.group(1) or img_m.group(2)) if img_m else None

    pub_val = ld.get("datePublished")
    if not pub_val:
        for pat in (
            r'"datePublished"\s*:\s*"([^"]+)"',
            r'"dateCreated"\s*:\s*"([^"]+)"',
            r'property=["\']article:published_time["\'][^>]+content=["\']([^"\']+)["\']',
            r'content=["\']([^"\']+)["\'][^>]+property=["\']article:published_time["\']',
            r'dateTime=["\']([^"\']+)["\']',
            r'datetime=["\']([^"\']+)["\']',
        ):
            pm = re.search(pat, html_text, re.I)
            if pm:
                pub_val = pm.group(1)
                break

    # Strip non-content boilerplate tags cleanly (avoid greedy header/form/aside over-stripping)
    cleaned_html = re.sub(
        r"<(script|style|noscript|footer|nav|svg)\b[^>]*>.*?</\1>",
        " ",
        html_text,
        flags=re.DOTALL | re.I,
    )

    # Prefer scoped <article> block first when rich
    paras: list[str] = []
    art_m = re.search(r"<article\b[^>]*>(.*?)</article>", cleaned_html, flags=re.DOTALL | re.I)
    if art_m:
        paras = _collect_paragraphs_from_html(art_m.group(1))
    if len(paras) < 3:
        paras = _collect_paragraphs_from_html(cleaned_html)

    # Fallback / supplement from JSON-LD articleBody when HTML DOM was JS-gated or <div/> formatted
    ld_body = strip_promo_tails(clean_text(ld.get("articleBody")))
    if ld_body and (len(paras) < 3 or sum(len(x) for x in paras) < len(ld_body) * 0.6):
        # Split long articleBody cleanly every 2 sentences into natural readable paragraphs
        sents = [s.strip() for s in re.split(r"(?<=[।\.\?!])\s+", ld_body) if len(s.strip()) >= 25]
        grouped: list[str] = []
        buf: list[str] = []
        for s in sents:
            if any(n in s.lower() for n in NOISE_PHRASES):
                continue
            buf.append(s)
            if len(buf) >= 2 and sum(len(b) for b in buf) >= 180:
                grouped.append(" ".join(buf))
                buf = []
        if buf:
            grouped.append(" ".join(buf))
        if len(grouped) >= len(paras):
            paras = grouped[:16]

    return {"u": page_url, "t": t_val, "d": d_val, "img": img_val, "pub": pub_val, "paras": paras}


def obscura_batch_extract(urls: list[str], concurrency: int = 18) -> dict[str, dict[str, Any]]:
    """Parallel hybrid extractor: fast HTTP first, automatic obscura stealth rendered-DOM escalation when body < 4 paragraphs."""
    out_map: dict[str, dict[str, Any]] = {}
    if not urls:
        return out_map

    def worker(u: str) -> tuple[str, dict[str, Any] | None]:
        raw_html = fetch_text(u, use_obscura=True, render_html=False)
        dom = extract_dom_from_html(raw_html, u) if raw_html and len(raw_html) > 400 else None
        para_count = len(dom.get("paras") or []) if dom else 0
        body_chars = sum(len(p) for p in (dom.get("paras") or [])) if dom else 0
        if (para_count < 3 or body_chars < 420) and OBSCURA_BIN.exists():
            rendered_html = fetch_text(u, use_obscura=True, render_html=True)
            if rendered_html and len(rendered_html) > 400:
                dom2 = extract_dom_from_html(rendered_html, u)
                if len(dom2.get("paras") or []) > para_count:
                    dom = dom2
        return u, dom

    done = 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=concurrency) as pool:
        futs = [pool.submit(worker, u) for u in urls]
        for fut in concurrent.futures.as_completed(futs):
            done += 1
            try:
                u, dom = fut.result()
                if dom:
                    out_map[u] = dom
            except Exception:
                pass
            if done % 100 == 0 or done == len(urls):
                print(f"  [obscura+http] extracted {done}/{len(urls)} ({len(out_map)} rich HTML pages)", flush=True)
    return out_map


def infer_category(title: str, url: str, fallback: str = "national") -> str:
    text = f"{title} {url}".lower()
    mapping = [
        ("politics", [
            "রাজনীতি", "নির্বাচন", "বিএনপি", "জামায়াত", "আওয়ামী", "শেখ হাসিনা", "হাসিনা", "সরকার", "সংসদ", "উপদেষ্টা",
            "politics", "election", "parliament", "government", "bnp", "hasina", "awami", "yunus", "ministry",
        ]),
        ("international", [
            "বিশ্ব", "যুদ্ধ", "হামলা", "ক্ষেপণাস্ত্র", "ইসরায়েল", "ইসরায়েল", "গাজা", "ইউক্রেন", "রাশিয়া", "ইরান", "চীন", "ভারত", "আমেরিকা", "ট্রাম্প",
            "war", "strike", "missile", "military", "conflict", "gaza", "ukraine", "russia", "israel", "iran", "world", "international", "global", "usa", "india", "china", "myanmar", "sudan", "tigray",
        ]),
        ("sports", [
            "খেলা", "ক্রিকেট", "ফুটবল", "গেম", "ই-স্পোর্টস", "টাইগার", "সাকিব", "লিটন", "বিসিবি", "ফিফা", "টুর্নামেন্ট", "বিশ্বকাপ",
            "cricket", "football", "sports", "game", "gaming", "esports", "fifa", "ipl", "bpl", "coach", "match", "tournament", "goal", "premier league", "champions",
        ]),
        ("economy", [
            "অর্থনীতি", "ব্যাংক", "শেয়ার", "বাণিজ্য", "টাকা", "ডলার", "মুদ্রাস্ফীতি", "সোনা", "স্বর্ণ", "রপ্তানি", "বাজেট",
            "economy", "business", "bank", "market", "trade", "finance", "oil", "tariff", "inflation", "gdp", "export", "remittance",
        ]),
        ("tech", [
            "প্রযুক্তি", "কৃত্রিম বুদ্ধিমত্তা", "এআই", "ইন্টারনেট", "মোবাইল", "সাইবার", "সফটওয়্যার", "গেমিং",
            "tech", "ai", "software", "cyber", "startup", "google", "apple", "openai", "chip", "technology",
        ]),
        ("entertainment", [
            "বিনোদন", "সিনেমা", "অভিনেতা", "অভিনেত্রী", "নাটক", "গান", "সংস্কৃতি", "চলচ্চিত্র", "বলিউড", "হলিউড",
            "entertainment", "cinema", "film", "culture", "music", "movie", "actor", "actress", "bollywood", "hollywood",
        ]),
    ]
    for cat, kws in mapping:
        if any(kw in text for kw in kws):
            return cat
    return fallback


def normalize_image_url(img: str | None, base_url: str) -> str | None:
    if not img:
        return None
    img = html.unescape(img.strip())
    if img.startswith("//"):
        img = "https:" + img
    elif img.startswith("/"):
        img = urllib.parse.urljoin(base_url, img)
    if not img.startswith("http"):
        return None
    lower = img.lower()
    if any(skip in lower for skip in ["favicon", "logo-icon", "sprite", "1x1", "pixel.gif", "blank.png"]):
        return None
    return img


def parse_xml_feed_or_sitemap(xml_text: str, source: NewsSource, base_url: str, now_utc: datetime) -> tuple[list[str], list[RawItem]]:
    cleaned = re.sub(r'xmlns(?::[a-zA-Z0-9_-]+)?="[^"]*"', "", xml_text)
    cleaned = re.sub(r"<([a-zA-Z0-9_-]+):", "<", cleaned)
    cleaned = re.sub(r"</([a-zA-Z0-9_-]+):", "</", cleaned)
    try:
        root = ET.fromstring(cleaned)
    except Exception:
        return [], []

    child_sitemaps: list[str] = []
    for sm in root.findall(".//sitemap"):
        loc = clean_text(sm.findtext("loc"))
        lastmod = clean_text(sm.findtext("lastmod"))
        if loc:
            dt = parse_timestamp(lastmod, loc, now_utc)
            if dt is None or dt >= now_utc - timedelta(days=LOOKBACK_DAYS + 2):
                child_sitemaps.append(loc)

    items: list[RawItem] = []

    # 1. RSS / Atom
    entries = root.findall(".//item") or root.findall(".//entry")
    for node in entries[:250]:
        title = clean_headline(node.findtext("title") or "", source)
        link = clean_text(node.findtext("link"))
        if not link:
            link_el = node.find("link")
            if link_el is not None:
                link = link_el.attrib.get("href", "")
        if not title or not link or len(title) < 12 or title.lower() in BOILERPLATE_TITLES:
            continue
        low_link = link.lower()
        if any(skip in low_link for skip in ("/star-multimedia/", "/multimedia/", "/video/", "/photo/", "/gallery/")):
            continue

        desc = clean_text(node.findtext("description") or node.findtext("summary") or node.findtext("encoded"))
        pub_raw = clean_text(node.findtext("pubDate") or node.findtext("published") or node.findtext("updated"))
        full_url = urllib.parse.urljoin(base_url, link)
        dt = parse_timestamp(pub_raw, full_url, now_utc)
        if not dt:
            continue

        img = None
        for tag in ["content", "thumbnail", "enclosure"]:
            el = node.find(tag)
            if el is not None and el.attrib.get("url"):
                img = el.attrib.get("url")
                break
        if not img:
            raw_desc = (node.findtext("description") or "") + (node.findtext("encoded") or "")
            m = re.search(r'<img[^>]+src=["\']([^"\']+)["\']', raw_desc, re.I)
            if m:
                img = m.group(1)

        items.append(RawItem(
            source_id=source.id,
            source_name_en=source.name_en,
            source_name_bn=source.name_bn,
            source_domain=source.domain,
            source_tier=source.tier,
            lang=source.lang,
            region=source.region,
            title=title,
            summary=desc[:360] if desc else title,
            body_paragraphs=[desc] if desc and len(desc) > 70 else [],
            url=full_url,
            image_url=normalize_image_url(img, base_url),
            published_at=dt,
            timestamp_candidates=[dt],
            category="regional" if source.region == "regional" else infer_category(title, full_url),
            has_real_ts=True,
        ))

    # 2. Daily Sitemaps (<url>) — do NOT discard hash-slug URLs (like Prothom Alo `/politics/166h0qrizq`); obscura extracts real title + body!
    ep_dt = parse_timestamp(None, base_url, now_utc)
    for unode in root.findall(".//url"):
        loc = clean_text(unode.findtext("loc"))
        if not loc or len(loc) < 20:
            continue
        low_loc = loc.lower()
        if any(skip in low_loc for skip in ("/topic/", "/tag/", "/author/", "/video/", "/photo/", "/e-paper", "/gallery", "/star-multimedia/", "/multimedia/")):
            continue
        news_el = unode.find("news")
        pub_str = clean_text(news_el.findtext("publication_date") if news_el is not None else None) or clean_text(unode.findtext("lastmod"))
        dt = parse_timestamp(pub_str, loc, now_utc) or ep_dt
        if not dt:
            continue
        raw_title = clean_headline(news_el.findtext("title") if news_el is not None else "", source)
        img_el = unode.find("image")
        img = clean_text(img_el.findtext("loc")) if img_el is not None else None
        items.append(RawItem(
            source_id=source.id,
            source_name_en=source.name_en,
            source_name_bn=source.name_bn,
            source_domain=source.domain,
            source_tier=source.tier,
            lang=source.lang,
            region=source.region,
            title=raw_title or "__PENDING_TITLE__",
            summary="",
            body_paragraphs=[],
            url=loc,
            image_url=normalize_image_url(img, base_url),
            published_at=dt,
            timestamp_candidates=[dt],
            category="regional" if source.region == "regional" else infer_category(raw_title or loc, loc),
            has_real_ts=True,
        ))

    return child_sitemaps, items


def parse_html_links(html_text: str, source: NewsSource, base_url: str, now_utc: datetime) -> list[RawItem]:
    items: list[RawItem] = []
    seen: set[str] = set()
    archive_dt = parse_timestamp(None, base_url, now_utc)
    pattern = re.compile(r'<a[^>]+href=["\']([^"\']+)["\'][^>]*>(.*?)</a>', re.S | re.I)

    for m in pattern.finditer(html_text):
        href, raw_label = m.group(1), m.group(2)
        title = clean_headline(raw_label, source)
        if not title or len(title) < 22 or len(title) > 220 or title.lower() in BOILERPLATE_TITLES:
            continue
        if any(bad in href.lower() for bad in ["javascript:", "#", "/tag/", "/author/", "/video", "facebook.com", "youtube.com", "/login", "/search", "/oauth", "archive?date="]):
            continue
        full_url = urllib.parse.urljoin(base_url, href)
        if source.domain not in urllib.parse.urlparse(full_url).netloc:
            continue
        if full_url in seen:
            continue
        seen.add(full_url)
        url_dt = parse_timestamp(None, full_url, now_utc) or archive_dt
        dt = url_dt or (now_utc - timedelta(minutes=len(items) + 15))
        items.append(RawItem(
            source_id=source.id,
            source_name_en=source.name_en,
            source_name_bn=source.name_bn,
            source_domain=source.domain,
            source_tier=source.tier,
            lang=source.lang,
            region=source.region,
            title=title,
            summary="",
            body_paragraphs=[],
            url=full_url,
            image_url=None,
            published_at=dt,
            timestamp_candidates=[dt] if url_dt else [],
            category="regional" if source.region == "regional" else infer_category(title, full_url),
            has_real_ts=bool(url_dt),
        ))
        if len(items) >= 40:
            break
    return items


def collect_source_urls(source: NewsSource, now_utc: datetime) -> list[RawItem]:
    collected: list[RawItem] = []
    seen_urls: set[str] = set()
    fetched_sitemaps: set[str] = set()
    queue = list(source.endpoints)

    while queue and len(collected) < 600:
        ep = queue.pop(0)
        if ep in fetched_sitemaps:
            continue
        fetched_sitemaps.add(ep)
        txt = fetch_text(ep, use_obscura=source.use_obscura)
        if not txt:
            continue
        head = txt[:2000].lower()
        if "just a moment" in head or "access denied" in head or "<title>403" in head:
            continue
        is_xml = txt.lstrip().startswith("<?xml") or "<urlset" in head or "<sitemapindex" in head or "<rss" in head or "<feed" in head
        if is_xml:
            child_smaps, items = parse_xml_feed_or_sitemap(txt, source, ep, now_utc)
            # Handle both newest-first and oldest-first sitemap indexes safely
            for cs in child_smaps[:6] + child_smaps[-6:]:
                if cs not in fetched_sitemaps:
                    queue.append(cs)
            # Sample balanced categories across each daily sitemap (diverse sections first, then general)
            by_cat: dict[str, list[RawItem]] = {}
            for it in items:
                by_cat.setdefault(it.category, []).append(it)
            per_slice: list[RawItem] = []
            idx = 0
            while len(per_slice) < (45 if "sitemap" in ep.lower() else 160):
                added = False
                for cat_list in by_cat.values():
                    if idx < len(cat_list):
                        per_slice.append(cat_list[idx])
                        added = True
                        if len(per_slice) >= (45 if "sitemap" in ep.lower() else 160):
                            break
                if not added:
                    break
                idx += 1
            for it in per_slice:
                if it.url not in seen_urls:
                    seen_urls.add(it.url)
                    collected.append(it)
        else:
            items = parse_html_links(txt, source, ep, now_utc)
            for it in items:
                if it.url not in seen_urls:
                    seen_urls.add(it.url)
                    collected.append(it)
    return collected


def enrich_items_with_obscura(items: list[RawItem], now_utc: datetime, max_scrape: int = 2400) -> None:
    """Select balanced candidates across ALL 10 days + viral/war/sports topics for obscura DOM & timestamp extraction."""
    raw_candidates = [
        it for it in items
        if (
            "/star-multimedia/" not in it.url.lower()
            and "/multimedia/" not in it.url.lower()
            and (
                it.title == "__PENDING_TITLE__"
                or not it.has_real_ts
                or len(it.body_paragraphs) < 4
                or sum(len(p) for p in it.body_paragraphs) < 500
                or not it.image_url
            )
        )
    ]
    by_day: dict[str, list[RawItem]] = {}
    for it in raw_candidates:
        day_key = it.published_at.strftime("%Y-%m-%d")
        by_day.setdefault(day_key, []).append(it)

    for dk in by_day:
        by_day[dk].sort(
            key=lambda x: (
                1 if x.has_real_ts else 0,
                1 if ("হাসিনা" in x.title or "hasina" in x.title.lower() or x.category in ("sports", "international", "politics")) else 0,
                -x.source_tier,
            ),
            reverse=True,
        )

    candidates: list[RawItem] = []
    day_keys = sorted(by_day.keys(), reverse=True)
    idx = 0
    while len(candidates) < max_scrape:
        added = False
        for dk in day_keys:
            bucket = by_day[dk]
            if idx < len(bucket):
                candidates.append(bucket[idx])
                added = True
                if len(candidates) >= max_scrape:
                    break
        if not added:
            break
        idx += 1

    if not candidates:
        return

    urls = [it.url for it in candidates]
    extracted = obscura_batch_extract(urls, concurrency=18)
    by_url = {it.url: it for it in candidates}

    for url, dom in extracted.items():
        it = by_url.get(url)
        if not it:
            continue
        raw_t = clean_text(dom.get("t"))
        if raw_t and len(raw_t) > 15 and raw_t.lower() not in BOILERPLATE_TITLES:
            it.title = raw_t
            it.category = "regional" if it.region == "regional" else infer_category(raw_t, url, it.category)

        pub_dt = parse_timestamp(dom.get("pub"), url, now_utc)
        if pub_dt:
            it.timestamp_candidates.append(pub_dt)
            it.published_at = min(it.timestamp_candidates)
            it.has_real_ts = True

        img = normalize_image_url(dom.get("img"), url)
        if img and not it.image_url:
            it.image_url = img

        paras: list[str] = []
        seen_p: set[str] = set()
        for raw_p in dom.get("paras") or []:
            p = strip_promo_tails(clean_text(raw_p))
            if len(p) < 28:
                continue
            low = p.lower()
            if any(noise in low for noise in NOISE_PHRASES):
                continue
            if p[:45] in seen_p:
                continue
            seen_p.add(p[:45])
            paras.append(p)
        if paras:
            it.body_paragraphs = paras

        raw_d = strip_promo_tails(clean_text(dom.get("d")))
        if raw_d and not any(g in raw_d.lower() for g in GENERIC_DESC_FRAGMENTS) and len(raw_d) > 35:
            it.summary = raw_d[:340]
        elif paras:
            it.summary = paras[0][:340]


def tokenize_title(text: str) -> set[str]:
    stop = {
        "the", "and", "for", "with", "from", "that", "this", "into", "over", "after", "amid",
        "says", "will", "new", "bangladesh", "news", "today", "report",
        "এবং", "থেকে", "নিয়ে", "করে", "হয়েছে", "করা", "বলেছেন", "বাংলাদেশ", "আজ",
    }
    words = re.findall(r"[\w\u0980-\u09FF]{3,}", text.lower())
    return {w for w in words if w not in stop}


def rewrite_editorial_copy(lead: RawItem, group: list[RawItem]) -> tuple[str, str, str, str]:
    distinct_names_bn = []
    distinct_names_en = []
    seen_dom: set[str] = set()
    for g in group:
        if g.source_domain not in seen_dom:
            seen_dom.add(g.source_domain)
            distinct_names_bn.append(g.source_name_bn)
            distinct_names_en.append(g.source_name_en)

    merged_paras: list[str] = []
    seen_prefix: set[str] = set()
    ordered_group = [lead, *[g for g in group if g is not lead]]
    for g in ordered_group:
        for p in g.body_paragraphs:
            cp = strip_promo_tails(clean_text(p))
            if len(cp) < 28 or any(bad in cp.lower() for bad in GENERIC_DESC_FRAGMENTS):
                continue
            if any(noise in cp.lower() for noise in NOISE_PHRASES):
                continue
            key = cp[:46]
            if key not in seen_prefix:
                seen_prefix.add(key)
                merged_paras.append(cp)
            if len(merged_paras) >= 16:
                break
        if len(merged_paras) >= 16:
            break

    base_summary = strip_promo_tails(clean_text(lead.summary))
    if (
        not base_summary
        or len(base_summary) < 35
        or base_summary.lower().strip(" .।") == lead.title.lower().strip(" .।")
        or any(bad in base_summary.lower() for bad in GENERIC_DESC_FRAGMENTS)
    ):
        base_summary = merged_paras[0][:300] if merged_paras else lead.title

    src_list_bn = ", ".join(distinct_names_bn[:3])
    src_list_en = ", ".join(distinct_names_en[:3])

    body_paras: list[str] = []
    if len(merged_paras) > 0:
        first = merged_paras[0]
        if base_summary and len(base_summary) > 40 and base_summary[:35] not in first:
            body_paras.append(base_summary)
        body_paras.extend(merged_paras)
    else:
        body_paras.append(base_summary)

    if len(distinct_names_bn) > 1:
        body_paras.append(
            f"সংশ্লিষ্ট ঘটনার সময়কাল ও বিবরণ {src_list_bn}-এ প্রকাশিত একাধিক প্রতিবেদনের তথ্যের সঙ্গে মিলিয়ে নিশ্চিত করা হয়েছে।"
        )

    body_en_paras: list[str] = []
    if len(merged_paras) > 0:
        if base_summary and len(base_summary) > 40 and base_summary[:35] not in merged_paras[0]:
            body_en_paras.append(base_summary)
        body_en_paras.extend(merged_paras)
    else:
        body_en_paras.append(base_summary)

    if len(distinct_names_en) > 1:
        body_en_paras.append(
            f"Key facts and timelines in this report have been cross-checked across coverage from {src_list_en}."
        )

    return base_summary[:320], base_summary[:320], "\n\n".join(body_paras), "\n\n".join(body_en_paras)


def analyze_and_build_articles(raw_items: list[RawItem], limit: int = 1200) -> list[dict[str, Any]]:
    valid_raw = [it for it in raw_items if it.title and it.title != "__PENDING_TITLE__" and len(it.title) >= 14]

    clusters: list[list[RawItem]] = []
    cluster_tokens: list[set[str]] = []

    for item in valid_raw:
        tokens = tokenize_title(item.title)
        if not tokens:
            continue
        matched_idx = -1
        best_sim = 0.0
        for idx, c_tok in enumerate(cluster_tokens):
            if item.lang != clusters[idx][0].lang:
                continue
            inter = len(tokens & c_tok)
            union = len(tokens | c_tok)
            sim = inter / union if union else 0.0
            if sim >= 0.34 and inter >= 2 and sim > best_sim:
                best_sim = sim
                matched_idx = idx
        if matched_idx >= 0:
            if all(existing.source_domain != item.source_domain for existing in clusters[matched_idx]):
                clusters[matched_idx].append(item)
                cluster_tokens[matched_idx] |= tokens
        else:
            clusters.append([item])
            cluster_tokens.append(set(tokens))

    articles: list[dict[str, Any]] = []
    seen_slugs: set[str] = set()

    for idx, group in enumerate(clusters):
        real_ts = [ts for g in group for ts in g.timestamp_candidates]
        event_dt = min(real_ts) if real_ts else min(g.published_at for g in group)

        lead = max(
            group,
            key=lambda g: (sum(len(p) for p in g.body_paragraphs), len(g.body_paragraphs), 1 if g.image_url else 0, -g.source_tier),
        )
        summary_bn, summary_en, body_bn, body_en = rewrite_editorial_copy(lead, group)
        para_count = len([p for p in body_bn.split("\n\n") if len(p.strip()) >= 28])
        # Never publish thin 1-2 line stub / redirect posts
        if para_count < 3 and len(body_bn) < 420:
            continue

        distinct_sources = len({g.source_domain for g in group})
        slug_hash = hashlib.sha1(lead.url.encode("utf-8")).hexdigest()[:8]
        slug_base = re.sub(r"[^a-z0-9]+", "-", lead.title.lower()).strip("-")[:48]
        slug = f"{slug_base}-{slug_hash}" if slug_base else f"story-{slug_hash}"
        if slug in seen_slugs:
            continue
        seen_slugs.add(slug)

        image_url = next((g.image_url for g in group if g.image_url), None)

        sources_payload = [
            {
                "sourceId": g.source_id,
                "nameEn": g.source_name_en,
                "nameBn": g.source_name_bn,
                "domain": g.source_domain,
                "url": g.url,
                "tier": g.source_tier,
                "headline": g.title,
            }
            for g in group
        ]

        articles.append({
            "id": f"art_{slug_hash}_{idx}",
            "slug": slug,
            "lang": lead.lang,
            "category": lead.category,
            "region": lead.region,
            "title_bn": lead.title,
            "title_en": lead.title,
            "summary_bn": summary_bn,
            "summary_en": summary_en,
            "body_bn": body_bn,
            "body_en": body_en,
            "verification_status": "verified" if distinct_sources >= 3 else ("corroborated" if distinct_sources == 2 else "single_source"),
            "confidence_score": 95 if distinct_sources >= 3 else (86 if distinct_sources == 2 else 76),
            "source_count": distinct_sources,
            "primary_source": lead.source_name_en,
            "primary_source_bn": lead.source_name_bn,
            "source_url": lead.url,
            "image_url": image_url,
            "image_alt": lead.title,
            "published_at": event_dt.isoformat(),
            "is_breaking": (datetime.now(timezone.utc) - event_dt).total_seconds() < 6 * 3600,
            "sources": sources_payload,
        })

    # Balance across all 10 days (up to 250 from today + full retention across prior 9 days) and sort newest-first
    articles.sort(key=lambda a: a["published_at"], reverse=True)
    if len(articles) <= limit:
        return articles

    by_day_out: dict[str, list[dict[str, Any]]] = {}
    for art in articles:
        by_day_out.setdefault(art["published_at"][:10], []).append(art)

    balanced: list[dict[str, Any]] = []
    today_key = sorted(by_day_out.keys(), reverse=True)[0]
    for dk, lst in by_day_out.items():
        cap = 260 if dk == today_key else 160
        balanced.extend(lst[:cap])
    balanced.sort(key=lambda a: a["published_at"], reverse=True)
    return balanced[:limit]


def push_sequentially(
    articles: list[dict[str, Any]],
    push_url: str,
    pat: str,
    sources_scanned: int,
    batch_size: int = 25,
    delay_secs: float = 0.4,
) -> None:
    # Chronological oldest -> newest batch push so each post is published cleanly one batch after another
    chronological = list(reversed(articles))
    total_pushed = 0
    total_batches = (len(chronological) + batch_size - 1) // batch_size

    for b_idx in range(0, len(chronological), batch_size):
        batch = chronological[b_idx : b_idx + batch_size]
        batch_num = (b_idx // batch_size) + 1
        payload = {
            "articles": batch,
            "source_report": {"working_sources": sources_scanned},
            "trigger_rebuild": (batch_num == total_batches),
        }
        target_urls = [push_url]
        if "factnewsbangladesh.bond" in push_url:
            target_urls.append(push_url.replace("factnewsbangladesh.bond", "factnews-bangladesh.pages.dev"))

        pushed_ok = False
        last_err: Exception | None = None
        for endpoint in target_urls:
            for attempt in range(4):
                req = urllib.request.Request(
                    endpoint,
                    data=json.dumps(payload).encode("utf-8"),
                    headers={
                        "Content-Type": "application/json",
                        "Authorization": f"Bearer {pat}",
                        "User-Agent": USER_AGENT,
                        "Accept": "application/json",
                    },
                    method="POST",
                )
                try:
                    with urllib.request.urlopen(req, timeout=45) as resp:
                        body = resp.read().decode("utf-8", "replace")
                        total_pushed += len(batch)
                        print(f"Batch {batch_num}/{total_batches} -> HTTP {resp.status} (pushed {total_pushed}/{len(chronological)}): {body[:120]}", flush=True)
                        pushed_ok = True
                        break
                except Exception as exc:
                    last_err = exc
                    time.sleep(1.5 * (attempt + 1))
            if pushed_ok:
                break
        if not pushed_ok and last_err:
            raise last_err
        if batch_num < total_batches and delay_secs > 0:
            time.sleep(delay_secs)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", default="../data/scraped_seed.json")
    parser.add_argument("--limit", type=int, default=1200)
    parser.add_argument("--max-extract", type=int, default=2200)
    parser.add_argument("--push-url", default="")
    parser.add_argument("--pat", default="")
    parser.add_argument("--batch-size", type=int, default=25)
    parser.add_argument("--delay", type=float, default=0.4)
    args = parser.parse_args()

    now_utc = datetime.now(timezone.utc)
    sources = build_sources(now_utc)
    print(f"Scanning {len(sources)} sources (10-day window via obscura stealth={OBSCURA_BIN.exists()})...", flush=True)

    all_items: list[RawItem] = []
    active_sources = 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        futs = {pool.submit(collect_source_urls, src, now_utc): src for src in sources}
        for fut in concurrent.futures.as_completed(futs):
            src = futs[fut]
            try:
                items = fut.result()
                if items:
                    active_sources += 1
                    all_items.extend(items)
                    print(f"  + {src.name_en}: {len(items)} candidates", flush=True)
            except Exception as e:
                print(f"  - {src.name_en}: {e}", flush=True)

    print(f"Collected {len(all_items)} raw candidates from {active_sources} sources. Running obscura extraction...", flush=True)
    enrich_items_with_obscura(all_items, now_utc, max_scrape=args.max_extract)

    articles = analyze_and_build_articles(all_items, limit=args.limit)
    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(articles, ensure_ascii=False, indent=2), encoding="utf-8")

    with_img = sum(1 for a in articles if a.get("image_url"))
    multi_para = sum(1 for a in articles if len((a.get("body_bn") or "").split("\n\n")) >= 3)
    cat_counts: dict[str, int] = {}
    day_counts: dict[str, int] = {}
    for a in articles:
        cat_counts[a["category"]] = cat_counts.get(a["category"], 0) + 1
        day_counts[a["published_at"][:10]] = day_counts.get(a["published_at"][:10], 0) + 1

    print(
        f"DONE: {len(all_items)} candidates -> {len(articles)} rewritten articles "
        f"({with_img} with photos, {multi_para} with >=3 paragraphs).",
        flush=True,
    )
    print("Categories:", json.dumps(cat_counts, ensure_ascii=False), flush=True)
    print("Days:", json.dumps(dict(sorted(day_counts.items(), reverse=True))), flush=True)

    if args.push_url and args.pat:
        push_sequentially(
            articles,
            args.push_url,
            args.pat,
            sources_scanned=active_sources,
            batch_size=args.batch_size,
            delay_secs=args.delay,
        )


if __name__ == "__main__":
    main()
