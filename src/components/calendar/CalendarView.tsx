import { useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { buildCalendarEvents, getEventsForDate, getPhaseForDate, getEventColors } from '@/lib/calendar-events';
import { db } from '@/lib/db';
import { getPhaseColor } from '@/lib/treatment-cycle';
import { Icon } from '@/components/shared/Icon';
import { useI18n } from '@/lib/i18n';
import type { CalendarEvent, CalendarEventType, TabId, NotebookTab } from '@/types';

const SOURCE_TYPE_NAV: Record<string, { tab: TabId; notebookTab?: NotebookTab }> = {
  chemo:       { tab: 'chat', notebookTab: 'chemo' },
  blood:       { tab: 'chat', notebookTab: 'blood' },
  daily:       { tab: 'chat', notebookTab: 'daily' },
  supplements: { tab: 'chat', notebookTab: 'supplements' },
  imaging:     { tab: 'imaging' },
  wearable:    { tab: 'data' },
};

const ADDABLE_EVENT_TYPES: CalendarEventType[] = [
  'doctor_visit', 'note', 'chemo', 'blood_test', 'imaging',
  'radiotherapy_session', 'immunotherapy_infusion', 'targeted_therapy',
  'hormonal_therapy', 'surgery', 'surgery_followup', 'medication_change',
  'side_effect', 'supplement', 'daily_log', 'wearable_alert',
];

interface CalendarViewProps {
  onNavigate: (tab: TabId, notebookTab?: NotebookTab) => void;
}

export function CalendarView({ onNavigate }: CalendarViewProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [viewMonth, setViewMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [hiddenTypes, setHiddenTypes] = useState<Set<CalendarEventType>>(new Set(['phase_a', 'phase_b', 'phase_c']));
  const [loading, setLoading] = useState(true);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteType, setNoteType] = useState<CalendarEventType>('note');
  const { t, lang } = useI18n();

  const locale = lang === 'pl' ? 'pl-PL' : lang === 'de' ? 'de-DE' : 'en-US';
  const DEFAULT_EVENT_COLORS = getEventColors(lang);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    const ev = await buildCalendarEvents(lang);
    setEvents(ev);
    setLoading(false);
  }, [lang]);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  const today = new Date().toISOString().split('T')[0];

  function shiftMonth(delta: number) {
    setViewMonth(prev => { const d = new Date(prev); d.setMonth(d.getMonth() + delta); return d; });
    setSelectedDate(null);
  }

  function toggleType(type: CalendarEventType) {
    setHiddenTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type); else next.add(type);
      return next;
    });
  }

  async function addNote() {
    if (!noteTitle.trim() || !selectedDate) return;
    await db.calendarNotes.put({
      id: uuidv4(), date: selectedDate, type: noteType,
      title: noteTitle.trim(),
    });
    setNoteTitle('');
    setShowAddMenu(false);
    loadEvents();
  }

  async function deleteNote(eventId: string) {
    const noteId = eventId.replace('note-', '');
    await db.calendarNotes.delete(noteId);
    loadEvents();
  }

  function handleEventNavigate(event: CalendarEvent) {
    if (event.sourceType && SOURCE_TYPE_NAV[event.sourceType]) {
      const nav = SOURCE_TYPE_NAV[event.sourceType];
      onNavigate(nav.tab, nav.notebookTab);
    }
  }

  const visibleEvents = events.filter(e => !hiddenTypes.has(e.type));

  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const monthName = viewMonth.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = lastDay.getDate();

  const selectedEvents = selectedDate ? getEventsForDate(visibleEvents, selectedDate) : [];
  const selectedPhase = selectedDate ? getPhaseForDate(events, selectedDate) : null;

  return (
    <div className="h-full overflow-y-auto px-3 py-4 space-y-3">
      {/* Month navigation header */}
      <div className="flex items-center justify-between gap-2">
        <button onClick={() => shiftMonth(-1)} className="p-1.5 rounded-lg hover:bg-bg-elevated transition-colors">
          <Icon name="chevron_left" size={22} className="text-accent-dark" />
        </button>
        <button
          onClick={() => setShowMonthPicker(!showMonthPicker)}
          className="font-display text-base font-semibold text-accent-dark capitalize hover:bg-bg-elevated px-3 py-1 rounded-lg transition-colors flex items-center gap-1"
        >
          {monthName}
          <Icon name={showMonthPicker ? 'expand_less' : 'expand_more'} size={18} />
        </button>
        <button onClick={() => shiftMonth(1)} className="p-1.5 rounded-lg hover:bg-bg-elevated transition-colors">
          <Icon name="chevron_right" size={22} className="text-accent-dark" />
        </button>
        {/* Today button — show only when not viewing current month */}
        {(viewMonth.getMonth() !== new Date().getMonth() || viewMonth.getFullYear() !== new Date().getFullYear()) && (
          <button
            onClick={() => { setViewMonth(new Date()); setSelectedDate(today); }}
            className="text-[10px] font-medium text-accent-dark bg-accent-warm px-2 py-1 rounded-lg hover:bg-accent-dark hover:text-accent-warm transition-colors shrink-0"
          >
            {lang === 'pl' ? 'Dziś' : lang === 'de' ? 'Heute' : 'Today'}
          </button>
        )}
      </div>

      {/* Month/Year picker dropdown */}
      {showMonthPicker && (
        <div className="bg-bg-card rounded-xl border border-border p-3 space-y-3">
          {/* Year selector */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setViewMonth(prev => { const d = new Date(prev); d.setFullYear(d.getFullYear() - 1); return d; })}
              className="p-1 rounded hover:bg-bg-elevated transition-colors"
            >
              <Icon name="chevron_left" size={18} className="text-text-secondary" />
            </button>
            <span className="text-sm font-semibold text-text-primary">{year}</span>
            <button
              onClick={() => setViewMonth(prev => { const d = new Date(prev); d.setFullYear(d.getFullYear() + 1); return d; })}
              className="p-1 rounded hover:bg-bg-elevated transition-colors"
            >
              <Icon name="chevron_right" size={18} className="text-text-secondary" />
            </button>
          </div>
          {/* Month grid */}
          <div className="grid grid-cols-4 gap-1.5">
            {Array.from({ length: 12 }).map((_, m) => {
              const label = new Date(year, m).toLocaleDateString(locale, { month: 'short' });
              const isCurrent = m === month;
              const isNowMonth = m === new Date().getMonth() && year === new Date().getFullYear();
              return (
                <button
                  key={m}
                  onClick={() => { setViewMonth(new Date(year, m, 1)); setShowMonthPicker(false); setSelectedDate(null); }}
                  className={`py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                    isCurrent
                      ? 'bg-accent-dark text-white'
                      : isNowMonth
                        ? 'bg-accent-warm text-accent-dark ring-1 ring-accent-dark'
                        : 'hover:bg-bg-elevated text-text-primary'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-8 text-text-secondary text-sm">{t.common.loading}</div>
      ) : (
        <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
          {t.calendar.weekDays.map(d => (
            <div key={d} className="bg-bg-card text-center text-[9px] text-text-secondary font-medium py-1.5">{d}</div>
          ))}

          {Array.from({ length: startOffset }).map((_, i) => (
            <div key={`e-${i}`} className="bg-bg-primary min-h-[52px]" />
          ))}

          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const isToday = dateStr === today;
            const isSelected = dateStr === selectedDate;
            const dayEvents = getEventsForDate(visibleEvents, dateStr);
            const phase = getPhaseForDate(events, dateStr);
            const phaseBg = phase ? getPhaseColor(phase as 'A' | 'B' | 'C') + '15' : undefined;

            return (
              <button
                key={day}
                onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                className={`min-h-[52px] p-1 text-left relative transition-colors ${
                  isSelected ? 'ring-2 ring-accent-dark' : ''
                } ${isToday ? 'bg-accent-warm/40' : 'bg-bg-card'}`}
                style={phaseBg && !isToday ? { backgroundColor: phaseBg } : undefined}
              >
                <div className="flex items-center gap-0.5">
                  <span className={`text-[10px] leading-none ${
                    isToday
                      ? 'font-bold text-white bg-accent-dark rounded-full w-[18px] h-[18px] flex items-center justify-center'
                      : 'text-text-primary'
                  }`}>{day}</span>
                </div>
                <div className="flex flex-wrap gap-0.5 mt-0.5">
                  {dayEvents.slice(0, 4).map(ev => (
                    <span key={ev.id} title={ev.title} style={{ color: ev.color }}>
                      {ev.icon ? <Icon name={ev.icon} size={10} /> : null}
                    </span>
                  ))}
                  {dayEvents.length > 4 && (
                    <span className="text-[7px] text-text-secondary">+{dayEvents.length - 4}</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {(['chemo', 'blood_test', 'imaging', 'daily_log', 'supplement', 'doctor_visit', 'surgery', 'radiotherapy_session', 'immunotherapy_infusion', 'targeted_therapy', 'hormonal_therapy', 'wearable_alert', 'note'] as CalendarEventType[]).map(type => {
          const cfg = DEFAULT_EVENT_COLORS[type];
          const hidden = hiddenTypes.has(type);
          return (
            <button
              key={type}
              onClick={() => toggleType(type)}
              className={`flex items-center gap-1 px-2 py-1 rounded-full text-[9px] border transition-opacity ${
                hidden ? 'opacity-30 border-border' : 'border-transparent'
              }`}
              style={!hidden ? { backgroundColor: cfg.color + '20', color: cfg.color } : undefined}
            >
              {cfg.icon && <Icon name={cfg.icon} size={14} />}
              <span>{cfg.label}</span>
            </button>
          );
        })}
      </div>

      {selectedDate && (
        <div className="bg-bg-card rounded-xl border border-border p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">
                {new Date(selectedDate + 'T12:00').toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })}
              </div>
              {selectedPhase && (
                <div className="text-[10px] font-medium" style={{ color: getPhaseColor(selectedPhase as 'A' | 'B' | 'C') }}>
                  {lang === 'pl' ? 'Faza' : lang === 'de' ? 'Phase' : 'Phase'} {selectedPhase} — {selectedPhase === 'A' ? t.calendar.phaseCrisis : selectedPhase === 'B' ? t.calendar.phaseRecovery : t.calendar.phaseRebuild}
                </div>
              )}
            </div>
            <button
              onClick={() => setShowAddMenu(!showAddMenu)}
              className="text-xs bg-accent-dark text-accent-warm px-3 py-1 rounded-lg"
            >
              {t.calendar.addButton}
            </button>
          </div>

          {showAddMenu && (
            <div className="bg-bg-primary rounded-lg p-3 space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {ADDABLE_EVENT_TYPES.map(type => {
                  const cfg = DEFAULT_EVENT_COLORS[type];
                  const isActive = noteType === type;
                  const label = (t.calendar.eventTypes as Record<string, string>)[type] || cfg.label;
                  return (
                    <button
                      key={type}
                      onClick={() => setNoteType(type)}
                      className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-medium transition-all ${
                        isActive
                          ? 'ring-2 ring-accent-dark shadow-sm'
                          : 'border border-border hover:border-transparent'
                      }`}
                      style={isActive
                        ? { backgroundColor: cfg.color + '25', color: cfg.color }
                        : undefined
                      }
                    >
                      {cfg.icon && <Icon name={cfg.icon} size={14} />}
                      <span>{label}</span>
                    </button>
                  );
                })}
              </div>
              <input
                value={noteTitle}
                onChange={e => setNoteTitle(e.target.value)}
                placeholder={
                  noteType === 'doctor_visit' ? t.calendar.visitPlaceholder
                    : noteType === 'note' ? t.calendar.noteContentPlaceholder
                    : t.calendar.eventTitlePlaceholder
                }
                className="w-full rounded border border-border px-2 py-1.5 text-xs bg-bg-card"
              />
              <button onClick={addNote} disabled={!noteTitle.trim()} className="w-full bg-accent-dark text-accent-warm rounded py-1.5 text-xs disabled:opacity-40">
                {t.common.save}
              </button>
            </div>
          )}

          {selectedEvents.length === 0 ? (
            <div className="text-xs text-text-secondary text-center py-3">{t.calendar.noEvents}</div>
          ) : (
            <div className="space-y-2">
              {selectedEvents.map(ev => (
                <DayEventCard
                  key={ev.id}
                  event={ev}
                  onDelete={ev.id.startsWith('note-') ? () => deleteNote(ev.id) : undefined}
                  onNavigate={ev.sourceType ? () => handleEventNavigate(ev) : undefined}
                />
              ))}
            </div>
          )}

          <div className="text-[9px] text-text-secondary text-center pt-1">
            {t.calendar.referenceNote}
          </div>
        </div>
      )}
    </div>
  );
}

