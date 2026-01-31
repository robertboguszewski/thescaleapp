# PROGRESS - TheScaleApp

## Sesja: 2026-01-31 (Integracja Native BLE z Clean Architecture)

### Kontekst
Integracja Native BLE (`NobleBLEAdapter`) z Clean Architecture poprzez utworzenie `NativeBLEPort` implementującego interfejs `BLEPort`. Naprawa krytycznego problemu: `services.ts` zawsze tworzył `MockBLEPort`.

### Wykonane prace

#### 1. NativeBLEPort - Adapter implementujący BLEPort (TDD)
**Pliki:**
- `src/infrastructure/ble/NativeBLEPort.ts` - główna implementacja
- `src/infrastructure/ble/__tests__/NativeBLEPort.test.ts` - **41 testów TDD**

**Funkcjonalności:**
- Implementacja interfejsu `BLEPort` z `application/ports/BLEPort.ts`
- Wrapper dla `NobleBLEAdapter` - bridge między Clean Architecture a Native BLE
- Timeout wrapper dla wszystkich operacji BLE (scan, connect, read)
- Deduplikacja pomiarów w oknie 1 sekundy
- Mapowanie stanów i błędów między adapterami
- Proper cleanup i dispose

**Konfiguracja:**
```typescript
interface NativeBLEPortConfig {
  scanTimeoutMs?: number;      // default: 30000
  connectTimeoutMs?: number;   // default: 10000
  readTimeoutMs?: number;      // default: 15000
  autoConnect?: boolean;       // default: false
}
```

#### 2. Naprawiony services.ts - Warunkowe tworzenie BLE adaptera
**Plik:** `src/main/services.ts`

**Zmiana:**
```typescript
// Przed: zawsze MockBLEPort
blePort = new MockBLEPort();

// Po: Native BLE gdy dostępne, fallback do Mock
if (isNativeBLEAvailable()) {
  console.log('[Services] Using Native BLE adapter');
  blePort = new NativeBLEPort({ ... });
} else {
  console.log('[Services] Using Mock BLE adapter');
  blePort = new MockBLEPort();
}
```

#### 3. Package.json - Build configuration
**Dodano:**
- `postinstall`: `electron-rebuild -f -w @abandonware/noble`
- `rebuild:noble`: manualne przebudowanie native module
- `@electron/rebuild`: ^3.7.1 (devDependency)
- `@abandonware/noble`: ^1.9.2-28 (optionalDependency)

#### 4. macOS Bluetooth Entitlements
**Pliki:**
- `build/entitlements.mac.plist` - uprawnienia dla macOS
- `electron-builder.yml` - konfiguracja builda

**Uprawnienia:**
- `com.apple.security.device.bluetooth` - dostęp do BLE
- `NSBluetoothAlwaysUsageDescription` - opis użycia dla użytkownika
- Hardened runtime compatibility

### Wyniki testów

| Komponent | Testy | Status |
|-----------|-------|--------|
| NativeBLEPort | 41 | ✅ Pass |
| MiScaleParser | 25 | ✅ Pass |
| NobleBLEAdapter | 36 | ✅ Pass |
| useNativeBLE | 23 | ✅ Pass |
| **Razem Native BLE** | **125** | ✅ Pass |
| **Wszystkie testy** | **1036/1037** | ⚠️ 1 failing (polskie znaki) |

### Architektura po zmianach

