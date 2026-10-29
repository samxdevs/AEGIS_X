#!/usr/bin/env python3
"""
edge/live_view_and_capture.py — Live camera preview and farmer Capture (SCAN_CONTROL_API.md §1.7, §1.8).

The camera belongs to the scan subprocess (edge/scan_pipeline.py); the HTTP gateway
(gateway/server.py) runs in another process and must never open it, because
nvarguscamerasrc gives the IMX219 to one process at a time. So the two meet in
a per-scan directory, the same way scan status already travels as a file:

  <live_dir>/preview.jpg            newest preview frame (<= 640 px), replaced atomically
  <live_dir>/preview.json           {"seq", "utc", "source"} for that frame
  <live_dir>/capture_req_<n>.json   gateway -> pipeline: "check the frame you see now"
  <live_dir>/capture_res_<n>.json   pipeline -> gateway: the result (§1.8 shape)

<live_dir> lives under /dev/shm when the board has it: eight preview writes a
second would wear the SD card for nothing, and RAM is gone on reboot, which is
right for a picture that is only ever "now".

Two rules this module exists to keep:
  1. The preview never slows the classifier. CaptureThread only drops a frame
     reference into a slot; resizing and JPEG encoding happen on this module's
     own thread, at <= PREVIEW_FPS, and it skips rather than queues.
  2. A capture is classified by the same TensorRT context as walk frames,
     through a single-slot handoff the InferenceThread services between walk
     frames (CaptureSlot). The walk queues drop their oldest items under load,
     so a capture pushed through them could vanish; and a second engine
     context would not fit next to the first on a 4 GB Nano.

A capture never raises an alert and never touches the stretch counts.

Python 3.6, stdlib + numpy + cv2 (cv2 ships with JetPack 4.6).
"""

import json
import os
from pathlib import Path
import re
import threading
import time
from typing import Any, Callable, Dict, List, Optional, Tuple

import cv2
import numpy as np

# §1.7: the app polls ~8x a second; the budget is <= 10 fps on the pod's AP.
PREVIEW_FPS = 8.0
PREVIEW_MAX_SIDE = 640
PREVIEW_JPEG_QUALITY = 60
CAPTURE_JPEG_QUALITY = 90

# How long a capture may take end to end before the gateway gives up (§1.8 target: 2 s).
CAPTURE_TIMEOUT_S = 6.0
# How long the capture worker waits for the InferenceThread to classify its tiles.
CAPTURE_INFER_TIMEOUT_S = 4.0

SHM_ROOT = Path("/dev/shm/aegis")

# FrameGate rejection reason -> §1.8 quality. Anything else unexpected is NO_DATA with quality OK.
GATE_REASON_TO_QUALITY = {
    "frame_blurry": "BLURRY",
    "exposure_underexposed": "TOO_DARK",
    "exposure_overexposed": "TOO_BRIGHT",
}


def safe_scan_dirname(scan_id: str) -> str:
    """A scan id as a single path component: '2026-10-03T04:30:12Z_F01' -> '2026-10-03T04-30-12Z_F01'."""
    return re.sub(r"[^A-Za-z0-9_.-]", "-", str(scan_id))[:120] or "scan"


def live_dir_for(scan_id: str, fallback_root: Path) -> Path:
    """Where this scan's live files go: RAM when the board has /dev/shm, else under fallback_root."""
    root = SHM_ROOT if Path("/dev/shm").is_dir() else Path(fallback_root) / "live"
    return root / safe_scan_dirname(scan_id)


def capture_media_id(scan_id: str, capture_id: int) -> str:
    """The media id of a captured photo, as served by GET /api/v1/media/<id>."""
    return "cap_%s_%d" % (safe_scan_dirname(scan_id), int(capture_id))


def is_safe_media_id(media_id: str) -> bool:
    """Media ids become file names; only the shape capture_media_id() produces is accepted."""
    return bool(re.match(r"^cap_[A-Za-z0-9_.-]{1,140}$", media_id or "")) and ".." not in media_id


def _write_atomic(path: Path, data: bytes) -> None:
    """Write-then-rename, so a reader in the other process never sees half a file."""
    tmp = path.with_name(path.name + ".tmp")
    with open(str(tmp), "wb") as f:
        f.write(data)
    os.replace(str(tmp), str(path))


