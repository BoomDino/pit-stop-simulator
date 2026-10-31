"""Explicit live integration test: starts six REAL UiPath jobs. No mocks."""
import argparse
import json
import time
from uuid import uuid4
from datetime import datetime, timezone
import httpx

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base-url', default='http://127.0.0.1:8000')
    parser.add_argument('--start-real-jobs', action='store_true', required=True)
    args = parser.parse_args()
    run = str(uuid4())
    with httpx.Client(base_url=args.base_url, timeout=45) as client:
        health=client.get('/api/health'); health.raise_for_status()
        status=client.get('/api/uipath/status'); status.raise_for_status()
        if not status.json().get('connected'): raise SystemExit(status.text)
        for stage, wheel in enumerate([None,'FRONT_LEFT','FRONT_RIGHT','REAR_LEFT','REAR_RIGHT',None],1):
            payload={'event_id':str(uuid4()),'run_id':run,'player_id':'live_acceptance', 'stage':stage,
                     'event':'DOCK_IN' if stage==1 else 'DOCK_OUT' if stage==6 else 'TYRE_REPLACED',
                     'wheel_position':wheel,'status':'SUCCESS','player_score':stage*100,
                     'execution_time':1.24,'timestamp':datetime.now(timezone.utc).isoformat()}
            response=client.post('/api/pitstop/event',json=payload);response.raise_for_status()
            row=response.json()
            if not row.get('job_id'): raise SystemExit(json.dumps(row))
            deadline=time.monotonic()+300
            while row['state']=='PENDING' and time.monotonic()<deadline:
                time.sleep(2)
                response=client.get('/api/uipath/job/'+row['job_id']);response.raise_for_status();row=response.json()
            print(stage,row['job_id'],row['state'],row.get('result'))
            if row['state']!='SUCCESS': raise SystemExit('Live acceptance failed or timed out')
    print('Six actual robot outputs confirmed. Verify six Excel rows for Run ID:',run)
