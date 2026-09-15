//
//  TodayWidget.swift
//  TodayWidget (extension)
//
//  Minimal "Today's Tasks" widget. Reads the snapshot the app wrote into the
//  App Group (TodaySharedStore) and lists up to 3 tasks, not-completed first.
//
//  This file belongs ONLY to the TodayWidget target. TodayShared.swift must be
//  shared with BOTH targets (see its header note).
//

import WidgetKit
import SwiftUI

struct TodayEntry: TimelineEntry {
    let date: Date
    let tasks: [TodayWidgetTask]
}

struct TodayProvider: TimelineProvider {
    func placeholder(in context: Context) -> TodayEntry {
        TodayEntry(date: Date(), tasks: [
            TodayWidgetTask(id: "1", title: "Write standup notes", done: false),
            TodayWidgetTask(id: "2", title: "Review pull request", done: false),
            TodayWidgetTask(id: "3", title: "Plan the week", done: true),
        ])
    }

    func getSnapshot(in context: Context, completion: @escaping (TodayEntry) -> Void) {
        completion(TodayEntry(date: Date(), tasks: TodaySharedStore.load()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<TodayEntry>) -> Void) {
        let entry = TodayEntry(date: Date(), tasks: TodaySharedStore.load())
        // The app reloads us on every change; this hourly refresh is just a
        // fallback so "today" rolls over even if the app never opens.
        let next = Calendar.current.date(byAdding: .hour, value: 1, to: Date()) ?? Date().addingTimeInterval(3600)
        completion(Timeline(entries: [entry], policy: .after(next)))
    }
}

struct TodayWidgetEntryView: View {
    @Environment(\.widgetFamily) private var family
    var entry: TodayEntry

    private let accent = Color(red: 0x51/255, green: 0x67/255, blue: 0xF4/255)
    private let rowHeight: CGFloat = 25
    private let headerHeight: CGFloat = 26

    var body: some View {
        switch family {
        case .accessoryInline:      inlineView
        case .accessoryCircular:    circularView
        case .accessoryRectangular: rectangularView
        default:                    homeView
        }
    }

    // MARK: - Home screen (system small/medium)

    private var homeView: some View {
        let total = entry.tasks.count
        let open = entry.tasks.filter { !$0.done }.count

        return VStack(alignment: .leading, spacing: 7) {
            HStack(spacing: 5) {
                DoodleHeart(size: 18, color: accent)
                Text("your day.").font(.headline)
                Spacer()
                if total > 0 {
                    if open == 0 {
                        Image(systemName: "checkmark.circle.fill").font(.caption2).foregroundStyle(accent)
                        Text("and thats a wrap.!").font(.caption2).foregroundStyle(.secondary)
                    } else {
                        Text("\(open) of \(total) left").font(.caption2).foregroundStyle(.secondary)
                    }
                }
            }

            if total == 0 {
                VStack(spacing: 6) {
                    Spacer(minLength: 0)
                    DoodleSun(size: family == .systemSmall ? 38 : 46, color: .secondary)
                    Text("day is all yours.!").font(.subheadline).foregroundStyle(.secondary)
                    Spacer(minLength: 0)
                }
                .frame(maxWidth: .infinity)
            } else {
                // Fill as many rows as the current widget size allows. Completed
                // tasks still show (struck through) so the widget stays full.
                GeometryReader { geo in
                    let maxRows = max(1, Int((geo.size.height - headerHeight + 7) / rowHeight))
                    let items = TodaySharedStore.ordered(entry.tasks, limit: maxRows)
                    let more = total - items.count
                    VStack(alignment: .leading, spacing: 0) {
                        ForEach(items) { task in
                            HStack(spacing: 7) {
                                Image(systemName: task.done ? "checkmark.circle.fill" : "circle")
                                    .font(.caption)
                                    .foregroundStyle(task.done ? accent : .secondary)
                                Text(task.title)
                                    .font(.subheadline)
                                    .strikethrough(task.done)
                                    .foregroundStyle(task.done ? .secondary : .primary)
                                    .lineLimit(1)
                            }
                            .frame(height: rowHeight, alignment: .leading)
                        }
                        if more > 0 {
                            Text("+\(more) more").font(.caption2).foregroundStyle(.tertiary)
                        }
                    }
                }
            }
        }
    }

    // MARK: - Lock screen (accessory families)

    private var openCount: Int { entry.tasks.filter { !$0.done }.count }
    private var doneCount: Int { entry.tasks.filter { $0.done }.count }

    // Single line: e.g. "✓ 3 tasks left"
    private var inlineView: some View {
        let total = entry.tasks.count
        let label = total == 0 ? "day is all yours.!"
                  : openCount == 0 ? "and thats a wrap.!"
                  : "\(openCount) task\(openCount == 1 ? "" : "s") left"
        return Label(label, systemImage: openCount == 0 ? "checkmark.circle" : "checklist")
    }

    // Circular ring showing completed / total, open count in the middle.
    private var circularView: some View {
        let total = entry.tasks.count
        return Gauge(value: Double(doneCount), in: 0...Double(max(total, 1))) {
            Image(systemName: "checklist")
        } currentValueLabel: {
            if total == 0 {
                Image(systemName: "tray")
            } else if openCount == 0 {
                Image(systemName: "checkmark")
            } else {
                Text("\(openCount)")
            }
        }
        .gaugeStyle(.accessoryCircularCapacity)
        .widgetAccentable()
    }

    // Just the tasks as a checklist — no heading.
    private var rectangularView: some View {
        let total = entry.tasks.count
        return VStack(alignment: .leading, spacing: 3) {
            if total == 0 {
                Text("No tasks").font(.footnote).foregroundStyle(.secondary)
            } else {
                ForEach(TodaySharedStore.ordered(entry.tasks, limit: 3)) { task in
                    HStack(spacing: 5) {
                        Image(systemName: task.done ? "checkmark.circle.fill" : "circle")
                            .font(.system(size: 10))
                        Text(task.title)
                            .font(.footnote)
                            .strikethrough(task.done)
                            .lineLimit(1)
                    }
                    .widgetAccentable()
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}

struct TodayTasksWidget: Widget {
    let kind = "TodayTasksWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: TodayProvider()) { entry in
            TodayWidgetEntryView(entry: entry)
                .widgetBackground()
        }
        .configurationDisplayName("Today's Tasks")
        .description("Your tasks for today.")
        .supportedFamilies([
            .systemSmall, .systemMedium,
            .accessoryInline, .accessoryCircular, .accessoryRectangular,
        ])
    }
}

private extension View {
    /// iOS 17+ requires a container background. Home-screen widgets get the
    /// system background; Lock Screen (accessory) widgets stay transparent so
    /// the system applies its vibrant treatment.
    @ViewBuilder func widgetBackground() -> some View {
        if #available(iOS 17.0, *) {
            self.containerBackground(.background, for: .widget)
        } else {
            self.padding()
        }
    }
}