```
┌─────────────────────────────────────────────────────────────┐
│                    Presentation Layer                        │
│  ┌──────────────┐    ┌───────────────┐    ┌─────────────┐  │
│  │ useNativeBLE │    │ useBLE (hook) │    │ MeasurementPanel│
│  │  (IPC bridge)│    │ (via services)│    │    (UI)     │  │
│  └──────┬───────┘    └───────┬───────┘    └─────────────┘  │
└─────────┼───────────────────┼──────────────────────────────┘
          │                    │
┌─────────┼───────────────────┼──────────────────────────────┐
│         │    Application Layer                              │
│         │         ┌─────────────────────┐                   │
│         │         │   BLEPort (interface)│                  │
│         │         │   - scan()           │                  │
│         │         │   - connect()        │                  │
│         │         │   - readMeasurement()│                  │
│         │         └──────────┬──────────┘                   │
└─────────┼────────────────────┼─────────────────────────────┘
          │                    │
┌─────────┼────────────────────┼─────────────────────────────┐
│         │    Infrastructure Layer                           │
│    ┌────┴────┐         ┌────┴────────────┐                 │
│    │ IPC     │         │   NativeBLEPort │ ← NEW           │
│    │ Handlers│         │   (implements   │                  │
│    └────┬────┘         │    BLEPort)     │                  │
│         │              └────────┬────────┘                  │
│         │                       │                           │
│    ┌────┴────────────────┐     │                           │
│    │   NobleBLEAdapter   │←────┘                           │
│    │   (@abandonware/    │                                  │
│    │    noble)           │                                  │
│    └─────────────────────┘                                  │
└────────────────────────────────────────────────────────────┘
```

### Pozostałe zadania
1. ~~Fix native module build (node-gyp/macOS SDK)~~ - do weryfikacji
2. Integracja `useNativeBLE` z `MeasurementPanel`
3. Naprawa testu polskich znaków w `ble-states.test.ts`

---

## Sesja: 2026-01-31 (kontynuacja)

### Kontekst
Implementacja Native BLE z użyciem `@abandonware/noble` zgodnie z planem w `docs/NATIVE_BLE_IMPLEMENTATION_PLAN.md`.

### Wykonane prace

#### Faza 1: Instalacja i Konfiguracja
- Próba instalacji `@abandonware/noble` - **problem z native module build**
- Utworzenie struktury katalogów `src/main/ble/`
- Stworzenie `BLETypes.ts` z typami i interfejsami

#### Faza 2: Parser i Adapter (TDD)
Napisano testy PRZED implementacją zgodnie z podejściem TDD.

**Pliki:**
- `src/main/ble/MiScaleParser.ts` - parser danych Mi Scale
- `src/main/ble/MiScaleParser.test.ts` - **25 testów**
- `src/main/ble/NobleBLEAdapter.ts` - adapter z dependency injection
- `src/main/ble/NobleBLEAdapter.test.ts` - **36 testów**

**Funkcjonalności:**
- Parsowanie advertisement data (waga, impedancja)
- Parsowanie characteristic data (BLE standard format)
- Obsługa jednostek metrycznych i imperialnych
- Walidacja wagi (2-300 kg)
- Flagi: stabilizacja, usunięcie z wagi
- Event-driven architektura

#### Faza 3: IPC Handlers
**Plik:** `src/main/ipc-handlers.ts`

Dodano:
- `registerNativeBLEHandlers()` - rejestracja IPC handlers
- `setupNativeBLEEventForwarding()` - forwarding eventów do renderer
- Kanały IPC: `nativeBle:startScanning`, `nativeBle:stopScanning`, `nativeBle:disconnect`, `nativeBle:setDevice`, `nativeBle:getStatus`
- Eventy: `measurement`, `connected`, `disconnected`, `scanning`, `discovered`, `error`, `ready`, `unavailable`

#### Faza 4: Preload Bridge
**Plik:** `src/main/preload.ts`

Dodano `nativeBLE` API z:
- Metody: `startScanning`, `stopScanning`, `disconnect`, `setDevice`, `getStatus`
- Event subscriptions z funkcjami unsubscribe

#### Faza 5: React Hook (TDD)
**Pliki:**
- `src/presentation/hooks/useNativeBLE.ts`
- `src/presentation/hooks/__tests__/useNativeBLE.test.ts` - **23 testy**

**Funkcjonalności:**
- Stan: `isConnected`, `isScanning`, `isReady`, `deviceName`, `lastMeasurement`, `lastError`, `discoveredDevices`
- Akcje: `startScanning`, `stopScanning`, `disconnect`, `setDevice`, `clearError`, `clearDiscoveredDevices`
- Opcje: `autoStart`, `onMeasurement`, `onConnected`, `onDisconnected`, `onError`

#### Aktualizacja typów
**Plik:** `src/shared/types.ts`

Dodano:
- `NativeBLEDevice`, `NativeBLEMeasurement`, `NativeBLEStatus`
- Kanały IPC dla Native BLE
- Rozszerzenie `ElectronAPI` o `nativeBLE`

