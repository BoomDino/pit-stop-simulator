# Contributing to F1 Pit Stop Simulator

Thank you for your interest in contributing to the **F1 Pit Stop Simulator**! Whether you are fixing a bug, adding new telemetry graphics, refining procedural sound synthesis, or extending RPA workflows, all contributions are welcome.

## Development Workflow

1. **Fork and Clone** the repository.
2. **Create a Topic Branch**:
   ```bash
   git checkout -b feature/my-new-feature
   ```
3. **Set Up the Environment**:
   - Ensure Node.js (v18+) is installed.
   - For Python backend work, create a virtual environment:
     ```bash
     python -m venv .venv
     source .venv/bin/activate  # On Windows: .venv\Scripts\activate
     pip install -r backend/requirements.txt
     ```
4. **Make Changes & Test**:
   - Run the frontend & server tests:
     ```bash
     npm run test:node
     ```
   - Run backend unit tests:
     ```bash
     npm run test:python
     ```
5. **Security & Privacy Rules**:
   - Never commit secrets, credentials, or actual `.env` files.
   - Respect the static file allowlist in `server.js` to avoid leaking server-side assets or database files.
   - If developing UiPath workflows, use parameter bindings (`in_EventJson`, `out_ResultJson`) and adhere to the contract in `uipath/README.md`.
6. **Commit & Push**:
   ```bash
   git commit -m "feat: add telemetry tire temp gauges"
   git push origin feature/my-new-feature
   ```
7. **Open a Pull Request** describing your changes.

## Code Standards
- Keep vanilla JavaScript modular and clean.
- Ensure all tests pass before submitting your PR.
- Add descriptive comments for complex timing calculations or sound synthesis routines.
