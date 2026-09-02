import argparse
import sys
import time
import requests

API_URL = "http://127.0.0.1:8000/detections"

SAMPLE_DETECTIONS = [
    {"device_id": "D17", "status": "CRITICAL", "failure_type": "spike", "confidence": 0.94},
    {"device_id": "D23", "status": "WARNING", "failure_type": "drift", "confidence": 0.88},
    {"device_id": "D31", "status": "CRITICAL", "failure_type": "flatline", "confidence": 0.97},
    {"device_id": "D42", "status": "CRITICAL", "failure_type": "oscillation", "confidence": 0.95},
    {"device_id": "D07", "status": "CRITICAL", "failure_type": "sensor_swap", "confidence": 0.91},
]

def send_detection(url: str, payload: dict):
    print(f"Sending detection -> Device: {payload['device_id']}, Type: {payload['failure_type']}, Status: {payload['status']}, Conf: {payload['confidence']}")
    try:
        response = requests.post(url, json=payload, timeout=5)
        if response.status_code == 201:
            print(f"✓ Success (HTTP 201): {response.json()['message']}")
        else:
            print(f"❌ Error (HTTP {response.status_code}): {response.text}")
    except requests.exceptions.ConnectionError:
        print(f"❌ Connection failed. Ensure backend is running at {url}")

def main():
    parser = argparse.ArgumentParser(description="Mock Anomaly Detection Event Generator for Phase 2 Testing")
    parser.add_argument("--url", default=API_URL, help="POST /detections URL")
    parser.add_argument("--device", help="Device ID (e.g., D17)")
    parser.add_argument("--status", choices=["HEALTHY", "WARNING", "CRITICAL"], default="CRITICAL")
    parser.add_argument("--type", choices=["drift", "spike", "flatline", "oscillation", "sensor_swap"], default="spike")
    parser.add_argument("--confidence", type=float, default=0.94)
    parser.add_argument("--run-all", action="store_true", help="Sequentially trigger sample detections for testing")
    parser.add_argument("--delay", type=float, default=1.5, help="Delay between sample detections (seconds)")

    args = parser.parse_args()

    print("=" * 60)
    print("Adaptive Fleet Backend - Mock Detection Event Generator")
    print("=" * 60)

    if args.run_all:
        print(f"Triggering {len(SAMPLE_DETECTIONS)} sample detections...")
        for item in SAMPLE_DETECTIONS:
            send_detection(args.url, item)
            time.sleep(args.delay)
    elif args.device:
        payload = {
            "device_id": args.device,
            "status": args.status,
            "failure_type": args.type,
            "confidence": args.confidence
        }
        send_detection(args.url, payload)
    else:
        print("No specific device provided. Triggering default sample detection (D17 -> spike)...")
        send_detection(args.url, SAMPLE_DETECTIONS[0])

if __name__ == "__main__":
    main()
