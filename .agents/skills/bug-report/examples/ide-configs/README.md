# IDE Configuration Examples

This directory contains ready-to-use configuration files for integrating the Bug Report Agent Skill with popular AI IDEs.

## 📁 Available Configurations

| IDE | Configuration File | Where to Place |
|-----|-------------------|----------------|
| **Cursor** | `cursorrules.example` | Copy to `.cursorrules` in project root |
| **VS Code + Copilot** | `vscode-settings.json` | Copy to `.vscode/settings.json` |
| **VS Code Tasks** | `vscode-tasks.json` | Copy to `.vscode/tasks.json` |
| **Claude Code** | `CLAUDE_INSTRUCTIONS.md` | Copy to project root |
| **Continue.dev** | `continue-config.json` | Copy to `~/.continue/config.json` or `.continuerc.json` |
| **Windsurf** | `windsurfrules.example` | Copy to `.windsurfrules` in project root |

## 🚀 Quick Setup

### 1. Choose Your IDE Configuration

```bash
# Example: Setup for Cursor IDE
cd /your/project/directory

# Copy the example file
cp /path/to/bug-report-processor/examples/ide-configs/cursorrules.example .cursorrules

# Edit with your absolute path
# Replace: /path/to/bug-report-agent-skills/bug-report-processor
# With your actual path
```

### 2. Get Your Absolute Path

```bash
cd /path/to/bug-report-agent-skills/bug-report-processor
pwd
# Copy this output and use it in your config files
```

### 3. Update Configuration

Open the copied config file and replace all instances of `/path/to/bug-report-agent-skills/bug-report-processor` with your actual absolute path.

### 4. Add to .gitignore

```bash
echo ".bug-states/" >> .gitignore
```

## 📋 File Descriptions

### cursorrules.example
Complete Cursor IDE configuration with:
- Activation phrases
- Command mappings
- Workflow rules
- Example prompts
- State management settings

**Usage:**
```bash
cp cursorrules.example /your/project/.cursorrules
# Edit absolute paths
```

### vscode-settings.json
VS Code editor settings with:
- GitHub Copilot instructions
- File exclusions for `.bug-states/`
- Search and watcher exclusions

**Usage:**
```bash
mkdir -p /your/project/.vscode
cp vscode-settings.json /your/project/.vscode/settings.json
# Edit absolute paths
```

### vscode-tasks.json
VS Code task definitions for:
- Processing bug reports
- Running detective workflow
- Adding investigation notes
- Verifying fixes
- Running regression tests

**Usage:**
```bash
mkdir -p /your/project/.vscode
cp vscode-tasks.json /your/project/.vscode/tasks.json
# Edit absolute paths
# Run via: Cmd/Ctrl+Shift+P → "Tasks: Run Task"
```

### CLAUDE_INSTRUCTIONS.md
Comprehensive instructions for Claude Code with:
- When to use the skill
- All available commands
- Detective Methodology overview
- Workflow examples
- Phase requirements

**Usage:**
```bash
cp CLAUDE_INSTRUCTIONS.md /your/project/
# Edit absolute paths
# Reference in conversations: "Read CLAUDE_INSTRUCTIONS.md and..."
```

### continue-config.json
Continue.dev configuration with:
- System message
- Context providers
- Slash commands (`/process-bug`, `/detective`, etc.)
- Custom commands

**Usage:**
```bash
# Global (all projects)
cp continue-config.json ~/.continue/config.json

# OR Project-specific
cp continue-config.json /your/project/.continuerc.json

# Edit absolute paths
```

### windsurfrules.example
Windsurf IDE rules with:
- Skill activation triggers
- Command definitions
- Pre-defined workflows
- Flow mode integration
- Autonomous action permissions

**Usage:**
```bash
cp windsurfrules.example /your/project/.windsurfrules
# Edit absolute paths
```

## 🔧 Customization

### Modify Activation Phrases

Most configs allow you to customize when the skill activates. For example, in `.cursorrules`:

```yaml
activation_phrases:
  - "process bug report"
  - "analyze error log"
  - "your custom phrase here"
```

### Add Custom Commands

You can extend the command mappings. For example, in `vscode-tasks.json`:

```json
{
  "label": "Your Custom Task",
  "type": "shell",
  "command": "uv run /path/to/.../scripts/your_custom_script.py",
  "problemMatcher": []
}
```

### Workflow Customization

For IDEs that support workflows (Windsurf), you can define custom multi-step processes:

```yaml
workflows:
  your_custom_workflow:
    description: "Your workflow description"
    steps:
      - "Step 1"
      - "Step 2"
```

## ✅ Verification

After setup, test your integration:

### Create Test Bug Report

```bash
cat > test-bug.md << 'EOF'
# Bug: Test Integration

## Description
Testing IDE integration

## Steps to Reproduce
1. Open app
2. Click button

## Error Logs
```
TypeError: Cannot read property 'x' of undefined
```
EOF
```

### Test Processing

**Cursor/Windsurf/Cline:**
```
Chat: "Process test-bug.md using the bug-report-processor skill"
```

**VS Code:**
```
1. Open test-bug.md
2. Cmd/Ctrl+Shift+P
3. "Tasks: Run Task" → "Process Bug Report"
```

**Continue.dev:**
```
Chat: /process-bug test-bug.md
```

**Claude Code:**
```
Chat: "Following CLAUDE_INSTRUCTIONS.md, process test-bug.md"
```

### Verify Output

Check that:
1. `.bug-states/` directory was created
2. A JSON state file exists (e.g., `.bug-states/BUG-XXX.json`)
3. No errors in terminal output

## 🐛 Troubleshooting

### Config not recognized

**Solution:** Check file naming is exact:
- `.cursorrules` (no extension)
- `.windsurfrules` (no extension)
- `.vscode/settings.json` (correct directory)

### "Path not found" errors

**Solution:** Verify absolute paths:
```bash
# Test path is correct
ls /your/absolute/path/to/bug-report-processor/SKILL.md
# Should list the file
```

### AI not using the skill

**Solution:**
1. Be explicit in prompts: "Use the bug-report-processor skill..."
2. Ask AI to read SKILL.md first
3. Check activation phrases match your prompt

### Commands not running

**Solution:**
1. Verify `uv` is installed: `which uv`
2. Check script paths are correct
3. Ensure scripts have execute permissions: `chmod +x scripts/*.py`

## 📖 Related Documentation

- **[INTEGRATION_GUIDE.md](../../INTEGRATION_GUIDE.md)** - Complete integration guide
- **[QUICK_INTEGRATION.md](../../QUICK_INTEGRATION.md)** - Quick reference
- **[SKILL.md](../../SKILL.md)** - Skill specification
- **[README.md](../../README.md)** - Project overview

## 💡 Tips

1. **Start Simple:** Use the example configs as-is first, customize later
2. **Absolute Paths:** Always use absolute paths, never relative
3. **Test Incrementally:** Test after each config change
4. **Version Control:** Commit working configs to your project repo
5. **Share with Team:** Include IDE configs in your project for team consistency

## 🤝 Contributing

Found a better configuration? Submit a PR with:
- New example config file
- Description in this README
- Usage instructions

---

**Questions?** See the [INTEGRATION_GUIDE.md](../../INTEGRATION_GUIDE.md) or file an issue.
