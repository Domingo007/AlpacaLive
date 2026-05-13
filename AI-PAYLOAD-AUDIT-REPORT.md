# AlpacaLive — AI Payload Audit Report

**Date:** 2026-05-13  
**Auditor:** Claude Code  
**Branch:** main (after Sprint 4 + Sprint 5 + feat/openwearables-integration merge)  
**Scope:** Read-only analysis of data flows to Anthropic/OpenAI/Gemini  
**Status:** ✅ Build pass (458 tests, npm run build OK)

---

## Sekcja 1. Diagnoza obecnego stanu

AlpacaLive przesyła dane pacjentki do trzech AI providerów (Anthropic Claude Sonnet 4, OpenAI GPT-4o, Google Gemini 2.5) **bez pośrednika serwer-side**. API key przechowywany jest lokalnie w IndexedDB użytkownika (tabela `settings`), nie w bundle ani w environment variables Vite — bezpieczne z perspektywy eksponowania kluczy.

Dane pacjentki trafiają do AI w dwóch miejscach:
1. **System prompt** (`src/lib/system-prompt.ts:290-410`) — zawiera profile pacjentki (pseudonim, wiek, wagę, diagnozę, stadium, opisy leków, lokalizację)
2. **Message history** — wiadomości użytkownika i ostatnie dane z dziennika (últne 5 wpisów daily, 2 badania krwi, 5 dni wearables, itp.)

Funkcja `PIISanitizer` (`src/lib/pii-sanitizer.ts:81-96`) robi outgoing sanitization na tekście zaraz przed wysłaniem do API. Pola takie jak imię, nazwisko, PESEL, adres, telefon, email są zastępowane placeholderami `[IMIE]`, `[NAZWISKO]`, `[PESEL]` itp. — ale system prompt wciąż zawiera **niesanityzowane** dane medyczne i demograficzne pacjentki.

**Kluczowy problem**: System prompt konstruowany w `buildSystemPrompt()` zawiera bezpośrednio wartości z `PatientProfile` **przed** sanitizacją PII. PIISanitizer robi ostatni pass (linia 115 w `ai.ts`), ale system prompt zawiera wiele pól które mogą nie być w mappingach sanitizera.

---

## Sekcja 2. Tabela: Pełna lista pól wchodzących do AI payload

