# BUG-456 - Login button not responding

**Status**: In Progress
**Priority**: Urgent
**Created**: 2026-01-20
**Updated**: 2026-01-21
**Assignee**: John Developer
**Reporter**: Jane User
**Labels**: bug, mobile, authentication
**Cycle**: Sprint 24

## Problem
Login button doesn't work on mobile Safari. Users are unable to authenticate on iOS devices.

## Impact
1,500 mobile users cannot log in, representing approximately 30% of our mobile user base.

## Environment
- iOS 17.2 / Safari 17.2
- App v2.1.0

## Reproduction Steps
1. Open login page on iPhone
2. Enter valid credentials
3. Tap login button
4. Button does not respond - no visual feedback, no network request

## Expected vs Actual
Expected: Form submits, loading indicator appears, user is authenticated
Actual: No response, button appears unresponsive, no console errors visible to user

## Stack Trace
```js
TypeError: Cannot read property 'submit' of null
    at handleLoginClick (login.js:45:12)
    at HTMLButtonElement.<anonymous> (login.js:38:5)
    at EventTarget.dispatchEvent (events.js:123:10)
```

## Attachments
- screenshot_bug.png
- console_log.txt
- network_trace.har
