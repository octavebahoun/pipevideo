import os
import re
import sys
import numpy as np
import scipy.io.wavfile as wavfile
import scipy.signal as signal
import subprocess

SOUNDS_DIR = os.path.join(os.cwd() if hasattr(os, 'cwd') else os.getcwd(), 'public', 'sounds')
IGNORED_FILES = {'README.md', '_TEMPLATE.md', 'CATALOG.md'}

def convert_to_wav(mp3_path, wav_path):
    cmd = [
        'ffmpeg', '-y', '-i', mp3_path,
        '-ac', '1', '-ar', '22050',
        '-vn', wav_path
    ]
    subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)

def analyze_audio(wav_path, sound_type):
    sample_rate, data = wavfile.read(wav_path)
    if len(data.shape) > 1:
        data = data.mean(axis=1)
    
    data = data.astype(float)
    max_val = np.max(np.abs(data))
    if max_val > 0:
        data = data / max_val
        
    duration = len(data) / sample_rate
    
    # 1. Peak detection
    hop_length = 512
    n_frames = len(data) // hop_length
    envelope = []
    for i in range(n_frames):
        window = data[i*hop_length : (i+1)*hop_length]
        envelope.append(np.sqrt(np.mean(window**2)))
    envelope = np.array(envelope)
    
    b, a = signal.butter(2, 0.1)
    smoothed_envelope = signal.filtfilt(b, a, envelope) if len(envelope) > 15 else envelope
    
    # Find peaks
    peaks, _ = signal.find_peaks(
        smoothed_envelope,
        height=0.08,
        distance=int(0.25 * (sample_rate / hop_length)), # min 250ms apart
        prominence=0.04
    )
    
    # Sort peaks by amplitude prominence
    peak_amps = [smoothed_envelope[p] for p in peaks]
    sorted_peaks = [p for _, p in sorted(zip(peak_amps, peaks), reverse=True)]
    # Keep top 5 peaks in chronological order
    top_peaks = sorted(sorted_peaks[:5])
    peak_times = [round(float(p * hop_length / sample_rate), 2) for p in top_peaks]
    
    # 2. BPM Estimation
    diff = np.diff(smoothed_envelope)
    onset_env = np.maximum(0, diff)
    bpm = None
    
    if len(onset_env) > 20 and sound_type == 'music':
        env_sr = sample_rate / hop_length
        min_lag = int(60.0 * env_sr / 180.0) # 180 BPM
        max_lag = int(60.0 * env_sr / 60.0)  # 60 BPM
        
        autocorr = np.correlate(onset_env, onset_env, mode='full')
        mid = len(onset_env) - 1
        search_region = autocorr[mid + min_lag : mid + max_lag]
        
        if len(search_region) > 0:
            best_lag = np.argmax(search_region) + min_lag
            calculated_bpm = round(float(60.0 * env_sr / best_lag))
            if 50 <= calculated_bpm <= 200:
                bpm = calculated_bpm

    # 3. Key Detection
    best_key = None
    if len(data) > 2048 and sound_type in ['music', 'ambient']:
        frequencies, times, Sxx = signal.spectrogram(data, fs=sample_rate, nperseg=2048, noverlap=1024)
        magnitudes = np.sum(np.abs(Sxx), axis=1)
        
        chroma = np.zeros(12)
        for idx, freq in enumerate(frequencies):
            if 30.0 < freq < 2500.0:
                note = 12 * np.log2(freq / 440.0) + 69
                pitch_class = int(round(note)) % 12
                chroma[pitch_class] += magnitudes[idx]
                
        chroma_sum = np.sum(chroma)
        if chroma_sum > 0:
            chroma = chroma / chroma_sum
            
            major_profile = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
            minor_profile = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])
            major_profile /= np.sum(major_profile)
            minor_profile /= np.sum(minor_profile)
            
            pitch_names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
            best_corr = -1
            
            for shift in range(12):
                shifted_chroma = np.roll(chroma, -shift)
                corr_maj = np.corrcoef(shifted_chroma, major_profile)[0, 1]
                corr_min = np.corrcoef(shifted_chroma, minor_profile)[0, 1]
                
                if corr_maj > best_corr:
                    best_corr = corr_maj
                    best_key = f"{pitch_names[shift]} Maj"
                if corr_min > best_corr:
                    best_corr = corr_min
                    best_key = f"{pitch_names[shift]} Min"

    return peak_times, bpm, best_key

def process_md_file(md_path):
    with open(md_path, 'r', encoding='utf-8') as f:
        content = f.read()
        
    fm_match = re.search(r'^---\s*\n([\s\S]*?)\n---', content)
    if not fm_match:
        return
        
    fm_text = fm_match.group(1)
    
    # Extract sound type & file
    sound_type = 'sfx'
    type_m = re.search(r'type:\s*(\w+)', fm_text)
    if type_m:
        sound_type = type_m.group(1).strip()
        
    audio_filename = None
    file_m = re.search(r'file:\s*([^\n]+)', fm_text)
    if file_m:
        audio_filename = file_m.group(1).strip()
    else:
        audio_filename = os.path.basename(md_path).replace('.md', '.mp3')
        
    audio_path = os.path.join(os.path.dirname(md_path), audio_filename)
    if not os.path.exists(audio_path):
        print(f"⚠️ Audio file not found: {audio_path}")
        return
        
    print(f"🎵 Analyzing: {audio_filename} ({sound_type})...")
    wav_path = os.path.join(os.path.dirname(md_path), 'temp_analyze.wav')
    
    try:
        convert_to_wav(audio_path, wav_path)
        peaks, bpm, key = analyze_audio(wav_path, sound_type)
        print(f"   Peaks: {peaks} | BPM: {bpm} | Key: {key}")
        
        # Update FM text
        # Remove old bpm, key, peaks lines if exist
        lines = fm_text.split('\n')
        new_lines = []
        for l in lines:
            if l.startswith('bpm:') or l.startswith('key:') or l.startswith('peaks:'):
                continue
            new_lines.append(l)
            
        bpm_str = str(bpm) if bpm is not None else 'null'
        key_str = f'"{key}"' if key is not None else 'null'
        peaks_str = f"[{', '.join(str(p) for p in peaks)}]"
        
        new_lines.append(f"bpm: {bpm_str}")
        new_lines.append(f"key: {key_str}")
        new_lines.append(f"peaks: {peaks_str}")
        
        new_fm = '\n'.join(new_lines)
        new_content = content.replace(fm_match.group(1), new_fm)
        
        with open(md_path, 'w', encoding='utf-8') as f:
            f.write(new_content)
            
    finally:
        if os.path.exists(wav_path):
            os.remove(wav_path)

def main():
    for root, dirs, files in os.walk(SOUNDS_DIR):
        for file in files:
            if file.endswith('.md') and file not in IGNORED_FILES:
                md_path = os.path.join(root, file)
                process_md_file(md_path)

if __name__ == '__main__':
    main()
