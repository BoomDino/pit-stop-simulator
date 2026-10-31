# UiPath setup and live acceptance

## Current verification boundary

`PitStopAutomation.xaml` is authored workflow source, **not yet compiled or executed in UiPath Studio**. XML parsing and XLSX template structure have been tested. The Linux development environment has no Studio/Robot, credentials or published process. Do not describe this integration as live-verified until the acceptance checklist below passes.

## Studio (Windows, Visual Basic project)

1. Create a **Process**, compatibility **Windows**, language **VB**, named `PitStopAutomation`. Use a currently supported Studio/Robot pair.
2. In Manage Packages install/resolve **UiPath.System.Activities**, which supplies Invoke Code and Log Message. Ensure Newtonsoft.Json is available in Imports/dependencies (normally supplied transitively). Let Studio generate its own project.json and version pins for your installed release.
3. Copy `PitStopAutomation.xaml` into that project and set it as Main. The workflow has `in_EventJson` (In, String) and `out_ResultJson` (Out, String). Keep those names exactly.
4. Validate File and Analyze Project. Resolve assembly/import warnings in Studio before publishing. The Invoke Code uses .NET `System.IO.Compression`, `System.Xml.Linq` and Newtonsoft.Json. `ValidateAndRecord.vb` is the readable copy of the embedded code; if your Studio version needs Invoke Code recreated, paste that code and bind `eventJson` In String to `in_EventJson`, and `resultJson` Out String to `out_ResultJson`.
5. Create a persistent directory writable by the **unattended robot account**. Set a machine environment variable in an administrator PowerShell, then restart the Robot service so it receives the value:

```powershell
New-Item -ItemType Directory -Force C:\PitStopLogs
[Environment]::SetEnvironmentVariable('PITSTOP_LOG_DIR', 'C:\PitStopLogs', 'Machine')
```

Grant the robot Windows account Modify permission using the folder Security tab. Do not use a downloaded package's temporary extraction directory. The robot creates `PitStop_Execution_Log.xlsx` on its first valid event; the supplied file is an empty template, not execution evidence. All jobs for a run must use **one robot machine and the same output directory**. For a multi-machine deployment, supply a shared persistent path with reliable exclusive locks/atomic replace and matching permissions. Keep the workbook closed in Excel during writes.

6. Debug with an event from `tests/live_smoke.py` or a captured backend payload, then inspect `out_ResultJson` and the Excel file. Try an invalid wheel and stage 2 before stage 1: both must return `success: false` and emit an Error-level UiPath log.
7. Publish to your Orchestrator tenant feed. In the intended modern folder create a Process from that package with entry point `PitStopAutomation.xaml`. Set `UIPATH_PROCESS_NAME` to the **folder process display name**, not merely the package name.
8. Assign the robot account, machine template, unattended runtime/license and process to that folder. Configure an execution identity capable of running unattended. This integration starts modern-folder Unattended jobs; attended-only and classic-folder configurations are not supported by these defaults.

## Orchestrator authentication

For Automation Cloud, create a **confidential external application** with **application scopes** using OAuth client credentials. Configure `OR.Jobs`, `OR.Execution`, `OR.Robots` as available in your tenant, and grant the app folder permissions for Jobs create/view, Processes view and robot/session view. Scope names and permissions must be checked against your installed version's Swagger/admin UI. Assign the app to the target folder; a valid token alone does not grant folder access.

Backend configuration uses:

- `UIPATH_BASE_URL=https://cloud.uipath.com`, organization logical name, tenant logical name.
- `UIPATH_CLIENT_ID`, `UIPATH_CLIENT_SECRET` (backend only).
- `UIPATH_FOLDER_ID`: numeric modern-folder ID, sent as `X-UIPATH-OrganizationUnitId`.
- `UIPATH_PROCESS_NAME`: unique published process name in that folder.
- Optional `UIPATH_SCOPES` to match permitted application scopes.

Cloud token URL: `https://cloud.uipath.com/identity_/connect/token`.
Cloud service URL: `https://cloud.uipath.com/{organization}/{tenant}/orchestrator_`.
For OAuth-capable Automation Suite/standalone, set **both** `UIPATH_TOKEN_URL` and `UIPATH_ORCHESTRATOR_URL` to your installation's exact endpoints. Check its Swagger for Releases, Sessions, Jobs and ModernJobsCount. Legacy username/password authentication and classic-folder dispatch are deliberately not guessed.

Official references: [External app authentication](https://docs.uipath.com/orchestrator/automation-cloud/latest/user-guide/authenticating-with-an-external-application), [Jobs API](https://docs.uipath.com/orchestrator/automation-cloud/latest/api-guide/jobs-requests). Implementation resolves a release, calls StartJobs with a JSON-encoded `in_EventJson`, then retrieves actual job State and OutputArguments.

## What the robot actually does

It validates wheel/stage/event, checks persistent per-run sequence in the workbook, appends the requested timestamp/player/event/wheel/status/time/score/result columns, and returns structured JSON. Extra Run ID, Event ID and Stage columns support sequence validation and deduplication. It writes real OOXML/XLSX using .NET; Excel installation and UI clicking are not needed. It does not control physical wheels or perform the player's skill checks.

The workbook lock covers read, sequence check and atomic replacement. Duplicate event IDs with matching event data are confirmed without another row. Invalid data/sequence and file failures return failure and an Error log. A UiPath job's `Successful` state alone is insufficient: FastAPI also requires `out_ResultJson.success == true` and matching event ID/stage.

## Acceptance checklist (pending live verification)

- [ ] Studio Validate/Analyze/Debug succeeds on the target version.
- [ ] Status endpoint authenticates and resolves the published process in the correct folder.
- [ ] Robot session availability is reported from Orchestrator (connected does not imply robot online).
- [ ] Six jobs have real IDs and confirmed outputs for one six-stage run.
- [ ] Actual runtime workbook contains six ordered rows for that Run ID.
- [ ] Repeating an event does not add another job/row.
- [ ] Invalid wheel and sequence fail in both API validation and direct Studio debugging.
- [ ] Stopping FastAPI, invalidating credentials, and stopping the robot leave gameplay playable with truthful failure/pending status.
- [ ] Robot file-permission failure shows failure, then explicit retry succeeds after fixing permissions.

## Recovery

**RETRYABLE:** no job was confirmed submitted (configuration/authentication/release lookup or explicit rejection). Fix configuration and press Retry / refresh jobs.

**PENDING:** a real job ID exists. Polling continues; a disconnected robot may leave it pending. Inspect Orchestrator queue/runtime allocation. Never manufacture a result for a delayed job.

**FAILED:** terminal job failure or missing/invalid structured output. Fix robot/workflow, then press Retry / refresh jobs for a new attempt. The same event ID lets the workbook deduplicate an already-written row. Subsequent stages wait for confirmed success.

**UNKNOWN:** StartJobs response was ambiguous, or backend crashed during dispatch. Automatic redispatch is blocked. Find the job in Orchestrator using original `in_EventJson.event_id` (history is at `/api/pitstop/logs`). Attach it with:

```bash
python -m backend.reconcile EVENT_UUID ACTUAL_NUMERIC_JOB_ID
```

The command fetches that actual job and requires its entire input to match the stored payload. Press Retry / refresh jobs to retrieve its outcome. If no job can be established, keep the event UNKNOWN and begin a new game run after resolving the cause; this version intentionally has no unsafe force-resend for ambiguous submissions.

Run a **single FastAPI worker**. Do not reset the database or edit runtime Excel rows while jobs are active. Browser retries preserve IDs across refresh; browser storage failure is explicitly reported and only in-memory retention remains.
