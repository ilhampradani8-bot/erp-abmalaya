# Bug: Application crashes when processing large datasets

**Labels**: bug, critical, data-processing
**Assignee**: @senior_dev
**Milestone**: Hotfix
**Opened by**: @ops_team on 2026-01-21

## Description
The application crashes with OutOfMemoryError when processing datasets larger than 500MB. This is affecting production systems and causing complete service outages.

## Steps to Reproduce
1. Log into the admin dashboard
2. Navigate to Data Processing > Import
3. Upload a CSV file larger than 500MB
4. Click "Process Data"
5. Application crashes within 30 seconds

## Expected Behavior
Large datasets should be processed in chunks, with progress indicator showing completion percentage.

## Actual Behavior
Application consumes all available memory and crashes. Server requires manual restart. All in-progress user sessions are terminated.

## Environment
- **Server**: Production (prod-server-01)
- **OS**: Ubuntu 22.04
- **Java**: OpenJDK 17
- **App Version**: 3.2.1
- **Memory**: 16GB allocated to JVM

## Error Logs
```java
Exception in thread "main" java.lang.OutOfMemoryError: Java heap space
    at java.util.Arrays.copyOf(Arrays.java:3236)
    at java.util.ArrayList.grow(ArrayList.java:265)
    at java.util.ArrayList.ensureExplicitCapacity(ArrayList.java:239)
    at java.util.ArrayList.ensureCapacityInternal(ArrayList.java:231)
    at java.util.ArrayList.add(ArrayList.java:462)
    at com.example.DataProcessor.loadAllRecords(DataProcessor.java:156)
    at com.example.ImportController.processFile(ImportController.java:89)
    at com.example.AdminController.handleImport(AdminController.java:234)
```

## Additional Context
- Issue started after upgrade to version 3.2.1
- Previous version (3.2.0) handled large files correctly
- Affects all production servers
- Temporary workaround: Split files into chunks < 100MB manually
- This is blocking critical daily data imports for 50+ enterprise customers

## Severity Assessment
**Severity**: Critical
**Priority**: Urgent
**Impact**: Complete service failure, data imports blocked, customer operations impacted

## Related Issues
- Regression from fix in #892
- Related to memory optimization work in #867
