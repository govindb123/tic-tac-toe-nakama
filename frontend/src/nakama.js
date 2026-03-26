import { Client } from "@heroiclabs/nakama-js";

const host = process.env.REACT_APP_NAKAMA_HOST || "127.0.0.1";
const port = process.env.REACT_APP_NAKAMA_PORT || 7350;
const useSSL = process.env.REACT_APP_NAKAMA_SSL === "true";

const client = new Client("defaultkey", host, port, useSSL);

export async function initNakama(username) {
  let deviceId = localStorage.getItem("deviceId");
  if (!deviceId) {
    deviceId = `${username}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem("deviceId", deviceId);
  }

  const session = await client.authenticateDevice(deviceId, true, username);
  localStorage.setItem("username", session.username);

  const socket = client.createSocket(useSSL, false);
  await socket.connect(session, false);

  return { client, socket, session };
}

export async function refreshSession(session) {
  try {
    return await client.sessionRefresh(session);
  } catch {
    const username = localStorage.getItem("username");
    const deviceId = localStorage.getItem("deviceId");
    return await client.authenticateDevice(deviceId, true, username);
  }
}

export { client };
 