def _utc_now_iso() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


# ---------------------------------------------------------------------------
# In-process handoffs (pipeline side)
# ---------------------------------------------------------------------------


class LatestFrame(object):
    """
    The newest camera frame, as a reference. CaptureThread calls put() once per
    frame: an assignment under a lock, no copy, so the capture loop pays nothing
    measurable. cv2.VideoCapture.read() returns a fresh array every call, so
    holding the reference is safe.
    """

    def __init__(self):
        self._lock = threading.Lock()
        self._frame = None  # type: Optional[np.ndarray]
        self._seq = 0
        self._utc = None  # type: Optional[str]
        self._gps = None  # type: Optional[Dict[str, float]]

    def put(self, frame: np.ndarray, utc: Optional[str] = None, gps: Optional[Dict[str, float]] = None) -> None:
        with self._lock:
            self._frame = frame
            self._seq += 1
            self._utc = utc
            self._gps = gps

    def get(self) -> Tuple[Optional[np.ndarray], int, Optional[str], Optional[Dict[str, float]]]:
        with self._lock:
            return self._frame, self._seq, self._utc, self._gps


class CaptureSlot(object):
    """
    One capture's tiles, waiting for the InferenceThread, and its logits coming
    back. One at a time: the gateway already refuses a second capture with 429.
    """

    def __init__(self):
        self._lock = threading.Lock()
        self._tiles = None
        self._logits = None
        self._done = threading.Event()
        self.closed = False

    def submit(self, tiles: Any, timeout: float = CAPTURE_INFER_TIMEOUT_S) -> Optional[np.ndarray]:
        """Called by the capture worker. Returns logits, or None if inference did not happen in time."""
        with self._lock:
            if self.closed:
                return None
            self._tiles = tiles
            self._logits = None
            self._done.clear()
        if not self._done.wait(timeout):
            with self._lock:
                self._tiles = None
            return None
        with self._lock:
            return self._logits

    def take(self) -> Any:
        """Called by the InferenceThread between walk frames. Returns pending tiles or None."""
        with self._lock:
            tiles = self._tiles
            self._tiles = None
            return tiles

    def deliver(self, logits: Optional[np.ndarray]) -> None:
        with self._lock:
            self._logits = logits
        self._done.set()

    def close(self) -> None:
        """The InferenceThread is finishing: release anyone waiting."""
        with self._lock:
            self.closed = True
            self._tiles = None
            self._logits = None
        self._done.set()


# ---------------------------------------------------------------------------
# Verdicts
# ---------------------------------------------------------------------------


def capture_verdict(
    frame_state: str,
    class_name: Optional[str],
    declared_crop: Optional[str],
    healthy_classes_by_crop: Dict[str, Any],
) -> Tuple[str, Optional[str]]:
    """
    One frame's aggregate_frame() result -> §1.8 (verdict, top_class).

    The declared-crop rule (§3) applies exactly as in a walk: a class of a
    different crop is UNCERTAIN, never that crop's disease and never "healthy".
    """
    if frame_state == "NOT_CROP":
        return "NOT_CROP", None
    if not class_name:
        return "UNCERTAIN", None
    if declared_crop and not class_name.startswith(declared_crop + "__"):
        return "UNCERTAIN", None
    healthy = set(healthy_classes_by_crop.get(declared_crop, ())) if declared_crop else set()
    if frame_state == "DISEASE":
        if declared_crop and class_name in healthy:
            return "UNCERTAIN", None
        return "DISEASE", class_name
    if frame_state == "HEALTHY":
        if declared_crop and class_name not in healthy:
            return "UNCERTAIN", None
        return "HEALTHY", None
    return "UNCERTAIN", None


def quality_from_gate(passed: bool, reason: Optional[str]) -> str:
    if passed:
        return "OK"
    return GATE_REASON_TO_QUALITY.get(str(reason), "BLURRY" if reason else "OK")


