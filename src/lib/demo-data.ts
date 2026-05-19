/*
 * AlpacaLive — Demo data generator
 * Generates realistic fake patient data to showcase app capabilities.
 * Uses a breast cancer patient scenario with chemo + radiotherapy.
 */
import { v4 as uuidv4 } from 'uuid';
import { db, savePatient, saveSettings, getSettings, activateDemoDb, deactivateDemoDb } from './db';
import { DEFAULT_NOTIFICATIONS } from '@/types';
import type {
  PatientProfile,
  ChemoSession,
  BloodWork,
  DailyLog,
  ImagingStudy,
  SupplementLog,
  WearableData,
  MealLog,
  TreatmentProtocol,
  TreatmentSession,
  CalendarNote,
} from '@/types';

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

function randomBetween(min: number, max: number): number {
  return Math.round((min + Math.random() * (max - min)) * 10) / 10;
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

// ==================== LOCALIZED DEMO STRINGS ====================
// The demo patient is "Anna", a stage IIA breast cancer patient.
// Key user-facing strings (diagnosis, facility, notes) are localized.
type DemoLang = 'pl' | 'en' | 'de';

function getDemoLang(): DemoLang {
  try {
    const stored = localStorage.getItem('alpacalive-lang');
    if (stored === 'pl' || stored === 'en' || stored === 'de') return stored;
  } catch { /* noop */ }
  return 'en';
}

function getDemoStrings(lang: DemoLang) {
  if (lang === 'pl') return {
    diagnosis: 'Rak piersi lewej inwazyjny',
    facility: 'Centrum Onkologii — Instytut Marii Skłodowskiej-Curie',
    city: 'Warszawa',
    country: 'Polska',
    radioTherapyName: 'RT pierś lewa',
    radioTargetArea: 'Pierś lewa + okolica nadobojczykowa',
    radioFrequency: 'pon-pią',
    surgery1: 'Tumorektomia z biopsją węzła wartowniczego (2 mies. temu)',
    chemoSchedule: '21 dni (EC) / co tydzień (Paclitaxel)',
    tamoxifenFreq: '1x dziennie',
    escitalopramFreq: '1x rano',
    ondansetronFreq: 'w razie nudności',
    allergyPenicillin: 'Penicylina',
    hotFlashes: 'uderzenia gorąca',
    jointPain: 'bóle stawów',
    notes: {
      chemo1: 'Pierwsza chemia EC. Tolerancja dobra.',
      chemo2: 'Neutropenia G2, nadir dzień 10.',
      chemo3: 'Tolerance ok. Neuropatia obwodowa stopień 1.',
      chemo4: 'Ostatni cykl EC. Przejście na Paclitaxel weekly.',
      paclitaxel1: 'Pierwszy Paclitaxel. Mrowienie w dłoniach.',
      paclitaxel2: 'Paclitaxel #2. Neuropatia stabilna.',
      bloodBaseline: 'Przed rozpoczęciem leczenia — baseline',
      bloodNadir: 'Nadir po 2. EC — neutropenia G2',
      bloodPreEC4: 'Przed 4. EC — kwalifikacja OK',
      bloodPrePaclitaxel: 'Przed Paclitaxel #1 — hemoglobina w trendzie spadkowym',
      bloodWeekly: 'Kontrola tygodniowa — CA 15-3 trend spadkowy (dobra odpowiedź)',
      painNeuropathy: 'dłonie, stopy (neuropatia)',
      painJoint: 'stawowe',
      rtFirstSession: 'Pierwsza sesja RT',
      rtTenthSession: 'Sesja #10 — skóra CTCAE 1',
    },
    imaging: {
      breastLeft: 'Pierś lewa',
      breastLeftAxillae: 'Pierś lewa + pachy',
      tumorLocation: 'Pierś lewa, kwadrant górny zewnętrzny',
      tumorLocShort: 'KGZ piersi lewej',
      axillaLeft: 'Pacha lewa',
      mammoNotes: 'Mammografia diagnostyczna — guz 28mm w kwadrancie górnym zewnętrznym.',
      usgNotes: 'Kontrola po 3 cyklach EC — zmniejszenie guza.',
      mammoOriginalText: 'W KGZ piersi lewej guz lity, nieregularny, o wymiarach 28x22mm. BIRADS 5.',
      mammoConclusion: 'BIRADS 5 — wysoce podejrzane. Zalecana biopsja.',
      usgOriginalText: 'Guz w KGZ piersi lewej zmniejszony do 18x14mm (poprzednio 28x22mm). Partial response. Węzły chłonne pachowe w normie.',
      usgConclusion: 'Partial response (RECIST PR). Dobra odpowiedź na chemioterapię.',
      partialResponseDesc: 'Partial response — zmniejszenie o 36%',
      lymphNodeChange: 'Regresja z 15mm do 8mm',
    },
  };
  if (lang === 'de') return {
    diagnosis: 'Invasives linksseitiges Mammakarzinom',
    facility: 'Onkologisches Zentrum — Charité Berlin',
    city: 'Berlin',
    country: 'Deutschland',
    radioTherapyName: 'RT linke Brust',
    radioTargetArea: 'Linke Brust + supraklavikulärer Bereich',
    radioFrequency: 'Mo-Fr',
    surgery1: 'Tumorektomie mit Sentinel-Lymphknoten-Biopsie (vor 2 Monaten)',
    chemoSchedule: '21 Tage (EC) / wöchentlich (Paclitaxel)',
    tamoxifenFreq: '1x täglich',
    escitalopramFreq: '1x morgens',
    ondansetronFreq: 'bei Übelkeit',
    allergyPenicillin: 'Penicillin',
    hotFlashes: 'Hitzewallungen',
    jointPain: 'Gelenkschmerzen',
    notes: {
      chemo1: 'Erste EC-Chemotherapie. Verträglichkeit gut.',
      chemo2: 'Neutropenie G2, Tiefpunkt Tag 10.',
      chemo3: 'Verträglichkeit OK. Periphere Neuropathie Grad 1.',
      chemo4: 'Letzter EC-Zyklus. Übergang zu Paclitaxel wöchentlich.',
      paclitaxel1: 'Erstes Paclitaxel. Kribbeln in den Händen.',
      paclitaxel2: 'Paclitaxel #2. Neuropathie stabil.',
      bloodBaseline: 'Vor Behandlungsbeginn — Baseline',
      bloodNadir: 'Tiefpunkt nach 2. EC — Neutropenie G2',
      bloodPreEC4: 'Vor 4. EC — Qualifikation OK',
      bloodPrePaclitaxel: 'Vor Paclitaxel #1 — Hämoglobin im abnehmenden Trend',
      bloodWeekly: 'Wöchentliche Kontrolle — CA 15-3 fallender Trend (gute Antwort)',
      painNeuropathy: 'Hände, Füße (Neuropathie)',
      painJoint: 'Gelenke',
      rtFirstSession: 'Erste RT-Sitzung',
      rtTenthSession: 'Sitzung #10 — Haut CTCAE 1',
    },
    imaging: {
      breastLeft: 'Linke Brust',
      breastLeftAxillae: 'Linke Brust + Achseln',
      tumorLocation: 'Linke Brust, oberer äußerer Quadrant',
      tumorLocShort: 'oberer äußerer Quadrant linke Brust',
      axillaLeft: 'Linke Achsel',
      mammoNotes: 'Diagnostische Mammographie — Tumor 28mm im oberen äußeren Quadranten.',
      usgNotes: 'Kontrolle nach 3 EC-Zyklen — Tumorverkleinerung.',
      mammoOriginalText: 'Im oberen äußeren Quadranten der linken Brust solider, irregulärer Tumor von 28x22mm. BIRADS 5.',
      mammoConclusion: 'BIRADS 5 — hochverdächtig. Biopsie empfohlen.',
      usgOriginalText: 'Tumor im oberen äußeren Quadranten der linken Brust auf 18x14mm verkleinert (vorher 28x22mm). Partial Response. Axilläre Lymphknoten unauffällig.',
      usgConclusion: 'Partial Response (RECIST PR). Gutes Ansprechen auf Chemotherapie.',
      partialResponseDesc: 'Partial Response — Reduktion um 36%',
      lymphNodeChange: 'Regression von 15mm auf 8mm',
    },
  };
  return {
    diagnosis: 'Invasive left breast cancer',
    facility: 'Memorial Cancer Center',
    city: 'New York',
    country: 'USA',
    radioTherapyName: 'RT left breast',
    radioTargetArea: 'Left breast + supraclavicular region',
    radioFrequency: 'Mon-Fri',
    surgery1: 'Lumpectomy with sentinel node biopsy (2 months ago)',
    chemoSchedule: '21 days (EC) / weekly (Paclitaxel)',
    tamoxifenFreq: '1x daily',
    escitalopramFreq: '1x morning',
    ondansetronFreq: 'as needed for nausea',
    allergyPenicillin: 'Penicillin',
    hotFlashes: 'hot flashes',
    jointPain: 'joint pain',
    notes: {
      chemo1: 'First EC chemo. Good tolerance.',
      chemo2: 'Neutropenia G2, nadir day 10.',
      chemo3: 'Tolerance OK. Peripheral neuropathy grade 1.',
      chemo4: 'Last EC cycle. Transition to Paclitaxel weekly.',
      paclitaxel1: 'First Paclitaxel. Tingling in hands.',
      paclitaxel2: 'Paclitaxel #2. Neuropathy stable.',
      bloodBaseline: 'Before treatment start — baseline',
      bloodNadir: 'Nadir after 2nd EC — neutropenia G2',
      bloodPreEC4: 'Before 4th EC — qualification OK',
      bloodPrePaclitaxel: 'Before Paclitaxel #1 — hemoglobin in declining trend',
      bloodWeekly: 'Weekly check — CA 15-3 declining trend (good response)',
      painNeuropathy: 'hands, feet (neuropathy)',
      painJoint: 'joints',
      rtFirstSession: 'First RT session',
      rtTenthSession: 'Session #10 — skin CTCAE 1',
    },
    imaging: {
      breastLeft: 'Left breast',
      breastLeftAxillae: 'Left breast + axillae',
      tumorLocation: 'Left breast, upper outer quadrant',
      tumorLocShort: 'Upper outer quadrant, left breast',
      axillaLeft: 'Left axilla',
      mammoNotes: 'Diagnostic mammography — 28mm tumor in upper outer quadrant.',
      usgNotes: 'Follow-up after 3 EC cycles — tumor shrinkage.',
      mammoOriginalText: 'Solid, irregular tumor in upper outer quadrant of left breast, 28x22mm. BIRADS 5.',
      mammoConclusion: 'BIRADS 5 — highly suspicious. Biopsy recommended.',
      usgOriginalText: 'Tumor in upper outer quadrant of left breast reduced to 18x14mm (previously 28x22mm). Partial response. Axillary lymph nodes normal.',
      usgConclusion: 'Partial response (RECIST PR). Good response to chemotherapy.',
      partialResponseDesc: 'Partial response — 36% reduction',
      lymphNodeChange: 'Regression from 15mm to 8mm',
    },
  };
}

// ==================== PATIENT ====================

function createDemoPatient(): PatientProfile {
  const lang = getDemoLang();
  const s = getDemoStrings(lang);
  const treatments: TreatmentProtocol[] = [
    {
      id: uuidv4(),
      type: 'chemotherapy',
      name: 'EC → Paclitaxel',
      startDate: daysAgo(84),
      status: 'active',
    },
    {
      id: uuidv4(),
      type: 'radiotherapy',
      name: s.radioTherapyName,
      startDate: daysAgo(20),
      status: 'active',
      radiotherapy: {
        type: 'external_beam',
        targetArea: s.radioTargetArea,
        totalDoseGy: 50,
        fractions: 25,
        dosePerFractionGy: 2,
        frequency: s.radioFrequency,
        startDate: daysAgo(20),
        sessions: Array.from({ length: 14 }, (_, i) => ({
          id: uuidv4(),
          date: daysAgo(20 - i),
          fractionNumber: i + 1,
          completed: true,
          doseGy: 2,
          cumulativeDoseGy: (i + 1) * 2,
          sideEffects: {
            skinToxicity: (i < 7 ? 0 : i < 12 ? 1 : 2) as 0 | 1 | 2,
            fatigue: clamp(Math.round(2 + i * 0.4 + Math.random()), 1, 8),
          },
        })),
      },
    },
    {
      id: uuidv4(),
      type: 'hormonal_therapy',
      name: 'Tamoxifen',
      startDate: daysAgo(60),
      status: 'active',
      drugs: [{
        name: 'Tamoxifen', genericName: 'tamoxifen', dose: '20mg', frequency: s.tamoxifenFreq,
        startDate: daysAgo(60), cyp450: ['CYP2D6', 'CYP3A4'], interactions: [], sideEffects: [s.hotFlashes, s.jointPain], active: true,
      }],
    },
  ];

  return {
    id: uuidv4(),
    name: 'Anna',
    displayName: 'Anna',
    age: 42,
    weight: 65,
    diagnosis: s.diagnosis,
    stage: 'IIA',
    molecularSubtype: 'Luminal B',
    surgeries: [s.surgery1],
    currentChemo: 'EC × 4 → Paclitaxel weekly × 12',
    chemoCycle: s.chemoSchedule,
    psychiatricMeds: [{
      name: 'Escitalopram', genericName: 'escitalopram', dose: '10mg', frequency: s.escitalopramFreq,
      startDate: daysAgo(90), cyp450: ['CYP2C19', 'CYP3A4'], interactions: [], sideEffects: [], active: true,
    }],
    oncologyMeds: [{
      name: 'Tamoxifen', genericName: 'tamoxifen', dose: '20mg', frequency: s.tamoxifenFreq,
      startDate: daysAgo(60), cyp450: ['CYP2D6', 'CYP3A4'], interactions: [], sideEffects: [], active: true,
    }],
    otherMeds: [{
      name: 'Ondansetron', genericName: 'ondansetron', dose: '8mg', frequency: s.ondansetronFreq,
      startDate: daysAgo(84), cyp450: ['CYP3A4'], interactions: [], sideEffects: [], active: true,
    }],
    allergies: [s.allergyPenicillin],
    preferences: [],
    pii: {
      firstName: 'Anna', lastName: 'Demo', pesel: '82010112345',
      address: lang === 'pl' ? 'ul. Przykładowa 1, Warszawa' : lang === 'de' ? 'Beispielstr. 1, Berlin' : '1 Example St, New York',
      phone: lang === 'pl' ? '+48 500 000 000' : lang === 'de' ? '+49 30 0000 0000' : '+1 555 000 0000',
      email: 'anna.demo@example.com', hospitalIds: ['DEMO-2024-1234'],
    },
    location: {
      residenceCountry: s.country, residenceCity: s.city,
      treatmentCountry: s.country, treatmentCity: s.city,
      treatmentFacility: s.facility,
      guidelineRegion: lang === 'en' ? 'usa' : 'europe',
    },
    languages: {
      appLanguage: lang, documentLanguages: [lang], preferredMedicalTerms: lang,
    },
    treatments,
    breastCancerSubtype: 'luminal_b',
    erStatus: 'positive',
    prStatus: 'positive',
    her2Status: 'negative',
    ki67: 35,
    brcaStatus: 'negative',
    pdl1Status: 'not_tested',
    piK3caStatus: 'not_tested',
    disclaimerAccepted: { accepted: true, acceptedAt: new Date().toISOString(), version: '1.0' },
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// ==================== CHEMO SESSIONS ====================

function createDemoChemo(): ChemoSession[] {
  const lang = getDemoLang();
  const s = getDemoStrings(lang);
  const ecDose = lang === 'pl' ? 'EC pełna dawka' : lang === 'de' ? 'EC volle Dosis' : 'EC full dose';
  return [
    {
      id: uuidv4(), date: daysAgo(84), plannedDate: daysAgo(84), actualDate: daysAgo(84),
      status: 'completed', drugs: ['Epirubicin', 'Cyclophosphamide'], dose: ecDose,
      cycle: 1, notes: s.notes.chemo1, sideEffects: ['nausea G1', 'fatigue'],
    },
    {
      id: uuidv4(), date: daysAgo(63), plannedDate: daysAgo(63), actualDate: daysAgo(63),
      status: 'completed', drugs: ['Epirubicin', 'Cyclophosphamide'], dose: ecDose,
      cycle: 2, notes: s.notes.chemo2, sideEffects: ['neutropenia G2', 'nausea G2', 'alopecia'],
    },
    {
      id: uuidv4(), date: daysAgo(42), plannedDate: daysAgo(42), actualDate: daysAgo(42),
      status: 'completed', drugs: ['Epirubicin', 'Cyclophosphamide'], dose: ecDose,
      cycle: 3, notes: s.notes.chemo3, sideEffects: ['neuropathy G1', 'fatigue', 'myalgia'],
    },
    {
      id: uuidv4(), date: daysAgo(21), plannedDate: daysAgo(21), actualDate: daysAgo(21),
      status: 'completed', drugs: ['Epirubicin', 'Cyclophosphamide'], dose: ecDose,
      cycle: 4, notes: s.notes.chemo4, sideEffects: ['fatigue G2', 'nausea G1'],
    },
    {
      id: uuidv4(), date: daysAgo(14), plannedDate: daysAgo(14), actualDate: daysAgo(14),
      status: 'completed', drugs: ['Paclitaxel'], dose: '80mg/m² weekly',
      cycle: 5, notes: s.notes.paclitaxel1, sideEffects: ['neuropathy G1'],
    },
    {
      id: uuidv4(), date: daysAgo(7), plannedDate: daysAgo(7), actualDate: daysAgo(7),
      status: 'completed', drugs: ['Paclitaxel'], dose: '80mg/m² weekly',
      cycle: 6, notes: s.notes.paclitaxel2, sideEffects: ['neuropathy G1', 'arthralgia'],
    },
    {
      id: uuidv4(), date: daysAgo(0), plannedDate: daysAgo(0),
      status: 'planned', drugs: ['Paclitaxel'], dose: '80mg/m² weekly',
      cycle: 7, notes: '', sideEffects: [],
    },
  ];
}

// ==================== BLOOD WORK ====================

function createDemoBlood(): BloodWork[] {
  const s = getDemoStrings(getDemoLang());
  return [
    {
      id: uuidv4(), date: daysAgo(85), source: 'manual',
      markers: { wbc: 6.8, neutrophils: 4.2, hgb: 13.1, plt: 245, rbc: 4.4, alt: 22, ast: 19, creatinine: 0.8, crp: 2, ca153: 18 },
      notes: s.notes.bloodBaseline,
    },
    {
      id: uuidv4(), date: daysAgo(53), source: 'manual',
      markers: { wbc: 3.2, neutrophils: 1.4, hgb: 11.8, plt: 180, rbc: 3.9, alt: 28, ast: 25, creatinine: 0.9, crp: 8, ca153: 15 },
      notes: s.notes.bloodNadir,
    },
    {
      id: uuidv4(), date: daysAgo(32), source: 'manual',
      markers: { wbc: 4.1, neutrophils: 2.1, hgb: 11.2, plt: 165, rbc: 3.8, alt: 32, ast: 30, creatinine: 0.8, crp: 5, ca153: 12 },
      notes: s.notes.bloodPreEC4,
    },
    {
      id: uuidv4(), date: daysAgo(15), source: 'photo_extraction',
      markers: { wbc: 5.0, neutrophils: 2.8, hgb: 10.9, plt: 195, rbc: 3.7, alt: 24, ast: 21, creatinine: 0.7, crp: 3, tsh: 2.8, ca153: 11 },
      notes: s.notes.bloodPrePaclitaxel,
    },
    {
      id: uuidv4(), date: daysAgo(3), source: 'photo_extraction',
      markers: { wbc: 4.5, neutrophils: 2.3, hgb: 10.5, plt: 188, rbc: 3.6, alt: 20, ast: 18, creatinine: 0.7, crp: 4, ca153: 10 },
      notes: s.notes.bloodWeekly,
    },
  ];
}

// ==================== DAILY LOGS ====================

function createDemoDailyLogs(): DailyLog[] {
  const s = getDemoStrings(getDemoLang());
  const logs: DailyLog[] = [];

  // Generate 30 days of logs with realistic patterns
  for (let i = 29; i >= 0; i--) {
    const date = daysAgo(i);

    // Determine chemo phase effect (last EC was 21 days ago, last Paclitaxel 7 days ago)
    let energyBase: number, painBase: number, nauseaBase: number, moodBase: number;

    if (i >= 21 && i <= 24) {
      // Days 0-3 after last EC = Phase A (crisis)
      energyBase = 3; painBase = 4; nauseaBase = 6; moodBase = 4;
    } else if (i >= 17 && i <= 20) {
      // Days 4-7 after EC = Phase B (recovery)
      energyBase = 5; painBase = 2; nauseaBase = 3; moodBase = 5;
    } else if (i >= 8 && i <= 16) {
      // Phase C (rebuild) + starting RT fatigue
      energyBase = 6; painBase = 1; nauseaBase = 1; moodBase = 7;
    } else if (i >= 5 && i <= 7) {
      // After Paclitaxel #2 + RT ongoing = combined fatigue
      energyBase = 4; painBase = 3; nauseaBase = 2; moodBase = 5;
    } else {
      // Recent days — RT cumulative fatigue building
      energyBase = 5; painBase = 2; nauseaBase = 1; moodBase = 6;
    }

    // Add noise
    const energy = clamp(Math.round(energyBase + randomBetween(-1.5, 1.5)), 1, 10);
    const pain = clamp(Math.round(painBase + randomBetween(-1, 2)), 0, 10);
    const nausea = clamp(Math.round(nauseaBase + randomBetween(-1, 2)), 0, 10);
    const mood = clamp(Math.round(moodBase + randomBetween(-1.5, 1.5)), 1, 10);

    // Determine chemo phase
    let chemoPhase: 'A' | 'B' | 'C' | null = null;
    let dayInCycle = 0;

    if (i <= 21) {
      dayInCycle = 21 - i;
      if (dayInCycle <= 3) chemoPhase = 'A';
      else if (dayInCycle <= 7) chemoPhase = 'B';
      else chemoPhase = 'C';
    }

    const log: DailyLog = {
      id: uuidv4(),
      date,
      time: `${7 + Math.floor(Math.random() * 3)}:${Math.floor(Math.random() * 60).toString().padStart(2, '0')}`,
      energy,
      pain,
      painLocation: pain > 2 ? (pain > 4 ? s.notes.painNeuropathy : s.notes.painJoint) : undefined,
      nausea,
      mood,
      neuropathy: i < 14 ? clamp(Math.round(2 + Math.random() * 2), 0, 5) : 0,
      appetite: clamp(Math.round(energy * 0.8 + randomBetween(-1, 1)), 1, 10),
      weight: Math.round((64 + (30 - i) * -0.05 + randomBetween(-0.3, 0.3)) * 10) / 10,
      temperature: Math.round((36.4 + randomBetween(-0.2, 0.4)) * 10) / 10,
      bpSystolic: Math.round(110 + randomBetween(-10, 15)),
      bpDiastolic: Math.round(70 + randomBetween(-5, 10)),
      heartRate: Math.round(72 + randomBetween(-8, 15)),
      sleep: {
        hours: Math.round((6.5 + randomBetween(-1.5, 1.5)) * 10) / 10,
        quality: clamp(Math.round(mood * 0.7 + randomBetween(-1, 1)), 1, 10),
      },
      hydration: clamp(Math.round(5 + randomBetween(-2, 3)), 1, 10),
      notes: '',
      chemoPhase,
      dayInCycle,
      treatmentPhase: chemoPhase === 'A' ? 'crisis' : chemoPhase === 'B' ? 'recovery' : chemoPhase === 'C' ? 'rebuild' : undefined,
      treatmentType: chemoPhase ? 'chemotherapy' : undefined,
      // RT-specific fields for recent days
      ...(i <= 20 ? {
        skinToxicityGrade: (i > 12 ? 0 : i > 7 ? 1 : 2) as 0 | 1 | 2,
        radiationFatigue: clamp(Math.round(2 + (20 - i) * 0.3 + randomBetween(-1, 1)), 1, 8),
      } : {}),
      // Hormonal therapy
      ...(i <= 25 ? {
        hotFlashes: Math.random() > 0.6 ? clamp(Math.round(2 + randomBetween(0, 3)), 0, 5) : 0,
        jointPain: Math.random() > 0.5 ? clamp(Math.round(1 + randomBetween(0, 2)), 0, 5) : 0,
      } : {}),
    };

    // Add notes to some days — localized
    const lang = getDemoLang();
    const dailyNotes = lang === 'pl' ? {
      d21: 'Dzień chemii EC #4. Zmęczenie od wieczora, nudności kontrolowane ondansetronem.',
      d19: 'Trzeci dzień po chemii, najgorzej. Cały dzień w łóżku.',
      d14: 'Pierwszy Paclitaxel — mrowienie w palcach po 2h. Poza tym ok.',
      d10: 'RT sesja #10. Skóra lekko różowa w polu napromieniania.',
      d7: 'Paclitaxel #2 + RT #14. Skumulowane zmęczenie. Dzwoniłam do onkologa.',
      d3: 'Lepszy dzień. Spacer 30 min. Apetyt wraca.',
      d1: 'RT skóra CTCAE 2, dostałam krem. Energia ok.',
    } : lang === 'de' ? {
      d21: 'Chemo-Tag EC #4. Müdigkeit ab dem Abend, Übelkeit mit Ondansetron kontrolliert.',
      d19: 'Dritter Tag nach der Chemo, am schlimmsten. Den ganzen Tag im Bett.',
      d14: 'Erstes Paclitaxel — Kribbeln in den Fingern nach 2 h. Sonst OK.',
      d10: 'RT-Sitzung #10. Haut leicht rosa im Bestrahlungsfeld.',
      d7: 'Paclitaxel #2 + RT #14. Kumulierte Müdigkeit. Habe den Onkologen angerufen.',
      d3: 'Besserer Tag. 30 min Spaziergang. Appetit kehrt zurück.',
      d1: 'RT-Haut CTCAE 2, habe eine Creme bekommen. Energie OK.',
    } : {
      d21: 'EC chemo day #4. Fatigue from the evening, nausea controlled with ondansetron.',
      d19: 'Third day after chemo, the worst. In bed all day.',
      d14: 'First Paclitaxel — tingling in fingers after 2h. Otherwise OK.',
      d10: 'RT session #10. Skin slightly pink in radiation field.',
      d7: 'Paclitaxel #2 + RT #14. Accumulated fatigue. Called the oncologist.',
      d3: 'Better day. 30 min walk. Appetite returning.',
      d1: 'RT skin CTCAE 2, got a cream. Energy OK.',
    };
    if (i === 21) log.notes = dailyNotes.d21;
    if (i === 19) log.notes = dailyNotes.d19;
    if (i === 14) log.notes = dailyNotes.d14;
    if (i === 10) log.notes = dailyNotes.d10;
    if (i === 7) log.notes = dailyNotes.d7;
    if (i === 3) log.notes = dailyNotes.d3;
    if (i === 1) log.notes = dailyNotes.d1;

    logs.push(log);
  }

  return logs;
}

// ==================== WEARABLE DATA ====================

function createDemoWearable(): WearableData[] {
  const data: WearableData[] = [];

  for (let i = 13; i >= 0; i--) {
    const isChemoWeek = i >= 19;
    data.push({
      id: uuidv4(),
      date: daysAgo(i),
      source: 'manual',
      rhr: Math.round(68 + (isChemoWeek ? 12 : 5) + randomBetween(-3, 5)),
      hrv: Math.round(35 + (isChemoWeek ? -10 : 0) + randomBetween(-5, 8)),
      spo2: Math.round(96 + randomBetween(-1, 2)),
      sleepHours: Math.round((6.5 + randomBetween(-1.5, 1.5)) * 10) / 10,
      deepSleep: Math.round((1.2 + randomBetween(-0.5, 0.5)) * 10) / 10,
      remSleep: Math.round((1.5 + randomBetween(-0.5, 0.5)) * 10) / 10,
      lightSleep: Math.round((3.5 + randomBetween(-1, 1)) * 10) / 10,
      steps: Math.round(3000 + randomBetween(-1500, 4000)),
      activeMinutes: Math.round(20 + randomBetween(-15, 30)),
      biocharge: Math.round(40 + randomBetween(-15, 30)),
      skinTemperature: Math.round((36.2 + randomBetween(-0.3, 0.5)) * 10) / 10,
    });
  }

  return data;
}

// ==================== SUPPLEMENTS ====================

function createDemoSupplements(): SupplementLog[] {
  const logs: SupplementLog[] = [];

  for (let i = 13; i >= 0; i--) {
    logs.push({
      id: uuidv4(),
      date: daysAgo(i),
      supplements: [
        { name: 'Witamina D3', dose: '4000 IU', taken: Math.random() > 0.1, time: '08:00' },
        { name: 'Omega-3', dose: '1000mg', taken: Math.random() > 0.15, time: '08:00' },
        { name: 'Probiotyk', dose: '1 kaps', taken: Math.random() > 0.2, time: '12:00' },
        { name: 'Magnez', dose: '400mg', taken: Math.random() > 0.1, time: '20:00' },
        { name: 'L-glutamina', dose: '5g', taken: Math.random() > 0.3, time: '20:00' },
      ],
    });
  }

  return logs;
}

// ==================== MEALS ====================

function createDemoMeals(): MealLog[] {
  const lang = getDemoLang();
  const meals: MealLog[] = [];

  const breakfast = lang === 'pl'
    ? ['Owsianka z bananem i orzechami', 'Jajecznica z tostami', 'Jogurt grecki z granolą', 'Kanapki z avocado']
    : lang === 'de'
    ? ['Haferflocken mit Banane und Nüssen', 'Rührei mit Toast', 'Griechischer Joghurt mit Granola', 'Avocado-Sandwiches']
    : ['Oatmeal with banana and nuts', 'Scrambled eggs with toast', 'Greek yogurt with granola', 'Avocado sandwiches'];
  const lunch = lang === 'pl'
    ? ['Zupa krem z brokułów + kurczak', 'Ryż z łososiem i warzywami', 'Makaron z sosem bolognese', 'Sałatka z grillowaną piersią kurczaka']
    : lang === 'de'
    ? ['Brokkoli-Cremesuppe + Hähnchen', 'Reis mit Lachs und Gemüse', 'Pasta mit Bolognese-Sauce', 'Salat mit gegrillter Hähnchenbrust']
    : ['Broccoli cream soup + chicken', 'Rice with salmon and vegetables', 'Pasta with bolognese sauce', 'Salad with grilled chicken breast'];
  const dinner = lang === 'pl'
    ? ['Omlet z warzywami', 'Twarożek z oliwą i pomidorami', 'Zupa jarzynowa z grzankami', 'Kasza gryczana z kotletem']
    : lang === 'de'
    ? ['Omelett mit Gemüse', 'Quark mit Olivenöl und Tomaten', 'Gemüsesuppe mit Croutons', 'Buchweizen mit Frikadelle']
    : ['Vegetable omelet', 'Cottage cheese with olive oil and tomatoes', 'Vegetable soup with croutons', 'Buckwheat with cutlet'];

  for (let i = 6; i >= 0; i--) {
    meals.push({
      id: uuidv4(), date: daysAgo(i), mealType: 'breakfast',
      description: breakfast[Math.floor(Math.random() * 4)],
      protein: Math.round(15 + randomBetween(-5, 10)), calories: Math.round(350 + randomBetween(-50, 100)),
      toleratedWell: Math.random() > 0.2,
    });
    meals.push({
      id: uuidv4(), date: daysAgo(i), mealType: 'lunch',
      description: lunch[Math.floor(Math.random() * 4)],
      protein: Math.round(30 + randomBetween(-5, 15)), calories: Math.round(550 + randomBetween(-100, 150)),
      toleratedWell: Math.random() > 0.15,
    });
    meals.push({
      id: uuidv4(), date: daysAgo(i), mealType: 'dinner',
      description: dinner[Math.floor(Math.random() * 4)],
      protein: Math.round(20 + randomBetween(-5, 10)), calories: Math.round(400 + randomBetween(-80, 120)),
      toleratedWell: Math.random() > 0.1,
    });
  }

  return meals;
}

// ==================== IMAGING ====================

function createDemoImaging(): ImagingStudy[] {
  const lang = getDemoLang();
  const s = getDemoStrings(lang);
  const img = s.imaging;
  return [
    {
      id: uuidv4(), date: daysAgo(90), type: 'mammography', bodyRegion: img.breastLeft,
      images: [], findings: '',
      notes: img.mammoNotes,
      tumors: [{ location: img.tumorLocation, sizeMm: [28, 22], recistResponse: undefined }],
      radiologistReport: {
        originalText: img.mammoOriginalText,
        originalLanguage: lang,
        extractedData: {
          tumors: [{
            id: uuidv4(), location: img.tumorLocShort, locationTranslated: 'Upper outer quadrant, left breast',
            currentSize: { dimensions: [28, 22], description: '28x22mm' },
          }],
          metastases: [], lymphNodes: [{
            id: uuidv4(), location: img.axillaLeft, locationTranslated: 'Left axilla',
            size: 15, status: 'suspicious',
          }],
          otherFindings: [], conclusion: img.mammoConclusion,
        },
      },
    },
    {
      id: uuidv4(), date: daysAgo(30), type: 'USG', bodyRegion: img.breastLeftAxillae,
      images: [], findings: '',
      notes: img.usgNotes,
      tumors: [{
        location: img.tumorLocation, sizeMm: [18, 14],
        recistResponse: 'PR', previousSize: [28, 22], changePercent: -36,
      }],
      radiologistReport: {
        originalText: img.usgOriginalText,
        originalLanguage: lang,
        extractedData: {
          tumors: [{
            id: uuidv4(), location: img.tumorLocShort, locationTranslated: 'Upper outer quadrant, left breast',
            currentSize: { dimensions: [18, 14], description: '18x14mm' },
            previousSize: { dimensions: [28, 22], studyDate: daysAgo(90), studyId: '' },
            change: {
              type: 'shrinking', percentChange: -36, recist: 'PR',
              description: img.partialResponseDesc,
            },
          }],
          metastases: [], lymphNodes: [{
            id: uuidv4(), location: img.axillaLeft, locationTranslated: 'Left axilla',
            size: 8, status: 'normal', previousSize: 15, change: img.lymphNodeChange,
          }],
          otherFindings: [], conclusion: img.usgConclusion,
        },
      },
    },
  ];
}

// ==================== TREATMENT SESSIONS ====================

function createDemoTreatmentSessions(): TreatmentSession[] {
  const s = getDemoStrings(getDemoLang());
  const sessions: TreatmentSession[] = [];

  // RT sessions
  for (let i = 0; i < 14; i++) {
    sessions.push({
      id: uuidv4(),
      date: daysAgo(20 - i),
      treatmentType: 'radiotherapy',
      status: 'completed',
      details: { fractionNumber: i + 1, doseGy: 2, cumulativeDoseGy: (i + 1) * 2 },
      notes: i === 0 ? s.notes.rtFirstSession : i === 9 ? s.notes.rtTenthSession : undefined,
    });
  }

  return sessions;
}

// ==================== CALENDAR NOTES ====================

function createDemoCalendarNotes(): CalendarNote[] {
  const lang = getDemoLang();
  const cal = lang === 'pl' ? {
    docTitle: 'Wizyta u onkologa', docDesc: 'Kontrola po 4x EC, ocena odpowiedzi',
    bloodTitle: 'Morfologia + biochemia', bloodDesc: 'Przed Paclitaxel #4',
    imgTitle: 'USG kontrolne', imgDesc: 'Ocena odpowiedzi po chemii',
  } : lang === 'de' ? {
    docTitle: 'Termin beim Onkologen', docDesc: 'Kontrolle nach 4x EC, Ansprechbewertung',
    bloodTitle: 'Blutbild + Biochemie', bloodDesc: 'Vor Paclitaxel #4',
    imgTitle: 'Kontroll-Ultraschall', imgDesc: 'Ansprechbewertung nach Chemo',
  } : {
    docTitle: 'Oncologist visit', docDesc: 'Follow-up after 4x EC, response assessment',
    bloodTitle: 'Blood count + biochemistry', bloodDesc: 'Before Paclitaxel #4',
    imgTitle: 'Follow-up ultrasound', imgDesc: 'Response assessment after chemo',
  };
  return [
    {
      id: uuidv4(), date: daysAgo(-3), type: 'doctor_visit',
      title: cal.docTitle, description: cal.docDesc, time: '10:30',
    },
    {
      id: uuidv4(), date: daysAgo(-7), type: 'blood_test',
      title: cal.bloodTitle, description: cal.bloodDesc, time: '07:00',
    },
    {
      id: uuidv4(), date: daysAgo(-14), type: 'imaging',
      title: cal.imgTitle, description: cal.imgDesc, time: '09:00',
    },
  ];
}

// ==================== MAIN FUNCTIONS ====================

/**
 * Enter demo mode.
 * Switches to a SEPARATE demo database — user data is never touched.
 */
export async function loadDemoData(): Promise<void> {
  // Read user's current preferences before switching
  const currentSettings = await getSettings();
  const currentLang = currentSettings?.language || 'pl';
  const currentTheme = currentSettings?.theme || 'light';

  // Switch to demo database (separate IndexedDB, user data untouched)
  activateDemoDb();

  // Generate all demo data into the demo database
  const patient = createDemoPatient();
  const chemoSessions = createDemoChemo();
  const bloodWork = createDemoBlood();
  const dailyLogs = createDemoDailyLogs();
  const wearableData = createDemoWearable();
  const supplementLogs = createDemoSupplements();
  const mealLogs = createDemoMeals();
  const imagingStudies = createDemoImaging();
  const treatmentSessions = createDemoTreatmentSessions();
  const calendarNotes = createDemoCalendarNotes();

  await Promise.all([
    savePatient(patient),
    db.chemo.bulkPut(chemoSessions),
    db.blood.bulkPut(bloodWork),
    db.daily.bulkPut(dailyLogs),
    db.wearable.bulkPut(wearableData),
    db.supplements.bulkPut(supplementLogs),
    db.meals.bulkPut(mealLogs),
    db.imaging.bulkPut(imagingStudies),
    db.treatmentSessions.bulkPut(treatmentSessions),
    db.calendarNotes.bulkPut(calendarNotes),
  ]);

  // Set demo settings (preserving user's language/theme)
  await saveSettings({
    apiKey: '',
    aiProvider: 'anthropic',
    appMode: 'notebook',
    theme: currentTheme,
    language: currentLang,
    onboardingCompleted: true,
    demoMode: true,
    notifications: DEFAULT_NOTIFICATIONS,
  });
}

/**
 * Exit demo mode.
 * Deletes the demo database entirely — switches back to user's real database.
 * User data was never modified.
 */
export async function exitDemoData(): Promise<void> {
  await deactivateDemoDb();
  // db now points back to user's real database — all their data is intact
}