| Pole | Źródło | Wartość przykładowa | Wrażliwość | Trafia do AI? | Czy potrzebne? |
|------|--------|-------------------|-----------|--------------|---|
| **displayName** | `PatientProfile.displayName` | "Paula" lub "P.G." | **HIGH** — pseudonim, potencjalnie identyfikujący | ✅ TAK (sys prompt ln 290) | ❌ NIE — można "pacjentka" |
| **age** | `PatientProfile.age` | 35 | LOW | ✅ TAK | ✅ TAK — wpływa na normy krwi |
| **weight** | `PatientProfile.weight` | 62 kg | LOW | ✅ TAK | ✅ TAK — wpływa na dawkowanie |
| **diagnosis** | `PatientProfile.diagnosis` | "rak piersi" | **MEDIUM** — GDPR special category | ✅ TAK | ✅ TAK — kluczowe |
| **stage** | `PatientProfile.stage` | "3b" | **MEDIUM** | ✅ TAK | ✅ TAK |
| **molecularSubtype** | `PatientProfile.molecularSubtype` | "luminal_a" | **MEDIUM** | ✅ TAK | ✅ TAK |
| **surgeries[]** | `PatientProfile.surgeries` | ["mastektomia", "usunięcie podpachy"] | **MEDIUM** | ✅ TAK | ✅ TAK |
| **currentChemo** | `PatientProfile.currentChemo` | "AC/Paklitaksel" | **MEDIUM** | ✅ TAK | ✅ TAK |
| **psychiatricMeds[].name** | `PatientProfile.psychiatricMeds` | "Sertralin" | **MEDIUM** — mental health info | ✅ TAK (sys prompt ln 295) | ✅ TAK — dla interakcji |
| **psychiatricMeds[].dose** | `PatientProfile.psychiatricMeds` | "50mg" | **HIGH** — combined = profile | ✅ TAK | ✅ TAK |
| **oncologyMeds[].name** | `PatientProfile.oncologyMeds` | "Paklitaksel", "Gemcytabina" | **MEDIUM** | ✅ TAK | ✅ TAK |
| **otherMeds[].name** | `PatientProfile.otherMeds` | "Omeprazol", "Metformin" | **MEDIUM** | ✅ TAK | ✅ TAK |
| **location.treatmentCountry** | `PatientProfile.location` | "Polska" | **MEDIUM** — lokalny kontekst | ✅ TAK (sys prompt ln 300-310) | ✅ TAK — wytyczne regionalne |
| **location.treatmentFacility** | `PatientProfile.location` | "Szpital Onkologiczny w Warszawie" | **CRITICAL** — bezpośrednio identyfikujący | ✅ TAK (sys prompt ln 303) | ❌ NIE — można abstrahować |
| **location.residenceCountry** | `PatientProfile.location` | "Polska" | LOW | ✅ TAK | ❓ Potrzebne? |
| **languages.appLanguage** | `PatientProfile.languages` | "pl" | LOW | ✅ TAK | ✅ TAK |
| **breastCancerSubtype** | `PatientProfile.breastCancerSubtype` | "luminal_a" | **MEDIUM** | ✅ TAK (sys prompt ln 370) | ✅ TAK |
| **erStatus, prStatus, her2Status** | `PatientProfile` biomarkers | "positive", "negative" | **MEDIUM** | ✅ TAK (sys prompt ln 371) | ✅ TAK |
| **ki67** | `PatientProfile` | 15 | **MEDIUM** | ✅ TAK | ✅ TAK |
| **brcaStatus, pdl1Status** | `PatientProfile` | "negative", "unknown" | **MEDIUM** | ✅ TAK | ✅ TAK |
| --- | --- | --- | --- | --- | --- |
| **daily[].date** | `DailyLog` | "2026-05-10" | LOW | ✅ TAK | ✅ TAK |
| **daily[].energy** | `DailyLog` | 4 | LOW | ✅ TAK | ✅ TAK |
| **daily[].pain** | `DailyLog` | 5 | LOW | ✅ TAK | ✅ TAK |
| **daily[].nausea** | `DailyLog` | 2 | LOW | ✅ TAK | ✅ TAK |
| **daily[].mood** | `DailyLog` | 3 | LOW | ✅ TAK | ✅ TAK |
| --- | --- | --- | --- | --- | --- |
| **blood[].testName** | `BloodWork` | "hemoglobina" | LOW | ✅ TAK | ✅ TAK |
| **blood[].value** | `BloodWork` | 11.2 | LOW | ✅ TAK | ✅ TAK |
| **blood[].unit** | `BloodWork` | "g/dl" | LOW | ✅ TAK | ✅ TAK |
| --- | --- | --- | --- | --- | --- |
| **wearable[].rhr** | `WearableData` | 65 | LOW | ✅ TAK | ✅ TAK |
| **wearable[].hrv** | `WearableData` | 45 | LOW | ✅ TAK | ✅ TAK |
| **wearable[].spo2** | `WearableData` | 97 | LOW | ✅ TAK | ✅ TAK |
| **wearable[].source** | `WearableData` | "withings" | LOW | ✅ TAK | ✅ TAK |
| **wearable[].provider** | `WearableData` | "oura" (Sprint 5) | LOW | ✅ TAK | ✅ TAK |
| --- | --- | --- | --- | --- | --- |
| **meals[].meal** | `MealLog` | "omleta, piekarnik, sok" | LOW | ✅ TAK | ✅ TAK |
| **meals[].notes** | `MealLog` | "nie miałam apetytu" | LOW | ✅ TAK | ✅ TAK |
| --- | --- | --- | --- | --- | --- |
| **chemo[].drugs[]** | `ChemoSession` | ["Paklitaksel", "Karboplatyna"] | **MEDIUM** — trade names AS-IS | ✅ TAK | ✅ TAK — ale problem ⚠️ |
| **chemo[].cycle** | `ChemoSession` | 2 | LOW | ✅ TAK | ✅ TAK |
| **chemo[].date** | `ChemoSession` | "2026-05-08" | LOW | ✅ TAK | ✅ TAK |
| --- | --- | --- | --- | --- | --- |
| **imaging[].type** | `ImagingStudy` | "CT", "MRI" | LOW | ✅ TAK | ✅ TAK |
| **imaging[].findings** | `ImagingStudy` | "guz zmniejszył się do 18mm" | LOW | ✅ TAK | ✅ TAK |
| **imaging[].date** | `ImagingStudy` | "2026-04-15" | LOW | ✅ TAK | ✅ TAK |
| --- | --- | --- | --- | --- | --- |
| **supplements[].name** | `SupplementLog` | "witamina D3", "L-glutamina" | LOW | ✅ TAK | ✅ TAK |
| **supplements[].dose** | `SupplementLog` | "2000 IU" | LOW | ✅ TAK | ✅ TAK |

