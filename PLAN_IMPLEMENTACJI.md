# Plan Implementacji: TheScale App
## Aplikacja Desktop do Analizy Danych z Xiaomi Mi Body Composition Scale S400

---

## 1. Analiza Techniczna Wagi S400

### 1.1 Specyfikacja Urządzenia
| Parametr | Wartość |
|----------|---------|
| Model | MJTZC01YM |
| Bluetooth | BLE 5.0 (szyfrowane reklamy) |
| Zakres pomiaru | 0.1 - 150 kg |
| Dokładność | ±0.1 kg |
| Technologia | Dual-frequency BIA (50kHz + 250kHz) |
| Korelacja z DEXA | ≥0.93 |

### 1.2 Dane Surowe z Wagi (3 wartości)
```
1. weight_kg      - waga w kilogramach
2. impedance_ohm  - impedancja bioelektryczna (Ω)
3. heart_rate_bpm - tętno spoczynkowe (opcjonalne)
```

### 1.3 Obliczane Metryki (13+ wskaźników)
Na podstawie impedancji + danych użytkownika (płeć, wiek, wzrost):

| Metryka | Jednostka | Opis |
|---------|-----------|------|
| BMI | kg/m² | Body Mass Index |
| Body Fat % | % | Procent tkanki tłuszczowej |
| Muscle Mass | kg | Masa mięśniowa |
| Body Water % | % | Procent wody w organizmie |
| Bone Mass | kg | Masa kostna |
| Visceral Fat | 1-59 | Poziom tłuszczu trzewnego |
| BMR | kcal | Podstawowa przemiana materii |
| Protein % | % | Procent białka |
| Body Score | 1-100 | Ogólna ocena zdrowia |

---

## 2. Architektura Aplikacji

```
┌─────────────────────────────────────────────────────────────────┐
│                     TheScale Desktop App                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────┐    ┌──────────────┐    ┌────────────────────┐  │
│  │   Main      │    │   Renderer   │    │    Preload         │  │
│  │   Process   │◄──►│   Process    │◄──►│    Bridge          │  │
│  │  (Node.js)  │    │   (React)    │    │                    │  │
│  └──────┬──────┘    └──────────────┘    └────────────────────┘  │
│         │                                                         │
│  ┌──────▼──────┐    ┌──────────────┐    ┌────────────────────┐  │
│  │   BLE       │    │    Data      │    │   Calculation      │  │
│  │   Service   │    │   Storage    │    │   Engine           │  │
│  │  (@noble)   │    │   (JSON)     │    │   (Body Metrics)   │  │
│  └─────────────┘    └──────────────┘    └────────────────────┘  │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### 2.1 Struktura Katalogów
```
my-electron-app/
├── main.js                    # Main process
├── preload.js                 # Preload bridge
├── package.json
├── src/
│   ├── main/                  # Main process modules
│   │   ├── ble/
│   │   │   ├── scanner.js     # BLE device scanner
│   │   │   ├── s400-parser.js # S400 data parser
│   │   │   └── crypto.js      # Decryption (BLE key)
│   │   ├── storage/
│   │   │   ├── measurements.js # JSON file operations
│   │   │   └── settings.js    # App settings
│   │   └── calculations/
│   │       ├── body-composition.js
│   │       ├── bmr.js
│   │       └── health-assessment.js
│   │
│   ├── renderer/              # React UI
│   │   ├── App.jsx
│   │   ├── components/
│   │   │   ├── Tabs/
│   │   │   │   ├── Dashboard.jsx      # Główny widok
│   │   │   │   ├── Measurement.jsx    # Nowy pomiar
│   │   │   │   ├── History.jsx        # Historia pomiarów
│   │   │   │   ├── Trends.jsx         # Wykresy trendów
│   │   │   │   ├── Analysis.jsx       # Szczegółowa analiza
│   │   │   │   └── Settings.jsx       # Ustawienia
│   │   │   ├── Charts/
│   │   │   │   ├── LineChart.jsx
│   │   │   │   ├── GaugeChart.jsx
│   │   │   │   └── BodyComposition.jsx
│   │   │   └── UI/
│   │   │       ├── MetricCard.jsx
│   │   │       ├── HealthTip.jsx
│   │   │       └── Navigation.jsx
│   │   └── styles/
│   │
│   └── shared/
│       ├── constants.js       # Healthy ranges, thresholds
│       └── types.js           # TypeScript definitions
│
├── data/                      # Local storage
│   ├── measurements/          # Jeden plik JSON per pomiar
│   │   ├── 2024-01-15_08-30-00.json
│   │   └── ...
│   ├── settings.json
│   └── user-profiles.json
│
└── assets/
    └── icons/
