# AlpacaLive Sprint M — Migration UX QA Testing Guide

## Overview
This document describes manual QA scenarios for the Migration UX feature (Sprint M). Tests require browser access and should be run against the dev server (`npm run dev`).

---

## QA-M1: Toast appears after SW detects new version

**Setup:**
1. Start dev server: `npm run dev`
2. Open app in browser: `http://localhost:5173/app`
3. Open DevTools → Application tab
4. Find "Service Workers" section
5. Check the checkbox **"Update on reload"**
6. Uncheck "Update on reload"
7. Reload the page (Cmd+R / Ctrl+R)

**Expected:**
- Toast appears at bottom of screen: "🦙 Nowa wersja AlpacaLive"
- Polish: "Twoje dane zostaną zachowane"
- English: "New version of AlpacaLive" + "Your data will be preserved"
- Two buttons: "Zaktualizuj teraz" (Update now) and "Później" (Later)

**Pass Criteria:**
✅ Toast is visible, readable, positioned bottom-center, matches lavender design (`#2d1f4e`, purple accents)

---

## QA-M2: Clicking "Zaktualizuj teraz" reloads app

**Setup:** Toast from QA-M1 is visible

**Steps:**
1. Click button "Zaktualizuj teraz" (Update now)

**Expected:**
- Page reloads
- SW controller is updated
- App is still functional after reload
- Data in IndexedDB is intact (no data loss)

**Pass Criteria:**
✅ App reloads and resumes normally without data loss

---

## QA-M3: Clicking "Później" dismisses toast

**Setup:** Toast from QA-M1 is visible

**Steps:**
1. Click button "Później" (Later)

**Expected:**
- Toast disappears
- App continues operating normally
- If SW update arrives again, new toast appears

**Pass Criteria:**
✅ Toast dismissed, app remains functional

---

## QA-M4: Spinner overlay appears during migration

**Setup:**
1. Open DevTools → Console
2. Copy-paste this command:

```javascript
window.dispatchEvent(new CustomEvent('alpaca:db:migrating', { 
  detail: { from: 4, to: 5 } 
}))
```

**Expected:**
- Full-screen overlay appears (dark background `#1a0f2e` with blur)
- Spinning circle (loader animation)
- Text: "Aktualizujemy dane lokalne..." (Updating local data...)
- Subtext: "Nie zamykaj aplikacji" (Please don't close the app)
- Overlay blocks UI but is not modal (non-blocking)

**Pass Criteria:**
✅ Overlay appears immediately, spinner animates, text is centered, design matches lavender theme

---

## QA-M5: Success overlay appears after migration, auto-dismisses in 4s

**Setup:** From QA-M4, overlay is still visible

**Steps:**
1. In DevTools Console, run:

```javascript
window.dispatchEvent(new CustomEvent('alpaca:db:migrated', { 
  detail: { from: 4, to: 5 } 
}))
```

**Expected:**
- Overlay changes to success state
- Shows checkmark emoji: ✅
- Text: "Dane zachowane" (Data preserved)
- Subtext: "Aplikacja zaktualizowana, nic nie zostało utracone" (App updated, nothing was lost)
- After 4 seconds, overlay auto-dismisses
- App is fully functional again

**Pass Criteria:**
✅ Overlay shows success, auto-dismisses after 4s, app is responsive

---

## QA-M6: Error overlay on migration failure (bonus)

**Setup:**
1. In DevTools Console, run:

```javascript
window.dispatchEvent(new CustomEvent('alpaca:db:migration-error', { 
  detail: { from: 4, to: 5, error: 'simulated error' } 
}))
```

**Expected:**
- Overlay shows error state
- Shows warning emoji: ⚠️
- Text: "Problem z aktualizacją danych" (Problem updating data)
- Subtext: "Odśwież stronę lub skontaktuj się z pomocą" (Refresh page or contact support)
- Overlay persists (does NOT auto-dismiss)

**Pass Criteria:**
✅ Error overlay displays correctly, user can manually refresh or contact support

---

## Regression Tests (ensure no breaking changes)

After completing M1-M6, verify:

- ✅ Chat view loads and works
- ✅ Notebook view logs data correctly
- ✅ Calendar view shows entries
- ✅ Data view loads
- ✅ Settings are editable
- ✅ No console errors
- ✅ App performance is not degraded
- ✅ All existing notifications work

---

## Browser Compatibility

Test on:
- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest, macOS + iOS)
- Mobile browsers (iOS Safari, Chrome Mobile)

---

## Notes

- Dev server must be running: `npm run dev`
- All tests pass in VSCode CLI (11 tests for hooks + logic)
- Manual browser testing is required for UI/UX verification
- Toast and overlay components use Tailwind CSS + custom dark theme colors
- No external dependencies added (adheres to CLAUDE.md constraints)
- All 507 tests pass, build successful
