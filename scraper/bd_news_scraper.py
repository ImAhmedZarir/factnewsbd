#!/usr/bin/env python3
"""
FactNews Bangladesh — Multi-Source News Fetcher & Article Enricher.
Collects full headlines, multi-paragraph article bodies, metadata, and images
from Bangladeshi national & regional news outlets, merges corroborating reports,
and outputs clean bilingual-ready news records.
"""

from __future__ import annotations

import argparse
import concurrent.futures
import gzip
import hashlib
import html
import json
import re
import ssl
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/131.0.0.0 Safari/537.36"
)

TIMEOUT_SECS = 12


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


SOURCES: list[NewsSource] = [
    NewsSource("prothomalo", "Prothom Alo", "প্রথম আলো", "prothomalo.com", "bn", 1, "national", [
        "https://www.prothomalo.com/feed",
        "https://www.prothomalo.com/",
    ]),
    NewsSource("bdnews24-bn", "bdnews24.com", "বিডিনিউজ২৪", "bangla.bdnews24.com", "bn", 1, "national", [
        "https://bangla.bdnews24.com/?widgetName=rssfeed&widgetId=1150&getXmlFeed=true",
        "https://bangla.bdnews24.com/",
    ]),
    NewsSource("samakal", "Samakal", "সমকাল", "samakal.com", "bn", 1, "national", [
        "https://samakal.com/rss.xml",
        "https://samakal.com/",
    ]),
    NewsSource("jugantor", "Jugantor", "যুগান্তর", "jugantor.com", "bn", 1, "national", [
        "https://www.jugantor.com/feed/rss.xml",
        "https://www.jugantor.com/",
    ]),
    NewsSource("ittefaq", "Daily Ittefaq", "দৈনিক ইত্তেফাক", "ittefaq.com.bd", "bn", 1, "national", [
        "https://www.ittefaq.com.bd/feed",
        "https://www.ittefaq.com.bd/",
    ]),
    NewsSource("kalerkantho", "Kaler Kantho", "কালের কণ্ঠ", "kalerkantho.com", "bn", 2, "national", [
        "https://www.kalerkantho.com/rss.xml",
        "https://www.kalerkantho.com/",
    ]),
    NewsSource("bd-pratidin", "Bangladesh Pratidin", "বাংলাদেশ প্রতিদিন", "bd-pratidin.com", "bn", 2, "national", [
        "https://www.bd-pratidin.com/rss.xml",
        "https://www.bd-pratidin.com/",
    ]),
    NewsSource("bonikbarta", "Bonik Barta", "বণিক বার্তা", "bonikbarta.com", "bn", 1, "national", [
        "https://bonikbarta.com/rss.xml",
        "https://bonikbarta.com/",
    ]),
    NewsSource("banglatribune", "Bangla Tribune", "বাংলা ট্রিবিউন", "banglatribune.com", "bn", 2, "national", [
        "https://www.banglatribune.com/feed",
        "https://www.banglatribune.com/",
    ]),
    NewsSource("dhakapost", "Dhaka Post", "ঢাকা পোস্ট", "dhakapost.com", "bn", 2, "national", [
        "https://www.dhakapost.com/rss.xml",
        "https://www.dhakapost.com/",
    ]),
    NewsSource("jagonews24", "Jagonews24", "জাগোনিউজ২৪", "jagonews24.com", "bn", 2, "national", [
        "https://www.jagonews24.com/rss/rss.xml",
        "https://www.jagonews24.com/",
    ]),
    NewsSource("somoynews", "Somoy News", "সময় টিভি", "somoynews.tv", "bn", 2, "national", [
        "https://www.somoynews.tv/rss.xml",
        "https://www.somoynews.tv/",
    ]),
    NewsSource("jamunatv", "Jamuna TV", "যমুনা টিভি", "jamuna.tv", "bn", 2, "national", [
        "https://jamuna.tv/feed",
        "https://jamuna.tv/",
    ]),
    NewsSource("kalbela", "Kalbela", "কালবেলা", "kalbela.com", "bn", 2, "national", [
        "https://www.kalbela.com/feed",
        "https://www.kalbela.com/",
    ]),
    NewsSource("deshrupantor", "Desh Rupantor", "দেশ রূপান্তর", "deshrupantor.com", "bn", 2, "national", [
        "https://www.deshrupantor.com/feed",
        "https://www.deshrupantor.com/",
    ]),
    NewsSource("ajkerpatrika", "Ajker Patrika", "আজকের পত্রিকা", "ajkerpatrika.com", "bn", 2, "national", [
        "https://www.ajkerpatrika.com/feed",
        "https://www.ajkerpatrika.com/",
    ]),
    NewsSource("mzamin", "Manab Zamin", "মানবজমিন", "mzamin.com", "bn", 2, "national", [
        "https://mzamin.com/feed",
        "https://mzamin.com/",
    ]),
    NewsSource("nayadiganta", "Naya Diganta", "নয়া দিগন্ত", "dailynayadiganta.com", "bn", 2, "national", [
        "https://dailynayadiganta.com/rss.xml",
        "https://dailynayadiganta.com/",
    ]),
    NewsSource("inqilab", "Daily Inqilab", "দৈনিক ইনকিলাব", "dailyinqilab.com", "bn", 2, "national", [
        "https://dailyinqilab.com/feed",
        "https://dailyinqilab.com/",
    ]),
    NewsSource("risingbd", "RisingBD", "রাইজিংবিডি", "risingbd.com", "bn", 2, "national", [
        "https://www.risingbd.com/rss/rss.xml",
        "https://www.risingbd.com/",
    ]),
    NewsSource("dailystar", "The Daily Star", "দ্য ডেইলি স্টার", "thedailystar.net", "en", 1, "national", [
        "https://www.thedailystar.net/frontpage/rss.xml",
        "https://www.thedailystar.net/top-news/rss.xml",
        "https://www.thedailystar.net/",
    ]),
    NewsSource("bdnews24-en", "bdnews24.com", "বিডিনিউজ২৪", "bdnews24.com", "en", 1, "national", [
        "https://bdnews24.com/?widgetName=rssfeed&widgetId=1150&getXmlFeed=true",
        "https://bdnews24.com/",
    ]),
    NewsSource("dhakatribune", "Dhaka Tribune", "ঢাকা ট্রিবিউন", "dhakatribune.com", "en", 1, "national", [
        "https://www.dhakatribune.com/feed",
        "https://www.dhakatribune.com/",
    ]),
    NewsSource("tbsnews", "The Business Standard", "দ্য বিজনেস স্ট্যান্ডার্ড", "tbsnews.net", "en", 1, "national", [
        "https://www.tbsnews.net/top-news/rss.xml",
        "https://www.tbsnews.net/",
    ]),
    NewsSource("financialexpress", "The Financial Express", "ফাইন্যান্সিয়াল এক্সপ্রেস", "thefinancialexpress.com.bd", "en", 1, "national", [
        "https://thefinancialexpress.com.bd/feed",
        "https://thefinancialexpress.com.bd/",
    ]),
    NewsSource("newage", "New Age", "নিউ এজ", "newagebd.net", "en", 2, "national", [
        "https://www.newagebd.net/rss",
        "https://www.newagebd.net/",
    ]),
    NewsSource("dainikazadi", "Dainik Azadi", "দৈনিক আজাদী", "dainikazadi.net", "bn", 3, "regional", [
        "https://dainikazadi.net/feed/",
        "https://dainikazadi.net/",
    ]),
    NewsSource("purbokone", "Dainik Purbokone", "দৈনিক পূর্বকোণ", "dainikpurbokone.net", "bn", 3, "regional", [
        "https://dainikpurbokone.net/feed/",
        "https://dainikpurbokone.net/",
    ]),
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
    published_at: str
    category: str


BOILERPLATE_TITLES = {
    "ইসলামী প্রশ্নোত্তর",
    "সর্বশেষ ফলাফল প্রাপ্ত আসন বিএনপি জামায়াত অন্যান্য",
    "science, technology & environment",
}

NOISE_PHRASES = (
    "subscribe", "cookie", "copyright", "all rights reserved", "follow us", "google news",
    "আরও পড়ুন", "আরও পড়ুন", "সর্বশেষ খবর পেতে", "গুগল নিউজে", "বিজ্ঞাপন", "এই বিভাগের আরও",
    "click here", "sign up", "read more", "share this", "whatsapp", "telegram",
)


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


def fetch_url(url: str) -> tuple[int, str, str]:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "application/rss+xml, application/xml, text/xml, text/html, */*;q=0.8",
            "Accept-Language": "bn-BD,bn;q=0.9,en-US;q=0.8,en;q=0.7",
            "Accept-Encoding": "gzip, identity",
            "Cache-Control": "no-cache",
        },
    )
    ctx = ssl.create_default_context()
    with urllib.request.urlopen(req, timeout=TIMEOUT_SECS, context=ctx) as resp:
        code = getattr(resp, "status", 200)
        ctype = resp.headers.get("Content-Type", "")
        raw_bytes = resp.read(2_200_000)
        if resp.headers.get("Content-Encoding", "").lower() == "gzip":
            try:
                raw_bytes = gzip.decompress(raw_bytes)
            except Exception:
                pass
        body = raw_bytes.decode("utf-8", errors="replace")
        return code, ctype, body