### Wyniki testów

| Komponent | Testy | Status |
|-----------|-------|--------|
| MiScaleParser | 25 | ✅ Pass |
| NobleBLEAdapter | 36 | ✅ Pass |
| useNativeBLE | 23 | ✅ Pass |
| **Razem nowych** | **84** | ✅ Pass |
| **Wszystkie testy** | **995/996** | ⚠️ 1 failing (niezwiązany) |

### Pozostały problem

**Native module build issue:**
```
clang: error: invalid version number in '-mmacosx-version-min=13.5'
```

Kod jest gotowy do użycia po rozwiązaniu problemu z kompilacją noble.

### Następne kroki
1. Naprawić native module build (zmienić Node version lub Xcode tools)
2. Uruchomić aplikację i przetestować z prawdziwą wagą Mi Scale
3. Zintegrować `useNativeBLE` z `MeasurementPanel`

---

## Sesja: 2026-01-31 (przegląd architektury)

### Kontekst
Głęboki przegląd architektury zgodnie z Clean Architecture i Hexagonal Architecture.

### Wykonane prace

#### Poprawka polskich znaków diakrytycznych
Naprawiono polskie znaki (ą, ę, ć, ś, ź, ż, ó, ł, ń) w **20 plikach**:
- Komponenty UI: ProfileEditor, MeasurementPanel, Settings, DeviceSettings
- Store: bleStore, profileStore
- Hooks: useBLE, useReport, useSmartRecommendations
- Infrastruktura: ble-states.ts, error-handler.ts

#### Deep Architecture Review
**Plik:** `docs/ARCHITECTURE_REVIEW.md`

**Analiza obejmuje:**
1. **Niezależność warstw** - ocena 9/10
   - Domain: czysta logika bez zewnętrznych zależności
   - Application: porty definiują kontrakty
   - Infrastructure: implementacje portów
   - Presentation: Zustand + custom hooks

2. **Service Layer** - ocena 8/10
   - Constructor Injection dla zależności
   - Repository Pattern
   - CQRS Use Cases

3. **Testowalność** - ocena 9/10
   - 32+ plików testowych
   - TDD approach (Native BLE)
   - Łatwe mockowanie przez DI

4. **Zidentyfikowane problemy:**
   - Mock BLE Port w produkcji (zawsze MockBLEPort)
   - Brak DI Container (ręczne wstrzykiwanie)
   - Brak warstwy DTO/Mappers
   - Rozproszone definicje błędów

5. **Rekomendacje:**
   - Warunkowe tworzenie BLE adaptera (Native vs Mock)
   - Wprowadzenie tsyringe jako DI Container
   - Domain Error hierarchy
   - Lazy initialization serwisów

### Ocena ogólna: 8.5/10

**Verdict:** Architektura jest solidna i profesjonalna. Główne zasady Clean Architecture są przestrzegane. Projekt jest łatwy w utrzymaniu i rozszerzaniu.

---

## Planowane prace (i18n)

Przygotowano plan internacjonalizacji:
1. Instalacja react-i18next
2. Ekstrakcja tekstów do JSON
3. Detekcja języka OS (app.getLocale())
4. Selector języka w Settings

---

## Sesja: 2026-01-31 (Test Data Generator)

### Kontekst
Implementacja systemu generowania danych testowych symulujących Xiaomi Mi Body Composition Scale 2.

### Wykonane prace

#### Test Data Generator
**Pliki:**
- `scripts/test-data/generator.ts` - główny skrypt TypeScript
- `scripts/test-data/generate-test-data.sh` - wrapper bash
- `scripts/test-data/remove-test-data.sh` - wrapper bash do usuwania

**Funkcjonalności:**
- Generowanie 31 dziennych pomiarów (styczeń 2026)
- Symulacja utraty wagi: 107kg → 105kg
- Kompletne metryki body composition:
  - BMI, body fat %, muscle mass, water %, bone mass
  - Visceral fat level, BMR, protein %
  - Body score (0-100)
- Profil użytkownika testowego (190cm, mężczyzna, ur. 1990)
- Realistyczne wartości impedancji BLE

