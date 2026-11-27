/**
 * Who runs InRaf and which version of the legal terms is in force. Used by the Terms, Privacy and About pages and by
 * the server, which records the version each person agreed to when they sign in.
 */
export const COMPANY = {
  brand: "InRaf",
  /** The company that operates inraf.com. Replace with the exact registered name, country and address. */
  operator: "Qistas Chain",
  registeredIn: "",
  address: "",
  /** The registration line exactly as it should appear in the footer, e.g. the registry, licence or commercial
   *  registration number. Left blank until confirmed: nothing is shown rather than a made-up number. */
  registration: "",
  /** Licensed or registered activities, as stated in the licence. Blank until confirmed. */
  activities: "",
  email: "tayel@qistaschain.com",
  whatsapp: "",
};

/** Bump when the Terms or Privacy Policy change in substance: people agree again at their next sign-in. */
export const TERMS_VERSION = "2026-11-27.1";
export const TERMS_UPDATED = "27 November 2026";
