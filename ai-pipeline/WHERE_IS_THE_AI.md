# Where is the AI?

A map of the AI files, in the order a camera photo flows through them. File names say what each file does.

## The two AI models

| Model | What it does | Built in | Trained in | File the Jetson runs |
|---|---|---|---|---|
| **Model A** | Diagnoses crop disease from a leaf photo (EfficientNet-Lite0, 29 classes: rice, sugarcane, wheat, not_crop) | `train/disease_model_a_efficientnet.py` | `train/train_disease_model_a.py` | `artifacts/engines/model_a_fp16.engine` |
| **Model B** | Classifies insects on sticky-trap photos (small CNN, 3 classes) | `train/insect_model_b_cnn.py` | `train/train_insect_model_b.py` | `artifacts/onnx/model_b.onnx` |

Class lists: `configs/disease_classes_model_a.py`, `configs/insect_classes_model_b.py`.
All thresholds and training settings: `configs/model_settings.py`.

## What happens to one photo on the pod (`edge/` and `core/`)

| Step | File | What it does |
|---|---|---|
| 1 | `edge/camera.py` | Takes the photo with locked colour and exposure |
| 2 | `edge/frame_quality_check.py` | Rejects blurry, dark or repeated frames |
| 3 | `edge/leaf_tile_finder.py` | Cuts the photo into 9 tiles and keeps the green (leaf) ones |
| 4 | `core/vegetation_indices.py` | Excess Green and other plant indices used to find leaf pixels |
| 5 | `edge/disease_model_runtime_tensorrt.py` | Runs Model A on the GPU (TensorRT) |
| 6 | `core/unknown_object_rejection.py` | Says "not a crop" / "unknown" / "not sure" instead of guessing |
| 7 | `core/verdict_aggregation.py` | Combines tiles into one verdict per photo and per field cell |
| 8 | `edge/advice_rules_engine.py` | Turns the verdict into cited, fixed advice (no AI-written text) |
| 9 | `edge/scan_database.py` | Saves scans and advisories (SQLite) |
| 10 | `gateway/server.py` | Serves results to the farmer's phone over Wi-Fi |

The whole walk is coordinated by `edge/scan_pipeline.py`. Farmer photos (Capture) go through `edge/live_view_and_capture.py`.

## Insect counting (Model B)

`core/trap_insect_segmentation.py` finds insect blobs on the trap card, Model B labels them, and `edge/trap_insect_counting_job.py` runs the job and compares counts to pest action thresholds.

## How the models were made (`train/`)

| Stage | File |
|---|---|
| Build the image list | `train/dataset_build_manifest.py` |
| Remove duplicate images | `train/dataset_dedup.py` |
| Split into train / test without leaks | `train/dataset_split.py` |
| Check backgrounds don't give away labels | `train/dataset_background_bias_audit.py` |
| Load images for training | `train/dataset_loader_model_a.py` |
| Field-condition augmentations | `train/augmentations_model_a.py`, `train/augmentations_model_b.py` |
| Train | `train/train_disease_model_a.py`, `train/train_insect_model_b.py` |
| Calibrate confidence and "unknown" thresholds | `train/calibrate_disease_model_a.py` |
| Measure accuracy | `train/evaluate_disease_model_a.py` |
| Export for the Jetson | `train/export_disease_model_a_onnx.py`, then `scripts/build_trt_engine.sh` |

Results and evidence: `artifacts/reports/` (accuracy, confusion matrix, Grad-CAM, Jetson speed).

## Other sensors (not AI)

`core/water_stress_thermal.py` (crop water stress from canopy temperature), `edge/thermal_camera_mlx90640.py`, `edge/ir_thermometer_mlx90614.py`, `edge/soil_moisture_adc.py`, `edge/gps_and_mast_sensors.py`, `edge/mast_data_collector.py` (field station readings), `edge/satellite_ndvi.py`, `core/ndvi_nir_camera.py`, `edge/irrigation_model.py`, `core/growth_stage.py`.
