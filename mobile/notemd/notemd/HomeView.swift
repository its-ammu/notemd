//
//  HomeView.swift
//  notemd
//
//  Home tab — port of HomePane.jsx: rotating greeting, next-meeting card,
//  today's meetings + tasks, recent pages, quick add, mini week + stats.
//  The profile/settings menu lives here (moved off the tracker's top bar).
//

import SwiftUI
import Combine

struct HomeView: View {
    @Environment(TrackerStore.self) private var store
    @Environment(AuthStore.self) private var auth

    var onGoToTracker: () -> Void = {}
    var onGoToNotes: () -> Void = {}

    @State private var showingSettings = false
    @State private var openPage: (nbId: String, pageId: String)?
    // Re-render every minute so the next-meeting countdown stays honest.
    @State private var now = Date()
    private let ticker = Timer.publish(every: 60, on: .main, in: .common).autoconnect()

    private var today: Date { DateUtils.startOfDay(now) }
    private var todayKey: String { DateUtils.key(today) }

    var body: some View {
        NavigationStack {
            Group {
                if store.loading {
                    ProgressView("Loading…")
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    ScrollView {
                        VStack(alignment: .leading, spacing: 16) {
                            greetingHeader
                            nextMeetingCard
                            todayCard
                            recentPagesCard
                            weekCard
                        }
                        .padding()
                    }
                }
            }
            .background(Theme.canvas.ignoresSafeArea())
            .toolbar { profileMenu }
            .navigationBarTitleDisplayMode(.inline)
            .refreshable { await store.load(showSpinner: false) }
            .navigationDestination(item: Binding(
                get: { openPage.map { PageDest(nbId: $0.nbId, pageId: $0.pageId) } },
                set: { if $0 == nil { openPage = nil } }
            )) { dest in
                PageView(notebookId: dest.nbId, pageId: dest.pageId)
            }
        }
        .tint(Theme.accent)
        .onReceive(ticker) { now = $0 }
        // Recover the nickname if the sign-in-time fetch was lost (e.g. to a
        // transient network error) — otherwise the email fallback sticks.
        .task { if auth.displayName.isEmpty { await auth.loadProfile() } }
        .sheet(isPresented: $showingSettings) { SettingsView() }
    }

    // MARK: - Greeting (HomePane.jsx GREETINGS)

    private static let greetings: [String: [String]] = [
        "smallHours": ["Still awake?", "The moon says hi", "Up before the birds?",
                       "Shouldn\u{2019}t you be dreaming?"],
        "morning": ["Rise and scribble", "Good morning", "Top of the morning",
                    "A fresh page awaits", "Ready to conquer the day?"],
        "afternoon": ["Good afternoon", "Still crushing it?",
                      "Hope the day\u{2019}s treating you well", "Back at it?",
                      "Onward and upward"],
        "evening": ["Good evening", "Home stretch now", "How was the day?", "Evening plans?"],
        "night": ["Burning the midnight oil?", "One last scribble?",
                  "Don\u{2019}t stay up too late", "Time to wrap it up?"],
    ]
    private static let clearQuips = [
        "The calendar bows to you.",
        "All quiet on the calendar front.",
        "Nothing booked. Suspicious… but nice.",
    ]

    private var dayOfYear: Int {
        Calendar.current.ordinality(of: .day, in: .year, for: now) ?? 1
    }

    /// The profile nickname (profiles.display_name), like the web. Falls back
    /// to a name derived from the email local part while the profile loads.
    private var displayName: String {
        let name = auth.displayName.trimmingCharacters(in: .whitespaces)
        if !name.isEmpty { return name }
        let local = auth.email.split(separator: "@").first.map(String.init) ?? ""
        let first = local.split(whereSeparator: { ".-_+0123456789".contains($0) }).first
        guard let first, !first.isEmpty else { return "" }
        return first.prefix(1).uppercased() + first.dropFirst()
    }

    private var greetingLine: String {
        let h = Calendar.current.component(.hour, from: now)
        let bucket = h < 5 ? "smallHours" : h < 12 ? "morning"
                   : h < 18 ? "afternoon" : h < 22 ? "evening" : "night"
        let pool = Self.greetings[bucket]!
        let line = pool[dayOfYear % pool.count]
        let name = displayName
        guard !name.isEmpty else { return line }
        // Tuck the name in before trailing punctuation: "Still awake, Sam?"
        if let idx = line.lastIndex(where: { !"?!…".contains($0) }) {
            let head = line[...idx], tail = line[line.index(after: idx)...]
            return "\(head), \(name)\(tail)"
        }
        return "\(line), \(name)"
    }