interface DayEventCardProps {
  event: CalendarEvent;
  onDelete?: () => void;
  onNavigate?: () => void;
}

function DayEventCard({ event, onDelete, onNavigate }: DayEventCardProps) {
  const [expanded, setExpanded] = useState(false);
  const { t } = useI18n();

  return (
    <div
      className="w-full text-left rounded-lg p-2 border transition-colors"
      style={{ borderColor: event.color + '40', backgroundColor: event.color + '08' }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left"
      >
        <div className="flex items-center gap-2">
          {event.icon && <Icon name={event.icon} size={18} className="shrink-0" />}
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium truncate">{event.title}</div>
            {event.subtitle && <div className="text-[10px] text-text-secondary truncate">{event.subtitle}</div>}
          </div>
          {event.time && <span className="text-[10px] text-text-secondary">{event.time}</span>}
          <Icon name={expanded ? 'expand_less' : 'expand_more'} size={16} className="text-text-secondary shrink-0" />
        </div>
      </button>

      {expanded && (
        <div className="mt-2 pt-2 border-t border-border/50 space-y-2">
          {event.data && (
            <div className="space-y-0.5">
              {Object.entries(event.data).map(([key, value]) => {
                if (value === null || value === undefined || typeof value === 'object') return null;
                return (
                  <div key={key} className="flex justify-between text-[10px]">
                    <span className="text-text-secondary">{key}</span>
                    <span>{String(value)}</span>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex gap-2">
            {onNavigate && (
              <button
                onClick={onNavigate}
                className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium bg-accent-dark/10 text-accent-dark hover:bg-accent-dark/20 transition-colors"
              >
                <Icon name="open_in_new" size={12} />
                {t.calendar.goToSource}
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => { if (confirm(t.calendar.deleteConfirm)) onDelete(); }}
                className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium bg-red-50 text-red-600 hover:bg-red-100 transition-colors ml-auto"
              >
                <Icon name="delete" size={12} />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
