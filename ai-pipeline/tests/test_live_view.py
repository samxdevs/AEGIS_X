#!/usr/bin/env python3
"""
tests/test_live_view.py — Live camera preview and farmer Capture (docs/SCAN_CONTROL_API.md §1.7, §1.8).

Three layers:
  1. edge/live_view_and_capture.py on its own: the verdict rules, the slot, the file handoff.
  2. The gateway over HTTP, with tests/fixtures/fake_pipeline.py running the
     real LiveViewThread on synthetic frames.
  3. The real EdgePipeline (mock backend, the repo's test video), proving the
     InferenceThread services a capture between walk frames and that the
     capture lands in the advisory without touching stretches or alerts.
"""

import json
from pathlib import Path
import sys
import tempfile
import threading
import time
from typing import Any, Dict, Tuple
import urllib.error
import urllib.request

import numpy as np
import pytest

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from edge.live_view_and_capture import (
    CaptureSlot,
    LatestFrame,
    capture_media_id,
    capture_verdict,
    is_safe_media_id,
    preview_jpeg,
    quality_from_gate,
    read_preview,
    request_capture,
    safe_scan_dirname,
)
from edge.scan_database import HEALTHY_CLASSES_BY_CROP, place_capture
from gateway.server import EdgeGateway


# =============================================================================
# 1. edge/live_view_and_capture.py
# =============================================================================

def _a_disease(crop):
    from configs.disease_classes_model_a import CLASS_NAMES
    return [c for c in CLASS_NAMES if c.startswith(crop + "__") and c not in HEALTHY_CLASSES_BY_CROP.get(crop, set())][0]


def _a_healthy(crop):
    return sorted(HEALTHY_CLASSES_BY_CROP[crop])[0]


def test_capture_verdict_declared_crop_disease_is_disease():
    d = _a_disease("wheat")
    assert capture_verdict("DISEASE", d, "wheat", HEALTHY_CLASSES_BY_CROP) == ("DISEASE", d)


def test_capture_verdict_other_crop_is_never_that_crops_disease():
    # §3: a tile whose top class belongs to a different crop is "unclear".
    assert capture_verdict("DISEASE", _a_disease("rice"), "wheat", HEALTHY_CLASSES_BY_CROP) == ("UNCERTAIN", None)
    assert capture_verdict("HEALTHY", _a_healthy("rice"), "wheat", HEALTHY_CLASSES_BY_CROP) == ("UNCERTAIN", None)


def test_capture_verdict_healthy_and_not_crop():
    assert capture_verdict("HEALTHY", _a_healthy("wheat"), "wheat", HEALTHY_CLASSES_BY_CROP) == ("HEALTHY", None)
    assert capture_verdict("NOT_CROP", "not_crop", "wheat", HEALTHY_CLASSES_BY_CROP) == ("NOT_CROP", None)
    assert capture_verdict("UNCERTAIN", None, "wheat", HEALTHY_CLASSES_BY_CROP) == ("UNCERTAIN", None)


def test_quality_from_gate_names_why():
    assert quality_from_gate(True, None) == "OK"
    assert quality_from_gate(False, "frame_blurry") == "BLURRY"
    assert quality_from_gate(False, "exposure_underexposed") == "TOO_DARK"
    assert quality_from_gate(False, "exposure_overexposed") == "TOO_BRIGHT"


def test_preview_is_downscaled_never_upscaled():
    import cv2
    big = preview_jpeg(np.full((1080, 1920, 3), 120, dtype=np.uint8))
    img = cv2.imdecode(np.frombuffer(big, dtype=np.uint8), cv2.IMREAD_COLOR)
    assert max(img.shape[:2]) == 640
    small = preview_jpeg(np.full((100, 200, 3), 120, dtype=np.uint8))
    img = cv2.imdecode(np.frombuffer(small, dtype=np.uint8), cv2.IMREAD_COLOR)
    assert img.shape[:2] == (100, 200)


def test_media_ids_are_safe_file_names():
    mid = capture_media_id("2026-10-03T04:30:12Z_F01", 2)
    assert mid == "cap_2026-10-03T04-30-12Z_F01_2"
    assert is_safe_media_id(mid)
    assert not is_safe_media_id("cap_../../etc/passwd")
    assert not is_safe_media_id("../cap_x")
    assert not is_safe_media_id("advisory_1")
    assert "/" not in safe_scan_dirname("a/b:c")


def test_capture_slot_round_trip_and_close():
    slot = CaptureSlot()
    out = {}

    def worker():
        out["logits"] = slot.submit("tiles", timeout=2.0)

    t = threading.Thread(target=worker)
    t.start()
    for _ in range(100):
        tiles = slot.take()
        if tiles is not None:
            assert tiles == "tiles"
            slot.deliver(np.ones((9, 3)))
            break
        time.sleep(0.01)
    t.join(2.0)
    assert out["logits"].shape == (9, 3)

    slot.close()
    assert slot.submit("tiles", timeout=0.1) is None


