
export interface CallsService {

    list(): Promise<
        {
            id: string,
            date: string
        }[]>

    getTracks(id: string): Promise<{
        userTrack: ArrayBuffer,
        assistantTrack: ArrayBuffer
    }[]>

}


