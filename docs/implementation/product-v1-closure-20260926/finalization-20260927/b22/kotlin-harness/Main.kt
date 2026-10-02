package com.swmansion.reanimated

import android.os.SystemClock
import android.util.Log
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.fabric.FabricUIManager

// Behaviour scenarios of the RNR-01 guard in NativeProxy.synchronouslyUpdateUIProps (B22). Time is SystemClock.now (virtual).

fun fresh(): Triple<NativeProxy, FabricUIManager, FakeMountingManager> {
    Log.lines.clear(); Log.traces.clear(); SystemClock.now = 1000L; UiThreadUtil.onUiThread = true
    val fabric = FabricUIManager(); val fake = FakeMountingManager()
    return Triple(NativeProxy(fabric, fake), fabric, fake)
}
fun pass(p: NativeProxy, vararg tags: Int) = p.synchronouslyUpdateUIProps(tags, DoubleArray(0))
fun passAll(p: NativeProxy, tags: IntArray) = p.synchronouslyUpdateUIProps(tags, DoubleArray(0))
fun summaries() = Log.lines.filter { it.contains("summary:") }
fun counter(line: String, name: String): Int = Regex("\\b$name=(\\d+)").find(line)!!.groupValues[1].toInt()

/** Runs draw-pass events every 16 ms (about 60 per second) over [ms] of virtual time. */
fun run60(p: NativeProxy, tags: IntArray, ms: Long): Int {
    var passes = 0
    val end = SystemClock.now + ms
    while (SystemClock.now < end) { passAll(p, tags); SystemClock.now += 16; passes++ }
    return passes
}

