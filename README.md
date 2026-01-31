# TheScale App

Desktop application for Xiaomi Mi Body Composition Scale S400 that enables weight tracking, body composition analysis, and health monitoring on macOS.

## Features

- **BLE Connection**: Connect to Xiaomi Mi Body Composition Scale S400 via Bluetooth Low Energy
- **Body Composition Analysis**: Calculate body fat, muscle mass, BMI, and other health metrics
- **Profile Management**: Support for multiple user profiles
- **Measurement History**: Track weight and body composition over time
- **Health Reports**: Generate comprehensive health reports with trends
- **Device Discovery**: Auto-scan for nearby Mi Scale devices

## Tech Stack

- **Electron** - Cross-platform desktop framework
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Zustand** - State management
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **Vitest** - Testing

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

### Build

```bash
npm run build
```

### Testing

```bash
npm test
```

## Architecture

The application follows Clean Architecture principles with the following layers:

- **Domain** - Core business logic and calculations
- **Application** - Use cases and service orchestration
- **Infrastructure** - External integrations (BLE, storage)
- **Presentation** - React components and state management

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed architecture documentation.

---

## Credits & External Resources

This project uses code, algorithms, and resources from the following open-source projects:

### BLE & Xiaomi Integration

- **[PiotrMachowski/Xiaomi-cloud-tokens-extractor](https://github.com/PiotrMachowski/Xiaomi-cloud-tokens-extractor)**
  Tool for retrieving tokens and BLE encryption keys from Xiaomi cloud.
  Used for: BLE key extraction API reference and QR code authentication flow.
  License: MIT

- **[oliexdev/openScale](https://github.com/oliexdev/openScale)**
  Open source body weight and body composition scale app for Android.
  Used for: Mi Scale protocol reference and body composition calculations.
  License: GPL-3.0

- **[lolouk44/xiaomi_mi_scale](https://github.com/lolouk44/xiaomi_mi_scale)**
  Xiaomi Mi Scale 2 integration for Home Assistant.
  Used for: BLE advertisement parsing and weight data decoding reference.
  License: MIT

### Body Composition Algorithms

- **[oliexdev/openScale - BFBroca.java](https://github.com/oliexdev/openScale/blob/master/android_app/app/src/main/java/com/health/openscale/core/bodymetric/BFBroca.java)**
  Body fat calculation using Broca formula.
  License: GPL-3.0

- **[oliexdev/openScale - WaterMifflin.java](https://github.com/oliexdev/openScale/blob/master/android_app/app/src/main/java/com/health/openscale/core/bodymetric/WaterMifflin.java)**
  Total body water estimation using Mifflin-St Jeor derived formula.
  License: GPL-3.0

- **[oliexdev/openScale - LBMBoer.java](https://github.com/oliexdev/openScale/blob/master/android_app/app/src/main/java/com/health/openscale/core/bodymetric/LBMBoer.java)**
  Lean body mass calculation using Boer formula.
  License: GPL-3.0

### MiBeacon Protocol Research

- **[home-is-where-you-hang-your-hack/ble_monitor](https://github.com/custom-components/ble_monitor)**
  BLE Monitor integration for Home Assistant.
  Used for: MiBeacon protocol documentation and encryption reference.
  License: MIT

- **[Passive BLE Monitor - MiBeacon Protocol Documentation](https://home-is-where-you-hang-your-hack.github.io/ble_monitor/MiBeacon_protocol)**
  Comprehensive documentation of Xiaomi's MiBeacon protocol.
  Used for: Understanding BLE advertisement format and encryption.

### Web-Based Tools

- **[Xiaomi Cloud Tokens Extractor (Web)](https://xiaomi-token-web.asd.workers.dev/)**
  Web-based tool for extracting Xiaomi device tokens.
  Reference implementation for web-based authentication flow.

### Scientific References

Body composition formulas are based on peer-reviewed research:

- **BMR (Basal Metabolic Rate)**: Mifflin-St Jeor equation (1990)
- **Body Fat %**: Broca formula adaptation
- **Lean Body Mass**: Boer formula (1984)
- **Total Body Water**: Watson formula derivatives
- **BMI Categories**: WHO classification standards

### UI Libraries

- **[shadcn/ui](https://ui.shadcn.com/)**
  Re-usable components built with Radix UI and Tailwind CSS.
  Used for: UI component patterns and styling reference.
  License: MIT

- **[Recharts](https://recharts.org/)**
  Composable charting library built on React components.
  Used for: Weight trend visualization.
  License: MIT

- **[Zustand](https://github.com/pmndrs/zustand)**
  Bear necessities for state management in React.
  Used for: Application state management.
  License: MIT

### Development Tools

- **[Electron](https://www.electronjs.org/)** - MIT License
- **[Vite](https://vitejs.dev/)** - MIT License
- **[Vitest](https://vitest.dev/)** - MIT License
- **[Tailwind CSS](https://tailwindcss.com/)** - MIT License

---

## License

This project is licensed under the ISC License.

## Acknowledgments

Special thanks to all the open-source contributors whose work made this project possible. If you use this project, please consider supporting the original authors of the libraries and tools mentioned above.
