# Detective Methodology Guide

The Detective Methodology is a systematic, evidence-based approach to bug resolution.

## Core Philosophy

1. **Evidence First** - Always reproduce and gather evidence before theorizing
2. **Root Cause Focus** - Don't just patch symptoms, find the real problem
3. **Document Everything** - Investigation notes prevent repeating work
4. **Verify Thoroughly** - Confirm fix works AND nothing else broke
5. **Learn from Bugs** - Track patterns to prevent similar issues

## Workflow Phases

```
Bug Queue → Reproduce → Investigate → Diagnose → Fix → Verify → Regression Test → Close
```

### Phase 1: Reproduce

**Goal**: Confirm the bug exists and can be reliably triggered.

**Entry**: Bug report processed
**Exit**: Bug reproduced OR marked needs-info

**Actions**:
- Follow reproduction steps exactly
- Match environment as closely as possible
- Capture evidence (screenshots, logs)
- Document any variations
- If cannot reproduce, request more information

**Tools**: `uv run python scripts/reproduce_bug.py`

**Key Principle**: Never skip reproduction. If you can't reproduce it, you can't verify the fix.

### Phase 2: Investigate

**Goal**: Gather evidence and form hypotheses about the cause.

**Entry**: Bug reproduced
**Exit**: Hypotheses documented

**Actions**:
- Analyze error logs and stack traces
- Review recent code changes
- Check related systems
- Form hypotheses about root cause
- Document findings

**Tools**: `uv run python scripts/parse_stack_trace.py`, `uv run python scripts/state_manager.py --note`, `uv run python scripts/state_manager.py --hypothesis`

**Key Principle**: Use evidence (logs, debugger), not just guesses.

### Phase 3: Diagnose

**Goal**: Identify the definitive root cause.

**Entry**: Investigation complete with hypotheses
**Exit**: Root cause identified and documented

**Actions**:
- Test each hypothesis systematically
- Identify exact code/commit causing issue
- Document root cause clearly
- Plan fix approach

**Tools**: `uv run python scripts/state_manager.py --root-cause`

**Key Principle**: Surface-level fixes create recurring bugs. Find the real cause.

### Phase 4: Fix

**Goal**: Implement a minimal, targeted fix.

**Entry**: Root cause documented
**Exit**: Fix implemented (code committed)

**Actions**:
- Implement minimal fix for root cause
- Avoid over-engineering
- Write or update tests
- Create commit/PR
- Document what was changed

**Tools**: Standard development tools

**Key Principle**: Fix the root cause, not symptoms.

### Phase 5: Verify

**Goal**: Confirm the fix resolves the original issue.

**Entry**: Fix implemented
**Exit**: Bug no longer occurs

**Actions**:
- Re-run reproduction steps
- Confirm bug no longer occurs
- Run related test cases
- Document verification results

**Tools**: `uv run python scripts/verify_fix.py`

**Key Principle**: Don't assume the fix works. Prove it.

### Phase 6: Regression Test

**Goal**: Ensure the fix doesn't break other functionality.

**Entry**: Fix verified
**Exit**: All related tests pass

**Actions**:
- Identify related test suites
- Run full regression suite
- Compare results to baseline
- Investigate any new failures

**Tools**: `uv run python scripts/regression_tester.py`

**Key Principle**: Every fix must be tested against existing functionality.

### Phase 7: Close

**Goal**: Document resolution and capture learnings.

**Entry**: Regression tests pass
**Exit**: Bug marked closed

**Actions**:
- Document resolution
- Record lessons learned
- Update related documentation
- Consider preventive measures

**Tools**: `uv run python scripts/state_manager.py`

## Cannot Reproduce Scenarios

When a bug cannot be reproduced:

1. **Request More Information**
   - Exact steps taken
   - Environment details
   - Screenshots or recordings
   - Console logs

2. **Check Environment Differences**
   - OS version
   - Browser version
   - Network conditions
   - User permissions

3. **Look for Intermittent Patterns**
   - Time-based issues
   - Race conditions
   - Load-dependent bugs

4. **Document Attempts**
   - What was tried
   - Environment used
   - Results observed

## Blocker Handling

When blocked during investigation:

1. **Document the blocker** - What is preventing progress?
2. **Identify owner** - Who can resolve the blocker?
3. **Set reminder** - When to check back
4. **Work on other bugs** - Don't let queue stall

## Severity-Based Prioritization

Process bugs in severity order:

1. **Critical** - Immediate attention required
   - System crashes
   - Data loss
   - Security vulnerabilities

2. **High** - Next available slot
   - Major features broken
   - Significant user impact

3. **Medium** - Within current sprint
   - Features degraded
   - Workarounds exist

4. **Low** - Backlog
   - Minor issues
   - Cosmetic problems

5. **Trivial** - When convenient
   - Typos
   - Polish items

## Best Practices

### DO
- Always reproduce before investigating
- Document everything as you go
- Test hypotheses systematically
- Verify fixes completely
- Run regression tests

### DON'T
- Skip phases
- Guess at root causes
- Assume fixes work
- Ignore regression failures
- Close bugs prematurely
