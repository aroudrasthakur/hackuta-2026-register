export const OTP_SEND_BUCKET = "otp_send";
export const OTP_SEND_IP_BUCKET = "otp_send_ip";
export const OTP_SEND_GLOBAL_BUCKET = "otp_send_global";
// The persisted name is retained; this bucket counts reset requests for all emails.
export const PASSWORD_RESET_SEND_BUCKET = "password_reset_send";
export const PASSWORD_RESET_SEND_IP_BUCKET = "password_reset_send_ip";
export const PASSWORD_RESET_SEND_GLOBAL_BUCKET = "password_reset_send_global";
/** @deprecated Lookup probes no longer write rows; retained for legacy data cleanup. */
export const OTP_STATUS_LOOKUP_BUCKET = "otp_status_lookup";
export const RESUME_UPLOAD_BUCKET = "resume_upload";
