


enum StoreType {
    SQL = "SQL",
    FILES = "FILES",
    COLUMN = "COLUMN",
    KEY_VALUE = "KEY_VALUE",
}

interface Entity {
    id: string
}

interface Store {

}


function createStore(msName: string, dbName: string, type: StoreType): Store {

}

export { createStore, StoreType, Entity }