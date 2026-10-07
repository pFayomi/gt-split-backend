import { Controller, Get, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AutosplitService } from './autosplit.service';

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const BASE_CSS = `
  * { box-sizing: border-box; }
  body { font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; background: #E3E4E6; margin: 0; color: #2B3F6B; }
  .wrap { max-width: 560px; margin: 0 auto; padding: 28px 20px 40px; }
  .panel { background: #EDEDEE; border-radius: 4px; padding: 28px 28px 32px; }
  h2 { margin: 0 0 12px; font-size: 20px; }
  p { margin: 6px 0; }
  .muted { color: #6F7280; }
`;

@Controller('auto-split')
export class AutosplitController {
  constructor(private autosplit: AutosplitService) {}

  @Get(':id/yes/:token')
  async approve(@Param('id') id: string, @Param('token') token: string, @Res() res: Response) {
    try {
      const result = await this.autosplit.approve(id, token);
      const html = `
        <html><head><meta charset="utf-8"/><style>${BASE_CSS}</style></head>
        <body><div class="wrap"><div class="panel">
          <h2>Auto-split approved</h2>
          <p>Created split <code>${escapeHtml(result.splitId)}</code>.</p>
          <p class="muted">You can close this window.</p>
        </div></div></body></html>
      `;
      res.type('html').send(html);
    } catch (e: any) {
      res.status(401).type('html').send(
        `<html><head><meta charset="utf-8"/><style>${BASE_CSS}</style></head><body><div class="wrap"><div class="panel"><h2>Couldn't approve</h2><p>${escapeHtml(e.message)}</p></div></div></body></html>`,
      );
    }
  }

  @Get(':id/no/:token')
  async decline(@Param('id') id: string, @Param('token') token: string, @Res() res: Response) {
    try {
      await this.autosplit.decline(id, token);
      const html = `
        <html><head><meta charset="utf-8"/><style>${BASE_CSS}</style></head>
        <body><div class="wrap"><div class="panel">
          <h2>Auto-split declined</h2>
          <p>No split was created. We'll ask again if the same narration hits next time.</p>
        </div></div></body></html>
      `;
      res.type('html').send(html);
    } catch (e: any) {
      res.status(401).type('html').send(
        `<html><head><meta charset="utf-8"/><style>${BASE_CSS}</style></head><body><div class="wrap"><div class="panel"><h2>Couldn't decline</h2><p>${escapeHtml(e.message)}</p></div></div></body></html>`,
      );
    }
  }
}