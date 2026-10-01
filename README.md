# AEGIS_X

**AEGIS — an offline, edge-AI smart farming assistant.**
A portable AI pod (Jetson Nano + RGB & thermal cameras) checks crop health, a fixed ESP32 sensor mast watches the field day and night, and the farmer gets clear advice on the phone — even with no internet.

Smart India Hackathon 2026 · Problem Statement 26180 · Team AEGIS_X (ID 135283)

## Repository layout

| Folder | What's inside |
|---|---|
| [`ai-pipeline/`](ai-pipeline/) | The AI side: model training (`train/`), the Jetson Nano edge runtime (`edge/`), shared core logic (`core/`, `configs/`), the pod gateway, mast firmware, tests and dataset splits. |
| [`app/`](app/) | The farmer side: the mobile app (`mobile/`), the project website (`web/`), design files and the app ↔ pod payload contract. |

Each folder keeps its own README with setup and run instructions.

## Links

- Live web app: https://sih-aegis-mobile.vercel.app
