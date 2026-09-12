"""Original procedural effects; no external recordings. Run with --ffmpeg PATH."""
import argparse
import math
import random
import struct
import subprocess
import wave
from pathlib import Path

RATE = 44100
ROOT = Path(__file__).resolve().parent
random.seed(42)

def tone(samples, start, duration, frequency, volume=0.3, end_frequency=None):
    phase = 0.0
    count = int(duration * RATE)
    for j in range(count):
        index = int(start * RATE) + j
        if index >= len(samples):
            break
        t = j / RATE
        progress = j / count
        freq = frequency if end_frequency is None else frequency + (end_frequency-frequency)*progress
        phase += 2 * math.pi * freq / RATE
        envelope = min(1, t / 0.008) * (1-progress)**2
        value = math.sin(phase) + 0.18 * math.sin(phase*2) + 0.06 * math.sin(phase*3)
        samples[index] += value * envelope * volume

def create(name, duration, notes):
    samples = [0.0] * int(RATE * duration)
    for note in notes:
        tone(samples, *note)
    if name == 'flip':
        for j in range(int(0.065 * RATE)):
            samples[j] += random.uniform(-1, 1) * 0.055 * (1-j/(0.065*RATE))**3 * min(1,j/150)
    peak = max(map(abs, samples))
    gain = min(1, 0.65 / peak)
    pcm = b''.join(struct.pack('<h', round(max(-1,min(1,s*gain))*32767)) for s in samples)
    path = ROOT / 'source' / f'{name}.wav'
    if path.exists() or (ROOT / f'{name}.mp3').exists():
        raise FileExistsError(f'Refusing to overwrite {name}')
    with wave.open(str(path), 'wb') as out:
        out.setnchannels(1)
        out.setsampwidth(2)
        out.setframerate(RATE)
        out.writeframes(pcm)
    return path

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--ffmpeg', required=True)
    args = parser.parse_args()
    (ROOT / 'source').mkdir(exist_ok=True)
    effects = {
        'flip': (0.16, [(0,0.12,700,0.25,1200)]),
        'match': (0.44, [(0,0.24,659.25,0.31),(0.12,0.28,987.77,0.30)]),
        'mismatch': (0.34, [(0,0.18,392,0.25),(0.12,0.18,329.63,0.23)]),
        'success': (1.12, [(0,0.30,523.25,0.28),(0.16,0.30,659.25,0.28),(0.32,0.30,783.99,0.28),(0.49,0.57,1046.5,0.27),(0.49,0.57,659.25,0.12),(0.49,0.57,783.99,0.12)]),
        'fail': (0.84, [(0,0.30,440,0.23),(0.20,0.30,349.23,0.23),(0.41,0.37,261.63,0.23)]),
    }
    for name, (duration, notes) in effects.items():
        source = create(name, duration, notes)
        target = ROOT / f'{name}.mp3'
        subprocess.run([args.ffmpeg,'-v','error','-n','-i',str(source),'-codec:a','libmp3lame','-b:a','128k',str(target)],check=True)
        subprocess.run([args.ffmpeg,'-v','error','-i',str(target),'-f','null','-'],check=True)
        print(f'{name}: {duration:.2f}s, {target.stat().st_size} bytes; decode OK')

if __name__ == '__main__':
    main()
