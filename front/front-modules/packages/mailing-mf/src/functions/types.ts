// Интерфейсы
export type MailingStatistic = {
    warmedMailCount: number;
    mailCount: number;
    date: string;
}

export interface PaginationParams {
    offset: number;
    limit: number;
}

export interface PaginatedResult<T> {
    items: T[];
    totalCount?: number;
}

export interface Mail {
    id: string;
    subject: string;
    sender: string;
    recipient: string;
    date: string;
}

export interface OutMail {
    id: string;
    subject: string;
    from: string;
    to: string;
    date: string;
}

export interface Credential {
    id: string;
    username: string;
    email: string;
    password: string;
    group_name: string;
    fio: string;
}