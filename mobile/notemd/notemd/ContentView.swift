//
//  ContentView.swift
//  notemd
//
//  Root: gate on auth, then Home / Tasks / Notes tabs.
//

import SwiftUI

enum AppTab: Hashable { case home, tracker, notes }

struct ContentView: View {
    @State private var auth = AuthStore()
    @State private var store = TrackerStore()
    @State private var tab: AppTab = .home

    var body: some View {
        Group {
            if auth.signedIn {
                TabView(selection: $tab) {
                    HomeView(onGoToTracker: { tab = .tracker },
                             onGoToNotes: { tab = .notes })
                        .tabItem { Label("Home", systemImage: "house") }
                        .tag(AppTab.home)
                    TrackerView()
                        .tabItem { Label("Tasks", systemImage: "checklist") }
                        .tag(AppTab.tracker)
                    NotesView()
                        .tabItem { Label("Notes", systemImage: "book.closed") }
                        .tag(AppTab.notes)
                }
                .tint(Theme.accent)
                .environment(store)
                .environment(auth)
                // Kick off the initial fetch here, not in a tab: the app opens
                // on Home, which would otherwise sit empty until a refresh.
                .task { if store.loading { await store.load() } }
            } else {
                AuthView().environment(auth)
            }
        }
        .animation(.default, value: auth.signedIn)
    }
}

#Preview {
    ContentView()
}
