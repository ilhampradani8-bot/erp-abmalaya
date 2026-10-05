# Bug State JSON Schema Reference

This document describes the complete JSON schema for bug state files.

## Complete Schema

```json
{
  "bug_id": "string (required) - Unique identifier for the bug",
  "title": "string (required) - Bug title/summary",
  "type": "string - Always 'bug'",
  "severity": "string - critical|high|medium|low|trivial",
  "priority": "string - urgent|high|normal|low",
  "status": "string - Bug status (see Status Values below)",
  "created_at": "string - ISO 8601 timestamp",
  "updated_at": "string - ISO 8601 timestamp",

  "metadata": {
    "reporter": "string - Who reported the bug",
    "assignee": "string - Who is assigned to fix",
    "labels": ["array of strings - Tags/labels"],
    "affected_versions": ["array of strings - Versions with bug"],
    "target_fix_version": "string - Target version for fix",
    "regression": "boolean - Is this a regression?",
    "customer_impact": "string - Impact description",
    "affected_users": "number - Count of affected users",
    "source_file": "string - Original bug report file path",
    "source_format": "string - github|linear|bugzilla|generic"
  },

  "description": {
    "summary": "string - Brief description",
    "observed_behavior": "string - What actually happens",
    "expected_behavior": "string - What should happen",
    "additional_context": "string - Extra information"
  },

  "reproduction": {
    "steps": ["array of strings - Ordered reproduction steps"],
    "reproduction_rate": "string - e.g., '100%', 'intermittent'",
    "automated_reproduction": {
      "possible": "boolean - Can steps be automated?",
      "script_path": "string - Path to reproduction script",
      "last_attempt": "string - ISO timestamp of last attempt",
      "status": "string - not_attempted|reproducing|reproduced|cannot_reproduce|needs_manual_verification",
      "evidence": {
        "screenshots": ["array of strings - Screenshot paths"],
        "logs": ["array of strings - Log file paths"]
      }
    }
  },

  "environment": {
    "os": "string - Operating system",
    "browser": "string - Browser name/version",
    "app_version": "string - Application version",
    "device": "string - Device type",
    "...": "Additional environment key-value pairs"
  },

  "error_analysis": {
    "error_type": "string - e.g., 'TypeError', 'NullPointerException'",
    "error_message": "string - Full error message",
    "stack_trace": [
      {
        "frame_number": "number - Position in stack",
        "file": "string - Source file path",
        "line": "number - Line number",
        "column": "number (optional) - Column number",
        "function": "string - Function/method name",
        "code_snippet": "string (optional) - Code at that line",
        "class_name": "string (optional) - Class name",
        "module": "string (optional) - Module name"
      }
    ],
    "likely_cause": "string - Inferred cause from analysis"
  },

  "screenshots": [
    {
      "filename": "string - Screenshot filename",
      "path": "string - Full path to screenshot",
      "description": "string - Alt text or description",
      "extracted_text": "string - OCR extracted text",
      "error_messages": ["array of strings - Detected error messages"],
      "timestamp": "string - ISO timestamp"
    }
  ],

  "investigation": {
    "status": "string - not_started|in_progress|diagnosed|blocked",
    "started_at": "string - ISO timestamp",
    "hypothesis": [
      {
        "id": "string - Hypothesis ID (HYP-1, HYP-2, etc.)",
        "description": "string - Hypothesis description",
        "created_at": "string - ISO timestamp",
        "status": "string - pending|testing|confirmed|rejected",
        "evidence": ["array of strings - Supporting evidence"],
        "tested_by": "string - Who tested this hypothesis",
        "conclusion": "string - Final conclusion"
      }
    ],
    "root_cause": {
      "description": "string - Root cause explanation",
      "identified_at": "string - ISO timestamp",
      "responsible_commit": "string - Commit that introduced bug",
      "responsible_file": "string - File containing bug"
    },
    "notes": [
      {
        "timestamp": "string - ISO timestamp",
        "author": "string - Note author",
        "content": "string - Note content"
      }
    ]
  },

  "fix": {
    "status": "string - pending|in_progress|implemented|failed",
    "description": "string - Description of the fix",
    "implementation": {
      "started_at": "string - ISO timestamp",
      "completed_at": "string - ISO timestamp",
      "files_changed": ["array of strings - Modified files"],
      "commits": ["array of strings - Commit hashes"],
      "pull_request": "string - PR number/URL"
    },
    "verification": {
      "status": "string - pending|verified|failed|partial",
      "verified_at": "string - ISO timestamp",
      "verified_by": "string - Verifier name",
      "test_results": {
        "original_bug": "string - fixed|still_present|intermittent",
        "test_cases_passed": "number",
        "test_cases_failed": "number"
      }
    }
  },

  "regression_testing": {
    "status": "string - pending|passed|failed",
    "test_suites": [
      {
        "suite": "string - Test suite name/path",
        "tests_run": "number",
        "passed": "number",
        "failed": "number",
        "skipped": "number",
        "failed_tests": ["array of strings - Names of failed tests"]
      }
    ],
    "executed_at": "string - ISO timestamp",
    "new_issues_found": ["array of strings - New bugs introduced"]
  },

  "detective_state": {
    "current_phase": "string - new|reproduce|investigate|diagnose|fix|verify|regression_test|closed",
    "phases_completed": ["array of strings - Completed phase names"],
    "blockers": ["array of strings - Current blockers"],
    "related_bugs": ["array of strings - Related bug IDs"]
  },

  "resolution": {
    "resolution_type": "string - fixed|wont_fix|duplicate|cannot_reproduce",
    "closed_at": "string - ISO timestamp",
    "time_to_resolution_hours": "number",
    "lessons_learned": ["array of strings - Takeaways"]
  }
}
```