def infer_category(title: str, url: str, fallback: str = "national") -> str:
    text = f"{title} {url}".lower()
    mapping = [
        ("politics", ["রাজনীতি", "নির্বাচন", "বিএনপি", "জামায়াত", "আওয়ামী", "সরকার", "সংসদ", "politics", "election", "parliament", "government", "bnp"]),
        ("economy", ["অর্থনীতি", "ব্যাংক", "শেয়ার", "বাণিজ্য", "টাকা", "ডলার", "মুদ্রাস্ফীতি", "সোনা", "স্বর্ণ", "রপ্তানি", "economy", "business", "bank", "market", "trade", "finance", "oil", "tariff"]),
        ("sports", ["খেলা", "ক্রিকেট", "ফুটবল", "টাইগার", "সাকিব", "লিটন", "বিসিবি", "cricket", "football", "sports", "fifa", "ipl", "bpl", "coach"]),
        ("tech", ["প্রযুক্তি", "কৃত্রিম বুদ্ধিমত্তা", "এআই", "ইন্টারনেট", "মোবাইল", "সাইবার", "tech", "ai", "software", "cyber", "startup"]),
        ("entertainment", ["বিনোদন", "সিনেমা", "অভিনেতা", "অভিনেত্রী", "নাটক", "গান", "সংস্কৃতি", "entertainment", "cinema", "film", "culture", "music"]),
        ("international", ["বিশ্ব", "ভারত", "আমেরিকা", "চীন", "রাশিয়া", "গাজা", "ইউক্রেন", "ট্রাম্প", "সৌদি", "world", "international", "global", "usa", "india", "china", "iran", "gaza", "israel", "myanmar"]),
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


def extract_article_details(art_html: str, art_url: str) -> tuple[str | None, str | None, list[str]]:
    # Image from og:image or twitter:image
    m = re.search(
        r'<meta[^>]+(?:property=["\']og:image["\']|name=["\']twitter:image["\'])[^>]+content=["\']([^"\']+)["\']',
        art_html,
        re.I,
    )
    if not m:
        m = re.search(
            r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+(?:property=["\']og:image["\']|name=["\']twitter:image["\'])',
            art_html,
            re.I,
        )
    img = normalize_image_url(m.group(1), art_url) if m else None

    desc_m = re.search(
        r'<meta[^>]+(?:name=["\']description["\']|property=["\']og:description["\'])[^>]+content=["\']([^"\']+)["\']',
        art_html,
        re.I,
    )
    desc = clean_text(desc_m.group(1))[:360] if desc_m else None
    if desc and any(
        generic in desc.lower()
        for generic in ("leading english language daily", "leading bangla daily", "new age, a dhaka-based", "newspaper published from dhaka")
    ):
        desc = None

    # Clean non-content tags first before scanning <p>
    cleaned_html = re.sub(
        r"<(script|style|noscript|header|footer|nav|aside|form|figure)\b[^>]*>.*?</\1>",
        " ",
        art_html,
        flags=re.DOTALL | re.I,
    )
    paragraphs: list[str] = []
    seen_p: set[str] = set()
    for pm in re.finditer(r"<p\b[^>]*>(.*?)</p>", cleaned_html, flags=re.DOTALL | re.I):
        text = clean_text(pm.group(1))
        if len(text) < 55:
            continue
        low = text.lower()
        if any(noise in low for noise in NOISE_PHRASES):
            continue
        if text in seen_p:
            continue
        seen_p.add(text)
        paragraphs.append(text)
        if len(paragraphs) >= 7:
            break

    return img, desc, paragraphs


def parse_rss_or_sitemap(xml_text: str, source: NewsSource, base_url: str) -> list[RawItem]:
    cleaned = re.sub(r'xmlns(?::[a-zA-Z0-9_-]+)?="[^"]*"', "", xml_text)
    cleaned = re.sub(r"<([a-zA-Z0-9_-]+):", "<", cleaned)
    cleaned = re.sub(r"</([a-zA-Z0-9_-]+):", "</", cleaned)
    root = ET.fromstring(cleaned)
    items: list[RawItem] = []

    entries = root.findall(".//item") or root.findall(".//entry")
    for node in entries[:14]:
        title = clean_text(node.findtext("title"))
        link = clean_text(node.findtext("link"))
        if not link:
            link_el = node.find("link")
            if link_el is not None:
                link = link_el.attrib.get("href", "")
        desc = clean_text(node.findtext("description") or node.findtext("summary") or node.findtext("encoded"))
        pub = clean_text(node.findtext("pubDate") or node.findtext("published") or node.findtext("updated"))

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

        if title and link and len(title) > 12 and title.lower() not in BOILERPLATE_TITLES:
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
                url=urllib.parse.urljoin(base_url, link),
                image_url=normalize_image_url(img, base_url),
                published_at=pub or datetime.now(timezone.utc).isoformat(),
                category="regional" if source.region == "regional" else infer_category(title, link),
            ))
    return items


def parse_html_headlines(html_text: str, source: NewsSource, base_url: str) -> list[RawItem]:
    items: list[RawItem] = []
    seen_urls: set[str] = set()
    pattern = re.compile(
        r'<h[1-3][^>]*>\s*(?:<span[^>]*>.*?</span>\s*)?<a[^>]+href=["\']([^"\']+)["\'][^>]*>(.*?)</a>',
        re.S | re.I,
    )
    for m in pattern.finditer(html_text):
        href, raw_title = m.group(1), m.group(2)
        title = clean_text(raw_title)
        full_url = urllib.parse.urljoin(base_url, href)
        if not title or len(title) < 20 or title.lower() in BOILERPLATE_TITLES or full_url in seen_urls:
            continue
        if any(bad in href.lower() for bad in ["javascript:", "#", "/tag/", "/author/", "/video", "facebook.com", "youtube.com"]):
            continue
        seen_urls.add(full_url)
        items.append(RawItem(
            source_id=source.id,
            source_name_en=source.name_en,
            source_name_bn=source.name_bn,
            source_domain=source.domain,
            source_tier=source.tier,
            lang=source.lang,
            region=source.region,
            title=title,
            summary=title,
            body_paragraphs=[],
            url=full_url,
            image_url=None,
            published_at=datetime.now(timezone.utc).isoformat(),
            category="regional" if source.region == "regional" else infer_category(title, full_url),
        ))
        if len(items) >= 12:
            break
    return items


def enrich_full_article(item: RawItem) -> None:
    try:
        _, _, art_html = fetch_url(item.url)
        img, desc, paragraphs = extract_article_details(art_html, item.url)
        if not item.image_url and img:
            item.image_url = img
        if desc and len(desc) > len(item.summary):
            item.summary = desc
        if paragraphs:
            item.body_paragraphs = paragraphs
            if len(item.summary) <= len(item.title) + 5:
                item.summary = paragraphs[0][:320]
    except Exception:
        pass


def scrape_source(source: NewsSource) -> list[RawItem]:
    for endpoint in source.endpoints:
        try:
            _, ctype, body = fetch_url(endpoint)
            lower_head = body[:2500].lower()
            if "just a moment" in lower_head or "cf-browser-verification" in lower_head:
                continue
            is_xml = (
                "xml" in ctype.lower()
                or body.lstrip().startswith("<?xml")
                or "<rss" in lower_head
                or "<feed" in lower_head
            )
            items = (
                parse_rss_or_sitemap(body, source, endpoint)
                if is_xml
                else parse_html_headlines(body, source, endpoint)
            )
            if items:
                with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
                    list(pool.map(enrich_full_article, items[:10]))
                return items
        except Exception:
            continue
    return []


def tokenize_title(text: str) -> set[str]:
    stop = {
        "the", "and", "for", "with", "from", "that", "this", "into", "over", "after", "amid",
        "says", "will", "new", "bangladesh", "dhaka", "news", "today", "report",
        "এবং", "থেকে", "নিয়ে", "করে", "হয়েছে", "করা", "বলেছেন", "ঢাকা", "বাংলাদেশ", "আজ",
    }
    words = re.findall(r"[\w\u0980-\u09FF]{3,}", text.lower())
    return {w for w in words if w not in stop}


def cluster_and_enrich(raw_items: list[RawItem]) -> list[dict[str, Any]]:
    clusters: list[list[RawItem]] = []
    cluster_tokens: list[set[str]] = []

    for item in raw_items:
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

    def cluster_rank(group: list[RawItem]) -> tuple[int, int, int, int]:
        has_body = 1 if any(len(g.body_paragraphs) >= 2 for g in group) else 0
        has_img = 1 if any(g.image_url for g in group) else 0
        best_tier = min(g.source_tier for g in group)
        return (len(group), has_body, has_img, -best_tier)

    clusters.sort(key=cluster_rank, reverse=True)

    # Interleave outlets so homepage looks like a balanced national daily
    diverse: list[list[RawItem]] = []
    remaining = list(clusters)
    last_domain = ""
    while remaining and len(diverse) < 52:
        pick_idx = 0
        for idx, grp in enumerate(remaining):
            if len(grp) > 1 or grp[0].source_domain != last_domain:
                pick_idx = idx
                break
        chosen = remaining.pop(pick_idx)
        last_domain = chosen[0].source_domain
        diverse.append(chosen)

    articles: list[dict[str, Any]] = []
    for idx, group in enumerate(diverse):
        lead = max(
            group,
            key=lambda g: (len(g.body_paragraphs), 1 if g.image_url else 0, -g.source_tier, len(g.summary)),
        )
        distinct_sources = len({g.source_domain for g in group})
        slug_hash = hashlib.sha1(lead.url.encode("utf-8")).hexdigest()[:8]
        slug_base = re.sub(r"[^a-z0-9]+", "-", lead.title.lower()).strip("-")[:48]
        slug = f"{slug_base}-{slug_hash}" if slug_base else f"story-{slug_hash}"

        # Combine rich paragraphs across lead & corroborating reports cleanly
        merged_paras: list[str] = []
        seen_para_prefixes: set[str] = set()
        for g in [lead, *[x for x in group if x is not lead]]:
            for p in g.body_paragraphs:
                prefix = p[:48]
                if prefix not in seen_para_prefixes:
                    seen_para_prefixes.add(prefix)
                    merged_paras.append(p)
                if len(merged_paras) >= 7:
                    break
            if len(merged_paras) >= 7:
                break

        if not merged_paras and lead.summary:
            merged_paras = [lead.summary]

        full_body = "\n\n".join(merged_paras)
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
            "summary_bn": lead.summary,
            "summary_en": lead.summary,
            "body_bn": full_body,
            "body_en": full_body,
            "verification_status": "verified" if distinct_sources >= 3 else ("corroborated" if distinct_sources == 2 else "single_source"),
            "confidence_score": 95 if distinct_sources >= 3 else (85 if distinct_sources == 2 else 75),
            "source_count": distinct_sources,
            "primary_source": lead.source_name_en,
            "primary_source_bn": lead.source_name_bn,
            "source_url": lead.url,
            "image_url": image_url,
            "image_alt": lead.title,
            "published_at": lead.published_at,
            "sources": sources_payload,
        })

    return articles


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", default="scraped_seed.json")
    parser.add_argument("--push-url", default="")
    parser.add_argument("--pat", default="")
    args = parser.parse_args()

    all_items: list[RawItem] = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as pool:
        futures = [pool.submit(scrape_source, src) for src in SOURCES]
        for fut in concurrent.futures.as_completed(futures):
            all_items.extend(fut.result())

    articles = cluster_and_enrich(all_items)
    Path(args.output).parent.mkdir(parents=True, exist_ok=True)
    Path(args.output).write_text(json.dumps(articles, ensure_ascii=False, indent=2), encoding="utf-8")
    multi_para = sum(1 for a in articles if len((a.get("body_bn") or "").split("\n\n")) >= 3)
    with_img = sum(1 for a in articles if a.get("image_url"))
    print(f"Collected {len(all_items)} raw reports -> {len(articles)} news articles ({with_img} with photos, {multi_para} with >=3 full paragraphs).")

    if args.push_url and args.pat:
        req = urllib.request.Request(
            args.push_url,
            data=json.dumps({"articles": articles}).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {args.pat}",
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=20) as resp:
            print("PAT Push Response:", resp.status, resp.read().decode("utf-8"))


if __name__ == "__main__":
    main()
