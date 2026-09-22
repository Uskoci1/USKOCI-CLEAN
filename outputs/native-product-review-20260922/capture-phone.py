"""Capture the explicitly connected development phone. Does not change app data."""
import os
import pathlib
import subprocess
import argparse
parser = argparse.ArgumentParser()
parser.add_argument('serial')
parser.add_argument('name', help='Capture name without extension')
args = parser.parse_args()
if not args.name.replace('-', '').replace('_', '').isalnum():
    parser.error('Use letters, numbers, dash or underscore for name')
adb = pathlib.Path(os.environ["LOCALAPPDATA"]) / "Android/Sdk/platform-tools/adb.exe"
output = pathlib.Path(__file__).parent / "screenshots"
output.mkdir(exist_ok=True)
result = subprocess.run([str(adb), "-s", args.serial, "exec-out", "screencap", "-p"], check=True, capture_output=True)
target = output / (args.name + '.png')
target.write_bytes(result.stdout)
print(target)
