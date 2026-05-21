/** MushkilPay UI pack in `public/ui-assets/` (from design reference). */
const base = (file: string) => encodeURI(`/ui-assets/${file}`);

export const UI = {
  logo: base("MushkilPay Logo.png"),
  cardBg: base("muskilpay_card.png"),
  navHome: base("home.png"),
  navCards: base("card_management.png"),
  navTx: base("transactions.png"),
  navProfile: base("profile.png"),
  navSettings: base("settings.png"),
  iconTax: base("icon_tax_payment.png"),
  iconTransfer: base("icon_money_transfer.png"),
  iconIntl: base("icon_international_wallet.png"),
  iconBill: base("icon_bill_payment.png"),
  iconPrepaid: base("icon_prepaid_load.png"),
  iconCharity: base("icon_charity.png"),
  iconMobile: base("icon_mobile_packages.png"),
  iconQr: base("icon_qr_pay.png"),
} as const;
