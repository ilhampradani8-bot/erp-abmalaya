# Bug Report Agent Skill

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.9+](https://img.shields.io/badge/python-3.9+-blue.svg)](https://www.python.org/downloads/)
[![Agent Skills](https://img.shields.io/badge/Agent%20Skills-Compatible-brightgreen.svg)](https://agentskills.io)

An AI agent skill for automated bug report processing and systematic debugging through the **Detective Methodology**. Transform bug reports from any ticket system into structured workflows that enforce best practices for reproduction, investigation, root cause analysis, and verification.

## 🎯 Overview

This skill enables AI agents to:
- **Parse bug reports** from Linear, GitHub Issues, Bugzilla, or custom formats
- **Extract and analyze** stack traces (Python, JavaScript, Java, C#)
- **OCR screenshots** to extract error messages
- **Track investigation** notes, hypotheses, and root cause analysis
- **Automate reproduction** verification with Selenium/Playwright
- **Enforce systematic workflow** through phase-gated progression
- **Run regression tests** before marking bugs as resolved

## 🚀 Quick Start

### Installation

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/bug-report-agent-skills.git
cd bug-report-agent-skills

# Install uv (if not already installed)
curl -LsSf https://astral.sh/uv/install.sh | sh

# Install dependencies (Python 3.9+)
uv sync

# Or to include development dependencies
uv sync --extra dev

# Install tesseract-ocr (required for screenshot OCR)
# macOS
brew install tesseract

# Ubuntu/Debian
sudo apt-get install tesseract-ocr
```

### Process Your First Bug

```bash
# Process a bug report (run from your project directory)
uv run /path/to/bug-report-agent-skills/scripts/process_bug.py path/to/bug-report.md

# Start the detective workflow
uv run /path/to/bug-report-agent-skills/scripts/detective_engine.py --directory ./bugs
```

**Important Note:** The `.bug-states/` folder will be created in your **current project directory** (not in the skill folder). Make sure to add `.bug-states/` to your project's `.gitignore` file:

```bash
echo ".bug-states/" >> .gitignore
```

## 🔌 Integrate with Your AI IDE

This skill works seamlessly with popular AI-powered IDEs:

| IDE | Setup Time | Documentation |
|-----|------------|---------------|
| **Cursor** | 2 min | [Quick Setup](QUICK_INTEGRATION.md#cursor-ide) • [Full Guide](INTEGRATION_GUIDE.md#cursor-ide) |
| **VS Code + Copilot** | 2 min | [Quick Setup](QUICK_INTEGRATION.md#vs-code--github-copilot) • [Full Guide](INTEGRATION_GUIDE.md#vs-code-with-github-copilot) |
| **Antigravity** | 1 min | [Quick Setup](QUICK_INTEGRATION.md#antigravity-google) • [Full Guide](INTEGRATION_GUIDE.md#antigravity-project-idx) |
| **Claude Code** | 2 min | [Quick Setup](QUICK_INTEGRATION.md#claude-code) • [Full Guide](INTEGRATION_GUIDE.md#claude-code) |
| **Windsurf** | 2 min | [Quick Setup](QUICK_INTEGRATION.md#windsurf) • [Full Guide](INTEGRATION_GUIDE.md#windsurf) |
| **Continue.dev** | 2 min | [Quick Setup](QUICK_INTEGRATION.md#continuedev) • [Full Guide](INTEGRATION_GUIDE.md#continuedev) |
| **Cline** | 2 min | [Full Guide](INTEGRATION_GUIDE.md#cline-vs-code-extension) |

**📚 Integration Resources:**
- **[INTEGRATION_INDEX.md](INTEGRATION_INDEX.md)** - Start here for navigation
- **[QUICK_INTEGRATION.md](QUICK_INTEGRATION.md)** - Copy-paste configs (2-5 min setup)
- **[INTEGRATION_GUIDE.md](INTEGRATION_GUIDE.md)** - Complete guide with troubleshooting
- **[examples/ide-configs/](examples/ide-configs/)** - Ready-to-use configuration files
- **[INTEGRATION_ARCHITECTURE.md](INTEGRATION_ARCHITECTURE.md)** - Technical deep dive

**Quick Integration (30 seconds):**
```bash
# 1. Get absolute path
cd /path/to/bug-report-processor && pwd

# 2. Copy config for your IDE
cp examples/ide-configs/cursorrules.example /your/project/.cursorrules
# (or vscode-settings.json, windsurfrules.example, etc.)

# 3. Edit config and replace paths
# 4. Start using: "Process bugs/my-bug.md"
```


## 📋 The Detective Methodology

The skill enforces a systematic, phase-gated approach to bug resolution:

```
Bug Queue (by severity) → Reproduce → Investigate → Diagnose → Fix → Verify → Regression Test → Close
```

**Key principles:**
- ✅ Phases cannot be skipped
- ✅ Each phase has entry/exit requirements
- ✅ Bugs processed by severity (critical first)
- ✅ All state tracked in JSON files

| Phase | Entry Requirement | Exit Requirement |
|-------|-------------------|------------------|
| **Reproduce** | Bug report parsed | Bug reproduced OR marked needs-info |
| **Investigate** | Bug reproduced | Hypotheses documented |
| **Diagnose** | Investigation complete | Root cause identified |
| **Fix** | Root cause documented | Fix implemented |
| **Verify** | Fix implemented | Original bug no longer occurs |
| **Regression Test** | Fix verified | All related tests pass |
| **Closed** | Regression tests pass | Resolution documented |

## 🔧 Features

### Multi-Format Support
- ✅ GitHub Issues
- ✅ Linear
- ✅ Bugzilla
- ✅ Custom formats via YAML configuration

### Stack Trace Analysis
- ✅ Python (`Traceback (most recent call last):`)
- ✅ JavaScript (`Error:`, `TypeError:`)
- ✅ Java (`Exception in thread`)
- ✅ C# (`Unhandled Exception:`)

### Automated Reproduction
- ✅ Selenium WebDriver integration
- ✅ Playwright support
- ✅ Screenshot comparison
- ✅ Environment validation

### Severity Classification
- **Critical** - System crash, data loss, security vulnerability → Immediate
- **High** - Major feature broken, significant impact → < 4 hours
- **Medium** - Feature degraded, workaround exists → < 24 hours
- **Low** - Minor issue, cosmetic → Next sprint
- **Trivial** - Typo, minor polish → Backlog

## 📚 Documentation

- **[INTEGRATION_GUIDE.md](INTEGRATION_GUIDE.md)** - ⭐ How to integrate with AI IDEs (Cursor, VS Code, Antigravity, Claude Code, etc.)
- **[SKILL.md](SKILL.md)** - Complete skill specification and usage guide
- **[references/DETECTIVE_METHOD.md](references/DETECTIVE_METHOD.md)** - Detailed workflow guide
- **[references/JSON_SCHEMA.md](references/JSON_SCHEMA.md)** - State file schema
- **[references/BUG_STRUCTURE.md](references/BUG_STRUCTURE.md)** - Supported markdown formats
- **[references/SEVERITY_GUIDE.md](references/SEVERITY_GUIDE.md)** - Classification criteria

## 🛠️ CLI Commands

```bash
# Process bug reports
uv run scripts/process_bug.py <bug.md> [--format github|linear|bugzilla]

# Update investigation
uv run scripts/state_manager.py <bug-id> --note "Investigation note"
uv run scripts/state_manager.py <bug-id> --hypothesis "Hypothesis"
uv run scripts/state_manager.py <bug-id> --root-cause "Root cause"

# Reproduction and verification
uv run scripts/reproduce_bug.py <bug-id>
uv run scripts/verify_fix.py <bug-id>

# Regression testing
uv run scripts/regression_tester.py <bug-id>

# Analyze severity
uv run scripts/severity_analyzer.py <bug.md>

# Detective auto-progression mode
uv run scripts/detective_engine.py --directory ./bugs --auto
```

## 📂 Project Structure

```
bug-report-processor/
├── SKILL.md                    # Main skill definition
├── scripts/                    # Core Python modules
│   ├── process_bug.py         # Main entry point
│   ├── detective_engine.py    # Workflow orchestrator
│   ├── parse_markdown.py      # Multi-format parser
│   ├── parse_stack_trace.py   # Stack trace analyzer
│   ├── screenshot_ocr.py      # OCR processing
│   └── state_manager.py       # JSON state management
├── config/                     # Format configurations
│   ├── github.yaml
│   ├── linear.yaml
│   └── field_mappings.yaml
├── references/                 # Documentation
├── assets/
│   ├── templates/             # JSON/markdown templates
│   └── examples/              # Sample bug reports
└── tests/                     # Test suite

# Output (created in current project directory)
.bug-states/                   # Generated state files (git-ignored)
├── BUG-123.json
├── BUG-456.json
└── backups/                   # State file backups
```

## 🤖 Agent Integration

This skill is compatible with AI agents that support the [Agent Skills](https://agentskills.io) format.

**Activation triggers:**
- "process bug report"
- "analyze error log"
- "reproduce this bug"
- "investigate issue"
- "start detective workflow"

The skill uses only approved tools: `Bash(uv:*)`, `Bash(python:*)`, `Bash(pytest:*)`, `Read`, `Write`, `Edit`, `Glob`, `Grep`.

## 📊 JSON State Schema

Each bug generates a state file tracking the entire lifecycle:

```json
{
  "bug_id": "BUG-456",
  "title": "Login button not responding",
  "severity": "high",
  "status": "investigating",
  "reproduction": { "status": "reproduced", "steps": [...] },
  "error_analysis": { "error_type": "TypeError", "stack_trace": [...] },
  "investigation": { "hypothesis": [...], "root_cause": null },
  "fix": { "status": "pending", "commits": [] },
  "regression_testing": { "status": "pending" },
  "detective_state": { "current_phase": "investigating" }
}
```

## 🧪 Testing

```bash
# Install test dependencies
uv sync --extra test

# Run all tests
uv run pytest

# Run specific test module
uv run pytest tests/test_parse_markdown.py

# Run with coverage
uv run pytest --cov=scripts
```

## 🤝 Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built for the [Agent Skills](https://agentskills.io) ecosystem
- Inspired by systematic debugging methodologies from Google SRE practices
- Stack trace parsing patterns adapted from industry-standard error formats

## 📬 Support

- **Issues**: [GitHub Issues](https://github.com/YOUR_USERNAME/bug-report-agent-skills/issues)
- **Discussions**: [GitHub Discussions](https://github.com/YOUR_USERNAME/bug-report-agent-skills/discussions)
- **Agent Skills**: [Documentation](https://agentskills.io)

---

**Made with ❤️ for systematic debugging and AI agent capabilities**
