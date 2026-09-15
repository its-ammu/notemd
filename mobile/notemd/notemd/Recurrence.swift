//
//  Recurrence.swift
//  notemd
//
//  Port of app/src/utils/meetings.js — expands recurring meetings over a set of
//  visible days. Must match the web exactly or the same meeting renders
//  differently across devices.
//
//  Rules (repeat != .none):
//   - skip origin day, days in skipDates, and any day where dayKey >= endDate
//     (endDate is EXCLUSIVE).
//   - only future days (diffDays > 0).
//   - daily    → Mon–Fri only (jsWeekday 1...5).
//   - weekly   → same weekday as origin.
//   - biweekly → same weekday as origin AND round(diffDays/7) % 2 == 0.
//   - ghost id = "<sourceId>_<dayKey>"; carries sourceId/sourceDate + ghost flag.
//

import Foundation

enum Recurrence {
    static func expand(_ byDate: [String: [Meeting]], days: [Date]) -> [String: [Meeting]] {
        var result: [String: [Meeting]] = [:]
        let dayKeys = days.map { DateUtils.key($0) }
        for k in dayKeys { result[k] = [] }

        // Keep stored meetings on visible days, filtered by skip/end rules.
        for (dateKey, list) in byDate where result[dateKey] != nil {
            result[dateKey] = list.filter { m in
                if m.skipDates.contains(dateKey) { return false }
                if let end = m.endDate, dateKey >= end { return false }
                return true
            }
        }

        var existingIds = Set<String>()
        for list in result.values { for m in list { existingIds.insert(m.id) } }

        for (originDate, list) in byDate {
            let origin = DateUtils.date(fromKey: originDate)
            for meeting in list {
                guard meeting.repeatRule != .none else { continue }
                let skip = meeting.skipDates
                let end = meeting.endDate

                for day in days {
                    let dayKey = DateUtils.key(day)
                    if dayKey == originDate { continue }
                    if skip.contains(dayKey) { continue }
                    if let end, dayKey >= end { continue }
                    let diffDays = DateUtils.dayDiff(origin, day)
                    if diffDays <= 0 { continue }

                    let dow = DateUtils.jsWeekday(day)
                    let originDow = DateUtils.jsWeekday(origin)
                    var matches = false
                    switch meeting.repeatRule {
                    case .daily:    matches = dow >= 1 && dow <= 5
                    case .weekly:   matches = dow == originDow
                    case .biweekly: matches = dow == originDow && (Int((Double(diffDays) / 7).rounded()) % 2 == 0)
                    case .none:     matches = false
                    }
                    guard matches else { continue }

                    let ghostId = meeting.id + "_" + dayKey
                    let dup = existingIds.contains(ghostId) ||
                        (result[dayKey]?.contains { $0.sourceId == meeting.id || $0.id == ghostId } ?? false)
                    if dup { continue }

                    var ghost = meeting
                    ghost.id = ghostId
                    ghost.sourceId = meeting.id
                    ghost.sourceDate = originDate
                    ghost.isRecurringGhost = true
                    result[dayKey, default: []].append(ghost)
                }
            }
        }
        return result
    }

    /// Sorted meetings for one day (getMeetingsForDay).
    static func meetings(_ byDate: [String: [Meeting]], for day: Date) -> [Meeting] {
        let map = expand(byDate, days: [day])
        let list = map[DateUtils.key(day)] ?? []
        return list.sorted { $0.time < $1.time }
    }
}
