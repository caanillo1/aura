import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as nodemailer from 'nodemailer';
import { Resend } from 'resend';

@Injectable()
export class MailService {
  constructor(private prisma: PrismaService) {}

  async sendFromCompany(
    companyId: string,
    to: string[],
    subject: string,
    html: string,
    attachments?: { filename: string; content: Buffer; contentType: string }[],
  ) {
    const [company, configs] = await Promise.all([
      this.prisma.company.findUnique({
        where: { id: companyId },
        select: {
          smtpHost: true, smtpPort: true,
          smtpUser: true, smtpPassword: true,
          smtpFromName: true, smtpFromEmail: true,
          emailSignature: true,
        },
      }),
      this.prisma.systemConfig.findMany({
        where: { companyId, configKey: { in: ['resend_api_key', 'resend_from_email', 'proveedor_correo'] } },
        select: { configKey: true, configValue: true },
      }),
    ]);

    const resendKey      = configs.find(c => c.configKey === 'resend_api_key')?.configValue;
    const resendFrom     = configs.find(c => c.configKey === 'resend_from_email')?.configValue;
    const proveedorPref  = configs.find(c => c.configKey === 'proveedor_correo')?.configValue ?? 'resend';

    const signature = company?.emailSignature
      ? `<br/><br/><hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0"/>
         <div style="font-size:13px;color:#64748b">${company.emailSignature}</div>`
      : '';

    const fullHtml = html + signature;

    // ── Proveedor: Resend ────────────────────────────────────────────────────
    if (proveedorPref === 'resend' && resendKey) {
      const resend = new Resend(resendKey);
      const fromName  = company?.smtpFromName ?? 'AURA';
      const fromEmail = resendFrom || company?.smtpFromEmail || 'onboarding@resend.dev';
      const from      = `${fromName} <${fromEmail}>`;

      try {
        const resendAttachments = (attachments ?? []).map(a => ({
          filename: a.filename,
          content: a.content.toString('base64'),
        }));
        const { error } = await resend.emails.send({
          from, to, subject, html: fullHtml,
          ...(resendAttachments.length ? { attachments: resendAttachments } : {}),
        });
        if (error) {
          throw new BadRequestException(`Error de Resend: ${error.message}`);
        }
      } catch (err: any) {
        if (err instanceof BadRequestException) throw err;
        throw new BadRequestException(`Error al enviar con Resend: ${err?.message ?? 'desconocido'}`);
      }
      return;
    }

    // ── Proveedor: SMTP ──────────────────────────────────────────────────────
    if (proveedorPref === 'resend' && !resendKey) {
      throw new BadRequestException(
        'El proveedor seleccionado es Resend pero no hay API Key configurada. Ve a Configuración → Parámetros del Sistema → Resend API Key.',
      );
    }
    if (!company?.smtpHost || !company.smtpUser || !company.smtpPassword) {
      throw new BadRequestException(
        'El proveedor seleccionado es SMTP pero faltan datos. Ve a Configuración → Datos de la Empresa y completa la sección Correo SMTP.',
      );
    }

    const port   = company.smtpPort ?? 587;
    const secure = [465, 8465, 443].includes(port); // puertos SSL

    const transport = nodemailer.createTransport({
      host: company.smtpHost,
      port,
      secure,
      requireTLS: !secure, // STARTTLS para puertos 2525, 587, 8025, etc.
      auth: { user: company.smtpUser, pass: company.smtpPassword },
      tls:  { rejectUnauthorized: false },
    });

    try {
      await transport.sendMail({
        from:    `"${company.smtpFromName ?? 'AURA'}" <${company.smtpFromEmail ?? company.smtpUser}>`,
        to:      to.join(', '),
        subject,
        html:    fullHtml,
        attachments: (attachments ?? []).map(a => ({
          filename:    a.filename,
          content:     a.content,
          contentType: a.contentType,
        })),
      });
    } catch (err: any) {
      const msg: string = err?.message ?? '';
      if (msg.includes('Invalid login') || msg.includes('Authentication') || msg.includes('535') || msg.includes('534')) {
        throw new BadRequestException('Credenciales SMTP incorrectas. Verifica el usuario y la contraseña en Configuración → Datos de la Empresa.');
      }
      if (msg.includes('ECONNREFUSED') || msg.includes('ETIMEDOUT') || msg.includes('ENOTFOUND')) {
        throw new BadRequestException(`No se pudo conectar al servidor SMTP "${company.smtpHost}:${port}". Verifica el host y el puerto.`);
      }
      if (msg.includes('certificate') || msg.includes('TLS') || msg.includes('SSL')) {
        throw new BadRequestException(`Error de certificado TLS en puerto ${port}. Para STARTTLS usa: 2525, 587, 8025. Para SSL usa: 465, 8465, 443.`);
      }
      throw new BadRequestException(`Error al enviar el correo: ${msg}`);
    }
  }
}
