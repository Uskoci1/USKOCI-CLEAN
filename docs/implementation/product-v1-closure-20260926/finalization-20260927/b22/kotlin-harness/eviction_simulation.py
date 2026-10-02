#!/usr/bin/env python3
"""B22 / RNR-01: why the failed-tag table does not evict live back-offs. Plain python 3, no dependencies; about 1 minute.

Model: N mounted tags whose update fails on every attempt, scanned in the same order on every draw-pass event, 60 events per second for
8 s, back-off 250 ms doubling to 2,000 ms, and a table of C entries. When a new failing tag finds the table full the policy decides:
clear (the author's first version: wipe everything), fifo (evict the oldest entry), mru (evict the newest), random, soonest (evict the entry
whose retry is due first), noadmit (evict nothing; the newcomer is retried quietly on every pass; this is what the patch does, plus an
eviction of entries that are stale). Output per policy: attempts (reflective calls that threw), stack logs, the largest share of passes in
which a single tag was attempted, and how many tags were attempted on (almost) every pass.

Result of the run recorded in B22_REANIMATED_PATCH_20261002.md section 2 (N=100/C=64 and N=300/C=256 are the interesting rows)."""
import random, collections, sys
BASE, MAXB = 250, 2000

def run(policy, N, C, seconds=8, hz=60, seed=1):
    random.seed(seed)
    fail = collections.OrderedDict()  # tag -> [count, retryAt]
    attempts = collections.Counter(); stacks = 0; total = 0
    passes = int(seconds*hz); passes_per_tag = collections.Counter()
    tags = list(range(1000, 1000+N))
    for p in range(passes):
        now = p*1000//hz
        for t in tags:
            f = fail.get(t)
            if f is not None and now < f[1]:
                continue
            # attempt -> fails
            attempts[t] += 1; total += 1
            f = fail.get(t)
            admitted_by_evict = False
            if f is None:
                if len(fail) >= C:
                    if policy == 'clear': fail.clear()
                    elif policy == 'fifo': fail.popitem(last=False); admitted_by_evict = True
                    elif policy == 'mru': fail.popitem(last=True); admitted_by_evict = True
                    elif policy == 'random': k = random.choice(list(fail.keys())); del fail[k]; admitted_by_evict = True
                    elif policy == 'noadmit': 
                        continue
                    elif policy == 'soonest':
                        k = min(fail, key=lambda x: fail[x][1]); del fail[k]; admitted_by_evict = True
                    elif policy == 'latest':
                        k = max(fail, key=lambda x: fail[x][1]); del fail[k]; admitted_by_evict = True
                f = [0, 0]; fail[t] = f
            f[0] += 1
            f[1] = now + min(BASE << min(f[0]-1, 10), MAXB)
            if f[0] == 1 and not (admitted_by_evict and policy not in ('clear',)):
                stacks += 1
    maxfrac = max(attempts[t] for t in tags)/passes if attempts else 0
    everypass = sum(1 for t in tags if attempts[t] >= passes*0.95)
    return total, stacks, round(maxfrac,3), everypass

for N, C in [(50,64),(100,64),(300,256),(600,256)]:
    print('N',N,'C',C, 'ideal-attempts', N*30*1000/ (MAXB) )
    for pol in ['clear','fifo','mru','random','noadmit','soonest']:
        total, stacks, maxfrac, every = run(pol, N, C)
        print(f'  {pol:8s} attempts={total:8d} stackLogs={stacks:7d} maxPerTagPassFrac={maxfrac} tagsRetriedEveryPass={every}')
