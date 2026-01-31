# Sample Data

This folder contains sample data for learning and testing purposes.

## Structure

```
sample-data/
├── profiles/          # Sample user profiles
│   └── test-user.json
└── measurements/      # Sample body composition measurements
    └── sample-measurement.json
```

## Usage

To use sample data for testing:

1. Copy files to the `data/` directory:
   ```bash
   cp -r examples/sample-data/* data/
   ```

2. Or use the test data generator:
   ```bash
   npm run test-data:generate
   ```

## Data Format

### Profile

```json
{
  "id": "unique-uuid",
  "name": "User Name",
  "gender": "male" | "female",
  "birthYear": 1990,
  "heightCm": 175,
  "isDefault": true,
  "createdAt": "ISO-date",
  "updatedAt": "ISO-date"
}
```

### Measurement

```json
{
  "id": "unique-uuid",
  "profileId": "profile-uuid",
  "timestamp": "ISO-date",
  "weight": 75.5,
  "impedance": 500,
  "bodyComposition": {
    "bmi": 24.7,
    "bodyFatPercentage": 18.5,
    "muscleMass": 55.2,
    "boneMass": 3.2,
    "bodyWater": 55.0,
    "visceralFat": 8,
    "bmr": 1720,
    "leanBodyMass": 61.5,
    "proteinPercentage": 18.2
  }
}
```