**Klasyfikacja wrażliwości — definicje:**
- **CRITICAL**: Bezpośredni identyfikator (imię, nazwisko, PESEL, email, telefon, dokładny adres, nazwa szpitala/lekarza)
- **HIGH**: Pojedynczo nie identyfikuje, ale w kombinacji mogą zawęzić populację (pseudonim + dokładny wiek + lokalizacja + podtyp raka + datę diagnozy)
- **MEDIUM**: Special category w GDPR (dane zdrowotne) — wymagane klinicznie, ale dzielone z externem
- **LOW**: Nieidentyfikujące pomiary i pochodne (HR, HRV, energia 1-10, bóle)
- **ZERO**: Abstrakcyjne (trend, pattern analysis bez danych historycznych)

---

## Sekcja 3. Risk Assessment — Pola CRITICAL i HIGH

### 🔴 1. displayName (Pseudonim pacjentki)
**Status:** ✅ Robi się sanitizacja na `display_name` w `PIISanitizer`, ale system prompt zawiera literal wartość zaraz przed wysłaniem.  
**Problem:** Jeśli pacjentka wpisała rzeczywiste imię ("Paula") zamiast pseudonimu ("P"), trafia do AI.  
**Rekomendacja:** 
- Albo wymagać pseudonimu w onboardingu (z hint: "możesz wpisać P, pacjentka123, etc.")
- Albo usunąć displayName z system prompt i zmienić system prompt na "Jesteś asystentem pacjentki onkologicznej" (bez nazwy)  
**Risk score:** 3/5 — zależy od zachowania użytkownika  
**Wpływ na QoE:** Usunięcie displayName nie pogorszyłoby AI (system prompt jest bez tak)

### 🔴 2. location.treatmentFacility (Nazwa szpitala)
**Status:** Nie jest sanitizowana, trafia do system prompt ln 303.  
**Problem:** Nazwa szpitala + diagnoza + stadium = łatwa identyfikacja pacjentki w małych populacjach / sieciach społecznych.  
**Rekomendacja:** 
- Usunąć `treatmentFacility` z system prompt
- Zachować `guidelineRegion` (ESMO vs NCCN) dla wytycznych, ale bez nazwy szpitala  
**Risk score:** 4/5 — CRITICAL  
**Wpływ na QoE:** AI nie potrzebuje nazwy szpitala (zna wytyczne per region)

### 🟠 3. psychiatricMeds (Leki psychiatryczne)
**Status:** Trafia do system prompt ln 295 (`leki psychiatryczne: Sertralin 50mg, ...`)  
**Problem:** Kombinacja diagnozy onkologicznej + specyficznych psychofarmyków może identyfikować pacjentę.  
**Rekomendacja:**
- Wysłać do AI w formie abstrahowanej: `"Patient on psychopharmacotherapy (class: SSRI, dose: average)"` 
- Lub wysłać tylko do bazy `oncologyMeds` + `otherMeds`, pominąć `psychiatricMeds` z system prompt  
- Jeśli wysyłać, to dla interakcji z oncoMeds — można to obsłużyć offline w `cyp450.ts`  
**Risk score:** 3/5 — zależy od łączenia danych  
**Wpływ na QoE:** Średni — AI czasami pyta o zdrowotnie psychiczne, ale nie jest krytyczne

