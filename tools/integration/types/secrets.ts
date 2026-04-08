export interface SecretsService {
  listSecrets(): Promise<string[]>;
  getSecret(name: string): Promise<Record<string, string>>;
  setSecret(name: string, data: Record<string, string>): Promise<void>;
  deleteSecret(name: string): Promise<void>;
}
