# Severity Classification Guide

This document describes how bugs are classified by severity and priority.

## Severity Levels

### Critical
**Definition**: Complete failure of core functionality, data loss, or security vulnerability.

**Characteristics**:
- System crashes or becomes unusable
- Data loss or corruption
- Security vulnerabilities
- Production outage
- No workaround available

**Response Time**: Immediate (drop everything)

**Examples**:
- Application crashes on startup
- User data being deleted incorrectly
- Authentication bypass vulnerability
- Payment processing failures
- Database corruption

**Keywords Detected**:
- crash, data loss, data corruption
- security vulnerability, security breach
- authentication bypass, sql injection, xss
- remote code execution, privilege escalation
- production down, service outage

### High
**Definition**: Major feature broken with significant user impact.

**Characteristics**:
- Core feature not working
- Significant number of users affected
- Workaround may exist but is difficult
- Business operations impacted

**Response Time**: < 4 hours

**Examples**:
- Login not working for subset of users
- Checkout flow broken
- Key API endpoint returning errors
- Data displaying incorrectly
- Performance severely degraded

**Keywords Detected**:
- broken, fails, cannot, unable
- blocked, prevents, not working
- stops working, feature broken
- regression, lost data
- 500 error, server error, timeout

### Medium
**Definition**: Feature degraded but usable, workaround exists.

**Characteristics**:
- Feature works but with issues
- Workaround available
- Limited user impact
- Not blocking critical workflows

**Response Time**: < 24 hours

**Examples**:
- Slow page load times
- UI element misaligned
- Sorting not working correctly
- Export produces incorrect format
- Intermittent errors

**Keywords Detected**:
- slow, degraded, workaround
- inconsistent, sometimes, intermittent
- occasionally, partial
- incorrect display, wrong format
- ui issue, layout broken

### Low
**Definition**: Minor issue with minimal impact.

**Characteristics**:
- Cosmetic issues
- Edge case scenarios
- Rarely encountered
- Easy workaround

**Response Time**: Next sprint

**Examples**:
- Minor styling issues
- Typos in UI
- Tooltip not appearing
- Edge case validation missing
- Minor inconsistencies

**Keywords Detected**:
- minor, cosmetic, typo
- spelling, alignment
- color, font, padding
- margin, spacing

### Trivial
**Definition**: Very minor issues, polish items.

**Characteristics**:
- Extremely minor
- Enhancement requests disguised as bugs
- No functional impact
- Nice-to-have fixes

**Response Time**: Backlog (when time permits)

**Examples**:
- Pixel-perfect alignment issues
- Placeholder text improvements
- Minor wording changes
- Color shade preferences

**Keywords Detected**:
- enhancement, improvement
- nice to have, polish
- would be nice

## Priority Levels

Priority is derived from severity but can be adjusted based on business context.

| Priority | Description | Typical Severity |
|----------|-------------|------------------|
| Urgent | Must fix immediately | Critical |
| High | Next available slot | Critical, High |
| Normal | Within current sprint | Medium |
| Low | Backlog | Low, Trivial |

## Factors That Increase Severity

1. **Regression** - Bug from fix that broke working feature (+1 level)
2. **Affected Users** - High number of affected users (+1 level)
3. **Business Impact** - Revenue or reputation impact (+1 level)
4. **Security** - Any security implication → Critical
5. **Data** - Any data loss or corruption → Critical

## Factors That Decrease Severity

1. **Easy Workaround** - Simple workaround available (-1 level)
2. **Limited Scope** - Only affects specific edge case (-1 level)
3. **Non-Production** - Only in staging/dev environment (-1 level)

## Automatic Classification

The severity analyzer examines:

1. **Keywords in Description**
   - Scans for severity-indicating words
   - Higher severity keywords take precedence

2. **Error Type Analysis**
   - OutOfMemoryError, StackOverflowError → Critical
   - NullPointerException, TypeError → High
   - ValueError, ValidationError → Medium
   - DeprecationWarning → Low

3. **Affected Users**
   - 1000+ users → High or Critical
   - 100+ users → Medium or High
   - < 100 users → Based on other factors

4. **Regression Flag**
   - Marked as regression → At least High

5. **Labels/Tags**
   - Uses labels like "critical", "high-priority"

## Example Classifications

### Example 1: Critical
```
Title: Application crashes when uploading large files
Description: When users upload files > 100MB, the entire application crashes.
All users attempting uploads are affected.
```
- Crash → Critical keyword
- All users affected → High impact
- **Severity: Critical**

### Example 2: High
```
Title: Login button not responding on mobile
Description: Tapping the login button on iOS Safari does nothing.
Affects ~30% of mobile users (1500 users).
```
- "not responding" → High keyword
- 1500 users affected → High impact
- **Severity: High**

### Example 3: Medium
```
Title: Search results sometimes show stale data
Description: Occasionally, search results don't update immediately.
Workaround: Refresh the page.
```
- "sometimes", "occasionally" → Medium keywords
- Workaround available
- **Severity: Medium**

### Example 4: Low
```
Title: Alignment issue in settings page
Description: The "Save" button is 2px off from the "Cancel" button.
```
- "alignment" → Low keyword
- Cosmetic only
- **Severity: Low**
