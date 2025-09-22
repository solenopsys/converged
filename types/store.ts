export interface StoreService {
  save(data:Uint8Array):Promise<hash>
  get(hash:hash):Promise<Uint8Array>
}