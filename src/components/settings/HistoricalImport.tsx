import { useState, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Card } from '@/components/shared/Card';
import { Icon } from '@/components/shared/Icon';
import { db } from '@/lib/db';
import { useSettings } from '@/hooks/useDatabase';
import { BLOOD_NORMS } from '@/lib/blood-norms';
import { useI18n } from '@/lib/i18n';
import type { BloodWork, ChemoSession } from '@/types';

type ImportTab = 'photos' | 'manual' | 'chemo';

// Podstawowe markery widoczne domyślnie
const BASIC_MARKERS = ['wbc', 'hgb', 'plt', 'neutrophils', 'albumin'] as const;

// Pełny zakres markerów (rozwijany)
const ALL_MARKERS = [
  // Morfologia
  'wbc', 'neutrophils', 'lymphocytes', 'hgb', 'hct', 'plt', 'rbc', 'mcv',
  // Biochemia
  'albumin', 'totalProtein', 'creatinine', 'urea', 'alt', 'ast', 'bilirubin',
  'glucose', 'crp', 'sodium', 'potassium', 'calcium', 'ldh',
  // Markery nowotworowe
  'ca153', 'cea', 'ca125',
  // Koagulacja
  'inr', 'dDimer',
] as const;

interface BloodRow {
  id: string;
  date: string;
  values: Record<string, string>;
}

interface PhotoItem {
  id: string;
  file: File;
  preview: string;
  status: 'waiting' | 'processing' | 'done' | 'error';
  error?: string;
}

