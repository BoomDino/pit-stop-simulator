import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from .config import Config
from .database import Database
from .uipath_service import UiPathService, UiPathError
from .event_service import EventService, GameEvent

logger = logging.getLogger('pitstop')
def create_app(config=None, robot=None):
    config = config or Config()
    robot = robot or UiPathService(config)
    db = Database(config.database, recover=True)
    service = EventService(db, robot)
    @asynccontextmanager
    async def lifespan(app):
        yield
        if hasattr(robot, 'client'):
            await robot.client.aclose()
    app = FastAPI(title='RPA Pit Stop — real UiPath integration', lifespan=lifespan)
    app.add_middleware(CORSMiddleware, allow_origins=config.origins.split(','),
                       allow_methods=['GET', 'POST'], allow_headers=['Content-Type'])
    @app.get('/api/health')
    async def health():
        return {'status': 'ok', 'service': 'FastAPI', 'uipath_configured': not config.missing}
    @app.get('/api/uipath/status')
    async def status():
        try:
            return await robot.status()
        except UiPathError as exc:
            logger.warning('UiPath status unavailable: %s', exc)
            return {'connected': False, 'bot_online': False, 'detail': str(exc)}
    @app.post('/api/pitstop/event')
    async def event(payload: GameEvent, retry: bool = False):
        return await service.submit(payload, retry)
    @app.get('/api/uipath/job/{job_id}')
    async def job(job_id: str):
        if not job_id.isdigit() or len(job_id) > 20:
            raise HTTPException(422, 'Expected numeric Orchestrator job ID')
        try:
            return await service.refresh(job_id)
        except UiPathError as exc:
            raise HTTPException(503, str(exc))
    @app.get('/api/pitstop/logs')
    async def logs(limit: int = Query(100, ge=1, le=500)):
        return db.logs(limit)
    return app

app = create_app()