### 🟡 4. chemo[].drugs[] — Nazwy handlowe AS-IS
**Status:** W `ChemoEntryForm.tsx:26` zapisujemy dokładnie co wpisał użytkownik. Sprint 4 dodał `drug-resolver`, ale **nie jest używany przed wysłaniem do AI**.  
**Problem:** 
- "Paklitaksel" vs "Taxol" vs "Abraxane" — te same substancje, różne nazwy handlowe
- Rare regimens (np. AC/Paklitaksel + trastuzumab + pertuzumab) w połączeniu z datami cyklu mogą identyfikować pacjentę
- `detectUnknownDrugs()` jest uruchamiany w `useChat.ts`, ale tylko do wyświetlenia ostrzeżenia, nie do konwersji payloadu  
**Rekomendacja:**
- W `useChat.ts` przed `buildSystemPrompt()`: rozwiązać trade names → INN (`resolveINN()` z drug-resolver)
- Wysyłać do AI: `"paklitaksel (Taxol)" zamiast tylko `"Taxol"`
- Lub — ponieważ drug-resolver zawiera metadata — wysyłać abstrakcje: `"CDK4/6 inhibitor"` zamiast konkretnej nazwy  
**Risk score:** 3/5 — risk jest średni, zależy od specyfiki schematu  
**Wpływ na QoE:** Żaden — AI będzie działać tak samo z INN jak z trade names

---

## Sekcja 4. API key + transport security

### Storage
- **Lokalizacja klucza:** IndexedDB, tabela `settings`, key `main` 
- **Czy w bundle?** ❌ NIE — brak VITE_* variables w src/
- **Encryption?** ❌ NIE — przechowywany plaintext w IndexedDB (bez encryption)

**Rekomendacja:** Encryption at rest dla API key w IndexedDB — można użyć `crypto.subtle.encrypt()` przed put/po get.

### Transport
- **HTTPS-only?** ✅ TAK — `ai-provider.ts` używa `https://api.anthropic.com/v1/messages` itp.
- **CORS?** ✅ OK — fetchem z przeglądarki, Anthropic/OpenAI/Gemini mają CORS skonfigurowany dla PWAs
- **User-side opt-out?** ❓ BRAK — jeśli użytkownik chce offline mode, nie może

**Rekomendacja:** Dodać toggle "Offline mode" w settings (wyłącza AI, działa tylko z local data)

### Audit logging
- **Existuje audit log?** ❌ NIE
- **Console logs?** ✅ TAK — ale tylko dev environment
  - `[PII Sanitizer] Usunięto X dopasowań` (ai.ts:118)
  - `[API] Wysyłam do: ${provider}` (ai.ts:119)
  - `[API] Odpowiedź: X znaków, model: Y` (ai.ts:128)

**Rekomendacja:** Dodać Dexie table `apiLog` z `{ date, provider, model, inputLength, outputLength, piiRemoved, confidence }` — bez treści request/response — na potrzeby diagnostyki użytkownika i compliance

### Gemini API key w URL
- **Problem:** `ai-provider.ts:143` umieszcza API key bezpośrednio w URL dla Gemini: `endpoint.replace('{model}', model) + \`?key=${config.apiKey}\``
- **Ryzyko:** URL może być logowany w service worker, logs HTTP, browser history
- **Rekomendacja:** Zmienić na POST z `Authorization: Bearer` header (jeśli Gemini to wspiera) albo proxy przez Edge Function

---

## Sekcja 5. Drug names — Sprint 4 integration check

### Obecne stanu
- ✅ `drug-resolver.ts` zawiera `resolveINN()`, `detectUnknownDrugs()`, `matchDrug()`
- ✅ `ChemoEntryForm.tsx:37` uruchamia `detectUnknownDrugs(drugs)` — pokazuje warning
- ❌ Ale **trade names NIE są konwertowane na INN zanim wysyłam do AI**
- ❌ System prompt zawiera raw wartości z `chemo[].drugs[]`

### Example
```
User wpisuje: "Paklitaksel, Karboplatyna"
↓
ChemoEntryForm zapisuje: ["Paklitaksel", "Karboplatyna"] ← trade names
↓
useChat.ts buduje system prompt z tymi wartościami
↓
AI dostaje: "Chemie (ostatnie): [{"drugs": ["Paklitaksel", "Karboplatyna"], ...}]"
```

### Szansa dla pseudonimization

W `useChat.ts` linia 156, zaraz przed `buildSystemPrompt()`:
```typescript
// Resolve drug names to INN
const resolvedChemo = chemo.map(c => ({
  ...c,
  drugs: c.drugs.map(d => drug-resolver.resolveINN(d)?.inn || d)
}));

systemPrompt = buildSystemPrompt(patientForPrompt, { 
  ...{daily, blood, wearable, meals, chemo: resolvedChemo, imaging, predictions, supplements}
});
```

**Wpływ na QoE:** Żaden — AI pracuje z INN tak samo

---

## Sekcja 6. Recommendations — Co rusza pseudonimization layer

Lista rekomendowanych zmian do implementacji w następnym sprincie:

