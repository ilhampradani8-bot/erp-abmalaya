# Bug: Login button not responding on mobile

**Labels**: bug, high-priority, mobile
**Assignee**: @john_developer
**Milestone**: v2.1.2
**Opened by**: @jane_user on 2026-01-20

## Description
The login button does not respond when tapped on mobile devices. Desktop version works fine.

## Steps to Reproduce
1. Open https://app.example.com/login on mobile device (iPhone 13, iOS 17)
2. Enter valid username: test@example.com
3. Enter valid password: ••••••••
4. Tap "Login" button
5. Observe: Nothing happens, no loading indicator, no error message

## Expected Behavior
After tapping login button, should show loading indicator and proceed to dashboard on successful authentication.

## Actual Behavior
Button tap has no visible effect. Form does not submit. No network request observed in browser DevTools.

## Environment
- **Device**: iPhone 13
- **OS**: iOS 17.2
- **Browser**: Safari 17.2
- **App Version**: 2.1.0
- **Network**: 4G LTE

## Screenshots
![Login screen with issue](./screenshots/login_bug_mobile.png)

## Error Logs
```
Console Error:
TypeError: Cannot read property 'submit' of null
    at handleLoginClick (login.js:45:12)
    at HTMLButtonElement.<anonymous> (login.js:38:5)
```

## Additional Context
- Bug does not occur on desktop browsers (Chrome, Firefox, Safari)
- Bug started occurring after deploying version 2.1.0
- Affects approximately 30% of mobile users (1,500 users)
- No recent changes to login flow that we're aware of

## Severity Assessment
**Severity**: High
**Priority**: Urgent
**Impact**: Cannot login on mobile = complete feature failure for mobile users

## Related Issues
- Similar to #234 (closed, different root cause)
- May be related to #245 (form validation on mobile)
