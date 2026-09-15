//
//  DateUtils.swift
//  notemd
//
//  Week math, byte-for-byte equal to app/src/utils/time.js. Weeks are
//  Monday-based; day keys are "YYYY-MM-DD" in LOCAL time (never UTC) so a task
//  lands on the same calendar day the user picked.
//

import Foundation

enum DateUtils {
    private static var cal: Calendar {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = .current
        return c
    }

    /// "YYYY-MM-DD" in local time (matches fmtDate).
    static func key(_ date: Date) -> String {
        let c = cal.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", c.year!, c.month!, c.day!)
    }

    /// Parse a "YYYY-MM-DD" key back to local midnight.
    static func date(fromKey key: String) -> Date {
        let parts = key.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return startOfDay(Date()) }
        var c = DateComponents()
        c.year = parts[0]; c.month = parts[1]; c.day = parts[2]
        return cal.date(from: c) ?? startOfDay(Date())
    }

    static func startOfDay(_ date: Date) -> Date {
        cal.startOfDay(for: date)
    }

    /// Monday-based start of week (time.js: diff = day==0 ? -6 : 1-day).
    static func startOfWeek(_ date: Date) -> Date {
        let d = startOfDay(date)
        // Swift weekday: 1=Sun ... 7=Sat. JS getDay: 0=Sun ... 6=Sat.
        let jsDay = cal.component(.weekday, from: d) - 1
        let diff = (jsDay == 0) ? -6 : (1 - jsDay)
        return cal.date(byAdding: .day, value: diff, to: d)!
    }

    static func addDays(_ date: Date, _ n: Int) -> Date {
        cal.date(byAdding: .day, value: n, to: date)!
    }

    /// JS getDay equivalent: 0=Sun ... 6=Sat.
    static func jsWeekday(_ date: Date) -> Int {
        cal.component(.weekday, from: date) - 1
    }

    /// Whole days between two local midnights (round, like time.js diffDays).
    static func dayDiff(_ from: Date, _ to: Date) -> Int {
        let secs = startOfDay(to).timeIntervalSince(startOfDay(from))
        return Int((secs / 86400).rounded())
    }

    static func weekRangeLabel(_ start: Date) -> String {
        let end = addDays(start, 6)
        let f1 = DateFormatter(); f1.dateFormat = "MMM d"
        let f2 = DateFormatter(); f2.dateFormat = "MMM d, yyyy"
        return "\(f1.string(from: start)) – \(f2.string(from: end))"
    }

    static func dayLabel(_ date: Date) -> String {
        let f = DateFormatter(); f.dateFormat = "EEEE, MMM d"
        return f.string(from: date)
    }

    /// "just now" / "5m ago" / "3h ago" / "2d ago" / "Mar 4" (time.js relTime).
    static func relTime(_ ms: Double) -> String {
        guard ms > 0 else { return "" }
        let secs = Date().timeIntervalSince1970 - ms / 1000
        if secs < 60 { return "just now" }
        if secs < 3600 { return "\(Int(secs / 60))m ago" }
        if secs < 86400 { return "\(Int(secs / 3600))h ago" }
        if secs < 86400 * 7 { return "\(Int(secs / 86400))d ago" }
        let f = DateFormatter(); f.dateFormat = "MMM d"
        return f.string(from: Date(timeIntervalSince1970: ms / 1000))
    }
}
