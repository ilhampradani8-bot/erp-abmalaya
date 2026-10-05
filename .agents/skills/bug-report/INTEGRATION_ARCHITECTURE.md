# Integration Architecture

This document explains how the Bug Report Agent Skill integrates with different AI IDEs.

## 🏗️ Integration Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     User's Project                      │
│                                                         │
│  ┌──────────────────┐      ┌──────────────────┐       │
│  │   Bug Reports    │      │   Source Code    │       │
│  │   bugs/*.md      │      │   src/*.py       │       │
│  └──────────────────┘      └──────────────────┘       │
│                                                         │
│  ┌──────────────────────────────────────────────────┐ │
│  │          AI IDE (Cursor/VS Code/etc.)            │ │
│  │                                                  │ │
│  │  ┌────────────────────────────────────────────┐ │ │
│  │  │  IDE Configuration Files                   │ │ │
│  │  │  • .cursorrules                            │ │ │
│  │  │  • .vscode/settings.json                   │ │ │
│  │  │  • .windsurfrules                          │ │ │
│  │  │  • CLAUDE_INSTRUCTIONS.md                  │ │ │
│  │  └────────────────────────────────────────────┘ │ │
│  │                      ↓                           │ │
│  │  ┌────────────────────────────────────────────┐ │ │
│  │  │     AI Agent (reads skill config)          │ │ │
│  │  └────────────────────────────────────────────┘ │ │
│  └──────────────────────────────────────────────────┘ │
│                      ↓                                 │
│  ┌──────────────────────────────────────────────────┐ │
│  │         Executes via terminal/command            │ │
│  │         uv run /path/to/scripts/*.py             │ │
│  └──────────────────────────────────────────────────┘ │
│                      ↓                                 │
└─────────────────────┼───────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│            Bug Report Agent Skill                       │
│         /path/to/bug-report-processor/                  │
│                                                         │
│  ┌──────────────────┐      ┌──────────────────┐       │
│  │   Scripts        │      │  Configuration   │       │
│  │                  │      │                  │       │
│  │  • process_bug   │      │  • github.yaml   │       │
│  │  • detective     │      │  • linear.yaml   │       │
│  │  • state_mgr     │      │  • mappings.yaml │       │
│  │  • reproduce     │      │                  │       │
│  │  • verify        │      │                  │       │
│  └──────────────────┘      └──────────────────┘       │
│                                                         │
│  ┌──────────────────┐      ┌──────────────────┐       │
│  │  Documentation   │      │   Resources      │       │
│  │                  │      │                  │       │
│  │  • SKILL.md      │      │  • Templates     │       │
│  │  • DETECTIVE.md  │      │  • Examples      │       │
│  │  • JSON_SCHEMA   │      │  • Test data     │       │
│  └──────────────────┘      └──────────────────┘       │
└─────────────────────┼───────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│                    Output                               │
│          (back to User's Project)                       │
│                                                         │
│  ┌──────────────────────────────────────────────────┐ │
│  │           .bug-states/                           │ │
│  │                                                  │ │
│  │  • BUG-123.json  (state tracking)                │ │
│  │  • BUG-456.json  (workflow progress)              │ │
│  │  • backups/      (state file backups)            │ │
│  └──────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

## 🔄 Workflow Flow

```
1. USER PROMPT
   │
   ├─→ "Process bugs/login-error.md"
   │
   ↓
2. AI IDE RECEIVES
   │
   ├─→ Checks .cursorrules / .vscode/settings.json / etc.
   ├─→ Identifies bug-processing skill should be used
   ├─→ Reads SKILL.md for instructions
   │
   ↓
3. AI AGENT READS
   │
   ├─→ Bug report file: bugs/login-error.md
   ├─→ Skill documentation: SKILL.md
   ├─→ Current state (if exists): .bug-states/BUG-XXX.json
   │
   ↓
4. AI EXECUTES COMMAND
   │
   ├─→ uv run /path/to/bug-report-processor/scripts/process_bug.py bugs/login-error.md
   │
   ↓
5. SCRIPT PROCESSES
   │
   ├─→ Parses markdown (multi-format support)
   ├─→ Extracts: title, severity, steps, stack traces
   ├─→ Performs OCR on screenshots (if any)
   ├─→ Analyzes stack traces
   ├─→ Determines severity/priority
   │
   ↓
6. STATE FILE CREATED
   │
   ├─→ Creates: .bug-states/BUG-XXX.json
   ├─→ Initializes Detective Methodology state
   ├─→ Sets current_phase: "reproduce"
   │
   ↓
7. AI REPORTS BACK
   │
   ├─→ Summary of parsed data
   ├─→ Current phase: Reproduce
   ├─→ Next steps suggestion
   │
   ↓
8. USER CONTINUES
   │
   └─→ "Investigate BUG-123 with hypothesis: cache timing"
       │
       └─→ Repeat from step 2
```

## 🎯 Integration Methods by IDE

### Method 1: Configuration Files (Most IDEs)

```
IDE Config File → AI Agent → Reads SKILL.md → Executes scripts
```

**Supported IDEs:**
- Cursor (`.cursorrules`)
- VS Code (`.vscode/settings.json`)
- Windsurf (`.windsurfrules`)
- Continue.dev (`.continuerc.json`)

**Pros:**
- ✅ Persistent configuration
- ✅ Team collaboration via git
- ✅ Automatic activation
- ✅ Project-specific settings

**Cons:**
- ❌ Requires setup for each project
- ❌ Absolute paths needed

---

### Method 2: Instruction Files (Claude Code, etc.)

```
Markdown Instructions → Reference in chat → AI reads → Executes
```

**Supported IDEs:**
- Claude Code (`CLAUDE_INSTRUCTIONS.md`)
- Generic chat-based AI assistants

**Pros:**
- ✅ Human-readable
- ✅ Easy to update
- ✅ Self-documenting

**Cons:**
- ❌ Must be referenced in each conversation
- ❌ Not automatically activated

---

### Method 3: Symlink Skills Directory (Antigravity)

```
.agent/skills/bug-report-processor/ → Auto-detected → Used by agent
```

**Supported IDEs:**
- Antigravity / Project IDX
- Future skill-aware IDEs

**Pros:**
- ✅ Automatic detection
- ✅ No manual config needed
- ✅ Native skill support

**Cons:**
- ❌ IDE-specific feature
- ❌ Symlink management needed

---

### Method 4: Global Configuration (User-level)

```
~/.config/IDE/settings → All projects inherit
```

**Supported IDEs:**
- VS Code (User Settings)
- Continue.dev (`~/.continue/config.json`)
- Cline (Extension Settings)

**Pros:**
- ✅ Configure once, use everywhere
- ✅ No per-project setup

**Cons:**
- ❌ Less project-specific customization
- ❌ Still needs absolute paths

## 🔌 Communication Protocols

### Direct CLI Execution (Most Common)

```
AI Agent → Terminal → uv run scripts/process_bug.py → Output → AI Agent
```

**Flow:**
1. AI constructs command with absolute path
2. Executes in project terminal
3. Captures stdout/stderr
4. Parses output
5. Reports to user

**Requirements:**
- `uv` installed and in PATH
- Scripts have execute permissions
- Correct absolute paths

---

### State File I/O

```
AI Agent → Read .bug-states/BUG-XXX.json → Update → Write back
```

**Flow:**
1. AI reads current state file
2. Determines current phase
3. Executes appropriate script
4. Verifies state file update
5. Reports changes to user

**Advantages:**
- Persistent state across sessions
- Multi-agent collaboration possible
- Audit trail of all changes

---

### Skill Documentation Flow

```
First use: AI reads SKILL.md → Caches instructions → Uses for session
Subsequent: AI references cached knowledge → Executes commands
```

**Important files AI reads:**
- `SKILL.md` - Main skill specification
- `references/DETECTIVE_METHOD.md` - Workflow details
- `references/JSON_SCHEMA.md` - State file structure
- `config/*.yaml` - Format configurations

## 📊 Data Flow Diagram

```
┌──────────────┐
│ Bug Report   │
│  (Markdown)  │
└──────┬───────┘
       │
       │ read
       ↓
┌──────────────────────────────┐
│   process_bug.py             │
│                              │
│  1. Parse markdown           │
│  2. Extract structured data  │
│  3. Analyze stack traces     │
│  4. OCR screenshots          │
│  5. Determine severity       │
└──────┬───────────────────────┘
       │
       │ write
       ↓
┌──────────────────────────────┐
│   .bug-states/BUG-XXX.json   │
│                              │
│  • bug_id                    │
│  • title, severity           │
│  • reproduction steps        │
│  • stack trace analysis      │
│  • detective_state           │
└──────┬───────────────────────┘
       │
       │ read/update
       ↓
┌──────────────────────────────┐
│   detective_engine.py        │
│                              │
│  Phase progression:          │
│  reproduce → investigate     │
│  → diagnose → fix            │
│  → verify → test → close     │
└──────┬───────────────────────┘
       │
       │ update
       ↓
┌──────────────────────────────┐
│  Updated state file          │
│                              │
│  • current_phase changed     │
│  • investigation notes       │
│  • hypotheses                │
│  • root_cause                │
│  • verification results      │
└──────────────────────────────┘
```

## 🔐 Security Considerations

### File System Access

The skill only accesses:
- ✅ Bug report markdown files (read-only)
- ✅ `.bug-states/` directory (read/write)
- ✅ Screenshot files for OCR (read-only)

It never:
- ❌ Modifies source code (unless explicitly in Fix phase)
- ❌ Accesses sensitive files outside project
- ❌ Makes network requests (except tool installations)

### Command Execution

All commands use `uv run` which:
- ✅ Runs in isolated virtual environment
- ✅ Uses locked dependencies (uv.lock)
- ✅ Sandboxed Python execution

### Data Privacy

- State files stored locally in `.bug-states/`
- No data sent to external servers
- Screenshots processed locally via tesseract
- All processing happens on your machine

## 🚀 Performance Optimization

### Caching Strategy

1. **AI reads SKILL.md once** per conversation
2. **State files cached** during detective workflow
3. **Config files loaded** at IDE startup

### Parallel Execution

Multiple bugs can be processed simultaneously:
```bash
# Detective mode processes by severity, but in parallel
detective_engine.py --directory ./bugs --parallel
```

### Incremental Processing

- State files track progress
- Can pause/resume workflows
- No need to reprocess completed phases

## 🧪 Testing Integration

### Verification Script

Create `test-integration.sh`:

```bash
#!/bin/bash

echo "Testing Bug Report Agent Skill Integration"
echo "=========================================="

# 1. Check uv installation
echo "1. Checking uv..."
if command -v uv &> /dev/null; then
    echo "   ✓ uv installed: $(uv --version)"
else
    echo "   ✗ uv not found"
    exit 1
fi

# 2. Check skill path
SKILL_PATH="/path/to/bug-report-processor"  # Update this
echo "2. Checking skill path..."
if [ -f "$SKILL_PATH/SKILL.md" ]; then
    echo "   ✓ Skill found at: $SKILL_PATH"
else
    echo "   ✗ Skill not found at: $SKILL_PATH"
    exit 1
fi

# 3. Create test bug
echo "3. Creating test bug report..."
cat > test-bug.md << 'EOF'
# Bug: Test

## Description
Test bug report

## Steps to Reproduce
1. Run app
2. Observe error

## Error Logs
```
TypeError: object is None
```
EOF
echo "   ✓ Created test-bug.md"

# 4. Process test bug
echo "4. Processing test bug..."
uv run "$SKILL_PATH/scripts/process_bug.py" test-bug.md
if [ $? -eq 0 ]; then
    echo "   ✓ Bug processed successfully"
else
    echo "   ✗ Processing failed"
    exit 1
fi

# 5. Check state file
echo "5. Checking state file..."
if ls .bug-states/*.json 1> /dev/null 2>&1; then
    echo "   ✓ State file created"
    cat .bug-states/*.json | python -m json.tool > /dev/null
    if [ $? -eq 0 ]; then
        echo "   ✓ State file is valid JSON"
    fi
else
    echo "   ✗ No state file found"
    exit 1
fi

echo ""
echo "=========================================="
echo "✅ Integration test passed!"
echo ""
echo "Next steps:"
echo "1. Configure your IDE using examples/ide-configs/"
echo "2. Add .bug-states/ to .gitignore"
echo "3. Start processing real bugs!"
```

Usage:
```bash
chmod +x test-integration.sh
./test-integration.sh
```

## 📚 Additional Resources

- **[INTEGRATION_GUIDE.md](../INTEGRATION_GUIDE.md)** - Complete setup guide
- **[QUICK_INTEGRATION.md](../QUICK_INTEGRATION.md)** - Quick reference
- **[examples/ide-configs/](./ide-configs/)** - Ready-to-use configs
- **[SKILL.md](../SKILL.md)** - Skill specification

## 🤝 Contributing

To add support for a new IDE:

1. Create config file in `examples/ide-configs/`
2. Add section to `INTEGRATION_GUIDE.md`
3. Update this architecture document
4. Submit PR with examples and documentation

---

**Architecture questions?** File an issue or start a discussion!