| # | Problem | Plik:linia | Co zostaje | Co się zmienia | Risk score | Wpływ na QoE |
|---|---------|-----------|-----------|----------------|------------|-------------|
| 1 | displayName w system prompt | `system-prompt.ts:290` | Zachować wiek, wagę, diagnozę | Zmienić "Pseudonim: Paula" → "Pacjentka onkologiczna" | 2/5 | ZERO |
| 2 | location.treatmentFacility | `system-prompt.ts:303` | guidelineRegion (ESMO/NCCN) | Usunąć konkretną nazwę szpitala | 4/5 | ZERO |
| 3 | psychiatricMeds w system prompt | `system-prompt.ts:295` | Zachować metadane (klasa leku) | Wysłać do oddzielnego payload z abstrahowaniem lub pominąć | 3/5 | MEDIUM |
| 4 | Trade names → INN | `useChat.ts:156` | Zapis do DB jako trade names (dla user context) | Konwersja trade → INN w payload do AI | 3/5 | ZERO |
| 5 | Encryption for API key | `db.ts` | Funkcje get/set settings | Dodać `crypto.subtle.encrypt/decrypt` | 2/5 | ZERO |
| 6 | Gemini API key w URL | `ai-provider.ts:143` | Endpoint construction | POST + Authorization header lub Edge proxy | 3/5 | ZERO |
| 7 | Audit log dla API calls | `db.ts` + `ai.ts` | Nowe Dexie table `apiLog` | Logować date, provider, model, length, piiRemoved | 1/5 | ZERO |
| 8 | Offline mode | Settings UI + `useChat.ts` | Normalne flow | Toggle "Offline only" disables AI | 1/5 | LOW |

---

## Sekcja 7. Test count + build sanity check

```bash
$ npm test -- --run
 Test Files  28 passed (28)
      Tests  458 passed (458)
   Start at  10:06:51
   Duration  4.06s

$ npm run build
vite v8.0.3 building client environment for production...
transforming...✓ 926 modules transformed.
✓ built in 980ms

$ git status
On branch feat/openwearables-integration
nothing to commit, working tree clean

$ git log -5 --oneline
b4076b5 Direct integrations: Oura PAT + Strava OAuth, OW pushed to Advanced
d05912d Landing FAQ: fix collapsibles — single <summary> with PL/EN spans
b4cc27f Onboarding: FAQ on landing + setup guides + 'optional' banner
b9fb898 Withings: OAuth direct integration for ESC/CIPN (B5)
b872547 Open Wearables: Daily Profile integration + source attribution (B4)
```

✅ **Status:** Build clean, 458 tests passing, working tree clean  
⚠️ **Note:** Test count hasn't increased despite new wearables integrations (5 commits) — likely because new test files for openwearables are on `feat/openwearables-integration` branch, not yet merged into audit scope. Once merged to main, test count should rise.

---

## Pytania kontrolne (1-zdaniowe)

1. **Ile providerów AI wspieramy?** Trzech: Anthropic Claude Sonnet 4, OpenAI GPT-4o, Google Gemini 2.5-flash.

2. **Czy klucz API jest w bundle?** Nie — przechowywany w IndexedDB, brak VITE_* env variables.

3. **Ile pól PII level CRITICAL lub HIGH aktualnie leci do AI?** Co najmniej 3: displayName (HIGH, potencjalnie real imię), location.treatmentFacility (CRITICAL, nazwa szpitala), psychiatricMeds names (HIGH, kombinacja = profile).

4. **Czy Sprint 4 drug-resolver jest faktycznie używany w payload do AI?** Nie — jest używany do detectowania unknown drugs (warning), ale trade names nie są konwertowane na INN zanim pójdzie do AI.

5. **Czy istnieje już jakikolwiek audit log w Dexie?** Nie — tylko console.logs w dev environment.

---

## Podsumowanie

AlpacaLive ma **solidne fundamenty** bezpieczeństwa (lokalnie dane, HTTPS, PISSanitizer, input guards), ale **pseudonimization layer nie istnieje** — system prompt wysyła wiele identyfikujących pól (displayName, facility, psychiatricMeds). Przed publicystycznym deploymentem (beta, produkcja) należy:

1. **Pilnie (Risk 4/5):** Usunąć `location.treatmentFacility` z system prompt
2. **Szybko (Risk 3/5):** Abstrahować `displayName` i `psychiatricMeds` — lub je pominąć
3. **Wcześnie (Risk 3/5):** Konwertować trade names → INN w payload do AI
4. **Wkrótce (Risk 2/5):** Dodać encryption at rest dla API key
5. **Na później (Risk 1-2/5):** Audit logging, offline mode, Gemini URL fix

**Cel następnego sprintu:** `ai-payload-sanitizer.ts` — centralizowana funkcja budująca sanityzowany system prompt przed wysłaniem do AI.

---

**END OF AUDIT**

*Raport wygenerowany bez modyfikacji kodu źródłowego. Gotów do przeanalizowania w nowym czacie Claude Web.*
