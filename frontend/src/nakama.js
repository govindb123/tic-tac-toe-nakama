import { Client } from "@heroiclabs/nakama-js";

const client = new Client("defaultkey", "127.0.0.1", 7350, false);

export async function initNakama(username) {
  let deviceId = localStorage.getItem("deviceId");
  if (!deviceId) {
    deviceId = `${username}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem("deviceId", deviceId);
  }

  const session = await client.authenticateDevice(deviceId, true, username);
  localStorage.setItem("username", session.username);

  const socket = client.createSocket(false, false);
  await socket.connect(session, false);

  return { client, socket, session };
}

export { client };
