# TheScale App

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Electron](https://img.shields.io/badge/Electron-40.x-47848F?logo=electron)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-18.x-61DAFB?logo=react)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript)](https://www.typescriptlang.org/)

Desktop application for Xiaomi Mi Body Composition Scale S400 that enables weight tracking, body composition analysis, and health monitoring on macOS.

> **Note**: This application is not affiliated with or endorsed by Xiaomi Corporation.

> **Disclaimer**: This project was created for learning purposes using [Claude Code](https://claude.ai/claude-code). Use at your own risk. The author assumes no responsibility for any issues arising from its use.

## Features

- **BLE Connection**: Connect to Xiaomi Mi Body Composition Scale S400 via Bluetooth Low Energy
- **Body Composition Analysis**: Calculate body fat, muscle mass, BMI, and other health metrics
- **Profile Management**: Support for multiple user profiles
- **Measurement History**: Track weight and body composition over time
- **Health Reports**: Generate comprehensive health reports with trends
- **Device Discovery**: Auto-scan for nearby Mi Scale devices

## Screenshots

### Dashboard
<table>
  <tr>
    <td align="center" width="50%">
      <img src="docs/images/dashboard-overview.png" alt="Dashboard Overview" width="100%"/>
      <br/><em>Quick metrics, body score, and weekly trend</em>
    </td>
    <td align="center" width="50%">
      <img src="docs/images/dashboard-recommendations.png" alt="Dashboard Recommendations" width="100%"/>
      <br/><em>Health recommendations and recent activity</em>
    </td>
  </tr>
</table>

### Measurement
<table>
  <tr>
    <td align="center">
      <img src="docs/images/measurement-ready.png" alt="Measurement Ready" width="60%"/>
      <br/><em>BLE connected and ready to measure</em>
    </td>
  </tr>
</table>

### History
<table>
  <tr>
    <td align="center">
      <img src="docs/images/history-details.png" alt="Measurement History" width="70%"/>
      <br/><em>Measurement history with expandable details</em>
    </td>
  </tr>
</table>

### Trends
<table>
  <tr>
    <td align="center" width="33%">
      <img src="docs/images/trends-weight.png" alt="Weight Trends" width="100%"/>
      <br/><em>Weight over time</em>
    </td>
    <td align="center" width="33%">
      <img src="docs/images/trends-bmr.png" alt="BMR Trends" width="100%"/>
      <br/><em>Basal metabolic rate</em>
    </td>
    <td align="center" width="33%">
      <img src="docs/images/trends-body-score.png" alt="Body Score Trends" width="100%"/>
      <br/><em>Body score with all metrics</em>
    </td>
  </tr>
</table>

### Analysis
<table>
  <tr>
    <td align="center" width="50%">
      <img src="docs/images/analysis-body-composition.png" alt="Body Composition" width="100%"/>
      <br/><em>Body score and composition breakdown</em>
    </td>
    <td align="center" width="50%">
      <img src="docs/images/analysis-health-risks.png" alt="Health Risks" width="100%"/>
      <br/><em>Metabolic health and risk assessment</em>
    </td>
  </tr>
</table>

### Settings
<table>
  <tr>
    <td align="center" width="50%">
      <img src="docs/images/settings-profiles.png" alt="User Profiles" width="100%"/>
      <br/><em>Multiple user profiles</em>
    </td>
    <td align="center" width="50%">
      <img src="docs/images/settings-device.png" alt="Device Settings" width="100%"/>
      <br/><em>Device discovery and BLE key extraction</em>
    </td>
  </tr>
  <tr>
    <td align="center" width="50%">
      <img src="docs/images/settings-appearance-light.png" alt="Light Theme" width="100%"/>
      <br/><em>Light theme</em>
    </td>
    <td align="center" width="50%">
      <img src="docs/images/settings-appearance-dark.png" alt="Dark Theme" width="100%"/>
      <br/><em>Dark theme</em>
    </td>
  </tr>
  <tr>
    <td align="center" colspan="2">
      <img src="docs/images/settings-about.png" alt="About" width="50%"/>
      <br/><em>About page with version info</em>
    </td>
  </tr>
</table>

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

This project is licensed under the [MIT License](LICENSE).

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed contribution guidelines.

## Security

For security concerns, please see our [Security Policy](SECURITY.md).

## Acknowledgments

Special thanks to all the open-source contributors whose work made this project possible. If you use this project, please consider supporting the original authors of the libraries and tools mentioned above.
