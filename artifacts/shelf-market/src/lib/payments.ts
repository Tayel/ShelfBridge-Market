/**
 * How money moves on the live site. InRaf doesn't hold or move money yet: rent and deposits are paid directly to the
 * store owner, shoppers pay at the store's till, and the store pays each maker its share. InRaf records every payment,
 * sale and settlement so both sides see the same figures. Set ONLINE_PAYMENTS once a licensed payment provider is
 * connected; the browser demo (no backend) keeps its simulated checkout either way.
 */
export const ONLINE_PAYMENTS = false;
export const PAYMENT_METHODS = ["Bank transfer", "Cash", "Card at the store", "Mobile wallet", "Cheque", "Other"] as const;
/** Days after the end of each month by which the store pays makers for that month's till sales (agreement clause 10). */
export const SETTLEMENT_DAYS = 7;
