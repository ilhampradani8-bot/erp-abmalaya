# Quick Integration Reference

**Fast setup guide for popular AI IDEs** - See [INTEGRATION_GUIDE.md](INTEGRATION_GUIDE.md) for complete details.

---

## 🚀 Quick Start

### 1. Install Prerequisites
```bash
# Install uv
curl -LsSf https://astral.sh/uv/install.sh | sh

# Install tesseract
brew install tesseract  # macOS
# OR: sudo apt-get install tesseract-ocr  # Linux

# Install skill dependencies
cd /path/to/bug-report-processor
uv sync
```

### 2. Configure Your IDE

Copy the configuration snippet for your IDE:

---

## 📝 Configuration Snippets

### Cursor IDE

**File:** `.cursorrules` (project root)

```yaml
bug-processing:
  skill_path: /ABSOLUTE/PATH/TO/bug-report-processor
  
  instructions: |
    For bug reports: Read {skill_path}/SKILL.md
    Process: uv run {skill_path}/scripts/process_bug.py <file>
    Detective: uv run {skill_path}/scripts/detective_engine.py --directory ./bugs
    Follow Detective Methodology phases (cannot skip)
```

---

### VS Code + GitHub Copilot

**File:** `.vscode/settings.json`

```json
{
  "github.copilot.chat.codeGeneration.instructions": [
    {
      "text": "For bugs: Use /ABSOLUTE/PATH/TO/bug-report-processor. Read SKILL.md. Follow Detective Methodology."
    }
  ]
}
```

---

### Antigravity (Google)

**Setup:** Create symlink

```bash
mkdir -p .agent/skills
cd .agent/skills
ln -s /ABSOLUTE/PATH/TO/bug-report-processor bug-report-processor
```

---

### Claude Code

**File:** `CLAUDE_INSTRUCTIONS.md` (project root)

```markdown
# Bug Processing Skill: /ABSOLUTE/PATH/TO/bug-report-processor

When processing bugs:
1. Read SKILL.md from above path
2. Use: uv run /ABSOLUTE/.../scripts/process_bug.py <file>
3. Follow Detective Methodology
```

---

### Cline (VS Code Extension)

**Settings:** VS Code → Cline: Custom Instructions

```markdown
Bug Report Skill: /ABSOLUTE/PATH/TO/bug-report-processor
Read SKILL.md for usage. Use uv run /path/scripts/<script>.py
```

---

### Continue.dev

**File:** `~/.continue/config.json` or `.continuerc.json`

```json
{
  "slashCommands": [
    {
      "name": "process-bug",
      "command": "uv run /ABSOLUTE/PATH/TO/bug-report-processor/scripts/process_bug.py {{filepath}}"
    }
  ]
}
```

---

### Windsurf

**File:** `.windsurfrules` (project root)

```yaml
skills:
  bug-report-processor:
    path: /ABSOLUTE/PATH/TO/bug-report-processor
    commands:
      process: "uv run {{skill_path}}/scripts/process_bug.py"
      detective: "uv run {{skill_path}}/scripts/detective_engine.py"
```

---

## 💬 Usage Examples

**For all IDEs:**

```
"Process bug report: bugs/login-error.md"

"Use bug-report-processor skill to investigate BUG-123"

"Start detective workflow for critical bugs"

"Add hypothesis for BUG-456: race condition in cache layer"
```

---

## ⚙️ Project Setup

**In every project using this skill:**

```bash
# 1. Ignore state files
echo ".bug-states/" >> .gitignore

# 2. Create bugs directory
mkdir -p bugs

# 3. Test integration
cat > bugs/test.md << 'EOF'
# Bug: Test

## Description
Test bug for integration

## Steps to Reproduce
1. Run app
2. See error
EOF

# 4. Process test bug (replace with YOUR absolute path)
uv run /ABSOLUTE/PATH/TO/bug-report-processor/scripts/process_bug.py bugs/test.md

# 5. Verify .bug-states/ was created
ls .bug-states/
```

---

## 🔍 Common Commands

```bash
# Get absolute path (use this in configs)
cd /path/to/bug-report-processor && pwd

# Process bug
uv run /ABSOLUTE/.../scripts/process_bug.py <file.md>

# Start detective workflow
uv run /ABSOLUTE/.../scripts/detective_engine.py --directory ./bugs

# Update investigation
uv run /ABSOLUTE/.../scripts/state_manager.py <bug-id> --note "text"

# Verify fix
uv run /ABSOLUTE/.../scripts/verify_fix.py <bug-id>
```

---

## 📖 Full Documentation

👉 **[INTEGRATION_GUIDE.md](INTEGRATION_GUIDE.md)** - Complete integration guide with troubleshooting

---

## Detective Methodology (Quick Ref)

```
Reproduce → Investigate → Diagnose → Fix → Verify → Regression Test → Close
```

**Phases cannot be skipped!** Each has entry/exit requirements.

---

**Need help?** See [INTEGRATION_GUIDE.md](INTEGRATION_GUIDE.md) or file an issue.
