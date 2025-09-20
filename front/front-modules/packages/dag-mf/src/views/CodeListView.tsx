import React, { useEffect, useState } from "react";
import { ListView } from "converged-core";
import { codeSourceListFx } from "../functions/code-source.config";
import domain from "../domain";
import { sample } from "effector";



const codeSourceEvent = domain.createEvent<any>();


const store = domain.createStore<string[]>([]);






interface CodeItem { 
    id: string;
    name: string; }

export const CodeListView: React.FC = () => {
    const [data, setData] = useState<CodeItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const loadData = async () => {
            try {
                setLoading(true);
                const result = await codeSourceListFx();
                console.log("CODE SOURCE LIST", result);
                setData(result || []);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Произошла ошибка');
                console.error("Error loading code source list:", err);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, []);

    if (loading) {
        return <div>Загрузка...</div>;
    }

    if (error) {
        return <div>Ошибка: {error}</div>;
    }

    return <ListView items={data} title="Исходные коды" />;
};