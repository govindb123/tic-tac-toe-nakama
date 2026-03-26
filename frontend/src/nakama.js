import { Client } from "@heroiclabs/nakama-js";

const host = process.env.REACT_APP_NAKAMA_HOST || "127.0.0.1";
const port = process.env.REACT_APP_NAKAMA_PORT || 7350;
const useSSL = process.env.REACT_APP_NAKAMA_SSL === "true";

const client = new Client("defaultkey", host, port, useSSL);

export function buildClient() {
  const storedHost = localStorage.getItem("nakamaHost");
  if (storedHost) {
    return { client: new Client("defaultkey", storedHost, 443, true), useSSL: true };
  }
  return { client, useSSL };
}

export async function initNakama(username) {
  const { client: c, useSSL: ssl } = buildClient();
  let deviceId = localStorage.getItem("deviceId");
  if (!deviceId) {
    deviceId = `${username}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem("deviceId", deviceId);
  }

  const session = await c.authenticateDevice(deviceId, true, username);
  localStorage.setItem("username", session.username);

  const socket = c.createSocket(ssl, false);
  await socket.connect(session, false);

  return { client: c, socket, session };
}

export async function refreshSession(session) {
  const { client: c } = buildClient();
  try {
    return await c.sessionRefresh(session);
  } catch {
    const username = localStorage.getItem("username");
    const deviceId = localStorage.getItem("deviceId");
    return await c.authenticateDevice(deviceId, true, username);
  }
}

export { client };
 