def test_capture_slot_times_out_when_nobody_infers():
    assert CaptureSlot().submit("tiles", timeout=0.1) is None


def test_latest_frame_counts_frames_without_copying():
    lf = LatestFrame()
    f = np.zeros((4, 4, 3), dtype=np.uint8)
    lf.put(f, "2026-10-03T04:30:12.123456+00:00", None)
    frame, seq, utc, gps = lf.get()
    assert frame is f and seq == 1


def test_request_capture_times_out_cleanly():
    with tempfile.TemporaryDirectory() as d:
        assert request_capture(Path(d), 1, timeout_s=0.2) is None
        assert list(Path(d).glob("capture_req_*")) == []


def test_place_capture_uses_phone_fix_within_three_seconds_only():
    cap = {"capture_id": 1, "utc": "2026-10-03T04:34:41Z", "lat": None, "lon": None}
    near = [{"utc": "2026-10-03T04:34:39Z", "lat": 26.8, "lon": 80.9, "accuracy_m": 4.0}]
    far = [{"utc": "2026-10-03T04:34:30Z", "lat": 26.8, "lon": 80.9, "accuracy_m": 4.0}]
    placed = place_capture(cap, near)
    assert (placed["lat"], placed["pos_source"]) == (26.8, "phone_gps")
    assert place_capture(cap, far)["lat"] is None
    pod = dict(cap, lat=1.0, lon=2.0, pos_source="pod_gps")
    assert place_capture(pod, near)["pos_source"] == "pod_gps"


# =============================================================================
# 2. The gateway over HTTP (fake pipeline running the real LiveViewThread)
# =============================================================================

def _request(method: str, url: str, payload: Any = None) -> Tuple[int, bytes, Dict[str, str]]:
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers={"Content-Type": "application/json"} if data else {})
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, resp.read(), dict(resp.headers)
    except urllib.error.HTTPError as e:
        return e.code, e.read(), dict(e.headers)


@pytest.fixture
def gateway():
    with tempfile.TemporaryDirectory() as tmpdir:
        gw = EdgeGateway(host="127.0.0.1", port=0, db_path=Path(tmpdir) / "gw.db", allow_mock=True)
        gw.server.pipeline_script = str(ROOT / "tests" / "fixtures" / "fake_pipeline.py")
        gw.start_background()
        base = "http://127.0.0.1:%d" % gw.server_address[1]
        try:
            yield gw, base
        finally:
            if getattr(gw.server, "current_scan_proc", None) is not None:
                gw.server.stop_scan()
            gw.stop()


def _start_walk(base: str) -> str:
    status, body, _ = _request("POST", base + "/api/v1/scan/start", {"crop": "wheat", "field_id": "F01", "source": "camera"})
    assert status == 202, body
    scan_id = json.loads(body)["scan_id"]
    for _ in range(50):
        _, b, _ = _request("GET", base + "/api/v1/scan/status")
        if json.loads(b)["state"] == "scanning":
            return scan_id
        time.sleep(0.1)
    raise AssertionError("walk never reached scanning")


def _wait_for_frame(base: str) -> Tuple[bytes, Dict[str, str]]:
    for _ in range(50):
        status, body, headers = _request("GET", base + "/api/v1/camera/frame.jpg")
        if status == 200:
            return body, headers
        time.sleep(0.1)
    raise AssertionError("no preview frame arrived")


def test_frame_is_409_when_no_walk_is_running(gateway):
    _, base = gateway
    status, body, _ = _request("GET", base + "/api/v1/camera/frame.jpg")
    assert status == 409
    assert json.loads(body) == {"error": "camera_idle"}


def test_frame_is_a_jpeg_with_a_rising_sequence(gateway):
    _, base = gateway
    _start_walk(base)
    jpeg, headers = _wait_for_frame(base)
    assert jpeg[:2] == b"\xff\xd8"
    assert headers["Content-Type"] == "image/jpeg"
    assert headers["Cache-Control"] == "no-store"
    assert headers["X-Frame-Source"] == "camera"
    first = int(headers["X-Frame-Seq"])
    time.sleep(0.5)
    _, headers2 = _wait_for_frame(base)
    # The app calls the feed live only while this number rises.
    assert int(headers2["X-Frame-Seq"]) > first


