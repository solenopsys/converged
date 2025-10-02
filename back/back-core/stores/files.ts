// sql

type file={
    id: string;
    name: string;
    size: number;
    type: string;
    owner: string;
    created_at: string;
    updated_at: string;
}


type chunk={
    hash: string;
    file_id: string;
    chunk_number: number;
    chunk_size: number;
    created_at: string; 
}