#### Konfiguracja
**Aktualizacje:**
- `package.json` - dodano skrypty npm:
  - `npm run test-data:generate`
  - `npm run test-data:remove`
- `.gitignore` - wykluczenie `/test-data/`
- `ts-node` - dodany jako devDependency

### Użycie

```bash
# Generowanie danych testowych
npm run test-data:generate

# Usuwanie danych testowych
npm run test-data:remove

# Lub przez shell scripts
./scripts/test-data/generate-test-data.sh
./scripts/test-data/remove-test-data.sh
```

### Wygenerowane dane

**Format zgodny z interfejsami projektu:**
- `UserProfile` - profil użytkownika
- `RawMeasurement` - surowe dane z wagi (weightKg, impedanceOhm)
- `CalculatedMetrics` - obliczone metryki body composition
- `ScaleSession` - kompletna sesja pomiaru

**Lokalizacja:**
- `test-data/user-profile.json` - profil użytkownika
- `test-data/measurements.json` - 31 pomiarów dziennych

---

## Sesja: 2026-01-31 (Architecture Improvements - TDD)

### Kontekst
Implementacja usprawnień architektury zidentyfikowanych w przeglądzie. Podejście TDD.

### Wykonane prace

#### 1. Domain Error Hierarchy
**Plik:** `src/domain/errors/index.ts`

**Scentralizowane błędy domenowe:**
- `DomainError` - bazowa klasa abstrakcyjna
- `ProfileNotFoundError` - profil nie znaleziony
- `MeasurementNotFoundError` - pomiar nie znaleziony
- `MeasurementReadError` - błąd odczytu z wagi
- `NoMeasurementsError` - brak pomiarów
- `ValidationError` - błąd walidacji
- `BLEError` - błędy BLE
- `StorageError` - błędy storage

**Narzędzia:**
- `isDomainError()` - type guard
- `getErrorCode()` - wyciąganie kodu błędu
- `serializeDomainError()` - serializacja dla IPC

**Testy:** 42 testy jednostkowe

#### 2. DTO Layer (Mappers)
**Pliki:**
- `src/application/mappers/MeasurementMapper.ts`
- `src/application/mappers/ProfileMapper.ts`
- `src/application/mappers/index.ts`

**Funkcjonalności:**
- Konwersja Date → ISO string dla IPC
- Roundtrip conversion (toDTO ↔ toDomain)
- Batch conversion (toDTOList)

**Testy:** 22 testy jednostkowe

#### 3. DI Container (tsyringe)
**Plik:** `src/main/container.ts`

**Funkcjonalności:**
- Injection tokens (`TOKENS.MeasurementService`, etc.)
- `initializeContainer(config)` - inicjalizacja
- `clearContainer()` - reset (dla testów)
- `resolve<T>(token)` - pobieranie zależności
- Singleton instances
- Conditional BLE adapter (Native vs Mock)

**Testy:** 12 testów jednostkowych

#### 4. Aktualizacja istniejącego kodu
Zaktualizowano do użycia scentralizowanych błędów:
- `MeasurementService.ts` - import z `domain/errors`
- `ProfileService.ts` - import z `domain/errors`
- `ReportService.ts` - import z `domain/errors`
- `CaptureMeasurementUseCase.ts` - import z `domain/errors`
- `ipc-handlers.ts` - `getErrorCode()`, `getErrorDetails()`

### Wyniki testów

| Komponent | Testy | Status |
|-----------|-------|--------|
| Domain Errors | 42 | ✅ Pass |
| DTO Mappers | 22 | ✅ Pass |
| DI Container | 12 | ✅ Pass |
| **Nowe testy** | **76** | ✅ Pass |
| Services (updated) | 223 | ✅ Pass |
| **Wszystkie testy** | **1112/1113** | ⚠️ 1 failing (pre-existing) |

### Nowe pliki

```
src/
├── domain/
│   └── errors/
│       ├── index.ts
│       └── __tests__/
│           └── DomainErrors.test.ts
├── application/
│   └── mappers/
│       ├── index.ts
│       ├── MeasurementMapper.ts
│       ├── ProfileMapper.ts
│       └── __tests__/
│           ├── MeasurementMapper.test.ts
│           └── ProfileMapper.test.ts
└── main/
    ├── container.ts
    └── __tests__/
        └── container.test.ts
```