def test_capture_returns_the_spec_shape_and_its_photo(gateway):
    _, base = gateway
    scan_id = _start_walk(base)
    _wait_for_frame(base)
    status, body, _ = _request("POST", base + "/api/v1/scan/capture", {"scan_id": scan_id})
    assert status == 200, body
    cap = json.loads(body)
    assert cap["capture_id"] == 1
    assert cap["verdict"] == "DISEASE" and cap["top_class"].startswith("wheat__")
    assert cap["quality"] == "OK"
    assert cap["cross_source_reliability"] == "TESTED_WEAK"
    for key in ("utc", "media_id", "image_path", "confidence", "lat", "lon", "pos_accuracy_m", "pos_source"):
        assert key in cap
    photo_status, photo, headers = _request("GET", base + cap["image_path"])
    assert photo_status == 200 and photo[:2] == b"\xff\xd8"
    assert headers["Content-Type"] == "image/jpeg"

    status, body, _ = _request("POST", base + "/api/v1/scan/capture", {"scan_id": scan_id})
    assert json.loads(body)["capture_id"] == 2


def test_capture_refusals(gateway):
    _, base = gateway
    status, body, _ = _request("POST", base + "/api/v1/scan/capture", {"scan_id": "nope"})
    assert status == 404 and json.loads(body)["error"] == "no_such_scan"
    scan_id = _start_walk(base)
    status, body, _ = _request("POST", base + "/api/v1/scan/capture", {"scan_id": "wrong"})
    assert status == 404
    assert scan_id


def test_media_other_than_captures_is_still_gone(gateway):
    _, base = gateway
    status, body, _ = _request("GET", base + "/api/v1/media/advisory_123")
    assert status == 410
    status, _, _ = _request("GET", base + "/api/v1/media/cap_..%2F..%2Fgw.db")
    assert status == 410


def test_captures_land_in_the_walk_advisory(gateway):
    gw, base = gateway
    scan_id = _start_walk(base)
    _wait_for_frame(base)
    status, _, _ = _request("POST", base + "/api/v1/scan/capture", {"scan_id": scan_id})
    assert status == 200
    _request("POST", base + "/api/v1/scan/stop", {})
    adv_id = None
    for _ in range(100):
        _, b, _ = _request("GET", base + "/api/v1/scan/status")
        st = json.loads(b)
        if st["state"] == "done":
            adv_id = st["advisory_id"]
            break
        time.sleep(0.1)
    assert adv_id
    status, b, _ = _request("GET", base + "/api/v1/advisory/" + urllib.request.quote(adv_id, safe=""))
    adv = json.loads(b)
    assert [c["capture_id"] for c in adv["captures"]] == [1]
    assert adv["captures"][0]["verdict"] == "DISEASE"
    # A capture is never an alert.
    assert adv["alerts"] == []
    status, _, _ = _request("GET", base + "/api/v1/camera/frame.jpg")
    assert status == 409


# =============================================================================
# 3. The real EdgePipeline: mock backend, replay of the repo's test video
# =============================================================================

TEST_VIDEO = ROOT / "test_video_from_dataset_images.mp4"


@pytest.mark.skipif(not TEST_VIDEO.exists(), reason="test video not in this checkout")
def test_real_pipeline_serves_a_capture_between_walk_frames():
    from edge.scan_pipeline import EdgePipeline

    with tempfile.TemporaryDirectory() as tmpdir:
        live_dir = Path(tmpdir) / "live"
        pipeline = EdgePipeline(
            source=str(TEST_VIDEO),
            backend="mock",
            output_jsonl=None,
            db_path=Path(tmpdir) / "edge.db",
            scan_id="2026-10-03T04:30:12Z_F01",
            field_id="F01",
            crop="wheat",
            until_stopped=True,
            status_file=Path(tmpdir) / "status.json",
            live_dir=live_dir,
            max_duration_s=60,
        )
        result = {}

        def ask():
            for _ in range(50):
                if read_preview(live_dir) is not None:
                    break
                time.sleep(0.1)
            result["preview"] = read_preview(live_dir)
            result["capture"] = request_capture(live_dir, 1, timeout_s=8.0)
            pipeline.stop(reason="user")

        asker = threading.Thread(target=ask)
        asker.start()
        pipeline.run()
        asker.join(10.0)

        jpeg, meta = result["preview"]
        assert jpeg[:2] == b"\xff\xd8" and meta["source"] == "replay" and meta["seq"] >= 1

        cap = result["capture"]
        assert cap is not None and "error" not in cap, cap
        assert cap["verdict"] in ("HEALTHY", "DISEASE", "UNCERTAIN", "NOT_CROP", "NO_DATA")
        assert (Path(tmpdir) / "media" / (cap["media_id"] + ".jpg")).exists()
        assert pipeline.t3_inference.captures_classified == (0 if cap["verdict"] == "NO_DATA" else 1)

        adv = pipeline.t4_decision.last_advisory
        assert [c["capture_id"] for c in adv["captures"]] == [1]
