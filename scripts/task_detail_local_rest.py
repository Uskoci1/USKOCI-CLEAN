"""Bounded outage of the exact disposable proof PostgREST container only."""
from contextlib import contextmanager
import json
import os
from pathlib import Path
import re
import subprocess
import time
import tomllib
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen

PROOF_DIR = '/tmp/uskoci-ru5-device-ui'
PROJECT_ID = 'uskoci-ru5-device-ui'
REST_NAME = f'supabase_rest_{PROJECT_ID}'
DOCKER_SOCKET = 'unix:///var/run/docker.sock'


def validate_local_targets(env):
    try:
        api, db = urlparse(env.get('RU5_DEVICE_SUPABASE_URL', '')), urlparse(env.get('RU5_DEVICE_DB_URL', ''))
        api_ok = (api.scheme == 'http' and api.hostname == '127.0.0.1' and api.port == 54321
                  and api.path in ('', '/') and not api.username and not api.password and not api.query and not api.fragment)
        db_ok = (db.scheme == 'postgresql' and db.hostname == '127.0.0.1' and db.port == 54322
                 and db.path == '/postgres' and db.username == 'postgres' and not db.query and not db.fragment)
    except ValueError:
        api_ok = db_ok = False
    if not api_ok or not db_ok:
        raise RuntimeError('Task-detail proof requires exact disposable loopback targets')
    if env.get('RU5_DEVICE_PACKAGE') != 'rs.uskoci.n04proof' or env.get('RU5_DEVICE_PROOF_DIR') != PROOF_DIR:
        raise RuntimeError('Task-detail proof package/directory mismatch')
    if env.get('DOCKER_HOST', '') not in ('', DOCKER_SOCKET) or env.get('DOCKER_CONTEXT', '') not in ('', 'default'):
        raise RuntimeError('Task-detail outage requires the local default Docker daemon')


def validate_container(fields, *, expected_running, expected_id=None):
    if len(fields) != 4:
        raise RuntimeError('Incomplete disposable PostgREST identity')
    container_id, name, image, running = fields
    if (not isinstance(container_id, str) or not re.fullmatch(r'[a-f0-9]{64}', container_id)
        or name != f'/{REST_NAME}' or not isinstance(image, str)
        or not re.fullmatch(r'(?:public\.ecr\.aws/supabase|(?:docker\.io/)?supabase)/postgrest:[\w.-]+', image)
        or running is not expected_running or (expected_id is not None and container_id != expected_id)):
        raise RuntimeError('Disposable PostgREST identity/state mismatch')
    return container_id


class LocalRestOutage:
    def __init__(self, env=None):
        self.env = dict(os.environ if env is None else env)
        validate_local_targets(self.env)
        proof_dir = Path(self.env['RU5_DEVICE_PROOF_DIR'])
        if proof_dir.resolve() != Path(PROOF_DIR) or not proof_dir.is_dir():
            raise RuntimeError('Disposable proof directory must exist without redirection')
        config = tomllib.loads((proof_dir / 'supabase/config.toml').read_text(encoding='utf-8'))
        if config.get('project_id') != PROJECT_ID:
            raise RuntimeError('Disposable Supabase project id mismatch')
        self.container_id = validate_container(self.inspect(REST_NAME), expected_running=True)
        self.wait_http(available=True)

    def docker(self, *args):
        # Explicit local socket also closes a Docker context change between checks.
        try:
            result = subprocess.run(['docker', '--host', DOCKER_SOCKET, *args], check=True,
                                    capture_output=True, text=True, timeout=30, env=self.env)
        except (subprocess.SubprocessError, OSError):
            raise RuntimeError('Local disposable Docker operation failed') from None
        return result.stdout.strip()

    def inspect(self, target):
        # Never read/log Config.Env, which contains local database credentials.
        template = '{{json .Id}}\n{{json .Name}}\n{{json .Config.Image}}\n{{json .State.Running}}'
        return [json.loads(line) for line in self.docker('container', 'inspect', '--format', template, target).splitlines()]

    def http_status(self):
        request = Request(self.env['RU5_DEVICE_SUPABASE_URL'].rstrip('/') + '/rest/v1/needs?select=id&limit=0',
                          headers={'apikey': self.env['RU5_DEVICE_ANON_KEY']})
        try:
            with urlopen(request, timeout=4) as response:
                return response.status
        except HTTPError as error:
            return error.code
        except (URLError, TimeoutError):
            return 0

    def wait_http(self, *, available):
        deadline = time.monotonic() + 25
        while time.monotonic() < deadline:
            status = self.http_status()
            if (available and status == 200) or (not available and (status == 0 or status >= 500)):
                return
            time.sleep(0.5)
        raise RuntimeError('Disposable REST did not reach the expected availability state')

    @contextmanager
    def stopped(self):
        validate_container(self.inspect(self.container_id), expected_running=True, expected_id=self.container_id)
        try:
            self.docker('container', 'stop', '--timeout', '5', self.container_id)
            validate_container(self.inspect(self.container_id), expected_running=False, expected_id=self.container_id)
            self.wait_http(available=False)
            print(f'CHECKPOINT W04_LOCAL_REST_STOPPED id={self.container_id}', flush=True)
            yield
        finally:
            # Restart this same immutable container even when a UI assertion fails.
            self.docker('container', 'start', self.container_id)
            validate_container(self.inspect(self.container_id), expected_running=True, expected_id=self.container_id)
            self.wait_http(available=True)
            print(f'CHECKPOINT W04_LOCAL_REST_RESTORED id={self.container_id}', flush=True)
