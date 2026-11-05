/** Version of the privacy notice and terms; bump it when their text changes. */
export const PRIVACY_VERSION = "2026-11";
export const PRIVACY_UPDATED_ON = "5 de noviembre de 2026";

/**
 * Data controller shown in the privacy notice. Fill in before the public launch: Ley 1581 de
 * 2012 requires the controller's identity and a contact channel for data requests.
 */
export const DATA_CONTROLLER = {
  name: "Elacharger",
  contactEmail: process.env.NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL || null,
};
