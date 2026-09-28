"""Public-safe parsers for disposable P6 measurement evidence (stdlib only)."""
import hashlib
import json
import math
import re

MODES = ("PAGE", "MAP", "PLACES", "EXACT_PUBLIC")
NUMERIC_KEYS = {
    "Startup Cost", "Total Cost", "Plan Rows", "Plan Width", "Actual Rows", "Actual Loops",
    "Rows Removed by Filter", "Rows Removed by Index Recheck", "Shared Hit Blocks", "Shared Read Blocks",
    "Shared Dirtied Blocks", "Shared Written Blocks", "Local Hit Blocks", "Local Read Blocks",
    "Local Dirtied Blocks", "Local Written Blocks", "Temp Read Blocks", "Temp Written Blocks",
    "I/O Read Time", "I/O Write Time", "Sort Space Used", "Hash Batches", "Peak Memory Usage",
    "Heap Fetches", "Workers Planned", "Workers Launched"
}
TEXT_KEYS = {"Node Type", "Parent Relationship", "Subplan Name", "Relation Name", "Schema", "Alias",
             "Index Name", "Join Type", "CTE Name", "Strategy", "Scan Direction", "Sort Method", "Sort Space Type"}


def project_plan(node):
    """Keep structure and measurements; never query text, filter literals or output expressions."""
    result = {}
    for key, value in node.items():
        if key in NUMERIC_KEYS:
            if not isinstance(value, (int, float)) or isinstance(value, bool) or not math.isfinite(value):
                raise ValueError("P6_PLAN_NONFINITE")
            result[key] = value
        elif key in TEXT_KEYS and isinstance(value, str):
            if len(value) > 200 or not re.fullmatch(r'[A-Za-z_0-9 .:/$*(),\[\]-]+', value):
                raise ValueError("P6_PLAN_NONSTATIC_LABEL")
            result[key] = value
        elif key == "Plans":
            result[key] = [project_plan(child) for child in value]
    return result


def walk(node):
    yield node
    for child in node.get("Plans", []):
        yield from walk(child)


def internal_plans(stderr):
    decoder = json.JSONDecoder()
    result = {}
    starts = list(re.finditer(r'P6_TRACE_BEGIN_(PAGE|MAP|PLACES)\b', stderr))
    for i, start in enumerate(starts):
        end = starts[i+1].start() if i+1 < len(starts) else len(stderr)
        section = stderr[start.end():end]
        matches = []
        for marker in re.finditer(r'plan:\s*(?=\{)', section):
            obj, _ = decoder.raw_decode(section[marker.end():])
            query = obj.get("Query Text", "")
            if not re.match(r'\s*with base as materialized\s*\(', query, re.I):
                continue
            projected = project_plan(obj["Plan"])
            nodes = list(walk(projected))
            if not any(n.get("Relation Name") == "needs" for n in nodes):
                raise ValueError("P6_INTERNAL_NEEDS_PLAN_MISSING")
            if not any("Actual Loops" in n and "Shared Hit Blocks" in n for n in nodes):
                raise ValueError("P6_ANALYZE_BUFFERS_MISSING")
            matches.append({"queryTextSha256": hashlib.sha256(query.encode()).hexdigest(),
                            "plan": projected, "nodeCount": len(nodes)})
        if len(matches) != 1 or start[1] in result:
            raise ValueError("P6_INTERNAL_PLAN_NOT_EXACTLY_ONE")
        result[start[1]] = matches[0]
    if set(result) != {"PAGE", "MAP", "PLACES"}:
        raise ValueError("P6_INTERNAL_MODES_MISSING")
    return result


def summarize(samples, budget_ms=1000):
    out = []
    for mode in MODES:
        rows = sorted((x for x in samples if x.get("mode") == mode), key=lambda x: x["sample"])
        if [x["sample"] for x in rows] != list(range(1, 31)):
            raise ValueError("P6_THIRTY_DISTINCT_SAMPLES_REQUIRED")
        times = sorted(x["ms"] for x in rows)
        if any(not isinstance(x, (int, float)) or isinstance(x, bool) or not math.isfinite(x) or x < 0 for x in times):
            raise ValueError("P6_SAMPLE_NONFINITE")
        out.append({"mode": mode, "n": 30, "p50Ms": times[math.ceil(.50*30)-1],
                    "p95Ms": times[math.ceil(.95*30)-1], "maxMs": times[-1],
                    "maxResponseBytes": max(x["responseBytes"] for x in rows),
                    "maxResultSize": max(x["resultSize"] for x in rows),
                    "screeningBudgetMs": budget_ms, "screeningBudgetPass": times[math.ceil(.95*30)-1] <= budget_ms})
    if len(samples) != 120:
        raise ValueError("P6_SAMPLE_SET_INVALID")
    return out
