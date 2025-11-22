import { ModulesService } from "../../../../../../types/modules";

const remotePrefix = "https://converged-modules.s3.us-east-2.amazonaws.com/front/"
const localPrefix = "http://localhost:3005/modules/"

const localesPrefixes = ["en", "ru", "de", "fr", "it", "pt"]

const staticModules: any = [
    {
        "name": "dag-mf",
        "remote": true,
        "protected": true
    },
    {
        "name": "aichats-mf",
        "remote": true,
        "protected": false,
    },   {
        "name": "sales-mf",
        "remote": true,
        "protected": false,
    },
    {
        "name": "auth-mf",
        "remote": true,
        "protected": false,
    },
    {
        "name": "layouts-mf",
        "remote": true,
        "protected": false,
    },
    {
        "name": "mailing-mf",
        "remote": true,
        "protected": false,
    }
]

class ModulesServiceImpl implements ModulesService {

    constructor(config: any) {
        console.log("ModulesServiceImpl constructor", config)
    }

    list(): Promise<{
        name: string,
        link: string,
        protected: boolean
        locales: { [key: string]: string }
    }[]> {
        const modules = staticModules.map((module) => {
            const link = module.remote
                ? remotePrefix + module.name + ".js"
                : localPrefix + module.name + ".js"

            const locales = {}
            const prefix = module.remote ? remotePrefix : localPrefix

            for (const locale of localesPrefixes) {
                locales[locale] = prefix + "locale/" + module.name + "/" + locale + ".json"
            }

            return {
                name: module.name,
                protected: module.protected,
                link: link,
                locales: locales
            }
        })
        console.log("ModulesServiceImpl list", modules)
        return Promise.resolve(modules)
    }

    add(name: string): Promise<void> {
        return Promise.resolve()
    }

    remove(name: string): Promise<void> {
        return Promise.resolve()
    }
}

export default ModulesServiceImpl;
