export interface RuntimeCronService {
  refreshCrons(): Promise<void>;
}
