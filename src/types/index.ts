export interface PatientLocation {
  residenceCountry: string;
  residenceCity?: string;
  treatmentCountry: string;
  treatmentCity?: string;
  treatmentFacility?: string;
  guidelineRegion: 'europe' | 'usa' | 'other';
}

export interface PatientLanguages {
  appLanguage: string;
  documentLanguages: string[];
  preferredMedicalTerms: string;
}

export const LANGUAGE_OPTIONS = [
  { code: 'pl', label: 'Polski' },
  { code: 'de', label: 'Niemiecki' },
  { code: 'en', label: 'Angielski' },
  { code: 'fr', label: 'Francuski' },
  { code: 'es', label: 'Hiszpański' },
  { code: 'it', label: 'Włoski' },
  { code: 'uk', label: 'Ukraiński' },
  { code: 'cs', label: 'Czeski' },
];

export type BreastCancerSubtype = 'luminal_a' | 'luminal_b' | 'her2_positive' | 'tnbc' | 'her2_low' | 'other' | 'unknown';
export type ReceptorStatus = 'positive' | 'negative' | 'unknown';
export type HER2Status = 'positive' | 'negative' | 'low' | 'unknown';
export type GeneticTestStatus = 'positive' | 'negative' | 'not_tested' | 'unknown';

export const EU_COUNTRIES = [
  'Polska', 'Niemcy', 'Francja', 'Włochy', 'Hiszpania', 'Holandia', 'Belgia',
  'Austria', 'Czechy', 'Szwecja', 'Dania', 'Finlandia', 'Norwegia', 'Irlandia',
  'Portugalia', 'Grecja', 'Rumunia', 'Węgry', 'Bułgaria', 'Chorwacja', 'Słowacja',
  'Słowenia', 'Litwa', 'Łotwa', 'Estonia', 'Cypr', 'Malta', 'Luksemburg',
  'Wielka Brytania', 'Szwajcaria', 'Islandia',
];

export const USA_COUNTRIES = ['USA', 'Stany Zjednoczone', 'Kanada'];

export function detectGuidelineRegion(treatmentCountry: string): 'europe' | 'usa' | 'other' {
  if (EU_COUNTRIES.includes(treatmentCountry)) return 'europe';
  if (USA_COUNTRIES.includes(treatmentCountry)) return 'usa';
  return 'other';
}

