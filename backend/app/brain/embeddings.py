"""Dependency-free text embeddings (hashing trick over unigrams + bigrams).

Good enough for retrieval over a few dozen short chunks and needs no API key, so the shared
brain works offline. The chunk table stores vectors as JSON; to move to pgvector, change the
column type and replace `search()` with an ORDER BY embedding <=> :q query. `embed()` is the
only function that has to be swapped for a hosted embedding model.
"""
import hashlib
import math
import re

DIM = 384
_TOKEN = re.compile(r"[a-z0-9\+\#\.]+")
_STOP = {
    "the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "with", "is", "are", "was", "were",
    "be", "by", "at", "as", "it", "this", "that", "do", "does", "did", "you", "your", "what", "which",
    "who", "how", "me", "my", "i", "can", "about", "tell", "has", "have", "his", "he", "from",
    "justin", "sales", "built", "build", "made", "worked", "did",
}


def tokenize(text: str) -> list[str]:
    toks = [t.strip(".") for t in _TOKEN.findall(text.lower())]
    return [t for t in toks if t and t not in _STOP]


def _bucket(feature: str) -> tuple[int, float]:
    h = hashlib.blake2b(feature.encode(), digest_size=4).digest()
    n = int.from_bytes(h, "big")
    return n % DIM, 1.0 if (n >> 31) & 1 else -1.0


def embed(text: str) -> list[float]:
    toks = tokenize(text)
    vec = [0.0] * DIM
    feats = toks + [f"{a}_{b}" for a, b in zip(toks, toks[1:])]
    for f in feats:
        i, sign = _bucket(f)
        vec[i] += sign * (1.5 if "_" in f else 1.0)
    norm = math.sqrt(sum(v * v for v in vec)) or 1.0
    return [round(v / norm, 5) for v in vec]


def cosine(a: list[float], b: list[float]) -> float:
    return sum(x * y for x, y in zip(a, b))
