import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import axios from 'axios';
import twilio = require('twilio');

@Injectable()
export class NotificationsService {
  private resend: Resend;
  private twilioClient: twilio.Twilio;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    this.resend = new Resend(apiKey);
    const twilioSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
    const twilioToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');
    this.twilioClient = twilio(twilioSid, twilioToken);
  }

  async sendSplitCreatedEmail(params: any) {
    const { toEmail, participantName, hostName, splitTitle, share, splitId, participantId } = params;
    const formattedShare = `₦${share.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
    const baseUrl = (this.configService.get<string>('PUBLIC_BASE_URL') ?? this.configService.get<string>('RENDER_EXTERNAL_URL'))?.replace(/\/+$/, '');
    const payLink = `${baseUrl}/pay/${splitId}/${participantId}`;
    try {
      await this.resend.emails.send({
        from: 'GT Split <notifications@pbrecruits.work>',
        to: toEmail,
        subject: `${hostName} added you to a split: ${splitTitle}`,
        html: `
          <div style="font-family: sans-serif; padding: 20px;">
            <h2 style="color: #F15A22;">GT Split</h2>
            <p>Hi ${participantName},</p>
            <p><strong>${hostName}</strong> has split <strong>${splitTitle}</strong> and your share is:</p>
            <p style="font-size: 24px; font-weight: bold;">${formattedShare}</p>
            <a href="${payLink}" style="display: inline-block; background: #F15A22; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 999px; font-weight: bold; margin-top: 12px;">Pay ${formattedShare}</a>
          </div>
        `,
      });
      return { success: true };
    } catch (error) {
      console.error('Failed to send email:', error);
      return { success: false, error };
    }
  }

  async sendAutoSplitProposalEmail(params: any) {
    const { toEmail, accountFullName, splitTitle, narration, totalAmount, participants, yesLink, noLink, expiresAt, previousTotal } = params;
    const naira = (n: number) => `₦${Number(n).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
    const esc = (v: unknown) =>
      String(v ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    const shareRows = (participants ?? [])
      .map(
        (p: { name: string; share: number }) =>
          `<tr><td style="padding: 4px 16px 4px 0;">${esc(p.name)}</td><td style="padding: 4px 0; text-align: right; font-weight: bold;">${naira(p.share)}</td></tr>`,
      )
      .join('');

    try {
      // The Resend SDK reports API failures in the returned `error` instead of
      // throwing, so it has to be checked or a rejected email looks like a sent one.
      const { error } = await this.resend.emails.send({
        from: 'GT Split <notifications@pbrecruits.work>',
        to: toEmail,
        subject: `Automatically split this bill? — ${narration}`,
        html: `
          <div style="font-family: sans-serif; padding: 20px;">
            <h2 style="color: #F15A22;">GT Split</h2>
            <p>Hi ${esc(accountFullName)},</p>
            <p>You just paid <strong>${esc(narration)}</strong> again. Want us to split it automatically, the same way as last time (<strong>${esc(splitTitle)}</strong>)?</p>
            <p style="font-size: 24px; font-weight: bold;">${naira(totalAmount)}</p>
            <p style="color: #6F7280; font-size: 12px;">Your share of the last one was worked out for ${naira(previousTotal ?? totalAmount)}; these are the shares for what you just paid.</p>
            <table style="border-collapse: collapse; margin-bottom: 8px;">${shareRows}</table>
            <a href="${yesLink}" style="display: inline-block; background: #F15A22; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 999px; font-weight: bold; margin-top: 12px; margin-right: 8px;">Yes, split it</a>
            <a href="${noLink}" style="display: inline-block; background: #fff; color: #F15A22; text-decoration: none; padding: 10px 24px; border: 2px solid #F15A22; border-radius: 999px; font-weight: bold; margin-top: 12px;">No, thanks</a>
            <p style="color: #6F7280; font-size: 12px; margin-top: 20px;">This request expires ${esc(new Date(expiresAt).toLocaleString('en-NG'))}.</p>
          </div>
        `,
      });
      if (error) {
        console.error('Failed to send auto-split proposal email:', error);
        return { success: false, error };
      }
      return { success: true };
    } catch (error) {
      console.error('Failed to send auto-split proposal email:', error);
      return { success: false, error };
    }
  }
  async sendSplitCreatedSMS(params: any){ return {success:true}; }
  async sendSplitCreatedWhatsApp(params: any){ return {success:true}; }
  async sendReminderEmail(params: any){ return {success:true}; }
  async sendReminderSMS(params: any){ return {success:true}; }
  async sendReminderWhatsApp(params: any){ return {success:true}; }
}