```

---

## 3. Integracja BLE z S400

### 3.1 Wymagane Narzędzia
```bash
# Biblioteka BLE dla macOS
npm install @abandonware/noble

# Alternatywnie - Web Bluetooth API (w Electron)
# Wymaga obsługi select-bluetooth-device event
```

### 3.2 Wymagane Klucze
Do odszyfrowania danych S400 potrzebne są:
1. **MAC Address** - adres urządzenia
2. **BLE Key** - 32-znakowy klucz heksadecymalny

**Sposób uzyskania:**
```bash
# Użyj Xiaomi Cloud Tokens Extractor
# https://github.com/PiotrMachowski/Xiaomi-cloud-tokens-extractor
python3 token_extractor.py
```

### 3.3 Protokół BLE (Uproszczony)
```javascript
// Skanowanie urządzeń
noble.on('discover', (peripheral) => {
  if (peripheral.advertisement.localName?.includes('MIBCS')) {
    // Znaleziono wagę S400
    parseAdvertisement(peripheral.advertisement);
  }
});

// Dane w zaszyfrowanych MiBeacon advertisements
// Wymagają odszyfrowania za pomocą BLE Key
```

### 3.4 Źródła Kodu Referencyjnego
- [mnm-matin/miscale](https://github.com/mnm-matin/miscale) - Python, S400 support
- [lswiderski/mi-scale-exporter](https://github.com/lswiderski/mi-scale-exporter) - C#/.NET
- [oliexdev/openScale](https://github.com/oliexdev/openScale) - Java/Android

---

## 4. Formuły Obliczeniowe (Evidence-Based)

### 4.1 BMI (Body Mass Index)
```javascript
const calculateBMI = (weight, heightCm) => {
  const heightM = heightCm / 100;
  return weight / (heightM * heightM);
};
```

**Interpretacja WHO:**
| BMI | Kategoria |
|-----|-----------|
| < 18.5 | Niedowaga |
| 18.5 - 24.9 | Norma |
| 25.0 - 29.9 | Nadwaga |
| ≥ 30.0 | Otyłość |

### 4.2 BMR - Mifflin-St Jeor (Najdokładniejsza formuła)
```javascript
const calculateBMR = (weight, heightCm, age, isMale) => {
  const base = 10 * weight + 6.25 * heightCm - 5 * age;
  return isMale ? base + 5 : base - 161;
};
```

### 4.3 Body Fat % (Szacowane z impedancji)
```javascript
// Formuła uproszczona (zależna od producenta)
const estimateBodyFat = (weight, heightCm, age, impedance, isMale) => {
  // Współczynniki bazujące na badaniach BIA
  const lbm = (heightCm * heightCm) / impedance * 0.55 + 0.13 * weight;
  const fatMass = weight - lbm;
  return (fatMass / weight) * 100;
};
```

### 4.4 Zakres Zdrowy - Body Fat % (ACE Guidelines)

**Kobiety:**
| Kategoria | % Tłuszczu |
|-----------|------------|
| Niezbędny | 10-13% |
| Atletyczny | 14-20% |
| Fitness | 21-24% |
| Akceptowalny | 25-31% |
| Otyłość | >32% |

**Mężczyźni:**
| Kategoria | % Tłuszczu |
|-----------|------------|
| Niezbędny | 2-5% |
| Atletyczny | 6-13% |
| Fitness | 14-17% |
| Akceptowalny | 18-24% |
| Otyłość | >25% |

### 4.5 Visceral Fat (Tłuszcz Trzewny)
```javascript
// Skala 1-59 (Tanita standard)
const interpretVisceralFat = (level) => {
  if (level <= 9) return { status: 'healthy', risk: 'low' };
  if (level <= 12) return { status: 'acceptable', risk: 'moderate' };
  if (level <= 19) return { status: 'elevated', risk: 'high' };
  return { status: 'severe', risk: 'very_high' };
};
```

---

## 5. Struktura Danych JSON

### 5.1 Pojedynczy Pomiar
```json
{
  "id": "uuid-v4",
  "timestamp": "2024-01-15T08:30:00.000Z",
  "raw": {
    "weight_kg": 75.4,
    "impedance_ohm": 485,
    "heart_rate_bpm": 68
  },
  "calculated": {
    "bmi": 24.1,
    "body_fat_percent": 18.5,
    "muscle_mass_kg": 58.2,
    "body_water_percent": 55.3,
    "bone_mass_kg": 3.1,
    "visceral_fat_level": 8,
    "bmr_kcal": 1720,
    "protein_percent": 17.2,
    "body_score": 82
  },
  "user_profile_id": "default",
  "device": {
    "mac": "XX:XX:XX:XX:XX:XX",
    "model": "MJTZC01YM"
  }
}
```

### 5.2 Profil Użytkownika
```json
{
  "id": "default",
  "name": "Robert",
  "gender": "male",
  "birth_date": "1985-06-15",
  "height_cm": 178,
  "activity_level": "moderate",
  "goals": {
    "target_weight_kg": 72,
    "target_body_fat_percent": 15
  }
}
```

---

## 6. Zakładki UI i Wizualizacje

### 6.1 Dashboard (Główny Widok)
- **Ostatni pomiar** - karty z kluczowymi metrykami
- **Quick Stats** - waga, BMI, body fat z kolorowymi wskaźnikami
- **Mini trend** - wykres ostatnich 7 dni
- **Health Score** - okrągły wskaźnik 0-100
- **Daily Tip** - spersonalizowana porada zdrowotna

### 6.2 Measurement (Nowy Pomiar)
- **Status połączenia BLE** - ikona Bluetooth
- **Instrukcja krok po kroku** - jak wykonać pomiar
- **Live data** - wyświetlanie w czasie rzeczywistym
- **Zapis automatyczny** - po stabilizacji wagi

### 6.3 History (Historia)
- **Lista pomiarów** - tabela sortowalna
- **Filtry** - zakres dat, użytkownik
- **Quick view** - podgląd pojedynczego pomiaru
- **Export** - CSV, PDF
- **Delete** - usuwanie pomiarów

### 6.4 Trends (Wykresy)
- **Line charts** - waga, body fat, muscle mass w czasie
- **Comparison** - różne metryki na jednym wykresie
- **Period selector** - 7d, 30d, 90d, 1y, all
- **Moving average** - wygładzenie trendów
- **Goal lines** - cele użytkownika

### 6.5 Analysis (Szczegółowa Analiza)
- **Body Composition Breakdown** - wykres kołowy
- **Metric Details** - każda metryka z interpretacją
- **Comparison vs Healthy Range** - slider/gauge
- **Age/Gender Percentile** - jak wypadasz vs populacja
- **Recommendations** - evidence-based porady

### 6.6 Settings (Ustawienia)
- **User Profile** - dane osobowe
- **BLE Configuration** - MAC, BLE Key
- **Data Management** - backup, restore, clear
- **Appearance** - dark/light mode
- **Units** - kg/lbs, cm/in

---

## 7. Rekomendacje Zdrowotne (Evidence-Based)

### 7.1 Źródła Naukowe
- **WHO** - BMI classification
- **ACE** - Body fat percentage guidelines
- **ACSM** - Exercise recommendations
- **Tanita** - Visceral fat scale interpretation
- **ESPEN** - BIA clinical guidelines

### 7.2 Przykładowe Rekomendacje

```javascript
const recommendations = {
  high_body_fat: {
    title: "Wysoki poziom tkanki tłuszczowej",
    advice: [
      "Rozważ deficyt kaloryczny 300-500 kcal/dzień",
      "Zwiększ aktywność fizyczną - minimum 150 min/tydzień",
      "Skup się na treningu siłowym dla zachowania masy mięśniowej",
      "Ogranicz przetworzoną żywność i cukry proste"
    ],
    sources: ["ACSM Guidelines 2018", "WHO Physical Activity Guidelines"]
  },
  low_muscle_mass: {
    title: "Niska masa mięśniowa",
    advice: [
      "Zwiększ spożycie białka do 1.6-2.2g/kg masy ciała",
      "Wprowadź trening oporowy 2-3x w tygodniu",
      "Zadbaj o odpowiednią regenerację (7-9h snu)",
      "Rozważ suplementację kreatyny (3-5g/dzień)"
    ],
    sources: ["ISSN Position Stand on Protein", "ACSM Resistance Training"]
  },
  high_visceral_fat: {
    title: "Podwyższony tłuszcz trzewny",
    advice: [
      "Priorytet: redukcja obwodu talii",
      "Cardio HIIT jest szczególnie efektywne",
      "Ogranicz alkohol i stres",
      "Monitoruj ciśnienie krwi i poziom cukru"
    ],
    sources: ["Tanita Clinical Guidelines", "WHO CVD Prevention"]
  }
};
```

---

## 8. Fazy Implementacji

### Faza 1: Fundament (Tydzień 1-2)
- [ ] Konfiguracja projektu Electron + React
- [ ] Struktura katalogów i plików
- [ ] Podstawowy UI z nawigacją zakładek
- [ ] System przechowywania JSON
- [ ] Profile użytkowników

### Faza 2: Integracja BLE (Tydzień 3-4)
- [ ] Implementacja skanera BLE (@noble)
- [ ] Parser danych S400
- [ ] Deszyfrowanie MiBeacon
- [ ] UI połączenia z wagą
- [ ] Live measurement display

### Faza 3: Obliczenia i Analiza (Tydzień 5-6)
- [ ] Implementacja wszystkich formuł
- [ ] Engine rekomendacji zdrowotnych
- [ ] Interpretacja wyników
- [ ] Porównanie z normami

### Faza 4: Wizualizacje (Tydzień 7-8)
- [ ] Dashboard z kartami metryk
- [ ] Wykresy trendów (Recharts/Chart.js)
- [ ] Historia pomiarów z filtrami
- [ ] Szczegółowa analiza body composition

### Faza 5: Polish & Export (Tydzień 9-10)
- [ ] Dark/Light mode
- [ ] Export CSV/PDF
- [ ] Backup/Restore
- [ ] Testy i optymalizacja
- [ ] Dokumentacja użytkownika

---

## 9. Wymagane Zależności

```json
{
  "dependencies": {
    "@abandonware/noble": "^3.0.2",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "recharts": "^2.10.0",
    "uuid": "^9.0.0",
    "date-fns": "^3.0.0"
  },
  "devDependencies": {
    "electron": "^25.9.8",
    "typescript": "^5.0.0",
    "@types/react": "^18.2.0"
  }
}
```

---

## 10. Źródła i Dokumentacja

### GitHub Repositories
- [mnm-matin/miscale](https://github.com/mnm-matin/miscale) - S400 Python integration
- [lswiderski/mi-scale-exporter](https://github.com/lswiderski/mi-scale-exporter) - Mi Scale export
- [oliexdev/openScale](https://github.com/oliexdev/openScale) - Body composition formulas
- [PiotrMachowski/Xiaomi-cloud-tokens-extractor](https://github.com/PiotrMachowski/Xiaomi-cloud-tokens-extractor) - BLE Key extraction
- [noble/noble](https://github.com/noble/noble) - Node.js BLE library

### Specyfikacja Techniczna
- [Xiaomi S400 Specs](https://www.mi.com/global/product/xiaomi-body-composition-scale-s400/specs/)
- [Electron Device Access](https://www.electronjs.org/docs/latest/tutorial/devices)

### Rekomendacje Zdrowotne
- [ACE Body Fat Guidelines](https://download.tomtom.com/open/manuals/band/html/en-us/ACEBodyCompositionPercentageChart-Ibiza.htm)
- [ACSM Body Composition](https://acsm.org/education-resources/books/body-composition-assessment/)
- [Tanita Visceral Fat](https://tanita.eu/understanding-your-measurements/visceral-fat)
- [ESPEN BIA Guidelines (PDF)](https://www.espen.org/documents/BIA1.pdf)

### Artykuły Naukowe
- [BIA Accuracy in Epidemiological Studies (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC2543039/)
- [Visceral Fat and Metabolic Risk (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC7893433/)

---

## 11. Pytania do Ustalenia

1. **BLE Key** - Czy masz już klucz BLE dla swojej wagi S400?
2. **Profile** - Ile użytkowników ma obsługiwać aplikacja?
3. **Język UI** - Polski, angielski, czy oba?
4. **Dodatkowe metryki** - Czy chcesz śledzić coś poza danymi z wagi (np. obwody)?

---

**Status:** Gotowy do akceptacji
**Autor:** Claude (Brainstorm Session)
**Data:** 2025-01-30
