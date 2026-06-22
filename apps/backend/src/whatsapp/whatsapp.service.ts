import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  WASocket,
  ConnectionState,
} from '@whiskeysockets/baileys';
import * as QRCode from 'qrcode';
import * as path from 'path';
import * as fs from 'fs/promises';

export type WaStatus = 'disconnected' | 'connecting' | 'qr' | 'connected';

@Injectable()
export class WhatsAppService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WhatsAppService.name);
  private readonly sessionDir = path.join(process.cwd(), 'wa-session');

  private sock: WASocket | null = null;
  private status: WaStatus = 'disconnected';
  private qrBase64: string | null = null;
  private connectedPhone: string | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  async onModuleInit() {
    await this.connect();
  }

  onModuleDestroy() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.sock?.end(undefined);
  }

  getStatus() {
    return {
      status: this.status,
      phone: this.connectedPhone,
      qr: this.status === 'qr' ? this.qrBase64 : null,
    };
  }

  async disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    try { await this.sock?.logout(); } catch { /* ignorar si ya estaba cerrado */ }
    try { this.sock?.end(undefined); } catch { /* ignorar */ }
    this.sock = null;
    this.status = 'disconnected';
    this.qrBase64 = null;
    this.connectedPhone = null;
    // Borrar archivos de sesión para que arranque limpio con nuevo QR
    await fs.rm(this.sessionDir, { recursive: true, force: true }).catch(() => {});
    // Reconectar inmediatamente para generar QR nuevo
    this.reconnectTimer = setTimeout(() => this.connect(), 500);
  }

  async sendMessage(phone: string, text: string): Promise<boolean> {
    if (!this.sock || this.status !== 'connected') {
      this.logger.warn(`WA sendMessage ignorado — status=${this.status}, sock=${!!this.sock}`);
      return false;
    }
    try {
      const digits = phone.replace(/\D/g, '');
      const normalized = digits.startsWith('57') && digits.length >= 12 ? digits : `57${digits}`;
      const jid = `${normalized}@s.whatsapp.net`;
      this.logger.log(`Enviando WA a ${jid}`);
      await this.sock.sendMessage(jid, { text });
      this.logger.log(`WA enviado OK → ${jid}`);
      return true;
    } catch (err: any) {
      this.logger.error(`Error enviando WA a ${phone}: ${err?.message}`);
      return false;
    }
  }

  async sendTest(phone: string): Promise<{ ok: boolean; message: string }> {
    if (this.status !== 'connected') {
      return { ok: false, message: `No hay sesión activa (estado: ${this.status}). Escanea el QR primero.` };
    }
    const sent = await this.sendMessage(phone, '✅ *AURA ERP* — Mensaje de prueba. La conexión de WhatsApp funciona correctamente.');
    return sent
      ? { ok: true,  message: `Mensaje enviado a ${phone}` }
      : { ok: false, message: 'No se pudo enviar el mensaje. Revisa los logs del servidor.' };
  }

  private async connect() {
    try {
      this.status = 'connecting';
      const { state, saveCreds } = await useMultiFileAuthState(this.sessionDir);

      let version: [number, number, number] = [2, 3000, 1023141645];
      try {
        const result = await fetchLatestBaileysVersion();
        version = result.version;
        this.logger.log(`Versión WA: ${version.join('.')}`);
      } catch {
        this.logger.warn(`No se pudo obtener versión de WA, usando versión de respaldo ${version.join('.')}`);
      }

      this.sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
        logger: { level: 'silent', trace: () => {}, debug: () => {}, info: () => {}, warn: () => {}, error: () => {}, child: () => ({ level: 'silent', trace: () => {}, debug: () => {}, info: () => {}, warn: () => {}, error: () => {}, child: () => ({} as any) }) } as any,
        browser: ['AURA', 'Chrome', '120.0'],
      });

      this.sock.ev.on('creds.update', saveCreds);

      this.sock.ev.on('connection.update', async (update: Partial<ConnectionState>) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          this.status = 'qr';
          this.qrBase64 = await QRCode.toDataURL(qr);
          this.logger.log('QR generado — escanea con WhatsApp');
        }

        if (connection === 'open') {
          this.status = 'connected';
          this.qrBase64 = null;
          const jid = this.sock?.user?.id ?? '';
          this.connectedPhone = jid.split(':')[0].split('@')[0];
          this.logger.log(`WhatsApp conectado: ${this.connectedPhone}`);
        }

        if (connection === 'close') {
          const err   = lastDisconnect?.error as any;
          const code  = err?.output?.statusCode ?? err?.status;
          const shouldReconnect = code !== DisconnectReason.loggedOut;

          this.sock = null;
          this.connectedPhone = null;

          if (shouldReconnect) {
            this.status = 'connecting';
            this.logger.warn(`WA desconectado (${code}), reconectando en 5s…`);
            this.reconnectTimer = setTimeout(() => this.connect(), 5000);
          } else {
            // Sesión cerrada desde el celular — borrar archivos y reconectar con QR nuevo
            await fs.rm(this.sessionDir, { recursive: true, force: true }).catch(() => {});
            this.logger.warn('WA cerró sesión (logged out) — generando QR nuevo…');
            this.reconnectTimer = setTimeout(() => this.connect(), 1000);
          }
        }
      });
    } catch (err: any) {
      this.logger.error(`Error iniciando WA: ${err?.message}`);
      this.status = 'disconnected';
      this.reconnectTimer = setTimeout(() => this.connect(), 10000);
    }
  }
}