fun main() {
    run { // 1. mounted tag: applied, silent, nothing remembered
        val (p, f, m) = fresh(); f.state[1] = "view"
        repeat(50) { pass(p, 1) }
        check(m.invoked.size == 50) { "mounted tag applied every pass: ${m.invoked.size}" }
        check(Log.lines.isEmpty()) { "silent on success: ${Log.lines}" }
        SystemClock.now += 60_000; pass(p, 1)
        check(Log.lines.isEmpty()) { "no summary without events: ${Log.lines}" }
    }
    run { // 2. unmounted tag: never invoked, one named line, one summary per window
        val (p, f, m) = fresh()
        repeat(1000) { pass(p, 2) }
        check(m.invoked.isEmpty()) { "unmounted tag must never reach the reflective call" }
        check(Log.traces.isEmpty()) { "no exception is built for an unmounted tag" }
        check(Log.lines.size == 1 && Log.lines[0].contains("skipped unmounted tag 2") && Log.lines[0].contains("USKOCI_RNR01")) { "one named line: ${Log.lines}" }
        SystemClock.now += 5001; pass(p, 2)
        check(Log.lines.size == 2 && Log.lines[1].contains("summary: skipped=1001 viewless=0 backedOff=0 failed=0 untracked=0 evicted=0 tracked=0 windowMs=")) { "summary: ${Log.lines}" }
        pass(p, 2) // next window: named again, once
        check(Log.lines.size == 3 && Log.lines[2].contains("skipped unmounted tag 2")) { "named again in the next window: ${Log.lines}" }
        check(f.resolveCalls == 1002) { "one cheap lookup per pass: ${f.resolveCalls}" }
    }
    run { // 3. a tag that mounts later is applied on the very first pass after it appears (no back-off, no lateness)
        val (p, f, m) = fresh()
        repeat(10) { pass(p, 3) }
        f.state[3] = "view"; pass(p, 3)
        check(m.invoked == listOf(3)) { "first pass after mount applies: ${m.invoked}" }
    }
    run { // 4. a ViewState without an Android view (resolveView throws IllegalViewOperationException): skipped and counted, no failure
        val (p, f, m) = fresh(); f.state[4] = "viewless"
        repeat(3) { pass(p, 4) }
        check(m.invoked.isEmpty()) { "a viewless tag does not reach the upstream call: ${m.invoked}" }
        check(Log.lines.isEmpty() && Log.traces.isEmpty()) { "no log, no stack for a viewless tag: ${Log.lines}" }
        f.state[4] = "view"; pass(p, 4)
        check(m.invoked == listOf(4)) { "applied on the first pass after the view exists: ${m.invoked}" }
        SystemClock.now += 5001; f.state[4] = "viewless"; pass(p, 4)
        check(summaries().size == 1 && counter(summaries()[0], "viewless") == 4 && counter(summaries()[0], "skipped") == 0) { "summary counts it apart from unmounted: ${Log.lines}" }
    }
    run { // 4b. any other error of the check itself: attempt the upstream call (fallback kept)
        val (p, f, m) = fresh(); f.state[41] = "broken"
        pass(p, 41)
        check(m.invoked == listOf(41)) { "falls through to the upstream call: ${m.invoked}" }
        check(Log.lines.isEmpty()) { "no log: ${Log.lines}" }
    }
    run { // 5. a live tag whose update throws: one logged cause, back-off 250/500/1000/2000, success cleans
        val (p, f, m) = fresh(); f.state[5] = "view"; m.failing.add(5)
        pass(p, 5)
        check(m.invoked.size == 1 && Log.traces.size == 1 && Log.traces[0] is IllegalStateException) { "first failure logged once with the cause, not the wrapper: ${Log.traces}" }
        check(Log.lines[0].startsWith("Reanimated: synchronouslyUpdateUIProps failed for tag 5") && Log.lines[0].contains("USKOCI_RNR01")) { Log.lines[0] }
        pass(p, 5); pass(p, 5)
        check(m.invoked.size == 1) { "backed off: ${m.invoked.size}" }
        SystemClock.now += 249; pass(p, 5); check(m.invoked.size == 1) { "still backed off at 249 ms" }
        SystemClock.now += 1; pass(p, 5); check(m.invoked.size == 2 && Log.traces.size == 1) { "retried at 250 ms, no second stack: ${m.invoked.size}/${Log.traces.size}" }
        SystemClock.now += 499; pass(p, 5); check(m.invoked.size == 2) { "second wait is 500 ms" }
        SystemClock.now += 1; pass(p, 5); check(m.invoked.size == 3) { "retried at 500 ms" }
        SystemClock.now += 1000; pass(p, 5); check(m.invoked.size == 4) { "third wait 1000 ms" }
        SystemClock.now += 1999; pass(p, 5); check(m.invoked.size == 4) { "wait capped at 2000 ms" }
        SystemClock.now += 1; pass(p, 5); check(m.invoked.size == 5)
        SystemClock.now += 2000; pass(p, 5); check(m.invoked.size == 6) { "stays capped" }
        m.failing.clear(); SystemClock.now += 2000; pass(p, 5); check(m.invoked.size == 7) { "recovers" }
        pass(p, 5); check(m.invoked.size == 8) { "success removed the back-off" }
        m.failing.add(5); pass(p, 5)
        check(Log.traces.size == 2) { "a new failure after recovery is logged once more: ${Log.traces.size}" }
    }
    run { // 6. leaving the mounted state clears the back-off, so a re-mounted tag is not delayed
        val (p, f, m) = fresh(); f.state[6] = "view"; m.failing.add(6)
        pass(p, 6); check(m.invoked.size == 1)
        f.state.remove(6); pass(p, 6); check(m.invoked.size == 1)
        f.state[6] = "view"; m.failing.clear(); pass(p, 6)
        check(m.invoked.size == 2) { "re-mounted tag applies at once: ${m.invoked.size}" }
    }
    run { // 7. bounded names: many distinct unmounted tags
        val (p, f, _) = fresh()
        for (t in 1000 until 1200) pass(p, t)
        check(Log.lines.size == 64) { "at most 64 named tags per window: ${Log.lines.size}" }
        SystemClock.now += 5001; pass(p, 1000)
        check(Log.lines.last().contains("skipped=201")) { Log.lines.last() }
    }
    run { // 8. a batch with mixed tags is handled tag by tag
        val (p, f, m) = fresh(); f.state[1] = "view"; f.state[3] = "view"; m.failing.add(3)
        pass(p, 1, 2, 3, 2, 1)
        check(m.invoked == listOf(1, 3, 1)) { "mixed batch: ${m.invoked}" }
    }
    run { // 9. off the UI thread the guard is bypassed and its state is not touched (upstream behaviour)
        val (p, f, m) = fresh(); f.state[9] = "view"; m.failing.add(9)
        UiThreadUtil.onUiThread = false
        pass(p, 9, 10, 9)
        check(m.invoked == listOf(9, 10, 9)) { "every tag attempted, unmounted ones too, like upstream: ${m.invoked}" }
        check(Log.traces.size == 2 && Log.lines.all { it.contains("not on the UI thread") && !it.contains("summary") }) { "old-style failure lines only: ${Log.lines}" }
        SystemClock.now += 60_000; pass(p, 9)
        check(summaries().isEmpty()) { "no guard state, no summary: ${Log.lines}" }
        UiThreadUtil.onUiThread = true; Log.lines.clear(); Log.traces.clear(); m.invoked.clear()
        pass(p, 9)
        check(m.invoked == listOf(9) && Log.traces.size == 1) { "back on the UI thread nothing was remembered, first failure logged: ${m.invoked}/${Log.traces.size}" }
    }
    for (n in listOf(100, 500, 1000)) run { // 10. more failing mounted tags than the OLD cap of 64 (and up to the new cap): nothing is wiped, no tag is retried every pass
        val (p, f, m) = fresh()
        val tags = IntArray(n) { 2000 + it }
        for (t in tags) { f.state[t] = "view"; m.failing.add(t) }
        val start = SystemClock.now
        val passes = run60(p, tags, 10_000)
        val perTag = HashMap<Int, Int>(); for (t in m.invoked) perTag[t] = (perTag[t] ?: 0) + 1
        check(perTag.size == n) { "every tag attempted: ${perTag.size}" }
        // one attempt at 0, 250, 750, 1750, 3750, 5750, 7750, 9750 ms: 8 in 10 s, for every tag, whatever the pass rate
        check(perTag.values.all { it in 7..9 }) { "each tag follows the back-off schedule: min ${perTag.values.min()} max ${perTag.values.max()} of $passes passes" }
        check(Log.traces.size == n) { "one stack per tag, not one per attempt: ${Log.traces.size}" }
        check(summaries().isNotEmpty() && summaries().all { counter(it, "tracked") == n && counter(it, "untracked") == 0 && counter(it, "evicted") == 0 }) { "all tracked, none evicted: ${summaries().firstOrNull()}" }
        println("scenario 10 n=$n: $passes passes, ${m.invoked.size} attempts, ${Log.traces.size} stacks (the old clear-at-64 rule would make $n x $passes = ${n * passes} attempts and as many stacks); started at $start")
    }
    run { // 11. beyond the cap (1,024 live failures): the tracked ones stay backed off, the overflow is retried quietly, nothing is wiped
        val (p, f, m) = fresh()
        val n = 1100
        val tags = IntArray(n) { 5000 + it }
        for (t in tags) { f.state[t] = "view"; m.failing.add(t) }
        val passes = run60(p, tags, 10_000)
        val perTag = HashMap<Int, Int>(); for (t in m.invoked) perTag[t] = (perTag[t] ?: 0) + 1
        val tracked = tags.take(1024); val overflow = tags.drop(1024)
        check(tracked.all { (perTag[it] ?: 0) in 7..9 }) { "the 1,024 tracked tags keep their back-off (no wipe)" }
        check(overflow.all { (perTag[it] ?: 0) == passes }) { "the ${overflow.size} untracked tags are retried on every pass, like upstream" }
        check(Log.traces.size == 1024) { "stacks only for tracked tags: ${Log.traces.size}" }
        val s = summaries().first()
        check(summaries().all { counter(it, "tracked") == 1024 && counter(it, "evicted") == 0 } && counter(s, "untracked") > 0) { "visible in the summary: $s" }
        println("scenario 11: $passes passes, tracked 1024 (8 attempts each), overflow ${overflow.size} tags x $passes attempts, ${Log.traces.size} stacks; $s")
    }
    run { // 12. stale entries (their tags are gone) are evicted when the table is full; live ones are not
        val (p, f, m) = fresh()
        val old = IntArray(1024) { 9000 + it }
        for (t in old) { f.state[t] = "view"; m.failing.add(t) }
        passAll(p, old) // all 1,024 fail once at t=1000, retry due at 1250
        check(Log.traces.size == 1024)
        SystemClock.now += 10_000 // the tags never appear again (JS dropped them); the entries are 8.75 s past due
        f.state[20000] = "view"; m.failing.add(20000)
        pass(p, 20000)
        check(Log.traces.size == 1025) { "the newcomer is admitted and logged: ${Log.traces.size}" }
        val s = summaries().first()
        check(counter(s, "evicted") == 1024 && counter(s, "tracked") == 1 && counter(s, "untracked") == 0) { "all stale entries evicted, nothing else: $s" }
    }
    run { // 13. live entries are never evicted to make room (the overflow tag stays untracked, quiet), however long it runs
        val (p, f, m) = fresh()
        val live = IntArray(1024) { 7000 + it }
        for (t in live) { f.state[t] = "view"; m.failing.add(t) }
        f.state[30000] = "view"; m.failing.add(30000)
        val tags = live + 30000                   // the 1,025th failing tag fails last in every pass
        run60(p, tags, 12_000)
        check(Log.traces.size == 1024) { "the 1,025th failing tag is neither tracked nor logged with a stack: ${Log.traces.size}" }
        check(summaries().isNotEmpty() && summaries().all { counter(it, "evicted") == 0 && counter(it, "tracked") == 1024 }) { "no live entry evicted: ${summaries()}" }
        check(counter(summaries().first(), "untracked") > 0) { "the overflow is counted: ${summaries().first()}" }
    }
    run { // 14. a sweep runs at most once per 4 s
        val (p, f, m) = fresh()
        val old = IntArray(1024) { 3000 + it }
        for (t in old) { f.state[t] = "view"; m.failing.add(t) }
        passAll(p, old)                        // fail at t=1000, retry due 1250, stale from 5250
        f.state[31000] = "view"; m.failing.add(31000)
        SystemClock.now = 2000; pass(p, 31000)  // sweep at 2000 (nothing stale), next sweep not before 6000
        SystemClock.now = 5500; pass(p, 31000)  // entries are stale now, but the sweep is rate limited
        check(Log.traces.size == 1024) { "no sweep inside the window: ${Log.traces.size}" }
        SystemClock.now = 6000; pass(p, 31000)  // sweep runs, evicts the stale ones, admits the tag
        check(Log.traces.size == 1025) { "sweep after the window admits the tag: ${Log.traces.size}" }
    }
    println("ALL OK")
}
