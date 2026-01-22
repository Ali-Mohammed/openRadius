# Relative Date Filters

## Overview
The filter query builder now supports relative date values, allowing you to create dynamic filters that automatically adjust based on the current date and time. This is particularly useful for tag sync rules that need to automatically identify expired users, recent signups, or other time-based conditions.

## Supported Relative Dates

### Current Time
- `now` - Current date and time
- `today` - Start of today (00:00:00)

### Past Dates
- `yesterday` - Start of yesterday
- `7_days_ago` - 7 days before now
- `30_days_ago` - 30 days before now
- `90_days_ago` - 90 days before now
- `1_year_ago` - 1 year before now

### Future Dates
- `tomorrow` - Start of tomorrow
- `7_days_from_now` - 7 days from now
- `30_days_from_now` - 30 days from now
- `90_days_from_now` - 90 days from now
- `1_year_from_now` - 1 year from now

### Month/Year Boundaries
- `start_of_month` - First day of current month (00:00:00)
- `end_of_month` - Last day of current month (23:59:59)
- `start_of_year` - January 1st of current year (00:00:00)
- `end_of_year` - December 31st of current year (23:59:59)

## Usage Examples

### Tag Sync Rules

#### Expired Users
Create a tag sync rule that automatically tags users whose expiration date has passed:
```
Tag: "Expired"
Filter: expiration_date < now
```

#### Active Users
Tag users who are still active:
```
Tag: "Active"
Filter: expiration_date >= now
```

#### Recent Signups
Tag users created in the last 7 days:
```
Tag: "New User"
Filter: created_at >= 7_days_ago
```

#### Expiring Soon
Tag users whose expiration is within the next 30 days:
```
Tag: "Expiring Soon"
Filter: expiration_date >= now AND expiration_date <= 30_days_from_now
```

#### Long-term Users
Tag users created over a year ago:
```
Tag: "Veteran"
Filter: created_at <= 1_year_ago
```

#### Monthly Active
Tag users who logged in this month:
```
Tag: "Active This Month"
Filter: last_online >= start_of_month
```

### RADIUS Users Filter

You can use the same relative date values when filtering the RADIUS users table:

#### Find Expired Users
```
Filter: expiration_date < now
```

#### Find Users Created This Week
```
Filter: created_at >= 7_days_ago
```

#### Find Inactive Users
```
Filter: last_online < 30_days_ago
```

## How It Works

### Frontend
The QueryBuilder component displays relative date options in a dropdown when you're entering a date value. You can either:
1. Select a relative date from the suggestions
2. Type the relative date value directly
3. Use the date picker to select an absolute date

### Backend
Both RadiusUserController and RadiusTagSyncService have a `ParseRelativeDate` method that:
1. First attempts to parse the value as an absolute date (e.g., "2024-01-15")
2. If that fails, checks if it matches a relative date keyword
3. Calculates the actual DateTime value based on the current time
4. Returns null if the value is not recognized

### Dynamic Evaluation
Relative dates are evaluated **at query execution time**, not when the rule is saved. This means:
- A rule with `expiration_date < now` will always use the current date when syncing
- You don't need to update your tag sync rules daily
- The same rule works indefinitely without maintenance

## Benefits

1. **No Manual Updates**: Rules automatically adjust based on current date
2. **Consistent Logic**: Same relative date keywords work across all date filters
3. **User-Friendly**: Dropdown suggestions make it easy to discover available options
4. **Flexible**: Combine relative and absolute dates in the same filter group
5. **Maintainable**: Tag sync rules don't require regular updates

## Technical Details

### Date Comparison Operators
When using relative dates, you can use these operators:
- `<` (before)
- `>` (after)
- `<=` (on or before)
- `>=` (on or after)
- `=` (equals)
- `!=` (not equals)
- `between` (requires two date values)

### Time Precision
- `now` includes the current time (hours, minutes, seconds)
- `today`, `yesterday`, `tomorrow` use midnight (00:00:00)
- Past/future day offsets (e.g., `7_days_ago`) preserve the current time
- Month/year boundaries use specific times (start = 00:00:00, end = 23:59:59)

### Timezone Handling
All relative dates are calculated in UTC to ensure consistency across different server locations.

## Testing

To test relative date filters:

1. Create a tag sync rule with a relative date filter (e.g., `expiration_date < now`)
2. Click "Sync Tags Now" in Settings → General → Tag Sync Rules
3. Verify that the correct users are tagged based on the current date
4. Check the RADIUS Users table to see the tags applied

Example test scenarios:
```
# Test 1: Expired users
Create users with expiration dates in the past
Rule: expiration_date < now
Expected: Users get "Expired" tag

# Test 2: Recent signups
Create users today
Rule: created_at >= today
Expected: Users get "New User" tag

# Test 3: Expiring soon
Create users expiring in 2 weeks
Rule: expiration_date >= now AND expiration_date <= 30_days_from_now
Expected: Users get "Expiring Soon" tag
```