    private var greetingHeader: some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(greetingLine)
                .font(.title.weight(.bold))
                .foregroundStyle(Theme.inkStrong)
            DoodleSquiggle(width: 110)
            Text(today.formatted(.dateTime.weekday(.wide).month(.wide).day()))
                .font(.subheadline).foregroundStyle(Theme.inkMuted)
                .padding(.top, 2)
        }
        .padding(.top, 4)
    }

    // MARK: - Next meeting

    private struct NextMeeting {
        let meeting: Meeting
        let minsUntil: Int
        let inProgress: Bool
    }

    private var nextMeeting: NextMeeting? {
        let nowMins = Calendar.current.component(.hour, from: now) * 60
                    + Calendar.current.component(.minute, from: now)
        let upcoming = store.meetings(on: today)
            .compactMap { m -> (Meeting, Int, Int)? in
                let parts = m.time.split(separator: ":").compactMap { Int($0) }
                guard parts.count == 2 else { return nil }
                let start = parts[0] * 60 + parts[1]
                return (m, start, start + m.duration)
            }
            .filter { $0.2 > nowMins }
            .sorted { $0.1 < $1.1 }
        guard let (m, start, _) = upcoming.first else { return nil }
        return NextMeeting(meeting: m, minsUntil: start - nowMins, inProgress: start <= nowMins)
    }

    private func countdown(_ mins: Int) -> String {
        if mins <= 0 { return "now" }
        if mins < 60 { return "\(mins)m" }
        let h = mins / 60, m = mins % 60
        return m == 0 ? "\(h)h" : "\(h)h \(m)m"
    }

    @ViewBuilder
    private var nextMeetingCard: some View {
        if let next = nextMeeting, next.inProgress || next.minsUntil <= 240 {
            HStack(spacing: 12) {
                DoodleClock(size: 44, color: Theme.ink)
                VStack(alignment: .leading, spacing: 2) {
                    Text(next.inProgress ? "happening right now" : "up next on the docket")
                        .font(.caption).foregroundStyle(Theme.inkMuted)
                    HStack(spacing: 6) {
                        Text(next.meeting.title.isEmpty ? "Untitled meeting" : next.meeting.title)
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(Theme.inkStrong)
                        if !next.inProgress {
                            Text("in \(countdown(next.minsUntil))")
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(Theme.accent)
                        }
                    }
                }
                Spacer()
            }
            .padding(14)
            .paperSheet()
        } else {
            HStack(spacing: 12) {
                DoodleMug(size: 44, color: Theme.ink)
                VStack(alignment: .leading, spacing: 2) {
                    Text(Self.clearQuips[dayOfYear % Self.clearQuips.count])
                        .font(.caption).foregroundStyle(Theme.inkMuted)
                    Text("No meetings soon ~ yayy.")
                        .font(.subheadline.weight(.medium)).foregroundStyle(Theme.ink)
                }
                Spacer()
            }
            .padding(14)
            .paperSheet()
        }
    }

    // MARK: - Today

    private var todayCard: some View {
        let tasks = store.tasksByDate[todayKey] ?? []
        let meetings = store.meetings(on: today)
        return VStack(alignment: .leading, spacing: 10) {
            cardHeader("Today", linkLabel: "Open tracker", action: onGoToTracker)

            if meetings.isEmpty && tasks.isEmpty {
                HStack(spacing: 12) {
                    DoodleCheck(size: 40, color: Theme.inkMuted)
                    Text("A blank slate. Add tasks from the tracker.")
                        .font(.subheadline).foregroundStyle(Theme.inkSubtle)
                }
                .padding(.vertical, 8)
            }

            ForEach(meetings) { m in
                HStack(spacing: 8) {
                    Text(m.time.isEmpty ? "—" : m.time)
                        .font(.caption.monospacedDigit().weight(.medium))
                        .foregroundStyle(Theme.accent)
                        .frame(width: 44, alignment: .leading)
                    Text(m.title.isEmpty ? "Untitled meeting" : m.title)
                        .font(.subheadline).foregroundStyle(Theme.inkStrong)
                        .lineLimit(1)
                    Spacer()
                    Text("\(m.duration)m").font(.caption2).foregroundStyle(Theme.inkMuted)
                }
                .padding(.vertical, 2)
            }

            if !meetings.isEmpty && !tasks.isEmpty {
                Divider().overlay(Theme.border)
            }

            ForEach(tasks) { task in
                HStack(spacing: 10) {
                    CheckCircle(done: task.done) {
                        store.updateTask(todayKey, id: task.id) { $0.done.toggle() }
                    }
                    Text(task.title.isEmpty ? "Untitled" : task.title)
                        .font(.subheadline)
                        .strikethrough(task.done)
                        .foregroundStyle(task.done ? Theme.inkSubtle : Theme.inkStrong)
                        .lineLimit(1)
                    Spacer()
                    if task.priority != .none && !task.done {
                        Circle().fill(Theme.priorityColor(task.priority))
                            .frame(width: 7, height: 7)
                    }
                }
                .padding(.vertical, 2)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .paperSheet()
    }

    // MARK: - Recent pages

    private var recentPagesCard: some View {
        let recents = store.recentPages()
        return VStack(alignment: .leading, spacing: 10) {
            cardHeader("Recent pages", linkLabel: "All notebooks", action: onGoToNotes)
            if recents.isEmpty {
                HStack(spacing: 12) {
                    DoodlePage(size: 40, color: Theme.inkMuted)
                    Text("No pages yet — your notebooks await.")
                        .font(.subheadline).foregroundStyle(Theme.inkSubtle)
                }
                .padding(.vertical, 8)
            }
            ForEach(recents, id: \.page.id) { item in
                Button { openPage = (item.notebook.id, item.page.id) } label: {
                    HStack(spacing: 10) {
                        Circle().fill(Color(hexString: item.notebook.color))
                            .frame(width: 8, height: 8)
                        VStack(alignment: .leading, spacing: 1) {
                            Text(item.page.title.isEmpty ? "Untitled" : item.page.title)
                                .font(.subheadline.weight(.medium))
                                .foregroundStyle(Theme.inkStrong)
                                .lineLimit(1)
                            Text("\(item.notebook.name) · \(DateUtils.relTime(item.page.updated))")
                                .font(.caption2).foregroundStyle(Theme.inkMuted)
                        }
                        Spacer()
                        Image(systemName: "chevron.right")
                            .font(.caption2.weight(.semibold)).foregroundStyle(Theme.inkSubtle)
                    }
                    .padding(.vertical, 4)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .paperSheet()
    }

    // MARK: - This week

    private var weekCard: some View {
        let weekStart = DateUtils.startOfWeek(today)
        let days = (0..<7).map { DateUtils.addDays(weekStart, $0) }
        let flat = days.flatMap { store.tasks(on: $0) }
        let done = flat.filter(\.done).count
        let highOpen = flat.filter { !$0.done && $0.priority == .high }.count
        let meetings = days.reduce(0) { $0 + store.meetings(on: $1).count }

        return VStack(alignment: .leading, spacing: 12) {
            cardHeader("This week")

            HStack(spacing: 6) {
                ForEach(days, id: \.self) { d in
                    let key = DateUtils.key(d)
                    let isToday = key == todayKey
                    let hasTasks = !(store.tasksByDate[key] ?? []).isEmpty
                    let hasMeetings = !store.meetings(on: d).isEmpty
                    Button(action: onGoToTracker) {
                        VStack(spacing: 3) {
                            Text(d.formatted(.dateTime.weekday(.narrow)))
                                .font(.caption2).foregroundStyle(Theme.inkMuted)
                            Text(d.formatted(.dateTime.day()))
                                .font(.footnote.weight(isToday ? .bold : .medium))
                                .foregroundStyle(isToday ? .white : Theme.inkStrong)
                                .frame(width: 26, height: 26)
                                .background(isToday ? Theme.accent : .clear, in: Circle())
                            HStack(spacing: 2) {
                                if hasTasks { Circle().fill(Theme.inkMuted).frame(width: 3, height: 3) }
                                if hasMeetings { Circle().fill(Theme.accent).frame(width: 3, height: 3) }
                            }
                            .frame(height: 4)
                        }
                        .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.plain)
                }
            }

            HStack(spacing: 0) {
                stat("\(done)/\(flat.count)", label: "Tasks done")
                stat("\(highOpen)", label: "High open")
                stat("\(meetings)", label: "Meetings")
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .paperSheet()
    }

    private func stat(_ value: String, label: String) -> some View {
        VStack(spacing: 2) {
            Text(value).font(.headline.monospacedDigit()).foregroundStyle(Theme.inkStrong)
            Text(label).font(.caption2).foregroundStyle(Theme.inkMuted)
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - Bits

    private func cardHeader(_ title: String, linkLabel: String? = nil,
                            action: @escaping () -> Void = {}) -> some View {
        HStack {
            Text(title.uppercased())
                .font(.caption2.weight(.semibold)).tracking(0.6)
                .foregroundStyle(Theme.inkMuted)
            Spacer()
            if let linkLabel {
                Button(action: action) {
                    HStack(spacing: 2) {
                        Text(linkLabel)
                        Image(systemName: "arrow.right").font(.system(size: 9, weight: .semibold))
                    }
                    .font(.caption.weight(.medium))
                    .foregroundStyle(Theme.accent)
                }
                .buttonStyle(.plain)
            }
        }
    }

    @ToolbarContentBuilder
    private var profileMenu: some ToolbarContent {
        ToolbarItem(placement: .topBarTrailing) {
            Menu {
                if !auth.email.isEmpty {
                    Section(auth.email) { EmptyView() }
                }
                Button { showingSettings = true } label: {
                    Label("Settings", systemImage: "gearshape")
                }
                Button(role: .destructive) {
                    Task { await auth.signOut() }
                } label: { Label("Sign Out", systemImage: "rectangle.portrait.and.arrow.right") }
            } label: {
                Text(auth.initials.isEmpty ? "?" : auth.initials)
                    .font(.caption.weight(.bold))
                    .foregroundStyle(.white)
                    .frame(width: 30, height: 30)
                    .background(Theme.accent, in: Circle())
            }
            .menuStyle(.button)
            .buttonStyle(.plain)
        }
    }
}

private struct PageDest: Identifiable, Hashable {
    let nbId: String
    let pageId: String
    var id: String { pageId }
}
