# Contributing to TheScale App

Thank you for your interest in contributing to TheScale App! This document provides guidelines and information for contributors.

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for everyone.

## How to Contribute

### Reporting Bugs

Before creating a bug report:
1. Check the existing issues to avoid duplicates
2. Ensure you're using the latest version

When creating a bug report, include:
- A clear, descriptive title
- Steps to reproduce the behavior
- Expected vs actual behavior
- Screenshots if applicable
- Your environment (OS version, Node.js version, etc.)

### Suggesting Features

Feature requests are welcome! Please:
1. Check if the feature has already been suggested
2. Provide a clear use case
3. Explain why this would benefit most users

### Pull Requests

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests (`npm test`)
5. Run type checking (`npm run typecheck`)
6. Commit your changes (`git commit -m 'Add amazing feature'`)
7. Push to the branch (`git push origin feature/amazing-feature`)
8. Open a Pull Request

## Development Setup

### Prerequisites

- Node.js 18+
- npm

### Installation

```bash
git clone https://github.com/yourusername/thescale-app.git
cd thescale-app
npm install
```

### Development Commands

```bash
# Start development mode
npm run dev

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Type checking
npm run typecheck

# Build for production
npm run build
```

## Project Structure

```
src/
├── domain/          # Core business logic, calculations
├── application/     # Use cases, services
├── infrastructure/  # External integrations (BLE, storage)
├── presentation/    # React components, hooks, stores
└── main/           # Electron main process
```

## Coding Standards

### TypeScript

- Use strict TypeScript configuration
- Prefer explicit types over `any`
- Use interfaces for object shapes
- Document complex functions with JSDoc comments

### React

- Use functional components with hooks
- Keep components small and focused
- Use custom hooks for reusable logic

### Testing

- Write unit tests for business logic (domain layer)
- Use descriptive test names
- Aim for high coverage on calculations and critical paths

### Commits

- Use clear, descriptive commit messages
- Reference issues when applicable (e.g., "Fix #123: ...")
- Keep commits focused on single changes

## Architecture Guidelines

This project follows Clean Architecture principles:

1. **Domain layer** - Pure business logic, no external dependencies
2. **Application layer** - Orchestrates use cases, depends only on domain
3. **Infrastructure layer** - External integrations, implements domain interfaces
4. **Presentation layer** - UI components, depends on application layer

Changes should respect these layer boundaries.

## Questions?

Feel free to open an issue for questions about contributing.
