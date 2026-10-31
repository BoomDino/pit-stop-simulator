"""Operator recovery: attach an independently located job to an UNKNOWN event.
Never starts a job. Checks complete original input before changing local history.
"""
import argparse
import asyncio
import json
from .config import Config
from .database import Database
from .uipath_service import UiPathService

async def reconcile(event_id, job_id):
    config = Config()
    db = Database(config.database)
    row = db.get(event_id)
    if not row or row['state'] != 'UNKNOWN':
        raise ValueError('Only an UNKNOWN event can be reconciled')
    robot = UiPathService(config)
    try:
        job = await robot.job(job_id)
        arguments = json.loads(job.get('InputArguments') or '{}')
        actual = json.loads(arguments.get('in_EventJson', '{}'))
        if actual != json.loads(row['payload']):
            raise ValueError('Job input does not match stored event exactly; refusing attachment')
        db.update(event_id, 'PENDING', str(job_id), 'Operator attached verified existing job')
        print('Attached existing job. Use Retry / refresh jobs to retrieve its real result.')
    finally:
        await robot.client.aclose()

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('event_id')
    parser.add_argument('job_id', type=int)
    args = parser.parse_args()
    asyncio.run(reconcile(args.event_id, args.job_id))
