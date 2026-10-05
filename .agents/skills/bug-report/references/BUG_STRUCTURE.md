# Bug Report Structure Reference

This document describes the expected markdown structure for bug reports from different ticket systems.

## GitHub Issues Format

```markdown
# Bug: [Title]

**Labels**: bug, high-priority, [additional labels]
**Assignee**: @[username]
**Milestone**: [milestone name]
**Opened by**: @[username] on [YYYY-MM-DD]

## Description
[Brief description of the issue]

## Steps to Reproduce
1. [First step]
2. [Second step]
3. [Third step]
4. [Observe: what happens]

## Expected Behavior
[What should happen]

## Actual Behavior
[What actually happens]

## Environment
- **OS**: [Operating system]
- **Browser**: [Browser name and version]
- **App Version**: [Application version]
- **Device**: [Device type]

## Screenshots
![Description](./path/to/screenshot.png)

## Error Logs
```
[Stack trace or error log]
```

## Additional Context
[Any other relevant information]

## Severity Assessment
**Severity**: [critical/high/medium/low]
**Priority**: [urgent/high/normal/low]
**Impact**: [Description of user impact]

## Related Issues
- Similar to #[number]
- May be related to #[number]
```

## Linear Format

```markdown
# [PROJECT-123] - [Title]

**Status**: [In Progress/Done/etc.]
**Priority**: [Urgent/High/Medium/Low]
**Created**: [YYYY-MM-DD]
**Updated**: [YYYY-MM-DD]
**Assignee**: [Name]
**Reporter**: [Name]
**Labels**: [label1], [label2]
**Cycle**: [Sprint name]

## Problem
[Description of the issue]

## Impact
[Number of affected users or description of impact]

## Environment
- [OS/Browser version]
- App [version]

## Reproduction Steps
1. [Step one]
2. [Step two]
3. [Step three]

## Expected vs Actual
Expected: [What should happen]
Actual: [What actually happens]

## Stack Trace
```[language]
[Error and stack trace]
```

## Attachments
- [filename.png]
- [log_file.txt]
```

## Bugzilla Format

```markdown
# [Bug Title]

**Bug ID**: [number]
**Product**: [Product name]
**Component**: [Component name]
**Version**: [Version]
**Severity**: [blocker/critical/major/normal/minor/trivial]
**Priority**: [P1/P2/P3/P4/P5]
**Status**: [NEW/ASSIGNED/RESOLVED/etc.]
**Resolution**: [FIXED/WONTFIX/etc.]
**Assigned To**: [email/name]
**Reporter**: [email/name]
**CC**: [email1], [email2]
**Keywords**: [keyword1], [keyword2]
**Target Milestone**: [milestone]
**Platform**: [All/PC/Mac/etc.]
**OS**: [All/Windows/Linux/etc.]

## Description
[Detailed description of the bug]

## Steps to Reproduce
1. [Step one]
2. [Step two]
3. [Step three]

## Expected Results
[What should happen]

## Actual Results
[What actually happens]

## Additional Information
[Any other relevant details, workarounds, etc.]
```

## Generic/Minimal Format

The parser also handles minimal bug reports:

```markdown
# Bug Title

## Description
[What's wrong]

## Steps to Reproduce
1. [Steps]

## Expected
[Expected behavior]

## Actual
[Actual behavior]
```

## Required vs Optional Fields

### Required Fields
- Title (from H1 heading)
- Description or Problem section
- Steps to Reproduce (for automation)

### Optional but Recommended
- Severity/Priority
- Environment details
- Error logs/Stack traces
- Screenshots
- Expected vs Actual behavior

### Automatically Extracted
- Bug ID (from title pattern or generated)
- Labels/Tags
- Assignee/Reporter
- Code blocks (as potential stack traces)
- Image references (as screenshots)