### Zmiany w package.json
- Dodano: `tsyringe`, `reflect-metadata`

### Zmiany w tsconfig.json
- Dodano: `experimentalDecorators: true`
- Dodano: `emitDecoratorMetadata: true`

---

*Status: Architecture Improvements - zakończone (TDD)*

---

## Sesja: 2026-01-31 (HIGH Priority Fixes - TDD)

### Kontekst
Implementacja dwóch HIGH priority poprawek zidentyfikowanych w analizie Native BLE:
1. `isConnecting` flag - ochrona przed race condition przy połączeniu
2. Walidacja impedancji - zakres 100-1200 Ω

### Wykonane prace (TDD - testy PRZED implementacją)

#### 1. isConnecting Flag - Race Condition Protection

**Plik:** `src/main/ble/NobleBLEAdapter.ts`

**Problem:** Metoda `connectToPeripheral()` mogła być wywołana wielokrotnie równocześnie, powodując race condition.

**Rozwiązanie:**
```typescript
private isConnecting = false;

private async connectToPeripheral(peripheral: any): Promise<void> {
  // Race condition protection
  if (this.isConnecting) {
    console.log('[NobleBLEAdapter] Connection already in progress, skipping');
    return;
  }

  this.isConnecting = true;
  try {
    // ... connection logic
  } finally {
    this.isConnecting = false;
  }
}
```

**Testy TDD (5 nowych testów):**
- `should prevent concurrent connection attempts`
- `should set isConnecting to true during connection attempt`
- `should reset isConnecting to false after successful connection`
- `should reset isConnecting to false after connection failure`
- `should not emit connecting event for rejected concurrent attempts`

#### 2. Walidacja Impedancji (100-1200 Ω)

**Plik:** `src/main/ble/MiScaleParser.ts`

**Problem:** Parser akceptował dowolne wartości impedancji, włącznie z nieprawidłowymi.

**Rozwiązanie:**
```typescript
const MIN_VALID_IMPEDANCE_OHM = 100;
const MAX_VALID_IMPEDANCE_OHM = 1200;

private isValidImpedance(impedanceOhm: number): boolean {
  return impedanceOhm >= MIN_VALID_IMPEDANCE_OHM &&
         impedanceOhm <= MAX_VALID_IMPEDANCE_OHM;
}
```

**Testy TDD (6 nowych testów):**
- `should reject impedance below 100 Ω as invalid`
- `should reject impedance above 1200 Ω as invalid`
- `should accept impedance at lower boundary (100 Ω)`
- `should accept impedance at upper boundary (1200 Ω)`
- `should accept typical body impedance values (400-600 Ω)`
- `should treat zero impedance as not available`

#### 3. Naprawa testu ble-states.test.ts

**Plik:** `src/domain/__tests__/ble-states.test.ts`

**Problem:** Typo w teście - `'Sprobuj ponownie'` zamiast `'Spróbuj ponownie'`

**Rozwiązanie:** Poprawka literówki w asercji.

### Poprawki w NativeBLEPort.test.ts

Naprawiono "Unhandled Rejection" warnings w testach timeout:
- Zmieniono pattern z `expect(promise).rejects.toBeDefined()` na `promise.catch(e => e)`
- Gwarantuje synchroniczne obsłużenie rejection przed assertion

### Statystyki

| Metryka | Wartość |
|---------|---------|
| Nowe testy TDD | 11 |
| Łącznie testów w projekcie | 1124 |
| Test files | 40 |
| Passing | 100% |

### Pliki zmodyfikowane

1. `src/main/ble/NobleBLEAdapter.ts` - dodano isConnecting flag
2. `src/main/ble/__tests__/NobleBLEAdapter.test.ts` - 5 nowych testów
3. `src/main/ble/MiScaleParser.ts` - dodano walidację impedancji
4. `src/main/ble/__tests__/MiScaleParser.test.ts` - 6 nowych testów
5. `src/domain/__tests__/ble-states.test.ts` - fix typo
6. `src/infrastructure/ble/__tests__/NativeBLEPort.test.ts` - fix unhandled rejections

---

*Status: HIGH Priority Fixes - zakończone (TDD)*
