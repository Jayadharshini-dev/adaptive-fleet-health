import type { HealthResult, RegionName } from '../types/fleet';
import { analyzeTelemetry, ingestTelemetryFeed } from './api';

export interface TelemetryPacketInput {
  device_id: string;
  device_instance_id?: string;
  region?: RegionName;
  temperature: number;
  vibration: number;
  current: number;
  rpm: number;
  timestamp?: string;
}

export const telemetryService = {
  /**
   * Validate and submit single telemetry packet to backend intelligence
   */
  async submitPacket(packet: TelemetryPacketInput): Promise<HealthResult> {
    if (!packet.device_id || !packet.device_id.trim()) {
      throw new Error('Device ID is required.');
    }
    if (isNaN(packet.temperature) || typeof packet.temperature !== 'number') {
      throw new Error('Temperature must be a valid number.');
    }
    if (isNaN(packet.vibration) || typeof packet.vibration !== 'number') {
      throw new Error('Vibration must be a valid number.');
    }
    if (isNaN(packet.current) || typeof packet.current !== 'number') {
      throw new Error('Current must be a valid number.');
    }
    if (isNaN(packet.rpm) || typeof packet.rpm !== 'number') {
      throw new Error('RPM must be a valid number.');
    }

    // Explicit protection against injecting status/anomaly directly
    const cleanPacket = {
      device_id: packet.device_id.trim().toUpperCase(),
      device_instance_id: packet.device_instance_id?.trim() || `INST-${packet.device_id.replace('DEV-', '')}`,
      region: packet.region,
      temperature: Number(packet.temperature),
      vibration: Number(packet.vibration),
      current: Number(packet.current),
      rpm: Math.round(Number(packet.rpm)),
      timestamp: packet.timestamp || new Date().toISOString(),
    };

    return await analyzeTelemetry(cleanPacket);
  },

  /**
   * Ingest raw JSON batch feed of telemetry packets
   */
  async ingestFeed(jsonString: string): Promise<HealthResult[]> {
    let parsed: any;
    try {
      parsed = JSON.parse(jsonString);
    } catch (e: any) {
      throw new Error(`Invalid JSON syntax: ${e.message}`);
    }

    const packetsList: any[] = Array.isArray(parsed)
      ? parsed
      : parsed.packets && Array.isArray(parsed.packets)
      ? parsed.packets
      : [parsed];

    if (packetsList.length === 0) {
      throw new Error('Telemetry feed must contain at least one packet.');
    }

    const cleaned: TelemetryPacketInput[] = [];

    for (let i = 0; i < packetsList.length; i++) {
      const p = packetsList[i];
      const devId = p.device_id || p.deviceId;
      if (!devId) {
        throw new Error(`Packet #${i + 1} missing required "device_id"`);
      }

      const temp = p.metrics?.temperature ?? p.temperature;
      const vib = p.metrics?.vibration ?? p.vibration;
      const curr = p.metrics?.current ?? p.current;
      const rpm = p.metrics?.rpm ?? p.rpm;

      if (temp === undefined || isNaN(Number(temp))) {
        throw new Error(`Packet #${i + 1} missing numeric "temperature"`);
      }
      if (vib === undefined || isNaN(Number(vib))) {
        throw new Error(`Packet #${i + 1} missing numeric "vibration"`);
      }
      if (curr === undefined || isNaN(Number(curr))) {
        throw new Error(`Packet #${i + 1} missing numeric "current"`);
      }
      if (rpm === undefined || isNaN(Number(rpm))) {
        throw new Error(`Packet #${i + 1} missing numeric "rpm"`);
      }

      cleaned.push({
        device_id: String(devId).toUpperCase(),
        device_instance_id: p.device_instance_id || p.instance_id,
        region: p.region,
        temperature: Number(temp),
        vibration: Number(vib),
        current: Number(curr),
        rpm: Math.round(Number(rpm)),
        timestamp: p.timestamp || new Date().toISOString(),
      });
    }

    return await ingestTelemetryFeed(cleaned);
  },
};
