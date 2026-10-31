import asyncio
import json
import logging
import sqlite3
from typing import Literal
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field, AwareDatetime, model_validator
from fastapi import HTTPException
from .uipath_service import UiPathError

logger = logging.getLogger('pitstop.events')

WHEELS = [None, 'FRONT_LEFT', 'FRONT_RIGHT', 'REAR_LEFT', 'REAR_RIGHT', None]
class GameEvent(BaseModel):
    model_config = ConfigDict(extra='forbid', allow_inf_nan=False)
    event_id: UUID
    run_id: UUID
    player_id: str = Field(min_length=1, max_length=80, pattern=r'^[a-zA-Z0-9_-]+$')
    stage: int = Field(ge=1, le=6)
    event: Literal['DOCK_IN', 'TYRE_REPLACED', 'DOCK_OUT']
    wheel_position: Literal['FRONT_LEFT', 'FRONT_RIGHT', 'REAR_LEFT', 'REAR_RIGHT'] | None = None
    status: Literal['SUCCESS']
    player_score: int = Field(ge=0, le=600)
    execution_time: float = Field(ge=0, le=86400)
    timestamp: AwareDatetime

    @model_validator(mode='after')
    def validate_stage(self):
        expected = 'DOCK_IN' if self.stage == 1 else 'DOCK_OUT' if self.stage == 6 else 'TYRE_REPLACED'
        if self.event != expected or self.wheel_position != WHEELS[self.stage-1]:
            raise ValueError('Event/wheel does not match stage')
        return self

class EventService:
    def __init__(self, db, robot):
        self.db, self.robot = db, robot
        self.lock = asyncio.Lock()

    async def submit(self, event, retry=False):
        payload = event.model_dump(mode='json')
        eid = payload['event_id']
        encoded = json.dumps(payload, sort_keys=True)
        async with self.lock:
            old = self.db.get(eid)
            if old:
                if old['payload'] != encoded:
                    raise HTTPException(409, 'Event ID already used with different data')
                if old['state'] != 'RETRYABLE' and not (retry and old['state'] == 'FAILED'):
                    return old
            with self.db.connect() as db:
                previous = db.execute('SELECT * FROM events WHERE run_id=? AND stage=?',
                                      (payload['run_id'], event.stage - 1)).fetchone()
                if event.stage > 1 and (not previous or previous['state'] != 'SUCCESS'):
                    raise HTTPException(409, 'Previous stage must be confirmed by UiPath first')
                if previous and json.loads(previous['payload'])['player_id'] != event.player_id:
                    raise HTTPException(409, 'Player must remain the same throughout a run')
                try:
                    if not old:
                        db.execute('INSERT INTO events(event_id,run_id,stage,payload,state) VALUES(?,?,?,?,?)',
                                   (eid, payload['run_id'], event.stage, encoded, 'SUBMITTING'))
                    else:
                        db.execute("UPDATE events SET state='SUBMITTING' WHERE event_id=?", (eid,))
                except sqlite3.IntegrityError:
                    raise HTTPException(409, 'Run stage already has an event')
            try:
                job_id = await self.robot.start(payload)
                self.db.update(eid, 'PENDING', job_id)
            except UiPathError as exc:
                self.db.update(eid, 'UNKNOWN' if exc.uncertain else 'RETRYABLE', result=str(exc))
            record = self.db.get(eid)
            logger.info("Event %s stage %s state %s job %s", eid, event.stage, record["state"], record["job_id"])
            return record

    async def refresh(self, job_id):
        with self.db.connect() as db:
            row = db.execute('SELECT * FROM events WHERE job_id=?', (job_id,)).fetchone()
        if not row:
            raise HTTPException(404, 'Job not tracked by this backend')
        job = await self.robot.job(job_id)
        state = job.get('State', 'Unknown')
        result = None
        mapped = 'PENDING'
        if state == 'Successful':
            try:
                output = json.loads(job.get('OutputArguments') or '{}')
                result = output.get('out_ResultJson')
                result = json.loads(result) if isinstance(result, str) else result
                valid = (isinstance(result, dict) and result.get('success') is True
                         and result.get('event_id') == row['event_id'] and result.get('stage') == row['stage'])
                mapped = 'SUCCESS' if valid else 'FAILED'
            except (ValueError, TypeError):
                mapped = 'FAILED'
            if result is None:
                result = {'message': 'Robot ended without valid structured output'}
        elif state in ('Faulted', 'Stopped'):
            mapped, result = 'FAILED', {'message': 'UiPath job ' + state}
        self.db.update(row['event_id'], mapped, result=json.dumps(result) if result is not None else None)
        return {**self.db.get(row['event_id']), 'orchestrator_state': state}
