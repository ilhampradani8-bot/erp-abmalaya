# Claude Code Project Instructions
# Save as: CLAUDE_INSTRUCTIONS.md in your project root

## Bug Report Processing Skill

**Skill Location:** `/path/to/bug-report-agent-skills/bug-report-processor`

### When to Use This Skill

Activate when:
- Processing bug reports from markdown files
- Analyzing error logs and stack traces
- Reproducing bugs systematically
- Tracking bug resolution workflow
- Performing root cause analysis
- Verifying bug fixes
- Running regression tests before closure

### First-Time Setup

Before using this skill in a new conversation:

1. **Read the skill documentation:**
   ```
   Read: /path/to/bug-report-agent-skills/bug-report-processor/SKILL.md
   Read: /path/to/bug-report-agent-skills/bug-report-processor/references/DETECTIVE_METHOD.md
   ```

2. **Ensure project setup:**
   - Create `.bug-states/` directory for state tracking
   - Add `.bug-states/` to `.gitignore`
   - Create `bugs/` directory for storing bug reports

### Available Commands

All commands use `uv run` for Python script execution.

#### 1. Process Bug Report
```bash
uv run /path/to/bug-report-agent-skills/bug-report-processor/scripts/process_bug.py <bug-file.md>
```
Parses bug report, extracts structured data, creates state file.

#### 2. Update Investigation
```bash
# Add investigation note
uv run /path/to/.../scripts/state_manager.py <bug-id> --note "finding or observation"

# Add hypothesis
uv run /path/to/.../scripts/state_manager.py <bug-id> --hypothesis "possible cause"

# Document root cause
uv run /path/to/.../scripts/state_manager.py <bug-id> --root-cause "confirmed cause"
```

#### 3. Reproduce Bug
```bash
uv run /path/to/.../scripts/reproduce_bug.py <bug-id>
```
Attempts automated reproduction using Selenium/Playwright.

#### 4. Verify Fix
```bash
uv run /path/to/.../scripts/verify_fix.py <bug-id>
```
Verifies that bug no longer occurs after fix.

#### 5. Run Regression Tests
```bash
uv run /path/to/.../scripts/regression_tester.py <bug-id>
```
Runs regression test suite before closure.

#### 6. Detective Workflow (Auto)
```bash
uv run /path/to/.../scripts/detective_engine.py --directory ./bugs --auto
```
Orchestrates entire workflow, processes bugs by severity.

#### 7. Analyze Severity
```bash
uv run /path/to/.../scripts/severity_analyzer.py <bug-file.md>
```
Analyzes and classifies bug severity automatically.

### Detective Methodology

**Core Workflow:**
```
Reproduce → Investigate → Diagnose → Fix → Verify → Regression Test → Close
```

**Important Rules:**
1. ✅ Phases cannot be skipped
2. ✅ Each phase has entry/exit requirements
3. ✅ Bugs processed by severity (critical first)
4. ✅ All state tracked in `.bug-states/<bug-id>.json`

**Phase Requirements:**

| Phase | Entry Requirement | Exit Requirement |
|-------|------------------|------------------|
| **Reproduce** | Bug report parsed | Bug reproduced OR marked needs-info |
| **Investigate** | Bug reproduced | Hypotheses documented |
| **Diagnose** | Investigation complete | Root cause identified |
| **Fix** | Root cause documented | Fix implemented |
| **Verify** | Fix implemented | Original bug no longer occurs |
| **Regression Test** | Fix verified | All related tests pass |
| **Closed** | Regression tests pass | Resolution documented |

### Supported Bug Formats

- GitHub Issues
- Linear
- Bugzilla
- Custom (via YAML config)

### Stack Trace Analysis

Automatically parses:
- Python (`Traceback`)
- JavaScript (`Error:`, `TypeError:`)
- Java (`Exception in thread`)
- C# (`Unhandled Exception:`)

### State Tracking

Each bug generates a JSON state file:
```
.bug-states/
├── BUG-123.json
├── BUG-456.json
└── backups/
```

**State file structure:**
```json
{
  "bug_id": "BUG-456",
  "title": "Login button not responding",
  "severity": "high",
  "status": "investigating",
  "reproduction": { "status": "reproduced", ... },
  "investigation": { "hypothesis": [...], "root_cause": null },
  "detective_state": { "current_phase": "investigating" }
}
```

### Example Workflows

#### Process a new bug report:
```
Human: "Process bugs/login-timeout.md"

Claude: 
1. Read bug report file
2. Execute: uv run /path/to/.../process_bug.py bugs/login-timeout.md
3. Report parsed data and created state file
4. Suggest next steps based on Detective phase
```

#### Investigate a bug:
```
Human: "Investigate BUG-123, hypothesis: database connection pool exhaustion"

Claude:
1. Read current state: .bug-states/BUG-123.json
2. Execute: uv run /path/to/.../state_manager.py BUG-123 --hypothesis "database connection pool exhaustion"
3. Report updated state
4. Suggest investigation steps
```

#### Auto-process all bugs:
```
Human: "Start detective workflow for all bugs in auto mode"

Claude:
1. Execute: uv run /path/to/.../detective_engine.py --directory ./bugs --auto
2. Monitor output
3. Report completion status for each bug
```

### Important Notes

- **State persistence:** Always check `.bug-states/<bug-id>.json` before acting
- **Phase validation:** Verify current phase before executing phase-specific actions
- **Severity priority:** Detective mode processes critical bugs first
- **Backup:** State files are backed up before major updates
- **Documentation:** All hypotheses and root causes must be documented

### Quick Reference

| Task | Command |
|------|---------|
| Parse bug | `process_bug.py <file>` |
| Add note | `state_manager.py <id> --note "text"` |
| Add hypothesis | `state_manager.py <id> --hypothesis "text"` |
| Set root cause | `state_manager.py <id> --root-cause "text"` |
| Reproduce | `reproduce_bug.py <id>` |
| Verify fix | `verify_fix.py <id>` |
| Regression test | `regression_tester.py <id>` |
| Detective auto | `detective_engine.py --directory ./bugs --auto` |

### Documentation References

- Full skill spec: `/path/to/.../SKILL.md`
- Detective methodology: `/path/to/.../references/DETECTIVE_METHOD.md`
- JSON schema: `/path/to/.../references/JSON_SCHEMA.md`
- Bug formats: `/path/to/.../references/BUG_STRUCTURE.md`
- Severity guide: `/path/to/.../references/SEVERITY_GUIDE.md`

---

**Remember:** Always follow the Detective Methodology. Systematic debugging beats ad-hoc fixes!
