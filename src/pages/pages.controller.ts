import { Controller, Get, Post, Param, Body, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { SplitsService } from '../splits/splits.service';
import { SavingsService } from '../savings/savings.service';
import { TransactionsService } from '../transactions/transactions.service';

/* ----------------------------- helpers ----------------------------- */

function formatNaira(amount: number): string {
  return `\u20A6${amount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
}

function formatPlain(amount: number): string {
  return amount.toLocaleString('en-NG', { minimumFractionDigits: 2 });
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Squad logo, loaded from SQUAD_LOGO_URL (.env). Text fallback only if the var is missing. */
function squadLogo(logoUrl?: string): string {
  if (logoUrl) {
    return `<img src="${escapeHtml(logoUrl)}" alt="Squad" class="logo" />`;
  }
  return `<span class="logo-fallback">squad</span>`;
}

const BASE_CSS = `
  * { box-sizing: border-box; }
  body { font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; background: #E3E4E6; margin: 0; color: #2B3F6B; }
  .wrap { max-width: 560px; margin: 0 auto; padding: 28px 20px 40px; }
  .top { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 36px; }
  .logo { height: 40px; width: auto; display: block; }
  .logo-fallback { font-size: 32px; font-weight: 800; color: #B3174A; letter-spacing: -1px; }
  .meta { text-align: right; }
  .meta .who { font-size: 15px; font-weight: 600; color: #2B3F6B; word-break: break-all; }
  .meta .amt { display: flex; align-items: center; justify-content: flex-end; gap: 6px; margin-top: 4px; font-size: 28px; font-weight: 800; color: #2B3F6B; }
  .pill { background: #1E9E6A; color: #fff; font-size: 9px; font-weight: 700; padding: 3px 7px; border-radius: 999px; letter-spacing: .3px; }
  .panel { background: #EDEDEE; border-radius: 4px; padding: 28px 28px 32px; }
  .tabs { display: flex; border-bottom: 1px solid #D5D6D9; margin-bottom: 32px; }
  .tab { flex: 1; display: flex; align-items: center; justify-content: center; gap: 10px; padding: 14px 6px; font-size: 15px; font-weight: 500; color: #6F7280; cursor: pointer; border-bottom: 4px solid transparent; margin-bottom: -1px; user-select: none; }
  .tab.active { color: #2B3F6B; font-weight: 600; border-bottom-color: #2B3F6B; }
  .tab.disabled { cursor: default; opacity: .75; pointer-events: none; }
  .tab svg { flex: none; }
  .view { display: none; }
  .view.active { display: block; }
  .field { border: 1px solid #6B7B9C; border-radius: 4px; padding: 10px 16px 8px; margin-bottom: 10px; background: transparent; }
  .field label { display: block; font-size: 15px; text-transform: uppercase; color: #2B3F6B; margin: 0; }
  .field input { width: 100%; border: none; outline: none; background: transparent; font-size: 20px; color: #2B3F6B; padding: 6px 0 4px; font-family: inherit; }
  .field input::placeholder { color: #A9ABB2; }
  .field:focus-within { border-color: #2B3F6B; box-shadow: 0 0 0 1px #2B3F6B; }
  .row { display: flex; gap: 12px; }
  .row .field { flex: 1; min-width: 0; }
  .dl { border: 1px solid #6B7B9C; border-radius: 4px; padding: 6px 16px; margin-bottom: 10px; }
  .dl .item { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 14px 0; border-bottom: 1px solid #D5D6D9; }
  .dl .item:last-child { border-bottom: none; }
  .dl .k { font-size: 13px; text-transform: uppercase; color: #6F7280; }
  .dl .v { font-size: 17px; font-weight: 700; color: #2B3F6B; text-align: right; }
  .copy { background: none; border: none; color: #B3174A; font-weight: 700; font-size: 12px; cursor: pointer; margin-left: 10px; text-transform: uppercase; }
  .hint { font-size: 13px; color: #6F7280; margin: 0 0 14px; }
  .roundup { display: flex; align-items: center; gap: 10px; margin: 18px 2px 0; font-size: 13px; color: #2B3F6B; cursor: pointer; }
  .roundup input { accent-color: #CC1A4E; width: 16px; height: 16px; }
  .pay { display: block; width: 100%; margin-top: 22px; background: #CC1A4E; color: #fff; border: none; border-radius: 4px; padding: 20px; font-size: 16px; font-weight: 700; cursor: pointer; font-family: inherit; text-align: center; text-decoration: none; }
  .pay:hover { background: #B8173F; }
  .secure { text-align: center; color: #8A8D98; font-size: 12px; margin-top: 18px; }
  .center { text-align: center; padding: 12px 0; }
  .center h2 { margin: 14px 0 6px; font-size: 20px; color: #2B3F6B; }
  .center .big { font-size: 34px; font-weight: 800; color: #2B3F6B; margin: 8px 0; }
  .center p { margin: 6px 0; color: #6F7280; font-size: 14px; line-height: 1.5; }
  .tick { width: 64px; height: 64px; border-radius: 50%; background: #1E9E6A; display: inline-flex; align-items: center; justify-content: center; }
`;

/** Shared shell used by every page so the whole flow looks consistent. */
function layout(opts: {
  logoUrl?: string;
  body: string;
  right?: string;
  script?: string;
}): string {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Squad</title>
  <style>${BASE_CSS}</style>
</head>
<body>
  <div class="wrap">
    <div class="top">
      ${squadLogo(opts.logoUrl)}
      <div class="meta">${opts.right ?? ''}</div>
    </div>
    ${opts.body}
  </div>
  ${opts.script ? `<script>${opts.script}</script>` : ''}
</body>
</html>`;
}

/** Minimal message page (not found, already paid, success, etc.) */
function messagePage(logoUrl: string | undefined, inner: string, right?: string): string {
  return layout({
    logoUrl,
    right,
    body: `<div class="panel"><div class="center">${inner}</div></div>`,
  });
}

const CARD_ICON = `<svg width="20" height="16" viewBox="0 0 20 16" aria-hidden="true"><rect width="20" height="16" rx="3" fill="currentColor"/><rect y="4" width="20" height="3" fill="#EDEDEE"/><rect x="3" y="10" width="6" height="2" rx="1" fill="#EDEDEE"/></svg>`;

function checkoutPage(opts: {
  logoUrl?: string;
  title: string;
  payerName: string;
  share: number;
  roundedAmount: number;
  accountNumber: string;
  accountName: string;
  action: string;
}): string {
  const { logoUrl, title, payerName, share, roundedAmount, accountNumber, accountName, action } = opts;

  const right = `
    <div class="who">${escapeHtml(payerName)}</div>
    <div class="amt"><span class="pill">NGN</span><span id="topAmount">${formatPlain(share)}</span></div>
  `;

  const body = `
    <div class="panel">
      <div class="tabs">
        <div class="tab active" data-tab="card">${CARD_ICON}<span>Card</span></div>
        <div class="tab" data-tab="transfer"><span>Transfer</span></div>
        <div class="tab disabled" aria-disabled="true"><span>USSD</span></div>
        <div class="tab disabled" aria-disabled="true"><span>Bank</span></div>
      </div>

      <form method="POST" action="${escapeHtml(action)}">
        <!-- Card inputs intentionally have no name attribute, so card data is never sent to our server. -->
        <div class="view active" id="view-card">
          <div class="field">
            <label>Card number</label>
            <input id="cardNo" type="tel" inputmode="numeric" placeholder="0000 0000 0000 0000" maxlength="19" autocomplete="cc-number" />
          </div>
          <div class="row">
            <div class="field">
              <label>Card expiry</label>
              <input id="cardExp" type="tel" inputmode="numeric" placeholder="MM/YY" maxlength="5" autocomplete="cc-exp" />
            </div>
            <div class="field">
              <label>CVV</label>
              <input type="tel" inputmode="numeric" placeholder="123" maxlength="4" autocomplete="cc-csc" />
            </div>
          </div>
        </div>

        <div class="view" id="view-transfer">
          <p class="hint">Transfer the exact amount to the account below for ${escapeHtml(title)}.</p>
          <div class="dl">
            <div class="item">
              <span class="k">Account number</span>
              <span class="v"><span id="acctNo">${escapeHtml(accountNumber)}</span><button type="button" class="copy" id="copyBtn">Copy</button></span>
            </div>
            <div class="item">
              <span class="k">Account name</span>
              <span class="v">${escapeHtml(accountName)}</span>
            </div>
            <div class="item">
              <span class="k">Amount</span>
              <span class="v" id="transferAmount">NGN ${formatPlain(share)}</span>
            </div>
          </div>
        </div>

        <label class="roundup">
          <input type="checkbox" name="roundUp" value="yes" id="roundUp" />
          <span>Round up to ${formatNaira(roundedAmount)} for the group's Savings Box</span>
        </label>

        <button class="pay" type="submit" id="payBtn">Pay NGN ${formatPlain(share)}</button>
      </form>
    </div>
    <div class="secure">\uD83D\uDD12 Secured by Squad</div>
  `;

  const script = `
    (function () {
      var share = ${JSON.stringify(share)};
      var rounded = ${JSON.stringify(roundedAmount)};
      function fmt(n) { return n.toLocaleString('en-NG', { minimumFractionDigits: 2 }); }

      // Only Card <-> Transfer are interactive (USSD / Bank are disabled)
      var tabs = document.querySelectorAll('.tab[data-tab]');
      tabs.forEach(function (tab) {
        tab.addEventListener('click', function () {
          tabs.forEach(function (t) { t.classList.remove('active'); });
          document.querySelectorAll('.view').forEach(function (v) { v.classList.remove('active'); });
          tab.classList.add('active');
          document.getElementById('view-' + tab.getAttribute('data-tab')).classList.add('active');
        });
      });

      // Round-up updates every displayed amount
      var cb = document.getElementById('roundUp');
      cb.addEventListener('change', function () {
        var amt = cb.checked ? rounded : share;
        document.getElementById('topAmount').textContent = fmt(amt);
        document.getElementById('transferAmount').textContent = 'NGN ' + fmt(amt);
        document.getElementById('payBtn').textContent = 'Pay NGN ' + fmt(amt);
      });

      // Card number / expiry formatting (cosmetic)
      document.getElementById('cardNo').addEventListener('input', function (e) {
        var v = e.target.value.replace(/\\D/g, '').slice(0, 16);
        e.target.value = v.replace(/(.{4})/g, '$1 ').trim();
      });
      document.getElementById('cardExp').addEventListener('input', function (e) {
        var v = e.target.value.replace(/\\D/g, '').slice(0, 4);
        e.target.value = v.length > 2 ? v.slice(0, 2) + '/' + v.slice(2) : v;
      });

      // Copy account number
      document.getElementById('copyBtn').addEventListener('click', function () {
        var btn = this;
        var text = document.getElementById('acctNo').textContent;
        if (navigator.clipboard) {
          navigator.clipboard.writeText(text).then(function () {
            btn.textContent = 'Copied';
            setTimeout(function () { btn.textContent = 'Copy'; }, 1500);
          });
        }
      });
    })();
  `;

  return layout({ logoUrl, right, body, script });
}

/* ---------------------------- controller ---------------------------- */

@Controller('pay')
export class PagesController {
  constructor(
    private splitsService: SplitsService,
    private savingsService: SavingsService,
    private transactionsService: TransactionsService,
    private configService: ConfigService,
  ) {}

  private get logoUrl(): string | undefined {
    return this.configService.get<string>('SQUAD_LOGO_URL');
  }

  @Get(':splitId/:participantId')
  async payPage(
    @Param('splitId') splitId: string,
    @Param('participantId') participantId: string,
    @Res() res: Response,
  ) {
    const logoUrl = this.logoUrl;
    const split = await this.splitsService.findOne(splitId);
    const participant = split.participants.find((p) => p.id === participantId);

    if (!participant) {
      res.type('html').send(
        messagePage(logoUrl, `<h2>Not found</h2><p>This payment link is invalid.</p>`),
      );
      return;
    }

    if (participant.status === 'paid') {
      res.type('html').send(
        messagePage(
          logoUrl,
          `<h2>${escapeHtml(split.title)}</h2><p>You've already settled this.</p>`,
        ),
      );
      return;
    }

    if (participant.isGTUser) {
      const devUrl = this.configService.get<string>('EXPO_DEV_URL');
      const appLink = devUrl ? `exp://${devUrl}/--/` : '#';
      res.type('html').send(
        messagePage(
          logoUrl,
          `
          <h2>${escapeHtml(split.title)}</h2>
          <p>Hosted on GTWorld</p>
          <div class="big">${formatNaira(Number(participant.share))}</div>
          <p>You're a GTWorld user. Open the app to review and pay this from your account.</p>
          <a class="pay" href="${escapeHtml(appLink)}">Open GTWorld App</a>
        `,
        ),
      );
      return;
    }

    const share = Number(participant.share);
    const roundedAmount = Math.ceil(share / 10) * 10;

    // Adjust to whatever your Split entity calls the host's account name.
    const hostAccountName =
      (split as any).hostAccountName ?? (split as any).hostName ?? 'Account holder';

    // Shown top-right where the screenshot has the email; falls back to the participant name.
    const payerLabel = (participant as any).email ?? participant.name;

    res.type('html').send(
      checkoutPage({
        logoUrl,
        title: split.title,
        payerName: payerLabel,
        share,
        roundedAmount,
        accountNumber: split.hostAccountNumber,
        accountName: hostAccountName,
        action: `/pay/${splitId}/${participantId}/confirm`,
      }),
    );
  }

  @Post(':splitId/:participantId/confirm')
  async confirmPay(
    @Param('splitId') splitId: string,
    @Param('participantId') participantId: string,
    @Body() body: any,
    @Res() res: Response,
  ) {
    const logoUrl = this.logoUrl;
    const split = await this.splitsService.findOne(splitId);
    const participant = split.participants.find((p) => p.id === participantId);
    if (!participant) {
      res.type('html').send(messagePage(logoUrl, `<h2>Not found</h2>`));
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

    const paid = roundUp ? roundedAmount : share;

    res.type('html').send(
      messagePage(
        logoUrl,
        `
        <div class="tick">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 13l4 4L19 7"/></svg>
        </div>
        <h2>Payment successful</h2>
        <div class="big">NGN ${formatPlain(paid)}</div>
        <p>${escapeHtml(split.title)}</p>
        <p>Thanks for settling your share${roundUp ? ` \u2014 ${formatNaira(extra)} went into the group's Savings Box.` : '.'}</p>
      `,
        `<div class="who">${escapeHtml(participant.name)}</div>`,
      ),
    );
  }
}