/**
 * @nrpc-service cron
 * @nrpc-package g-rt-cron
 */

export interface RuntimeCronService {
  refreshCrons(): Promise<void>;
}
