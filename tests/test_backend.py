import asyncio
import json
import tempfile
import unittest
from pathlib import Path
from uuid import uuid4
import httpx
from backend.config import Config
from backend.main import create_app
from backend.uipath_service import UiPathService, UiPathError

class FakeRobot:
    """Explicit test double: never used by the production app."""
    def __init__(self):
        self.events = {}
        self.failure = None
        self.output = None
        self.state = 'Successful'
    async def start(self, payload):
        if self.failure: raise self.failure
        jid = str(len(self.events) + 1)
        self.events[jid] = payload
        return jid
    async def status(self):
        if self.failure: raise self.failure
        return {'connected': True, 'bot_online': True}
    async def job(self, jid):
        if self.failure: raise self.failure
        ev = self.events[jid]
        output = self.output if self.output is not None else {'success': True, 'event_id': ev['event_id'], 'stage': ev['stage']}
        return {'Id': int(jid), 'State': self.state, 'OutputArguments': json.dumps({'out_ResultJson': json.dumps(output)})}

class BackendTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.robot = FakeRobot()
        self.client = httpx.AsyncClient(transport=httpx.ASGITransport(app=create_app(Config(database=self.tmp.name+'/test.db'), self.robot)), base_url='http://test')
        self.run = str(uuid4())
    async def asyncTearDown(self):
        await self.client.aclose()
        self.tmp.cleanup()
    def event(self, stage=1):
        return {'event_id': str(uuid4()), 'run_id': self.run, 'player_id': 'test_player', 'stage': stage,
                'event': 'DOCK_IN' if stage == 1 else 'DOCK_OUT' if stage == 6 else 'TYRE_REPLACED',
                'wheel_position': [None,'FRONT_LEFT','FRONT_RIGHT','REAR_LEFT','REAR_RIGHT',None][stage-1],
                'status': 'SUCCESS', 'player_score': stage*100, 'execution_time': 1.24,
                'timestamp': '2026-10-31T12:00:00Z'}
    async def test_health_and_status(self):
        self.assertEqual((await self.client.get('/api/health')).json()['status'], 'ok')
        self.assertTrue((await self.client.get('/api/uipath/status')).json()['connected'])
    async def test_six_stages_and_idempotency(self):
        for stage in range(1,7):
            ev = self.event(stage)
            response = (await self.client.post('/api/pitstop/event', json=ev))
            self.assertEqual(response.status_code,200,response.text)
            data = response.json()
            self.assertEqual(data['state'],'PENDING')
            self.assertEqual((await self.client.post('/api/pitstop/event',json=ev)).json()['job_id'],data['job_id'])
            result = (await self.client.get('/api/uipath/job/'+data['job_id'])).json()
            self.assertEqual(result['state'],'SUCCESS')
        self.assertEqual(len(self.robot.events),6)
        self.assertEqual(len((await self.client.get('/api/pitstop/logs')).json()),6)
    async def test_invalid_wheel_and_sequence(self):
        ev=self.event(2); ev['wheel_position']='SPARE'
        self.assertEqual((await self.client.post('/api/pitstop/event',json=ev)).status_code,422)
        self.assertEqual((await self.client.post('/api/pitstop/event',json=self.event(2))).status_code,409)
        (await self.client.post('/api/pitstop/event',json=self.event()))
        self.assertEqual((await self.client.post('/api/pitstop/event',json=self.event(2))).status_code,409)
    async def test_event_id_conflict(self):
        ev=self.event(); (await self.client.post('/api/pitstop/event',json=ev))
        ev['player_score']=0
        self.assertEqual((await self.client.post('/api/pitstop/event',json=ev)).status_code,409)
    async def test_offline_retry(self):
        ev=self.event(); self.robot.failure=UiPathError('offline')
        self.assertFalse((await self.client.get('/api/uipath/status')).json()['connected'])
        self.assertEqual((await self.client.post('/api/pitstop/event',json=ev)).json()['state'],'RETRYABLE')
        self.robot.failure=None
        self.assertEqual((await self.client.post('/api/pitstop/event',json=ev)).json()['state'],'PENDING')
    async def test_uncertain_submission_never_relaunched(self):
        ev=self.event(); self.robot.failure=UiPathError('timeout',True)
        self.assertEqual((await self.client.post('/api/pitstop/event',json=ev)).json()['state'],'UNKNOWN')
        self.robot.failure=None
        self.assertEqual((await self.client.post('/api/pitstop/event?retry=true',json=ev)).json()['state'],'UNKNOWN')
        self.assertEqual(len(self.robot.events),0)
    async def test_missing_or_wrong_output_fails_and_manual_retry(self):
        ev=self.event(); data=(await self.client.post('/api/pitstop/event',json=ev)).json()
        self.robot.output={'success':True,'event_id':'wrong','stage':1}
        self.assertEqual((await self.client.get('/api/uipath/job/'+data['job_id'])).json()['state'],'FAILED')
        self.assertEqual((await self.client.post('/api/pitstop/event',json=ev)).json()['state'],'FAILED')
        self.assertEqual((await self.client.post('/api/pitstop/event?retry=true',json=ev)).json()['state'],'PENDING')
    async def test_fault_and_status_unavailable(self):
        data=(await self.client.post('/api/pitstop/event',json=self.event())).json()
        self.robot.state='Faulted'
        self.assertEqual((await self.client.get('/api/uipath/job/'+data['job_id'])).json()['state'],'FAILED')
        self.robot.failure=UiPathError('offline')
        self.assertEqual((await self.client.get('/api/uipath/job/'+data['job_id'])).status_code,503)
        self.assertEqual((await self.client.get('/api/uipath/job/not-an-id')).status_code,422)
    async def test_cors(self):
        r=(await self.client.options('/api/pitstop/event',headers={'Origin':'http://localhost:3000','Access-Control-Request-Method':'POST'}))
        self.assertEqual(r.headers['access-control-allow-origin'],'http://localhost:3000')
        r=(await self.client.options('/api/pitstop/event',headers={'Origin':'https://untrusted.example','Access-Control-Request-Method':'POST'}))
        self.assertNotIn('access-control-allow-origin',r.headers)

class OAuthTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.service=UiPathService(Config(client_id='test',secret='test',folder='1',organization='org',tenant='tenant'))
        await self.service.client.aclose()
    async def asyncTearDown(self): await self.service.client.aclose()
    async def test_real_http_contract_with_mock_transport(self):
        seen=[]
        def respond(req):
            seen.append(req)
            if req.url.path.endswith('/connect/token'):
                self.assertIn(b'grant_type=client_credentials',req.content)
                return httpx.Response(200,json={'access_token':'TEST_TOKEN','expires_in':3600})
            self.assertEqual(req.headers['X-UIPATH-OrganizationUnitId'],'1')
            self.assertEqual(req.headers['Authorization'],'Bearer TEST_TOKEN')
            if req.url.path.endswith('/Releases'): return httpx.Response(200,json={'value':[{'Key':'release'}]})
            if req.method=='POST':
                body=json.loads(req.content)['startInfo']
                self.assertEqual(body['Strategy'],'ModernJobsCount')
                self.assertEqual(json.loads(json.loads(body['InputArguments'])['in_EventJson']),{'stage':1})
                return httpx.Response(200,json={'value':[{'Id':42}]})
            return httpx.Response(200,json={'Id':42,'State':'Running'})
        self.service.client=httpx.AsyncClient(transport=httpx.MockTransport(respond))
        self.assertEqual(await self.service.start({'stage':1}),'42')
        self.assertEqual((await self.service.job('42'))['State'],'Running')
        self.assertEqual(sum(x.url.path.endswith('/connect/token') for x in seen),1)
    async def test_auth_failure(self):
        self.service.client=httpx.AsyncClient(transport=httpx.MockTransport(lambda req:httpx.Response(401)))
        with self.assertRaisesRegex(UiPathError,'authentication'): await self.service.authenticate()
    async def test_start_timeout_uncertain(self):
        self.service.token='token'; self.service.expires=float('inf')
        def respond(req):
            if req.method=='GET': return httpx.Response(200,json={'value':[{'Key':'release'}]})
            raise httpx.ReadTimeout('timeout')
        self.service.client=httpx.AsyncClient(transport=httpx.MockTransport(respond))
        with self.assertRaises(UiPathError) as ctx: await self.service.start({})
        self.assertTrue(ctx.exception.uncertain)

if __name__=='__main__': unittest.main()