def preview_jpeg(frame: np.ndarray, max_side: int = PREVIEW_MAX_SIDE, quality: int = PREVIEW_JPEG_QUALITY) -> Optional[bytes]:
    """Downscales (never up) and JPEG-encodes one frame for the live view."""
    if frame is None or frame.size == 0:
        return None
    h, w = frame.shape[:2]
    scale = float(max_side) / float(max(h, w))
    if scale < 1.0:
        frame = cv2.resize(frame, (max(1, int(w * scale)), max(1, int(h * scale))), interpolation=cv2.INTER_LINEAR)
    ok, buf = cv2.imencode(".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), int(quality)])
    return buf.tobytes() if ok else None


# ---------------------------------------------------------------------------
# The worker thread (pipeline side)
# ---------------------------------------------------------------------------


class LiveViewThread(threading.Thread):
    """
    Writes the preview at <= PREVIEW_FPS and services capture requests.

    `judge(frame)` is supplied by the pipeline and does the CPU half of a
    capture: FrameGate quality check and tiling. It returns
    (passed, reason, tiles). `decide(logits)` turns the InferenceThread's
    logits into (frame_state, class_name, score), with the same thresholds the
    walk uses. Keeping both in the pipeline means a capture cannot drift from
    how walk frames are judged.
    """

    def __init__(
        self,
        live_dir: Path,
        media_dir: Path,
        scan_id: str,
        crop: Optional[str],
        source_kind: str,
        latest: LatestFrame,
        slot: CaptureSlot,
        judge: Callable[[np.ndarray], Tuple[bool, Optional[str], Any]],
        decide: Callable[[np.ndarray], Tuple[str, Optional[str], float]],
        reliability: Callable[[str], str],
        healthy_classes_by_crop: Dict[str, Any],
        fps: float = PREVIEW_FPS,
    ):
        super(LiveViewThread, self).__init__(name="LiveViewThread", daemon=True)
        self.live_dir = Path(live_dir)
        self.media_dir = Path(media_dir)
        self.scan_id = scan_id
        self.crop = crop
        self.source_kind = source_kind  # "camera" | "replay"
        self.latest = latest
        self.slot = slot
        self.judge = judge
        self.decide = decide
        self.reliability = reliability
        self.healthy_classes_by_crop = healthy_classes_by_crop
        self.interval_s = 1.0 / float(fps)
        self.stop_event = threading.Event()
        self._captures_lock = threading.Lock()
        self._captures = []  # type: List[Dict[str, Any]]
        self.preview_seq = 0
        self.preview_errors = 0
        self.t_encode_s = 0.0

    def captures(self) -> List[Dict[str, Any]]:
        with self._captures_lock:
            return list(self._captures)

    def run(self) -> None:
        try:
            self.live_dir.mkdir(parents=True, exist_ok=True)
        except Exception as e:
            print("[LiveViewThread] cannot create %s: %s; live view disabled" % (self.live_dir, e))
            return
        last_seq = -1
        while not self.stop_event.is_set():
            t0 = time.time()
            frame, seq, utc, _gps = self.latest.get()
            if frame is not None and seq != last_seq:
                last_seq = seq
                try:
                    self._write_preview(frame, utc)
                except Exception as e:
                    self.preview_errors += 1
                    if self.preview_errors <= 3:
                        print("[LiveViewThread] preview write failed: %s" % e)
            self._service_captures()
            self.stop_event.wait(max(0.0, self.interval_s - (time.time() - t0)))
        self._service_captures(refuse=True)

    def _write_preview(self, frame: np.ndarray, utc: Optional[str]) -> None:
        t0 = time.time()
        jpeg = preview_jpeg(frame)
        self.t_encode_s += time.time() - t0
        if jpeg is None:
            return
        self.preview_seq += 1
        _write_atomic(self.live_dir / "preview.jpg", jpeg)
        meta = {"seq": self.preview_seq, "utc": _utc_iso_from(utc), "source": self.source_kind}
        _write_atomic(self.live_dir / "preview.json", json.dumps(meta).encode("utf-8"))

    def _service_captures(self, refuse: bool = False) -> None:
        for req_path in sorted(self.live_dir.glob("capture_req_*.json")):
            try:
                req = json.loads(req_path.read_text(encoding="utf-8"))
                capture_id = int(req["capture_id"])
            except Exception:
                _remove_quietly(req_path)
                continue
            if refuse:
                result = {"error": "not_scanning"}
            else:
                try:
                    result = self.take_capture(capture_id)
                except Exception as e:
                    print("[LiveViewThread] capture %d failed: %s" % (capture_id, e))
                    result = {"error": "camera_unavailable", "detail": str(e)[:200]}
            _write_atomic(self.live_dir / ("capture_res_%d.json" % capture_id), json.dumps(result).encode("utf-8"))
            _remove_quietly(req_path)

    def take_capture(self, capture_id: int) -> Dict[str, Any]:
        """One full-resolution frame: saved, quality-checked, classified. Returns the §1.8 body."""
        frame, _seq, utc, gps = self.latest.get()
        if frame is None:
            return {"error": "camera_unavailable", "detail": "no frame from the camera yet"}
        frame = frame.copy()  # the walk keeps reading into new arrays; this one is ours now
        utc_iso = _utc_iso_from(utc)
        media_id = capture_media_id(self.scan_id, capture_id)
        self.media_dir.mkdir(parents=True, exist_ok=True)
        ok, buf = cv2.imencode(".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), CAPTURE_JPEG_QUALITY])
        if not ok:
            return {"error": "camera_unavailable", "detail": "could not encode the frame"}
        _write_atomic(self.media_dir / (media_id + ".jpg"), buf.tobytes())

        passed, reason, tiles = self.judge(frame)
        quality = quality_from_gate(passed, reason)
        verdict, top_class, confidence = "NO_DATA", None, None
        if passed:
            logits = self.slot.submit(tiles)
            if logits is None:
                return {"error": "camera_unavailable", "detail": "the classifier did not answer in time"}
            state, class_name, score = self.decide(logits)
            verdict, top_class = capture_verdict(state, class_name, self.crop, self.healthy_classes_by_crop)
            confidence = round(float(score), 4) if verdict != "NO_DATA" else None

        result = {
            "capture_id": int(capture_id),
            "utc": utc_iso,
            "media_id": media_id,
            "image_path": "/api/v1/media/%s" % media_id,
            "quality": quality,
            "verdict": verdict,
            "top_class": top_class,
            "confidence": confidence,
            "cross_source_reliability": self.reliability(top_class) if top_class else None,
            # Pod GPS when the frame carried a fix; the gateway fills in the
            # phone's fix (§1.4 rule) when it did not.
            "lat": gps.get("latitude") if gps else None,
            "lon": gps.get("longitude") if gps else None,
            "pos_accuracy_m": None,
            "pos_source": "pod_gps" if gps else None,
        }
        with self._captures_lock:
            self._captures.append(result)
        return result


def _utc_iso_from(ts: Optional[str]) -> str:
    """CaptureThread stamps isoformat with microseconds and +00:00; §1.7/§1.8 use whole-second Z."""
    if not ts:
        return _utc_now_iso()
    s = str(ts)
    m = re.match(r"^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})", s)
    return (m.group(1) + "Z") if m else _utc_now_iso()


def _remove_quietly(path: Path) -> None:
    try:
        os.remove(str(path))
    except OSError:
        pass


# ---------------------------------------------------------------------------
# Gateway side
# ---------------------------------------------------------------------------


def read_preview(live_dir: Path) -> Optional[Tuple[bytes, Dict[str, Any]]]:
    """The newest preview and its metadata, or None before the first frame."""
    live_dir = Path(live_dir)
    try:
        meta = json.loads((live_dir / "preview.json").read_text(encoding="utf-8"))
        with open(str(live_dir / "preview.jpg"), "rb") as f:
            jpeg = f.read()
    except (OSError, ValueError):
        return None
    if not jpeg:
        return None
    return jpeg, meta


def request_capture(live_dir: Path, capture_id: int, timeout_s: float = CAPTURE_TIMEOUT_S) -> Optional[Dict[str, Any]]:
    """Asks the scan subprocess for one capture and waits for its answer. None on timeout."""
    live_dir = Path(live_dir)
    live_dir.mkdir(parents=True, exist_ok=True)
    res_path = live_dir / ("capture_res_%d.json" % int(capture_id))
    _remove_quietly(res_path)
    _write_atomic(live_dir / ("capture_req_%d.json" % int(capture_id)), json.dumps({"capture_id": int(capture_id)}).encode("utf-8"))
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        if res_path.exists():
            try:
                result = json.loads(res_path.read_text(encoding="utf-8"))
            except ValueError:
                time.sleep(0.05)
                continue
            _remove_quietly(res_path)
            return result
        time.sleep(0.05)
    _remove_quietly(live_dir / ("capture_req_%d.json" % int(capture_id)))
    return None