export interface PatientProfile {
  id: string;
  name: string;
  age: number;
  weight: number;
  diagnosis: string;
  stage: string;
  molecularSubtype?: string;
  surgeries: string[];
  currentChemo: string;
  chemoCycle: string;
  psychiatricMeds: DrugEntry[];
  oncologyMeds: DrugEntry[];
  otherMeds: DrugEntry[];
  allergies: string[];
  preferences: string[];
  pii: PIIData;
  displayName: string;
  diseaseProfile?: DiseaseProfile;
  diseaseProfileId?: string;
  location?: PatientLocation;
  languages?: PatientLanguages;
  treatments?: TreatmentProtocol[];
  immunotherapy?: ImmunotherapyEntry[];
  targetedTherapy?: TargetedTherapyEntry[];
  hormonalTherapy?: HormonalTherapyEntry[];
  surgicalProcedures?: SurgicalProcedure[];
  // Breast cancer specific biomarkers
  breastCancerSubtype?: BreastCancerSubtype;
  erStatus?: ReceptorStatus;
  prStatus?: ReceptorStatus;
  her2Status?: HER2Status;
  ki67?: number | null;
  brcaStatus?: 'brca1' | 'brca2' | 'negative' | 'not_tested' | 'unknown';
  pdl1Status?: GeneticTestStatus;
  pdl1Score?: number | null;
  piK3caStatus?: 'mutated' | 'wild_type' | 'not_tested' | 'unknown';
  disclaimerAccepted?: {
    accepted: boolean;
    acceptedAt: string;
    version: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface PIIData {
  firstName: string;
  lastName: string;
  pesel: string;
  address: string;
  phone: string;
  email: string;
  hospitalIds: string[];
}

export interface DrugEntry {
  name: string;
  genericName: string;
  dose: string;
  frequency: string;
  startDate: string;
  endDate?: string;
  cyp450: string[];
  interactions: string[];
  sideEffects: string[];
  active: boolean;
}

// ==================== TREATMENT TYPES ====================

export type TreatmentType = 'chemotherapy' | 'immunotherapy' | 'radiotherapy' | 'targeted_therapy' | 'hormonal_therapy' | 'combination';

export interface TreatmentProtocol {
  id: string;
  type: TreatmentType;
  name: string;
  startDate: string;
  endDate?: string;
  status: 'active' | 'completed' | 'paused' | 'switched';
  drugs?: DrugEntry[];
  radiotherapy?: RadiotherapyPlan;
  notes?: string;
}

export interface RadiotherapyPlan {
  type: 'external_beam' | 'brachytherapy' | 'proton' | 'stereotactic' | 'other';
  targetArea: string;
  totalDoseGy: number;
  fractions: number;
  dosePerFractionGy: number;
  frequency: string;
  startDate: string;
  endDate?: string;
  sessions: RadiotherapySession[];
  boostPlanned?: boolean;
  boostDoseGy?: number;
  boostFractions?: number;
  concurrentChemo?: boolean;
}

export interface RadiotherapySession {
  id: string;
  date: string;
  fractionNumber: number;
  completed: boolean;
  doseGy: number;
  cumulativeDoseGy: number;
  sideEffects?: {
    skinToxicity?: 0 | 1 | 2 | 3 | 4;
    fatigue?: number;
    pain?: number;
    swelling?: boolean;
    dysphagia?: boolean;
    nausea?: boolean;
    diarrhea?: boolean;
    cough?: boolean;
    other?: string;
  };
  notes?: string;
}

export interface ImmunotherapyEntry {
  id: string;
  drug: string;
  type: 'anti_pd1' | 'anti_pdl1' | 'anti_ctla4' | 'car_t' | 'other';
  doseSchedule: string;
  infusionDates: string[];
  irAEs: ImmuneRelatedAdverseEvent[];
}

export interface ImmuneRelatedAdverseEvent {
  id: string;
  date: string;
  type: 'skin' | 'gi' | 'hepatic' | 'endocrine' | 'pulmonary' | 'renal' | 'neurologic' | 'cardiac' | 'other';
  description: string;
  grade: 1 | 2 | 3 | 4;
  treatment?: string;
  resolved?: boolean;
  resolvedDate?: string;
}

export interface TargetedTherapyEntry {
  id: string;
  drug: string;
  target: string;
  doseSchedule: string;
  startDate: string;
  endDate?: string;
  sideEffects?: string[];
}

export interface HormonalTherapyEntry {
  id: string;
  drug: string;
  type: 'aromatase_inhibitor' | 'serm' | 'serd' | 'gnrh_agonist' | 'other';
  doseSchedule: string;
  startDate: string;
  endDate?: string;
  sideEffects?: string[];
}

// ==================== SURGICAL PROCEDURES ====================

export type SurgeryType =
  | 'mastectomy' | 'lumpectomy' | 'lymph_node_dissection' | 'oophorectomy'
  | 'hysterectomy' | 'tumor_resection' | 'port_catheter' | 'reconstruction'
  | 'orchiectomy' | 'colostomy' | 'other';

export interface SurgicalProcedure {
  id: string;
  date: string;
  type: SurgeryType;
  subtype?: string;
  description: string;
  hospital?: string;
  details: {
    mastectomy?: {
      side: 'left' | 'right' | 'bilateral';
      type: 'total' | 'skin_sparing' | 'nipple_sparing' | 'radical';
      reconstruction?: 'immediate' | 'delayed' | 'none';
      reconstructionType?: 'implant' | 'autologous_flap' | 'other';
    };
    lymphNodes?: {
      type: 'sentinel_biopsy' | 'axillary_dissection';
      side: 'left' | 'right' | 'bilateral';
      nodesRemoved?: number;
      nodesPositive?: number;
      lymphedemaRisk: boolean;
    };
    oophorectomy?: {
      type: 'bilateral' | 'unilateral';
      reason: 'prophylactic_brca' | 'treatment' | 'hormonal_suppression';
      surgicalMenopause: boolean;
    };
    tumorResection?: {
      location: string;
      type: 'complete' | 'partial' | 'debulking';
      margins?: 'clear' | 'close' | 'positive' | 'unknown';
    };
    portCatheter?: {
      type: 'port_a_cath' | 'picc_line' | 'hickman';
      action: 'insertion' | 'removal';
      location: string;
    };
    other?: { description: string };
  };
  recovery: {
    expectedDurationDays: number;
    restrictions: string[];
    drains?: boolean;
    drainsRemovedDate?: string;
    physiotherapy?: boolean;
    physiotherapyNotes?: string;
    hospitalDischargeDate?: string;
    followUpDates?: string[];
  };
  treatmentImpact: {
    chemoDelayed?: boolean;
    chemoResumeDate?: string;
    radiotherapyPlanned?: boolean;
    hormonalTherapyStarted?: boolean;
    treatmentNotes?: string;
  };
}

export interface ChemoSession {
  id: string;
  date: string;
  plannedDate: string;
  actualDate?: string;
  status: 'planned' | 'completed' | 'postponed' | 'cancelled' | 'modified';
  postponeReason?: string;
  postponedTo?: string;
  preChemoBlood?: PreChemoBlood;
  drugs: string[];
  dose?: string;
  doseReduction?: boolean;
  doseReductionPercent?: number;
  cycle: number;
  notes: string;
  sideEffects: string[];
  bloodBeforeChemo?: string;
}

export interface PreChemoBlood {
  wbc?: number;
  neutrophils?: number;
  plt?: number;
  hgb?: number;
  otherIssues?: string;
}

export interface BloodWork {
  id: string;
  date: string;
  source: 'manual' | 'photo_extraction' | 'document';
  sourceImageId?: string;
  markers: Record<string, number>;
  lab?: string;
  notes: string;
  aiAnalysis?: string;
}

export interface DailyLog {
  id: string;
  date: string;
  time: string;
  energy: number;
  pain: number;
  painLocation?: string;
  nausea: number;
  mood: number;
  neuropathy: number;
  appetite: number;
  weight?: number;
  temperature?: number;
  bpSystolic?: number;
  bpDiastolic?: number;
  heartRate?: number;
  sleep?: SleepData;
  bowel?: string;
  hydration?: number;
  notes: string;
  // Generic treatment phase (replaces chemo-only phase)
  treatmentPhase?: string | null;
  treatmentType?: TreatmentType | null;
  dayInCycle: number;
  // Backward compat — computed from treatmentPhase for chemo
  chemoPhase: 'A' | 'B' | 'C' | null;
  // RT-specific
  skinToxicityGrade?: 0 | 1 | 2 | 3 | 4;
  radiationFatigue?: number;
  // Immunotherapy-specific
  iraeSymptoms?: string[];
  // Hormonal therapy-specific
  hotFlashes?: number;
  jointPain?: number;
  // Surgery-specific
  woundStatus?: string;
  drainOutput?: number;
}

export interface SleepData {
  hours: number;
  quality: number;
  deepSleep?: number;
  remSleep?: number;
}

export interface TreatmentSession {
  id: string;
  date: string;
  treatmentType: TreatmentType;
  treatmentProtocolId?: string;
  status: 'planned' | 'completed' | 'postponed' | 'cancelled';
  details: Record<string, unknown>;
  notes?: string;
}

export interface WearableData {
  id: string;
  date: string;
  source: 'amazfit_helio' | 'apple_health' | 'health_connect' | 'withings' | 'garmin' | 'csv_import' | 'manual' | 'open_wearables';
  /** Cloud provider name when source='open_wearables' (e.g. 'oura', 'whoop') — for source-attribution UI */
  provider?: string;
  /** Withings/OW unique signals (medical-grade) */
  electrochemicalSkinConductance?: { hand?: number; foot?: number; date: string };
  visceralFat?: number;
  segmentalBodyComposition?: Record<string, number>;
  pulseWaveVelocity?: number;
  vo2max?: number;
  rhr: number;
  hrv: number;
  spo2: number;
  sleepHours: number;
  deepSleep: number;
  remSleep: number;
  lightSleep: number;
  steps: number;
  activeMinutes: number;
  biocharge: number;
  skinTemperature?: number;
  respiratoryRate?: number;
  stressLevel?: number;
}

export interface MealLog {
  id: string;
  date: string;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'supplement_drink';
  description: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  fiber?: number;
  hydration?: number;
  toleratedWell: boolean;
  notes?: string;
}

export interface SupplementLog {
  id: string;
  date: string;
  supplements: SupplementEntry[];
}

export interface SupplementEntry {
  name: string;
  dose: string;
  taken: boolean;
  time?: string;
}

export interface ImagingStudy {
  id: string;
  date: string;
  type: 'CT' | 'PET' | 'PET_CT' | 'MRI' | 'RTG' | 'USG' | 'mammography' | 'bone_scan' | 'bone_density' | 'other';
  bodyRegion: string;
  images: ImagingImage[];
  findings: string;
  aiAnalysis?: string;
  tumors?: TumorMeasurement[];
  metastases?: MetastasisRecord[];
  comparison?: ImagingComparison;
  radiologistReport?: RadiologistReport;
  combinedAnalysis?: CombinedAnalysis;
  notes: string;
}

export interface RadiologistReport {
  originalText: string;
  originalLanguage: string;
  translatedSummary?: string;
  extractedData?: {
    tumors: TumorFromReport[];
    metastases: MetastasisFromReport[];
    lymphNodes: LymphNodeFromReport[];
    otherFindings: string[];
    conclusion: string;
    recistAssessment?: string;
  };
}

export interface CombinedAnalysis {
  summary: string;
  comparisonWithPrevious?: string;
  questionsForDoctor: string[];
  analyzedAt: string;
}

export interface TumorFromReport {
  id: string;
  location: string;
  locationTranslated: string;
  currentSize: { dimensions: number[]; volume?: number; description: string };
  previousSize?: { dimensions: number[]; studyDate: string; studyId: string };
  change?: {
    type: 'shrinking' | 'stable' | 'growing' | 'new' | 'resolved';
    percentChange?: number;
    absoluteChange?: number;
    recist?: 'CR' | 'PR' | 'SD' | 'PD';
    description: string;
  };
  firstDetectedDate?: string;
  treatmentAtDetection?: string;
}

export interface MetastasisFromReport {
  id: string;
  location: string;
  locationTranslated: string;
  status: 'new' | 'stable' | 'growing' | 'shrinking' | 'resolved';
  size?: number[];
  previousStatus?: string;
  previousStudyDate?: string;
  notes: string;
}

export interface LymphNodeFromReport {
  id: string;
  location: string;
  locationTranslated: string;
  size?: number;
  status: 'normal' | 'enlarged' | 'suspicious' | 'pathological';
  previousSize?: number;
  change?: string;
}

export interface ImagingImage {
  id: string;
  base64?: string;
  blobKey?: string;
  description: string;
}

export interface TumorMeasurement {
  location: string;
  sizeMm: number[];
  volume?: number;
  recistResponse?: 'CR' | 'PR' | 'SD' | 'PD';
  previousSize?: number[];
  changePercent?: number;
}

export interface MetastasisRecord {
  location: string;
  status: 'new' | 'stable' | 'growing' | 'shrinking' | 'resolved';
  sizeMm?: number[];
  notes: string;
}

export interface ImagingComparison {
  previousStudyId: string;
  changes: string;
  aiComparison?: string;
}

export interface PatternSummary {
  id: string;
  date: string;
  targetDate: string;
  type: 'wellbeing' | 'blood' | 'sideEffects' | 'energy';
  prediction: string;
  confidence: number;
  basedOn: string[];
  actual?: string;
  accuracy?: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string | MessageContent[];
  timestamp: Date;
  dataExtracted?: Record<string, unknown>[];
  imagesAttached?: string[];
}

export type MessageContent =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }
  | { type: 'document'; source: { type: 'base64'; media_type: string; data: string } };

export interface DiseaseProfile {
  icd10Code: string;
  namePolish: string;
  nameEnglish: string;
  nameLatin: string;
  stage: string;
  molecularSubtype?: string;
  relevantBloodMarkers: BloodMarkerConfig[];
  tumorMarkers: TumorMarkerConfig[];
  standardChemoRegimens: ChemoRegimen[];
  typicalMetastasisSites: string[];
  relevantImaging: ImagingConfig[];
  keyInteractions: string[];
}

export interface BloodMarkerConfig {
  marker: string;
  frequency: string;
  normalRange: { min: number; max: number; unit: string };
  criticalLow?: number;
  criticalHigh?: number;
}

export interface TumorMarkerConfig {
  marker: string;
  normalMax: number;
  unit: string;
}

export interface ChemoRegimen {
  name: string;
  drugs: string[];
  cycleLength: number;
  commonSideEffects: string[];
}

export interface ImagingConfig {
  type: string;
  frequency: string;
  purpose: string;
}

export interface ChemoReadinessAssessment {
  readiness: 'go' | 'caution' | 'postpone';
  issues: string[];
  recommendation: string;
  affectedPredictions: boolean;
}

export type ChemoPhase = 'A' | 'B' | 'C' | null;

export type TabId = 'chat' | 'calendar' | 'data' | 'imaging' | 'settings';
export type NotebookTab = 'daily' | 'blood' | 'chemo' | 'supplements' | 'imaging'
  | 'radiotherapy' | 'immunotherapy' | 'targeted' | 'hormonal' | 'surgery';

// Calendar types
export type CalendarEventType =
  | 'chemo' | 'chemo_postponed' | 'blood_test' | 'imaging' | 'daily_log'
  | 'supplement' | 'doctor_visit' | 'side_effect' | 'weight'
  | 'wearable_alert' | 'prediction' | 'medication_change' | 'note'
  | 'radiotherapy_session' | 'immunotherapy_infusion' | 'targeted_therapy' | 'hormonal_therapy'
  | 'surgery' | 'surgery_followup' | 'recovery_period'
  | 'phase_a' | 'phase_b' | 'phase_c';

export interface CalendarEvent {
  id: string;
  date: string;
  type: CalendarEventType;
  title: string;
  subtitle?: string;
  color: string;
  icon: string;
  sourceId?: string;
  sourceType?: string;
  editable: boolean;
  allDay: boolean;
  time?: string;
  data?: Record<string, unknown>;
}

export interface CalendarNote {
  id: string;
  date: string;
  type: CalendarEventType;
  title: string;
  description?: string;
  time?: string;
  reminder?: boolean;
}

export interface NotificationConfig {
  enabled: boolean;
  morningEnabled: boolean;
  morningHour: number;
  morningMinute: number;
  eveningEnabled: boolean;
  eveningHour: number;
  eveningMinute: number;
  chemoReminderEnabled: boolean;
  chemoReminderDaysBefore: number;
}

export const DEFAULT_NOTIFICATIONS: NotificationConfig = {
  enabled: false,
  morningEnabled: true,
  morningHour: 8,
  morningMinute: 0,
  eveningEnabled: true,
  eveningHour: 20,
  eveningMinute: 0,
  chemoReminderEnabled: true,
  chemoReminderDaysBefore: 1,
};

export type AppMode = 'ai' | 'notebook';

export type ThemeMode = 'light' | 'dark';

export type AppLanguage = 'pl' | 'en' | 'de';

export interface AppSettings {
  apiKey: string;
  aiProvider: 'anthropic' | 'openai' | 'gemini';
  appMode: AppMode;
  theme: ThemeMode;
  language: AppLanguage;
  onboardingCompleted: boolean;
  notifications: NotificationConfig;
  demoMode?: boolean;
  dataProcessingConsent?: {
    accepted: boolean;
    acceptedAt: string;
    provider: string;
  };
  openWearablesBaseUrl?: string;
  openWearablesApiKey?: string;
  openWearablesUserId?: string;
  withingsClientId?: string;
  withingsClientSecret?: string;
  withingsRedirectUri?: string;
  /** Oura Personal Access Token — pasted from cloud.ouraring.com/personal-access-tokens */
  ouraPersonalAccessToken?: string;
  /** Strava OAuth credentials — registered at strava.com/settings/api */
  stravaClientId?: string;
  stravaClientSecret?: string;
  stravaRedirectUri?: string;
}
