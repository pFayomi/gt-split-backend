import { Controller, Get, Post, Param, Body, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { SplitsService } from '../splits/splits.service';
import { SavingsService } from '../savings/savings.service';
import { TransactionsService } from '../transactions/transactions.service';

function formatNaira(amount: number): string {
  return `\u20A6${amount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
}

function page(bodyHtml: string): string {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>GT Split</title>
  <style>
    body { font-family: -apple-system, sans-serif; background: #F7F7F8; margin: 0; padding: 0; }
    .card { max-width: 420px; margin: 40px auto; background: #fff; border-radius: 16px; padding: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
    h1 { color: #F15A22; font-size: 20px; margin: 0 0 16px; }
    .amount { font-size: 32px; font-weight: 700; color: #1A1A1A; margin: 8px 0; }
    .sub { color: #6B6B6B; font-size: 14px; }
    .btn { display: block; width: 100%; background: #F15A22; color: #fff; text-align: center; padding: 14px; border-radius: 999px; text-decoration: none; font-weight: 600; border: none; font-size: 16px; margin-top: 16px; cursor: pointer; box-sizing: border-box; }
    label { display: flex; align-items: center; gap: 8px; margin: 16px 0; color: #1A1A1A; font-size: 14px; }
    .success { color: #1E9E52; font-size: 18px; font-weight: 700; text-align: center; }
  </style>
</head>
<body>
  <div class="card">${bodyHtml}</div>
</body>
</html>`;
}

@Controller('pay')
export class PagesController {
  constructor(
    private splitsService: SplitsService,
    private savingsService: SavingsService,
    private transactionsService: TransactionsService,
    private configService: ConfigService,
  ) {}

  @Get(':splitId/:participantId')
  async payPage(
    @Param('splitId') splitId: string,
    @Param('participantId') participantId: string,
    @Res() res: Response,
  ) {
    const split = await this.splitsService.findOne(splitId);
    const participant = split.participants.find((p) => p.id === participantId);

    if (!participant) {
      res.type('html').send(page(`<h1>Not found</h1><p class="sub">This payment link is invalid.</p>`));
      return;
    }

    if (participant.status === 'paid') {
      res.type('html').send(page(`<h1>${split.title}</h1><p class="success">You've already settled this.</p>`));
      return;
    }

    if (participant.isGTUser) {
      const devUrl = this.configService.get<string>('EXPO_DEV_URL');
      const appLink = devUrl ? `exp://${devUrl}/--/` : '#';
      res.type('html').send(page(`
        <h1>${split.title}</h1>
        <p class="sub">Hosted on GTWorld</p>
        <div class="amount">${formatNaira(Number(participant.share))}</div>
        <p class="sub">You're a GTWorld user. Open the app to review and pay this from your account.</p>
        <a class="btn" href="${appLink}">Open GTWorld App</a>
      `));
      return;
    }

    const share = Number(participant.share);
    const roundedAmount = Math.ceil(share / 10) * 10;

    res.type('html').send(page(`
      <h1>${split.title}</h1>
      <p class="sub">Your share</p>
      <div class="amount">${formatNaira(share)}</div>
      <form method="POST" action="/pay/${splitId}/${participantId}/confirm">
        <label><input type="checkbox" name="roundUp" value="yes" /> Round up to ${formatNaira(roundedAmount)} for the group's Savings Box</label>
        <button class="btn" type="submit">Continue to Pay</button>
      </form>
    `));
  }

  @Post(':splitId/:participantId/confirm')
  async confirmPay(
    @Param('splitId') splitId: string,
    @Param('participantId') participantId: string,
    @Body() body: any,
    @Res() res: Response,
  ) {
    const split = await this.splitsService.findOne(splitId);
    const participant = split.participants.find((p) => p.id === participantId);
    if (!participant) {
      res.type('html').send(page(`<h1>Not found</h1>`));
      return;
    }

    const share = Number(participant.share);
    const roundUp = body.roundUp === 'yes';
    const roundedAmount = Math.ceil(share / 10) * 10;
    const extra = roundedAmount - share;

    await this.splitsService.toggleParticipantStatus(splitId, participantId);
    await this.transactionsService.credit(
      split.hostAccountNumber,
      share,
      `${participant.name} settled their share`,
      split.title,
    );

    if (roundUp && extra > 0) {
      await this.savingsService.contribute({
        accountNumber: split.hostAccountNumber,
        contributorName: participant.name,
        splitId: split.id,
        splitTitle: split.title,
        amount: extra,
      });
    }

    res.type('html').send(page(`
      <h1>${split.title}</h1>
      <p class="success">Payment successful \u2713</p>
      <div class="amount">${formatNaira(roundUp ? roundedAmount : share)}</div>
      <p class="sub">Thanks for settling your share${roundUp ? ` \u2014 ${formatNaira(extra)} went into the group's Savings Box.` : '.'}</p>
    `));
  }
}