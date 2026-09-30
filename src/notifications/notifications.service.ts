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

  async sendSplitCreatedEmail(params: {
    toEmail: string;
    participantName: string;
    hostName: string;
    splitTitle: string;
    share: number;
    splitId: string;
    participantId: string;
  }) {
    const { toEmail, participantName, hostName, splitTitle, share, splitId, participantId } = params;
    const formattedShare = `\u20A6${share.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
    const baseUrl = this.configService.get<string>('PUBLIC_BASE_URL');
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
            <p style="margin-top: 16px; color: #6B6B6B; font-size: 13px;">Or open GTWorld to review and settle your share.</p>
          </div>
        `,
      });
      return { success: true };
    } catch (error) {
      console.error('Failed to send email:', error);
      return { success: false, error };
    }
  }

  async sendSplitCreatedSMS(params: {
    toPhone: string;
    hostName: string;
    splitTitle: string;
    share: number;
    splitId: string;
    participantId: string;
  }) {
    const { toPhone, hostName, splitTitle, share, splitId, participantId } = params;
    const apiKey = this.configService.get<string>('TERMII_API_KEY');
    const senderId = this.configService.get<string>('TERMII_SENDER_ID');
    const formattedShare = `N${share.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
    const baseUrl = this.configService.get<string>('PUBLIC_BASE_URL');
    const payLink = `${baseUrl}/pay/${splitId}/${participantId}`;

    try {
      const response = await axios.post('https://v3.api.termii.com/api/sms/send', {
        to: toPhone,
        from: senderId,
        sms: `GT Split: ${hostName} split ${splitTitle}. Your share is ${formattedShare}. Pay here: ${payLink}`,
        type: 'plain',
        channel: 'generic',
        api_key: apiKey,
      });
      console.log('Termii response:', response.data);
      return { success: true, data: response.data };
    } catch (error: any) {
      console.error('Failed to send SMS:', error.response?.data || error.message);
      return { success: false, error };
    }
  }

  async sendSplitCreatedWhatsApp(params: {
    toPhone: string;
    hostName: string;
    splitTitle: string;
    share: number;
    splitId: string;
    participantId: string;
  }) {
    const { toPhone, hostName, splitTitle, share, splitId, participantId } = params;
    const fromNumber = this.configService.get<string>('TWILIO_WHATSAPP_FROM');
    const formattedShare = `\u20A6${share.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
    const baseUrl = this.configService.get<string>('PUBLIC_BASE_URL');
    const payLink = `${baseUrl}/pay/${splitId}/${participantId}`;

    const cleanPhone = toPhone.replace(/[^\d+]/g, '');

    try {
      const message = await this.twilioClient.messages.create({
        from: fromNumber,
        to: `whatsapp:${cleanPhone}`,
        body: `GT Split: ${hostName} split "${splitTitle}". Your share is ${formattedShare}. Pay here: ${payLink}`,
      });
      console.log('WhatsApp sent:', message.sid);
      return { success: true, sid: message.sid };
    } catch (error: any) {
      console.error('Failed to send WhatsApp:', error.message);
      return { success: false, error };
    }
  }

  async sendReminderEmail(params: {
    toEmail: string;
    participantName: string;
    hostName: string;
    splitTitle: string;
    share: number;
    splitId: string;
    participantId: string;
  }) {
    const { toEmail, participantName, hostName, splitTitle, share, splitId, participantId } = params;
    const formattedShare = `\u20A6${share.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
    const baseUrl = this.configService.get<string>('PUBLIC_BASE_URL');
    const payLink = `${baseUrl}/pay/${splitId}/${participantId}`;

    try {
      await this.resend.emails.send({
        from: 'GT Split <notifications@pbrecruits.work>',
        to: toEmail,
        subject: `Reminder: you still owe ${formattedShare} for ${splitTitle}`,
        html: `
          <div style="font-family: sans-serif; padding: 20px;">
            <h2 style="color: #F15A22;">GT Split</h2>
            <p>Hi ${participantName},</p>
            <p>Just a reminder \u2014 <strong>${hostName}</strong> is still waiting on your share for <strong>${splitTitle}</strong>:</p>
            <p style="font-size: 24px; font-weight: bold;">${formattedShare}</p>
            <a href="${payLink}" style="display: inline-block; background: #F15A22; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 999px; font-weight: bold; margin-top: 12px;">Pay ${formattedShare}</a>
          </div>
        `,
      });
      return { success: true };
    } catch (error) {
      console.error('Failed to send reminder email:', error);
      return { success: false, error };
    }
  }

  async sendReminderSMS(params: {
    toPhone: string;
    hostName: string;
    splitTitle: string;
    share: number;
    splitId: string;
    participantId: string;
  }) {
    const { toPhone, hostName, splitTitle, share, splitId, participantId } = params;
    const apiKey = this.configService.get<string>('TERMII_API_KEY');
    const senderId = this.configService.get<string>('TERMII_SENDER_ID');
    const formattedShare = `N${share.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
    const baseUrl = this.configService.get<string>('PUBLIC_BASE_URL');
    const payLink = `${baseUrl}/pay/${splitId}/${participantId}`;

    try {
      const response = await axios.post('https://v3.api.termii.com/api/sms/send', {
        to: toPhone,
        from: senderId,
        sms: `Reminder from GT Split: ${hostName} is still waiting on ${formattedShare} for ${splitTitle}. Pay here: ${payLink}`,
        type: 'plain',
        channel: 'generic',
        api_key: apiKey,
      });
      return { success: true, data: response.data };
    } catch (error: any) {
      console.error('Failed to send reminder SMS:', error.response?.data || error.message);
      return { success: false, error };
    }
  }

  async sendReminderWhatsApp(params: {
    toPhone: string;
    hostName: string;
    splitTitle: string;
    share: number;
    splitId: string;
    participantId: string;
  }) {
    const { toPhone, hostName, splitTitle, share, splitId, participantId } = params;
    const fromNumber = this.configService.get<string>('TWILIO_WHATSAPP_FROM');
    const formattedShare = `\u20A6${share.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
    const baseUrl = this.configService.get<string>('PUBLIC_BASE_URL');
    const payLink = `${baseUrl}/pay/${splitId}/${participantId}`;

    const cleanPhone = toPhone.replace(/[^\d+]/g, '');

    try {
      const message = await this.twilioClient.messages.create({
        from: fromNumber,
        to: `whatsapp:${cleanPhone}`,
        body: `Reminder from GT Split: ${hostName} is still waiting on ${formattedShare} for "${splitTitle}". Pay here: ${payLink}`,
      });
      return { success: true, sid: message.sid };
    } catch (error: any) {
      console.error('Failed to send reminder WhatsApp:', error.message);
      return { success: false, error };
    }
  }
}