## Status Values

### Bug Status
| Status | Description |
|--------|-------------|
| `new` | Bug report received, not yet processed |
| `reproducing` | Attempting to reproduce |
| `reproduced` | Bug successfully reproduced |
| `cannot_reproduce` | Unable to reproduce bug |
| `needs_info` | Waiting for more information |
| `investigating` | Under investigation |
| `diagnosed` | Root cause identified |
| `fixing` | Fix in progress |
| `verifying` | Fix being verified |
| `verified` | Fix verified working |
| `regression_testing` | Running regression tests |
| `closed` | Bug resolved |
| `wont_fix` | Decided not to fix |
| `duplicate` | Duplicate of another bug |

### Detective Phases
| Phase | Description |
|-------|-------------|
| `new` | Initial state |
| `reproduce` | Reproduction phase |
| `investigate` | Investigation phase |
| `diagnose` | Diagnosis phase |
| `fix` | Fix implementation phase |
| `verify` | Verification phase |
| `regression_test` | Regression testing phase |
| `closed` | Final state |

## Example State File

```json
{
  "bug_id": "BUG-456",
  "title": "Login button not responding on mobile",
  "type": "bug",
  "severity": "high",
  "priority": "urgent",
  "status": "verified",
  "created_at": "2026-01-20T10:00:00Z",
  "updated_at": "2026-01-21T15:30:00Z",
  "metadata": {
    "reporter": "jane_user",
    "assignee": "john_dev",
    "labels": ["bug", "mobile", "authentication"],
    "affected_versions": ["v2.1.0", "v2.1.1"],
    "target_fix_version": "v2.1.2",
    "regression": false,
    "affected_users": 1500
  },
  "description": {
    "summary": "Login button doesn't respond when tapped on mobile Safari",
    "observed_behavior": "Button tap has no visible effect",
    "expected_behavior": "Should show loading and proceed to dashboard"
  },
  "reproduction": {
    "steps": [
      "Open login page on iPhone",
      "Enter valid credentials",
      "Tap login button",
      "Observe no response"
    ],
    "automated_reproduction": {
      "status": "reproduced"
    }
  },
  "environment": {
    "os": "iOS 17.2",
    "browser": "Safari 17.2",
    "app_version": "v2.1.0"
  },
  "error_analysis": {
    "error_type": "TypeError",
    "error_message": "Cannot read property 'submit' of null",
    "stack_trace": [
      {
        "frame_number": 0,
        "file": "login.js",
        "line": 45,
        "function": "handleLoginClick"
      }
    ],
    "likely_cause": "Form element not found in DOM"
  },
  "investigation": {
    "status": "diagnosed",
    "root_cause": {
      "description": "Form ID changed from 'loginForm' to 'login-form' in v2.1.0",
      "responsible_commit": "abc123"
    }
  },
  "fix": {
    "status": "implemented",
    "verification": {
      "status": "verified"
    }
  },
  "detective_state": {
    "current_phase": "regression_test",
    "phases_completed": ["reproduce", "investigate", "diagnose", "fix", "verify"]
  }
}
```
