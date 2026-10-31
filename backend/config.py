import os
from dataclasses import dataclass
from pathlib import Path
from dotenv import load_dotenv
load_dotenv(Path(__file__).with_name('.env'))

@dataclass
class Config:
    base: str = os.getenv('UIPATH_BASE_URL', 'https://cloud.uipath.com').rstrip('/')
    organization: str = os.getenv('UIPATH_ORGANIZATION', '')
    tenant: str = os.getenv('UIPATH_TENANT', '')
    client_id: str = os.getenv('UIPATH_CLIENT_ID', '')
    secret: str = os.getenv('UIPATH_CLIENT_SECRET', '')
    process: str = os.getenv('UIPATH_PROCESS_NAME', 'PitStopAutomation')
    folder: str = os.getenv('UIPATH_FOLDER_ID', '')
    scopes: str = os.getenv('UIPATH_SCOPES', 'OR.Jobs OR.Execution OR.Robots')
    token_url: str = os.getenv('UIPATH_TOKEN_URL', '')
    orchestrator_url: str = os.getenv('UIPATH_ORCHESTRATOR_URL', '')
    timeout: float = float(os.getenv('UIPATH_TIMEOUT', '15'))
    database: str = os.getenv('DATABASE_PATH', 'backend/pitstop.sqlite3')
    origins: str = os.getenv('CORS_ORIGINS', 'http://localhost:3000,http://127.0.0.1:3000')

    @property
    def url(self):
        return self.orchestrator_url.rstrip('/') or f'{self.base}/{self.organization}/{self.tenant}/orchestrator_'

    @property
    def missing(self):
        fields = {'UIPATH_CLIENT_ID': self.client_id, 'UIPATH_CLIENT_SECRET': self.secret,
                  'UIPATH_FOLDER_ID': self.folder, 'UIPATH_PROCESS_NAME': self.process}
        if not self.orchestrator_url:
            fields.update(UIPATH_ORGANIZATION=self.organization, UIPATH_TENANT=self.tenant)
        return [key for key, value in fields.items() if not value]
