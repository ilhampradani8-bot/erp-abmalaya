# Integration Guide: Bug Report Agent Skill

This guide explains how to integrate the Bug Report Agent Skill with popular AI-powered IDEs and code editors. The skill enables systematic bug processing through the Detective Methodology across different AI platforms.

## 📋 Table of Contents

- [Prerequisites](#prerequisites)
- [Cursor IDE](#cursor-ide)
- [VS Code (with GitHub Copilot)](#vs-code-with-github-copilot)
- [Antigravity (Project IDX)](#antigravity-project-idx)
- [Claude Code](#claude-code)
- [Cline (VS Code Extension)](#cline-vs-code-extension)
- [Continue.dev](#continuedev)
- [Windsurf](#windsurf)
- [Troubleshooting](#troubleshooting)
- [Best Practices](#best-practices)

---

## Prerequisites

Before integrating with any IDE, ensure the skill is properly installed:

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/bug-report-agent-skills.git
cd bug-report-agent-skills/bug-report-processor

# Install uv (if not already installed)
curl -LsSf https://astral.sh/uv/install.sh | sh

# Install dependencies
uv sync

# Install tesseract-ocr for screenshot processing
# macOS
brew install tesseract

# Ubuntu/Debian
sudo apt-get install tesseract-ocr

# Windows (via Chocolatey)
choco install tesseract
```

**Important:** Note the absolute path to the skill directory:
```bash
pwd  # Save this path for integration configs
```

---

## Cursor IDE

[Cursor](https://cursor.sh/) is an AI-first code editor with native AI agent capabilities.

### Integration Methods

#### Method 1: Composer Rules (Recommended)

1. **Create/Edit `.cursorrules` file** in your project root:

```yaml
# .cursorrules
bug-processing:
  skill_path: /path/to/bug-report-agent-skills/bug-report-processor
  
  activation_phrases:
    - "process bug report"
    - "analyze error log"
    - "reproduce this bug"
    - "investigate issue"
    - "start detective workflow"
  
  instructions: |
    When handling bug reports or debugging issues:
    
    1. Use the Bug Report Agent Skill at {skill_path}
    2. Read SKILL.md for complete instructions
    3. Process bugs via: uv run {skill_path}/scripts/process_bug.py <bug-file.md>
    4. Track state in .bug-states/ folder (git-ignore this)
    5. Follow Detective Methodology phases: Reproduce → Investigate → Diagnose → Fix → Verify → Test → Close
    6. Never skip phases - each has entry/exit requirements
    
  commands:
    process: "uv run {skill_path}/scripts/process_bug.py"
    investigate: "uv run {skill_path}/scripts/state_manager.py"
    reproduce: "uv run {skill_path}/scripts/reproduce_bug.py"
    verify: "uv run {skill_path}/scripts/verify_fix.py"
    detective: "uv run {skill_path}/scripts/detective_engine.py --directory ./bugs"
```

2. **Replace `/path/to/bug-report-agent-skills/bug-report-processor`** with your actual path

3. **Add to `.gitignore`**:
```bash
echo ".bug-states/" >> .gitignore
```

#### Method 2: Project Context

1. Open **Cursor Settings** → **Cursor Tab** → **General**
2. Add to **Project Context**:
```
Bug Report Processing Skill: /path/to/bug-report-agent-skills/bug-report-processor

When asked to process bugs, analyze errors, or debug issues:
- Read /path/to/bug-report-agent-skills/bug-report-processor/SKILL.md
- Use Detective Methodology workflow
- Execute scripts via `uv run /path/to/bug-report-agent-skills/bug-report-processor/scripts/...`
```

### Usage in Cursor

**Chat Examples:**
```
You: "Process this bug report: bugs/login-error.md"

You: "Investigate BUG-123, add hypothesis: form validation timing issue"

You: "Start detective workflow for all critical bugs"
```

**Composer Mode:**
```
@bug-report-processor analyze the error in app.log and create a structured bug report
```

---

## VS Code (with GitHub Copilot)

VS Code users can integrate via Copilot Chat Instructions or workspace settings.

### Integration Methods

#### Method 1: GitHub Copilot Instructions (User-Level)

1. **Open VS Code Settings** (Cmd/Ctrl + ,)
2. Search for **"Copilot Chat Instructions"**
3. Add to **User Instructions**:

```markdown
# Bug Report Processing Skill

When I ask you to process bugs, analyze errors, or debug issues:

1. Use the Bug Report Agent Skill at: /path/to/bug-report-agent-skills/bug-report-processor
2. First read the SKILL.md file to understand capabilities
3. Follow the Detective Methodology: Reproduce → Investigate → Diagnose → Fix → Verify → Test
4. Execute commands using `uv run` with absolute paths
5. Track state in .bug-states/ folder (ensure it's git-ignored)

Available commands:
- Process: `uv run /path/to/.../scripts/process_bug.py <file>`
- Investigate: `uv run /path/to/.../scripts/state_manager.py <bug-id> --note "..."`
- Detective: `uv run /path/to/.../scripts/detective_engine.py --directory ./bugs`
```

#### Method 2: Workspace Settings (Project-Level)

1. Create `.vscode/settings.json` in your project:

```json
{
  "github.copilot.chat.codeGeneration.instructions": [
    {
      "text": "Use Bug Report Agent Skill at /path/to/bug-report-agent-skills/bug-report-processor for bug processing. Follow Detective Methodology phases. Read SKILL.md first."
    }
  ],
  "files.exclude": {
    ".bug-states/": true
  }
}
```

2. Create `.vscode/tasks.json` for quick commands:

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Process Bug Report",
      "type": "shell",
      "command": "uv run /path/to/bug-report-agent-skills/bug-report-processor/scripts/process_bug.py ${file}",
      "problemMatcher": [],
      "presentation": {
        "reveal": "always"
      }
    },
    {
      "label": "Detective Workflow",
      "type": "shell",
      "command": "uv run /path/to/bug-report-agent-skills/bug-report-processor/scripts/detective_engine.py --directory ./bugs",
      "problemMatcher": []
    }
  ]
}
```

### Usage in VS Code

**Copilot Chat:**
```
You: @workspace process the bug report in bugs/auth-failure.md using the bug-report-processor skill

You: @workspace start detective workflow for bug BUG-456
```

**Command Palette** (Cmd/Ctrl + Shift + P):
- Run Task → "Process Bug Report" (will process current open .md file)
- Run Task → "Detective Workflow"

---

## Antigravity (Project IDX)

Antigravity is Google's next-generation AI-native IDE (similar to Project IDX).

### Integration Method: Skills Directory

Antigravity has native support for agent skills via the `.agent/skills/` directory.

1. **Create symbolic link** to the skill:

```bash
# In your project directory
mkdir -p .agent/skills
cd .agent/skills

# Create symlink
ln -s /path/to/bug-report-agent-skills/bug-report-processor bug-report-processor

# Verify
ls -la
```

2. **Create skill index** (optional):

```bash
# .agent/skills/INDEX.md
# Available Skills

## Bug Report Processor
Location: ./bug-report-processor/SKILL.md
Activation: Say "process bug report", "debug issue", or "start detective workflow"
Purpose: Systematic bug processing via Detective Methodology
```

3. **Add to `.gitignore`**:
```bash
echo ".bug-states/" >> .gitignore
```

### Usage in Antigravity

Antigravity auto-detects skills in `.agent/skills/` directory.

**Chat Examples:**
```
You: "Use the bug-report-processor skill to analyze this error log"

You: "Process bug report bugs/performance-regression.md"

You: "Start detective workflow in auto mode"
```

**Antigravity automatically:**
- Reads `SKILL.md` when skill is referenced
- Executes commands with proper paths
- Tracks workflow state

---

## Claude Code

Claude Code (via Anthropic) can be integrated through project instructions.

### Integration Method: Project Instructions

1. **Create `CLAUDE_INSTRUCTIONS.md`** in your project root:

```markdown
# Claude Code Project Instructions

## Bug Report Processing Skill

**Location:** /path/to/bug-report-agent-skills/bug-report-processor

### When to Use
- Processing bug reports from markdown files
- Analyzing error logs and stack traces
- Reproducing bugs systematically
- Tracking bug resolution workflow
- Performing root cause analysis

### How to Use

1. **First Time:** Read the skill documentation:
   - Read: /path/to/bug-report-agent-skills/bug-report-processor/SKILL.md
   - Read: /path/to/bug-report-agent-skills/bug-report-processor/references/DETECTIVE_METHOD.md

2. **Process Bugs:** Use these commands:
   ```bash
   # Parse bug report
   uv run /path/to/.../scripts/process_bug.py <bug-file.md>
   
   # Add investigation notes
   uv run /path/to/.../scripts/state_manager.py <bug-id> --note "finding"
   
   # Start workflow
   uv run /path/to/.../scripts/detective_engine.py --directory ./bugs
   ```

3. **Follow Detective Methodology:**
   - Reproduce → Investigate → Diagnose → Fix → Verify → Regression Test → Close
   - Each phase has entry/exit requirements
   - Phases cannot be skipped

### Important Notes
- State files are stored in `.bug-states/` (git-ignored)
- Bugs processed by severity: critical → high → medium → low
- All commands use `uv run` for Python script execution
```

2. **Reference in conversations:**
```
You: "Read CLAUDE_INSTRUCTIONS.md and process the bug report in bugs/crash-report.md"
```

### Usage in Claude Code

```
You: "Following the bug processing instructions, analyze this stack trace and create a bug report"

You: "Use the detective methodology to investigate BUG-789"

You: "Read the skill docs and tell me how to run regression tests"
```

---

## Cline (VS Code Extension)

[Cline](https://github.com/cline/cline) is a VS Code extension that provides autonomous AI agents.

### Integration Method: Custom Instructions

1. **Open VS Code Settings** → Search "Cline"
2. Find **"Cline: Custom Instructions"**
3. Add:

```markdown
# Bug Report Processing

Skill Location: /path/to/bug-report-agent-skills/bug-report-processor

When handling bug reports, errors, or debugging tasks:

1. Read the skill documentation first:
   - /path/to/.../SKILL.md
   - /path/to/.../references/DETECTIVE_METHOD.md

2. Use these tools:
   - process_bug.py - Parse bug reports
   - detective_engine.py - Orchestrate workflow
   - state_manager.py - Update investigation notes
   - reproduce_bug.py - Attempt reproduction
   - verify_fix.py - Verify bug fixes
   - regression_tester.py - Run regression tests

3. Follow Detective Methodology phases (cannot skip):
   Reproduce → Investigate → Diagnose → Fix → Verify → Test → Close

4. State tracking:
   - Files: .bug-states/<bug-id>.json
   - Ensure .bug-states/ is git-ignored

Commands use: `uv run /path/to/.../scripts/<script>.py`
```

### Usage in Cline

In VS Code, open Cline chat:

```
You: "Process the bug report in bugs/memory-leak.md"

You: "Start detective workflow for all high severity bugs"

You: "Add investigation note for BUG-456: found memory leak in cache layer"
```

---

## Continue.dev

[Continue.dev](https://continue.dev/) is an open-source autopilot for VS Code and JetBrains.

### Integration Method: .continuerc.json

1. **Create/Edit** `~/.continue/config.json` (global) OR `.continuerc.json` (project):

```json
{
  "systemMessage": "You are an AI coding assistant with access to specialized skills.",
  "contextProviders": [
    {
      "name": "bug-report-processor",
      "params": {
        "skillPath": "/path/to/bug-report-agent-skills/bug-report-processor",
        "docs": [
          "/path/to/bug-report-agent-skills/bug-report-processor/SKILL.md",
          "/path/to/bug-report-agent-skills/bug-report-processor/references/DETECTIVE_METHOD.md"
        ]
      }
    }
  ],
  "slashCommands": [
    {
      "name": "process-bug",
      "description": "Process a bug report using Detective Methodology",
      "command": "uv run /path/to/bug-report-agent-skills/bug-report-processor/scripts/process_bug.py {{filepath}}"
    },
    {
      "name": "detective",
      "description": "Start detective workflow",
      "command": "uv run /path/to/bug-report-agent-skills/bug-report-processor/scripts/detective_engine.py --directory {{input}}"
    },
    {
      "name": "investigate-bug",
      "description": "Add investigation notes to a bug",
      "command": "uv run /path/to/bug-report-agent-skills/bug-report-processor/scripts/state_manager.py {{input}}"
    }
  ]
}
```

2. **Add instructions to prompts:**

In Continue side panel, add context:
```
@bug-report-processor Process this bug following Detective Methodology
```

### Usage in Continue.dev

**Slash Commands:**
```
/process-bug bugs/ui-glitch.md
/detective ./bugs
/investigate-bug BUG-123 --note "Found race condition in event handler"
```

**Chat:**
```
You: @bug-report-processor analyze the stack trace in error.log

You: @bug-report-processor start systematic debugging for crash reports
```

---

## Windsurf

[Windsurf](https://windsurf.ai/) is Codeium's agentic IDE.

### Integration Method: Project Rules

1. **Create `.windsurfrules`** in your project root:

```yaml
# .windsurfrules
skills:
  bug-report-processor:
    path: /path/to/bug-report-agent-skills/bug-report-processor
    documentation: SKILL.md
    
    activation_triggers:
      - "process bug"
      - "analyze error"
      - "reproduce bug"
      - "debug issue"
      - "detective workflow"
    
    methodology: |
      Detective Methodology (systematic bug resolution):
      1. Reproduce - Verify bug exists
      2. Investigate - Document hypotheses
      3. Diagnose - Identify root cause
      4. Fix - Implement solution
      5. Verify - Confirm fix works
      6. Regression Test - Ensure no side effects
      7. Close - Document resolution
      
      Phases cannot be skipped. Track state in .bug-states/
    
    commands:
      process: "uv run {{skill_path}}/scripts/process_bug.py"
      detective: "uv run {{skill_path}}/scripts/detective_engine.py"
      investigate: "uv run {{skill_path}}/scripts/state_manager.py"
      reproduce: "uv run {{skill_path}}/scripts/reproduce_bug.py"
      verify: "uv run {{skill_path}}/scripts/verify_fix.py"
      test: "uv run {{skill_path}}/scripts/regression_tester.py"

project_setup:
  gitignore:
    - ".bug-states/"
```

2. **Windsurf will auto-load** this config on startup

### Usage in Windsurf

**Chat Examples:**
```
You: "Process this bug report using detective methodology"

You: "Start detective workflow for critical bugs"

You: "Investigate BUG-456 with hypothesis: database connection pool exhaustion"
```

**Flow Mode:**
Windsurf's Flow can autonomously execute multi-step workflows:
```
You: "Use Flow to systematically debug and fix the login timeout issue"
```

---

## Troubleshooting

### Common Issues

#### 1. **"uv: command not found"**

**Solution:**
```bash
# Install uv
curl -LsSf https://astral.sh/uv/install.sh | sh

# Add to PATH (if needed)
echo 'export PATH="$HOME/.cargo/bin:$PATH"' >> ~/.bashrc  # or ~/.zshrc
source ~/.bashrc
```

#### 2. **"tesseract: command not found"**

**Solution:**
```bash
# macOS
brew install tesseract

# Ubuntu/Debian
sudo apt-get update && sudo apt-get install tesseract-ocr

# Windows
# Download from: https://github.com/UB-Mannheim/tesseract/wiki
```

#### 3. **"ModuleNotFoundError: No module named 'pytesseract'"**

**Solution:**
```bash
cd /path/to/bug-report-agent-skills/bug-report-processor
uv sync
```

#### 4. **".bug-states/ folder not created"**

**Issue:** Scripts create folder in skill directory instead of project directory

**Solution:** Run scripts from your project directory:
```bash
cd /path/to/your/project
uv run /path/to/bug-report-processor/scripts/process_bug.py bug.md
```

#### 5. **AI not finding/using the skill**

**Solutions:**
- Ensure paths in config are **absolute**, not relative
- Mention skill explicitly: "Use the bug-report-processor skill..."
- Ask AI to read SKILL.md first: "Read .../SKILL.md and then process..."
- Check skill path is correct: `ls /path/to/.../SKILL.md`

#### 6. **Permission denied errors**

**Solution:**
```bash
chmod +x /path/to/bug-report-agent-skills/bug-report-processor/scripts/*.py
```

### Verification Steps

Test the integration:

```bash
# 1. Create a test bug report
cat > test-bug.md << 'EOF'
# Bug: Test Error

## Description
Application crashes on startup

## Steps to Reproduce
1. Run `python app.py`
2. Observe crash

## Error Logs
```
Traceback (most recent call last):
  File "app.py", line 10, in <module>
    main()
TypeError: object of type 'NoneType' has no len()
```

## Environment
- Python 3.11
- macOS 14.0
EOF

# 2. Process the bug
uv run /path/to/bug-report-processor/scripts/process_bug.py test-bug.md

# 3. Check state file was created
ls .bug-states/

# 4. View the parsed state
cat .bug-states/*.json | python -m json.tool
```

---

## Best Practices

### 1. **Project Setup**

Always configure in new projects:

```bash
# Add to .gitignore
echo ".bug-states/" >> .gitignore

# Create bugs directory
mkdir -p bugs

# Symlink skill (optional, for quick access)
ln -s /path/to/bug-report-agent-skills/bug-report-processor .agent/skills/
```

### 2. **Prompting Strategies**

**Good Prompts:**
```
✅ "Read the bug-report-processor SKILL.md, then process bugs/login-error.md"
✅ "Use detective methodology to investigate BUG-123"
✅ "Start the detective workflow in auto mode for all critical bugs"
```

**Unclear Prompts:**
```
❌ "Fix this bug" (AI won't know to use the skill)
❌ "Debug the app" (too vague)
❌ "Run detective" (missing context)
```

### 3. **Workflow Integration**

Integrate with your existing workflow:

```bash
# Pre-commit hook: verify bug states
# .git/hooks/pre-commit
#!/bin/bash
if [ -d ".bug-states" ]; then
  echo "Checking bug states..."
  for file in .bug-states/*.json; do
    python -m json.tool "$file" > /dev/null || exit 1
  done
fi
```

### 4. **Team Collaboration**

Share configuration via project files:

```
project/
├── .cursorrules          # Cursor users
├── .vscode/
│   ├── settings.json     # VS Code + Copilot
│   └── tasks.json
├── .windsurfrules        # Windsurf users
├── CLAUDE_INSTRUCTIONS.md # Claude Code users
├── .continuerc.json      # Continue.dev users
└── .gitignore            # Everyone: ignore .bug-states/
```

### 5. **IDE-Specific Tips**

| IDE | Tip |
|-----|-----|
| **Cursor** | Use Composer mode with `@bug-report-processor` for complex workflows |
| **VS Code** | Create tasks for common commands (F1 → Run Task) |
| **Antigravity** | Leverage native skills auto-detection |
| **Claude Code** | Reference CLAUDE_INSTRUCTIONS.md in first message of new chats |
| **Cline** | Use autonomous mode for end-to-end bug resolution |
| **Continue.dev** | Configure slash commands for quick access |
| **Windsurf** | Use Flow mode for multi-phase detective workflows |

---

## Advanced Configuration

### Environment Variables

Create `.env` in your project for skill customization:

```bash
# .env
BUG_SKILL_PATH=/path/to/bug-report-agent-skills/bug-report-processor
BUG_STATE_DIR=.bug-states
BUG_SEVERITY_THRESHOLD=medium
BUG_AUTO_DETECTIVE=true
```

Load in IDE configs:

```json
// VS Code settings.json
{
  "terminal.integrated.env.osx": {
    "BUG_SKILL_PATH": "/path/to/bug-report-processor"
  }
}
```

### Custom Aliases

Add to `~/.bashrc` or `~/.zshrc`:

```bash
# Bug processing aliases
alias process-bug='uv run /path/to/bug-report-processor/scripts/process_bug.py'
alias detective='uv run /path/to/bug-report-processor/scripts/detective_engine.py'
alias investigate='uv run /path/to/bug-report-processor/scripts/state_manager.py'
alias verify-bug='uv run /path/to/bug-report-processor/scripts/verify_fix.py'
```

Usage in any IDE terminal:
```bash
process-bug bugs/crash.md
detective --directory ./bugs --auto
investigate BUG-123 --note "Found timeout in API call"
```

---

## Support & Resources

- **Skill Documentation:** [SKILL.md](SKILL.md)
- **Detective Methodology:** [references/DETECTIVE_METHOD.md](references/DETECTIVE_METHOD.md)
- **JSON Schema:** [references/JSON_SCHEMA.md](references/JSON_SCHEMA.md)
- **Bug Formats:** [references/BUG_STRUCTURE.md](references/BUG_STRUCTURE.md)

**Need Help?**
- File an issue: [GitHub Issues](https://github.com/YOUR_USERNAME/bug-report-agent-skills/issues)
- Join discussions: [GitHub Discussions](https://github.com/YOUR_USERNAME/bug-report-agent-skills/discussions)

---

**Made with ❤️ for systematic debugging across all AI IDEs**
