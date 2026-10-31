import json
import time
import httpx

class UiPathError(Exception):
    def __init__(self, message, uncertain=False):
        super().__init__(message)
        self.uncertain = uncertain

class UiPathService:
    def __init__(self, config):
        self.config = config
        self.client = httpx.AsyncClient(timeout=config.timeout)
        self.token = None
        self.expires = 0

    async def authenticate(self):
        if self.config.missing:
            raise UiPathError('Missing configuration: ' + ', '.join(self.config.missing))
        if self.token and time.monotonic() < self.expires:
            return
        try:
            r = await self.client.post(self.config.token_url or self.config.base + '/identity_/connect/token', data={
                'grant_type': 'client_credentials', 'client_id': self.config.client_id,
                'client_secret': self.config.secret, 'scope': self.config.scopes})
            r.raise_for_status()
            data = r.json()
            self.token = data['access_token']
            self.expires = time.monotonic() + max(0, int(data.get('expires_in', 300)) - 30)
        except (httpx.HTTPError, ValueError, KeyError) as exc:
            raise UiPathError('UiPath authentication failed; check credentials, scopes and token URL') from exc

    async def request(self, method, path, **kwargs):
        await self.authenticate()
        try:
            r = await self.client.request(method, self.config.url + path, headers={
                'Authorization': 'Bearer ' + self.token,
                'X-UIPATH-OrganizationUnitId': self.config.folder}, **kwargs)
            if r.status_code == 401:
                self.token = None
            r.raise_for_status()
            return r.json()
        except httpx.HTTPStatusError as exc:
            raise UiPathError(f'Orchestrator HTTP {exc.response.status_code}',
                              method == 'POST' and exc.response.status_code >= 500) from exc
        except (httpx.HTTPError, ValueError) as exc:
            raise UiPathError('Orchestrator unavailable or invalid response', method == 'POST') from exc

    async def release(self):
        name = self.config.process.replace("'", "''")
        data = await self.request('GET', '/odata/Releases', params={'$filter': f"Name eq '{name}'"})
        rows = data.get('value', [])
        if len(rows) != 1:
            raise UiPathError('Published process missing or ambiguous in configured folder')
        return rows[0]['Key']

    async def status(self):
        await self.release()
        robots = await self.request('GET', '/odata/Sessions', params={'$top': 100})
        available = any(x.get('State') in ('Available', 'Busy') for x in robots.get('value', []))
        return {'connected': True, 'bot_online': available,
                'detail': 'Robot session reported by Orchestrator' if available else 'No available/busy robot session reported'}

    async def start(self, event):
        key = await self.release()
        data = await self.request('POST', '/odata/Jobs/UiPath.Server.Configuration.OData.StartJobs', json={
            'startInfo': {'ReleaseKey': key, 'Strategy': 'ModernJobsCount', 'JobsCount': 1,
                          'RuntimeType': 'Unattended', 'InputArguments': json.dumps({'in_EventJson': json.dumps(event)})}})
        rows = data.get('value', [])
        if not rows or not rows[0].get('Id'):
            raise UiPathError('Job submission response lacked an actual job ID', True)
        return str(rows[0]['Id'])

    async def job(self, job_id):
        return await self.request('GET', f'/odata/Jobs({int(job_id)})')
