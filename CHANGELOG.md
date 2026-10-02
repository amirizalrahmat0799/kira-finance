# Changelog

All notable changes to this project. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- Dependabot: weekly, grouped minor and patch updates for the backend's Maven and Docker image, the mobile app's npm packages (Expo SDK packages excluded) and GitHub Actions, so CI checks them together. Major upgrades are left
  for deliberate, hand-made changes.

## [1.0.0] - 2026-10-02

### Added
- Offline-first mobile app (React Native + Expo, SQLite): expenses and income, budgets with 80% and 100% alerts,
  recurring bills with reminders, insights, light and dark mode.
- Spring Boot sync API with JWT access tokens, rotating refresh tokens, last-write-wins sync and tombstones.
- Installable Android APK built with EAS.
- Jenkinsfile for the Jenkins CI lab.

[Unreleased]: https://github.com/amirizalrahmat0799/kira-finance/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/amirizalrahmat0799/kira-finance/releases/tag/v1.0.0
