import asyncio
import json
import sys
import websockets

WS_URL = "ws://127.0.0.1:8000/ws/fleet"

async def ws_client(client_id: str = "Client-1"):
    print("=" * 60)
    print(f"[{client_id}] Connecting to WebSocket: {WS_URL} ...")
    print("=" * 60)
    
    try:
        async with websockets.connect(WS_URL) as websocket:
            print(f"[{client_id}] ✓ Connected successfully!")
            
            # 1. Receive and print initial fleet snapshot
            init_raw = await websocket.recv()
            snapshot = json.loads(init_raw)
            event_type = snapshot.get("event")
            devices = snapshot.get("devices", [])
            print(f"[{client_id}] Received Initial Event: '{event_type}' with {len(devices)} devices.")
            print(f"[{client_id}] Sample Initial Device: {devices[0] if devices else 'None'}")
            print("-" * 60)
            print(f"[{client_id}] Listening for real-time fleet events (Press Ctrl+C to exit)...")
            print("-" * 60)

            # 2. Continuously listen for broadcasts
            while True:
                message = await websocket.recv()
                data = json.loads(message)
                event = data.get("event")
                if event == "telemetry_update":
                    print(f"[{client_id}] 📊 TELEMETRY UPDATE -> Device: {data.get('device_id')} ({data.get('region')}) | Temp: {data.get('temperature')}°C | Vib: {data.get('vibration')} | Curr: {data.get('current')}A | RPM: {data.get('rpm')} | Time: {data.get('timestamp')}")
                elif event == "device_update":
                    print(f"[{client_id}] ⚡ DEVICE UPDATE -> Device: {data.get('device_id')} | Status: {data.get('status')} | Anomaly: {data.get('failure_type')} | Confidence: {data.get('confidence')} | Region: {data.get('region')}")
                else:
                    print(f"[{client_id}] ⚡ RECEIVED EVENT -> {json.dumps(data, indent=2)}")

    except (websockets.exceptions.ConnectionClosedError, websockets.exceptions.ConnectionClosedOK):
        print(f"[{client_id}] WebSocket connection closed.")
    except ConnectionRefusedError:
        print(f"[{client_id}] ❌ Connection refused. Make sure backend is running at http://127.0.0.1:8000")
    except KeyboardInterrupt:
        print(f"\n[{client_id}] Exiting client.")

if __name__ == "__main__":
    cid = sys.argv[1] if len(sys.argv) > 1 else "Client-1"
    asyncio.run(ws_client(cid))
