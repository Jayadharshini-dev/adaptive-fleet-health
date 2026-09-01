import type { FleetWebSocketEvent } from '../types/fleet';
import { getWsBaseUrl } from './api';

export type WebSocketStatusListener = (status: 'LIVE' | 'RECONNECTING' | 'OFFLINE') => void;
export type WebSocketEventListener = (event: FleetWebSocketEvent) => void;

class FleetWebSocketService {
  private ws: WebSocket | null = null;
  private statusListeners: Set<WebSocketStatusListener> = new Set();
  private eventListeners: Set<WebSocketEventListener> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private isIntentionallyClosed = false;
  private currentStatus: 'LIVE' | 'RECONNECTING' | 'OFFLINE' = 'OFFLINE';

  public connect() {
    this.isIntentionallyClosed = false;
    this.cleanup();

    const url = getWsBaseUrl();
    console.log(`[WS] Attempting connection to ${url}...`);
    this.setStatus('RECONNECTING');

    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        console.log('[WS] Connected successfully to fleet server');
        this.reconnectAttempts = 0;
        this.setStatus('LIVE');
        this.startHeartbeat();
      };

      this.ws.onmessage = (event: MessageEvent) => {
        try {
          const payload = JSON.parse(event.data) as FleetWebSocketEvent;
          this.notifyEvent(payload);
        } catch (err) {
          console.error('[WS] Failed to parse message payload:', err);
        }
      };

      this.ws.onerror = (err) => {
        console.warn('[WS] WebSocket error encounter:', err);
      };

      this.ws.onclose = (event) => {
        console.log(`[WS] Connection closed (code: ${event.code})`);
        this.stopHeartbeat();
        if (!this.isIntentionallyClosed) {
          this.setStatus('RECONNECTING');
          this.scheduleReconnect();
        } else {
          this.setStatus('OFFLINE');
        }
      };
    } catch (err) {
      console.warn('[WS] Could not initialize WebSocket:', err);
      this.scheduleReconnect();
    }
  }

  public disconnect() {
    this.isIntentionallyClosed = true;
    this.cleanup();
    this.setStatus('OFFLINE');
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn('[WS] Max reconnect attempts reached. Setting status to OFFLINE.');
      this.setStatus('OFFLINE');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 10000);
    console.log(`[WS] Reconnecting in ${Math.round(delay)}ms (attempt ${this.reconnectAttempts})...`);

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(JSON.stringify({ type: 'ping' }));
        } catch {
          // ignore
        }
      }
    }, 15000);
  }

  private stopHeartbeat() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private cleanup() {
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.onclose = null;
      try {
        this.ws.close();
      } catch {
        // ignore
      }
      this.ws = null;
    }
  }

  public getStatus(): 'LIVE' | 'RECONNECTING' | 'OFFLINE' {
    return this.currentStatus;
  }

  private setStatus(status: 'LIVE' | 'RECONNECTING' | 'OFFLINE') {
    this.currentStatus = status;
    this.statusListeners.forEach((listener) => listener(status));
  }

  private notifyEvent(event: FleetWebSocketEvent) {
    this.eventListeners.forEach((listener) => listener(event));
  }

  public subscribeStatus(listener: WebSocketStatusListener): () => void {
    this.statusListeners.add(listener);
    listener(this.currentStatus);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  public subscribeEvents(listener: WebSocketEventListener): () => void {
    this.eventListeners.add(listener);
    return () => {
      this.eventListeners.delete(listener);
    };
  }

  public onStatusChange(listener: WebSocketStatusListener): () => void {
    return this.subscribeStatus(listener);
  }

  public onEvent(listener: WebSocketEventListener): () => void {
    return this.subscribeEvents(listener);
  }

  /**
   * Helper to broadcast synthetic event (used by Simulator when running in mock mode)
   */
  public emitSyntheticEvent(event: FleetWebSocketEvent) {
    this.notifyEvent(event);
  }
}

export const wsService = new FleetWebSocketService();