export function HistoricalImport() {
  const [tab, setTab] = useState<ImportTab>('manual');
  const { t } = useI18n();

  return (
    <Card title={t.historicalImport.title}>
      <p className="text-xs text-text-secondary mb-3">
        {t.historicalImport.description}
      </p>

      <div className="flex gap-1 mb-4 bg-bg-primary rounded-lg p-1">
        <TabButton active={tab === 'manual'} onClick={() => setTab('manual')} icon="water_drop" label={t.historicalImport.bloodResults} />
        <TabButton active={tab === 'chemo'} onClick={() => setTab('chemo')} icon="vaccines" label={t.historicalImport.chemoDates} />
        <TabButton active={tab === 'photos'} onClick={() => setTab('photos')} icon="photo_camera" label={t.historicalImport.photos} />
      </div>

      {tab === 'manual' && <ManualBloodImport />}
      {tab === 'chemo' && <ChemoDateImport />}
      {tab === 'photos' && <PhotoBatchImport />}
    </Card>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: string; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 text-xs py-2 rounded-md font-medium transition-colors flex items-center justify-center gap-1 ${
        active ? 'bg-bg-card text-accent-dark shadow-sm' : 'text-text-secondary'
      }`}
    >
      <Icon name={icon} size={16} />
      {label}
    </button>
  );
}

// ==================== MANUAL BLOOD IMPORT ====================

function ManualBloodImport() {
  const [rows, setRows] = useState<BloodRow[]>([createEmptyRow()]);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const { t } = useI18n();

  const visibleMarkers = showAll ? ALL_MARKERS : BASIC_MARKERS;

  function createEmptyRow(): BloodRow {
    return {
      id: uuidv4(),
      date: '',
      values: Object.fromEntries(ALL_MARKERS.map(k => [k, ''])),
    };
  }

  function addRow() {
    setRows(prev => [...prev, createEmptyRow()]);
    setSaved(false);
  }

  function removeRow(id: string) {
    setRows(prev => prev.filter(r => r.id !== id));
    setSaved(false);
  }

  function updateRow(id: string, field: string, value: string) {
    setRows(prev => prev.map(r => {
      if (r.id !== id) return r;
      if (field === 'date') return { ...r, date: value };
      return { ...r, values: { ...r.values, [field]: value } };
    }));
    setSaved(false);
  }

  async function handleSave() {
    const validRows = rows.filter(r => r.date);
    if (validRows.length === 0) return;

    setSaving(true);
    try {
      const bloodRecords: (BloodWork & { id: string })[] = validRows.map(row => {
        const markers: Record<string, number> = {};
        for (const [key, val] of Object.entries(row.values)) {
          const num = parseFloat(val);
          if (!isNaN(num)) markers[key] = num;
        }
        return {
          id: row.id,
          date: row.date,
          source: 'manual' as const,
          markers,
          notes: 'Import historyczny',
        };
      });

      await db.blood.bulkPut(bloodRecords);
      setSaved(true);
    } catch {
      alert(t.historicalImport.saveError);
    } finally {
      setSaving(false);
    }
  }

  // Group markers by category for expanded view
  const markerCategories = showAll ? [
    { label: t.historicalImport.morphology, markers: ['wbc', 'neutrophils', 'lymphocytes', 'hgb', 'hct', 'plt', 'rbc', 'mcv'] },
    { label: t.historicalImport.biochemistry, markers: ['albumin', 'totalProtein', 'creatinine', 'urea', 'alt', 'ast', 'bilirubin', 'glucose', 'crp', 'sodium', 'potassium', 'calcium', 'ldh'] },
    { label: t.historicalImport.tumorMarkers, markers: ['ca153', 'cea', 'ca125'] },
    { label: t.historicalImport.coagulation, markers: ['inr', 'dDimer'] },
  ] : null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-text-secondary">
          {t.historicalImport.manualDesc(showAll)}
        </p>
        <button
          onClick={() => setShowAll(!showAll)}
          className="text-[10px] text-accent-dark underline whitespace-nowrap"
        >
          {showAll ? t.historicalImport.showBasic : t.historicalImport.showAll}
        </button>
      </div>

      {!showAll ? (
        <>
          {/* Compact table for basic markers */}
          <div className="grid grid-cols-[90px_repeat(5,1fr)_28px] gap-1 text-[9px] text-text-secondary font-medium">
            <div>Data</div>
            {BASIC_MARKERS.map(k => (
              <div key={k} title={BLOOD_NORMS[k]?.name}>
                {BLOOD_NORMS[k]?.shortName || k}
                <span className="block text-[8px] opacity-60">{BLOOD_NORMS[k]?.unit}</span>
              </div>
            ))}
            <div />
          </div>

          {rows.map(row => (
            <div key={row.id} className="grid grid-cols-[90px_repeat(5,1fr)_28px] gap-1 items-center">
              <input
                type="date"
                value={row.date}
                onChange={e => updateRow(row.id, 'date', e.target.value)}
                className="rounded border border-border px-1.5 py-1 text-[11px] bg-bg-primary w-full"
              />
              {BASIC_MARKERS.map(k => (
                <input
                  key={k}
                  type="number"
                  step="0.1"
                  value={row.values[k]}
                  onChange={e => updateRow(row.id, k, e.target.value)}
                  placeholder={`${BLOOD_NORMS[k]?.normalMin ?? ''}`}
                  className="rounded border border-border px-1.5 py-1 text-[11px] bg-bg-primary w-full text-center"
                />
              ))}
              <button
                onClick={() => removeRow(row.id)}
                className="text-alert-critical text-sm w-7 h-7 flex items-center justify-center"
                title={t.historicalImport.removeRow}
              >
                ×
              </button>
            </div>
          ))}
        </>
      ) : (
        <>
          {/* Expanded form — one row at a time with all markers grouped by category */}
          {rows.map(row => (
            <div key={row.id} className="border border-border rounded-lg p-3 space-y-3">
              <div className="flex items-center justify-between">
                <input
                  type="date"
                  value={row.date}
                  onChange={e => updateRow(row.id, 'date', e.target.value)}
                  className="rounded border border-border px-2 py-1.5 text-xs bg-bg-primary"
                />
                <button
                  onClick={() => removeRow(row.id)}
                  className="text-alert-critical text-xs px-2 py-1"
                >
                  {t.historicalImport.remove}
                </button>
              </div>

              {markerCategories!.map(cat => (
                <div key={cat.label}>
                  <div className="text-[9px] font-medium text-accent-dark mb-1">{cat.label}</div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {cat.markers.map(k => {
                      const norm = BLOOD_NORMS[k];
                      return (
                        <div key={k} className="flex flex-col">
                          <label className="text-[8px] text-text-secondary" title={norm?.name}>
                            {norm?.shortName || k} <span className="opacity-50">({norm?.unit})</span>
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            value={row.values[k] || ''}
                            onChange={e => updateRow(row.id, k, e.target.value)}
                            placeholder={norm ? `${norm.normalMin}–${norm.normalMax}` : ''}
                            className="rounded border border-border px-1.5 py-1 text-[11px] bg-bg-primary text-center"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={addRow}
          className="flex-1 border border-border text-text-secondary rounded-lg py-2 text-xs"
        >
          {t.historicalImport.addRow}
        </button>
        <button
          onClick={handleSave}
          disabled={saving || rows.every(r => !r.date)}
          className="flex-1 bg-accent-dark text-accent-warm rounded-lg py-2 text-xs font-medium disabled:opacity-40"
        >
          {saving ? t.historicalImport.saving : saved ? t.common.saved : t.historicalImport.saveAll}
        </button>
      </div>
    </div>
  );
}

// ==================== CHEMO DATE IMPORT ====================

function ChemoDateImport() {
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const [drugs, setDrugs] = useState('');
  const [cycleLength, setCycleLength] = useState('21');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const { t, lang } = useI18n();
  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 3);
    return d;
  });

  function toggleDate(dateStr: string) {
    setSelectedDates(prev => {
      const next = new Set(prev);
      if (next.has(dateStr)) next.delete(dateStr);
      else next.add(dateStr);
      return next;
    });
    setSaved(false);
  }

  function shiftMonth(delta: number) {
    setViewMonth(prev => {
      const d = new Date(prev);
      d.setMonth(d.getMonth() + delta);
      return d;
    });
  }

  async function handleSave() {
    if (selectedDates.size === 0) return;
    setSaving(true);

    try {
      const sorted = [...selectedDates].sort();
      const drugList = drugs.split(',').map(d => d.trim()).filter(Boolean);

      const sessions: (ChemoSession & { id: string })[] = sorted.map((date, i) => ({
        id: uuidv4(),
        date,
        plannedDate: date,
        actualDate: date,
        status: 'completed' as const,
        drugs: drugList,
        cycle: i + 1,
        notes: 'Import historyczny',
        sideEffects: [],
      }));

      await db.chemo.bulkPut(sessions);
      setSaved(true);
    } catch {
      alert(t.historicalImport.chemoSaveError);
    } finally {
      setSaving(false);
    }
  }

  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const locale = lang === 'pl' ? 'pl-PL' : lang === 'de' ? 'de-DE' : 'en-US';
  const monthName = viewMonth.toLocaleDateString(locale, { month: 'long', year: 'numeric' });

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startOffset = (firstDay.getDay() + 6) % 7; // Monday = 0
  const daysInMonth = lastDay.getDate();
  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-3">
      <p className="text-[10px] text-text-secondary">
        {t.historicalImport.chemoClickDates(selectedDates.size)}
      </p>

      {/* Drug inputs */}
      <div className="space-y-2">
        <input
          value={drugs}
          onChange={e => setDrugs(e.target.value)}
          placeholder={t.historicalImport.drugsPlaceholder}
          className="w-full rounded-lg border border-border px-3 py-2 text-xs bg-bg-primary"
        />
        <div className="flex gap-2 items-center">
          <label className="text-[10px] text-text-secondary whitespace-nowrap">{t.historicalImport.cycleEvery}</label>
          <input
            type="number"
            value={cycleLength}
            onChange={e => setCycleLength(e.target.value)}
            className="w-16 rounded border border-border px-2 py-1 text-xs bg-bg-primary text-center"
          />
          <span className="text-[10px] text-text-secondary">{t.historicalImport.days}</span>
        </div>
      </div>

      {/* Calendar nav */}
      <div className="flex items-center justify-between">
        <button onClick={() => shiftMonth(-1)} className="p-1 text-sm">◀</button>
        <span className="text-xs font-medium capitalize">{monthName}</span>
        <button onClick={() => shiftMonth(1)} className="p-1 text-sm">▶</button>
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1 text-center">
        {t.historicalImport.weekDays.map(d => (
          <div key={d} className="text-[9px] text-text-secondary font-medium py-1">{d}</div>
        ))}

        {Array.from({ length: startOffset }).map((_, i) => (
          <div key={`empty-${i}`} />
        ))}

        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const isSelected = selectedDates.has(dateStr);
          const isFuture = dateStr > today;

          return (
            <button
              key={day}
              onClick={() => !isFuture && toggleDate(dateStr)}
              disabled={isFuture}
              className={`w-8 h-8 mx-auto rounded-full text-[11px] font-medium transition-colors ${
                isSelected
                  ? 'bg-accent-dark text-accent-warm'
                  : isFuture
                  ? 'text-border cursor-not-allowed'
                  : 'hover:bg-accent-warm/40 text-text-primary'
              }`}
            >
              {day}
            </button>
          );
        })}
      </div>

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={saving || selectedDates.size === 0}
        className="w-full bg-accent-dark text-accent-warm rounded-lg py-2 text-xs font-medium disabled:opacity-40"
      >
        {saving ? t.historicalImport.saving : saved ? t.historicalImport.savedSessions(selectedDates.size) : t.historicalImport.saveSessions(selectedDates.size)}
      </button>
    </div>
  );
}

// ==================== PHOTO BATCH IMPORT ====================

function PhotoBatchImport() {
  const { settings } = useSettings();
  const { t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);

  function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;

    const newPhotos: PhotoItem[] = Array.from(files).map(file => ({
      id: uuidv4(),
      file,
      preview: URL.createObjectURL(file),
      status: 'waiting' as const,
    }));

    setPhotos(prev => [...prev, ...newPhotos]);
    e.target.value = '';
  }

  function removePhoto(id: string) {
    setPhotos(prev => {
      const item = prev.find(p => p.id === id);
      if (item) URL.revokeObjectURL(item.preview);
      return prev.filter(p => p.id !== id);
    });
  }

  async function processQueue() {
    if (!settings?.apiKey) {
      alert(t.historicalImport.photoApiNeeded);
      return;
    }

    for (const photo of photos) {
      if (photo.status !== 'waiting') continue;

      setPhotos(prev => prev.map(p => p.id === photo.id ? { ...p, status: 'processing' } : p));

      try {
        const base64 = await fileToBase64(photo.file);

        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': settings.apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 2048,
            messages: [{
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: { type: 'base64', media_type: photo.file.type, data: base64 },
                },
                {
                  type: 'text',
                  text: `Odczytaj WSZYSTKIE wyniki badań krwi z tego zdjęcia. Zwróć dane w formacie JSON:
{"date":"YYYY-MM-DD","markers":{"wbc":wartość,"hgb":wartość,"plt":wartość,...}}

KLUCZOWE MARKERY (użyj tych kluczy):
Morfologia: wbc, neutrophils, lymphocytes, hgb, hct, plt, rbc, mcv
Biochemia: albumin, totalProtein, creatinine, urea, alt, ast, bilirubin, glucose, crp, sodium, potassium, calcium, ldh
Markery nowotworowe: ca153, cea, ca125
Koagulacja: inr, dDimer

INSTRUKCJE:
1. Odczytaj KAŻDĄ wartość liczbową widoczną na zdjęciu — nawet jeśli nie ma jej na powyższej liście, dodaj ją z oryginalną nazwą jako kluczem.
2. Datę odczytaj ze zdjęcia (nagłówek/stopka). Jeśli nie widać, użyj dzisiejszej.
3. Wartości podawaj jako liczby (nie tekst). Jeśli jednostka inna niż standardowa, przelicz.
4. IGNORUJ dane osobowe pacjenta (imię, nazwisko, PESEL, adres).
5. Jeśli zdjęcie zawiera kilka stron/badań z różnych dat — zwróć tablicę: [{"date":...,"markers":...}, ...]`,
                },
              ],
            }],
          }),
        });

        if (!response.ok) throw new Error(`API ${response.status}`);

        const data = await response.json();
        const text = data.content?.[0]?.text || '';

        // Extract JSON from response — support single object or array
        const arrayMatch = text.match(/\[[\s\S]*\]/);
        const objMatch = text.match(/\{[\s\S]*\}/);
        if (!arrayMatch && !objMatch) throw new Error(t.historicalImport.photoNoData);

        let results: { date?: string; markers?: Record<string, number> }[];
        try {
          const raw = JSON.parse(arrayMatch ? arrayMatch[0] : objMatch![0]);
          results = Array.isArray(raw) ? raw : [raw];
        } catch {
          throw new Error(t.historicalImport.photoParseError);
        }

        for (const parsed of results) {
          const bloodRecord: BloodWork & { id: string } = {
            id: results.length === 1 ? photo.id : uuidv4(),
            date: parsed.date || new Date().toISOString().split('T')[0],
            source: 'photo_extraction',
            markers: parsed.markers || {},
            notes: t.historicalImport.photoImportNote(Object.keys(parsed.markers || {}).length),
          };
          await db.blood.put(bloodRecord);
        }
        setPhotos(prev => prev.map(p => p.id === photo.id ? { ...p, status: 'done' } : p));
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Nieznany błąd';
        setPhotos(prev => prev.map(p => p.id === photo.id ? { ...p, status: 'error', error: msg } : p));
      }
    }
  }

  const waitingCount = photos.filter(p => p.status === 'waiting').length;
  const doneCount = photos.filter(p => p.status === 'done').length;

  return (
    <div className="space-y-3">
      <p className="text-[10px] text-text-secondary">
        {t.historicalImport.photoDesc}
      </p>

      {!settings?.apiKey && (
        <div className="bg-alert-warning/10 text-alert-warning text-[11px] rounded-lg p-2.5">
          {t.historicalImport.photoApiWarning}
        </div>
      )}

      <button
        onClick={() => fileInputRef.current?.click()}
        className="w-full border-2 border-dashed border-border rounded-lg py-4 text-xs text-text-secondary hover:border-accent-dark transition-colors"
      >
        <span className="material-symbols-rounded" style={{fontSize:16}}>photo_camera</span> {t.historicalImport.photoAddButton}
      </button>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        className="hidden"
        onChange={handleFiles}
      />

      {/* Photo list */}
      {photos.length > 0 && (
        <div className="space-y-2">
          {photos.map(photo => (
            <div key={photo.id} className="flex items-center gap-2 bg-bg-primary rounded-lg p-2">
              <img src={photo.preview} alt="" className="w-10 h-10 object-cover rounded" />
              <div className="flex-1 min-w-0">
                <div className="text-[11px] truncate">{photo.file.name}</div>
                <div className="text-[10px]">
                  {photo.status === 'waiting' && <span className="text-text-secondary">{t.historicalImport.photoWaiting}</span>}
                  {photo.status === 'processing' && <span className="text-alert-info">{t.historicalImport.photoProcessing}</span>}
                  {photo.status === 'done' && <span className="text-alert-positive">{t.historicalImport.photoSaved}</span>}
                  {photo.status === 'error' && <span className="text-alert-critical">✗ {photo.error}</span>}
                </div>
              </div>
              <button onClick={() => removePhoto(photo.id)} className="text-text-secondary text-sm p-1">×</button>
            </div>
          ))}

          {/* Process button */}
          {waitingCount > 0 && (
            <button
              onClick={processQueue}
              className="w-full bg-accent-dark text-accent-warm rounded-lg py-2 text-xs font-medium"
            >
              {t.historicalImport.photoProcess(waitingCount)}
            </button>
          )}

          {doneCount > 0 && waitingCount === 0 && (
            <div className="text-center text-xs text-alert-positive py-1">
              {t.historicalImport.photoProcessed(doneCount)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ==================== UTILS ====================

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
