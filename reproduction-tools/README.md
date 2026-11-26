# Submission artifact reproduction

These are the scripts used to create the two-page Build Record and the narrated prototype walkthrough on November 25, 2026. They have been adapted to repository-relative inputs and a separate output directory. They do not modify the frozen submission or call any cloud service.

## Included files

- `build_record.py`: generates the two-page PDF and renders both pages to PNG for inspection.
- `make_demo.py`: generates a narrated, captioned video from five authentic prototype screenshots, using local macOS speech synthesis and FFmpeg.
- `assets/`: exact screenshots used in the video, including the fictional family/provider example. These are actual screenshots, not invented interaction frames.
- `assets-sha256.txt`: checksums of the five included image inputs.
- `requirements-pdf.txt`: Python library versions used for the original PDF.

Both scripts default to `reproduction-tools/generated/`, which is ignored by Git. Run the commands below from the repository root. The Python scripts locate their inputs relative to themselves, so they also work when invoked from another directory.

## Rebuild the PDF

Use Python 3.11 or later and the listed libraries. Installing into a virtual environment is recommended.

```sh
python3 -m venv reproduction-tools/.venv
reproduction-tools/.venv/bin/python -m pip install -r reproduction-tools/requirements-pdf.txt
reproduction-tools/.venv/bin/python reproduction-tools/build_record.py
```

Outputs: `generated/Build-record.pdf`, `generated/build-record-page-1.png` and `generated/build-record-page-2.png`. The script verifies that the result has exactly two pages. Inspect the PNGs after a content or dependency change.

The PDF is a historical build record: its date, claims and test results are retained from the submission. Rebuilding it does not rerun application tests or independently refresh those claims. The app test suites remain with the application source.

## Rebuild the narrated video

Requirements:

- macOS with the system `say` command and installed English `Samantha` voice;
- Python 3.11 or later (standard library only for this script);
- `ffmpeg` and `ffprobe` on `PATH`, built with H.264, AAC, drawtext and libass subtitle support. Original version: FFmpeg 7.1.1;
- Arial at `/System/Library/Fonts/Supplemental/Arial.ttf`, or a supplied alternative font path.

FFmpeg can be installed with Homebrew:

```sh
brew install ffmpeg
python3 reproduction-tools/make_demo.py
```

Outputs: `generated/Childcare-prototype-walkthrough.mp4` and `generated/Voiceover-transcript.txt`. The original output was 2 minutes 26 seconds, H.264/AAC, 1280 by 720, approximately 4.65 MiB. Timing and voice rendering can vary with the installed operating-system voice or FFmpeg version.

The script prints the temporary directory containing audio, individual clips, subtitles and sample inspection frames. That directory is outside the repository and may be removed after verification. The finished video remains in `generated/`.

Optional overrides:

```sh
python3 reproduction-tools/make_demo.py --voice Samantha --rate 160 --output-dir /tmp/childcare-video-output
python3 reproduction-tools/make_demo.py --font /absolute/path/to/Arial.ttf
```

This is a narrated screenshot walkthrough, not a screen recording. It does not simulate clicks. Its script distinguishes implemented local behavior from the planned Ministry-to-provider integration, and identifies the runtime AI helpers as demonstrations. Voiceover uses local synthetic speech. The screenshots contain public-source research and fictional demonstration data. No credentials, private runtime configuration or database files are needed.

## Provenance and verification

The source scripts were originally created as temporary local build utilities. These preserved copies change only dependency/path configuration and output placement; narration and document content remain the submitted versions. Five source images are bundled so no original user-specific workspace path is needed.

For this repository handoff, both adapted scripts were syntax-checked with Python's AST parser and all source assets were copied and hashed. Neither artifact was regenerated during the handoff. The original PDF had both pages rendered and visually inspected. The original MP4 had its video/audio streams, duration and sample frames checked, and a complete FFmpeg decode finished without errors.
